import React, { useState, useEffect } from 'react'
import {useNavigate} from 'react-router-dom'
import QuestionCard from '../components/QuestionCard';

function Quiz() {
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL;

  const [questions, setQuestions] = useState([]);

  const backToDash = () => {
    navigate('/dashboard');
  };

  useEffect(() => {
    const getQuiz = async () => {
      try {
        const response = await fetch(`${API_URL}/quiz/get-quiz`, {
          method: "GET"
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("DATA", data);
        
        // Ensure data is an array
        if (Array.isArray(data)) {
          setQuestions(data);
        } else {
          console.error("Expected array but got:", typeof data);
          setQuestions([]);
        }
      } catch (error) {
        console.log("Error fetching questions", error.message);
        setQuestions([]);
      }
    }

    getQuiz();
  }, []);


  return (<>
    <h1>QUIZ</h1>
    <button onClick={backToDash}>Go back to dashboard</button>
    <div>
      {questions.map(question => (
        <QuestionCard 
          key={question.id}
          question={question}
          />
      ))}
    </div>
  </>)
}

export default Quiz;