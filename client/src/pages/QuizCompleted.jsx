import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom';
import { useQuiz } from '../contexts/QuizContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

function QuizCompleted() {
  const { getResults, overallResults, individualTopicStats } = useQuiz();
  const { user, userid } = useAuth();
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [resultsFetched, setResultsFetched] = useState(false);

  // persist upon reload
  useEffect(() => {
    document.title = "Quiz Completed - Maths Sloth";
    if (!userid) return;
    getResults(userid).then(() => setLoading(false));
  }, [userid]);

  return (
    <>
    {loading ? (<p>Loading results...</p>
  ) : (
    <div>
    <h1>Quiz complete!</h1>
    <p>Marks: {overallResults?.total_marks_awarded ?? 0} / {overallResults?.total_marks_available ?? 0}</p>
    <h2>Topic Breakdown:</h2>
    <ul>
      {individualTopicStats.length === 0 ? (
        <p>No topic statistics available.</p>
      ) : (
        individualTopicStats.map((topicStat, index) => (
          <li key={index}>
            {topicStat.topic_code} {topicStat.topic_name}: {topicStat.marks_awarded}/{topicStat.marks_available}
          </li>
        ))
      )}
    </ul>
    <button onClick={() => navigate('/dashboard')}>Return to Dashboard</button>
    <button onClick={() => navigate('/analytics')}>View Analytics</button>
  </div>
  )}
  </>
  )
}

export default QuizCompleted
