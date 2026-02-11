import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import QuestionCard from '../components/QuestionCard';
import { useQuiz } from '../contexts/QuizContext.jsx';
import AnswerCard from '../components/AnswerCard.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import GptInput from '../components/GptInput.jsx';

function Quiz() {
  const API_URL = import.meta.env.VITE_API_URL;
  const quizLoadedRef = useRef(false);
  const navigate = useNavigate();
  const { userid } = useAuth();
  const { quiz, currentQuestion, getQuizData, showAnswerCard, continueQuiz, loading } = useQuiz();

  useEffect(() => {
    document.title = "Quiz - Maths Sloth";
    
    if (!userid || loading) return;
    
    const checkOngoingQuiz = async () => {
      const ongoing = await continueQuiz(userid);
      
      if (quizLoadedRef.current) return;
      quizLoadedRef.current = true;
      
      if (!ongoing) {
        getQuizData();
        console.log("new quiz fetched");
      }
    };
    
    checkOngoingQuiz();
  }, [userid, loading]);

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#1a1a1a',
      padding: '2rem'
    }}>
      <div style={{ 
        maxWidth: '900px', 
        margin: '0 auto'
      }}>
        {quiz.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem',
            backgroundColor: '#2d2d2d',
            borderRadius: '12px',
            border: '1px solid #404040'
          }}>
            <div style={{
              fontSize: '48px',
              marginBottom: '16px',
              animation: 'spin 2s linear infinite'
            }}>
              ⏳
            </div>
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
            <p style={{ 
              color: '#d1d5db',
              fontSize: '18px',
              margin: 0
            }}>
              Loading your quiz...
            </p>
          </div>
        ) : (
          (() => {
            const q = quiz[currentQuestion - 1];
            if (!q) {
              navigate('/quiz-completed');
              return null;
            }
            return (
              <div>
                {/* Question Section */}
                <QuestionCard
                  key={q.questionid}
                  questionIndex={currentQuestion}
                  question={q}
                />

                {/* Answer Card (shown after submission) */}
                {showAnswerCard && <AnswerCard />}

                {/* Hint Section - only show before answer is revealed */}
                {!showAnswerCard && (
                  <div style={{ marginTop: '2rem' }}>
                    <GptInput />
                  </div>
                )}

                {/* Progress indicator */}
                <div style={{ 
                  marginTop: '2rem',
                  padding: '16px',
                  backgroundColor: '#2d2d2d',
                  border: '1px solid #404040',
                  borderRadius: '8px',
                  textAlign: 'center',
                  fontSize: '14px',
                  color: '#9ca3af'
                }}>
                  Question {currentQuestion} of {quiz.length}
                  <div style={{
                    marginTop: '12px',
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#404040',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${(currentQuestion / quiz.length) * 100}%`,
                      height: '100%',
                      backgroundColor: '#10b981',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}

export default Quiz;