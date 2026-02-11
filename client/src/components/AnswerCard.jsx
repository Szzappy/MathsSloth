import React from 'react';
import { useQuiz } from '../contexts/QuizContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

function AnswerCard() {
  const { quizid, currentQuestion, markScheme, renderQuestionWithMaths, nextQuestion, quiz, confidence, setConfidence } = useQuiz();
  const API_URL = import.meta.env.VITE_API_URL;
  const { user, userid } = useAuth();

  const handleButtonClick = (item) => {
    const button = document.getElementById(`button-${item.mark_scheme_item_id}`);
    button.classList.toggle('active');
    
    button.style.backgroundColor = button.classList.contains('active') 
      ? (item.is_mandatory ? '#7c3aed' : '#10b981') 
      : '';
    button.style.borderColor = button.classList.contains('active')
      ? (item.is_mandatory ? '#7c3aed' : '#10b981')
      : '#404040';
    
    if (button.classList.contains('active')) {
      const mandatoryItems = markScheme.filter(msItem => 
        msItem.is_mandatory && msItem.mark_scheme_item_id < item.mark_scheme_item_id
      );
      
      const allMandatorySelected = mandatoryItems.every(msItem => {
        const msButton = document.getElementById(`button-${msItem.mark_scheme_item_id}`);
        return msButton && msButton.classList.contains('active');
      });
      
      if (!allMandatorySelected) {
        button.classList.remove('active');
        button.style.backgroundColor = '';
        button.style.borderColor = '#404040';
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const selectedItems = markScheme.filter(item => {
      const button = document.getElementById(`button-${item.mark_scheme_item_id}`);
      return button && button.classList.contains('active');
    });
    
    const response = await fetch(`${API_URL}/quiz/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userid: userid,
        questionid: quiz[currentQuestion - 1].questionid,
        quizid: quizid,
        marks_awarded: selectedItems.reduce((acc) => acc + 1, 0),
        marks_available: quiz[currentQuestion - 1].total_marks,
        confidence: confidence,
        time_taken: 0,
        question_difficulty: quiz[currentQuestion - 1].difficulty,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      setConfidence(null);
      console.log("Response from server:", data);
    } else {
      console.error("Error submitting answer:", response.statusText);
    }
    
    nextQuestion();
  };

  return (
    <div style={{
      backgroundColor: '#2d2d2d',
      border: '1px solid #404040',
      borderRadius: '12px',
      padding: '32px',
      marginBottom: '24px'
    }}>
      <h2 style={{
        color: '#10b981',
        fontSize: '24px',
        fontWeight: 'bold',
        marginTop: 0,
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        ✓ Mark Scheme
      </h2>

      {markScheme.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          color: '#9ca3af'
        }}>
          <p>Loading mark scheme...</p>
        </div>
      ) : (
        <>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {markScheme.map((item, index) => (
              <li key={item.mark_scheme_item_id || index}>
                <button 
                  id={`button-${item.mark_scheme_item_id}`}
                  onClick={() => handleButtonClick(item)}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    backgroundColor: '#1a1a1a',
                    border: '2px solid #404040',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    color: '#d1d5db',
                    fontSize: '14px',
                    lineHeight: '1.6'
                  }}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.classList.contains('active')) {
                      e.currentTarget.style.borderColor = '#10b981';
                      e.currentTarget.style.backgroundColor = '#262626';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.classList.contains('active')) {
                      e.currentTarget.style.borderColor = '#404040';
                      e.currentTarget.style.backgroundColor = '#1a1a1a';
                    }
                  }}
                >
                  <div style={{ marginBottom: '8px' }}>
                    <strong style={{ color: '#10b981' }}>Step {index + 1}:</strong>
                    {item.is_mandatory && (
                      <span style={{ 
                        color: '#a855f7',
                        marginLeft: '8px',
                        fontWeight: '600'
                      }}>
                        🔒 Mandatory
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#d1d5db' }}>
                    {renderQuestionWithMaths(item.item_description)}
                  </div>
                  <div style={{ 
                    marginTop: '8px',
                    color: '#9ca3af',
                    fontSize: '12px'
                  }}>
                    <em>({item.marks_available} {item.marks_available === 1 ? 'mark' : 'marks'})</em>
                  </div>
                </button>
              </li>
            ))}
          </ul>

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
            → Next Question
          </button>
        </>
      )}
    </div>
  );
}

export default AnswerCard;