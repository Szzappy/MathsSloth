import React from 'react';

const getConfidenceLevels = async (userid) => {
  const API_URL = import.meta.env.VITE_API_URL;

  try {
    const response = await fetch(`${API_URL}/analytics/confidence/${userid}`, {
      method: "GET",
      headers: {
        'Content-Type': 'application/json',
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.log("Error fetching confidence levels", error.message);
    return null;
  }
}

function ConfidenceLevelsCard({userid, user}) {
  const [confidenceLevels, setConfidenceLevels] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchConfidenceLevels = async () => {
      const data = await getConfidenceLevels(userid);
      if (data) {
        setConfidenceLevels(data);
      }
      setLoading(false);
    };
    if (userid) {
      fetchConfidenceLevels();
    }
  }, [userid]);

  const getConfidenceColor = (confidence) => {
    if (confidence >= 4.5) return '#10b981'; // Green - Excellent
    if (confidence >= 3.5) return '#3b82f6'; // Blue - Good
    if (confidence >= 2.5) return '#f59e0b'; // Orange - Fair
    return '#ef4444'; // Red - Needs Practice
  };

  const getConfidenceLabel = (confidence) => {
    if (confidence >= 4.5) return 'Excellent';
    if (confidence >= 3.5) return 'Good';
    if (confidence >= 2.5) return 'Fair';
    return 'Needs Practice';
  };

  const getConfidenceStars = (confidence) => {
    const fullStars = Math.floor(confidence);
    const hasHalfStar = confidence % 1 >= 0.5;
    let stars = '★'.repeat(fullStars);
    if (hasHalfStar) stars += '☆';
    stars += '☆'.repeat(5 - Math.ceil(confidence));
    return stars;
  };

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
        Confidence Levels for: {user}
      </h3>

      {loading ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
          color: '#9ca3af'
        }}>
          Loading confidence data...
        </div>
      ) : confidenceLevels.length === 0 ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '200px',
          color: '#9ca3af'
        }}>
          No confidence data available
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {confidenceLevels.map((level) => {
            const confidence = parseFloat(level.average_confidence);
            return (
              <div 
                key={level.topic_code}
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #404040',
                  borderRadius: '8px',
                  padding: '16px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateX(4px)';
                  e.currentTarget.style.borderColor = getConfidenceColor(confidence);
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
                  marginBottom: '8px'
                }}>
                  <span style={{ 
                    color: '#d1d5db', 
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    {level.topic_code}
                  </span>
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{ 
                      color: getConfidenceColor(confidence),
                      fontSize: '18px',
                      letterSpacing: '2px'
                    }}>
                      {getConfidenceStars(confidence)}
                    </span>
                    <span style={{ 
                      color: getConfidenceColor(confidence),
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      {confidence.toFixed(1)}/5
                    </span>
                  </div>
                </div>
                
                {/* Progress bar */}
                <div style={{
                  width: '100%',
                  height: '6px',
                  backgroundColor: '#404040',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${(confidence / 5) * 100}%`,
                    height: '100%',
                    backgroundColor: getConfidenceColor(confidence),
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                
                <div style={{
                  marginTop: '4px',
                  fontSize: '12px',
                  color: getConfidenceColor(confidence),
                  fontWeight: '500'
                }}>
                  {getConfidenceLabel(confidence)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ConfidenceLevelsCard;