import React from 'react';

function TopicSelector({ topics, checkedTopics, onCheckboxChange }) {
  if (!topics || topics.length === 0) {
    return <p>Loading topics...</p>;
  }

  return (
    <div className="topic-list">
      {topics.map((topic) => {
        const isParent = !topic.parent_topic; // null or undefined means it's a parent
        const checkboxId = `topic-${topic.topicid}`;
        
        return (
          <div key={topic.topicid} className={isParent ? 'topic-item parent' : 'topic-item child'}>
            {!isParent && "\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0"} 
            <input
              type="checkbox"
              id={checkboxId}
              name={topic.topic_name}
              value={topic.topicid}
              checked={checkedTopics[topic.topicid] || false}
              onChange={() => onCheckboxChange(topic.topicid, isParent, topic.topic_code)}
            />
            <label htmlFor={checkboxId}>
              {topic.topic_code} {topic.topic_name}
            </label>
          </div>
        );
      })}
    </div>
  );
}

export default TopicSelector;