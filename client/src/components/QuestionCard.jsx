import React from 'react'
import { useQuiz } from '../contexts/QuizContext.jsx';

function QuestionCard() {
  // Component only handles rendering and user interactions

  const { getAnswer, canSubmit, renderQuestionWithMaths, currentQuestion, quiz } = useQuiz();

  const handleSubmit = (e) => {
    e.preventDefault();

    getAnswer();
  }

  const question = quiz[currentQuestion - 1];

  return (<>
    <div className="question-card">
        <h1>Q{currentQuestion}</h1>
        <p>{renderQuestionWithMaths(question.question_text)}</p>
        {/* <p>Difficulty: {question.difficulty}</p> */}
        <p>Marks: {question.total_marks}</p>
        {/* Render question content */}
        {question.image_url && (
          <img src={`${question.image_url}`} 
               alt="Question diagram" 
               style={{ maxWidth: '500px', border: '1px solid #ddd' }}/>
        )}
      </div>
      {canSubmit && <button onClick={handleSubmit}>Submit Answer</button>}
  </>
    
  );
}

export default QuestionCard;
