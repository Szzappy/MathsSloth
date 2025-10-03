import express from "express";;
import pool from "../config/db.js";
import "dotenv/config";

const router = express.Router();

router.get("/get-quiz", async (req, res) => {
  try {
    const questions = await pool.query(`
      SELECT *
      FROM questions`
    );
  res.status(200).json(questions.rows);
  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({ error: "Failed to fetch questions" });
  }
})

export default router;