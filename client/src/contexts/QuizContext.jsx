import { useContext, createContext, useState, useEffect } from 'react'
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';
import { useAuth } from './AuthContext';

const QuizContext = createContext();

export const QuizProvider = ({ children }) => {
  const [quiz, setQuiz] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [markScheme, setMarkScheme] = useState([]);
  const { user, userid } = useAuth();
  const [quizid, setQuizid] = useState(null);
  const [topics, setTopics] = useState([]);

  const [overallResults, setOverallResults] = useState(null);
  const [individualTopicStats, setIndividualTopicStats] = useState([]);

  // custom quiz parameters
  const [quizType, setQuizType] = useState('custom'); 
  const [quizMode, setQuizMode] = useState('');
  const [customTopics, setCustomTopics] = useState([]);
  const [numQuestions, setNumQuestions] = useState(10);
  const [lowerDifficulty, setLowerDifficulty] = useState(1);
  const [upperDifficulty, setUpperDifficulty] = useState(5);
  const [usingAdaptiveDifficulty, setUsingAdaptiveDifficulty] = useState(true);

  const [showAnswerCard, setShowAnswerCard] = useState(false);
  const [canSubmit, setCanSubmit] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL;

  /*useEffect(() => {
    // want to check if there is an ongoing quiz for the user
    // if so then set that quiz data instead of fetching new quiz
    // set a boolean to true if there is an ongoing quiz
    console.log("USER IN QUIZ CONTEXT", userid);
    if (userid && continueQuiz(userid)) {
      setOngoingQuiz(true);
      console.log("Ongoing quiz found");
    }
    else {
      setOngoingQuiz(false);
    }

  }, []);*/

  const setCustomParameters = (quizType, quizMode, topics, numQuestions, lowerDifficulty, upperDifficulty, usingAdaptiveDifficulty) => {
    setQuizType(quizType);
    setQuizMode(quizMode);
    setCustomTopics(topics);
    setNumQuestions(numQuestions);
    setLowerDifficulty(lowerDifficulty);
    setUpperDifficulty(upperDifficulty);
    setUsingAdaptiveDifficulty(usingAdaptiveDifficulty);
  }

  const continueQuiz = async (userid) => {
    console.log("CHECKING ONGOING QUIZ FOR USERID", userid);
    if (!userid) return false;
    try {
      const response = await fetch(`${API_URL}/quiz/${userid}`, {
        method: "GET",
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("ONGOING QUIZ DATA", data);
      // Ensure data is an array and not null
      if (Array.isArray(data.questions) && data.questions !== null) {
        setQuiz(data.questions);
        setQuizid(data.quizid);
        console.log("true");
        return true;
      } else {
        // console.error("Expected array but got:", typeof data);
        setQuiz([]);
        return false;
      }
    } catch (error) {
      console.log("Error fetching already quiz data", error.message);
      return false;
    }
  };

  const getTopics = async () => {
    try {
        const response = await fetch(`${API_URL}/quiz/topics`, {
          method: "GET"
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (Array.isArray(data.topics)) {
          setTopics(data.topics);
        } else {
          console.error("Expected array but got:", typeof data);
          setTopics([]);
        }
      } catch (error) {
        console.log("Error fetching topics", error.message);
        setTopics([]);
      }
  };

  const getResults = async (userid) => {
    try {
      const response = await fetch(`${API_URL}/quiz/results/${userid}`, {
        method: "GET",
        headers: {
          'Content-Type': 'application/json',
        }
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log("Quiz results data", data);
      setOverallResults(data.results);
      setIndividualTopicStats(data.individualTopicStats);
    } catch (error) {
      console.log("Error fetching quiz results", error.message);
    }
  };

  const getQuizData = async () => {
    try {
        const response = await fetch(`${API_URL}/quiz`, {
          method: "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userid, quiz_type: quizType, quiz_mode: quizMode, 
            topics: customTopics, custom_question_count: numQuestions, 
            custom_difficulty_min: lowerDifficulty, custom_difficulty_max: upperDifficulty, 
            using_custom_difficulty: !usingAdaptiveDifficulty })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("DATA", data.questions);
        
        // Ensure data is an array
        if (Array.isArray(data.questions)) {
          setQuiz(data.questions);
          setQuizid(data.quizid);
        } else {
          console.error("Expected array but got:", typeof data);
          setQuiz([]);
        }
      } catch (error) {
        console.log("Error fetching quiz data", error.message);
        setQuiz([]);
      }
  };

  const getAnswer = async () => {
    try {
        const response = await fetch(`${API_URL}/quiz/get-mark-scheme/${quiz[currentQuestion - 1].questionid}`, {
          method: "GET"
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("ms", data.markScheme);
        
        // Ensure data is an array
        if (Array.isArray(data.markScheme)) {
          setMarkScheme(data.markScheme);
        } else {
          console.error("Expected array but got:", typeof data);
          setMarkScheme([]);
        }
      } catch (error) {
        console.log("Error fetching quiz data", error.message);
        setMarkScheme([]);
      }
    setShowAnswerCard(true);
    setCanSubmit(false);
    console.log("Mark Scheme:", markScheme[currentQuestion - 1] );
  };

  const renderQuestionWithMaths = (text) => {
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

  const nextQuestion = () => {
    setCurrentQuestion((prev) => prev + 1);
    setShowAnswerCard(false);
    setCanSubmit(true);
  };

  return (
    <QuizContext.Provider value={{ quiz, quizid, currentQuestion, setCurrentQuestion, getQuizData, markScheme, nextQuestion, 
                                  getAnswer, showAnswerCard, canSubmit, renderQuestionWithMaths, continueQuiz, getTopics, topics, setCustomParameters,
                                  getResults, overallResults, individualTopicStats }}>
      {children}
    </QuizContext.Provider>
  )
}

export const useQuiz = () => {
  const context = useContext(QuizContext)
  if (!context) {
    throw new Error("useQuiz must be used within a QuizProvider");
  }
  return context;
}
