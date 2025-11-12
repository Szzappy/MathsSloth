import React, { useState } from 'react';
import { useQuiz } from '../contexts/QuizContext';
import TopicSelector from './TopicSelector';
import {useNavigate} from 'react-router-dom'

function QuizSetupModal({ onClose }) {
  const [index, setIndex] = useState(0);
  const { getTopics, topics, setCustomParameters } = useQuiz();
  const [checkedTopics, setCheckedTopics] = useState({});
  const [numQuestions, setNumQuestions] = useState(10);
  const [lowerDifficulty, setLowerDifficulty] = useState(1);
  const [upperDifficulty, setUpperDifficulty] = useState(5);
  const [useAdaptiveDifficulty, setUseAdaptiveDifficulty] = useState(true); 
  const [quizType, setQuizType] = useState('custom'); // 'tailored' or 'custom'
  const [quizMode, setQuizMode] = useState('');

  const navigate = useNavigate();

  // parameters needed
  // - number of questions - at least as much as the topics selected
  // - difficulty
  // - selected topics


  const getChildren = (parentTopicCode) => {
    return topics.filter(topic => topic.parent_topic === parentTopicCode);
  };

  const handleParentChange = (parentId, parentTopicCode, checked) => {
    const children = getChildren(parentTopicCode);
    const updates = { [parentId]: checked };
    
    children.forEach(child => {
      updates[child.topicid] = checked;
    });
    
    setCheckedTopics(prev => ({ ...prev, ...updates }));
  };

  // Handle individual checkbox change
  const handleCheckboxChange = (topicId, isParent, topicCode) => {
    const checked = !checkedTopics[topicId];
    
    if (isParent) {
      handleParentChange(topicId, topicCode, checked);
    } else {
      // Individual child checkbox
      setCheckedTopics(prev => ({ ...prev, [topicId]: checked }));
    }
  };

  // Get selected topic codes for when you submit
  const getSelectedTopics = () => {
    return Object.keys(checkedTopics)
      .filter(id => checkedTopics[id])
      .map(id => parseInt(id));
  };

  const closeModal = () => {
    onClose();
  };

  const handleTopicsNext = () => {
    const selectedTopics = getSelectedTopics();
    if (selectedTopics.length === 0) {
      alert('Please select at least one topic');
      return;
    }
    console.log('Selected topics:', selectedTopics);
    setIndex(3);
  };

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Quiz Time</h2>
          <button className="close-btn" onClick={closeModal}>×</button>
        </div>

        {/* Step 0: Choose quiz type */}
        {index === 0 && (
          <div className="quiz-setup-step">
            <p>Pick a category</p>
            <div className="button-group">
              <button className="setup-btn" onClick={() => {setIndex(1); setQuizType('tailored');}}>Tailored</button>
              <button className="setup-btn" onClick={() => {setIndex(2); getTopics(); setQuizType('custom'); }}>Custom</button>
            </div>
          </div>
        )}

        {/* Step 1: Tailored quiz */}
        {index === 1 && (
          <div className="quiz-setup-step">
            <h3>Tailored Quiz</h3>
            <p>Coming soon...</p>
            <button onClick={() => setIndex(0)}>Back</button>
          </div>
        )}

        {/* Step 2: Select topics */}
        {index === 2 && (
          <div className="quiz-setup-step">
            <h3>Select Topics</h3>
            <TopicSelector 
              topics={topics}
              checkedTopics={checkedTopics}
              onCheckboxChange={handleCheckboxChange}
            />
            <div className="button-group">
              <button className="back-btn" onClick={() => setIndex(0)}>Back</button>
              <button className="next-btn" onClick={handleTopicsNext}>Next</button>
            </div>
          </div>
        )}

        {/* Step 3: Additional settings */}
        {index === 3 && (
          <div className="quiz-setup-step">
            <h3>Quiz Settings</h3>
            <p>Number of questions, difficulty, etc.</p>
            <p>Number of Questions:</p>
            <input type="number" 
              value={numQuestions} 
              onChange={(e) => setNumQuestions(parseInt(e.target.value))}
            />
            <input type="checkbox"
              checked={useAdaptiveDifficulty}
              onChange={(e) => setUseAdaptiveDifficulty(e.target.checked)}
            /> Use Adaptive Difficulty

            {!useAdaptiveDifficulty && (<>
            <p>Difficulty Range:</p>
            <input type="number" 
              value={lowerDifficulty} 
              onChange={(e) => setLowerDifficulty(parseInt(e.target.value))}
            />
            <input type="number" 
              value={upperDifficulty} 
              onChange={(e) => setUpperDifficulty(parseInt(e.target.value))}
            />
            </>)}
            <div className="button-group">
              <button className="back-btn" onClick={() => setIndex(2)}>Back</button>
              <button className="next-btn" onClick={() => {
                setCustomParameters(quizType, quizMode, getSelectedTopics(), numQuestions, lowerDifficulty, upperDifficulty, useAdaptiveDifficulty);
                navigate('/quiz');
              }}>
                Start Quiz
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuizSetupModal;