import { useState, useEffect } from "react";
import { useQuiz } from "../contexts/QuizContext";
import { useAuth } from "../contexts/AuthContext";

function GptInput() {
  const [studentAttempt, setStudentAttempt] = useState("");
  const [loading, setLoading] = useState(false);
  const [hints, setHints] = useState([]); // { text, hintId, rating: null | 1 | 3 }

  const { currentQuestion, getActiveQuestion, renderQuestionWithMaths } = useQuiz();
  const { userid } = useAuth();
  const API_URL = import.meta.env.VITE_API_URL;

  const activeQuestion = getActiveQuestion();

  // Reset when question changes
  useEffect(() => {
    setHints([]);
    setStudentAttempt("");
  }, [currentQuestion]);

  const handleHintRequest = async (e) => {
    e.preventDefault();
    if (!activeQuestion) return;
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/openai/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: activeQuestion.questionid,
          userId: userid,
          studentAttempt: studentAttempt || null,
          previousHintsThisQuestion: hints.map(h => h.text),
        }),
      });

      const data = await res.json();

      if (data.hint) {
        setHints(prev => [...prev, { text: data.hint, hintId: data.hintId, rating: null }]);
      } else {
        setHints(prev => [...prev, { text: "No hint available.", hintId: null, rating: null }]);
      }
    } catch (error) {
      console.error(error);
      setHints(prev => [...prev, { text: "Error retrieving hint.", hintId: null, rating: null }]);
    } finally {
      setLoading(false);
    }
  };

  const handleRating = async (index, helpful) => {
    const hint = hints[index];
    if (!hint?.hintId) return;

    // Update immediately - hint stays visible
    setHints(prev => prev.map((h, i) => i === index ? { ...h, rating: helpful } : h));

    try {
      await fetch(`${API_URL}/api/openai/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hintId: hint.hintId, helpful }),
      });
    } catch (error) {
      console.error("Error rating hint:", error);
    }
  };

  if (!activeQuestion) return null;

  return (
    <div style={{
      backgroundColor: '#2d2d2d',
      border: '1px solid #404040',
      borderRadius: '12px',
      padding: '24px',
    }}>

      {/* Header - orange to distinguish from other components */}
      <h3 style={{
        color: '#f97316',
        fontSize: '20px',
        fontWeight: '600',
        marginTop: 0,
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        🦥 Need a hint?
      </h3>
      <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '20px', marginTop: 0 }}>
        Stuck on this question? Tell Slothrates what you've tried and get a helpful hint!
      </p>

      {/* Previous hints - persist after rating */}
      {hints.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
          {hints.map((hint, i) => (
            <div key={i} style={{
              backgroundColor: '#1a1a1a',
              borderRadius: '8px',
              border: '1px solid #10b981',
              padding: '16px',
            }}>
              <h4 style={{ marginTop: 0, color: '#10b981', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
                💡 Hint {i + 1}:
              </h4>
              <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#d1d5db' }}>
                {renderQuestionWithMaths(hint.text)}
              </div>

              <div style={{ marginTop: '12px', borderTop: '1px solid #404040', paddingTop: '12px' }}>
                {hint.rating === null ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <p style={{ fontSize: '13px', color: '#9ca3af', margin: 0 }}>Was this helpful?</p>
                    <button
                      onClick={() => handleRating(i, 3)}
                      style={{
                        padding: '6px 14px',
                        backgroundColor: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
                    >
                      👍 Yes
                    </button>
                    <button
                      onClick={() => handleRating(i, 1)}
                      style={{
                        padding: '6px 14px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                      onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                    >
                      👎 No
                    </button>
                  </div>
                ) : (
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                    {hint.rating === 3 ? '👍 Marked as helpful' : '👎 Marked as not helpful'}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleHintRequest}>
        <textarea
          value={studentAttempt}
          onChange={(e) => setStudentAttempt(e.target.value)}
          placeholder="What have you tried so far? (optional - helps us give better hints!)"
          style={{
            width: '100%',
            padding: '12px',
            minHeight: '80px',
            marginBottom: '12px',
            borderRadius: '8px',
            border: '1px solid #404040',
            backgroundColor: '#1a1a1a',
            color: '#d1d5db',
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
          }}
          onFocus={(e) => e.target.style.borderColor = '#10b981'}
          onBlur={(e) => e.target.style.borderColor = '#404040'}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 20px',
            backgroundColor: loading ? '#404040' : '#c2611a',
            color: loading ? '#9ca3af' : '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { if (!loading) e.target.style.backgroundColor = '#a84f14'; }}
          onMouseLeave={(e) => { if (!loading) e.target.style.backgroundColor = '#c2611a'; }}
        >
          {loading ? 'Getting hint...' : hints.length > 0 ? 'Get another hint' : '💡 Get a hint'}
        </button>
      </form>

      {hints.length > 0 && (
        <p style={{ marginTop: '12px', fontSize: '13px', color: '#9ca3af', textAlign: 'center', margin: '12px 0 0' }}>
          Hints received: {hints.length}
        </p>
      )}
    </div>
  );
}

export default GptInput;