import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuiz } from '../contexts/QuizContext';
import QuizSetupModal from '../components/QuizSetupModal';

// Grade colour palette — matches analytics.js / TopicEloAndGradeCard
const GRADE_COLORS = {
  'A*': '#f59e0b',  // gold
  'A':  '#10b981',  // green
  'B':  '#06b6d4',  // cyan
  'C':  '#3b82f6',  // blue
  'D':  '#8b5cf6',  // purple
  'E':  '#f97316',  // orange
  'U':  '#ef4444',  // red
};

// ELO thresholds matching backend eloToGrade
const GRADE_THRESHOLDS = [
  { grade: 'A*', min: 1800, max: Infinity },
  { grade: 'A',  min: 1600, max: 1800 },
  { grade: 'B',  min: 1400, max: 1600 },
  { grade: 'C',  min: 1200, max: 1400 },
  { grade: 'D',  min: 1000, max: 1200 },
  { grade: 'E',  min: 800,  max: 1000 },
  { grade: 'U',  min: 0,    max: 800  },
];

const getGradeColor = (grade) => GRADE_COLORS[grade] ?? '#9ca3af';

// Progress within current grade band (0–1)
const gradeProgress = (elo, grade) => {
  const band = GRADE_THRESHOLDS.find(t => t.grade === grade);
  if (!band || !elo) return 0;
  if (band.max === Infinity) return 1; // A* — already there
  return Math.min(1, Math.max(0, (elo - band.min) / (band.max - band.min)));
};

// Label for next grade up
const nextGrade = (grade) => {
  const idx = GRADE_THRESHOLDS.findIndex(t => t.grade === grade);
  return idx > 0 ? GRADE_THRESHOLDS[idx - 1].grade : null;
};

function Dashboard() {
  const API_URL = import.meta.env.VITE_API_URL;
  const navigate = useNavigate();
  const { user, userid, logout } = useAuth();
  const { getQuizData, continueQuiz, setCurrentQuestion } = useQuiz();

  const [canContinue, setCanContinue] = useState(false);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    accuracy: 0,
    totalQuestions: 0,
    streak: 0,
    predictedGrade: '—',
    weightedElo: 0,
    daysUntilExam: null,
  });

  useEffect(() => {
    // Reset any scroll position left over from the quiz before locking
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    document.title = "Dashboard";

    const checkQuiz = async () => {
      const result = await continueQuiz(userid);
      setCanContinue(result);
    };

    const fetchDashboardData = async () => {
      try {
        const res = await fetch(`${API_URL}/analytics/dashboard-stats/${userid}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error.message);
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

  const gradeColor = getGradeColor(stats.predictedGrade);

  return (
    <div style={{ height: '100vh', maxHeight: '100vh', overflow: 'hidden', backgroundColor: '#1a1a1a', padding: '24px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ color: '#fff', fontSize: '44px', fontWeight: 'bold', margin: 0, marginBottom: '12px' }}>
            Welcome Home, {user}!
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', color: '#9ca3af', fontSize: '14px' }}>
            <span>🔥 Daily Streak: {loading ? '—' : `${stats.streak} day${stats.streak !== 1 ? 's' : ''}`}</span>
            <span>•</span>
            <span>
              {stats.daysUntilExam != null
                ? `📅 ${stats.daysUntilExam} days until exam`
                : '📅 Exam date not set'}
            </span>
          </div>
        </div>

        {/* Main grid: Grade card + Stats */}
        <div style={{
          display: 'flex',
          gap: '32px',
          marginBottom: '0',
          alignItems: 'stretch',
          justifyContent: 'center',
        }}>

          {/* Predicted Grade Card */}
          <div style={{
            backgroundColor: '#242424',
            border: `1px solid ${loading ? '#404040' : gradeColor}44`,
            borderRadius: '16px',
            padding: '28px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '320px',
            boxShadow: loading ? 'none' : `0 0 32px ${gradeColor}18`,
            transition: 'box-shadow 0.3s, border-color 0.3s',
          }}>
            {/* Top section */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <p style={{ color: '#6b7280', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, marginBottom: '16px' }}>
                Predicted Grade
              </p>

              {/* Grade hero block */}
              <div style={{
                position: 'relative',
                width: '100%',
                borderRadius: '14px',
                background: loading ? '#1a1a1a' : `linear-gradient(135deg, ${gradeColor}18 0%, ${gradeColor}08 100%)`,
                border: `1px solid ${loading ? '#333' : gradeColor}44`,
                padding: '20px 16px 16px',
                marginBottom: '14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: loading ? 'none' : `0 0 28px ${gradeColor}22`,
                transition: 'all 0.3s',
                overflow: 'hidden',
              }}>
                {/* Decorative background letter */}
                {!loading && (
                  <span style={{
                    position: 'absolute',
                    right: '-8px', top: '-12px',
                    fontSize: '120px', fontWeight: '900',
                    color: gradeColor, opacity: 0.06,
                    lineHeight: 1, pointerEvents: 'none',
                    userSelect: 'none',
                  }}>
                    {stats.predictedGrade}
                  </span>
                )}
                {/* Big grade letter */}
                <span style={{
                  fontSize: '80px', fontWeight: '900',
                  color: loading ? '#6b7280' : gradeColor,
                  lineHeight: 1, letterSpacing: '-2px',
                  textShadow: loading ? 'none' : `0 0 30px ${gradeColor}66`,
                  transition: 'all 0.3s',
                }}>
                  {loading ? '…' : stats.predictedGrade}
                </span>
                {/* ELO value */}
                {!loading && stats.weightedElo > 0 && (
                  <span style={{
                    fontSize: '12px', fontWeight: '700',
                    color: gradeColor, opacity: 0.8,
                    letterSpacing: '0.08em', marginTop: '2px',
                  }}>
                    {stats.weightedElo} ELO
                  </span>
                )}
                {/* Progress bar within grade band */}
                {!loading && stats.weightedElo > 0 && (
                  <div style={{ width: '100%', marginTop: '14px' }}>
                    {(() => {
                      const prog = gradeProgress(stats.weightedElo, stats.predictedGrade);
                      const next = nextGrade(stats.predictedGrade);
                      return (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                            <span style={{ color: '#4b5563', fontSize: '10px', fontWeight: '600' }}>
                              {stats.predictedGrade}
                            </span>
                            {next && (
                              <span style={{ color: getGradeColor(next), fontSize: '10px', fontWeight: '600' }}>
                                {next} →
                              </span>
                            )}
                          </div>
                          <div style={{ height: '5px', borderRadius: '3px', backgroundColor: '#2a2a2a', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${prog * 100}%`,
                              borderRadius: '3px',
                              background: `linear-gradient(90deg, ${gradeColor}99, ${gradeColor})`,
                              transition: 'width 0.6s ease',
                            }} />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Grade legend pills */}
              {!loading && (
                <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {['A*', 'A', 'B', 'C', 'D', 'E', 'U'].map(g => (
                    <span key={g} style={{
                      padding: '3px 7px',
                      borderRadius: '5px',
                      fontSize: '11px',
                      fontWeight: '700',
                      backgroundColor: stats.predictedGrade === g ? getGradeColor(g) + '22' : 'transparent',
                      color: stats.predictedGrade === g ? getGradeColor(g) : '#374151',
                      border: `1px solid ${stats.predictedGrade === g ? getGradeColor(g) + '66' : '#2a2a2a'}`,
                      transition: 'all 0.2s',
                    }}>
                      {g}
                    </span>
                  ))}
                </div>
              )}

              <p style={{ color: '#6b7280', fontSize: '12px', margin: 0, marginBottom: '4px', textAlign: 'center' }}>
                {stats.daysUntilExam != null
                  ? `📅 ${stats.daysUntilExam} days to push for that ${nextGrade(stats.predictedGrade) ?? 'A*'}!`
                  : '📅 Keep practising to improve!'}
              </p>
              {stats.streak > 0 && (
                <p style={{ color: '#f97316', fontSize: '12px', fontStyle: 'italic', margin: '4px 0 0', textAlign: 'center' }}>
                  🔥 Don't let the flame die!
                </p>
              )}
            </div>

            {/* Buttons pinned to bottom */}
            <div style={{ width: '100%', marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={canContinue ? () => navigate('/quiz') : () => setIsQuizModalOpen(true)}
                style={{
                  width: '100%', padding: '16px 24px',
                  backgroundColor: '#10b981', color: '#fff',
                  fontSize: '17px', fontWeight: '700',
                  border: 'none', borderRadius: '10px',
                  cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
                  letterSpacing: '0.01em',
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#059669';
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 6px 18px rgba(16,185,129,0.45)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#10b981';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 14px rgba(16,185,129,0.35)';
                }}
              >
                {canContinue ? '🔥 Resume Quiz' : '🚀 Start Quiz'}
              </button>

              <button
                onClick={() => navigate('/analytics')}
                style={{
                  width: '100%', padding: '12px 20px',
                  backgroundColor: '#2a2a2a', color: '#d1d5db',
                  fontSize: '14px', fontWeight: '600',
                  border: '1px solid #4a4a4a', borderRadius: '10px',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#333';
                  e.target.style.color = '#fff';
                  e.target.style.borderColor = '#6b7280';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#2a2a2a';
                  e.target.style.color = '#d1d5db';
                  e.target.style.borderColor = '#4a4a4a';
                }}
              >
                📊 View Analytics
              </button>
            </div>
          </div>

          {/* Stats cards grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '280px' }}>

            {/* Accuracy */}
            <StatCard
              emoji="🎯"
              label="Accuracy"
              value={loading ? '—' : `${stats.accuracy}%`}
              sub={loading ? '' : stats.totalQuestions > 0 ? `Over ${stats.totalQuestions} question${stats.totalQuestions !== 1 ? 's' : ''}` : 'No attempts yet'}
              subColor="#9ca3af"
            />

            {/* Questions Answered */}
            <StatCard
              emoji="📝"
              label="Questions Answered"
              value={loading ? '—' : stats.totalQuestions}
              sub={loading ? '' : stats.totalQuestions > 0 ? 'Total attempts' : 'Start a quiz!'}
              subColor="#9ca3af"
            />

            {/* Streak */}
            <StatCard
              emoji="🔥"
              label="Current Streak"
              value={loading ? '—' : `${stats.streak} day${stats.streak !== 1 ? 's' : ''}`}
              sub={loading ? '' : stats.streak > 0 ? 'Keep it going!' : 'Answer a question today!'}
              subColor={stats.streak > 0 ? '#10b981' : '#9ca3af'}
            />

          </div>
        </div>
      </div>

      {isQuizModalOpen && <QuizSetupModal onClose={() => setIsQuizModalOpen(false)} />}
    </div>
  );
}

// ─── Reusable stat card ────────────────────────────────────────
function StatCard({ emoji, label, value, sub, subColor = '#10b981' }) {
  return (
    <div
      style={{
        backgroundColor: '#242424',
        border: '1px solid #2a2a2a',
        borderRadius: '12px',
        padding: '20px',
        flex: 1,
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0, fontWeight: '500' }}>{label}</p>
        <span style={{ fontSize: '24px' }}>{emoji}</span>
      </div>
      <p style={{ color: '#fff', fontSize: '32px', fontWeight: 'bold', margin: 0, lineHeight: '1.2' }}>
        {value}
      </p>
      <p style={{ color: subColor, fontSize: '12px', margin: 0, marginTop: '4px' }}>
        {sub}
      </p>
    </div>
  );
}

export default Dashboard;