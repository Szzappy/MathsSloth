import pkg from "pg";
import dotenv from "dotenv/config";

const { Pool } = pkg;

// Connect to your Neon/Postgres database
const pool = new Pool({
  connectionString: process.env.DATABASE_DEV_URL,
});

async function seed() {
  try {
    const questionsToInsert = [
      {
      "topic": ["A11.2"], // Integration
      "question_text": "Find $\\int \\frac{x^{\\frac{1}{2}}(2x - 5)}{3} dx$ writing each term in simplest form.",
      "image_url": "https://maths-sloth.s3.eu-north-1.amazonaws.com/2023_Q8.png",
      "format": "self_mark",
      "answer": null,
      "difficulty": 20,
      "marks": 4,
      "mark_scheme_items": [
        {
        "item_order": 1,
        "item_description": "M1: Attempts to multiply out the brackets of the numerator and writes the expression as a sum of terms with indices. Award for either one correct index of $x^{\\frac{3}{2}}$ or $x^{\\frac{1}{2}}$ which comes from a correct method. The $\\frac{1}{3}$ does not need to be considered for this mark.",
        "marks_available": 1,
        "item_type": "M",
        "is_mandatory": true
        },
        {
        "item_order": 2,
        "item_description": "A1: $\\frac{2x^{\\frac{3}{2}}}{3} - \\frac{5x^{\\frac{1}{2}}}{3}$ or equivalent. Coefficients must be exact. May be implied by further work.",
        "marks_available": 1,
        "item_type": "A",
        "is_mandatory": false
        },
        {
        "item_order": 3,
        "item_description": "dM1: Increases the power by one on an $x^n$ term where n is a fraction (e.g. $x^{\\frac{3}{2}} \\rightarrow x^{\\frac{3}{2}+1}$ or $x^{\\frac{1}{2}} \\rightarrow x^{\\frac{1}{2}+1}$). The index does not need to be processed. Dependent on the previous method mark.",
        "marks_available": 1,
        "item_type": "M",
        "is_mandatory": true
        },
        {
        "item_order": 4,
        "item_description": "A1: $\\frac{4x^{\\frac{5}{2}}}{15} - \\frac{10x^{\\frac{3}{2}}}{9} + c$ and including the constant. Fractions must be in their lowest terms and indices processed. Isw once correct answer is seen.",
        "marks_available": 1,
        "item_type": "A",
        "is_mandatory": false
        }
      ]
      },
      {
      "topic": ["A01.1"], // Proof
      "question_text": "Prove, using algebra, that $(n + 1)^3 - n^3$ is odd for all $n \\in \\mathbb{Z}$",
      "image_url": null,
      "format": "self_mark",
      "answer": null,
      "difficulty": 45,
      "marks": 4,
      "mark_scheme_items": [
        {
        "item_order": 1,
        "item_description": "M1: Attempts to find $(n+1)^3 - n^3$ when $n = 2k$ or $n = 2k \\pm 1$ and attempts to multiply out and simplify to achieve a three term quadratic (allow equivalent representation of odd or even e.g. $n = 2k + 2$ or $n = 2k \\pm 5$). Condone arithmetical slips.",
        "marks_available": 1,
        "item_type": "M",
        "is_mandatory": false
        },
        {
        "item_order": 2,
        "item_description": "A1: Complete argument for $n = 2k$ OR $n = 2k + 1$ (or $n = 2k - 1$) showing the result is odd. Requires: correct simplified quadratic expression (e.g. $12k^2 + 6k + 1$ when $n=2k$, or $12k^2 + 18k + 7$ when $n=2k+1$), a reason why the expression is odd (e.g. factorised as $2(\\text{integer}) + 1$), and concludes 'odd'.",
        "marks_available": 1,
        "item_type": "A",
        "is_mandatory": false
        },
        {
        "item_order": 3,
        "item_description": "dM1: Attempts to find $(n+1)^3 - n^3$ when $n = 2k$ AND $n = 2k \\pm 1$ and attempts to multiply out and simplify to achieve a three term quadratic for BOTH cases. Condone arithmetical slips. Dependent on first M mark.",
        "marks_available": 1,
        "item_type": "M",
        "is_mandatory": false
        },
        {
        "item_order": 4,
        "item_description": "A1*: Complete argument for both $n = 2k$ and $n = 2k + 1$ (or $n = 2k - 1$) showing the result is odd for all $n \\in \\mathbb{Z}$. Requires: correct simplified expressions for both odd and even, a reason why both expressions are odd, and an overall conclusion 'Hence odd for all $n \\in \\mathbb{Z}$' (accept 'hence proven', 'statement proved', 'QED').",
        "marks_available": 1,
        "item_type": "A",
        "is_mandatory": false
        }
      ]
      }
    ];

    await pool.query('DELETE FROM mark_scheme_items');
    await pool.query('DELETE FROM question_topics');
    await pool.query('DELETE FROM questions');

    for (const q of questionsToInsert) {
      // Insert question
      const questionResult = await pool.query(
        `INSERT INTO questions (question_text, image_url, question_format, correct_answer, answer_options, explanation, difficulty, total_marks)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING questionid`,
        [q.question_text, q.image_url, q.format, q.answer, null, null, q.difficulty, q.marks]
      );
      
      const questionid = questionResult.rows[0].questionid;
      
      // Insert mark scheme items
      for (const item of q.mark_scheme_items) {
        await pool.query(
          `INSERT INTO mark_scheme_items (questionid, item_order, item_description, marks_available, item_type, is_mandatory)
            VALUES ($1, $2, $3, $4, $5, $6)`,
          [questionid, item.item_order, item.item_description, item.marks_available, item.item_type, item.is_mandatory]
        );
      }
      
      // Insert topics
      for (const topic of q.topic) {
        // Assuming topics already exist in database
        await pool.query(
          `INSERT INTO question_topics (questionid, topic_code) VALUES ($1, $2)`,
          [questionid, topic]
        );
      }
    }

    console.log("✅ Seeding complete!");
  } catch (err) {
    console.error("❌ Error seeding database:", err);
  } finally {
    await pool.end();
  }
}

seed();
