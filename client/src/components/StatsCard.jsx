import React from 'react';

function StatsCard({ title, value, loading, suffix = '', prefix = '', icon = '' }) {
  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '12px',
      padding: '20px',
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'default'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
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
        <p style={{ 
          color: '#888', 
          fontSize: '14px',
          margin: 0,
          fontWeight: '500'
        }}>
          {title}
        </p>
        {icon && (
          <span style={{ fontSize: '24px' }}>{icon}</span>
        )}
      </div>
      
      {loading ? (
        <div style={{
          height: '36px',
          display: 'flex',
          alignItems: 'center'
        }}>
          <div style={{
            width: '80px',
            height: '20px',
            backgroundColor: '#333',
            borderRadius: '4px',
            animation: 'pulse 1.5s ease-in-out infinite'
          }} />
        </div>
      ) : (
        <p style={{ 
          color: '#fff', 
          fontSize: '32px',
          fontWeight: 'bold',
          margin: 0,
          lineHeight: '1.2'
        }}>
          {prefix}{value !== null && value !== undefined ? value : '—'}{suffix}
        </p>
      )}
    </div>
  );
}

export default StatsCard;