import express from "express";
import pool from "../config/db.js";
import "dotenv/config";

const router = express.Router();

// =====================================================================================
//                           HELPER: CONVERT WEIGHTED ELO TO LETTER GRADE
// =====================================================================================

function eloToGrade(elo) {
  if (!elo) return 'U';
  if (elo >= 1800) return 'A*';
  if (elo >= 1600) return 'A';
  if (elo >= 1400) return 'B';
  if (elo >= 1200) return 'C';
  if (elo >= 1000) return 'D';
  if (elo >= 800)  return 'E';
  return 'U';
}

// =====================================================================================
//                           DASHBOARD STATS (single aggregated endpoint)
//                           Returns: accuracy, totalQuestions, studyTime,
//                                    currentStreak, predictedGrade (letter),
//                                    weightedElo, daysUntilExam
// =====================================================================================

router.get("/dashboard-stats/:userid", async (req, res) => {
  try {
    const { userid } = req.params;

    // ── Core stats from question_attempts ───────────────────────────────
    const coreStats = await pool.query(`
      SELECT
        COUNT(*)                                                          AS total_questions,
        ROUND((SUM(marks_awarded)::numeric / NULLIF(SUM(marks_available), 0)) * 100.0, 1) AS accuracy,
        ROUND(SUM(time_taken) / 60.0, 0)                                 AS study_time_mins
      FROM question_attempts
      WHERE userid = $1
        AND grading_status != 'pending'
    `, [userid]);

    // ── Streak: verbatim from the working /streak route ─────────────────
    const streakDatesResult = await pool.query(
      `SELECT DISTINCT DATE(attempted_at) AS date
       FROM question_attempts
       WHERE userid = $1
       ORDER BY date DESC`,
      [userid]
    );

    let streak = 0;

    if (streakDatesResult.rows.length > 0) {
      const dates = streakDatesResult.rows.map(row => new Date(row.date));
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (let i = 0; i < dates.length; i++) {
        const date = new Date(dates[i]);
        date.setHours(0, 0, 0, 0);

        const expectedDate = new Date(today);
        expectedDate.setDate(expectedDate.getDate() - i);
        expectedDate.setHours(0, 0, 0, 0);

        if (date.getTime() === expectedDate.getTime()) {
          streak++;
        } else {
          break;
        }
      }
    }

    // ── Predicted grade: weighted average ELO across ATTEMPTED topics only ──────
    // Excluding 'new' (never-attempted) topics so a quiz of 8 questions moves
    // the needle visibly instead of being diluted across all 73 seeded topics.
    // Falls back to full average only if user has never answered anything yet.
    const gradeResult = await pool.query(`
      SELECT
        ROUND(
          COALESCE(
            -- Primary: only topics the user has actually attempted
            NULLIF(
              SUM(CASE WHEN utm.fsrs_state != 'new' THEN utm.elo_rating * t.exam_weight END) /
              NULLIF(SUM(CASE WHEN utm.fsrs_state != 'new' THEN t.exam_weight END), 0),
            NULL),
            -- Fallback: all topics (used only before first quiz)
            SUM(utm.elo_rating * t.exam_weight) / NULLIF(SUM(t.exam_weight), 0)
          )
        )::integer AS weighted_elo
      FROM user_topic_mastery utm
      JOIN topics t ON utm.topicid = t.topicid
      WHERE utm.userid = $1
        AND utm.elo_rating IS NOT NULL
        AND t.exam_weight > 0
    `, [userid]);

    const weightedElo = gradeResult.rows[0]?.weighted_elo || null;
    const weightedEloRounded = weightedElo ? Math.round(weightedElo) : null;
    const predictedGrade = eloToGrade(weightedEloRounded);

    // ── Days until exam: reads exam_date from users table if it exists ───
    // Falls back to a fixed placeholder if column doesn't exist
    let daysUntilExam = null;
    try {
      const examResult = await pool.query(`
        SELECT exam_date FROM users WHERE userid = $1
      `, [userid]);
      if (examResult.rows[0]?.exam_date) {
        const exam = new Date(examResult.rows[0].exam_date);
        const now = new Date();
        daysUntilExam = Math.max(0, Math.ceil((exam - now) / (1000 * 60 * 60 * 24)));
      }
    } catch (_) {
      // exam_date column may not exist yet — silently ignore
    }

    const core = coreStats.rows[0];

    res.json({
      accuracy: parseFloat(core.accuracy) || 0,
      totalQuestions: parseInt(core.total_questions) || 0,
      studyTime: parseInt(core.study_time_mins) || 0,
      streak,
      predictedGrade,
      weightedElo: weightedEloRounded || 0,
      daysUntilExam,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =====================================================================================
//                           TOPIC ELOs
// =====================================================================================

router.get("/topic-elos/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const result = await pool.query(`
      SELECT
        t.topicid, t.topic_code, t.topic_name, t.parent_topic,
        pt.topic_name AS parent_topic_name,
        utm.elo_rating::integer AS elo_rating, t.exam_weight
      FROM user_topic_mastery utm
      JOIN topics t ON utm.topicid = t.topicid
      LEFT JOIN topics pt ON pt.topic_code = t.parent_topic
      WHERE utm.userid = $1
        AND utm.elo_rating IS NOT NULL
      ORDER BY t.topic_code
    `, [userid]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching topic elos:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =====================================================================================
//                           QUESTIONS ANSWERED
// =====================================================================================

router.get("/questions-answered/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const result = await pool.query(
      `SELECT COUNT(*) AS questions_answered FROM question_attempts WHERE userid = $1`,
      [userid]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching questions answered:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =====================================================================================
//                           CONFIDENCE LEVELS (by topic)
// =====================================================================================

router.get("/confidence/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const result = await pool.query(`
      SELECT topic_code, AVG(confidence) AS average_confidence
      FROM question_attempts NATURAL JOIN question_topics
      WHERE userid = $1
      GROUP BY topic_code
    `, [userid]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching confidence levels:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =====================================================================================
//                           PREDICTED GRADE (raw weighted ELO + letter)
// =====================================================================================

router.get("/predicted-grade/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const result = await pool.query(`
      SELECT
        ROUND(
          COALESCE(
            NULLIF(
              SUM(CASE WHEN utm.fsrs_state != 'new' THEN utm.elo_rating * t.exam_weight END) /
              NULLIF(SUM(CASE WHEN utm.fsrs_state != 'new' THEN t.exam_weight END), 0),
            NULL),
            SUM(utm.elo_rating * t.exam_weight) / NULLIF(SUM(t.exam_weight), 0)
          )
        )::integer AS weighted_elo
      FROM user_topic_mastery utm
      JOIN topics t ON utm.topicid = t.topicid
      WHERE utm.userid = $1
        AND utm.elo_rating IS NOT NULL
        AND t.exam_weight > 0
    `, [userid]);
    const weighted_elo = result.rows[0]?.weighted_elo || null;
    res.json({
      weighted_elo,
      grade: eloToGrade(weighted_elo)
    });
  } catch (error) {
    console.error("Error fetching predicted grade:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =====================================================================================
//                           QUESTION ATTEMPTS
// =====================================================================================

router.get("/question-attempts/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const result = await pool.query(`
      SELECT
        attemptid, userid, questionid, quizid, is_correct,
        marks_awarded, marks_available, confidence, time_taken, attempted_at
      FROM question_attempts
      WHERE userid = $1
      ORDER BY attempted_at ASC
    `, [userid]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching question attempts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =====================================================================================
//                           STREAK
// =====================================================================================

router.get("/streak/:userid", async (req, res) => {
  try {
    const { userid } = req.params;

    const datesResult = await pool.query(`
      SELECT DISTINCT DATE(attempted_at) AS date
      FROM question_attempts
      WHERE userid = $1
      ORDER BY date DESC
    `, [userid]);

    if (datesResult.rows.length === 0) {
      return res.json({ currentStreak: 0, longestStreak: 0 });
    }

    const dates = datesResult.rows.map(r => new Date(r.date));

    // Current streak
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < dates.length; i++) {
      const d = new Date(dates[i]);
      d.setHours(0, 0, 0, 0);
      const expected = new Date(today);
      expected.setDate(today.getDate() - i);
      if (d.getTime() === expected.getTime()) currentStreak++;
      else break;
    }

    // Longest streak
    let longestStreak = 0, tempStreak = 1;
    for (let i = 0; i < dates.length - 1; i++) {
      const diff = Math.floor((dates[i] - dates[i + 1]) / 86400000);
      if (diff === 1) tempStreak++;
      else { longestStreak = Math.max(longestStreak, tempStreak); tempStreak = 1; }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    res.json({ currentStreak, longestStreak });
  } catch (error) {
    console.error("Error fetching streak:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =====================================================================================
//                           LEARNING VELOCITY
// =====================================================================================

router.get("/learning-velocity/:userid", async (req, res) => {
  try {
    const { userid } = req.params;

    const last7 = await pool.query(`
      SELECT DATE(attempted_at) AS date, COUNT(*) AS question_count
      FROM question_attempts
      WHERE userid = $1 AND attempted_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(attempted_at)
    `, [userid]);

    const prev7 = await pool.query(`
      SELECT DATE(attempted_at) AS date, COUNT(*) AS question_count
      FROM question_attempts
      WHERE userid = $1
        AND attempted_at >= NOW() - INTERVAL '14 days'
        AND attempted_at < NOW() - INTERVAL '7 days'
      GROUP BY DATE(attempted_at)
    `, [userid]);

    const last7Total = last7.rows.reduce((s, r) => s + parseInt(r.question_count), 0);
    const last7Avg = last7Total / Math.max(1, last7.rows.length);
    const prev7Total = prev7.rows.reduce((s, r) => s + parseInt(r.question_count), 0);
    const prev7Avg = prev7Total / Math.max(1, prev7.rows.length);
    const trend = prev7Avg > 0 ? ((last7Avg - prev7Avg) / prev7Avg) * 100 : (last7Avg > 0 ? 100 : 0);

    res.json({ questionsPerDay: last7Avg, trend });
  } catch (error) {
    console.error("Error fetching learning velocity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =====================================================================================
//                           GRADE PROGRESS OVER TIME
//
//   Reads from user_elo_snapshots — one row per active day maintained by the
//   trigger_snapshot_elo trigger on user_topic_mastery. Each row stores the
//   end-of-day weighted ELO: SUM(elo * exam_weight) / SUM(exam_weight) across
//   all studied topics. Window functions add cumulative and day-on-day ELO change.
// =====================================================================================

router.get("/grade-progress/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const result = await pool.query(`
      SELECT
        snapshot_date                                                              AS date,
        weighted_elo,
        topics_included,
        weighted_elo - FIRST_VALUE(weighted_elo) OVER (ORDER BY snapshot_date)   AS elo_change_from_start,
        weighted_elo - LAG(weighted_elo)         OVER (ORDER BY snapshot_date)   AS elo_change_from_prev
      FROM user_elo_snapshots
      WHERE userid = $1
      ORDER BY snapshot_date ASC
    `, [userid]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching grade progress:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =====================================================================================
//                           TOPIC CALIBRATION
//
//   Returns per-topic: avg confidence, accuracy, calibration score, and parent grouping.
//   Calibration = 100 - |confidence_as_pct - accuracy|
//   where confidence 1-5 is mapped to 0-100% via (conf-1)/4*100.
//   High calibration = self-assessment closely matches actual performance.
// =====================================================================================

router.get("/topic-calibration/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const result = await pool.query(`
      SELECT
        qt.topic_code,
        t.topic_name,
        t.parent_topic,
        pt.topic_name                                                              AS parent_topic_name,
        ROUND(AVG(qa.confidence)::numeric, 2)                                     AS avg_confidence,
        -- Accuracy = marks scored / marks available (last 30 days), expressed as 0-100%
        ROUND(
          (SUM(qa.marks_awarded)::numeric / NULLIF(SUM(qa.marks_available), 0)) * 100.0
        , 1)                                                                       AS accuracy,
        ROUND(GREATEST(0, 100 - ABS(
          ((AVG(qa.confidence) - 1.0) / 4.0) * 100.0
          - (SUM(qa.marks_awarded)::numeric / NULLIF(SUM(qa.marks_available), 0)) * 100.0
        ))::numeric, 0)                                                            AS calibration_score,
        -- Positive = overconfident, Negative = underconfident
        ROUND((
          ((AVG(qa.confidence) - 1.0) / 4.0) * 100.0
          - (SUM(qa.marks_awarded)::numeric / NULLIF(SUM(qa.marks_available), 0)) * 100.0
        )::numeric, 1)                                                             AS calibration_gap,
        COUNT(*)                                                                   AS attempt_count
      FROM question_attempts qa
      JOIN question_topics qt ON qa.questionid = qt.questionid
      JOIN topics t ON qt.topic_code = t.topic_code
      LEFT JOIN topics pt ON pt.topic_code = t.parent_topic
      WHERE qa.userid = $1
        AND qa.grading_status != 'pending'
        AND qa.attempted_at >= NOW() - INTERVAL '30 days'
      GROUP BY qt.topic_code, t.topic_code, t.topic_name, t.parent_topic, pt.topic_name
      ORDER BY t.topic_code
    `, [userid]);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching topic calibration:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =====================================================================================
//                           SUMMARY
// =====================================================================================

router.get("/summary/:userid", async (req, res) => {
  try {
    const { userid } = req.params;

    const summary = await pool.query(`
      SELECT
        COUNT(DISTINCT qa.attemptid)                                              AS total_questions,
        COUNT(DISTINCT DATE(qa.attempted_at))                                     AS days_active,
        (AVG(CASE WHEN qa.is_correct THEN 1 ELSE 0 END) * 100)::numeric(5,2)     AS accuracy,
        AVG(qa.confidence)::numeric(4,2)                                          AS avg_confidence,
        AVG(CASE WHEN qa.time_taken > 0 THEN qa.time_taken END)::numeric(10,2)   AS avg_time_taken,
        COUNT(DISTINCT qa.questionid)                                             AS unique_questions
      FROM question_attempts qa
      WHERE qa.userid = $1
    `, [userid]);

    const topicsCount = await pool.query(`
      SELECT COUNT(DISTINCT topicid) AS topics_studied
      FROM user_topic_mastery WHERE userid = $1
    `, [userid]);

    res.json({
      ...summary.rows[0],
      topics_studied: topicsCount.rows[0]?.topics_studied || 0
    });
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =====================================================================================
//                           TOPIC MASTERY SNAPSHOTS
//
//   Returns daily ELO history per topic for a user. Used for per-topic
//   improvement charts and the radar chart history view.
//   Optionally filter to a single topic via ?topicid=123
// =====================================================================================

router.get("/topic-snapshots/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const { topicid } = req.query;

    const result = await pool.query(`
      SELECT
        tms.topicid,
        t.topic_code,
        t.topic_name,
        t.parent_topic,
        tms.snapshot_date                                                        AS date,
        tms.elo_rating,
        -- Day-on-day ELO change per topic
        tms.elo_rating - LAG(tms.elo_rating) OVER (
          PARTITION BY tms.userid, tms.topicid
          ORDER BY tms.snapshot_date
        )                                                                        AS elo_change_from_prev,
        -- Total gain per topic from first recorded day
        tms.elo_rating - FIRST_VALUE(tms.elo_rating) OVER (
          PARTITION BY tms.userid, tms.topicid
          ORDER BY tms.snapshot_date
        )                                                                        AS elo_change_from_start
      FROM topic_mastery_snapshots tms
      JOIN topics t ON tms.topicid = t.topicid
      WHERE tms.userid = $1
        ${topicid ? 'AND tms.topicid = $2' : ''}
      ORDER BY t.topic_code, tms.snapshot_date ASC
    `, topicid ? [userid, topicid] : [userid]);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching topic snapshots:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;