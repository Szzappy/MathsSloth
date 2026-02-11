import React from 'react';
import { useQuiz } from '../contexts/QuizContext.jsx';

function QuestionCard() {
  const { getAnswer, canSubmit, renderQuestionWithMaths, currentQuestion, quiz, setConfidence, confidence, showAnswerCard } = useQuiz();
  
  const handleSubmit = (e) => {
    e.preventDefault();
    getAnswer();
  }
  
  const question = quiz[currentQuestion - 1];

  return (
    <div style={{
      backgroundColor: '#2d2d2d',
      border: '1px solid #404040',
      borderRadius: '12px',
      padding: '32px',
      marginBottom: '24px'
    }}>
      {/* Question Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid #404040'
      }}>
        <h1 style={{
          color: '#10b981',
          fontSize: '24px',
          fontWeight: 'bold',
          margin: 0
        }}>
          Question {question.question_order || currentQuestion}
        </h1>
        <div style={{
          backgroundColor: '#1a1a1a',
          padding: '8px 16px',
          borderRadius: '6px',
          border: '1px solid #404040'
        }}>
          <span style={{ color: '#9ca3af', fontSize: '14px' }}>
            📊 Marks: <strong style={{ color: '#10b981' }}>{question.total_marks}</strong>
          </span>
        </div>
      </div>

      {/* Question Text */}
      <div style={{
        color: '#d1d5db',
        fontSize: '18px',
        lineHeight: '1.8',
        marginBottom: '24px'
      }}>
        {renderQuestionWithMaths(question.question_text)}
      </div>

      {/* Question Image */}
      {question.image_url && (
        <div style={{
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          <img 
            src={question.image_url} 
            alt="Question diagram" 
            style={{ 
              maxWidth: '100%', 
              borderRadius: '8px',
              border: '1px solid #404040'
            }}
          />
        </div>
      )}

      {/* Confidence Section - Only show before submission */}
      {!showAnswerCard && (
        <div style={{
          backgroundColor: '#1a1a1a',
          padding: '24px',
          borderRadius: '8px',
          border: '1px solid #404040',
          marginTop: '24px'
        }}>
          <h3 style={{
            color: '#fff',
            fontSize: '18px',
            fontWeight: '600',
            marginTop: 0,
            marginBottom: '16px'
          }}>
            How confident are you?
          </h3>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {[
              { value: "1", label: "Not Confident", emoji: "😰" },
              { value: "2", label: "Somewhat Confident", emoji: "😕" },
              { value: "3", label: "Neutral", emoji: "😐" },
              { value: "4", label: "Confident", emoji: "😊" },
              { value: "5", label: "Very Confident", emoji: "😎" }
            ].map(({ value, label, emoji }) => (
              <label 
                key={value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 16px',
                  backgroundColor: confidence === value ? '#3b82f6' : '#2d2d2d',
                  border: `2px solid ${confidence === value ? '#3b82f6' : '#404040'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  color: confidence === value ? '#fff' : '#d1d5db'
                }}
                onMouseEnter={(e) => {
                  if (confidence !== value) {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.backgroundColor = '#262626';
                  }
                }}
                onMouseLeave={(e) => {
                  if (confidence !== value) {
                    e.currentTarget.style.borderColor = '#404040';
                    e.currentTarget.style.backgroundColor = '#2d2d2d';
                  }
                }}
              >
                <input 
                  type="radio" 
                  name="confidence" 
                  value={value}
                  checked={confidence === value}
                  onChange={(e) => setConfidence(e.target.value)}
                  style={{
                    marginRight: '12px',
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                    accentColor: '#3b82f6'
                  }}
                />
                <span style={{ fontSize: '20px', marginRight: '12px' }}>{emoji}</span>
                <span style={{ fontWeight: '500' }}>{value} - {label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Submit Button */}
      {canSubmit && (
        <button 
          onClick={handleSubmit}
          style={{
            width: '100%',
            marginTop: '24px',
            padding: '16px 24px',
            backgroundColor: '#10b981',
            color: '#fff',
            fontSize: '16px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 6px rgba(16, 185, 129, 0.3)'
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#059669';
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 6px 12px rgba(16, 185, 129, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = '#10b981';
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 4px 6px rgba(16, 185, 129, 0.3)';
          }}
        >
          {question.question_format === "self_mark" ? "✓ Check Answer" : "→ Submit Answer"}
        </button>
      )}
    </div>
  );
}

export default QuestionCard;