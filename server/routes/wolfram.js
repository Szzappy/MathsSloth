import express from "express"; // Remove response import
import axios from "axios";
import 'dotenv/config';

const router = express.Router();

router.post("/ask", async (req, res) => {
  const { question } = req.body;
  
  // Add validation
  if (!question) {
    return res.status(400).json({ error: "Question is required" });
  }

  try {
    const wolframResponse = await axios.get("https://api.wolframalpha.com/v2/query", {
      params: {
        input: question,
        appid: process.env.WOLFRAM_APP_ID,
        output: "json",
        format: "plaintext"
      }
    });

    // Extract the data from Wolfram Alpha response
    const data = wolframResponse.data;
    
    // Format the response for your frontend
    if (data.queryresult && data.queryresult.success) {
      // Extract pods (results) from Wolfram Alpha
      const pods = data.queryresult.pods || [];
      
      // Format the answer
      let answer = "";

      /*for (const i = 0; i < 2; i ++) {
        console.log(pods[i].subpods[0].plaintext)
      }*/

      answer = pods[0].subpods[0].plaintext;
      
      // Look for the primary result
      /*const primaryPod = pods.find(pod => pod.primary === true);
      if (primaryPod && primaryPod.subpods && primaryPod.subpods[0]) {
        answer = primaryPod.subpods[0].plaintext;
      } else if (pods.length > 1 && pods[1].subpods && pods[1].subpods[0]) {
        // If no primary, use the second pod (first is usually the input interpretation)
        answer = pods[1].subpods[0].plaintext;
      } else {
        answer = "No clear answer found";
      }*/

      res.json({ 
        answer: answer,
        success: true 
      });
      
    } else {
      res.json({ 
        answer: "Sorry, I couldn't find an answer to that question.",
        success: false 
      });
    }

  } catch (error) {
    console.error("Wolfram Alpha API Error:", error);
    res.status(500).json({ 
      error: "Server problem",
      success: false 
    });
  }
});

export default router;