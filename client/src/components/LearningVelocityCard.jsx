
import React, { useState, useEffect } from 'react';

function LearningVelocityCard({ userid }) {
  const API_URL = import.meta.env.VITE_API_URL;
  const [velocity, setVelocity] = useState({
    questionsPerDay: 0,
    trend: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVelocity = async () => {
      try {
        const response = await fetch(`${API_URL}/analytics/learning-velocity/${userid}`);
        const data = await response.json();
        setVelocity(data);
      } catch (error) {
        console.error("Error fetching learning velocity:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userid) {
      fetchVelocity();
    }
  }, [userid, API_URL]);

  const getTrendColor = (trend) => {
    if (trend > 0) return '#10b981';
    if (trend < 0) return '#ef4444';
    return '#9ca3af';
  };

  const getTrendIcon = (trend) => {
    if (trend > 0) return '↗';
    if (trend < 0) return '↘';
    return '→';
  };

  return (
    <div style={{
      backgroundColor: '#2d2d2d',
      border: '1px solid #404040',
      borderRadius: '12px',
      padding: '20px',
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'default'
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
        marginBottom: '12px'
      }}>
        <p style={{ 
          color: '#9ca3af', 
          fontSize: '14px',
          margin: 0,
          fontWeight: '500'
        }}>
          Learning Velocity
        </p>
        <span style={{ fontSize: '24px' }}>⚡</span>
      </div>
      
      {loading ? (
        <div style={{
          height: '48px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{
            width: '60px',
            height: '16px',
            backgroundColor: '#404040',
            borderRadius: '4px'
          }} />
          <div style={{
            width: '80px',
            height: '12px',
            backgroundColor: '#404040',
            borderRadius: '4px'
          }} />
        </div>
      ) : (
        <div>
          <p style={{ 
            color: '#fff', 
            fontSize: '32px',
            fontWeight: 'bold',
            margin: 0,
            lineHeight: '1.2',
            marginBottom: '4px'
          }}>
            {velocity.questionsPerDay.toFixed(1)} <span style={{ fontSize: '16px', color: '#9ca3af' }}>/day</span>
          </p>
          <p style={{ 
            color: getTrendColor(velocity.trend), 
            fontSize: '12px',
            margin: 0,
            fontWeight: '600'
          }}>
            {getTrendIcon(velocity.trend)} {Math.abs(velocity.trend).toFixed(0)}% vs last week
          </p>
        </div>
      )}
    </div>
  );
}

export default LearningVelocityCard;