import React from 'react'
import { useQuiz } from '../contexts/QuizContext.jsx';

function AnswerCard() {
  const { markScheme, renderQuestionWithMaths, nextQuestion } = useQuiz();

  return (
    <div>
      <h1>Mark Scheme</h1>
      {markScheme.length === 0 ? (
        <p>Loading mark scheme...</p>
      ) : (
        <>
          <ul>
            {markScheme.map((item, index) => (
              <li key={item.mark_scheme_item_id || index}>
                <strong>Step {index + 1}:</strong> {renderQuestionWithMaths(item.item_description)}
                <em> ({item.marks_available} marks)</em>
              </li>
            ))}
          </ul>
          <button onClick={nextQuestion}>Next Question</button>
        </>
      )}
    </div>
  );
}

export default AnswerCard;
