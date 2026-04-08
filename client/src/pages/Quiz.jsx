import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import QuestionCard from '../components/QuestionCard';
import { useQuiz } from '../contexts/QuizContext.jsx';
import AnswerCard from '../components/AnswerCard.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import GptInput from '../components/GptInput.jsx';

function Quiz() {
  const quizLoadedRef = useRef(false);
  const navigate = useNavigate();
  const { userid } = useAuth();
  const { quiz, currentQuestion, getQuizData, showAnswerCard, continueQuiz, hasParts, currentPart } = useQuiz();

  useEffect(() => {
    document.title = "Quiz - Maths Sloth";
    if (!userid) return;

    const checkOngoingQuiz = async () => {
      const ongoing = await continueQuiz(userid);
      if (quizLoadedRef.current) return;
      quizLoadedRef.current = true;
      if (!ongoing) {
        getQuizData();
        console.log("New quiz fetched");
      }
    };

    checkOngoingQuiz();
  }, [userid]);

  // Scroll to top when advancing to the next question or next part
  // (not when the mark scheme appears - that should stay in place)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentQuestion, currentPart]);

  const topLevelQuestion = quiz[currentQuestion - 1];
  const questionHasParts = hasParts();

  // The active question/part for determining hint visibility etc.
  const activePart = questionHasParts
    ? topLevelQuestion?.parts?.[currentPart]
    : topLevelQuestion;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#1a1a1a',
      padding: '2rem',
    }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>

        {quiz.length === 0 ? (
          // ── Loading state ──
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            backgroundColor: '#2d2d2d',
            borderRadius: '12px',
            border: '1px solid #404040',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', animation: 'spin 2s linear infinite' }}>
              ⏳
            </div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: '#d1d5db', fontSize: '18px', margin: 0 }}>
              Loading your quiz...
            </p>
          </div>

        ) : !topLevelQuestion ? (
          // ── Quiz complete ──
          (() => { navigate('/quiz-completed'); return null; })()

        ) : (
          // ── Active quiz ──
          <div>
            {/* Question card - handles rendering parts internally */}
            <QuestionCard key={`${topLevelQuestion.questionid}-${currentPart}`} />

            {/* Answer card - shown after submission */}
            {showAnswerCard && <AnswerCard />}

            {/* Hints - only before answer is revealed, not for feynman (they're typing an explanation) */}
            {!showAnswerCard && activePart?.question_format !== 'feynman' && (
              <div style={{ marginTop: '2rem' }}>
                <GptInput />
              </div>
            )}

            {/* Progress bar */}
            <div style={{
              marginTop: '2rem',
              padding: '16px',
              backgroundColor: '#2d2d2d',
              border: '1px solid #404040',
              borderRadius: '8px',
              textAlign: 'center',
              fontSize: '14px',
              color: '#9ca3af',
            }}>
              {questionHasParts
                ? `Question ${currentQuestion} of ${quiz.length} - Part ${currentPart + 1} of ${topLevelQuestion.parts.length}`
                : `Question ${currentQuestion} of ${quiz.length}`
              }

              <div style={{
                marginTop: '12px',
                width: '100%',
                height: '8px',
                backgroundColor: '#404040',
                borderRadius: '4px',
                overflow: 'hidden',
              }}>
                {/* Outer bar: overall question progress */}
                <div style={{
                  width: `${(currentQuestion / quiz.length) * 100}%`,
                  height: '100%',
                  backgroundColor: '#1d4e37',
                  transition: 'width 0.3s ease',
                  position: 'relative',
                }}>
                  {/* Inner bar: part progress within current question */}
                  {questionHasParts && (
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      width: `${((currentPart + 1) / topLevelQuestion.parts.length) * 100}%`,
                      height: '100%',
                      backgroundColor: '#10b981',
                      transition: 'width 0.3s ease',
                    }} />
                  )}
                  {!questionHasParts && (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor: '#10b981',
                    }} />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Quiz;