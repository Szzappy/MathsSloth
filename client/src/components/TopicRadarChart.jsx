import React, { useState, useEffect } from 'react';
import { Group } from '@visx/group';
import { scaleLinear } from '@visx/scale';
import { Point } from '@visx/point';
import { Line } from '@visx/shape';

const blue = '#3b82f6';
const darkBlue = '#1e40af';
const silver = '#444';
const background = '#0a0a0a';

function TopicRadarChart({ userid, width = 600, height = 600, levels = 5 }) {
  const API_URL = import.meta.env.VITE_API_URL;
  const [topicData, setTopicData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopicElos = async () => {
      try {
        const response = await fetch(`${API_URL}/analytics/topic-elos/${userid}`);
        const data = await response.json();
        
        // Group by parent topic and calculate averages
        const parentTopics = {};
        
        data.forEach(topic => {
          const parentKey = topic.parent_topic || topic.topic_code;
          
          if (!parentTopics[parentKey]) {
            parentTopics[parentKey] = {
              topic_name: topic.parent_topic ? topic.parent_topic : topic.topic_name,
              topic_code: parentKey,
              elo_ratings: [],
            };
          }
          
          // Convert string to number
          if (topic.elo_rating) {
            parentTopics[parentKey].elo_ratings.push(parseFloat(topic.elo_rating));
          }
        });
        
        // Calculate averages and create final data
        const processedTopics = Object.values(parentTopics)
          .map(parent => ({
            ...parent,
            elo_rating: parent.elo_ratings.length > 0
              ? parent.elo_ratings.reduce((a, b) => a + b, 0) / parent.elo_ratings.length
              : 1500
          }))
          .filter(topic => topic.elo_ratings.length > 0)
          .slice(0, 12);
        
        setTopicData(processedTopics);
      } catch (error) {
        console.error("Error fetching topic ELOs:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userid) {
      fetchTopicElos();
    }
  }, [userid, API_URL]);

  if (loading) {
    return (
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '12px',
        padding: '24px',
        height: '600px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#888'
      }}>
        Loading radar chart...
      </div>
    );
  }

  if (topicData.length === 0) {
    return (
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '12px',
        padding: '24px',
        height: '600px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#888'
      }}>
        No topic data available
      </div>
    );
  }

  const margin = { top: 60, right: 80, bottom: 80, left: 80 };
  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;
  const radius = Math.min(xMax, yMax) / 2;

  // Get ELO values
  const getElo = d => d.elo_rating;

  // Calculate min/max with proper padding
  const allElos = topicData.map(getElo);
  const minElo = Math.min(...allElos);
  const maxElo = Math.max(...allElos);
  const eloRange = maxElo - minElo;
  
  // Add 20% padding on both sides, minimum 100 points
  const padding = Math.max(eloRange * 0.2, 100);
  const domainMin = minElo - padding;
  const domainMax = maxElo + padding;

  // Scales
  const yScale = scaleLinear({
    range: [0, radius],
    domain: [domainMin, domainMax],
  });

  // Generate points for axes
  const genPoints = (length, radius) => {
    const step = (Math.PI * 2) / length;
    return [...new Array(length)].map((_, i) => ({
      x: radius * Math.sin(i * step),
      y: radius * Math.cos(i * step),
    }));
  };

  // Generate polygon points for data
  const genPolygonPoints = (dataArray, scale, getValue) => {
    const step = (Math.PI * 2) / dataArray.length;
    const points = [];
    let pointString = '';
    
    dataArray.forEach((d, i) => {
      const value = getValue(d);
      const scaledValue = scale(value) ?? 0;
      const xVal = scaledValue * Math.sin(i * step);
      const yVal = scaledValue * Math.cos(i * step);
      points.push({ x: xVal, y: yVal, value });
      pointString += `${xVal},${yVal} `;
    });
    
    return { points, pointString };
  };

  const points = genPoints(topicData.length, radius);
  const polygonPoints = genPolygonPoints(topicData, yScale, getElo);
  const zeroPoint = new Point({ x: 0, y: 0 });

  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '12px',
      padding: '24px'
    }}>
      <h3 style={{ 
        color: '#fff', 
        fontSize: '18px', 
        fontWeight: '600',
        marginBottom: '16px',
        marginTop: 0
      }}>
        Topic Performance Comparison
      </h3>
      
      <svg width={width} height={height}>
        <rect fill={background} width={width} height={height} rx={8} />
        <Group top={height / 2} left={width / 2}>
          {/* Concentric circles (web levels) - FIXED */}
          {[...new Array(levels)].map((_, i) => {
            const levelRadius = ((i + 1) * radius) / levels;
            const levelValue = yScale.invert(levelRadius);
            
            return (
              <g key={`web-${i}`}>
                {/* Circle */}
                <circle
                  r={levelRadius}
                  fill="none"
                  stroke={silver}
                  strokeWidth={1}
                  strokeOpacity={0.5}
                  strokeDasharray="4,4"
                />
                {/* Level label */}
                <text
                  x={5}
                  y={-levelRadius + 5}
                  fontSize={10}
                  fill="#666"
                  textAnchor="start"
                >
                  {Math.round(levelValue)}
                </text>
              </g>
            );
          })}
          
          {/* Axis lines */}
          {[...new Array(topicData.length)].map((_, i) => (
            <Line 
              key={`radar-line-${i}`} 
              from={zeroPoint} 
              to={points[i]} 
              stroke={silver} 
              strokeWidth={1}
            />
          ))}
          
          {/* Data polygon */}
          <polygon
            points={polygonPoints.pointString}
            fill={blue}
            fillOpacity={0.2}
            stroke={blue}
            strokeWidth={2}
          />
          
          {/* Data points */}
          {polygonPoints.points.map((point, i) => (
            <g key={`radar-point-${i}`}>
              <circle 
                cx={point.x} 
                cy={point.y} 
                r={4} 
                fill={blue}
                stroke={darkBlue}
                strokeWidth={2}
              />
              <title>
                {topicData[i].topic_name}: {Math.round(topicData[i].elo_rating)} ELO
              </title>
            </g>
          ))}
          
          {/* Labels */}
          {topicData.map((topic, i) => {
            const angle = (Math.PI * 2 / topicData.length) * i;
            const labelRadius = radius + 40;
            const x = labelRadius * Math.sin(angle);
            const y = labelRadius * Math.cos(angle);
            
            const displayName = topic.topic_name.length > 20 
              ? topic.topic_name.substring(0, 17) + '...' 
              : topic.topic_name;
            
            return (
              <text
                key={`label-${i}`}
                x={x}
                y={y}
                fontSize={11}
                fill="#ddd"
                textAnchor={x > 5 ? 'start' : x < -5 ? 'end' : 'middle'}
                dominantBaseline="middle"
              >
                {displayName}
              </text>
            );
          })}
        </Group>
      </svg>

      <div style={{ 
        marginTop: '16px', 
        textAlign: 'center',
        color: '#888',
        fontSize: '12px'
      }}>
        Hover over points to see ELO ratings • Showing {topicData.length} topic areas
      </div>
    </div>
  );
}

export default TopicRadarChart;