import React, { useState } from 'react';
import { useQuiz } from '../contexts/QuizContext';
import TopicSelector from './TopicSelector';
import { useNavigate } from 'react-router-dom';

function QuizSetupModal({ onClose }) {
  const [index, setIndex] = useState(0);
  const { getTopics, topics, setCustomParameters, setQuizType } = useQuiz();
  const [checkedTopics, setCheckedTopics] = useState({});
  const [numQuestions, setNumQuestions] = useState(10);
  const [lowerDifficulty, setLowerDifficulty] = useState(1);
  const [upperDifficulty, setUpperDifficulty] = useState(5);
  const [useAdaptiveDifficulty, setUseAdaptiveDifficulty] = useState(true);
  const [quizMode, setQuizMode] = useState('');

  const navigate = useNavigate();

  const getChildren = (parentTopicCode) => {
    return topics.filter(topic => topic.parent_topic === parentTopicCode);
  };

  const handleParentChange = (parentId, parentTopicCode, checked) => {
    const children = getChildren(parentTopicCode);
    const updates = { [parentId]: checked };
    
    children.forEach(child => {
      updates[child.topicid] = checked;
    });
    
    setCheckedTopics(prev => ({ ...prev, ...updates }));
  };

  const handleCheckboxChange = (topicId, isParent, topicCode) => {
    const checked = !checkedTopics[topicId];
    
    if (isParent) {
      handleParentChange(topicId, topicCode, checked);
    } else {
      setCheckedTopics(prev => ({ ...prev, [topicId]: checked }));
    }
  };

  const getSelectedTopics = () => {
    return Object.keys(checkedTopics)
      .filter(id => checkedTopics[id])
      .map(id => parseInt(id));
  };

  const closeModal = () => {
    onClose();
  };

  const handleTopicsNext = () => {
    const selectedTopics = getSelectedTopics();
    if (selectedTopics.length === 0) {
      alert('Please select at least one topic');
      return;
    }
    setIndex(3);
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={closeModal}
    >
      <div 
        style={{
          backgroundColor: '#2d2d2d',
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          border: '1px solid #404040',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          borderBottom: '1px solid #404040',
          paddingBottom: '16px'
        }}>
          <h2 style={{
            color: '#fff',
            fontSize: '24px',
            fontWeight: 'bold',
            margin: 0
          }}>
            🎯 Quiz Time!
          </h2>
          <button 
            onClick={closeModal}
            style={{
              backgroundColor: 'transparent',
              color: '#9ca3af',
              border: 'none',
              fontSize: '32px',
              cursor: 'pointer',
              padding: 0,
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#404040';
              e.target.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.color = '#9ca3af';
            }}
          >
            ×
          </button>
        </div>

        {/* Step 0: Choose quiz type */}
        {index === 0 && (
          <div>
            <p
              style={{
                color: '#d1d5db',
                fontSize: '16px',
                marginBottom: '24px',
                textAlign: 'center',
              }}
            >
              Pick a category
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
              }}
            >
              {/* Adaptive Quiz */}
              <button
                onClick={() => {
                  setIndex(1);
                  setQuizType('adaptive');
                  navigate('/quiz');
                }}
                style={{
                  height: '180px',
                  backgroundColor: '#10b981',
                  color: '#fff',
                  fontSize: '18px',
                  fontWeight: '700',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  transition: 'transform 0.2s, background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#059669';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#10b981';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span style={{ fontSize: '32px' }}>⚡</span>
                Adaptive Quiz
              </button>

              {/* Custom Quiz */}
              <button
                onClick={() => {
                  setIndex(2);
                  getTopics();
                  setQuizType('custom');
                }}
                style={{
                  height: '180px',
                  backgroundColor: '#1a1a1a',
                  color: '#10b981',
                  fontSize: '18px',
                  fontWeight: '700',
                  border: '2px solid #10b981',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  transition: 'transform 0.2s, background-color 0.2s, color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#10b981';
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#1a1a1a';
                  e.currentTarget.style.color = '#10b981';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span style={{ fontSize: '32px' }}>🎨</span>
                Custom Quiz
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Select topics */}
        {index === 2 && (
          <div>
            <h3 style={{
              color: '#fff',
              fontSize: '20px',
              fontWeight: '600',
              marginBottom: '16px'
            }}>
              Select Topics
            </h3>
            <TopicSelector 
              topics={topics}
              checkedTopics={checkedTopics}
              onCheckboxChange={handleCheckboxChange}
            />
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '24px'
            }}>
              <button 
                onClick={() => setIndex(0)}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  backgroundColor: '#1a1a1a',
                  color: '#d1d5db',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: '1px solid #404040',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#262626'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#1a1a1a'}
              >
                ← Back
              </button>
              <button 
                onClick={handleTopicsNext}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  backgroundColor: '#10b981',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Additional settings */}
        {index === 3 && (
          <div>
            <h3 style={{
              color: '#fff',
              fontSize: '20px',
              fontWeight: '600',
              marginBottom: '16px'
            }}>
              Quiz Settings
            </h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                color: '#d1d5db',
                fontSize: '14px',
                fontWeight: '500',
                marginBottom: '8px'
              }}>
                Number of Questions:
              </label>
              <input 
                type="number" 
                value={numQuestions} 
                onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#1a1a1a',
                  color: '#fff',
                  border: '1px solid #404040',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#10b981'}
                onBlur={(e) => e.target.style.borderColor = '#404040'}
              />
            </div>

            <div style={{
              marginBottom: '20px',
              backgroundColor: '#1a1a1a',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid #404040'
            }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                color: '#d1d5db',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                <input 
                  type="checkbox"
                  checked={useAdaptiveDifficulty}
                  onChange={(e) => setUseAdaptiveDifficulty(e.target.checked)}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                    accentColor: '#10b981'
                  }}
                />
                Use Adaptive Difficulty
              </label>
            </div>

            {!useAdaptiveDifficulty && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  color: '#d1d5db',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '8px'
                }}>
                  Difficulty Range:
                </label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <input 
                    type="number" 
                    value={lowerDifficulty} 
                    onChange={(e) => setLowerDifficulty(parseInt(e.target.value))}
                    min="1"
                    max="5"
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: '#1a1a1a',
                      color: '#fff',
                      border: '1px solid #404040',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#10b981'}
                    onBlur={(e) => e.target.style.borderColor = '#404040'}
                  />
                  <span style={{ color: '#9ca3af', alignSelf: 'center' }}>to</span>
                  <input 
                    type="number" 
                    value={upperDifficulty} 
                    onChange={(e) => setUpperDifficulty(parseInt(e.target.value))}
                    min="1"
                    max="5"
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: '#1a1a1a',
                      color: '#fff',
                      border: '1px solid #404040',
                      borderRadius: '6px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#10b981'}
                    onBlur={(e) => e.target.style.borderColor = '#404040'}
                  />
                </div>
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '24px'
            }}>
              <button 
                onClick={() => setIndex(2)}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  backgroundColor: '#1a1a1a',
                  color: '#d1d5db',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: '1px solid #404040',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#262626'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#1a1a1a'}
              >
                ← Back
              </button>
              <button 
                onClick={() => {
                  setCustomParameters(quizMode, getSelectedTopics(), numQuestions, lowerDifficulty, upperDifficulty, useAdaptiveDifficulty);
                  setQuizType('custom');
                  navigate('/quiz');
                }}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  backgroundColor: '#10b981',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '600',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
              >
                🚀 Start Quiz
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuizSetupModal;