import React from 'react'
import { useQuiz } from '../contexts/QuizContext.jsx';

function QuestionCard() {
  // Component only handles rendering and user interactions

  const { getAnswer, canSubmit, renderQuestionWithMaths, currentQuestion, quiz, setConfidence, confidence } = useQuiz();

  const handleSubmit = (e) => {
    e.preventDefault();

    getAnswer();
  }

  const question = quiz[currentQuestion - 1];

  return (<>
    <div className="question-card">
        <h1>Q{question.question_order || currentQuestion}</h1>
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
      {/* Submit button */}
      
      <h2>Confidence Log</h2>
      <p>How confident are you in your answer?</p>
      <div>
        <label>
          <input type="radio" name="confidence" value="1" checked={confidence === "1"} onChange={(e) => setConfidence(e.target.value)} />
          1 - Not Confident
        </label>
      </div>
      <div>
        <label>
          <input type="radio" name="confidence" value="2" checked={confidence === "2"} onChange={(e) => setConfidence(e.target.value)} />
          2 - Somewhat Confident
        </label>
      </div>
      <div>
        <label>
          <input type="radio" name="confidence" value="3" checked={confidence === "3"} onChange={(e) => setConfidence(e.target.value)} />
          3 - Neutral
        </label>
      </div>
      <div>
        <label>
          <input type="radio" name="confidence" value="4" checked={confidence === "4"} onChange={(e) => setConfidence(e.target.value)} />
          4 - Confident
        </label>
      </div>
      <div>
        <label>
          <input type="radio" name="confidence" value="5" checked={confidence === "5"} onChange={(e) => setConfidence(e.target.value)} />
          5 - Very Confident
        </label>
      </div>

      {canSubmit && <button onClick={handleSubmit}>{question.question_format == "self_mark" ? "Check Answer" : "Submit Answer"}</button>}
  </>
  );
}

export default QuestionCard;