import express from "express";;
import pool from "../config/db.js";
import "dotenv/config";

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { userid, quiz_type, quiz_mode, topics, using_custom_difficulty, custom_difficulty_min, custom_difficulty_max, custom_question_count } = req.body;

    console.log("Generating quiz for user:", userid, "with parameters:", req.body);

    const quizResult = await pool.query(`
      INSERT INTO quizzes (userid, quiz_type, quiz_mode, using_custom_difficulty, custom_difficulty_min, custom_difficulty_max, custom_question_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING quizid
    `, [userid, quiz_type, quiz_mode, using_custom_difficulty, custom_difficulty_min, custom_difficulty_max, custom_question_count]);

    const quizId = quizResult.rows[0].quizid;

    let query = ``;
    let queryParams = [];

    // if quiz_type is "custom", filter questions based on topics and difficulty
    if (quiz_type === "custom") {
      // if not using custom difficulty, set min and max to defaults
      // refine to choose at least one question per topic

      // select the topic_codes's based on their topic ids
      const topic_codes = await pool.query(`
        SELECT topic_code FROM topics
        WHERE topicid = ANY($1)
      `, [topics]);

      console.log("Topic codes for selected topics:", topic_codes.rows);

      query = `
        SELECT DISTINCT(q.questionid), q.question_text, q.image_url, q.question_format, q.correct_answer, q.difficulty, q.total_marks
        FROM questions q
        JOIN question_topics qt ON q.questionid = qt.questionid
        WHERE qt.topic_code = ANY($1)
        -- AND q.difficulty BETWEEN $2 AND $3
        LIMIT $2
      `;
      queryParams = [topic_codes.rows.map(row => row.topic_code), /*custom_difficulty_min, custom_difficulty_max, */custom_question_count];
    }

    const questions = await pool.query(query, queryParams);

    console.log("Questions fetched for quiz:", questions.rows);

    /*const questions = await pool.query(`
      SELECT DISTINCT(q.questionid), q.question_text, q.image_url, q.question_format, q.correct_answer, q.difficulty, q.total_marks
      FROM questions q
      JOIN question_topics qt ON q.questionid = qt.questionid
    `);*/

    await Promise.all(
      questions.rows.map((q, index) =>
        pool.query(`
          INSERT INTO quiz_questions (quizid, questionid, question_order)
          VALUES ($1, $2, $3)
        `, [quizId, q.questionid, index + 1])
      )
    );
    
    // return the index of each question as well
    return res.status(200).json({ questions: questions.rows, quizid: quizId });
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

// make sure to update the quiz_questions table to mark questions as complete when answers are submitted
router.post("/submit-answer", async (req, res) => {
  try {
    console.log("Submitting answer:", req.body);
      const { userid, questionid, quizid, marks_awarded, marks_available, question_difficulty } = req.body;
      const result = await pool.query(`
        INSERT INTO question_attempts (userid, questionid, quizid, marks_awarded, marks_available, question_difficulty)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`, [userid, questionid, quizid, marks_awarded, marks_available, question_difficulty]);
      // res.status(200).json({ message: "Answer submitted successfully", answer: result.rows[0] });
      console.log("Answer submitted:", result.rows[0]);
      // mark question as complete in quiz_questions table
      await pool.query(`
        UPDATE quiz_questions
        SET is_complete = TRUE
        WHERE quizid = $1 AND questionid = $2
      `, [quizid, questionid]);

    res.status(200).json({ message: "Answer submitted successfully", answer: result.rows[0] });
  } catch (error) {
    console.error("Error submitting answer:", error);
    res.status(500).json({ error: "Failed to submit answer" });
  }
});

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

router.get("/results/:userid", async (req, res) => {
  try {
    // we want to get the results of the most recent quiz taken by a user
    const { userid } = req.params;
    console.log("Fetching quiz results for user ID:", userid);

    const overallStats = await pool.query(`
      SELECT qa.quizid, SUM(qa.marks_awarded) AS total_marks_awarded, SUM(qa.marks_available) AS total_marks_available
      FROM question_attempts qa 
      WHERE qa.userid = $1
      GROUP BY qa.quizid
      ORDER BY qa.quizid DESC
      LIMIT 1
    `, [userid]);

    // also break it down per topic
    const individualTopicStats = await pool.query(`
      SELECT t.topic_code, t.topic_name, SUM(qa.marks_awarded) AS marks_awarded, SUM(qa.marks_available) AS marks_available
      FROM question_attempts qa
      JOIN question_topics qt ON qa.questionid = qt.questionid
      JOIN topics t ON qt.topic_code = t.topic_code
      WHERE qa.userid = $1 AND qa.quizid = (SELECT quizid FROM quizzes WHERE userid = $1 ORDER BY quizid DESC LIMIT 1)
      GROUP BY t.topic_code, t.topic_name
    `, [userid]);

    console.log("Overall stats:", overallStats.rows);
    console.log("Individual topic stats:", individualTopicStats.rows);

    res.status(200).json({ results: overallStats.rows.length > 0 ? overallStats.rows[0] : null, individualTopicStats: individualTopicStats.rows });
  } catch (error) {
    console.error("Error fetching quiz results:", error);
    res.status(500).json({ error: "Failed to fetch quiz results" });
  }
});

router.get("/:userid", async (req, res) => {
  try {
    const { userid } = req.params;
    const userIdInt = parseInt(userid);
    console.log("Fetching unanswered questions for user ID:", userid);

    // want to get all questions that are left of a quiz for a user
    // this must only be the unanswered questions and in the most recent quiz they have taken

    // want to get the questions from the questions table whose questionid is in the quiz_questions table
    // need the quiz id too
    const unansweredQuestions = await pool.query(`
      SELECT DISTINCT(q.questionid), q.question_text, q.image_url, q.question_format, q.correct_answer, q.difficulty, q.total_marks, quiz_questions.question_order, quiz_questions.quizid
      FROM questions q
      JOIN question_topics qt ON q.questionid = qt.questionid
      JOIN quiz_questions ON q.questionid = quiz_questions.questionid
      WHERE quiz_questions.is_complete = FALSE
      AND quiz_questions.quizid IN (
        SELECT quizid FROM quizzes WHERE userid = $1
      )
      ORDER BY quiz_questions.question_order ASC`
    , [userIdInt]);

    console.log("Unanswered questions fetched:", unansweredQuestions.rows.length > 0 ? unansweredQuestions.rows : null, unansweredQuestions.rows.length > 0 ? unansweredQuestions.rows[0].quizid : null );

    return res.status(200).json({ 
      questions: unansweredQuestions.rows.length > 0 ? unansweredQuestions.rows : null, 
      quizid: unansweredQuestions.rows.length > 0 ? unansweredQuestions.rows[0].quizid : null 
    });
  } catch (error) {
    console.error("Error generating quiz:", error);
    res.status(500).json({ error: "Failed to generate quiz" });
  }
});



export default router;


// ADD A DELETE ENDPOINT WHERE A USER CAN START A NEW QUIZ, DELETING ANY UNANSWERED QUESTIONS