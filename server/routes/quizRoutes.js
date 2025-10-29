import express from "express";;
import pool from "../config/db.js";
import "dotenv/config";

const router = express.Router();

router.get("/get-quiz", async (req, res) => {
  try {
    const questions = await pool.query(`
      SELECT DISTINCT(q.questionid), q.question_text, q.image_url, q.question_format, q.correct_answer, q.difficulty, q.total_marks
      FROM questions q JOIN question_topics qt ON q.questionid = qt.questionid
      -- WHERE qt.topicid LIKE 'A11%'`
    );
  res.status(200).json(questions.rows);
  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({ error: "Failed to fetch questions" });
  }
})

export default router;