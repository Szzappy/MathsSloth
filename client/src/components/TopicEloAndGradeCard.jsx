import React, {useEffect, useState } from 'react'

const getUserTopicEloAndGrade = async (userid) => {
  const API_URL = import.meta.env.VITE_API_URL;

  try {
    const response = await fetch(`${API_URL}/analytics/topic-elos/${userid}`, {
      method: "GET",
      headers: {
        'Content-Type': 'application/json',
      }
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.log("Error fetching topic elos", error.message);
    return null;
  }
};

function TopicEloAndGradeCard({userid, user}) {

  const [topicElos, setTopicElos] = useState([]);

  useEffect(() => {
    const fetchTopicElos = async () => {
      const data = await getUserTopicEloAndGrade(userid);
      if (data) {
        setTopicElos(data);
      }
    };

    if (userid) {
      fetchTopicElos();
    }
  }, [userid]);

  return (
    // map through topic elos and display them
    <div>
      <h2>Topic ELO and Grade Card for: {user}</h2>
      {/* Implement the display of topic ELOs and grades here */}
      <ul>
        {topicElos.map((topic) => (
          <li key={topic.topic_code}>
            Topic: {topic.topic_code} {topic.topic_name} | ELO: {topic.elo_rating}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default TopicEloAndGradeCard
