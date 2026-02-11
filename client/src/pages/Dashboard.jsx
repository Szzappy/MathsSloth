import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuiz } from '../contexts/QuizContext';
import QuizSetupModal from '../components/QuizSetupModal';

function Dashboard() {
  const API_URL = import.meta.env.VITE_API_URL;
  const navigate = useNavigate();
  const { user, userid, logout } = useAuth();
  const { getQuizData, continueQuiz, setCurrentQuestion } = useQuiz();
  
  const [canContinue, setCanContinue] = useState(false);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  
  // Stats data
  const [stats, setStats] = useState({
    accuracy: 0,
    totalQuestions: 0,
    studyTime: 0,
    streak: 0,
    predictedGrade: 0,
    daysUntilExam: 0
  });
  
  // Topics data
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Dashboard";
    
    const checkQuiz = async () => {
      const result = await continueQuiz(userid);
      setCanContinue(result);
    };
    
    const fetchDashboardData = async () => {
      try {
        // Fetch user stats
        const statsResponse = await fetch(`${API_URL}/analytics/dashboard-stats/${userid}`);
        const statsData = await statsResponse.json();
        setStats(statsData);
        
        // Fetch topics progress
        const topicsResponse = await fetch(`${API_URL}/analytics/topic-elos/${userid}`);
        const topicsData = await topicsResponse.json();
        setTopics(topicsData.slice(0, 5)); // Top 5 topics
        
      } catch (error) {
        console.error('Failed to fetch dashboard data', error.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (userid) {
      checkQuiz();
      fetchDashboardData();
    }
    
    setCurrentQuestion(1);
  }, [userid]);

  const loadQuiz = () => {
    navigate('/quiz');
  };

  const openQuizModal = () => {
    setIsQuizModalOpen(true);
  };

  const closeQuizModal = () => {
    setIsQuizModalOpen(false);
  };

  const getGradeColor = (grade) => {
    if (grade >= 7) return '#10b981';
    if (grade >= 5) return '#3b82f6';
    if (grade >= 4) return '#f59e0b';
    return '#ef4444';
  };

  const getTopicProgressColor = (progress) => {
    if (progress >= 80) return '#10b981';
    if (progress >= 60) return '#3b82f6';
    if (progress >= 40) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#1a1a1a',
      padding: '24px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Centered Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '48px'
        }}>
          <h1 style={{
            color: '#fff',
            fontSize: '36px',
            fontWeight: 'bold',
            margin: 0,
            marginBottom: '12px'
          }}>
            Welcome Home, {user}!
          </h1>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            color: '#9ca3af',
            fontSize: '14px'
          }}>
            <span>🔥 Daily Streak: {stats.streak} days</span>
            <span>•</span>
            <span>📅 {stats.daysUntilExam} days until exam</span>
          </div>
        </div>

        {/* Main Content: Predicted Grade + Stats in a Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '32px',
          marginBottom: '32px',
          alignItems: 'start'
        }}>
          {/* Predicted Grade Card - Left Side */}
          <div style={{
            backgroundColor: '#2d2d2d',
            border: '1px solid #404040',
            borderRadius: '12px',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '320px'
          }}>
            <h3 style={{
              color: '#9ca3af',
              fontSize: '16px',
              fontWeight: '500',
              margin: 0,
              marginBottom: '16px'
            }}>
              Predicted Grade
            </h3>
            
            <div style={{
              width: '180px',
              height: '180px',
              borderRadius: '50%',
              border: `12px solid ${getGradeColor(stats.predictedGrade)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <span style={{
                fontSize: '80px',
                fontWeight: 'bold',
                color: getGradeColor(stats.predictedGrade)
              }}>
                {stats.predictedGrade}
              </span>
            </div>
            
            <p style={{
              color: '#9ca3af',
              fontSize: '14px',
              margin: 0,
              marginBottom: '8px',
              textAlign: 'center'
            }}>
              {stats.daysUntilExam} more days until that A!
            </p>
            
            <button
              onClick={canContinue ? loadQuiz : openQuizModal}
              style={{
                width: '100%',
                padding: '14px 24px',
                backgroundColor: '#10b981',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '600',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginTop: '16px'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#059669'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#10b981'}
            >
              {canContinue ? '🔥 Resume Quiz' : '🚀 Start Quiz'}
            </button>

            {/* My Analytics Button - Subtle */}
            <button
              onClick={() => navigate('/analytics')}
              style={{
                width: '100%',
                padding: '10px 20px',
                backgroundColor: 'transparent',
                color: '#9ca3af',
                fontSize: '14px',
                fontWeight: '500',
                border: '1px solid #404040',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginTop: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.color = '#d1d5db';
                e.target.style.borderColor = '#525252';
              }}
              onMouseLeave={(e) => {
                e.target.style.color = '#9ca3af';
                e.target.style.borderColor = '#404040';
              }}
            >
              📊 View Analytics
            </button>
            
            <p style={{
              color: '#ef4444',
              fontSize: '12px',
              fontStyle: 'italic',
              margin: 0,
              marginTop: '12px',
              textAlign: 'center'
            }}>
              Don't let the flame die! Keep studying!
            </p>
          </div>

          {/* Stats Cards Grid - Right Side */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px'
          }}>
            {/* Accuracy Card */}
            <div style={{
              backgroundColor: '#2d2d2d',
              border: '1px solid #404040',
              borderRadius: '12px',
              padding: '20px',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px'
              }}>
                <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0, fontWeight: '500' }}>
                  Accuracy
                </p>
                <span style={{ fontSize: '24px' }}>🎯</span>
              </div>
              <p style={{
                color: '#fff',
                fontSize: '32px',
                fontWeight: 'bold',
                margin: 0,
                lineHeight: '1.2'
              }}>
                {stats.accuracy}%
              </p>
              <p style={{ color: '#10b981', fontSize: '12px', margin: 0, marginTop: '4px' }}>
                +12% from last week
              </p>
            </div>

            {/* Questions Answered Card */}
            <div style={{
              backgroundColor: '#2d2d2d',
              border: '1px solid #404040',
              borderRadius: '12px',
              padding: '20px',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px'
              }}>
                <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0, fontWeight: '500' }}>
                  Questions Answered
                </p>
                <span style={{ fontSize: '24px' }}>📝</span>
              </div>
              <p style={{
                color: '#fff',
                fontSize: '32px',
                fontWeight: 'bold',
                margin: 0,
                lineHeight: '1.2'
              }}>
                {stats.totalQuestions}
              </p>
              <p style={{ color: '#10b981', fontSize: '12px', margin: 0, marginTop: '4px' }}>
                +37 this week
              </p>
            </div>

            {/* Study Time Card */}
            <div style={{
              backgroundColor: '#2d2d2d',
              border: '1px solid #404040',
              borderRadius: '12px',
              padding: '20px',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px'
              }}>
                <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0, fontWeight: '500' }}>
                  Study Time
                </p>
                <span style={{ fontSize: '24px' }}>⏱️</span>
              </div>
              <p style={{
                color: '#fff',
                fontSize: '32px',
                fontWeight: 'bold',
                margin: 0,
                lineHeight: '1.2'
              }}>
                {stats.studyTime}
              </p>
              <p style={{ color: '#10b981', fontSize: '12px', margin: 0, marginTop: '4px' }}>
                +12h this week
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quiz Setup Modal */}
      {isQuizModalOpen && <QuizSetupModal onClose={closeQuizModal} />}
    </div>
  );
}

export default Dashboard;