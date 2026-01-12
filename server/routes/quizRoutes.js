import express from "express";
import pool from "../config/db.js";
import "dotenv/config";

const router = express.Router();

// =====================================================================================
//                           ADAPTIVE QUIZ GENERATION (FULLY CORRECTED)
// =====================================================================================

router.post("/adaptive", async (req, res) => {
  const client = await pool.connect();  // Add transaction wrapper
  
  try {
    const { userid, question_count = 10 } = req.body;
    
    console.log("Generating adaptive quiz for user:", userid);

    await client.query("BEGIN");  // Start transaction

    // Create quiz record
    const quizResult = await client.query(`
      INSERT INTO quizzes (userid, quiz_type, quiz_mode, custom_question_count)
      VALUES ($1, 'adaptive', 'optimal_difficulty', $2)
      RETURNING quizid
    `, [userid, question_count]);

    const quizId = quizResult.rows[0].quizid;

    // Two-stage adaptive selection with deduplication
    const questions = await client.query(`
      -- STAGE 1: Get priority topics based on FSRS urgency × Glicko uncertainty × Exam weight
      WITH priority_topics AS (
        SELECT 
          utm.topicid,
          t.topic_code,
          t.topic_name,
          utm.elo_rating AS user_elo,
          -- Priority = urgency × uncertainty × utility
          (
            -- FSRS urgency component
            CASE 
              WHEN utm.next_review_date IS NULL THEN 0.5
              WHEN utm.next_review_date > NOW() THEN 
                1 - POWER(0.9, GREATEST(0, -EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400) / GREATEST(utm.fsrs_stability, 0.1))
              ELSE 
                1 - POWER(0.9, EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400 / GREATEST(utm.fsrs_stability, 0.1))
            END
          ) * 
          (
            -- Glicko uncertainty component (square root to soften)
            SQRT(utm.glicko_rd / 350.0)
          ) *
          (
            -- Exam weight utility component
            t.exam_weight
          ) AS priority_score
        FROM user_topic_mastery utm
        JOIN topics t ON utm.topicid = t.topicid
        WHERE utm.userid = $1
          AND (utm.next_review_date IS NULL OR utm.next_review_date <= NOW() + INTERVAL '1 day')
        ORDER BY priority_score DESC
        LIMIT 5  -- Top 5 priority topics
      ),
      
      -- STAGE 2: For each topic, find questions with optimal difficulty
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
          -- Calculate expected success using Glicko-2 formula
          1.0 / (1.0 + POWER(10, (q.elo_rating - pt.user_elo) / 400.0)) AS expected_success,
          -- Distance from optimal (70% success)
          ABS(1.0 / (1.0 + POWER(10, (q.elo_rating - pt.user_elo) / 400.0)) - 0.70) AS difficulty_distance
        FROM priority_topics pt
        JOIN question_topics qt ON pt.topic_code = qt.topic_code
        JOIN questions q ON qt.questionid = q.questionid
        WHERE 
          -- Only questions in optimal difficulty range (50-85% success probability)
          1.0 / (1.0 + POWER(10, (q.elo_rating - pt.user_elo) / 400.0)) BETWEEN 0.50 AND 0.85
          -- Don't repeat recently attempted questions (last 7 days)
          AND q.questionid NOT IN (
            SELECT questionid FROM question_attempts 
            WHERE userid = $1 AND attempted_at > NOW() - INTERVAL '7 days'
          )
          -- Don't use anchor questions in regular quizzes
          AND q.is_anchor = FALSE
      )
      
      -- FIX #1: DEDUPLICATION - Questions can appear in multiple topics
      -- Use DISTINCT ON to ensure each question appears only once
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
        ROUND(expected_success::numeric, 2) AS expected_success
      FROM suitable_questions
      ORDER BY 
        questionid,                 -- DISTINCT ON requires this first
        priority_score DESC,        -- Then by priority
        difficulty_distance ASC     -- Then by optimal difficulty
      LIMIT $2
    `, [userid, question_count]);

    // If not enough questions found, fall back to random selection
    if (questions.rows.length === 0) {
      console.log("No suitable questions found, using fallback selection");
      const fallbackQuestions = await client.query(`
        SELECT q.questionid, q.question_text, q.image_url, q.question_format, 
               q.correct_answer, q.difficulty, q.total_marks
        FROM questions q
        WHERE q.is_anchor = FALSE
          AND q.questionid NOT IN (
            SELECT questionid FROM question_attempts 
            WHERE userid = $1 AND attempted_at > NOW() - INTERVAL '7 days'
          )
        ORDER BY RANDOM()
        LIMIT $2
      `, [userid, question_count]);
      
      questions.rows = fallbackQuestions.rows;
    }

    console.log("Adaptive questions selected:", questions.rows.length);

    // Insert questions into quiz_questions table
    for (let i = 0; i < questions.rows.length; i++) {
      await client.query(`
        INSERT INTO quiz_questions (quizid, questionid, question_order)
        VALUES ($1, $2, $3)
      `, [quizId, questions.rows[i].questionid, i + 1]);
    }

    await client.query("COMMIT");  // Commit transaction

    res.status(200).json({ 
      questions: questions.rows, 
      quizid: quizId,
      message: "Adaptive quiz generated successfully"
    });
  } catch (error) {
    await client.query("ROLLBACK");  // Rollback on error
    console.error("Error generating adaptive quiz:", error);
    res.status(500).json({ error: "Failed to generate adaptive quiz" });
  } finally {
    client.release();  // Always release client
  }
});

// =====================================================================================
//                           CUSTOM QUIZ GENERATION (CORRECTED)
// =====================================================================================

router.post("/", async (req, res) => {
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