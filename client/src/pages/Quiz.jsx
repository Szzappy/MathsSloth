import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      {quiz.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>Loading your quiz...</p>
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

              {/* Optional: Progress indicator */}
              <div style={{ 
                marginTop: '2rem', 
                textAlign: 'center', 
                fontSize: '0.9rem', 
                color: '#666' 
              }}>
                Question {currentQuestion} of {quiz.length}
              </div>
            </div>
          );
        })()
      )}
    </div>
  )
}

export default Quiz;