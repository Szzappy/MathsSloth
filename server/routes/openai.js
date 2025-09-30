import express from "express";
import { OpenAI } from "openai";
import 'dotenv/config'; // reads .env file

const router = express.Router();
const client = new OpenAI({apiKey: process.env.OPEN_API_KEY});

router.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: question }]
    });


    console.log(`answer: ${response}`)
    res.json({ answer: response.choices[0].message.content })
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Something went wrong"});
  }
})

export default router;