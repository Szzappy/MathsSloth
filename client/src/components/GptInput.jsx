import { useState, useEffect } from "react";
import { useQuiz } from "../contexts/QuizContext";
import { useAuth } from "../contexts/AuthContext";

function GptInput() {
  const [studentAttempt, setStudentAttempt] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [hintId, setHintId] = useState(null);
  const [previousHints, setPreviousHints] = useState([]);
  
  const { quiz, currentQuestion, renderQuestionWithMaths } = useQuiz();
  const { userid } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL;

  const currentQ = quiz[currentQuestion - 1];

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
          helpful: helpful
        })
      });
      
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
    <div style={{
      backgroundColor: '#2d2d2d',
      border: '1px solid #404040',
      borderRadius: '12px',
      padding: '24px'
    }}>
      <h3 style={{
        color: '#10b981',
        fontSize: '20px',
        fontWeight: '600',
        marginTop: 0,
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        🦥 Need a hint?
      </h3>
      <p style={{ 
        fontSize: '14px', 
        color: '#9ca3af',
        marginBottom: '20px'
      }}>
        Stuck on this question? Tell Slothrates what you've tried and get a helpful hint!
      </p>
      
      <form onSubmit={handleHintRequest}>
        <textarea
          value={studentAttempt}
          onChange={(e) => setStudentAttempt(e.target.value)}
          placeholder="What have you tried so far? (optional - helps us give better hints!)"
          style={{ 
            width: '100%', 
            padding: '12px',
            minHeight: '100px',
            marginBottom: '16px',
            borderRadius: '8px',
            border: '1px solid #404040',
            backgroundColor: '#1a1a1a',
            color: '#d1d5db',
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'vertical',
            outline: 'none'
          }}
          onFocus={(e) => e.target.style.borderColor = '#10b981'}
          onBlur={(e) => e.target.style.borderColor = '#404040'}
        />
        
        <button 
          type="submit" 
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px 20px",
            backgroundColor: loading ? '#404040' : '#3b82f6',
            color: loading ? '#9ca3af' : '#fff',
            border: "none",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "14px",
            fontWeight: "600",
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.target.style.backgroundColor = '#2563eb';
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.target.style.backgroundColor = '#3b82f6';
            }
          }}
        >
          {loading ? "Getting hint..." : previousHints.length > 0 ? "Get another hint" : "💡 Get a hint"}
        </button>
      </form>

      {hint && (
        <div style={{ 
          marginTop: '20px', 
          padding: '16px', 
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          border: '1px solid #10b981'
        }}>
          <h4 style={{ 
            marginTop: 0, 
            color: '#10b981',
            fontSize: '16px',
            fontWeight: '600',
            marginBottom: '12px'
          }}>
            💡 Hint:
          </h4>
          <div style={{ 
            fontSize: '14px', 
            lineHeight: '1.6',
            color: '#d1d5db'
          }}>
            {renderQuestionWithMaths(hint)}
          </div>
          
          <div style={{ 
            marginTop: '16px', 
            borderTop: '1px solid #404040', 
            paddingTop: '16px' 
          }}>
            <p style={{ 
              fontSize: '13px', 
              marginBottom: '12px',
              color: '#9ca3af'
            }}>
              Was this hint helpful?
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => handleRating(3)}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
              >
                👍 Yes
              </button>
              <button 
                onClick={() => handleRating(1)}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
              >
                👎 No
              </button>
            </div>
          </div>
        </div>
      )}

      {previousHints.length > 0 && (
        <p style={{ 
          marginTop: '16px', 
          fontSize: '13px', 
          color: '#9ca3af',
          textAlign: 'center'
        }}>
          Hints received: {previousHints.length}
        </p>
      )}
    </div>
  );
}

export default GptInput;