import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuiz } from '../contexts/QuizContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

function QuizCompleted() {
  const { getResults, overallResults, individualTopicStats } = useQuiz();
  const { user, userid } = useAuth();
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Quiz Completed - Maths Sloth";
    if (!userid) return;
    getResults(userid).then(() => setLoading(false));
  }, [userid]);

  const getScorePercentage = () => {
    if (!overallResults) return 0;
    return Math.round((overallResults.total_marks_awarded / overallResults.total_marks_available) * 100);
  };

  const getScoreColor = (percentage) => {
    if (percentage >= 80) return '#10b981'; // Green
    if (percentage >= 60) return '#3b82f6'; // Blue
    if (percentage >= 40) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
  };

  const getScoreMessage = (percentage) => {
    if (percentage >= 90) return { emoji: '🌟', message: 'Outstanding! You\'re a genius!' };
    if (percentage >= 80) return { emoji: '🎉', message: 'Excellent work! Keep it up!' };
    if (percentage >= 70) return { emoji: '😊', message: 'Great job! You\'re doing well!' };
    if (percentage >= 60) return { emoji: '👍', message: 'Good effort! Keep practicing!' };
    if (percentage >= 50) return { emoji: '📚', message: 'Not bad! Review and try again!' };
    return { emoji: '💪', message: 'Keep going! Practice makes perfect!' };
  };

  const getTopicColor = (awarded, available) => {
    const percentage = (awarded / available) * 100;
    if (percentage >= 80) return '#10b981';
    if (percentage >= 60) return '#3b82f6';
    if (percentage >= 40) return '#f59e0b';
    return '#ef4444';
  };

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
        {loading ? (
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
              Calculating your results...
            </p>
          </div>
        ) : (
          <>
            {/* Celebration Header */}
            <div style={{
              textAlign: 'center',
              marginBottom: '32px'
            }}>
              <h1 style={{
                fontSize: '48px',
                margin: 0,
                marginBottom: '16px',
                animation: 'bounce 1s ease-in-out'
              }}>
                {getScoreMessage(getScorePercentage()).emoji}
              </h1>
              <style>{`
                @keyframes bounce {
                  0%, 100% { transform: scale(1); }
                  50% { transform: scale(1.1); }
                }
              `}</style>
              <h2 style={{
                color: '#fff',
                fontSize: '32px',
                fontWeight: 'bold',
                margin: 0,
                marginBottom: '8px'
              }}>
                Quiz Complete!
              </h2>
              <p style={{
                color: getScoreColor(getScorePercentage()),
                fontSize: '18px',
                fontWeight: '600',
                margin: 0
              }}>
                {getScoreMessage(getScorePercentage()).message}
              </p>
            </div>

            {/* Overall Score Card */}
            <div style={{
              backgroundColor: '#2d2d2d',
              border: '1px solid #404040',
              borderRadius: '12px',
              padding: '32px',
              marginBottom: '24px',
              textAlign: 'center'
            }}>
              <h3 style={{
                color: '#9ca3af',
                fontSize: '16px',
                fontWeight: '500',
                margin: 0,
                marginBottom: '16px'
              }}>
                Your Score
              </h3>

              {/* Score Circle */}
              <div style={{
                width: '200px',
                height: '200px',
                margin: '0 auto 24px',
                borderRadius: '50%',
                border: `12px solid ${getScoreColor(getScorePercentage())}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}>
                <div style={{
                  fontSize: '48px',
                  fontWeight: 'bold',
                  color: getScoreColor(getScorePercentage())
                }}>
                  {getScorePercentage()}%
                </div>
                <div style={{
                  fontSize: '16px',
                  color: '#9ca3af',
                  marginTop: '8px'
                }}>
                  {overallResults?.total_marks_awarded ?? 0} / {overallResults?.total_marks_available ?? 0} marks
                </div>
              </div>
            </div>

            {/* Topic Breakdown */}
            <div style={{
              backgroundColor: '#2d2d2d',
              border: '1px solid #404040',
              borderRadius: '12px',
              padding: '32px',
              marginBottom: '24px'
            }}>
              <h3 style={{
                color: '#fff',
                fontSize: '20px',
                fontWeight: '600',
                marginTop: 0,
                marginBottom: '24px'
              }}>
                📊 Topic Breakdown
              </h3>

              {individualTopicStats.length === 0 ? (
                <p style={{
                  color: '#9ca3af',
                  textAlign: 'center',
                  padding: '2rem'
                }}>
                  No topic statistics available.
                </p>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  {individualTopicStats.map((topicStat, index) => {
                    const percentage = Math.round((topicStat.marks_awarded / topicStat.marks_available) * 100);
                    const color = getTopicColor(topicStat.marks_awarded, topicStat.marks_available);

                    return (
                      <div
                        key={index}
                        style={{
                          backgroundColor: '#1a1a1a',
                          border: '1px solid #404040',
                          borderRadius: '8px',
                          padding: '20px',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateX(4px)';
                          e.currentTarget.style.borderColor = color;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateX(0)';
                          e.currentTarget.style.borderColor = '#404040';
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '12px'
                        }}>
                          <div>
                            <div style={{
                              color: '#d1d5db',
                              fontSize: '16px',
                              fontWeight: '600',
                              marginBottom: '4px'
                            }}>
                              {topicStat.topic_code} - {topicStat.topic_name}
                            </div>
                            <div style={{
                              color: '#9ca3af',
                              fontSize: '14px'
                            }}>
                              {topicStat.marks_awarded}/{topicStat.marks_available} marks
                            </div>
                          </div>
                          <div style={{
                            fontSize: '32px',
                            fontWeight: 'bold',
                            color: color
                          }}>
                            {percentage}%
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div style={{
                          width: '100%',
                          height: '8px',
                          backgroundColor: '#404040',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${percentage}%`,
                            height: '100%',
                            backgroundColor: color,
                            transition: 'width 0.5s ease'
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  padding: '16px 24px',
                  backgroundColor: '#10b981',
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: '600',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
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
                🏠 Return to Dashboard
              </button>

              <button
                onClick={() => navigate('/analytics')}
                style={{
                  padding: '16px 24px',
                  backgroundColor: '#1a1a1a',
                  color: '#10b981',
                  fontSize: '16px',
                  fontWeight: '600',
                  border: '2px solid #10b981',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#10b981';
                  e.target.style.color = '#fff';
                  e.target.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#1a1a1a';
                  e.target.style.color = '#10b981';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                📊 View Analytics
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default QuizCompleted;