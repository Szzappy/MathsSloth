import { useState } from "react";

function GptInput() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const handleOpenAISubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAnswer("");

    try {
      const res = await fetch("http://localhost:4000/api/openai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }) // req.body
      });

      const data = await res.json();
      setAnswer(data.answer || "No answer returned.")
    } catch (error) {
      console.error(error);
      setAnswer("Error retrieving answer")
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", textAlign: "center" }}>
      <h1>Ask gpt-4o-mini</h1>
      <form onSubmit={handleOpenAISubmit}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type your question"
          style={{ width: "80%", padding: "0.5rem"}}
          required
          />
          <button type="submit" style={{marginLeft: "1rem", padding: "0.5rem 1rem" }}>
            Submit
          </button>
      </form>

      <p style={{marginTop: "2rem"}}>
        {loading ? "loading..." : answer}
      </p>
    </div>
  )
}

export default GptInput;