import React from 'react'

const getConfidenceLevels = async (userid) => {
  const API_URL = import.meta.env.VITE_API_URL;

  try {
    const response = await fetch(`${API_URL}/analytics/confidence/${userid}`, {
      method: "GET",
      headers: {
        'Content-Type': 'application/json',
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.log("Error fetching confidence levels", error.message);
    return null;
  }
}


function ConfidenceLevelsCard({userid, user}) {
  const [confidenceLevels, setConfidenceLevels] = React.useState([]);

  React.useEffect(() => {
    const fetchConfidenceLevels = async () => {
      const data = await getConfidenceLevels(userid);
      if (data) {
        setConfidenceLevels(data);
      }
    };
    if (userid) {
      fetchConfidenceLevels();
    }
  }, [userid]);

  return (
    <div>
      <h1>Confidence Levels for: {user}</h1>
      <ul>
        {confidenceLevels.map((level) => (
          <li key={level.topic_code}>
            Topic: {level.topic_code} | Average Confidence: {level.average_confidence}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default ConfidenceLevelsCard
