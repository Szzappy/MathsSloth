import pkg from "pg";
import dotenv from "dotenv/config";

const { Pool } = pkg;

// Connect to your Neon/Postgres database
const pool = new Pool({
  connectionString: process.env.DATABASE_DEV_URL,
});

async function seed() {
  try {
    // Placeholder questions array — add your own later
    const questions = [
      /*
      {
        topic: 1, // must match a topicid in your topics table
        text: "Your question text here",
        image: "https://example.com/diagram.png", // or null if no image
        format: "short_answer", // or "multiple_choice", etc.
        answer: "Correct answer here",
        difficulty: 50, // integer between 1 and 100
      },
      */
     {
        "topic": null,
        "question_text": "Find $\\int \\frac{x^2 (2x - 5)}{3} dx$ writing each term in simplest form.",
        "image_url": null,
        "format": "long_answer",
        "answer": null,
        "difficulty": 20,
        "marks": 4
      }
    ];

    // Insert questions
    for (const q of questions) {
      await pool.query(
        `INSERT INTO questions
          (topic, question_text, image_url, format, answer, difficulty, marks)
         VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [q.topic, q.question_text, q.image, q.format, q.answer, q.difficulty, q.marks]
      );
    }

    console.log("✅ Seeding complete!");
  } catch (err) {
    console.error("❌ Error seeding database:", err);
  } finally {
    await pool.end();
  }
}

seed();
