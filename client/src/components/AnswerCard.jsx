import React, { useState } from 'react';
import { useQuiz } from '../contexts/QuizContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

const API_URL = import.meta.env.VITE_API_URL;

const card = {
  backgroundColor: '#2d2d2d',
  border: '1px solid #404040',
  borderRadius: '12px',
  padding: '32px',
  marginBottom: '24px',
};

function NextButton({ onClick, label = '→ Next Question' }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        marginTop: '24px',
        padding: '14px 24px',
        backgroundColor: '#10b981',
        color: '#fff',
        fontSize: '16px',
        fontWeight: '600',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: '0 4px 6px rgba(16, 185, 129, 0.3)',
      }}
      onMouseEnter={(e) => {
        e.target.style.backgroundColor = '#059669';
        e.target.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.target.style.backgroundColor = '#10b981';
        e.target.style.transform = 'translateY(0)';
      }}
    >
      {label}
    </button>
  );
}

// ─── MCQ result ────────────────────────────────────────────────
// BUG FIX: answerResult now stores user_answer directly (not nested under .answer)
// so we check answerResult.user_answer instead of answerResult.answer.user_answer
function MCQResult({ answerResult, quiz, currentQuestion, nextQuestion, hasParts, currentPart }) {
  const { renderQuestionWithMaths, reportSillyMistake } = useQuiz();
  const [sillyDone, setSillyDone] = useState(false);

  const activeQ = hasParts()
    ? quiz[currentQuestion - 1]?.parts[currentPart]
    : quiz[currentQuestion - 1];

  const options = activeQ?.answer_options?.options || [];
  const isLastPart = !hasParts() || currentPart >= (quiz[currentQuestion - 1]?.parts?.length ?? 1) - 1;

  const handleSillyMistake = async () => {
    await reportSillyMistake();
    setSillyDone(true);
  };

  return (
    <div style={card}>
      <h2 style={{ color: answerResult?.is_correct ? '#10b981' : '#ef4444', fontSize: '22px', fontWeight: 'bold', marginTop: 0, marginBottom: '20px' }}>
        {answerResult?.is_correct ? '✅ Correct!' : '❌ Incorrect'}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        {options.map(({ label, text }) => {
          // BUG FIX: use answerResult.user_answer (set directly in submitAnswer)
          // and answerResult.correct_answer (returned from backend)
          const isCorrect = label === answerResult?.correct_answer;
          const wasSelected = label === answerResult?.user_answer;
          const isWrongSelection = wasSelected && !isCorrect;

          let bg = '#1a1a1a', border = '#404040', color = '#9ca3af';
          if (isCorrect) { bg = '#064e3b'; border = '#10b981'; color = '#6ee7b7'; }
          if (isWrongSelection) { bg = '#450a0a'; border = '#ef4444'; color = '#fca5a5'; }

          return (
            <div key={label} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 16px',
              backgroundColor: bg,
              border: `2px solid ${border}`,
              borderRadius: '8px',
              color,
              fontSize: '15px',
            }}>
              <span style={{
                minWidth: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: isCorrect ? '#10b981' : (isWrongSelection ? '#ef4444' : '#333'),
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
                fontSize: '14px',
                flexShrink: 0,
              }}>
                {label}
              </span>
              <span>{text}</span>
              {isCorrect && <span style={{ marginLeft: 'auto', fontSize: '18px' }}>✓</span>}
              {isWrongSelection && <span style={{ marginLeft: 'auto', fontSize: '18px' }}>✗</span>}
            </div>
          );
        })}
      </div>

      <div style={{
        padding: '14px 18px',
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        border: '1px solid #404040',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ color: '#9ca3af', fontSize: '14px' }}>Marks awarded</span>
        <span style={{
          color: answerResult?.is_correct ? '#10b981' : '#ef4444',
          fontWeight: '700',
          fontSize: '18px'
        }}>
          {answerResult?.marks_awarded ?? 0} / {answerResult?.marks_available ?? '?'}
        </span>
      </div>

      {/* Silly mistake button — only shown when wrong */}
      {!answerResult?.is_correct && (
        <div style={{ marginTop: '16px' }}>
          {sillyDone ? (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#1c1a10',
              border: '1px solid #ca8a0444',
              borderRadius: '8px',
              color: '#fbbf24',
              fontSize: '13px',
              textAlign: 'center',
            }}>
              🤦 Noted — ELO impact halved. Don't let it happen again!
            </div>
          ) : (
            <button
              onClick={handleSillyMistake}
              style={{
                width: '100%',
                padding: '11px 16px',
                backgroundColor: 'transparent',
                border: '1px solid #ca8a0466',
                borderRadius: '8px',
                color: '#fbbf24',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1c1a10';
                e.currentTarget.style.borderColor = '#ca8a04';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = '#ca8a0466';
              }}
            >
              🤦 Silly Mistake — I knew this really
            </button>
          )}
        </div>
      )}

      <NextButton
        onClick={nextQuestion}
        label={isLastPart ? '→ Next Question' : '→ Next Part'}
      />
    </div>
  );
}

// ─── Feynman result ────────────────────────────────────────────
function FeynmanResult({ answerResult, gradingStatus, nextQuestion, hasParts, currentPart, quiz, currentQuestion }) {
  const { renderQuestionWithMaths } = useQuiz();
  const isLastPart = !hasParts() || currentPart >= (quiz[currentQuestion - 1]?.parts?.length ?? 1) - 1;

  return (
    <div style={card}>
      <h2 style={{ color: '#8b5cf6', fontSize: '22px', fontWeight: 'bold', marginTop: 0, marginBottom: '20px' }}>
        📝 Feynman Assessment
      </h2>

      {/* Submitted answer — always visible after submission */}
      {answerResult?.user_answer && (
        <div style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #3b2f6e',
          borderRadius: '8px',
          padding: '18px 20px',
          marginBottom: '20px',
        }}>
          <p style={{
            color: '#a78bfa', fontSize: '12px', fontWeight: '700',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            marginBottom: '10px', marginTop: 0,
          }}>
            Your Answer
          </p>
          <p style={{ color: '#d1d5db', fontSize: '15px', lineHeight: '1.7', margin: 0, whiteSpace: 'pre-wrap' }}>
            {answerResult.user_answer}
          </p>
        </div>
      )}

      {/* Rubric — shown immediately while grading runs */}
      {answerResult?.rubric && (
        <div style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #404040',
          borderRadius: '8px',
          padding: '18px 20px',
          marginBottom: '20px',
        }}>
          <p style={{
            color: '#8b5cf6', fontSize: '12px', fontWeight: '700',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            marginBottom: '10px', marginTop: 0,
          }}>
            What We Were Looking For
          </p>
          <div style={{ color: '#d1d5db', fontSize: '15px', lineHeight: '1.7' }}>
            {renderQuestionWithMaths(answerResult.rubric)}
          </div>
        </div>
      )}

      {/* Pending — animated loading bar */}
      {gradingStatus === 'pending' && (
        <div style={{
          padding: '24px 20px',
          backgroundColor: '#1a1a1a',
          border: '1px solid #3b2f6e',
          borderRadius: '8px',
          marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ fontSize: '20px' }}>🦥</span>
            <p style={{ color: '#a78bfa', margin: 0, fontSize: '15px', fontWeight: '600' }}>
              Slothrates is marking your explanation...
            </p>
          </div>
          {/* Animated progress bar */}
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#2d2d2d',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: '40%',
              backgroundColor: '#8b5cf6',
              borderRadius: '4px',
              animation: 'feynmanSlide 1.4s ease-in-out infinite',
            }} />
          </div>
          <style>{`
            @keyframes feynmanSlide {
              0%   { transform: translateX(-100%); }
              50%  { transform: translateX(200%); }
              100% { transform: translateX(-100%); }
            }
          `}</style>
          <p style={{ color: '#6b7280', fontSize: '12px', margin: '10px 0 0', textAlign: 'center' }}>
            This usually takes a few seconds
          </p>
        </div>
      )}

      {/* Graded */}
      {gradingStatus === 'graded' && (
        <>
          <div style={{
            padding: '14px 18px',
            backgroundColor: '#1a1a1a',
            borderRadius: '8px',
            border: '1px solid #404040',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}>
            <span style={{ color: '#9ca3af', fontSize: '14px' }}>Marks awarded</span>
            <span style={{ color: '#8b5cf6', fontWeight: '700', fontSize: '18px' }}>
              {answerResult?.marks_awarded ?? '?'} / {answerResult?.marks_available ?? '?'}
            </span>
          </div>

          {answerResult?.feedback && (
            <div style={{
              padding: '16px 20px',
              backgroundColor: '#1e1e2e',
              border: '1px solid #4c1d95',
              borderRadius: '8px',
              marginBottom: '20px',
            }}>
              <p style={{
                color: '#a78bfa', fontSize: '12px', fontWeight: '700',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                marginBottom: '8px', marginTop: 0,
              }}>
                Peer Feedback
              </p>
              <p style={{ color: '#c4b5fd', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>
                {answerResult.feedback}
              </p>
            </div>
          )}
        </>
      )}

      {/* Failed */}
      {gradingStatus === 'failed' && (
        <div style={{
          padding: '16px 20px',
          backgroundColor: '#1a1a1a',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          marginBottom: '20px',
          color: '#fca5a5',
          fontSize: '15px',
        }}>
          ⚠️ Grading failed — your answer has been saved and will be reviewed.
        </div>
      )}

      <NextButton
        onClick={nextQuestion}
        label={gradingStatus === 'pending'
          ? '→ Continue (grading in background)'
          : isLastPart ? '→ Next Question' : '→ Next Part'}
      />
    </div>
  );
}

// ─── Self-mark result (interactive mark scheme) ────────────────
function SelfMarkResult({ markScheme, quiz, currentQuestion, quizid, nextQuestion, hasParts, currentPart, userid }) {
  const { confidence, setConfidence, renderQuestionWithMaths } = useQuiz();

  const activeQ = hasParts()
    ? quiz[currentQuestion - 1]?.parts[currentPart]
    : quiz[currentQuestion - 1];
  const isLastPart = !hasParts() || currentPart >= (quiz[currentQuestion - 1]?.parts?.length ?? 1) - 1;

  const handleButtonClick = (item) => {
    const button = document.getElementById(`button-${item.mark_scheme_item_id}`);
    button.classList.toggle('active');

    button.style.backgroundColor = button.classList.contains('active')
      ? (item.is_mandatory ? '#7c3aed' : '#0d9668') : '';
    button.style.borderColor = button.classList.contains('active')
      ? (item.is_mandatory ? '#7c3aed' : '#0d9668') : '#404040';

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

    await fetch(`${API_URL}/quiz/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userid,
        questionid: activeQ?.questionid,
        quizid,
        user_answer: '',
        marks_awarded: selectedItems.reduce((acc) => acc + 1, 0),
        marks_available: activeQ?.total_marks,
        confidence,
        time_taken: 0,
      }),
    });

    setConfidence(null);
    nextQuestion();
  };

  if (markScheme.length === 0) {
    return (
      <div style={{ ...card, textAlign: 'center', color: '#9ca3af' }}>
        <p style={{ fontSize: '18px', marginBottom: '8px' }}>⚠️</p>
        <p style={{ margin: 0 }}>No mark scheme items found for this question.</p>
        <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#6b7280' }}>
          Mark scheme items may not have been added yet.
        </p>
        <NextButton onClick={nextQuestion} label={isLastPart ? '→ Next Question' : '→ Next Part'} />
      </div>
    );
  }

  return (
    <div style={card}>
      <h2 style={{
        color: '#10b981', fontSize: '22px', fontWeight: 'bold',
        marginTop: 0, marginBottom: '8px',
        display: 'flex', alignItems: 'center', gap: '10px'
      }}>
        ✓ Mark Scheme
      </h2>
      <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '20px', marginTop: 0 }}>
        Tap each step you completed correctly to award yourself marks.
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {markScheme.map((item, index) => (
          <li key={item.mark_scheme_item_id || index}>
            <button
              id={`button-${item.mark_scheme_item_id}`}
              onClick={() => handleButtonClick(item)}
              style={{
                width: '100%',
                padding: '14px 18px',
                backgroundColor: '#1a1a1a',
                border: '2px solid #404040',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                color: '#d1d5db',
                fontSize: '14px',
                lineHeight: '1.6',
                transition: 'all 0.15s',
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
              <div style={{ marginBottom: '6px' }}>
                <strong style={{ color: '#10b981' }}>Step {index + 1}:</strong>
                {item.is_mandatory && (
                  <span style={{ color: '#a855f7', marginLeft: '8px', fontWeight: '600' }}>
                    🔒 Mandatory
                  </span>
                )}
              </div>
              <div>{renderQuestionWithMaths(item.item_description)}</div>
              <div style={{ marginTop: '6px', color: '#9ca3af', fontSize: '12px' }}>
                <em>({item.marks_available} {item.marks_available === 1 ? 'mark' : 'marks'})</em>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <NextButton
        onClick={handleSubmit}
        label={isLastPart ? '→ Submit & Next Question' : '→ Submit & Next Part'}
      />
    </div>
  );
}

// ─── Main AnswerCard ───────────────────────────────────────────
function AnswerCard() {
  const {
    quizid, currentQuestion, markScheme,
    nextQuestion, quiz,
    answerResult, gradingStatus,
    hasParts, currentPart,
    getActiveQuestion,
  } = useQuiz();
  const { userid } = useAuth();

  const activeQ = getActiveQuestion();
  const format = activeQ?.question_format;

  if (format === 'multiple_choice') {
    return (
      <MCQResult
        answerResult={answerResult}
        quiz={quiz}
        currentQuestion={currentQuestion}
        nextQuestion={nextQuestion}
        hasParts={hasParts}
        currentPart={currentPart}
      />
    );
  }

  if (format === 'feynman') {
    return (
      <FeynmanResult
        answerResult={answerResult}
        gradingStatus={gradingStatus}
        nextQuestion={nextQuestion}
        hasParts={hasParts}
        currentPart={currentPart}
        quiz={quiz}
        currentQuestion={currentQuestion}
      />
    );
  }

  // self_mark — interactive mark scheme
  return (
    <SelfMarkResult
      markScheme={markScheme}
      quiz={quiz}
      currentQuestion={currentQuestion}
      quizid={quizid}
      nextQuestion={nextQuestion}
      hasParts={hasParts}
      currentPart={currentPart}
      userid={userid}
    />
  );
}

export default AnswerCard;