import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import TopicEloAndGradeCard from '../components/TopicEloAndGradeCard';
import ConfidenceLevelsCard from '../components/ConfidenceLevelsCard';
import UserActivityHeatmap from '../components/UserActivityHeatmap';
import TopicRadarChart from '../components/TopicRadarChart';
import GradeProgressChart from '../components/GradeProgressChart';
import StreakCard from '../components/StreakCard';
import LearningVelocityCard from '../components/LearningVelocityCard';
import StatsCard from '../components/StatsCard';

function Analytics() {
  const API_URL = import.meta.env.VITE_API_URL;
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [predictedGrade, setPredictedGrade] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user, userid } = useAuth();

  useEffect(() => {
    const fetchQuestionsAnswered = async () => {
      try {
        console.log("Fetching questions answered for user");
        const response = await fetch(`${API_URL}/analytics/questions-answered/${userid}`);
        const data = await response.json();
        setQuestionsAnswered(data.questions_answered);
      } catch (error) {
        console.error("Error fetching questions answered:", error);
      }
    };

    const fetchPredictedGrade = async () => {
      try {
        const response = await fetch(`${API_URL}/analytics/predicted-grade/${userid}`);
        const data = await response.json();
        setPredictedGrade(data.predicted_grade);
      } catch (error) {
        console.error("Error fetching predicted grade:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userid) {
      fetchQuestionsAnswered();
      fetchPredictedGrade();
    }
  }, [userid, API_URL]);

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#1a1a1a',
      padding: '24px'
    }}>
      <div style={{ 
        maxWidth: '1600px',
        margin: '0 auto'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: 'bold', 
            color: '#fff',
            marginBottom: '8px',
            margin: 0
          }}>
            📊 Analytics Dashboard
          </h1>
          <p style={{ 
            color: '#9ca3af', 
            fontSize: '14px',
            margin: 0,
            marginTop: '8px'
          }}>
            Track your learning progress and performance metrics
          </p>
        </div>

        {/* Top Stats Row */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '20px',
          marginBottom: '24px'
        }}>
          <StatsCard 
            title="Questions Answered"
            value={questionsAnswered}
            loading={loading}
            icon="📝"
          />
          <StatsCard 
            title="Predicted Grade"
            value={predictedGrade !== null ? Math.round(predictedGrade) : null}
            loading={loading}
            suffix=" ELO"
            icon="🎯"
          />
          <StreakCard userid={userid} />
          <LearningVelocityCard userid={userid} />
        </div>

        {/* Main Content Grid */}
        <div style={{ 
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          {/* Topic ELO and Grade - Full Width */}
          <TopicEloAndGradeCard userid={userid} user={user} />
          
          {/* Charts Row - Side by Side */}
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(550px, 1fr))',
            gap: '24px'
          }}>
            {/* Grade Progress Over Time */}
            <GradeProgressChart userid={userid} />
            
            {/* Topic Radar Chart */}
            <TopicRadarChart userid={userid} />
          </div>

          {/* Heatmap and Confidence Row - Side by Side */}
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
            gap: '24px'
          }}>
            {/* Activity Heatmap */}
            <UserActivityHeatmap userid={userid} user={user} />
            
            {/* Confidence Levels */}
            <ConfidenceLevelsCard userid={userid} user={user} />
          </div>
        </div>

        {/* Footer Spacing */}
        <div style={{ height: '40px' }} />
      </div>
    </div>
  );
}

export default Analytics;