
import React, { useState, useEffect } from 'react';

function StreakCard({ userid }) {
  const API_URL = import.meta.env.VITE_API_URL;
  const [streakData, setStreakData] = useState({
    currentStreak: 0,
    longestStreak: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStreakData = async () => {
      try {
        const response = await fetch(`${API_URL}/analytics/streak/${userid}`);
        const data = await response.json();
        setStreakData(data);
      } catch (error) {
        console.error("Error fetching streak data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userid) {
      fetchStreakData();
    }
  }, [userid, API_URL]);

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
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
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
          Study Streak
        </p>
        <span style={{ fontSize: '24px' }}>🔥</span>
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
            {streakData.currentStreak} days
          </p>
          <p style={{ 
            color: '#666', 
            fontSize: '12px',
            margin: 0
          }}>
            Longest: {streakData.longestStreak} days
          </p>
        </div>
      )}
    </div>
  );
}

export default StreakCard;