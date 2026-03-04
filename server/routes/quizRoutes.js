import express from "express";
import pool from "../config/db.js";
import "dotenv/config";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPEN_API_KEY });

const router = express.Router();

// =====================================================================================
//                           HELPER: GROUP PARTS UNDER PARENTS
// =====================================================================================

function groupQuestionParts(rows) {
  const questionsMap = new Map();
  const topLevel = [];

  // First pass: collect all top-level (parent/standalone) rows
  for (const row of rows) {
    if (!row.parent_question_id) {
      row.parts = [];       // incomplete parts still needing answers
      row.doneParts = [];   // already-completed parts to show greyed-out
      questionsMap.set(row.questionid, row);
      topLevel.push(row);
    }
  }

  // Second pass: attach child parts, split by is_complete
  for (const row of rows) {
    if (row.parent_question_id) {
      const parent = questionsMap.get(row.parent_question_id);
      if (parent) {
        if (row.is_complete) {
          parent.doneParts.push(row);  // show greyed-out above active part
        } else {
          parent.parts.push(row);      // still to be answered
        }
      }
    }
  }

  // Sort both arrays by order_index
  for (const q of topLevel) {
    q.parts.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    q.doneParts.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  }

  // Filter out orphan parent stems: has_parts but no incomplete children left.
  // Handles the case where markParentCompleteIfAllPartsDone didn't fire in time.
  return topLevel.filter(q => {
    if (q.has_parts && q.parts.length === 0) {
      console.log(`Skipping orphan parent stem q${q.questionid} — all children complete`);
      return false;
    }
    return true;
  });
}


// =====================================================================================
//                           HELPER: INSERT QUESTIONS + THEIR PARTS INTO QUIZ
// =====================================================================================

async function insertQuestionsIntoQuiz(client, quizId, questions) {
  for (let i = 0; i < questions.length; i++) {
    const questionId = questions[i].questionid;

    // Check whether this question is a stem (has child parts)
    const parts = await client.query(`
      SELECT questionid FROM questions
      WHERE parent_question_id = $1
      ORDER BY order_index ASC
    `, [questionId]);

    if (parts.rows.length === 0) {
      // Standalone question — insert directly
      await client.query(`
        INSERT INTO quiz_questions (quizid, questionid, question_order)
        VALUES ($1, $2, $3)
      `, [quizId, questionId, i + 1]);
    } else {
      // Multi-part stem — insert only the child parts, never the stem itself.
      // The GET route fetches the stem text separately for display.
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

// =====================================================================================
//                           HELPER: FETCH GROUPED QUESTIONS FOR A QUIZ
//
//   Used by both POST (new quiz) and GET (continue quiz) so the frontend always
//   receives the same properly-grouped structure without needing a page reload.
// =====================================================================================

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

  // Stems are not in quiz_questions — fetch them separately and inject as synthetic rows
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

// =====================================================================================
//                           ADAPTIVE QUIZ GENERATION
// =====================================================================================

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

    // ── Debug: log priority_topics scores before question selection ──────────────
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
            WHEN utm.next_review_date > NOW() THEN
              -- Not yet due: small positive urgency that decays with days remaining.
              -- A topic due in 12h scores much higher than one due in 2 weeks.
              -- Formula: 0.1 * exp(-days_remaining / (2 * stability))
              0.1 * EXP(
                -GREATEST(EXTRACT(EPOCH FROM (utm.next_review_date - NOW()))/86400, 0)
                / (2.0 * GREATEST(utm.fsrs_stability, 0.1))
              )
            ELSE LEAST(1.0,
              1.0 - POWER(
                1.0 + EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400
                    / (9.0 * GREATEST(utm.fsrs_stability, 0.1)),
                -1.0
              )
            )
          END AS urgency,
        ROUND(SQRT(utm.glicko_rd / 350.0)::numeric, 4) AS uncertainty,
        ROUND(GREATEST(0.5, 1.0 + (COALESCE(utm.mastery_gap, 0) / -200.0))::numeric, 4) AS mastery_need,
        t.exam_weight AS utility,
        ROUND((
          CASE
            WHEN utm.next_review_date IS NULL THEN 0.5
            WHEN utm.next_review_date > NOW() THEN
              0.1 * EXP(
                -GREATEST(EXTRACT(EPOCH FROM (utm.next_review_date - NOW()))/86400, 0)
                / (2.0 * GREATEST(utm.fsrs_stability, 0.1))
              )
            ELSE LEAST(1.0,
              1.0 - POWER(
                1.0 + EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400
                    / (9.0 * GREATEST(utm.fsrs_stability, 0.1)),
                -1.0
              )
            )
          END
          * SQRT(utm.glicko_rd / 350.0)
          * GREATEST(0.5, 1.0 + (COALESCE(utm.mastery_gap, 0) / -200.0))
          * t.exam_weight
        )::numeric, 5) AS priority_score
      FROM user_topic_mastery utm
      JOIN topics t ON utm.topicid = t.topicid
      WHERE utm.userid = $1::int
      ORDER BY priority_score DESC
    `, [userid]);

    console.log('\n━━━ PRIORITY TOPICS (all) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(
      'topic'.padEnd(8), 'state'.padEnd(11), 'user_elo'.padEnd(9),
      'days_over'.padEnd(10), 'stability'.padEnd(10), 'urgency'.padEnd(8),
      'uncert'.padEnd(8), 'mast_need'.padEnd(10), 'utility'.padEnd(8), 'PRIORITY'
    );
    console.log('─'.repeat(100));
    for (const r of debugTopics.rows) {
      const overdue = r.days_overdue != null ? parseFloat(r.days_overdue).toFixed(2) : 'N/A';
      const included = debugTopics.rows.indexOf(r) < 5 ? ' ◄' : '';
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
    console.log('━'.repeat(100) + '\n');

    const questions = await client.query(`
      WITH priority_topics AS (
        SELECT
          utm.topicid,
          t.topic_code,
          t.topic_name,
          utm.elo_rating AS user_elo,
          -- FSRS-4.5 urgency:
          --   Overdue:     urgency = 1 - R(t),  rises from 0 toward 1 as forgetting increases
          --   Not yet due: urgency = 0.1 * exp(-days_remaining / (2*S))
          --                → due in 12h scores ~10x higher than due in 2 weeks
          --                → prevents all not-yet-due topics collapsing to the same 0 priority
          --   No date yet: 0.5 moderate urgency (new topic, unknown schedule)
          CASE
            WHEN utm.next_review_date IS NULL THEN 0.5
            WHEN utm.next_review_date > NOW() THEN
              0.1 * EXP(
                -GREATEST(EXTRACT(EPOCH FROM (utm.next_review_date - NOW()))/86400, 0)
                / (2.0 * GREATEST(utm.fsrs_stability, 0.1))
              )
            ELSE LEAST(1.0,
              1.0 - POWER(
                1.0 + EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400
                    / (9.0 * GREATEST(utm.fsrs_stability, 0.1)),
                -1.0
              )
            )
          END AS urgency,
          SQRT(utm.glicko_rd / 350.0) AS uncertainty,
          GREATEST(0.5, 1.0 + (COALESCE(utm.mastery_gap, 0) / -200.0)) AS mastery_need,
          t.exam_weight AS utility,
          (
            CASE
              WHEN utm.next_review_date IS NULL THEN 0.5
              WHEN utm.next_review_date > NOW() THEN
                0.1 * EXP(
                  -GREATEST(EXTRACT(EPOCH FROM (utm.next_review_date - NOW()))/86400, 0)
                  / (2.0 * GREATEST(utm.fsrs_stability, 0.1))
                )
              ELSE LEAST(1.0,
                1.0 - POWER(
                  1.0 + EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400
                      / (9.0 * GREATEST(utm.fsrs_stability, 0.1)),
                  -1.0
                )
              )
            END
          ) *
          SQRT(utm.glicko_rd / 350.0) *
          GREATEST(0.5, 1.0 + (COALESCE(utm.mastery_gap, 0) / -200.0)) *
          t.exam_weight AS priority_score
        FROM user_topic_mastery utm
        JOIN topics t ON utm.topicid = t.topicid
        WHERE utm.userid = $1
        ORDER BY priority_score DESC
        LIMIT 20  -- include all topics; urgency formula differentiates due vs not-yet-due
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
          -- BUG 2 FIX: widened from 0.50–0.85 to 0.40–0.90 so thin question banks
          -- (few questions per topic) still yield candidates for high-priority topics
          1.0 / (1.0 + POWER(10, (q.elo_rating - pt.user_elo) / 400.0)) BETWEEN 0.40 AND 0.90
          -- BUG 1 FIX: restored the 7-day interval (was accidentally commented out,
          -- making the filter 'attempted_at > NOW()' which never excludes anything)
          AND q.questionid NOT IN (
            SELECT questionid FROM question_attempts
            WHERE userid = $1 AND attempted_at > NOW() - INTERVAL '24 hours'
          )
          AND q.is_anchor = FALSE
          -- BUG 4 FIX: also exclude parent stems (questions that have children)
          -- parent_question_id IS NULL is not enough — stems have no parent but do have children
          AND q.parent_question_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM questions child WHERE child.parent_question_id = q.questionid
          )
      ),
      -- Rank topics by priority score. Top-4 get up to 2 questions each (8 total).
      -- If top-4 can't fill 8 questions (thin bank), overflow fills from topics ranked 5+.
      -- Within each topic, the 2 questions closest to 70% expected success are chosen.
      ranked_topics AS (
        SELECT topic_code,
          ROW_NUMBER() OVER (ORDER BY MAX(priority_score) DESC) AS topic_rank
        FROM suitable_questions
        GROUP BY topic_code
      ),
      -- Primary pool: top-4 topics, best 2 questions each
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
      -- Overflow pool: topics ranked 5+, fills remaining slots if primary < 8
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
        ROUND(priority_score::numeric, 4) AS priority_score
      FROM combined
      ORDER BY pool_tier ASC, priority_score DESC, difficulty_distance ASC
      LIMIT $2
    `, [userid, question_count]);

    // ── Debug: log tier-1 results ─────────────────────────────────────────────
    if (questions.rows.length > 0) {
      console.log('\n\u2501\u2501\u2501 TIER-1 SELECTED QUESTIONS \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501');
      console.log('  qid  topic     format          ES     urgency  priority   topic_name           question_preview');
      console.log('  ' + '-'.repeat(108));
      for (const q of questions.rows) {
        console.log(
          ' ', String(q.questionid).padEnd(5),
          q.topic_code.padEnd(10),
          q.question_format.padEnd(16),
          String(parseFloat(q.expected_success).toFixed(3)).padEnd(7),
          String(parseFloat(q.urgency).toFixed(3)).padEnd(9),
          String(parseFloat(q.priority_score).toFixed(4)).padEnd(11),
          (q.topic_name || '').substring(0, 20).padEnd(21),
          q.question_text.replace(/[$\\]/g, '').replace(/\s+/g, ' ').substring(0, 35)
        );
      }
      console.log('\n');
    } else {
      console.log('\n  TIER-1: 0 questions found');
      console.log('  Check: 24h cooldown blocking all? ES range 0.40-0.90 too narrow?\n');
    }

    if (questions.rows.length === 0) {
      console.log("No suitable questions found, using intelligent fallback");

      // Tier 2: topic-aware fallback with 1-day cooldown (vs 7-day in primary)
      // This kicks in when primary finds nothing — usually because the question bank
      // is small and most questions were answered within the last 7 days
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
            AND NOT EXISTS (
              SELECT 1 FROM questions child WHERE child.parent_question_id = q.questionid
            )
            -- Tier 2: relaxed to 4-hour cooldown so questions answered earlier today re-enter
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

      // ── Debug: log tier-2 results ───────────────────────────────────────────
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
        // Tier 3: last resort — no cooldown at all, just exclude stems and pick by difficulty fit
        console.log("All questions recently answered, using cooldown-free fallback");
        const randomQuestions = await client.query(`
          SELECT
            q.questionid, q.question_text, q.image_url, q.question_format,
            q.correct_answer, q.answer_options, q.explanation, q.total_marks,
            q.parent_question_id, q.part_label, q.order_index
          FROM questions q
          WHERE q.is_anchor = FALSE
            AND q.parent_question_id IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM questions child WHERE child.parent_question_id = q.questionid
            )
          ORDER BY RANDOM()
          LIMIT $1
        `, [question_count]);
        console.log('  TIER-3: ' + randomQuestions.rows.length + ' questions found (no cooldown, random)\n');
        questions.rows = randomQuestions.rows;
      } else {
        questions.rows = fallbackQuestions.rows;
      }
    }

    console.log(`Selected ${questions.rows.length} questions`);
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

// =====================================================================================
//                           CUSTOM QUIZ GENERATION
// =====================================================================================

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

// =====================================================================================
//                           HELPER: MARK PARENT COMPLETE WHEN ALL PARTS DONE
//
//   When a child part is submitted, check if every sibling part in quiz_questions
//   is now complete. If so, mark the parent question row complete too so it doesn't
//   re-appear as a standalone question on continueQuiz.
// =====================================================================================

async function markParentCompleteIfAllPartsDone(quizid, answeredQuestionId) {
  // Find this question's parent_question_id (null if it's standalone)
  const parentResult = await pool.query(`
    SELECT parent_question_id FROM questions WHERE questionid = $1
  `, [answeredQuestionId]);

  const parentId = parentResult.rows[0]?.parent_question_id;
  if (!parentId) return; // Standalone question, nothing to do

  // Get all sibling part questionids for this parent
  const siblingsResult = await pool.query(`
    SELECT questionid FROM questions WHERE parent_question_id = $1
  `, [parentId]);

  const siblingIds = siblingsResult.rows.map(r => r.questionid);
  if (siblingIds.length === 0) return;

  // Check if all siblings are complete in quiz_questions
  const incompleteResult = await pool.query(`
    SELECT COUNT(*) AS incomplete_count
    FROM quiz_questions
    WHERE quizid = $1
      AND questionid = ANY($2)
      AND is_complete = FALSE
  `, [quizid, siblingIds]);

  const incompleteCount = parseInt(incompleteResult.rows[0].incomplete_count);

  if (incompleteCount === 0) {
    // Parent stems are no longer stored in quiz_questions (only child parts are),
    // so there's nothing to mark complete on the parent. All done.
    console.log("All parts complete for parent", parentId, "in quiz", quizid);
  }
}

// =====================================================================================
//                           MARK SCHEME (self_mark questions only)
// =====================================================================================

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

// =====================================================================================
//                           ANSWER SUBMISSION — self_mark + multiple_choice
//
//   self_mark:       marks_awarded comes from client (student self-assessed via mark scheme)
//   multiple_choice: auto-graded server-side
//   feynman:         use POST /answer/feynman
// =====================================================================================

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
      // self_mark: trust client's self-assessed marks from interactive mark scheme
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

    // If this was a child part, mark the parent complete once all parts are done
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

// =====================================================================================
//                           ANSWER SUBMISSION — FEYNMAN
// =====================================================================================

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

    // ── AI grading (synchronous — no more pending state) ────────────────
    let marks_awarded = 0;
    let feedback = "Unable to grade — your answer has been saved.";
    let gradingStatus = "failed";

    try {
      const gradingPrompt = `You are an A-level maths examiner. Grade the following student explanation.

MARK SCHEME / RUBRIC:
${question.explanation}

TOTAL MARKS AVAILABLE: ${question.total_marks}

STUDENT'S EXPLANATION:
${user_answer}

Award marks strictly based on the rubric. Return ONLY a JSON object with this exact shape:
{"marks_awarded": <integer 0–${question.total_marks}>, "feedback": "<2–3 sentence constructive feedback explaining what was good and what was missing>"}`;

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

    // If this was a child part, mark the parent complete once all parts are done
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

// =====================================================================================
//                           TOPICS
// =====================================================================================

router.get("/topics", async (req, res) => {
  try {
    const topicsResult = await pool.query(`SELECT * FROM topics ORDER BY topicid ASC`);
    res.status(200).json({ topics: topicsResult.rows });
  } catch (error) {
    console.error("Error fetching topics:", error);
    res.status(500).json({ error: "Failed to fetch topics" });
  }
});

// =====================================================================================
//                           QUIZ RESULTS
// =====================================================================================

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

// =====================================================================================
//                           GET UNANSWERED QUESTIONS
// =====================================================================================

router.get("/:userid", async (req, res) => {
  try {
    const userIdInt = parseInt(req.params.userid);

    // Step 1: find the most recent quiz for this user
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

// =====================================================================================
//                           DELETE INCOMPLETE QUIZ
// =====================================================================================

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

// =====================================================================================
//                           DASHBOARD DATA
// =====================================================================================

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