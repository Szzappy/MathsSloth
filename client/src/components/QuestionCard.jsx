import React from 'react'
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';

function QuestionCard({ question }) {
  // Component only handles rendering and user interactions

  const renderQuestionWithMath = (text) => {
    // Split the text into parts around the $ delimiters
    const parts = text.split(/(\$[^$]+\$)/);
    
    return parts.map((part, index) => {
      // Check if this part is LaTeX (starts and ends with $)
      if (part.startsWith('$') && part.endsWith('$')) {
        // Extract the maths content (remove the $ delimiters)
        const mathContent = part.slice(1, -1);
        return <InlineMath key={index} math={mathContent} />;
      } else {
        // This is regular text
        return <span key={index}>{part}</span>;
      }
    });
  };

  return (
    <div className="question-card">
      <h1>Q</h1>
      <p>{renderQuestionWithMath(question.question_text)}</p>
      <p>Difficulty: {question.difficulty}</p>
      <p>Marks: {question.total_marks}</p>
      {/* Render question content */}
      <img src={`${question.image_url}`} 
                                 alt="Question diagram" 
                                 style={{ maxWidth: '500px', border: '1px solid #ddd' }}/>
    </div>
  );
}

export default QuestionCard;
