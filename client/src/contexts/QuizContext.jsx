import { useContext, createContext, useState } from 'react'
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';

const QuizContext = createContext();

export const QuizProvider = ({ children }) => {
  const [quiz, setQuiz] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [markScheme, setMarkScheme] = useState([]);

  const [showAnswerCard, setShowAnswerCard] = useState(false);
  const [canSubmit, setCanSubmit] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL;

  const getQuizData = async () => {
    try {
        const response = await fetch(`${API_URL}/quiz/get-quiz`, {
          method: "GET"
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("DATA", data.questions);
        
        // Ensure data is an array
        if (Array.isArray(data.questions)) {
          setQuiz(data.questions);
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
    <QuizContext.Provider value={{ quiz, currentQuestion, getQuizData, markScheme, nextQuestion, getAnswer, showAnswerCard, canSubmit, renderQuestionWithMaths }}>
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
