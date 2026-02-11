import React, {useEffect, useState } from 'react';

const getUserTopicEloAndGrade = async (userid) => {
  const API_URL = import.meta.env.VITE_API_URL;

  try {
    const response = await fetch(`${API_URL}/analytics/topic-elos/${userid}`, {
      method: "GET",
      headers: {
        'Content-Type': 'application/json',
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.log("Error fetching topic elos", error.message);
    return null;
  }
};

const getGradeFromElo = (elo) => {
  if (elo >= 2000) return { grade: 9, color: '#10b981' };
  if (elo >= 1800) return { grade: 8, color: '#10b981' };
  if (elo >= 1600) return { grade: 7, color: '#3b82f6' };
  if (elo >= 1400) return { grade: 6, color: '#3b82f6' };
  if (elo >= 1200) return { grade: 5, color: '#f59e0b' };
  if (elo >= 1000) return { grade: 4, color: '#f59e0b' };
  return { grade: 3, color: '#ef4444' };
};

function TopicEloAndGradeCard({userid, user}) {
  const [topicElos, setTopicElos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopicElos = async () => {
      const data = await getUserTopicEloAndGrade(userid);
      if (data) {
        setTopicElos(data);
      }
      setLoading(false);
    };

    if (userid) {
      fetchTopicElos();
    }
  }, [userid]);

  return (
    <div style={{
      backgroundColor: '#2d2d2d',
      border: '1px solid #404040',
      borderRadius: '12px',
      padding: '24px',
      minHeight: '300px'
    }}>
      <h3 style={{ 
        color: '#fff', 
        fontSize: '18px', 
        fontWeight: '600',
        marginBottom: '16px',
        marginTop: 0
      }}>
        Topic ELO and Grade Card for: {user}
      </h3>

      {loading ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
          color: '#9ca3af'
        }}>
          Loading topic data...
        </div>
      ) : topicElos.length === 0 ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
          color: '#9ca3af'
        }}>
          No topic data available
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {topicElos.map((topic) => {
            const elo = parseFloat(topic.elo_rating);
            const { grade, color } = getGradeFromElo(elo);
            
            return (
              <div 
                key={topic.topic_code}
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #404040',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
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
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    color: '#d1d5db', 
                    fontSize: '14px',
                    fontWeight: '600',
                    marginBottom: '4px'
                  }}>
                    {topic.topic_code} - {topic.topic_name}
                  </div>
                  <div style={{ 
                    color: '#9ca3af', 
                    fontSize: '12px'
                  }}>
                    ELO: {Math.round(elo)}
                  </div>
                </div>
                <div style={{
                  backgroundColor: color,
                  color: 'white',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  minWidth: '50px',
                  textAlign: 'center'
                }}>
                  {grade}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TopicEloAndGradeCard;