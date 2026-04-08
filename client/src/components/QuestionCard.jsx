import React, { useMemo } from 'react';
import { useQuiz } from '../contexts/QuizContext.jsx';

const card = {
  backgroundColor: '#2d2d2d',
  border: '1px solid #404040',
  borderRadius: '12px',
  padding: '32px',
  marginBottom: '24px',
};

const sectionLabel = (color = '#10b981') => ({
  color,
  fontSize: '13px',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '8px',
  marginTop: 0,
});

function CompletedPart({ part, index, renderQuestionWithMaths }) {
  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '20px 24px',
      marginBottom: '12px',
      opacity: 0.7,
    }}>
      <p style={sectionLabel('#6b7280')}>
        Part {part.part_label || String.fromCharCode(97 + index)}
      </p>
      <div style={{ color: '#9ca3af', fontSize: '16px', lineHeight: '1.7' }}>
        {renderQuestionWithMaths(part.question_text)}
      </div>
    </div>
  );
}

function MCQOptions({ options, selectedOption, setSelectedOption }) {
  // Shuffle once on mount - stable across re-renders for this question instance
  const shuffled = useMemo(() => {
    const arr = [...options];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const displayLetters = ['A', 'B', 'C', 'D', 'E'];
    return arr.map((opt, i) => ({
      ...opt,
      originalLabel: opt.label, // keep for server submission
      displayLabel: displayLetters[i], // always A, B, C, D in display order
    }));
  }, [options]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
      {shuffled.map(({ originalLabel, displayLabel, text }) => {
        const isSelected = selectedOption === originalLabel;
        return (
          <button
            key={originalLabel}
            onClick={() => setSelectedOption(originalLabel)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '14px 18px',
              backgroundColor: isSelected ? '#1e3a5f' : '#181c24',
              border: `2px solid ${isSelected ? '#3b82f6' : '#2e3448'}`,
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
              color: isSelected ? '#93c5fd' : '#d1d5db',
              fontSize: '15px',
              lineHeight: '1.5',
              transition: 'all 0.15s',
              width: '100%',
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = '#3b82f6';
                e.currentTarget.style.backgroundColor = '#1d2133';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.borderColor = '#2e3448';
                e.currentTarget.style.backgroundColor = '#181c24';
              }
            }}
          >
            <span style={{
              minWidth: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: isSelected ? '#3b82f6' : '#333',
              color: isSelected ? '#fff' : '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '14px',
              flexShrink: 0,
            }}>
              {displayLabel}
            </span>
            <span>{text}</span>
          </button>
        );
      })}
    </div>
  );
}

function FeynmanInput({ userAnswer, setUserAnswer }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <p style={sectionLabel('#a78bfa')}>Your Explanation</p>
      <p style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '10px', marginTop: 0 }}>
        Explain this concept in your own words as if teaching someone else. Focus on the reasoning, not just the answer.
      </p>
      <textarea
        value={userAnswer}
        onChange={(e) => setUserAnswer(e.target.value)}
        placeholder="Write your explanation here..."
        rows={6}
        style={{
          width: '100%',
          padding: '14px 16px',
          backgroundColor: '#1c1820',
          border: '2px solid #2e2840',
          borderRadius: '8px',
          color: '#d1d5db',
          fontSize: '15px',
          lineHeight: '1.6',
          resize: 'vertical',
          outline: 'none',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
          transition: 'border-color 0.15s',
        }}
        onFocus={(e) => { e.target.style.borderColor = '#a78bfa'; }}
        onBlur={(e) => { e.target.style.borderColor = '#2e2840'; }}
      />
      <p style={{ color: '#6b7280', fontSize: '12px', textAlign: 'right', marginTop: '6px', marginBottom: 0 }}>
        {userAnswer.length} characters
      </p>
    </div>
  );
}

const CONFIDENCE_OPTIONS = [
  { value: "1", label: "Not Confident", emoji: "😰" },
  { value: "2", label: "Somewhat Confident", emoji: "😕" },
  { value: "3", label: "Neutral", emoji: "😐" },
  { value: "4", label: "Confident", emoji: "😊" },
  { value: "5", label: "Very Confident", emoji: "😎" },
];

function ConfidenceSelector({ confidence, setConfidence }) {
  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      padding: '20px 24px',
      borderRadius: '8px',
      border: '1px solid #2e2e2e',
      marginBottom: '24px',
    }}>
      <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: '600', marginTop: 0, marginBottom: '14px' }}>
        How confident are you?
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {CONFIDENCE_OPTIONS.map(({ value, label, emoji }) => {
          const isSelected = confidence === value;
          return (
            <label
              key={value}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px 14px',
                backgroundColor: isSelected ? '#0f4a57' : '#161f22',
                border: `2px solid ${isSelected ? '#4fb8c8' : '#1f3a40'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                color: isSelected ? '#fff' : '#d1d5db',
                transition: 'all 0.15s',
                boxShadow: isSelected ? '0 0 8px rgba(79,184,200,0.15)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = '#4fb8c8';
                  e.currentTarget.style.backgroundColor = '#192529';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = '#1f3a40';
                  e.currentTarget.style.backgroundColor = '#161f22';
                }
              }}
            >
              <input
                type="radio"
                name="confidence"
                value={value}
                checked={isSelected}
                onChange={(e) => setConfidence(e.target.value)}
                style={{ marginRight: '10px', accentColor: '#4fb8c8', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '18px', marginRight: '10px' }}>{emoji}</span>
              <span style={{ fontWeight: '500', fontSize: '14px' }}>{value} - {label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function SubmitButton({ format, onClick, disabled, isSubmitting }) {
  const labels = {
    multiple_choice: '→ Submit Answer',
    feynman: isSubmitting ? '⏳ Submitting...' : '→ Submit Explanation',
    self_mark: '✓ Check Answer',
  };
  const colors = {
    multiple_choice: '#3b82f6',
    feynman: '#8b5cf6',
    self_mark: '#10b981',
  };
  const hoverColors = {
    multiple_choice: '#2563eb',
    feynman: '#7c3aed',
    self_mark: '#059669',
  };

  // Disabled: dark muted version of the format colour so identity is preserved
  const disabledColors = {
    multiple_choice: '#1a2a4a',
    feynman: '#2a1a4a',
    self_mark: '#1a3a2a',
  };
  const disabledTextColors = {
    multiple_choice: '#4a6a9a',
    feynman: '#6a4a9a',
    self_mark: '#4a7a5a',
  };
  const bg = disabled ? (disabledColors[format] || '#1a3a2a') : (colors[format] || '#10b981');
  const hover = hoverColors[format] || '#059669';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '14px 24px',
        backgroundColor: bg,
        color: disabled ? (disabledTextColors[format] || '#4a7a5a') : '#fff',
        fontSize: '16px',
        fontWeight: '600',
        border: 'none',
        borderRadius: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        boxShadow: disabled ? 'none' : `0 4px 6px ${bg}55`,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.target.style.backgroundColor = hover;
          e.target.style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.target.style.backgroundColor = bg;
          e.target.style.transform = 'translateY(0)';
        }
      }}
    >
      {labels[format] || '→ Submit'}
    </button>
  );
}

function QuestionCard() {
  const {
    getAnswer, submitAnswer, canSubmit, isSubmitting,
    renderQuestionWithMaths, currentQuestion, quiz,
    setConfidence, confidence, showAnswerCard,
    userAnswer, setUserAnswer,
    selectedOption, setSelectedOption,
    currentPart, completedParts, hasParts,
    getActiveQuestion,
  } = useQuiz();

  const topLevelQuestion = quiz[currentQuestion - 1];
  if (!topLevelQuestion) return null;

  const activeQuestion = getActiveQuestion();
  const questionHasParts = hasParts();
  const format = activeQuestion?.question_format;

  const FORMAT_COLORS = {
    multiple_choice: '#3b82f6', // blue
    self_mark: '#10b981', // green
    feynman: '#8b5cf6', // purple
  };
  const formatColor = FORMAT_COLORS[format] ?? '#9ca3af';

  const serverDoneParts = questionHasParts ? (topLevelQuestion.doneParts ?? []) : [];
  const allDoneParts = [
    ...serverDoneParts,
    ...completedParts.filter(cp => !serverDoneParts.some(s => s.questionid === cp.questionid)),
  ].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (format === 'self_mark') {
      getAnswer();
    } else {
      submitAnswer();
    }
  };

  return (
    <div style={card}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid #404040',
      }}>
        <h1 style={{ color: formatColor, fontSize: '22px', fontWeight: 'bold', margin: 0 }}>
          Question {currentQuestion}
          {questionHasParts && (
            <span style={{ color: '#9ca3af', fontSize: '16px', fontWeight: 'normal', marginLeft: '8px' }}>
              - Part {activeQuestion?.part_label || String.fromCharCode(97 + currentPart)}
            </span>
          )}
        </h1>
        <div style={{
          backgroundColor: formatColor + '15',
          padding: '6px 14px',
          borderRadius: '6px',
          border: `1px solid ${formatColor}44`,
        }}>
          <span style={{ color: '#9ca3af', fontSize: '13px' }}>
            📊 <strong style={{ color: formatColor }}>{activeQuestion?.total_marks}</strong> mark{activeQuestion?.total_marks !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Parent stem (multi-part only) */}
      {questionHasParts && (
        <div style={{
          backgroundColor: '#1e2329',
          border: '1px solid #2d3748',
          borderRadius: '8px',
          padding: '18px 22px',
          marginBottom: '20px',
        }}>
          <p style={sectionLabel('#10b981')}>Question Stem</p>
          <div style={{ color: '#d1d5db', fontSize: '17px', lineHeight: '1.7' }}>
            {renderQuestionWithMaths(topLevelQuestion.question_text)}
          </div>
          {topLevelQuestion.image_url && (
            <img
              src={topLevelQuestion.image_url}
              alt="Question diagram"
              style={{ maxWidth: '100%', borderRadius: '6px', marginTop: '14px', border: '1px solid #404040' }}
            />
          )}
        </div>
      )}

      {/* Completed parts - text only, greyed */}
      {allDoneParts.map((part, i) => (
        <CompletedPart
          key={part.questionid || i}
          part={part}
          index={i}
          renderQuestionWithMaths={renderQuestionWithMaths}
        />
      ))}

      {/* Active question text */}
      <div style={{ marginBottom: '20px' }}>
        {questionHasParts && (
          <p style={sectionLabel('#a78bfa')}>
            Part {activeQuestion?.part_label || String.fromCharCode(97 + currentPart)}
          </p>
        )}
        <div style={{ color: '#d1d5db', fontSize: '17px', lineHeight: '1.7' }}>
          {renderQuestionWithMaths(activeQuestion?.question_text)}
        </div>
      </div>

      {/* Image (standalone only) - always visible */}
      {!questionHasParts && topLevelQuestion.image_url && (
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <img
            src={topLevelQuestion.image_url}
            alt="Question diagram"
            style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #404040' }}
          />
        </div>
      )}

      {/* Input controls*/}
      {!showAnswerCard && (
        <>
          {/* MCQ options */}
          {format === 'multiple_choice' && activeQuestion.answer_options?.options && (
            <MCQOptions
              options={activeQuestion.answer_options.options}
              selectedOption={selectedOption}
              setSelectedOption={setSelectedOption}
            />
          )}

          {/* Feynman text area */}
          {format === 'feynman' && (
            <FeynmanInput userAnswer={userAnswer} setUserAnswer={setUserAnswer} />
          )}

          {/* Confidence */}
          <ConfidenceSelector confidence={confidence} setConfidence={setConfidence} />

          {/* Submit */}
          <SubmitButton format={format} onClick={handleSubmit} disabled={!canSubmit || isSubmitting} isSubmitting={isSubmitting} />

          {!canSubmit && (
            <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '13px', marginTop: '10px', marginBottom: 0 }}>
              {format === 'multiple_choice' && !selectedOption
                ? 'Select an option and a confidence level to continue'
                : format === 'feynman' && !userAnswer.trim()
                ? 'Write your explanation and select a confidence level to continue'
                : 'Select a confidence level to continue'}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default QuestionCard;