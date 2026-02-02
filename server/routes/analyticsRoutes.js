import express from "express";
import pool from "../config/db.js";
import "dotenv/config";

const router = express.Router();

// UPDATED - Topic ELOs (fixed to handle parent topics correctly)
router.get("/topic-elos/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const elosResult = await pool.query(
      `SELECT 
        t.topicid,
        t.topic_code,
        t.topic_name,
        t.parent_topic,
        utm.elo_rating,
        t.exam_weight
       FROM user_topic_mastery utm
       JOIN topics t ON utm.topicid = t.topicid
       WHERE utm.userid = $1
         AND utm.elo_rating IS NOT NULL
       ORDER BY t.topic_code`,
      [userid]
    );
    console.log("ELOS RESULT ROWS", elosResult.rows);
    res.json(elosResult.rows);
  } catch (error) {
    console.error("Error fetching topic elos:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Existing route - Questions Answered
router.get("/questions-answered/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    console.log("USERID PARAMS", userid);
    const questionsResult = await pool.query(
      `SELECT COUNT(*) AS questions_answered
       FROM question_attempts
       WHERE userid = $1`,
      [userid]
    );
    console.log("Questions Answered RESULT ROWS", questionsResult.rows);
    res.json(questionsResult.rows[0]);
  } catch (error) {
    console.error("Error fetching questions answered:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Existing route - Confidence Levels
router.get("/confidence/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const confidenceResult = await pool.query(
      `SELECT topic_code, AVG(confidence) AS average_confidence
       FROM question_attempts NATURAL JOIN question_topics
       WHERE userid = $1
       GROUP BY topic_code`,
      [userid]
    );
    res.json(confidenceResult.rows);
  } catch (error) {
    console.error("Error fetching confidence levels:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Existing route - Predicted Grade
router.get("/predicted-grade/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    
    const predictedGradeResult = await pool.query(`
      SELECT 
        SUM(utm.elo_rating * t.exam_weight) / NULLIF(SUM(t.exam_weight), 0) AS predicted_grade
      FROM user_topic_mastery utm
      JOIN topics t ON utm.topicid = t.topicid
      WHERE utm.userid = $1 
        AND utm.elo_rating IS NOT NULL 
        AND t.exam_weight > 0
    `, [userid]);
    
    console.log("Predicted Grade RESULT:", predictedGradeResult.rows);
    res.json(predictedGradeResult.rows[0]);
  } catch (error) {
    console.error("Error fetching predicted grade:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Existing route - Question Attempts
router.get("/question-attempts/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    
    let query = `
      SELECT 
        attemptid,
        userid,
        questionid,
        quizid,
        is_correct,
        marks_awarded,
        marks_available,
        confidence,
        time_taken,
        attempted_at
      FROM question_attempts
      WHERE userid = $1
    `;
    
    const params = [userid];
    
    query += ` ORDER BY attempted_at ASC`;
    
    const result = await pool.query(query, params);
    
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching question attempts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// NEW - Streak Data (Current and Longest)
router.get("/streak/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    
    // Get all distinct dates when user answered questions, sorted
    const datesResult = await pool.query(
      `SELECT DISTINCT DATE(attempted_at) as date
       FROM question_attempts
       WHERE userid = $1
       ORDER BY date DESC`,
      [userid]
    );
    
    if (datesResult.rows.length === 0) {
      return res.json({ currentStreak: 0, longestStreak: 0 });
    }
    
    const dates = datesResult.rows.map(row => new Date(row.date));
    
    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < dates.length; i++) {
      const date = new Date(dates[i]);
      date.setHours(0, 0, 0, 0);
      
      const expectedDate = new Date(today);
      expectedDate.setDate(expectedDate.getDate() - i);
      expectedDate.setHours(0, 0, 0, 0);
      
      if (date.getTime() === expectedDate.getTime()) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 1;
    
    for (let i = 0; i < dates.length - 1; i++) {
      const current = new Date(dates[i]);
      const next = new Date(dates[i + 1]);
      
      const diffTime = current - next;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);
    
    console.log("Streak RESULT:", { currentStreak, longestStreak });
    res.json({
      currentStreak,
      longestStreak
    });
  } catch (error) {
    console.error("Error fetching streak data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// NEW - Learning Velocity (Questions per day and trend)
router.get("/learning-velocity/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    
    // Get questions per day for last 7 days
    const last7DaysResult = await pool.query(
      `SELECT 
        DATE(attempted_at) as date,
        COUNT(*) as question_count
       FROM question_attempts
       WHERE userid = $1 
         AND attempted_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(attempted_at)
       ORDER BY date DESC`,
      [userid]
    );
    
    // Get questions per day for previous 7 days (8-14 days ago)
    const previous7DaysResult = await pool.query(
      `SELECT 
        DATE(attempted_at) as date,
        COUNT(*) as question_count
       FROM question_attempts
       WHERE userid = $1 
         AND attempted_at >= NOW() - INTERVAL '14 days'
         AND attempted_at < NOW() - INTERVAL '7 days'
       GROUP BY DATE(attempted_at)`,
      [userid]
    );
    
    // Calculate averages
    const last7Total = last7DaysResult.rows.reduce((sum, row) => sum + parseInt(row.question_count), 0);
    const last7Days = Math.max(1, last7DaysResult.rows.length);
    const last7Avg = last7Total / last7Days;
    
    const previous7Total = previous7DaysResult.rows.reduce((sum, row) => sum + parseInt(row.question_count), 0);
    const previous7Days = Math.max(1, previous7DaysResult.rows.length);
    const previous7Avg = previous7Total / previous7Days;
    
    // Calculate trend (percentage change)
    const trend = previous7Avg > 0 
      ? ((last7Avg - previous7Avg) / previous7Avg) * 100 
      : (last7Avg > 0 ? 100 : 0);
    
    console.log("Learning Velocity RESULT:", { questionsPerDay: last7Avg, trend });
    res.json({
      questionsPerDay: last7Avg,
      trend: trend
    });
  } catch (error) {
    console.error("Error fetching learning velocity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// NEW - Grade Progress Over Time
router.get("/grade-progress/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    
    // Get daily average ELO based on question attempts
    const result = await pool.query(
      `SELECT 
        DATE(qa.attempted_at) as date,
        AVG(qa.user_elo_after) as avg_elo,
        COUNT(*) as question_count
       FROM question_attempts qa
       WHERE qa.userid = $1
       GROUP BY DATE(qa.attempted_at)
       ORDER BY date ASC`,
      [userid]
    );
    
    console.log("Grade Progress RESULT:", result.rows.length, "data points");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching grade progress:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// BONUS - Overall Statistics Summary
router.get("/summary/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    
    const summary = await pool.query(
      `SELECT 
        COUNT(DISTINCT qa.attemptid) as total_questions,
        COUNT(DISTINCT DATE(qa.attempted_at)) as days_active,
        (AVG(CASE WHEN qa.is_correct THEN 1 ELSE 0 END) * 100)::numeric(5,2) as accuracy,
        AVG(qa.confidence)::numeric(4,2) as avg_confidence,
        AVG(CASE WHEN qa.time_taken > 0 THEN qa.time_taken END)::numeric(10,2) as avg_time_taken,
        COUNT(DISTINCT qa.questionid) as unique_questions
       FROM question_attempts qa
       WHERE qa.userid = $1`,
      [userid]
    );
    
    const topicsCount = await pool.query(
      `SELECT COUNT(DISTINCT topicid) as topics_studied
       FROM user_topic_mastery
       WHERE userid = $1`,
      [userid]
    );
    
    const result = {
      ...summary.rows[0],
      topics_studied: topicsCount.rows[0]?.topics_studied || 0
    };
    
    console.log("Analytics Summary RESULT:", result);
    res.json(result);
  } catch (error) {
    console.error("Error fetching analytics summary:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;