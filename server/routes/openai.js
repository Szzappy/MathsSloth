import express from "express";
import { OpenAI } from "openai";
import pool from "../config/db.js";
import "dotenv/config";

const router = express.Router();
const client = new OpenAI({ apiKey: process.env.OPEN_API_KEY });

// Generates a personalised hint for a question based on the user's mastery and attempt history
router.post("/ask", async (req, res) => {
  try {
    const { questionId, userId, studentAttempt, previousHintsThisQuestion } = req.body;

    const questionQuery = await pool.query(`
      SELECT
        q.question_text,
        q.elo_rating,
        q.total_marks,
        array_agg(DISTINCT t.topic_name) as topics,
        array_agg(DISTINCT t.topic_code) as topic_codes
      FROM questions q
      LEFT JOIN question_topics qt ON q.questionid = qt.questionid
      LEFT JOIN topics t ON qt.topic_code = t.topic_code
      WHERE q.questionid = $1
      GROUP BY q.questionid
    `, [questionId]);

    if (questionQuery.rows.length === 0) {
      return res.status(404).json({ error: "Question not found" });
    }

    const question = questionQuery.rows[0];

    const masteryQuery = await pool.query(`
      SELECT
        t.topic_name,
        utm.mastery_category,
        utm.recent_accuracy,
        utm.elo_rating
      FROM user_topic_mastery utm
      JOIN topics t ON utm.topicid = t.topicid
      WHERE utm.userid = $1
        AND t.topic_code = ANY($2::text[])
      ORDER BY utm.elo_rating DESC
    `, [userId, question.topic_codes]);

    const previousHintsQuery = await pool.query(`
      SELECT
        uh.hint_text,
        uh.helpful,
        q.elo_rating,
        array_agg(DISTINCT t.topic_name) as hint_topics
      FROM user_hints uh
      JOIN questions q ON uh.questionid = q.questionid
      JOIN question_topics qt ON q.questionid = qt.questionid
      JOIN topics t ON qt.topic_code = t.topic_code
      WHERE uh.userid = $1
        AND qt.topic_code = ANY($2::text[])
        AND uh.helpful = 3
      GROUP BY uh.hintid, uh.hint_text, uh.helpful, q.elo_rating
      ORDER BY uh.created_at DESC
      LIMIT 3
    `, [userId, question.topic_codes]);

    const userProfile = buildUserProfile(masteryQuery.rows, previousHintsQuery.rows);

    const prompt = buildHintPrompt({
      question: question.question_text,
      eloRating: question.elo_rating,
      totalMarks: question.total_marks,
      topics: question.topics,
      studentAttempt: studentAttempt || null,
      previousHintsThisQuestion: previousHintsThisQuestion || [],
      userProfile
    });

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 150
    });

    const hintText = response.choices[0].message.content;

    const insertResult = await pool.query(`
      INSERT INTO user_hints (userid, questionid, hint_text, helpful)
      VALUES ($1, $2, $3, 2)
      RETURNING hintid
    `, [userId, questionId, hintText]);

    res.json({
      hint: hintText,
      hintId: insertResult.rows[0].hintid,
      topics: question.topics
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate hint" });
  }
});

function buildUserProfile(mastery, previousHints) {
  const avgElo = mastery.length > 0
    ? mastery.reduce((sum, m) => sum + parseFloat(m.elo_rating), 0) / mastery.length
    : 1400;

  let skillLevel = "intermediate";
  if (avgElo < 1300) skillLevel = "beginner";
  else if (avgElo > 1600) skillLevel = "advanced";

  const weakTopics = mastery
    .filter(m => m.mastery_category === "Developing" || (m.recent_accuracy && m.recent_accuracy < 0.5))
    .map(m => m.topic_name)
    .filter(t => t);

  const hintPatterns = analyzeHintPatterns(previousHints);

  return {
    skillLevel,
    weakTopics: weakTopics.slice(0, 2),
    preferredStyle: hintPatterns.preferredStyle,
    avgLength: hintPatterns.avgLength
  };
}

function analyzeHintPatterns(hints) {
  if (hints.length === 0) {
    return { preferredStyle: "step-by-step guidance", avgLength: 50 };
  }

  const avgLength = hints.reduce((sum, h) => sum + (h.hint_text?.length || 0), 0) / hints.length;
  const hasQuestions = hints.some(h => h.hint_text && h.hint_text.includes("?"));
  const hasSteps = hints.some(h => h.hint_text && /first|then|next|finally/i.test(h.hint_text));

  let preferredStyle = "direct guidance";
  if (hasQuestions) preferredStyle = "Socratic questions";
  else if (hasSteps) preferredStyle = "step-by-step breakdown";

  return { preferredStyle, avgLength: Math.round(avgLength) };
}

function buildHintPrompt(params) {
  const {
    question,
    eloRating,
    totalMarks,
    topics,
    studentAttempt,
    previousHintsThisQuestion,
    userProfile
  } = params;

  let difficultyLabel = "medium";
  if (eloRating < 1300) difficultyLabel = "easy";
  else if (eloRating > 1700) difficultyLabel = "hard";

  let prompt = `You are a maths tutor. Provide ONE concise hint (2-3 sentences) in clear, understandable language to help a student solve the following question.

  QUESTION: ${question}
  TOPICS: ${topics.filter(t => t).join(", ")}
  DIFFICULTY: ${difficultyLabel} (Elo: ${eloRating}, ${totalMarks} marks)`;

    if (studentAttempt) {
      prompt += `\nSTUDENT ATTEMPT: ${studentAttempt}`;
    }

    if (previousHintsThisQuestion.length > 0) {
      prompt += `\nPREVIOUS HINTS THIS SESSION: ${previousHintsThisQuestion.slice(-2).join(" | ")}`;
    }

    prompt += `\n\nSTUDENT PROFILE:
  - Level: ${userProfile.skillLevel}`;

    if (userProfile.weakTopics.length > 0) {
      prompt += `\n- Struggles with: ${userProfile.weakTopics.join(", ")}`;
    }

    prompt += `\n- Prefers: ${userProfile.preferredStyle}`;

    prompt += `\n\nLATEX FORMATTING RULES:
  - Use LaTeX for ALL mathematical expressions
  - Wrap LaTeX in single dollar signs: $expression$
  - Use proper LaTeX syntax with backslashes and braces
  - Examples of correct formatting:
    * Fractions: $\\frac{2x^{\\frac{3}{2}}}{3}$
    * Powers: $x^{\\frac{1}{2}}$ or $x^2$
    * Integrals: $\\int x^2 dx$
    * Greek letters: $\\alpha$, $\\beta$, $\\theta$
    * Equations: $y = mx + c$
  - NEVER use plain text for maths (no "x^2" or "1/2" or "sqrt(x)")
  - ALL numbers, variables and operations in mathematical context MUST be in LaTeX

  HINT RULES:
  1. ${previousHintsThisQuestion.length === 0 ? "Give a strategic first hint about the METHOD needed" : "Build on previous hints - be more specific"}
  2. ${studentAttempt ? "Address their attempt directly" : "Suggest where to start"}
  3. NEVER give the final answer or complete solution
  4. Use clear, simple language for explanations, suitable for an A level student
  5. Keep it encouraging and motivating
  6. Be concise and to the point
  7. Match their math level (${userProfile.skillLevel})
  8. Keep to approximately ${userProfile.avgLength} characters
  9. All mathematical notation MUST be properly formatted in LaTeX with $ delimiters

  Respond with ONLY the hint text.`;

  return prompt;
}

// Updates the helpfulness rating for a previously generated hint
router.post("/rate", async (req, res) => {
  try {
    const { hintId, helpful } = req.body;

    if (![1, 2, 3].includes(helpful)) {
      return res.status(400).json({ error: "Invalid helpful value. Must be 1, 2, or 3" });
    }

    await pool.query(`
      UPDATE user_hints SET helpful = $1 WHERE hintid = $2
    `, [helpful, hintId]);

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to rate hint" });
  }
});

export default router;