import React, {useEffect, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import GptInput from '../components/GptInput'
import WolframInput from '../components/WolframInput'
import { useAuth } from '../contexts/AuthContext';
import { useQuiz } from '../contexts/QuizContext';

function Dashboard() {
  const API_URL = import.meta.env.VITE_API_URL;
  const navigate = useNavigate();

  const { user, userid, logout } = useAuth();
  const { getQuizData, continueQuiz, setCurrentQuestion } = useQuiz();
  console.log("USER", user);
  const [canContinue, setCanContinue] = useState(false);

  useEffect(() => {
    document.title = "Dashboard";

    const checkQuiz = async () => {
      const result = await continueQuiz(userid);
      setCanContinue(result); // need to do this because otherwise we are
      // setting canContinue with a promise and not an actual boolean
      console.log("CAN CONTINUE", canContinue);
    };
    checkQuiz();
    setCurrentQuestion(1);
  }, [userid]);

  const loadQuiz = () => {
    // this is where the quizzes will be generated

    // getQuizData(user.id);
    navigate('/quiz');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  /*useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        console.log("dashboard")
        const token = localStorage.getItem('token');

        const response = await fetch(`${API_URL}/dashboard/get-user/${user.id}`, {
          method: "GET",
          headers: {
            'token': token,
            'Content-Type': 'application/json'
          }
        });

        /*if (response.status === 403) {
          localStorage.removeItem('token')
          navigate('/register')
        }

        const data = await response.json();

        // setName(data.username)
      } catch (error) {
        console.error('Failed to fetch dashboard', error.message)
      }
    }
    
    fetchDashboardData();
  }, [])*/
  

  return (
    <>
      <div className='title'>
        <h1>Welcome {user}</h1>
      </div>
      <button onClick={handleLogout}>
        Logout
      </button>
      
      <div>
        <button onClick={loadQuiz}>
          {canContinue ? "Resume Quiz" : "Start Quiz"}
        </button>
        <GptInput />
        <WolframInput />
      </div>
    </>
  )
}

export default Dashboard
