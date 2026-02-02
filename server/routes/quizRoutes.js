import express from "express";
import pool from "../config/db.js";
import "dotenv/config";

const router = express.Router();

// =====================================================================================
//                           ADAPTIVE QUIZ GENERATION (FULLY CORRECTED)
// =====================================================================================

router.post("/adaptive", async (req, res) => {
  console.log("Adaptive quiz generation requested");
  const client = await pool.connect();
  
  try {
    const { userid, question_count = 10 } = req.body;
    
    console.log("Generating adaptive quiz for user:", userid);

    await client.query("BEGIN");

    // Create quiz record
    const quizResult = await client.query(`
      INSERT INTO quizzes (userid, quiz_type, quiz_mode, custom_question_count)
      VALUES ($1, 'adaptive', 'optimal_difficulty', $2)
      RETURNING quizid
    `, [userid, question_count]);

    const quizId = quizResult.rows[0].quizid;

    // Adaptive selection with mastery-aware prioritization
    const questions = await client.query(`
      -- Get priority topics using 4-factor scoring
      WITH priority_topics AS (
        SELECT 
          utm.topicid,
          t.topic_code,
          t.topic_name,
          utm.elo_rating AS user_elo,
          
          -- Component 1: FSRS urgency (memory fading)
          CASE 
            WHEN utm.next_review_date IS NULL THEN 0.5
            WHEN utm.next_review_date > NOW() THEN 0.0
            ELSE 
              LEAST(1.0, POWER(
                EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400 / GREATEST(utm.fsrs_stability, 0.1),
                0.5
              ))
          END AS urgency,
          
          -- Component 2: Glicko uncertainty (calibration need)
          SQRT(utm.glicko_rd / 350.0) AS uncertainty,
          
          -- Component 3: MASTERY need (relative weakness)
          GREATEST(
            0.5,
            1.0 + (COALESCE(utm.mastery_gap, 0) / -200.0)
          ) AS mastery_need,
          
          -- Component 4: Exam utility (importance)
          t.exam_weight AS utility,
          
          -- Combined priority score (multiplicative)
          (
            CASE 
              WHEN utm.next_review_date IS NULL THEN 0.5
              WHEN utm.next_review_date > NOW() THEN 0.0
              ELSE 
                LEAST(1.0, POWER(
                  EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400 / GREATEST(utm.fsrs_stability, 0.1),
                  0.5
                ))
            END
          ) * 
          SQRT(utm.glicko_rd / 350.0) *
          GREATEST(0.5, 1.0 + (COALESCE(utm.mastery_gap, 0) / -200.0)) *
          t.exam_weight AS priority_score
          
        FROM user_topic_mastery utm
        JOIN topics t ON utm.topicid = t.topicid
        WHERE utm.userid = $1
          AND (utm.next_review_date IS NULL OR utm.next_review_date <= NOW() + INTERVAL '1 day')
        ORDER BY priority_score DESC
        LIMIT 5
      ),
      
      -- Find questions with optimal difficulty for priority topics
      suitable_questions AS (
        SELECT 
          q.questionid,
          q.question_text,
          q.image_url,
          q.question_format,
          q.correct_answer,
          q.difficulty,
          q.total_marks,
          pt.topic_code,
          pt.topic_name,
          pt.priority_score,
          pt.urgency,
          pt.uncertainty,
          pt.mastery_need,
          pt.utility,
          1.0 / (1.0 + POWER(10, (q.elo_rating - pt.user_elo) / 400.0)) AS expected_success,
          ABS(1.0 / (1.0 + POWER(10, (q.elo_rating - pt.user_elo) / 400.0)) - 0.70) AS difficulty_distance
        FROM priority_topics pt
        JOIN question_topics qt ON pt.topic_code = qt.topic_code
        JOIN questions q ON qt.questionid = q.questionid
        WHERE 
          1.0 / (1.0 + POWER(10, (q.elo_rating - pt.user_elo) / 400.0)) BETWEEN 0.50 AND 0.85
          AND q.questionid NOT IN (
            SELECT questionid FROM question_attempts 
            WHERE userid = $1 AND attempted_at > NOW() - INTERVAL '7 days'
          )
          AND q.is_anchor = FALSE
      )
      
      -- Deduplication
      SELECT DISTINCT ON (questionid)
        questionid,
        question_text,
        image_url,
        question_format,
        correct_answer,
        difficulty,
        total_marks,
        topic_code,
        topic_name,
        ROUND(expected_success::numeric, 2) AS expected_success,
        ROUND(urgency::numeric, 3) AS urgency,
        ROUND(uncertainty::numeric, 3) AS uncertainty,
        ROUND(mastery_need::numeric, 3) AS mastery_need,
        ROUND(utility::numeric, 2) AS utility,
        ROUND(priority_score::numeric, 4) AS priority_score
      FROM suitable_questions
      ORDER BY 
        questionid,
        priority_score DESC,
        difficulty_distance ASC
      LIMIT $2
    `, [userid, question_count]);

    // Fallback if not enough questions
    if (questions.rows.length === 0) {
      console.log("No suitable questions found, using intelligent fallback");
      
      const fallbackQuestions = await client.query(`
        WITH user_topics AS (
          -- Get topics user has studied, ordered by need
          SELECT 
            t.topic_code,
            utm.elo_rating,
            utm.fsrs_stability,
            COALESCE(utm.mastery_gap, 0) AS mastery_gap,
            -- Simple priority: favor struggling topics
            CASE 
              WHEN utm.mastery_gap < -50 THEN 3  -- Struggling
              WHEN utm.mastery_gap < 0 THEN 2    -- Below average
              ELSE 1                              -- Average or better
            END AS topic_priority
          FROM user_topic_mastery utm
          JOIN topics t ON utm.topicid = t.topicid
          WHERE utm.userid = $1
            AND utm.fsrs_state != 'new'
          ORDER BY topic_priority DESC, RANDOM()
          LIMIT 5  -- Top 5 topics user needs help with
        ),
        available_questions AS (
          -- Find questions from those topics
          SELECT DISTINCT
            q.questionid,
            q.question_text,
            q.image_url,
            q.question_format,
            q.correct_answer,
            q.difficulty,
            q.total_marks,
            ut.topic_code,
            ut.topic_priority,
            -- Calculate expected success
            1.0 / (1.0 + POWER(10, (q.elo_rating - ut.elo_rating) / 400.0)) AS expected_success
          FROM questions q
          JOIN question_topics qt ON q.questionid = qt.questionid
          JOIN user_topics ut ON qt.topic_code = ut.topic_code
          WHERE q.is_anchor = FALSE
            -- Exclude recent attempts
            AND q.questionid NOT IN (
              SELECT questionid FROM question_attempts 
              WHERE userid = $1 AND attempted_at > NOW() - INTERVAL '7 days'
            )
            -- Prefer questions in reasonable difficulty range
            AND 1.0 / (1.0 + POWER(10, (q.elo_rating - ut.elo_rating) / 400.0)) BETWEEN 0.30 AND 0.90
        )
        SELECT DISTINCT ON (questionid)
          questionid,
          question_text,
          image_url,
          question_format,
          correct_answer,
          difficulty,
          total_marks,
          topic_code,
          ROUND(expected_success::numeric, 2) AS expected_success
        FROM available_questions
        ORDER BY 
          questionid,
          topic_priority DESC,  -- Prioritize struggling topics
          ABS(expected_success - 0.60) ASC,  -- Prefer ~60% success
          RANDOM()
        LIMIT $2
      `, [userid, question_count]);
      
      // If STILL no questions (new user or all questions attempted), use true random
      if (fallbackQuestions.rows.length === 0) {
        console.log("User has no topic history, using random questions");
        const randomQuestions = await client.query(`
          SELECT 
            q.questionid,
            q.question_text,
            q.image_url,
            q.question_format,
            q.correct_answer,
            q.difficulty,
            q.total_marks
          FROM questions q
          WHERE q.is_anchor = FALSE
            AND q.questionid NOT IN (
              SELECT questionid FROM question_attempts 
              WHERE userid = $1 AND attempted_at > NOW() - INTERVAL '7 days'
            )
          ORDER BY RANDOM()
          LIMIT $2
        `, [userid, question_count]);
        
        questions.rows = randomQuestions.rows;
      } else {
        questions.rows = fallbackQuestions.rows;
      }
    }

    console.log(`Selected ${questions.rows.length} questions`);
    
    // Log priority breakdown (useful for debugging)
    if (questions.rows.length > 0 && questions.rows[0].priority_score) {
      console.log("Top question priority breakdown:");
      console.log(`  Topic: ${questions.rows[0].topic_name}`);
      console.log(`  Urgency: ${questions.rows[0].urgency}`);
      console.log(`  Uncertainty: ${questions.rows[0].uncertainty}`);
      console.log(`  Mastery need: ${questions.rows[0].mastery_need}`);
      console.log(`  Utility: ${questions.rows[0].utility}`);
      console.log(`  Total priority: ${questions.rows[0].priority_score}`);
    }

    // Insert questions into quiz
    for (let i = 0; i < questions.rows.length; i++) {
      await client.query(`
        INSERT INTO quiz_questions (quizid, questionid, question_order)
        VALUES ($1, $2, $3)
      `, [quizId, questions.rows[i].questionid, i + 1]);
    }

    await client.query("COMMIT");

    res.status(200).json({ 
      questions: questions.rows, 
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
  const client = await pool.connect();  // Transaction wrapper
  
  try {
    const { userid, quiz_type, quiz_mode, topics, using_custom_difficulty, custom_difficulty_min, custom_difficulty_max, custom_question_count } = req.body;

    console.log("Generating quiz for user:", userid, "with parameters:", req.body);

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
      // Get topic codes from topic IDs
      const topic_codes = await client.query(`
        SELECT topic_code FROM topics
        WHERE topicid = ANY($1)
      `, [topics]);

      console.log("Topic codes for selected topics:", topic_codes.rows);

      // FIX: Use subquery to avoid DISTINCT + ORDER BY RANDOM() conflict
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
                 q.correct_answer, q.difficulty, q.total_marks
          FROM questions q
          WHERE q.questionid IN (
            SELECT DISTINCT qt.questionid
            FROM question_topics qt
            JOIN user_abilities ua ON qt.topic_code = ua.topic_code
            WHERE qt.topic_code = ANY($1)
              -- Use Glicko to filter for appropriate difficulty
              AND 1.0 / (1.0 + POWER(10, (q.elo_rating - ua.user_elo) / 400.0)) BETWEEN 0.40 AND 0.90
          )
          AND q.is_anchor = FALSE
          ORDER BY RANDOM()
          LIMIT $2
        `;
        queryParams = [topic_codes.rows.map(row => row.topic_code), custom_question_count, userid];
      } else {
        // Random selection - FIX: Use subquery to avoid duplicate issues
        query = `
          SELECT q.questionid, q.question_text, q.image_url, q.question_format, 
                 q.correct_answer, q.difficulty, q.total_marks
          FROM questions q
          WHERE q.questionid IN (
            SELECT DISTINCT qt.questionid
            FROM question_topics qt
            WHERE qt.topic_code = ANY($1)
          )
          AND q.is_anchor = FALSE
          ORDER BY RANDOM()
          LIMIT $2
        `;
        queryParams = [topic_codes.rows.map(row => row.topic_code), custom_question_count];
      }
    }

    const questions = await client.query(query, queryParams);

    console.log("Questions fetched for quiz:", questions.rows);

    for (let i = 0; i < questions.rows.length; i++) {
      await client.query(`
        INSERT INTO quiz_questions (quizid, questionid, question_order)
        VALUES ($1, $2, $3)
      `, [quizId, questions.rows[i].questionid, i + 1]);
    }

    await client.query("COMMIT");
    
    return res.status(200).json({ questions: questions.rows, quizid: quizId });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error fetching questions:", error);
    res.status(500).json({ error: "Failed to fetch questions" });
  } finally {
    client.release();
  }
});

// =====================================================================================
//                           MARK SCHEME
// =====================================================================================

router.get("/mark-scheme/:questionId", async (req, res) => {
  const { questionId } = req.params;
  console.log("Fetching mark scheme for question ID:", questionId);
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
//                           ANSWER SUBMISSION (FIX #4: Proper validation)
// =====================================================================================

router.post("/answer", async (req, res) => {
  try {
    console.log("Submitting answer:", req.body);
    
    const { 
      userid, 
      questionid, 
      quizid, 
      marks_awarded, 
      marks_available, 
      confidence,
      time_taken,
      question_difficulty 
    } = req.body;
    
    // FIX #4: Proper confidence validation (not just truthy check)
    if (confidence === null || confidence < 1 || confidence > 5) {
      return res.status(400).json({ 
        error: "Confidence rating must be between 1 and 5" 
      });
    }
    
    const result = await pool.query(`
      INSERT INTO question_attempts (
        userid, 
        questionid, 
        quizid, 
        marks_awarded, 
        marks_available, 
        confidence,
        time_taken,
        question_difficulty
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      userid, 
      questionid, 
      quizid, 
      marks_awarded, 
      marks_available, 
      confidence,
      time_taken || 0,  // Default to 0 if not provided
      question_difficulty
    ]);
    
    console.log("Answer submitted:", result.rows[0]);
    
    // Mark question as complete
    await pool.query(`
      UPDATE quiz_questions
      SET is_complete = TRUE
      WHERE quizid = $1 AND questionid = $2
    `, [quizid, questionid]);

    // Return calculated values from trigger for user feedback
    res.status(200).json({ 
      message: "Answer submitted successfully", 
      answer: result.rows[0],
      // These are calculated by the trigger
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
//                           TOPICS
// =====================================================================================

router.get("/topics", async (req, res) => {
  try {
    const topicsResult = await pool.query(`
      SELECT * FROM topics
    `);

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
    console.log("Fetching quiz results for user ID:", userid);

    const overallStats = await pool.query(`
      SELECT 
        qa.quizid, 
        SUM(qa.marks_awarded) AS total_marks_awarded, 
        SUM(qa.marks_available) AS total_marks_available,
        ROUND((SUM(qa.marks_awarded)::DECIMAL / NULLIF(SUM(qa.marks_available), 0)) * 100, 2) AS percentage,
        COUNT(*) AS questions_answered,
        ROUND(AVG(qa.confidence), 2) AS avg_confidence,
        SUM(qa.time_taken) AS total_time_seconds
      FROM question_attempts qa 
      WHERE qa.userid = $1
      GROUP BY qa.quizid
      ORDER BY qa.quizid DESC
      LIMIT 1
    `, [userid]);

    // Break down by topic
    const individualTopicStats = await pool.query(`
      SELECT 
        t.topic_code, 
        t.topic_name, 
        SUM(qa.marks_awarded) AS marks_awarded, 
        SUM(qa.marks_available) AS marks_available,
        ROUND((SUM(qa.marks_awarded)::DECIMAL / NULLIF(SUM(qa.marks_available), 0)) * 100, 2) AS percentage,
        COUNT(*) AS questions_answered
      FROM question_attempts qa
      JOIN question_topics qt ON qa.questionid = qt.questionid
      JOIN topics t ON qt.topic_code = t.topic_code
      WHERE qa.userid = $1 
        AND qa.quizid = (
          SELECT quizid FROM quizzes 
          WHERE userid = $1 
          ORDER BY quizid DESC 
          LIMIT 1
        )
      GROUP BY t.topic_code, t.topic_name
      ORDER BY percentage DESC
    `, [userid]);

    console.log("Overall stats:", overallStats.rows);
    console.log("Individual topic stats:", individualTopicStats.rows);

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
//                   GET UNANSWERED QUESTIONS
// =====================================================================================

router.get("/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const userIdInt = parseInt(userid);
    console.log("Fetching unanswered questions for user ID:", userid);

    // Only get unanswered questions from THE MOST RECENT quiz
    const unansweredQuestions = await pool.query(`
      SELECT DISTINCT ON (q.questionid)
        q.questionid, 
        q.question_text, 
        q.image_url, 
        q.question_format, 
        q.correct_answer, 
        q.difficulty, 
        q.total_marks, 
        qq.question_order, 
        qq.quizid
      FROM questions q
      JOIN quiz_questions qq ON q.questionid = qq.questionid
      WHERE qq.is_complete = FALSE
        -- FIX: Only the most recent quiz, not all quizzes
        AND qq.quizid = (
          SELECT quizid FROM quizzes 
          WHERE userid = $1
          ORDER BY created_at DESC
          LIMIT 1
        )
      ORDER BY q.questionid, qq.question_order ASC
    `, [userIdInt]);

    console.log("Unanswered questions fetched:", unansweredQuestions.rows.length);

    return res.status(200).json({ 
      questions: unansweredQuestions.rows.length > 0 ? unansweredQuestions.rows : null, 
      quizid: unansweredQuestions.rows.length > 0 ? unansweredQuestions.rows[0].quizid : null 
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
    console.log("Deleting incomplete quiz for user ID:", userid);

    // Find incomplete quizzes
    const incompleteQuizzes = await pool.query(`
      SELECT quizid FROM quizzes
      WHERE userid = $1 AND completed_at IS NULL
    `, [userid]);

    if (incompleteQuizzes.rows.length === 0) {
      return res.status(200).json({ message: "No incomplete quizzes to delete" });
    }

    // Delete quiz (cascade will delete quiz_questions)
    await pool.query(`
      DELETE FROM quizzes
      WHERE userid = $1 AND completed_at IS NULL
    `, [userid]);

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
    
    // Get topics due for review
    const dueTopics = await pool.query(`
      SELECT * FROM topics_due_for_review
      WHERE userid = $1
      ORDER BY priority_score DESC
      LIMIT 5
    `, [userid]);
    
    // Get recent performance (last 7 days)
    const recentStats = await pool.query(`
      SELECT 
        COUNT(*) as questions_answered,
        ROUND((SUM(marks_awarded)::DECIMAL / NULLIF(SUM(marks_available), 0)) * 100, 2) as avg_percentage,
        ROUND(AVG(confidence), 2) as avg_confidence,
        SUM(time_taken) as total_study_time
      FROM question_attempts
      WHERE userid = $1 
        AND attempted_at > NOW() - INTERVAL '7 days'
    `, [userid]);
    
    // Get user progress (streaks, XP)
    const userProgress = await pool.query(`
      SELECT * FROM user_progress
      WHERE userid = $1
    `, [userid]);
    
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