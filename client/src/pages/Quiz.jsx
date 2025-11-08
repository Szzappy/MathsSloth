import React, { useState, useEffect, useRef } from 'react'
import {useNavigate} from 'react-router-dom'
import QuestionCard from '../components/QuestionCard';
import { useQuiz } from '../contexts/QuizContext.jsx';
import AnswerCard from '../components/AnswerCard.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

function Quiz() {
  const API_URL = import.meta.env.VITE_API_URL;
  const quizLoadedRef = useRef(false);

  const { userid } = useAuth();
  const { quiz, currentQuestion, getQuizData, showAnswerCard, continueQuiz } = useQuiz();

  //const [questions, setQuestions] = useState([]);
  //const [currentQuestion, setCurrentQuestion] = useState(1);

  // user does question
  // user hits submit answer
  // display answer card component
  // user hits next question
  // increment current question
  // if last question, go to results page

  // need useeffect to fetch quiz data on component mount
  useEffect(() => {
    document.title = "Quiz - Maths Sloth";

    const checkOngoingQuiz = async () => {
      const ongoing = await continueQuiz(userid);
      if (quizLoadedRef.current) return;
      quizLoadedRef.current = true;
      if (!ongoing) {
        getQuizData();
        console.log("new quiz fetched");
      }
    };
    checkOngoingQuiz();
  }, []);

  return (
    <>
      <div>
        {quiz.length === 0 ? (
          <p>Loading...</p>
        ) : (
          (() => {
            const q = quiz[currentQuestion - 1];
            return q ? (
              <div>
              <QuestionCard
                key={q.id}
                questionIndex={currentQuestion}
                question={q}
              />


              {showAnswerCard && <AnswerCard />}
              </div>

            ) : (
              <p>No question available</p>
            );
          })()
        )}
      </div>
    </>
  )
}

export default Quiz;