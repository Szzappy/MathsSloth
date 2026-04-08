import express from "express";
import pool from "../config/db.js";
import "dotenv/config";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPEN_API_KEY });
const router = express.Router();

// Separates flat question rows into a tree of parent questions with nested parts.
// doneParts holds already-completed siblings so the frontend can show them greyed out.
function groupQuestionParts(rows) {
  const questionsMap = new Map();
  const topLevel = [];

  for (const row of rows) {
    if (!row.parent_question_id) {
      row.parts = [];
      row.doneParts = [];
      questionsMap.set(row.questionid, row);
      topLevel.push(row);
    }
  }

  // Attach each child part to its parent, split by completion status
  for (const row of rows) {
    if (row.parent_question_id) {
      const parent = questionsMap.get(row.parent_question_id);
      if (parent) {
        if (row.is_complete) {
          parent.doneParts.push(row);
        } else {
          parent.parts.push(row);
        }
      }
    }
  }

  for (const q of topLevel) {
    q.parts.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    q.doneParts.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }

  // Drop parent stems where all child parts are already complete
  return topLevel.filter(q => {
    if (q.has_parts && q.parts.length === 0) {
      console.log(`Skipping orphan parent stem q${q.questionid} - all children complete`);
      return false;
    }
    return true;
  });
}

// Inserts questions into quiz_questions, expanding multi-part stems into their child parts.
// Standalone questions are inserted directly; stems are never inserted only their children are.
async function insertQuestionsIntoQuiz(client, quizId, questions) {
  for (let i = 0; i < questions.length; i++) {
    const questionId = questions[i].questionid;

    const parts = await client.query(`
      SELECT questionid FROM questions
      WHERE parent_question_id = $1
      ORDER BY order_index ASC
    `, [questionId]);

    if (parts.rows.length === 0) {
      // Standalone question
      await client.query(`
        INSERT INTO quiz_questions (quizid, questionid, question_order)
        VALUES ($1, $2, $3)
      `, [quizId, questionId, i + 1]);
    } else {
      // Multi-part stem - insert child parts only
      console.log("Inserting", parts.rows.length, "child parts for stem question", questionId);
      for (const part of parts.rows) {
        await client.query(`
          INSERT INTO quiz_questions (quizid, questionid, question_order)
          VALUES ($1, $2, $3)
        `, [quizId, part.questionid, i + 1]);
      }
    }
  }
}

// Fetches all questions for a quiz grouped by parent-child relationships.
// Used by both quiz creation and quiz continuation so the frontend always
// receives the same structure without needing a page reload.
async function fetchGroupedQuestionsForQuiz(quizId) {
  const unansweredQuestions = await pool.query(`
    SELECT questionid, question_text, image_url, question_format,
      correct_answer, answer_options, explanation, total_marks,
      parent_question_id, part_label, order_index,
      question_order, quizid, is_complete, has_parts
    FROM (
      SELECT
        q.questionid, q.question_text, q.image_url, q.question_format,
        q.correct_answer, q.answer_options, q.explanation, q.total_marks,
        q.parent_question_id, q.part_label, q.order_index,
        qq.question_order, qq.quizid, qq.is_complete,
        EXISTS (
          SELECT 1 FROM questions child WHERE child.parent_question_id = q.questionid
        ) AS has_parts,
        ROW_NUMBER() OVER (PARTITION BY q.questionid ORDER BY qq.question_order ASC) AS rn
      FROM questions q
      JOIN quiz_questions qq ON q.questionid = qq.questionid
      WHERE qq.quizid = $1
        AND (
          qq.is_complete = FALSE
          OR (
            -- Include completed siblings so the frontend can show them greyed out
            qq.is_complete = TRUE
            AND q.parent_question_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM quiz_questions qq2
              JOIN questions sib ON qq2.questionid = sib.questionid
              WHERE sib.parent_question_id = q.parent_question_id
                AND qq2.quizid = $1
                AND qq2.is_complete = FALSE
            )
          )
        )
        AND NOT (
          -- Exclude parent stems whose children are all complete
          q.parent_question_id IS NULL
          AND EXISTS (
            SELECT 1 FROM questions child WHERE child.parent_question_id = q.questionid
          )
          AND NOT EXISTS (
            SELECT 1 FROM quiz_questions qq2
            JOIN questions child2 ON qq2.questionid = child2.questionid
            WHERE child2.parent_question_id = q.questionid
              AND qq2.quizid = $1
              AND qq2.is_complete = FALSE
          )
        )
    ) deduped
    WHERE rn = 1
    ORDER BY question_order ASC, order_index ASC
  `, [quizId]);

  const rows = unansweredQuestions.rows;

  // Stems are not stored in quiz_questions so fetch them separately and inject as synthetic rows
  const parentIds = [...new Set(
    rows.filter(r => r.parent_question_id).map(r => r.parent_question_id)
  )];

  let syntheticStems = [];
  if (parentIds.length > 0) {
    const stemResult = await pool.query(`
      SELECT questionid, question_text, image_url, question_format,
             total_marks, part_label, order_index
      FROM questions
      WHERE questionid = ANY($1)
    `, [parentIds]);

    syntheticStems = stemResult.rows.map(stem => ({
      ...stem,
      parent_question_id: null,
      is_complete: false,
      has_parts: true,
      question_order: null,
      quizid: quizId,
    }));
  }

  const allRows = [...syntheticStems, ...rows];
  return groupQuestionParts(allRows);
}

// Generates a new adaptive quiz based on the user's topic mastery and FSRS review schedule.
// Questions are selected from up to 4 priority topics, ranked by urgency, uncertainty,
// mastery gap and exam weight. Falls back through 3 tiers if the primary pool is empty.
router.post("/adaptive", async (req, res) => {
  console.log("Adaptive quiz generation requested");
  const client = await pool.connect();

  try {
    const { userid, question_count = 8 } = req.body;
    console.log("Generating adaptive quiz for user:", userid);

    await client.query("BEGIN");

    const quizResult = await client.query(`
      INSERT INTO quizzes (userid, quiz_type, quiz_mode, custom_question_count)
      VALUES ($1, 'adaptive', 'optimal_difficulty', $2)
      RETURNING quizid
    `, [userid, question_count]);

    const quizId = quizResult.rows[0].quizid;

    // Log per-topic priority scores before question selection for debugging
    const debugTopics = await client.query(`
      SELECT
        t.topic_code,
        t.topic_name,
        utm.elo_rating AS user_elo,
        utm.glicko_rd,
        COALESCE(utm.mastery_gap, 0) AS mastery_gap,
        utm.fsrs_stability,
        utm.fsrs_state,
        utm.next_review_date,
        EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400 AS days_overdue,
        CASE
          WHEN utm.next_review_date IS NULL THEN 0.5
          ELSE GREATEST(0.0, LEAST(1.0,
            (1.0 - POWER(
              1.0 + GREATEST(0.01,
                EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400
                + GREATEST(utm.fsrs_stability, 0.1) * 2.11
              ) / (9.0 * GREATEST(utm.fsrs_stability, 0.1)),
              -1.0
            )) * CASE utm.fsrs_state
                   WHEN 'relearning' THEN 1.5
                   WHEN 'learning'   THEN 1.2
                   ELSE 1.0
                 END
          ))
        END AS urgency,
        ROUND(SQRT(utm.glicko_rd / 350.0)::numeric, 4) AS uncertainty,
        ROUND(GREATEST(0.5, 1.0 + (COALESCE(utm.mastery_gap, 0) / -200.0))::numeric, 4) AS mastery_need,
        t.exam_weight AS utility,
        ROUND((
          CASE
            WHEN utm.next_review_date IS NULL THEN 0.5
            ELSE GREATEST(0.0, LEAST(1.0,
              (1.0 - POWER(
                1.0 + GREATEST(0.01,
                  EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400
                  + GREATEST(utm.fsrs_stability, 0.1) * 2.11
                ) / (9.0 * GREATEST(utm.fsrs_stability, 0.1)),
                -1.0
              )) * CASE utm.fsrs_state
                     WHEN 'relearning' THEN 1.5
                     WHEN 'learning'   THEN 1.2
                     ELSE 1.0
                   END
            ))
          END
          * SQRT(utm.glicko_rd / 350.0)
          * GREATEST(0.5, 1.0 + (COALESCE(utm.mastery_gap, 0) / -200.0))
          * COALESCE(t.exam_weight, 1.0)
        )::numeric, 5) AS priority_score
      FROM user_topic_mastery utm
      JOIN topics t ON utm.topicid = t.topicid
      WHERE utm.userid = $1::int
      ORDER BY priority_score DESC
    `, [userid]);

    console.log('\nPRIORITY TOPICS (all)');
    console.log(
      'topic'.padEnd(8), 'state'.padEnd(11), 'user_elo'.padEnd(9),
      'days_over'.padEnd(10), 'stability'.padEnd(10), 'urgency'.padEnd(8),
      'uncert'.padEnd(8), 'mast_need'.padEnd(10), 'utility'.padEnd(8), 'PRIORITY'
    );
    console.log('-'.repeat(100));
    for (const r of debugTopics.rows) {
      const overdue = r.days_overdue != null ? parseFloat(r.days_overdue).toFixed(2) : 'N/A';
      const included = debugTopics.rows.indexOf(r) < 4 ? ' Pool1' : '';
      console.log(
        r.topic_code.padEnd(8),
        r.fsrs_state.padEnd(11),
        String(parseFloat(r.user_elo).toFixed(0)).padEnd(9),
        String(overdue).padEnd(10),
        String(parseFloat(r.fsrs_stability).toFixed(4)).padEnd(10),
        String(parseFloat(r.urgency).toFixed(4)).padEnd(8),
        String(parseFloat(r.uncertainty).toFixed(4)).padEnd(8),
        String(parseFloat(r.mastery_need).toFixed(4)).padEnd(10),
        String(parseFloat(r.utility).toFixed(2)).padEnd(8),
        String(parseFloat(r.priority_score).toFixed(5)) + included
      );
    }
    console.log('-'.repeat(100) + '\n');

    const questions = await client.query(`
      WITH priority_topics AS (
        SELECT
          utm.topicid,
          t.topic_code,
          t.topic_name,
          utm.elo_rating AS user_elo,
          -- FSRS-4.5 urgency: 1 - R(t_actual), clamped to [0, 1].
          -- t_actual = days_since_last_review ~ days_overdue + S x 2.11.
          -- GREATEST(0.01, t) prevents negative urgency for recently-reviewed topics.
          -- State multipliers boost relearning (+50%) and learning (+20%) topics.
          CASE
            WHEN utm.next_review_date IS NULL THEN 0.5
            ELSE GREATEST(0.0, LEAST(1.0,
              (1.0 - POWER(
                1.0 + GREATEST(0.01,
                  EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400
                  + GREATEST(utm.fsrs_stability, 0.1) * 2.11
                ) / (9.0 * GREATEST(utm.fsrs_stability, 0.1)),
                -1.0
              )) * CASE utm.fsrs_state
                     WHEN 'relearning' THEN 1.5
                     WHEN 'learning'   THEN 1.2
                     ELSE 1.0
                   END
            ))
          END AS urgency,
          SQRT(utm.glicko_rd / 350.0) AS uncertainty,
          GREATEST(0.5, 1.0 + (COALESCE(utm.mastery_gap, 0) / -200.0)) AS mastery_need,
          COALESCE(t.exam_weight, 1.0) AS utility,
          (
            CASE
              WHEN utm.next_review_date IS NULL THEN 0.5
              ELSE GREATEST(0.0, LEAST(1.0,
                (1.0 - POWER(
                  1.0 + GREATEST(0.01,
                    EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400
                    + GREATEST(utm.fsrs_stability, 0.1) * 2.11
                  ) / (9.0 * GREATEST(utm.fsrs_stability, 0.1)),
                  -1.0
                )) * CASE utm.fsrs_state
                       WHEN 'relearning' THEN 1.5
                       WHEN 'learning'   THEN 1.2
                       ELSE 1.0
                     END
              ))
            END
          ) *
          SQRT(utm.glicko_rd / 350.0) *
          GREATEST(0.5, 1.0 + (COALESCE(utm.mastery_gap, 0) / -200.0)) *
          COALESCE(t.exam_weight, 1.0) AS priority_score
        FROM user_topic_mastery utm
        JOIN topics t ON utm.topicid = t.topicid
        WHERE utm.userid = $1
        ORDER BY priority_score DESC
        -- No LIMIT: all studied topics must be eligible so ranked_topics can correctly
        -- identify which topics have questions available
      ),
      suitable_questions AS (
        SELECT
          q.questionid, q.question_text, q.image_url, q.question_format,
          q.correct_answer, q.answer_options, q.explanation, q.total_marks,
          q.parent_question_id, q.part_label, q.order_index,
          pt.topic_code, pt.topic_name, pt.priority_score,
          pt.urgency, pt.uncertainty, pt.mastery_need, pt.utility,
          1.0 / (1.0 + POWER(10, (q.elo_rating - pt.user_elo) / 400.0)) AS expected_success,
          ABS(1.0 / (1.0 + POWER(10, (q.elo_rating - pt.user_elo) / 400.0)) - 0.70) AS difficulty_distance
        FROM priority_topics pt
        JOIN question_topics qt ON pt.topic_code = qt.topic_code
        JOIN questions q ON qt.questionid = q.questionid
        WHERE
          -- Soft ES cap to handle thin question banks
          1.0 / (1.0 + POWER(10, (q.elo_rating - pt.user_elo) / 400.0))
            BETWEEN 0.65 AND 0.75
          AND q.questionid NOT IN (
            SELECT questionid FROM question_attempts
            WHERE userid = $1 AND attempted_at > NOW() - INTERVAL '24 hours'
          )
          -- AND q.is_anchor = FALSE
          AND q.parent_question_id IS NULL
      ),
      -- Top-4 topics get up to 2 questions each (8 total)
      -- If the bank is thin, overflow fills remaining slots from topics ranked 5+
      ranked_topics AS (
        SELECT topic_code,
          ROW_NUMBER() OVER (ORDER BY MAX(priority_score) DESC) AS topic_rank
        FROM suitable_questions
        GROUP BY topic_code
      ),
      primary_pool AS (
        SELECT sq.*,
          ROW_NUMBER() OVER (
            PARTITION BY sq.topic_code ORDER BY sq.difficulty_distance ASC
          ) AS q_rank
        FROM suitable_questions sq
        JOIN ranked_topics rt ON sq.topic_code = rt.topic_code
        WHERE rt.topic_rank <= 4
      ),
      primary_selected AS (
        SELECT * FROM primary_pool WHERE q_rank <= 2
      ),
      overflow_pool AS (
        SELECT sq.*,
          ROW_NUMBER() OVER (
            PARTITION BY sq.topic_code ORDER BY sq.difficulty_distance ASC
          ) AS q_rank
        FROM suitable_questions sq
        JOIN ranked_topics rt ON sq.topic_code = rt.topic_code
        WHERE rt.topic_rank > 4
          AND sq.questionid NOT IN (SELECT questionid FROM primary_selected)
      ),
      overflow_selected AS (
        SELECT * FROM overflow_pool WHERE q_rank <= 2
      ),
      combined AS (
        SELECT *, 1 AS pool_tier FROM primary_selected
        UNION ALL
        SELECT *, 2 AS pool_tier FROM overflow_selected
      ),
      already_selected AS (
        SELECT questionid FROM combined
      ),
      -- Gap-filler A: topics with no quiz attempts yet, ordered by difficulty fit.
      -- Uses onboarded ELO as baseline if available.
      unassessed_fill AS (
        SELECT
          q.questionid, q.question_text, q.image_url, q.question_format,
          q.correct_answer, q.answer_options, q.explanation, q.total_marks,
          q.parent_question_id, q.part_label, q.order_index,
          t.topic_code, t.topic_name,
          0.0 AS priority_score,
          0.5 AS urgency,
          0.5 AS uncertainty,
          1.0 AS mastery_need,
          COALESCE(t.exam_weight, 1.0) AS utility,
          1.0 / (1.0 + POWER(10, (q.elo_rating - COALESCE(utm_elo.elo_rating, 1500.0)) / 400.0)) AS expected_success,
          ABS(1.0 / (1.0 + POWER(10, (q.elo_rating - COALESCE(utm_elo.elo_rating, 1500.0)) / 400.0)) - 0.70) AS difficulty_distance,
          1 AS q_rank,
          3 AS pool_tier
        FROM questions q
        JOIN question_topics qt ON q.questionid = qt.questionid
        JOIN topics t ON qt.topic_code = t.topic_code
        LEFT JOIN (
          SELECT utm.elo_rating, top.topic_code
          FROM user_topic_mastery utm
          JOIN topics top ON utm.topicid = top.topicid
          WHERE utm.userid = $1
        ) utm_elo ON utm_elo.topic_code = t.topic_code
        WHERE q.is_anchor = FALSE
          AND q.parent_question_id IS NULL
          AND q.questionid NOT IN (SELECT questionid FROM already_selected)
          AND NOT EXISTS (
            SELECT 1 FROM question_attempts qa
            JOIN question_topics qt2 ON qa.questionid = qt2.questionid
            WHERE qa.userid = $1
              AND qt2.topic_code = t.topic_code
          )
        ORDER BY difficulty_distance ASC
      ),
      -- Gap-filler B: any remaining questions ignoring the 24h cooldown.
      -- Searches all topics and orders by real priority score so the most
      -- valuable cooldown breaks are applied first.
      assessed_fill AS (
        SELECT
          q.questionid, q.question_text, q.image_url, q.question_format,
          q.correct_answer, q.answer_options, q.explanation, q.total_marks,
          q.parent_question_id, q.part_label, q.order_index,
          t.topic_code, t.topic_name,
          COALESCE(utm_fill.priority_score, 0.0) AS priority_score,
          0.5 AS urgency,
          SQRT(COALESCE(utm_fill.glicko_rd, 350.0) / 350.0) AS uncertainty,
          GREATEST(0.5, 1.0 + (COALESCE(utm_fill.mastery_gap, 0) / -200.0)) AS mastery_need,
          COALESCE(t.exam_weight, 1.0) AS utility,
          1.0 / (1.0 + POWER(10, (q.elo_rating - COALESCE(utm_fill.elo_rating, 1500.0)) / 400.0)) AS expected_success,
          ABS(1.0 / (1.0 + POWER(10, (q.elo_rating - COALESCE(utm_fill.elo_rating, 1500.0)) / 400.0)) - 0.70) AS difficulty_distance,
          1 AS q_rank,
          4 AS pool_tier
        FROM questions q
        JOIN question_topics qt ON q.questionid = qt.questionid
        JOIN topics t ON qt.topic_code = t.topic_code
        LEFT JOIN (
          SELECT
            utm.elo_rating, utm.glicko_rd, COALESCE(utm.mastery_gap, 0) AS mastery_gap,
            top.topic_code,
            (
              CASE
                WHEN utm.next_review_date IS NULL THEN 0.5
                ELSE GREATEST(0.0, LEAST(1.0,
                  (1.0 - POWER(
                    1.0 + GREATEST(0.01,
                      EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400
                      + GREATEST(utm.fsrs_stability, 0.1) * 2.11
                    ) / (9.0 * GREATEST(utm.fsrs_stability, 0.1)),
                    -1.0
                  )) * CASE utm.fsrs_state
                         WHEN 'relearning' THEN 1.5
                         WHEN 'learning'   THEN 1.2
                         ELSE 1.0
                       END
                ))
              END
            ) * SQRT(utm.glicko_rd / 350.0)
              * GREATEST(0.5, 1.0 + (COALESCE(utm.mastery_gap, 0) / -200.0))
              * COALESCE(t2.exam_weight, 1.0) AS priority_score
          FROM user_topic_mastery utm
          JOIN topics top ON utm.topicid = top.topicid
          JOIN topics t2  ON t2.topic_code = top.topic_code
          WHERE utm.userid = $1
        ) utm_fill ON utm_fill.topic_code = t.topic_code
        WHERE q.is_anchor = FALSE
          AND q.parent_question_id IS NULL
          AND q.questionid NOT IN (SELECT questionid FROM already_selected)
          AND q.questionid NOT IN (SELECT questionid FROM unassessed_fill)
          -- 4h soft cooldown: prevents back-to-back repeats while still bypassing the full 24h ban
          AND q.questionid NOT IN (
            SELECT questionid FROM question_attempts
            WHERE userid = $1 AND attempted_at > NOW() - INTERVAL '4 hours'
          )
      )
      SELECT questionid, question_text, image_url, question_format,
        correct_answer, answer_options, explanation, total_marks,
        parent_question_id, part_label, order_index,
        topic_code, topic_name,
        ROUND(expected_success::numeric, 2) AS expected_success,
        ROUND(urgency::numeric, 3) AS urgency,
        ROUND(uncertainty::numeric, 3) AS uncertainty,
        ROUND(mastery_need::numeric, 3) AS mastery_need,
        ROUND(utility::numeric, 2) AS utility,
        ROUND(priority_score::numeric, 4) AS priority_score,
        pool_tier
      FROM (
        SELECT * FROM combined
        UNION ALL
        SELECT * FROM unassessed_fill
        UNION ALL
        SELECT * FROM assessed_fill
      ) all_candidates
      -- Small random jitter breaks ties when many topics share identical priority scores
      ORDER BY pool_tier ASC, (priority_score + (RANDOM() * 0.01 - 0.005)) DESC, difficulty_distance ASC
      LIMIT $2
    `, [userid, question_count]);

    if (questions.rows.length === 0) {
      console.log("No suitable questions found, using intelligent fallback");

      // Tier 2: topic-aware fallback with 4h cooldown.
      // Kicks in when the primary pool is empty, usually because the question bank
      // is small and most questions were answered within the last 24 hours.
      const fallbackQuestions = await client.query(`
        WITH user_topics AS (
          SELECT
            t.topic_code, utm.elo_rating, utm.fsrs_stability,
            COALESCE(utm.mastery_gap, 0) AS mastery_gap,
            CASE
              WHEN utm.mastery_gap < -50 THEN 3
              WHEN utm.mastery_gap < 0 THEN 2
              ELSE 1
            END AS topic_priority
          FROM user_topic_mastery utm
          JOIN topics t ON utm.topicid = t.topicid
          WHERE utm.userid = $1 AND utm.fsrs_state != 'new'
          ORDER BY topic_priority DESC, RANDOM()
          LIMIT 5
        ),
        available_questions AS (
          SELECT DISTINCT
            q.questionid, q.question_text, q.image_url, q.question_format,
            q.correct_answer, q.answer_options, q.explanation, q.total_marks,
            q.parent_question_id, q.part_label, q.order_index,
            ut.topic_code, ut.topic_priority,
            1.0 / (1.0 + POWER(10, (q.elo_rating - ut.elo_rating) / 400.0)) AS expected_success
          FROM questions q
          JOIN question_topics qt ON q.questionid = qt.questionid
          JOIN user_topics ut ON qt.topic_code = ut.topic_code
          WHERE q.is_anchor = FALSE
            AND q.parent_question_id IS NULL
            AND q.questionid NOT IN (
              SELECT questionid FROM question_attempts
              WHERE userid = $1 AND attempted_at > NOW() - INTERVAL '4 hours'
            )
            AND 1.0 / (1.0 + POWER(10, (q.elo_rating - ut.elo_rating) / 400.0)) BETWEEN 0.30 AND 0.90
        )
        SELECT questionid, question_text, image_url, question_format,
          correct_answer, answer_options, explanation, total_marks,
          parent_question_id, part_label, order_index, topic_code,
          ROUND(expected_success::numeric, 2) AS expected_success
        FROM (
          SELECT DISTINCT ON (questionid) *,
            ROW_NUMBER() OVER (
              PARTITION BY topic_code
              ORDER BY ABS(expected_success - 0.60) ASC
            ) AS topic_rank
          FROM (
            SELECT * FROM available_questions
            ORDER BY topic_priority DESC, ABS(expected_success - 0.60) ASC
          ) ranked
          ORDER BY questionid
        ) deduped
        WHERE topic_rank <= 2
        ORDER BY topic_priority DESC, ABS(expected_success - 0.60) ASC
        LIMIT $2
      `, [userid, question_count]);

      if (fallbackQuestions.rows.length > 0) {
        console.log('\n  TIER-2: ' + fallbackQuestions.rows.length + ' questions found (4h cooldown)');
        console.log('  qid  topic     format          ES     topic_priority  question_preview');
        console.log('  ' + '-'.repeat(90));
        for (const q of fallbackQuestions.rows) {
          console.log(
            ' ', String(q.questionid).padEnd(5),
            q.topic_code.padEnd(10),
            q.question_format.padEnd(16),
            String(parseFloat(q.expected_success).toFixed(3)).padEnd(7),
            String(q.topic_priority || '').padEnd(16),
            q.question_text.replace(/[$\\]/g, '').replace(/\s+/g, ' ').substring(0, 35)
          );
        }
        console.log('\n');
      } else {
        console.log('  TIER-2: 0 questions found, falling to tier-3 (no cooldown)\n');
      }

      if (fallbackQuestions.rows.length === 0) {
        // Tier 3: last resort - no cooldown at all, pure random selection
        console.log("All questions recently answered, using cooldown-free fallback");
        const randomQuestions = await client.query(`
          SELECT
            q.questionid, q.question_text, q.image_url, q.question_format,
            q.correct_answer, q.answer_options, q.explanation, q.total_marks,
            q.parent_question_id, q.part_label, q.order_index
          FROM questions q
          WHERE q.is_anchor = FALSE
            AND q.parent_question_id IS NULL
          ORDER BY RANDOM()
          LIMIT $1
        `, [question_count]);
        console.log('  TIER-3: ' + randomQuestions.rows.length + ' questions found (no cooldown, random)\n');
        questions.rows = randomQuestions.rows;
      } else {
        questions.rows = fallbackQuestions.rows;
      }
    }

    // A question mapped to multiple topics can appear more than once in the SQL results.
    // Keep only the first occurrence which is the highest-priority instance due to ORDER BY.
    const seenIds = new Set();
    questions.rows = questions.rows.filter(q => {
      if (seenIds.has(q.questionid)) return false;
      seenIds.add(q.questionid);
      return true;
    });

    if (questions.rows.length > 0) {
      const byTier = { 1: [], 2: [], 3: [], 4: [] };
      for (const q of questions.rows) byTier[q.pool_tier ?? 1].push(q);
      const tierLabels = {
        1: 'PRIMARY (top-4 topics)',
        2: 'OVERFLOW (topics 5+)',
        3: 'NEVER ATTEMPTED (no cooldown)',
        4: 'COOLDOWN BYPASS (all topics)'
      };
      console.log('\nSELECTED QUESTIONS');
      console.log('  qid  topic     format          ES     urgency  priority   pool               question_preview');
      console.log('  ' + '-'.repeat(115));
      for (const q of questions.rows) {
        const tier = q.pool_tier ?? 1;
        console.log(
          ' ', String(q.questionid).padEnd(5),
          q.topic_code.padEnd(10),
          q.question_format.padEnd(16),
          String(parseFloat(q.expected_success).toFixed(3)).padEnd(7),
          String(parseFloat(q.urgency).toFixed(3)).padEnd(9),
          String(parseFloat(q.priority_score).toFixed(4)).padEnd(11),
          (tierLabels[tier] || '').substring(0, 18).padEnd(19),
          q.question_text.replace(/[$\\]/g, '').replace(/\s+/g, ' ').substring(0, 35)
        );
      }
      for (const [tier, qs] of Object.entries(byTier)) {
        if (qs.length > 0) console.log(`  Pool ${tier} (${tierLabels[tier]}): ${qs.length} question(s)`);
      }
      console.log('\n');
    } else {
      console.log('\n  0 questions found - all pools exhausted');
    }

    console.log(`Selected ${questions.rows.length} questions (after deduplication)`);
    await insertQuestionsIntoQuiz(client, quizId, questions.rows);
    await client.query("COMMIT");

    const grouped = await fetchGroupedQuestionsForQuiz(quizId);
    console.log("Adaptive quiz ready with", grouped.length, "question groups");

    res.status(200).json({
      questions: grouped.length > 0 ? grouped : null,
      quizid: quizId,
      message: "Adaptive quiz generated successfully"
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error generating adaptive quiz:", error);
    res.status(500).json({ error: "Failed to generate adaptive quiz" });
  } finally {
    client.release();
  }
});

// Generates a custom quiz filtered by the user's chosen topics and optional difficulty range
router.post("/custom", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      userid, quiz_type, quiz_mode, topics,
      using_custom_difficulty, custom_difficulty_min,
      custom_difficulty_max, custom_question_count
    } = req.body;

    await client.query("BEGIN");

    const quizResult = await client.query(`
      INSERT INTO quizzes (userid, quiz_type, quiz_mode, using_custom_difficulty, custom_difficulty_min, custom_difficulty_max, custom_question_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING quizid
    `, [userid, quiz_type, quiz_mode, using_custom_difficulty, custom_difficulty_min, custom_difficulty_max, custom_question_count]);

    const quizId = quizResult.rows[0].quizid;

    let query = ``;
    let queryParams = [];

    if (quiz_type === "custom") {
      const topic_codes = await client.query(`
        SELECT topic_code FROM topics WHERE topicid = ANY($1)
      `, [topics]);

      if (using_custom_difficulty) {
        // Filter by expected success rate derived from user ELO vs question ELO
        query = `
          WITH user_abilities AS (
            SELECT
              t.topic_code,
              COALESCE(utm.elo_rating, 1500) AS user_elo
            FROM unnest($1::varchar[]) AS t(topic_code)
            LEFT JOIN user_topic_mastery utm ON EXISTS (
              SELECT 1 FROM topics tc WHERE tc.topic_code = t.topic_code
            ) AND utm.userid = $3
          )
          SELECT q.questionid, q.question_text, q.image_url, q.question_format,
                 q.correct_answer, q.answer_options, q.explanation, q.total_marks,
                 q.parent_question_id, q.part_label, q.order_index
          FROM questions q
          WHERE q.questionid IN (
            SELECT DISTINCT qt.questionid
            FROM question_topics qt
            JOIN user_abilities ua ON qt.topic_code = ua.topic_code
            WHERE qt.topic_code = ANY($1)
              AND 1.0 / (1.0 + POWER(10, (q.elo_rating - ua.user_elo) / 400.0)) BETWEEN 0.40 AND 0.90
          )
          AND q.is_anchor = FALSE
          AND q.parent_question_id IS NULL
          ORDER BY RANDOM()
          LIMIT $2
        `;
        queryParams = [topic_codes.rows.map(r => r.topic_code), custom_question_count, userid];
      } else {
        query = `
          SELECT q.questionid, q.question_text, q.image_url, q.question_format,
                 q.correct_answer, q.answer_options, q.explanation, q.total_marks,
                 q.parent_question_id, q.part_label, q.order_index
          FROM questions q
          WHERE q.questionid IN (
            SELECT DISTINCT qt.questionid
            FROM question_topics qt
            WHERE qt.topic_code = ANY($1)
          )
          AND q.is_anchor = FALSE
          AND q.parent_question_id IS NULL
          ORDER BY RANDOM()
          LIMIT $2
        `;
        queryParams = [topic_codes.rows.map(r => r.topic_code), custom_question_count];
      }
    }

    const questions = await client.query(query, queryParams);

    // Deduplicate - a question covering multiple selected topics can appear once per topic
    const seen = new Set();
    questions.rows = questions.rows.filter(q => {
      if (seen.has(q.questionid)) return false;
      seen.add(q.questionid);
      return true;
    });

    await insertQuestionsIntoQuiz(client, quizId, questions.rows);
    await client.query("COMMIT");

    const grouped = await fetchGroupedQuestionsForQuiz(quizId);
    console.log("Custom quiz ready with", grouped.length, "question groups");

    return res.status(200).json({ questions: grouped.length > 0 ? grouped : null, quizid: quizId });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error fetching questions:", error);
    res.status(500).json({ error: "Failed to fetch questions" });
  } finally {
    client.release();
  }
});

// Checks whether all sibling parts of a multi-part question are complete.
// Called after every child part submission and logs when a stem is fully done.
async function markParentCompleteIfAllPartsDone(quizid, answeredQuestionId) {
  const parentResult = await pool.query(`
    SELECT parent_question_id FROM questions WHERE questionid = $1
  `, [answeredQuestionId]);

  const parentId = parentResult.rows[0]?.parent_question_id;
  if (!parentId) return;

  const siblingsResult = await pool.query(`
    SELECT questionid FROM questions WHERE parent_question_id = $1
  `, [parentId]);

  const siblingIds = siblingsResult.rows.map(r => r.questionid);
  if (siblingIds.length === 0) return;

  const incompleteResult = await pool.query(`
    SELECT COUNT(*) AS incomplete_count
    FROM quiz_questions
    WHERE quizid = $1
      AND questionid = ANY($2)
      AND is_complete = FALSE
  `, [quizid, siblingIds]);

  const incompleteCount = parseInt(incompleteResult.rows[0].incomplete_count);

  if (incompleteCount === 0) {
    // Stems are not stored in quiz_questions so there is nothing to update
    // all child parts being complete is sufficient
    console.log("All parts complete for parent", parentId, "in quiz", quizid);
  }
}

// Returns the mark scheme items for a self_mark question
router.get("/mark-scheme/:questionId", async (req, res) => {
  const { questionId } = req.params;
  try {
    const markScheme = await pool.query(`
      SELECT * FROM mark_scheme_items
      WHERE questionid = $1
      ORDER BY item_order ASC
    `, [questionId]);
    res.status(200).json({ markScheme: markScheme.rows });
  } catch (error) {
    console.error("Error fetching mark scheme:", error);
    res.status(500).json({ error: "Failed to fetch mark scheme" });
  }
});

// Submits and grades an answer for multiple_choice and self_mark questions.
// multiple_choice is auto-graded; self_mark trusts the client's mark scheme score.
// Feynman questions must use POST /answer/feynman instead.
router.post("/answer", async (req, res) => {
  try {
    const {
      userid, questionid, quizid,
      user_answer,
      marks_awarded: client_marks,
      confidence, time_taken
    } = req.body;

    if (confidence === null || confidence === undefined || confidence < 1 || confidence > 5) {
      return res.status(400).json({ error: "Confidence rating must be between 1 and 5" });
    }

    const questionResult = await pool.query(`
      SELECT question_format, correct_answer, total_marks
      FROM questions WHERE questionid = $1
    `, [questionid]);

    if (questionResult.rows.length === 0) {
      return res.status(404).json({ error: "Question not found" });
    }

    const question = questionResult.rows[0];

    if (question.question_format === "feynman") {
      return res.status(400).json({
        error: "Feynman questions must be submitted via POST /answer/feynman"
      });
    }

    let marks_awarded = 0;
    let is_correct = false;

    if (question.question_format === "multiple_choice") {
      is_correct = user_answer === question.correct_answer;
      marks_awarded = is_correct ? question.total_marks : 0;
    } else {
      // self_mark: accept the client's self-assessed score from the interactive mark scheme
      marks_awarded = client_marks ?? 0;
      is_correct = marks_awarded === question.total_marks;
    }

    const result = await pool.query(`
      INSERT INTO question_attempts (
        userid, questionid, quizid, marks_awarded, marks_available,
        is_correct, confidence, time_taken, user_answer, grading_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'graded')
      RETURNING *
    `, [userid, questionid, quizid, marks_awarded, question.total_marks,
        is_correct, confidence, time_taken || 0, user_answer ?? '']);

    await pool.query(`
      UPDATE quiz_questions SET is_complete = TRUE
      WHERE quizid = $1 AND questionid = $2
    `, [quizid, questionid]);

    await markParentCompleteIfAllPartsDone(quizid, questionid);

    res.status(200).json({
      message: "Answer submitted successfully",
      marks_awarded,
      marks_available: question.total_marks,
      is_correct,
      correct_answer: question.correct_answer,
      answer: result.rows[0],
      fsrs_rating: result.rows[0].fsrs_rating,
      fsrs_interval_days: result.rows[0].fsrs_interval_days,
      user_elo_after: result.rows[0].user_elo_after,
      expected_success: result.rows[0].expected_success_probability
    });
  } catch (error) {
    console.error("Error submitting answer:", error);
    res.status(500).json({ error: "Failed to submit answer" });
  }
});

// Submits a Feynman answer and grades it synchronously via GPT-4o-mini.
// Grading is calibrated by the user's topic ELO and up to 6 historical exemplar answers.
router.post("/answer/feynman", async (req, res) => {
  try {
    const { userid, questionid, quizid, user_answer, confidence, time_taken } = req.body;

    if (!user_answer || user_answer.trim().length === 0) {
      return res.status(400).json({ error: "Answer cannot be empty" });
    }

    if (confidence === null || confidence === undefined || confidence < 1 || confidence > 5) {
      return res.status(400).json({ error: "Confidence rating must be between 1 and 5" });
    }

    const questionResult = await pool.query(`
      SELECT question_format, explanation, total_marks
      FROM questions WHERE questionid = $1
    `, [questionid]);

    if (questionResult.rows.length === 0) {
      return res.status(404).json({ error: "Question not found" });
    }

    const question = questionResult.rows[0];

    if (question.question_format !== "feynman") {
      return res.status(400).json({
        error: "This endpoint is only for feynman questions. Use POST /answer for self_mark and multiple_choice."
      });
    }

    // Average topic ELO across all topics this question covers
    const eloResult = await pool.query(`
      SELECT ROUND(AVG(utm.elo_rating))::INTEGER AS topic_elo
      FROM user_topic_mastery utm
      JOIN question_topics qt ON utm.topicid = (
        SELECT t.topicid FROM topics t WHERE t.topic_code = qt.topic_code LIMIT 1
      )
      WHERE qt.questionid = $1 AND utm.userid = $2 AND utm.elo_rating IS NOT NULL
    `, [questionid, userid]);
    const userTopicElo = eloResult.rows[0]?.topic_elo ?? 1500;

    // Fetch up to 6 previously graded answers spread across score bands for calibration
    const exemplarResult = await pool.query(`
      SELECT qa.marks_awarded, qa.marks_available, qa.user_answer
      FROM question_attempts qa
      WHERE qa.questionid = $1
        AND qa.grading_status = 'graded'
        AND qa.user_answer IS NOT NULL
        AND qa.user_answer != ''
        AND qa.marks_available > 0
      ORDER BY qa.marks_awarded DESC, RANDOM()
      LIMIT 6
    `, [questionid]);
    const exemplars = exemplarResult.rows;

    let marks_awarded = 0;
    let feedback = "Unable to grade - your answer has been saved.";
    let gradingStatus = "failed";

    try {
      // Group exemplars by score so the model sees the full spread clearly
      const exemplarBlock = (() => {
        if (!exemplars.length) return "No previous answers available for this question yet.";
        const byScore = {};
        for (const ex of exemplars) {
          if (!byScore[ex.marks_awarded]) byScore[ex.marks_awarded] = [];
          byScore[ex.marks_awarded].push(ex.user_answer);
        }
        const maxMarks = exemplars[0].marks_available;
        const lines = ["Previous student answers for calibration (do NOT mention these to the student):"];
        for (const score of Object.keys(byScore).map(Number).sort((a, b) => b - a)) {
          const label = score === maxMarks ? `FULL MARKS (${score}/${maxMarks})`
                      : score === 0        ? `ZERO MARKS (0/${maxMarks})`
                      :                      `PARTIAL (${score}/${maxMarks})`;
          lines.push(`\n${label}:`);
          byScore[score].slice(0, 2).forEach((ans, i) => {
            lines.push(`  Example ${i + 1}: "${ans.trim()}"`);
          });
        }
        return lines.join("\n");
      })();

      // Higher ELO students are held to a stricter standard
      const strictnessBand = userTopicElo < 1200 ? "emerging"
                           : userTopicElo < 1500 ? "developing"
                           : userTopicElo < 1700 ? "competent"
                           : userTopicElo < 1900 ? "proficient"
                           : "mastery";

      const strictnessGuide = {
        emerging:   `This student is still developing foundational understanding (topic ELO ${userTopicElo}). Be encouraging and generous. Award marks for any genuine understanding even if the explanation is incomplete or informal. Do not penalise poor notation at this level.`,
        developing: `This student is at a developing level (topic ELO ${userTopicElo}). Reward the core idea even if reasoning is not fully fleshed out. Be generous with partial credit. Minor notation issues are acceptable.`,
        competent:  `This student is competent (topic ELO ${userTopicElo}). Apply the rubric fairly. The key idea must be present and reasonably well-explained. Minor imprecision is acceptable but a missing core component should cost marks.`,
        proficient: `This student is proficient (topic ELO ${userTopicElo}). Hold them to the rubric. Expect clear and accurate mathematical language. Vague or incomplete reasoning must lose marks.`,
        mastery:    `This student is at mastery level (topic ELO ${userTopicElo}). Mark rigorously. Expect precise notation, complete reasoning, and no conceptual gaps. Full marks only if the explanation is thorough, accurate, and well-structured.`,
      }[strictnessBand];

      const gradingPrompt = `You are an experienced A-level maths teacher marking a student's verbal explanation of a concept.

        CORE PRINCIPLE
        This is a CONCEPTUAL UNDERSTANDING exercise, not a formal written exam. Students are explaining ideas in their own words, as they would to a friend or out loud. Plain English is not just acceptable - it is the intended format. Formal notation (e.g. dy/dx, integral, sigma) is never required. A student who writes "times by the derivative of the inside" instead of "multiply by du/dx" has demonstrated the same understanding and must receive the same marks.

        MARK SCHEME
        ${question.explanation}

        TOTAL MARKS: ${question.total_marks}

        CALIBRATION EXEMPLARS
        Study these real previous answers to anchor your judgement. They show what each score looks like for this specific question in plain-English form.
        ${exemplarBlock}

        STUDENT'S ANSWER
        ${user_answer}

        STRICTNESS LEVEL
        ${strictnessGuide}

        MARKING RULES
        1. Mark the IDEA, not the vocabulary. If the student clearly understands the concept, award the mark regardless of how they phrase it.
        2. Informal language ("times by", "plug in", "you get", "sort of like") is completely fine at every level and must never cost marks.
        3. Formal notation is never required. A student who explains a process correctly in plain English gets the same marks as one who uses symbols.
        4. Use the mark scheme to determine WHAT concepts need to be present. Use the exemplars to calibrate HOW complete the answer needs to be for each score.
        5. If this answer covers the same concepts as a full-marks exemplar, even in simpler language, award full marks.
        6. Only deduct marks for genuine conceptual errors: wrong process, incorrect relationship between ideas, or fundamental misunderstanding. Never deduct for style, informality, or missing symbols.
        7. A blank or completely off-topic answer scores 0. Any answer showing real understanding of the concept scores at least 1.
        8. Never reference or reveal the exemplars in your feedback.

        Return ONLY a JSON object with this exact shape:
        {"marks_awarded": <integer 0-${question.total_marks}>, "feedback": "<2-3 sentences: (1) what they understood correctly, (2) the specific conceptual gap if marks were lost, (3) one concrete suggestion for deepening the explanation>"}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: gradingPrompt }],
        temperature: 0.2,
        max_tokens: 300,
        response_format: { type: "json_object" },
      });

      const parsed = JSON.parse(completion.choices[0].message.content);
      marks_awarded = Math.min(Math.max(Math.round(parsed.marks_awarded ?? 0), 0), question.total_marks);
      feedback = parsed.feedback ?? feedback;
      gradingStatus = "graded";
      console.log("Feynman grading complete:", marks_awarded + "/" + question.total_marks + " marks");
    } catch (gradingError) {
      console.error("OpenAI grading error:", gradingError.message);
    }

    const is_correct = marks_awarded === question.total_marks;

    const result = await pool.query(`
      INSERT INTO question_attempts (
        userid, questionid, quizid, marks_awarded, marks_available,
        is_correct, confidence, time_taken, user_answer, grading_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [userid, questionid, quizid, marks_awarded, question.total_marks,
        is_correct, confidence, time_taken || 0, user_answer, gradingStatus]);

    await pool.query(`
      UPDATE quiz_questions SET is_complete = TRUE
      WHERE quizid = $1 AND questionid = $2
    `, [quizid, questionid]);

    await markParentCompleteIfAllPartsDone(quizid, questionid);

    res.status(200).json({
      message: "Feynman answer submitted and graded",
      attempt_id: result.rows[0].attemptid,
      rubric: question.explanation,
      marks_available: question.total_marks,
      marks_awarded,
      feedback,
      is_correct,
      grading_status: gradingStatus,
    });
  } catch (error) {
    console.error("Error submitting feynman answer:", error);
    res.status(500).json({ error: "Failed to submit feynman answer" });
  }
});

// Allows a student to dispute their Feynman mark. Re-runs the full grading prompt
// with the appeal reason appended. One appeal per attempt, enforced by appeal_used.
router.post("/answer/feynman/appeal", async (req, res) => {
  try {
    const { userid, attempt_id, appeal_reason } = req.body;

    if (!appeal_reason || appeal_reason.trim().length === 0) {
      return res.status(400).json({ error: "Appeal reason cannot be empty" });
    }

    const attemptResult = await pool.query(`
      SELECT qa.attemptid, qa.userid, qa.questionid, qa.user_answer,
             qa.marks_awarded, qa.marks_available, qa.appeal_used,
             q.explanation, q.total_marks, q.question_format
      FROM question_attempts qa
      JOIN questions q ON qa.questionid = q.questionid
      WHERE qa.attemptid = $1 AND qa.userid = $2
    `, [attempt_id, userid]);

    if (attemptResult.rows.length === 0) {
      return res.status(404).json({ error: "Attempt not found" });
    }

    const attempt = attemptResult.rows[0];

    if (attempt.question_format !== 'feynman') {
      return res.status(400).json({ error: "Appeals are only available for Feynman questions" });
    }

    if (attempt.appeal_used) {
      return res.status(400).json({ error: "You have already appealed this attempt" });
    }

    const eloResult = await pool.query(`
      SELECT ROUND(AVG(utm.elo_rating))::INTEGER AS topic_elo
      FROM user_topic_mastery utm
      JOIN question_topics qt ON utm.topicid = (
        SELECT t.topicid FROM topics t WHERE t.topic_code = qt.topic_code LIMIT 1
      )
      WHERE qt.questionid = $1 AND utm.userid = $2 AND utm.elo_rating IS NOT NULL
    `, [attempt.questionid, userid]);
    const userTopicElo = eloResult.rows[0]?.topic_elo ?? 1500;

    // Fetch exemplars excluding this attempt to avoid circular calibration
    const exemplarResult = await pool.query(`
      SELECT qa.marks_awarded, qa.marks_available, qa.user_answer
      FROM question_attempts qa
      WHERE qa.questionid = $1
        AND qa.attemptid != $2
        AND qa.grading_status = 'graded'
        AND qa.user_answer IS NOT NULL
        AND qa.user_answer != ''
        AND qa.marks_available > 0
      ORDER BY qa.marks_awarded DESC, RANDOM()
      LIMIT 6
    `, [attempt.questionid, attempt_id]);
    const exemplars = exemplarResult.rows;

    const exemplarBlock = (() => {
      if (!exemplars.length) return "No previous answers available for this question yet.";
      const byScore = {};
      for (const ex of exemplars) {
        if (!byScore[ex.marks_awarded]) byScore[ex.marks_awarded] = [];
        byScore[ex.marks_awarded].push(ex.user_answer);
      }
      const maxMarks = exemplars[0].marks_available;
      const lines = ["Previous student answers for calibration (do NOT mention these to the student):"];
      for (const score of Object.keys(byScore).map(Number).sort((a, b) => b - a)) {
        const label = score === maxMarks ? `FULL MARKS (${score}/${maxMarks})`
                    : score === 0        ? `ZERO MARKS (0/${maxMarks})`
                    :                      `PARTIAL (${score}/${maxMarks})`;
        lines.push(`\n${label}:`);
        byScore[score].slice(0, 2).forEach((ans, i) => {
          lines.push(`  Example ${i + 1}: "${ans.trim()}"`);
        });
      }
      return lines.join("\n");
    })();

    const strictnessBand = userTopicElo < 1200 ? "emerging"
                         : userTopicElo < 1500 ? "developing"
                         : userTopicElo < 1700 ? "competent"
                         : userTopicElo < 1900 ? "proficient"
                         : "mastery";

    const strictnessGuide = {
      emerging:   `This student is still developing foundational understanding (topic ELO ${userTopicElo}). Be encouraging and generous.`,
      developing: `This student is at a developing level (topic ELO ${userTopicElo}). Reward the core idea even if reasoning is not fully fleshed out.`,
      competent:  `This student is competent (topic ELO ${userTopicElo}). Apply the rubric fairly. The key idea must be present and reasonably well-explained.`,
      proficient: `This student is proficient (topic ELO ${userTopicElo}). Hold them to the rubric. Expect clear and accurate mathematical language.`,
      mastery:    `This student is at mastery level (topic ELO ${userTopicElo}). Mark rigorously. Full marks only if the explanation is thorough and accurate.`,
    }[strictnessBand];

    const appealPrompt = `You are an experienced A-level maths teacher re-marking a student's answer after they have raised a dispute.

CORE PRINCIPLE
This is a CONCEPTUAL UNDERSTANDING exercise. Plain English is the intended format. Formal notation is never required. Mark the idea, not the vocabulary.

MARK SCHEME
${attempt.explanation}

TOTAL MARKS: ${attempt.total_marks}

CALIBRATION EXEMPLARS
${exemplarBlock}

STUDENT'S ANSWER
${attempt.user_answer}

ORIGINAL MARK
${attempt.marks_awarded} / ${attempt.marks_available}

STUDENT'S APPEAL
The student believes this mark is incorrect. Their reason: "${appeal_reason.trim()}"

STRICTNESS LEVEL
${strictnessGuide}

RE-MARKING INSTRUCTIONS
1. Read the student's appeal reason carefully and take it seriously.
2. Re-read the answer with fresh eyes in light of their argument.
3. If the appeal reveals that the original mark missed genuine understanding, revise the mark upward.
4. If the original mark was fair, uphold it. Do not inflate marks to appease.
5. You may also revise the mark downward if on reflection the original was too generous, but only if clearly warranted.
6. Never penalise informal language or missing notation. Only penalise genuine conceptual errors.
7. Be honest and direct in your feedback. Explain clearly why the mark was changed or upheld.

Return ONLY a JSON object with this exact shape:
{"marks_awarded": <integer 0-${attempt.total_marks}>, "feedback": "<2-3 sentences explaining the appeal outcome: what was reconsidered, why the mark was changed or upheld, and what would make a stronger answer>"}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: appealPrompt }],
      temperature: 0.2,
      max_tokens: 400,
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    const revised_marks = Math.min(Math.max(Math.round(parsed.marks_awarded ?? attempt.marks_awarded), 0), attempt.total_marks);
    const revised_feedback = parsed.feedback ?? "Appeal reviewed - mark upheld.";

    await pool.query(`
      UPDATE question_attempts
      SET marks_awarded = $1,
          is_correct    = ($1 = marks_available),
          appeal_used   = TRUE
      WHERE attemptid = $2
    `, [revised_marks, attempt_id]);

    console.log(`Appeal: attempt ${attempt_id} revised from ${attempt.marks_awarded} to ${revised_marks}`);

    res.status(200).json({
      marks_awarded: revised_marks,
      marks_available: attempt.marks_available,
      feedback: revised_feedback,
    });
  } catch (error) {
    console.error("Error processing appeal:", error);
    res.status(500).json({ error: "Failed to process appeal" });
  }
});

// Records a silly mistake on a wrong MCQ answer by inserting a corrective attempt
// worth 50% marks. The trigger partially reverses the ELO loss from the original wrong answer.
router.post("/answer/silly-mistake", async (req, res) => {
  try {
    const { userid, questionid, quizid } = req.body;

    if (!userid || !questionid || !quizid) {
      return res.status(400).json({ error: "userid, questionid and quizid are required" });
    }

    const lastAttempt = await pool.query(`
      SELECT confidence, marks_available
      FROM question_attempts
      WHERE userid = $1 AND questionid = $2 AND quizid = $3
      ORDER BY attempted_at DESC
      LIMIT 1
    `, [userid, questionid, quizid]);

    if (lastAttempt.rows.length === 0) {
      return res.status(404).json({ error: "No attempt found for this question" });
    }

    const { confidence, marks_available } = lastAttempt.rows[0];
    const silly_marks = Math.round((marks_available ?? 1) * 0.5);

    await pool.query(`
      INSERT INTO question_attempts (
        userid, questionid, quizid,
        marks_awarded, marks_available,
        is_correct, confidence, time_taken,
        user_answer, grading_status
      ) VALUES ($1, $2, $3, $4, $5, false, $6, 0, 'silly_mistake', 'graded')
    `, [userid, questionid, quizid, silly_marks, marks_available, confidence]);

    res.status(200).json({ message: "Silly mistake recorded", marks_awarded: silly_marks });
  } catch (error) {
    console.error("Error recording silly mistake:", error);
    res.status(500).json({ error: "Failed to record silly mistake" });
  }
});

// Returns all topics with parent info, used by the onboarding wizard to group by chapter
router.get("/topics", async (req, res) => {
  try {
    const topicsResult = await pool.query(`
      SELECT
        t.topicid,
        t.topic_code,
        t.topic_name,
        t.parent_topic,
        parent.topic_name AS parent_topic_name
      FROM topics t
      LEFT JOIN topics parent ON parent.topic_code = t.parent_topic
      ORDER BY t.topic_code ASC
    `);
    res.status(200).json({ topics: topicsResult.rows });
  } catch (error) {
    console.error("Error fetching topics:", error);
    res.status(500).json({ error: "Failed to fetch topics" });
  }
});

// Returns overall and per-topic stats for the user's most recent completed quiz
router.get("/results/:userid", async (req, res) => {
  try {
    const { userid } = req.params;

    const overallStats = await pool.query(`
      SELECT
        qa.quizid,
        SUM(qa.marks_awarded) AS total_marks_awarded,
        SUM(qa.marks_available) AS total_marks_available,
        ROUND((SUM(qa.marks_awarded)::DECIMAL / NULLIF(SUM(qa.marks_available), 0)) * 100, 2) AS percentage,
        COUNT(*) AS questions_answered,
        ROUND(AVG(qa.confidence), 2) AS avg_confidence,
        SUM(qa.time_taken) AS total_time_seconds,
        COUNT(*) FILTER (WHERE q.question_format = 'multiple_choice') AS mcq_count,
        COUNT(*) FILTER (WHERE q.question_format = 'self_mark') AS self_mark_count,
        COUNT(*) FILTER (WHERE q.question_format = 'feynman') AS feynman_count,
        COUNT(*) FILTER (WHERE q.question_format = 'feynman' AND qa.grading_status = 'pending') AS feynman_pending_count
      FROM question_attempts qa
      JOIN questions q ON qa.questionid = q.questionid
      WHERE qa.userid = $1
        AND qa.grading_status != 'pending'
      GROUP BY qa.quizid
      ORDER BY qa.quizid DESC
      LIMIT 1
    `, [userid]);

    const individualTopicStats = await pool.query(`
      SELECT
        t.topic_code, t.topic_name,
        SUM(qa.marks_awarded) AS marks_awarded,
        SUM(qa.marks_available) AS marks_available,
        ROUND((SUM(qa.marks_awarded)::DECIMAL / NULLIF(SUM(qa.marks_available), 0)) * 100, 2) AS percentage,
        COUNT(*) AS questions_answered
      FROM question_attempts qa
      JOIN question_topics qt ON qa.questionid = qt.questionid
      JOIN topics t ON qt.topic_code = t.topic_code
      WHERE qa.userid = $1
        AND qa.quizid = (SELECT quizid FROM quizzes WHERE userid = $1 ORDER BY quizid DESC LIMIT 1)
        AND qa.grading_status != 'pending'
      GROUP BY t.topic_code, t.topic_name
      ORDER BY percentage DESC
    `, [userid]);

    res.status(200).json({
      results: overallStats.rows.length > 0 ? overallStats.rows[0] : null,
      individualTopicStats: individualTopicStats.rows
    });
  } catch (error) {
    console.error("Error fetching quiz results:", error);
    res.status(500).json({ error: "Failed to fetch quiz results" });
  }
});

// Returns the most recent quiz for a user with unanswered questions grouped by parent-child structure
router.get("/:userid", async (req, res) => {
  try {
    const userIdInt = parseInt(req.params.userid);

    const activeQuizResult = await pool.query(
      `SELECT quizid FROM quizzes WHERE userid = $1 ORDER BY created_at DESC LIMIT 1`,
      [userIdInt]
    );

    if (activeQuizResult.rows.length === 0) {
      return res.status(200).json({ questions: null, quizid: null });
    }

    const quizId = activeQuizResult.rows[0].quizid;
    const grouped = await fetchGroupedQuestionsForQuiz(quizId);
    console.log("Returning", grouped.length, "question groups for quiz", quizId);

    return res.status(200).json({
      questions: grouped.length > 0 ? grouped : null,
      quizid: quizId
    });
  } catch (error) {
    console.error("Error fetching unanswered questions:", error);
    res.status(500).json({ error: "Failed to fetch unanswered questions" });
  }
});

// Deletes all incomplete quizzes for a user, used when starting a fresh quiz
router.delete("/incomplete/:userid", async (req, res) => {
  try {
    const { userid } = req.params;

    const incompleteQuizzes = await pool.query(`
      SELECT quizid FROM quizzes WHERE userid = $1 AND completed_at IS NULL
    `, [userid]);

    if (incompleteQuizzes.rows.length === 0) {
      return res.status(200).json({ message: "No incomplete quizzes to delete" });
    }

    await pool.query(`DELETE FROM quizzes WHERE userid = $1 AND completed_at IS NULL`, [userid]);

    res.status(200).json({
      message: "Incomplete quiz deleted successfully",
      quizzesDeleted: incompleteQuizzes.rows.length
    });
  } catch (error) {
    console.error("Error deleting incomplete quiz:", error);
    res.status(500).json({ error: "Failed to delete incomplete quiz" });
  }
});

// Returns due topics, recent performance stats and overall progress for the user's dashboard
router.get("/dashboard/:userid", async (req, res) => {
  try {
    const { userid } = req.params;

    const dueTopics = await pool.query(`
      SELECT * FROM topics_due_for_review WHERE userid = $1
      ORDER BY priority_score DESC LIMIT 5
    `, [userid]);

    const recentStats = await pool.query(`
      SELECT
        COUNT(*) as questions_answered,
        ROUND((SUM(marks_awarded)::DECIMAL / NULLIF(SUM(marks_available), 0)) * 100, 2) as avg_percentage,
        ROUND(AVG(confidence), 2) as avg_confidence,
        SUM(time_taken) as total_study_time
      FROM question_attempts
      WHERE userid = $1
        AND attempted_at > NOW() - INTERVAL '7 days'
        AND grading_status != 'pending'
    `, [userid]);

    const userProgress = await pool.query(`SELECT * FROM user_progress WHERE userid = $1`, [userid]);

    res.status(200).json({
      dueTopics: dueTopics.rows,
      recentStats: recentStats.rows[0],
      userProgress: userProgress.rows[0]
    });
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

export default router;