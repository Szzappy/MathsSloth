import React, { useState } from 'react';
import { useQuiz } from '../contexts/QuizContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

const API_URL = import.meta.env.VITE_API_URL;

// base card style shared by all result panels
const card = {
  backgroundColor: '#2d2d2d',
  border: '1px solid #404040',
  borderRadius: '12px',
  padding: '32px',
  marginBottom: '24px',
};

// next/continue button at the bottom of every result panel
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

// MCQ result - correct answer goes green, wrong selection goes red
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
      <h2 style={{
        color: answerResult?.is_correct ? '#10b981' : '#ef4444',
        fontSize: '22px',
        fontWeight: 'bold',
        marginTop: 0,
        marginBottom: '20px',
      }}>
        {answerResult?.is_correct ? '✅ Correct!' : '❌ Incorrect'}
      </h2>

      {/* correct = green, wrong pick = red */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        {options.map(({ label, text }) => {
          const isCorrect = label === answerResult?.correct_answer;
          const wasSelected = label === answerResult?.user_answer;
          const isWrongSelection = wasSelected && !isCorrect;

          let bg = '#1a1a1a';
          let border = '#404040';
          let color = '#9ca3af';

          if (isCorrect) { bg = '#064e3b'; border = '#10b981'; color = '#6ee7b7'; }
          if (isWrongSelection) { bg = '#450a0a'; border = '#ef4444'; color = '#fca5a5'; }

          return (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '12px 16px',
                backgroundColor: bg,
                border: `2px solid ${border}`,
                borderRadius: '8px',
                color,
                fontSize: '15px',
              }}
            >
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

      {/* marks summary */}
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
          fontSize: '18px',
        }}>
          {answerResult?.marks_awarded ?? 0} / {answerResult?.marks_available ?? '?'}
        </span>
      </div>

      {/* silly mistake button - only on wrong answers, halves ELO penalty */}
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
              🤦 Noted - ELO impact halved. Don't let it happen again!
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
              🤦 Silly Mistake - I knew this really
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

// Feynman result - shows the answer and rubric straight away while grading runs in the background
function FeynmanResult({ answerResult, gradingStatus, nextQuestion, hasParts, currentPart, quiz, currentQuestion }) {
  const { renderQuestionWithMaths } = useQuiz();
  const isLastPart = !hasParts() || currentPart >= (quiz[currentQuestion - 1]?.parts?.length ?? 1) - 1;

  return (
    <div style={card}>
      <h2 style={{
        color: '#8b5cf6',
        fontSize: '22px',
        fontWeight: 'bold',
        marginTop: 0,
        marginBottom: '20px',
      }}>
        📝 Feynman Assessment
      </h2>

      {/* student's submitted answer */}
      {answerResult?.user_answer && (
        <div style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #3b2f6e',
          borderRadius: '8px',
          padding: '18px 20px',
          marginBottom: '20px',
        }}>
          <p style={{
            color: '#a78bfa',
            fontSize: '12px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '10px',
            marginTop: 0,
          }}>
            Your Answer
          </p>
          <p style={{
            color: '#d1d5db',
            fontSize: '15px',
            lineHeight: '1.7',
            margin: 0,
            whiteSpace: 'pre-wrap',
          }}>
            {answerResult.user_answer}
          </p>
        </div>
      )}

      {/* rubric shown immediately so students can self-check while grading runs */}
      {answerResult?.rubric && (
        <div style={{
          backgroundColor: '#1a1a1a',
          border: '1px solid #404040',
          borderRadius: '8px',
          padding: '18px 20px',
          marginBottom: '20px',
        }}>
          <p style={{
            color: '#8b5cf6',
            fontSize: '12px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '10px',
            marginTop: 0,
          }}>
            What We Were Looking For
          </p>
          <div style={{ color: '#d1d5db', fontSize: '15px', lineHeight: '1.7' }}>
            {renderQuestionWithMaths(answerResult.rubric)}
          </div>
        </div>
      )}

      {/* loading state while the AI grader runs */}
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

      {/* mark and feedback once grading is done */}
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
              marginBottom: '16px',
            }}>
              <p style={{
                color: '#a78bfa',
                fontSize: '12px',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '8px',
                marginTop: 0,
              }}>
                AI Feedback
              </p>
              <p style={{ color: '#c4b5fd', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>
                {answerResult.feedback}
              </p>
            </div>
          )}

          <AppealButton answerResult={answerResult} />
        </>
      )}

      {/* grading API call failed */}
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
          Warning: Grading failed - your answer has been saved and will be reviewed.
        </div>
      )}

      <NextButton
        onClick={nextQuestion}
        label={
          gradingStatus === 'pending'
            ? '→ Continue (grading in background)'
            : isLastPart ? '→ Next Question' : '→ Next Part'
        }
      />
    </div>
  );
}

// self-mark - student taps steps they got right to award their own marks
// mandatory steps have to be selected in order before optional ones can be awarded
function SelfMarkResult({ markScheme, quiz, currentQuestion, quizid, nextQuestion, hasParts, currentPart, userid }) {
  const { confidence, setConfidence, renderQuestionWithMaths } = useQuiz();

  const activeQ = hasParts()
    ? quiz[currentQuestion - 1]?.parts[currentPart]
    : quiz[currentQuestion - 1];

  const isLastPart = !hasParts() || currentPart >= (quiz[currentQuestion - 1]?.parts?.length ?? 1) - 1;

  // toggles a step on/off - blocks activation if earlier mandatory steps aren't ticked
  const handleButtonClick = (item) => {
    const button = document.getElementById(`button-${item.mark_scheme_item_id}`);
    button.classList.toggle('active');

    button.style.backgroundColor = button.classList.contains('active')
      ? (item.is_mandatory ? '#7c3aed' : '#0d9668')
      : '';

    button.style.borderColor = button.classList.contains('active')
      ? (item.is_mandatory ? '#7c3aed' : '#0d9668')
      : '#404040';

    // deactivate the step if any prior mandatory step is missing
    if (button.classList.contains('active')) {
      const priorMandatory = markScheme.filter(
        (msItem) => msItem.is_mandatory && msItem.mark_scheme_item_id < item.mark_scheme_item_id
      );
      const allPriorSelected = priorMandatory.every((msItem) => {
        const msButton = document.getElementById(`button-${msItem.mark_scheme_item_id}`);
        return msButton && msButton.classList.contains('active');
      });

      if (!allPriorSelected) {
        button.classList.remove('active');
        button.style.backgroundColor = '';
        button.style.borderColor = '#404040';
      }
    }
  };

  // counts selected steps and posts the self-awarded mark
  const handleSubmit = async (e) => {
    e.preventDefault();

    const selectedItems = markScheme.filter((item) => {
      const button = document.getElementById(`button-${item.mark_scheme_item_id}`);
      return button && button.classList.contains('active');
    });

    await fetch(`${API_URL}/quiz/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userid,
        questionid: activeQ?.questionid,
        quizid,
        user_answer: '',
        marks_awarded: selectedItems.length,
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
        color: '#10b981',
        fontSize: '22px',
        fontWeight: 'bold',
        marginTop: 0,
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        Mark Scheme
      </h2>
      <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '20px', marginTop: 0 }}>
        Tap each step you completed correctly to award yourself marks.
      </p>

      <ul style={{
        listStyle: 'none',
        padding: 0,
        margin: '0 0 4px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
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
        label={isLastPart ? '→ Submit and Next Question' : '→ Submit and Next Part'}
      />
    </div>
  );
}

// lets students dispute a Feynman mark - re-runs the grader with their appeal reason
// one appeal per attempt, revised mark replaces the original
function AppealButton({ answerResult }) {
  const { userid } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [revised, setRevised] = useState(null); // { marks_awarded, feedback }
  const [used, setUsed] = useState(false);      // one appeal per attempt

  if (!answerResult?.attempt_id || used) return null;

  const submit = async () => {
    if (!reason.trim()) return;
    setStatus('loading');
    try {
      const res = await fetch(`${API_URL}/quiz/answer/feynman/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userid,
          attempt_id: answerResult.attempt_id,
          appeal_reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Appeal failed');
      setRevised(data);
      setStatus('done');
      setUsed(true);
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  };

  // appeal outcome
  if (status === 'done' && revised) {
    const changed = revised.marks_awarded !== answerResult.marks_awarded;
    return (
      <div style={{
        padding: '16px 20px',
        backgroundColor: changed ? '#052e16' : '#1a1a1a',
        border: `1px solid ${changed ? '#16a34a' : '#404040'}`,
        borderRadius: '8px',
        marginBottom: '16px',
      }}>
        <p style={{
          color: '#9ca3af',
          fontSize: '12px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          margin: '0 0 8px',
        }}>
          Appeal result
        </p>
        <p style={{
          color: changed ? '#4ade80' : '#9ca3af',
          fontSize: '15px',
          fontWeight: '700',
          margin: '0 0 6px',
        }}>
          {changed
            ? `Mark revised: ${revised.marks_awarded} / ${answerResult.marks_available}`
            : `Mark upheld: ${revised.marks_awarded} / ${answerResult.marks_available}`}
        </p>
        <p style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
          {revised.feedback}
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{
            background: 'none',
            border: '1px solid #374151',
            borderRadius: '6px',
            color: '#6b7280',
            fontSize: '13px',
            padding: '7px 14px',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#8b5cf6';
            e.currentTarget.style.color = '#a78bfa';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#374151';
            e.currentTarget.style.color = '#6b7280';
          }}
        >
          Dispute this mark
        </button>
      ) : (
        <div style={{
          padding: '16px 20px',
          backgroundColor: '#1a1a1a',
          border: '1px solid #374151',
          borderRadius: '8px',
        }}>
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: '0 0 10px' }}>
            Tell the AI why you think the mark is wrong. Be specific, e.g. "I did explain the chain rule, I just used informal language."
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="My answer explained X correctly because..."
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              backgroundColor: '#111',
              color: '#e5e7eb',
              border: '1px solid #374151',
              borderRadius: '6px',
              padding: '10px 12px',
              fontSize: '14px',
              resize: 'vertical',
              outline: 'none',
              marginBottom: '10px',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={submit}
              disabled={status === 'loading' || !reason.trim()}
              style={{
                padding: '8px 18px',
                backgroundColor: status === 'loading' ? '#374151' : '#8b5cf6',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {status === 'loading' ? 'Reviewing...' : 'Submit appeal'}
            </button>
            <button
              onClick={() => setOpen(false)}
              style={{
                padding: '8px 14px',
                background: 'none',
                border: '1px solid #374151',
                borderRadius: '6px',
                color: '#6b7280',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
          {status === 'error' && (
            <p style={{ color: '#ef4444', fontSize: '13px', margin: '8px 0 0' }}>
              Something went wrong - please try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// picks the right result panel based on question format (multiple_choice, feynman or self_mark)
function AnswerCard() {
  const {
    quizid,
    currentQuestion,
    markScheme,
    nextQuestion,
    quiz,
    answerResult,
    gradingStatus,
    hasParts,
    currentPart,
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