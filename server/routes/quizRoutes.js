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
  res.status(200).json({ questions: questions.rows });
  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({ error: "Failed to fetch questions" });
  }
})

router.get("/get-mark-scheme/:questionId", async (req, res) => {
  console.log("Fetching mark scheme for question");
  const { questionId } = req.params;
  console.log("Received request for mark scheme of question ID:", questionId);
  try {
    const markScheme = await pool.query(`
      SELECT * FROM mark_scheme_items
      WHERE questionid = $1`, [questionId]);

    res.status(200).json({ markScheme: markScheme.rows });
  } catch (error) {
    console.error("Error fetching mark scheme:", error);
    res.status(500).json({ error: "Failed to fetch mark scheme" });
  }
});

export default router;