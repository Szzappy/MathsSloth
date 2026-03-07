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
  const [confidence, setConfidence] = useState(null);

  const [overallResults, setOverallResults] = useState(null);
  const [individualTopicStats, setIndividualTopicStats] = useState([]);

  // Quiz configuration
  const [quizType, setQuizType] = useState('');
  const [quizMode, setQuizMode] = useState('');
  const [customTopics, setCustomTopics] = useState([]);
  const [numQuestions, setNumQuestions] = useState(10);
  const [lowerDifficulty, setLowerDifficulty] = useState(1);
  const [upperDifficulty, setUpperDifficulty] = useState(5);
  const [usingAdaptiveDifficulty, setUsingAdaptiveDifficulty] = useState(true);

  // Answer state
  const [showAnswerCard, setShowAnswerCard] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);

  // Multi-part state
  const [currentPart, setCurrentPart] = useState(0);
  const [completedParts, setCompletedParts] = useState([]);

  // Result state
  const [answerResult, setAnswerResult] = useState(null);
  const [gradingStatus, setGradingStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL;

  // ============================================================
  //  HELPERS
  // ============================================================

  const getActiveQuestion = () => {
    const q = quiz[currentQuestion - 1];
    if (!q) return null;
    if (q.parts && q.parts.length > 0) return q.parts[currentPart];
    return q;
  };

  const hasParts = () => {
    const q = quiz[currentQuestion - 1];
    return !!(q?.parts && q.parts.length > 0);
  };

  // Recalculate canSubmit whenever relevant state changes
  useEffect(() => {
    if (showAnswerCard) {
      setCanSubmit(false);
      return;
    }
    const activeQ = getActiveQuestion();
    if (!activeQ) {
      setCanSubmit(false);
      return;
    }

    const hasConfidence = confidence !== null;
    let hasAnswer = false;

    if (activeQ.question_format === 'multiple_choice') {
      hasAnswer = selectedOption !== null;
    } else if (activeQ.question_format === 'feynman') {
      hasAnswer = userAnswer.trim().length > 0;
    } else {
      // self_mark: just needs confidence, no pre-answer input
      hasAnswer = true;
    }

    setCanSubmit(hasConfidence && hasAnswer);
  }, [confidence, selectedOption, userAnswer, currentQuestion, currentPart, showAnswerCard, quiz]);

  // ============================================================
  //  QUIZ LOADING
  // ============================================================

  const setCustomParameters = (quizMode, topics, numQuestions, lowerDifficulty, upperDifficulty, usingAdaptiveDifficulty) => {
    setQuizMode(quizMode);
    setCustomTopics(topics);
    setNumQuestions(numQuestions);
    setLowerDifficulty(lowerDifficulty);
    setUpperDifficulty(upperDifficulty);
    setUsingAdaptiveDifficulty(usingAdaptiveDifficulty);
  };

  const continueQuiz = async (userid) => {
    if (!userid) return false;
    try {
      const response = await fetch(`${API_URL}/quiz/${userid}`, {
        method: "GET",
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data.questions) && data.questions !== null) {
        setQuiz(data.questions);
        setQuizid(data.quizid);
        // If resuming mid-way through a multi-part question, pre-populate
        // completedParts so already-answered parts show greyed-out
        const firstQ = data.questions[0];
        if (firstQ?.doneParts?.length > 0) {
          setCompletedParts(firstQ.doneParts);
        }
        return true;
      }
      setQuiz([]);
      return false;
    } catch (error) {
      console.log("Error checking ongoing quiz:", error.message);
      return false;
    }
  };

  const getTopics = async () => {
    try {
      const response = await fetch(`${API_URL}/quiz/topics`, { method: "GET" });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setTopics(Array.isArray(data.topics) ? data.topics : []);
    } catch (error) {
      console.log("Error fetching topics:", error.message);
      setTopics([]);
    }
  };

  const getResults = async (userid) => {
    try {
      const response = await fetch(`${API_URL}/quiz/results/${userid}`, {
        method: "GET",
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setOverallResults(data.results);
      setIndividualTopicStats(data.individualTopicStats);
    } catch (error) {
      console.log("Error fetching quiz results:", error.message);
    }
  };

  const getQuizData = async () => {
    try {
      const response = await fetch(`${API_URL}/quiz/${quizType}`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userid, quiz_type: quizType, quiz_mode: quizMode,
          topics: customTopics, custom_question_count: numQuestions,
          custom_difficulty_min: lowerDifficulty, custom_difficulty_max: upperDifficulty,
          using_custom_difficulty: !usingAdaptiveDifficulty
        })
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data.questions)) {
        setQuiz(data.questions);
        setQuizid(data.quizid);
      } else {
        setQuiz([]);
      }
    } catch (error) {
      console.log("Error fetching quiz data:", error.message);
      setQuiz([]);
    }
  };

  // ============================================================
  //  ANSWER SUBMISSION
  // ============================================================

  // self_mark: fetch mark scheme and show interactive marking UI
  const getAnswer = async () => {
    const activeQ = getActiveQuestion();
    try {
      const response = await fetch(`${API_URL}/quiz/mark-scheme/${activeQ.questionid}`, {
        method: "GET"
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setMarkScheme(Array.isArray(data.markScheme) ? data.markScheme : []);
    } catch (error) {
      console.log("Error fetching mark scheme:", error.message);
      setMarkScheme([]);
    }
    setShowAnswerCard(true);
    setCanSubmit(false);
  };

  // multiple_choice + feynman: server-graded
  const submitAnswer = async () => {
    const activeQ = getActiveQuestion();
    if (!activeQ) return;

    try {
      if (activeQ.question_format === 'feynman') {
        // ── FEYNMAN: submit to pending endpoint, then trigger AI grading ──
        setIsSubmitting(true);
        const response = await fetch(`${API_URL}/quiz/answer/feynman`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userid,
            questionid: activeQ.questionid,
            quizid,
            user_answer: userAnswer,
            confidence: parseInt(confidence),
            time_taken: 0
          })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        // Grading is now synchronous — marks_awarded and feedback come back immediately
        setAnswerResult({ ...data, type: 'feynman', user_answer: userAnswer });
        setGradingStatus(data.grading_status ?? 'graded');
        setShowAnswerCard(true);
        setCanSubmit(false);
        setIsSubmitting(false);

      } else if (activeQ.question_format === 'multiple_choice') {
        // ── MCQ: server auto-grades, returns is_correct + correct_answer ──
        const response = await fetch(`${API_URL}/quiz/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userid,
            questionid: activeQ.questionid,
            quizid,
            user_answer: selectedOption,
            confidence: parseInt(confidence),
            time_taken: 0
          })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        // Flatten the response so MCQResult can access all fields directly
        setAnswerResult({
          is_correct: data.is_correct,
          marks_awarded: data.marks_awarded,
          marks_available: data.marks_available,
          correct_answer: data.correct_answer,
          user_answer: selectedOption,   // ← store selected label directly for highlighting
          type: 'multiple_choice'
        });
        setGradingStatus('graded');
        setShowAnswerCard(true);
        setCanSubmit(false);
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      setIsSubmitting(false);
    }
  };

  const gradeFeynman = async (attemptId, questionId) => {
    try {
      const response = await fetch(`${API_URL}/hints/grade-feynman`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, userId: userid, questionId })
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setAnswerResult(prev => ({
        ...prev,
        marks_awarded: data.marks_awarded,
        feedback: data.feedback,
      }));
      setGradingStatus('graded');
    } catch (error) {
      console.error("Error grading feynman answer:", error);
      setGradingStatus('failed');
    }
  };

  // ============================================================
  //  SILLY MISTAKE
  //  Re-submits the last MCQ attempt with silly_mistake=true so the
  //  backend can halve the ELO penalty via a corrective INSERT.
  // ============================================================

  const reportSillyMistake = async () => {
    const activeQ = getActiveQuestion();
    if (!activeQ || !answerResult) return;
    try {
      await fetch(`${API_URL}/quiz/answer/silly-mistake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userid,
          questionid: activeQ.questionid,
          quizid,
        }),
      });
    } catch (err) {
      console.error('Error reporting silly mistake:', err);
    }
  };

  // ============================================================
  //  NAVIGATION
  // ============================================================

  const nextQuestion = () => {
    const q = quiz[currentQuestion - 1];
    const questionHasParts = q?.parts && q.parts.length > 0;

    if (questionHasParts && currentPart < q.parts.length - 1) {
      setCompletedParts(prev => [...prev, {
        ...q.parts[currentPart],
        submittedAnswer: selectedOption || userAnswer
      }]);
      setCurrentPart(prev => prev + 1);
    } else {
      setCurrentQuestion(prev => prev + 1);
      setCurrentPart(0);
      setCompletedParts([]);
    }

    setShowAnswerCard(false);
    setCanSubmit(false);
    setUserAnswer('');
    setSelectedOption(null);
    setConfidence(null);
    setMarkScheme([]);
    setAnswerResult(null);
    setGradingStatus(null);
  };

  // ============================================================
  //  MATHS RENDERING
  // ============================================================

  const renderQuestionWithMaths = (text) => {
    if (!text) return null;
    const parts = text.split(/(\$[^$]+\$)/);
    return parts.map((part, index) => {
      if (part.startsWith('$') && part.endsWith('$')) {
        return <InlineMath key={index} math={part.slice(1, -1)} />;
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <QuizContext.Provider value={{
      quiz, quizid, topics,
      currentQuestion, setCurrentQuestion, currentPart, completedParts,
      getQuizData, continueQuiz, getTopics, getResults,
      setQuizType, setCustomParameters,
      overallResults, individualTopicStats,
      showAnswerCard, canSubmit,
      userAnswer, setUserAnswer,
      selectedOption, setSelectedOption,
      confidence, setConfidence,
      answerResult, gradingStatus, isSubmitting,
      markScheme,
      getAnswer, submitAnswer, nextQuestion, reportSillyMistake,
      getActiveQuestion, hasParts,
      renderQuestionWithMaths,
    }}>
      {children}
    </QuizContext.Provider>
  );
};

export const useQuiz = () => {
  const context = useContext(QuizContext);
  if (!context) throw new Error("useQuiz must be used within a QuizProvider");
  return context;
};