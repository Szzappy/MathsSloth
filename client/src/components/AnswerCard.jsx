import React from 'react'
import { useQuiz } from '../contexts/QuizContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

function AnswerCard() {
  const { quizid, currentQuestion, markScheme, renderQuestionWithMaths, nextQuestion, quiz } = useQuiz();
  const API_URL = import.meta.env.VITE_API_URL;
  const { user, userid } = useAuth();

  const handleButtonClick = (item) => {
    // give button green highlight on click, then remove if clicked again
    const button = document.getElementById(`button-${item.mark_scheme_item_id}`);
    button.classList.toggle('active');
    // if is_mandatory step, change to purple, else green
    button.style.backgroundColor = button.classList.contains('active') ? (item.is_mandatory ? 'purple' : 'lightgreen') : '';

    // if button was just selected, check if any of the previous mandatory ones are not selected
    // button.classList.contains('active') is true means it was just selected
    if (button.classList.contains('active')) {
      const mandatoryItems = markScheme.filter(msItem => msItem.is_mandatory && msItem.mark_scheme_item_id < item.mark_scheme_item_id); // get all previous mandatory items

      // check if all previous mandatory items are selected
      const allMandatorySelected = mandatoryItems.every(msItem => {
        const msButton = document.getElementById(`button-${msItem.mark_scheme_item_id}`);
        return msButton && msButton.classList.contains('active');
      });
      if (!allMandatorySelected) {
        button.classList.remove('active');
        button.style.backgroundColor = '';
      }
    }
    console.log(`Clicked on mark scheme item: ${item.mark_scheme_item_id}`);
  };

  // function when submitting answer
  const handleSubmit = async (e) => {
    e.preventDefault();
    const selectedItems = markScheme.filter(item => {
      const button = document.getElementById(`button-${item.mark_scheme_item_id}`);
      return button && button.classList.contains('active');
    });
    console.log('Selected mark scheme items:', selectedItems);

    // Things to send to backend
    /* 
    userid
    questionid
    quizid

    marks_awarded
    marks_available

    question_difficulty
    */

    const response = await fetch(`${API_URL}/quiz/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userid: userid,
        questionid: quiz[currentQuestion - 1].questionid,
        quizid: quizid,
        marks_awarded: selectedItems.reduce((acc) => acc + 1, 0), // add 1 for each selected item
        marks_available: quiz[currentQuestion - 1].total_marks,
        question_difficulty: quiz[currentQuestion - 1].difficulty,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log("Response from server:", data);
    } else {
      console.error("Error submitting answer:", response.statusText);
    }

    nextQuestion();
  };

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
                <button id={`button-${item.mark_scheme_item_id}`} onClick={() => handleButtonClick(item)}>
                    <strong>Step {index + 1}:</strong> 
                    {item.is_mandatory && <span style={{ color: 'red' }}> Mandatory </span>}
                    {renderQuestionWithMaths(item.item_description)}
                   <em> ({item.marks_available} {item.marks_available === 1 ? 'mark' : 'marks'})</em>
                </button>
              </li>
            ))}
          </ul>
          <button onClick={handleSubmit}>Next Question</button>
        </>
      )}
    </div>
  );
}

export default AnswerCard;
