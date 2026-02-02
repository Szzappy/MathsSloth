import { useState, useEffect } from "react";
import { useQuiz } from "../contexts/QuizContext";
import { useAuth } from "../contexts/AuthContext";

function GptInput() {
  const [studentAttempt, setStudentAttempt] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [hintId, setHintId] = useState(null);
  const [previousHints, setPreviousHints] = useState([]);
  
  const { quiz, currentQuestion, renderQuestionWithMaths } = useQuiz(); // ✅ Added renderQuestionWithMaths
  const { userid } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL;

  const currentQ = quiz[currentQuestion - 1];

  // ✅ Reset hints when question changes
  useEffect(() => {
    setPreviousHints([]);
    setStudentAttempt("");
    setHint("");
    setHintId(null);
  }, [currentQuestion]);

  const handleHintRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setHint("");
    
    try {
      const res = await fetch(`${API_URL}/api/openai/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          questionId: currentQ.questionid,
          userId: userid,
          studentAttempt: studentAttempt || null,
          previousHintsThisQuestion: previousHints
        })
      });
      
      const data = await res.json();
      
      if (data.hint) {
        setHint(data.hint);
        setHintId(data.hintId);
        setPreviousHints([...previousHints, data.hint]);
      } else {
        setHint("No hint available.");
      }
    } catch (error) {
      console.error(error);
      setHint("Error retrieving hint");
    } finally {
      setLoading(false);
    }
  };

  const handleRating = async (helpful) => {
    if (!hintId) return;
    
    try {
      await fetch(`${API_URL}/api/openai/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          hintId: hintId,
          helpful: helpful // 1 = not helpful, 3 = helpful
        })
      });
      
      // Clear current hint after rating
      setHint("");
      setHintId(null);
    } catch (error) {
      console.error("Error rating hint:", error);
    }
  };

  if (!currentQ) {
    return <div>Loading question...</div>;
  }

  return (
    <div style={{ maxWidth: 600, margin: "2rem auto", padding: "1rem", border: "1px solid #ddd", borderRadius: "8px" }}>
      <h2>🦥 Need a hint?</h2>
      <p style={{ fontSize: "0.9rem", color: "#666" }}>
        Stuck on this question? Tell Slothrates what you've tried and get a helpful hint!
      </p>
      
      <form onSubmit={handleHintRequest}>
        <textarea
          value={studentAttempt}
          onChange={(e) => setStudentAttempt(e.target.value)}
          placeholder="What have you tried so far? (optional - helps us give better hints!)"
          style={{ 
            width: "100%", 
            padding: "0.75rem",
            minHeight: "80px",
            marginBottom: "1rem",
            borderRadius: "4px",
            border: "1px solid #ccc"
          }}
        />
        
        <button 
          type="submit" 
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.75rem 1rem",
            backgroundColor: loading ? "#ccc" : "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "1rem",
            fontWeight: "bold"
          }}
        >
          {loading ? "Getting hint..." : previousHints.length > 0 ? "Get another hint" : "Get a hint"}
        </button>
      </form>

      {hint && (
        <div style={{ 
          marginTop: "1.5rem", 
          padding: "1rem", 
          backgroundColor: "#f0f8ff",
          borderRadius: "8px",
          border: "1px solid #b3d9ff"
        }}>
          <h3 style={{ marginTop: 0, color: "#0066cc" }}>💡 Hint:</h3>
          <p style={{ fontSize: "1rem", lineHeight: "1.6" }}>
            {renderQuestionWithMaths(hint)} {/* ✅ Render with LaTeX support */}
          </p>
          
          <div style={{ marginTop: "1rem", borderTop: "1px solid #ccc", paddingTop: "1rem" }}>
            <p style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Was this hint helpful?</p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button 
                onClick={() => handleRating(3)}
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                👍 Yes
              </button>
              <button 
                onClick={() => handleRating(1)}
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  backgroundColor: "#f44336",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                👎 No
              </button>
            </div>
          </div>
        </div>
      )}

      {previousHints.length > 0 && (
        <p style={{ 
          marginTop: "1rem", 
          fontSize: "0.85rem", 
          color: "#666",
          textAlign: "center"
        }}>
          Hints received: {previousHints.length}
        </p>
      )}
    </div>
  );
}

export default GptInput;