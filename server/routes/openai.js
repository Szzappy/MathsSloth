import express from "express";
import { OpenAI } from "openai";
import pool from "../config/db.js";
import "dotenv/config";

const router = express.Router();
const client = new OpenAI({ apiKey: process.env.OPEN_API_KEY });

// =====================================================================================
//                           HINT GENERATION
// =====================================================================================

router.post("/ask", async (req, res) => {
  try {
    console.log("Received hint request:", req.body);
    const { questionId, userId, studentAttempt, previousHintsThisQuestion } = req.body;

    // 1. Get question details and topics
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

    // 2. Get user's mastery level for these topics
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

    // 3. Get user's previous helpful hints for similar topics
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

    // 4. Build user profile
    const userProfile = buildUserProfile(masteryQuery.rows, previousHintsQuery.rows);

    // 5. Generate hint
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

    // 6. Store hint in database
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
  const { question, eloRating, totalMarks, topics, studentAttempt, previousHintsThisQuestion, userProfile } = params;

  // Convert Elo to a human-readable difficulty label for the prompt
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
- ALL numbers, variables, and operations in mathematical context MUST be in LaTeX

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

  console.log(prompt);
  return prompt;
}

// =====================================================================================
//                           RATE HINT
// =====================================================================================

router.post("/rate", async (req, res) => {
  try {
    const { hintId, helpful } = req.body; // 1 = not helpful, 2 = neutral, 3 = helpful

    if (![1, 2, 3].includes(helpful)) {
      return res.status(400).json({ error: "Invalid helpful value. Must be 1, 2, or 3" });
    }

    await pool.query(`
      UPDATE user_hints
      SET helpful = $1
      WHERE hintid = $2
    `, [helpful, hintId]);

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to rate hint" });
  }
});

// =====================================================================================
//                           FEYNMAN ANSWER GRADING
//                           Called after the student submits a feynman answer.
//                           Grades against the rubric using GPT-4o-mini,
//                           calibrated by previous students' graded attempts.
// =====================================================================================

router.post("/grade-feynman", async (req, res) => {
  try {
    console.log("Grading feynman answer:", req.body);
    const { attemptId, userId, questionId } = req.body;

    // 1. Fetch the attempt and its question together
    const attemptQuery = await pool.query(`
      SELECT
        qa.attemptid,
        qa.user_answer,
        qa.marks_available,
        qa.grading_status,
        q.question_text,
        q.explanation AS rubric,
        q.total_marks,
        array_agg(DISTINCT t.topic_name) AS topics
      FROM question_attempts qa
      JOIN questions q ON qa.questionid = q.questionid
      LEFT JOIN question_topics qt ON q.questionid = qt.questionid
      LEFT JOIN topics t ON qt.topic_code = t.topic_code
      WHERE qa.attemptid = $1
        AND qa.userid = $2
        AND qa.questionid = $3
        AND q.question_format = 'feynman'
      GROUP BY
        qa.attemptid, qa.user_answer, qa.marks_available, qa.grading_status,
        q.question_text, q.explanation, q.total_marks
    `, [attemptId, userId, questionId]);

    if (attemptQuery.rows.length === 0) {
      return res.status(404).json({ error: "Attempt not found" });
    }

    const attempt = attemptQuery.rows[0];

    if (attempt.grading_status !== "pending") {
      return res.status(400).json({ error: "This attempt has already been graded" });
    }

    // 2. Fetch recent graded attempts from OTHER students on the same question
    //    Used to calibrate the model's sense of what earns what mark
    const previousAttemptsQuery = await pool.query(`
      SELECT
        qa.user_answer,
        qa.marks_awarded,
        qa.marks_available
      FROM question_attempts qa
      WHERE qa.questionid = $1
        AND qa.userid != $2
        AND qa.grading_status = 'graded'
        AND qa.marks_awarded IS NOT NULL
        AND qa.user_answer IS NOT NULL
      ORDER BY qa.attempted_at DESC
      LIMIT 5
    `, [questionId, userId]);

    const previousAttempts = previousAttemptsQuery.rows;

    // 3. Build grading prompt
    const prompt = buildFeynmanGradingPrompt({
      questionText: attempt.question_text,
      rubric: attempt.rubric,
      totalMarks: attempt.total_marks,
      topics: attempt.topics.filter(Boolean),
      studentAnswer: attempt.user_answer,
      previousAttempts
    });

    // 4. Call GPT-4o-mini with low temperature for consistent grading
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 300
    });

    const rawResponse = response.choices[0].message.content.trim();
    console.log("GPT grading response:", rawResponse);

    // 5. Parse structured response
    const gradingResult = parseGradingResponse(rawResponse, attempt.total_marks);

    if (!gradingResult) {
      console.error("Failed to parse grading response:", rawResponse);
      await pool.query(`
        UPDATE question_attempts SET grading_status = 'failed'
        WHERE attemptid = $1
      `, [attemptId]);
      return res.status(500).json({ error: "Failed to parse grading response" });
    }

    // 6. Update the attempt with awarded marks
    await pool.query(`
      UPDATE question_attempts
      SET
        marks_awarded = $1,
        grading_status = 'graded',
        is_correct = ($1 = marks_available)
      WHERE attemptid = $2
    `, [gradingResult.marksAwarded, attemptId]);

    console.log(`Feynman attempt ${attemptId} graded: ${gradingResult.marksAwarded}/${attempt.total_marks}`);

    res.status(200).json({
      marks_awarded: gradingResult.marksAwarded,
      marks_available: attempt.total_marks,
      feedback: gradingResult.feedback,
      grading_status: "graded"
    });

  } catch (error) {
    console.error("Error grading feynman answer:", error);
    res.status(500).json({ error: "Failed to grade feynman answer" });
  }
});

// =====================================================================================
//                           FEYNMAN PROMPT BUILDER
// =====================================================================================

function buildFeynmanGradingPrompt({ questionText, rubric, totalMarks, topics, studentAnswer, previousAttempts }) {
  let prompt = `You are a curious student who has just read another student's explanation of a maths concept. You want to understand if they really get it — not just if they said the right words, but whether their reasoning actually makes sense.

Your job is to award marks based on how well they've explained their understanding, using the mark scheme below.

QUESTION: ${questionText}
TOPICS: ${topics.join(", ")}
TOTAL MARKS AVAILABLE: ${totalMarks}

MARK SCHEME (use this to decide how many marks to award):
${rubric}`;

  if (previousAttempts.length > 0) {
    prompt += `\n\nHERE ARE SOME EXAMPLES OF HOW OTHER STUDENTS ANSWERED THIS QUESTION AND WHAT MARKS THEY GOT — use these to calibrate your grading:`;

    previousAttempts.forEach((prev, i) => {
      prompt += `\n\nExample ${i + 1} (awarded ${prev.marks_awarded}/${prev.marks_available} marks):
"${prev.user_answer}"`;
    });
  }

  prompt += `\n\nTHE STUDENT'S ANSWER YOU ARE EVALUATING:
"${studentAnswer}"

As a fellow student reading this, ask yourself:
- Did they explain the key idea clearly enough that YOU could understand it?
- Did they hit the points in the mark scheme?
- Is their reasoning correct, or are there gaps or misconceptions?
- Would you feel confident if you heard this explanation from a classmate?

GRADING RULES:
1. Award marks strictly according to the mark scheme above
2. Do NOT give marks for correct answers that lack explanation
3. Do NOT deduct marks for imperfect phrasing if the core idea is correct
4. Be consistent with the example answers above if provided
5. NEVER award more than ${totalMarks} marks

Respond in EXACTLY this format (nothing else):
MARKS: [number]
FEEDBACK: [1-2 sentences of honest, constructive feedback as if you're a fellow student giving peer feedback]`;

  return prompt;
}

// =====================================================================================
//                           FEYNMAN RESPONSE PARSER
// =====================================================================================

function parseGradingResponse(rawResponse, totalMarks) {
  try {
    const marksMatch = rawResponse.match(/MARKS:\s*(\d+)/i);
    const feedbackMatch = rawResponse.match(/FEEDBACK:\s*(.+)/is);

    if (!marksMatch) return null;

    const marksAwarded = Math.min(
      parseInt(marksMatch[1]),
      totalMarks   // Hard cap — never exceed available marks even if model hallucinates
    );

    const feedback = feedbackMatch
      ? feedbackMatch[1].trim()
      : "Your answer has been graded.";

    return { marksAwarded, feedback };
  } catch (err) {
    console.error("Error parsing grading response:", err);
    return null;
  }
}

export default router;