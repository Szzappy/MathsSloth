import React from 'react';

function TopicSelector({ topics, checkedTopics, onCheckboxChange }) {
  if (!topics || topics.length === 0) {
    return (
      <p style={{
        color: '#9ca3af',
        textAlign: 'center',
        padding: '20px'
      }}>
        Loading topics...
      </p>
    );
  }

  return (
    <div style={{
      maxHeight: '400px',
      overflowY: 'auto',
      backgroundColor: '#1a1a1a',
      border: '1px solid #404040',
      borderRadius: '8px',
      padding: '16px'
    }}>
      {topics.map((topic) => {
        const isParent = !topic.parent_topic;
        const checkboxId = `topic-${topic.topicid}`;
        
        return (
          <div 
            key={topic.topicid}
            style={{
              padding: '10px',
              marginBottom: '4px',
              borderRadius: '6px',
              transition: 'background-color 0.2s',
              paddingLeft: isParent ? '10px' : '40px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#262626'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <label 
              htmlFor={checkboxId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                color: isParent ? '#fff' : '#d1d5db',
                fontSize: '14px',
                fontWeight: isParent ? '600' : '400'
              }}
            >
              <input
                type="checkbox"
                id={checkboxId}
                name={topic.topic_name}
                value={topic.topicid}
                checked={checkedTopics[topic.topicid] || false}
                onChange={() => onCheckboxChange(topic.topicid, isParent, topic.topic_code)}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                  accentColor: '#10b981'
                }}
              />
              <span>
                {topic.topic_code} {topic.topic_name}
              </span>
            </label>
          </div>
        );
      })}
    </div>
  );
}

export default TopicSelector;