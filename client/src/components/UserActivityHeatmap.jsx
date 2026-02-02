import React, { useState, useEffect, useMemo } from 'react';
import { Group } from '@visx/group';
import { Tooltip, useTooltip, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';

// Color scheme for different activity levels
const colors = {
  none: '#1a1a1a',
  weak: '#3b82f6',      // 1-4 attempts
  medium: '#10b981',    // 5-9 attempts
  stronger: '#f59e0b',  // 10-14 attempts
  max: '#ef4444'        // 15+ attempts
};

export const background = '#0a0a0a';

function getColorForAttempts(count) {
  if (count === 0) return colors.none;
  if (count < 5) return colors.weak;
  if (count < 10) return colors.medium;
  if (count < 15) return colors.stronger;
  return colors.max;
}

function getIntensityCategory(count) {
  if (count === 0) return 'None';
  if (count < 5) return 'Weak (1-4)';
  if (count < 10) return 'Medium (5-9)';
  if (count < 15) return 'Stronger (10-14)';
  return 'Max (15+)';
}

const tooltipStyles = {
  ...defaultStyles,
  backgroundColor: 'rgba(0, 0, 0, 0.95)',
  color: 'white',
  padding: 12,
  borderRadius: 4,
  border: '1px solid #555',
  fontSize: 12
};

export default function UserActivityHeatmap({ 
  userid,
  cellSize = 14,
  cellGap = 3
}) {
  const API_URL = import.meta.env.VITE_API_URL;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip();

  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        const response = await fetch(`${API_URL}/analytics/question-attempts/${userid}`);
        const attempts = await response.json();
        setData(attempts);
      } catch (error) {
        console.error("Error fetching question attempts:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userid) {
      fetchAttempts();
    }
  }, [userid, API_URL]);

  // Process data into GitHub-style format (week columns, day rows)
  const calendarData = useMemo(() => {
    if (data.length === 0) return { weeks: [], dateMap: new Map() };
    
    const dateCountMap = new Map();
    const dateDetailsMap = new Map();
    
    // Aggregate attempts by date
    data.forEach(attempt => {
      const date = new Date(attempt.attempted_at);
      const dateKey = date.toISOString().split('T')[0];
      
      const current = dateCountMap.get(dateKey) || 0;
      dateCountMap.set(dateKey, current + 1);
      
      const details = dateDetailsMap.get(dateKey) || { 
        correct: 0, 
        total: 0, 
        times: []
      };
      
      details.total += 1;
      if (attempt.is_correct) details.correct += 1;
      if (attempt.time_taken) details.times.push(attempt.time_taken);
      
      dateDetailsMap.set(dateKey, details);
    });
    
    // Calculate averages
    dateDetailsMap.forEach((details, key) => {
      if (details.times.length > 0) {
        details.avgTime = Math.round(
          details.times.reduce((a, b) => a + b, 0) / details.times.length
        );
      }
      details.successRate = ((details.correct / details.total) * 100).toFixed(0);
    });
    
    // Set date range to last 3 months
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);
    
    // Start from the Sunday before the start date
    const firstDay = new Date(startDate);
    firstDay.setDate(firstDay.getDate() - firstDay.getDay());
    
    // End on the Saturday after the end date
    const lastDay = new Date(endDate);
    lastDay.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
    
    // Build week structure
    const weeks = [];
    const currentDate = new Date(firstDay);
    
    while (currentDate <= lastDay) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const count = dateCountMap.get(dateKey) || 0;
        const details = dateDetailsMap.get(dateKey);
        
        week.push({
          date: dateKey,
          dayOfWeek: i,
          count: count,
          details: details,
          displayDate: new Date(currentDate)
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
    }
    
    return { weeks, dateMap: dateCountMap };
  }, [data]);

  if (loading) {
    return (
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '12px',
        padding: '24px',
        height: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#888'
      }}>
        Loading activity data...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '12px',
        padding: '24px',
        height: '200px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#888'
      }}>
        No activity data available
      </div>
    );
  }

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const margin = { top: 60, right: 20, bottom: 20, left: 40 };
  const gridWidth = calendarData.weeks.length * (cellSize + cellGap);
  const gridHeight = 7 * (cellSize + cellGap);
  const svgWidth = gridWidth + margin.left + margin.right;
  const svgHeight = gridHeight + margin.top + margin.bottom;
  
  return (
    <div style={{ 
      position: 'relative',
      backgroundColor: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '12px',
      padding: '24px',
      overflow: 'auto'
    }}>
      <h3 style={{ 
        color: '#fff', 
        fontSize: '18px', 
        fontWeight: '600',
        marginBottom: '8px',
        marginTop: 0
      }}>
        Study Activity Heatmap
      </h3>
      <p style={{
        color: '#888',
        fontSize: '14px',
        marginTop: 0,
        marginBottom: '16px'
      }}>
        {data.length} attempts over {calendarData.weeks.length} weeks
      </p>

      <svg width={svgWidth} height={svgHeight}>
        <rect x={0} y={0} width={svgWidth} height={svgHeight} fill={background} rx={8} />
        
        <Group top={margin.top} left={margin.left}>
          {/* Day labels */}
          {dayLabels.map((day, i) => (
            <text
              key={`day-${i}`}
              x={-8}
              y={i * (cellSize + cellGap) + cellSize / 2 + 4}
              textAnchor="end"
              fontSize={10}
              fill="#888"
            >
              {day}
            </text>
          ))}
          
          {/* Month labels */}
          {calendarData.weeks.map((week, weekIndex) => {
            const firstDay = week[0].displayDate;
            if (firstDay.getDate() <= 7 || weekIndex === 0) {
              return (
                <text
                  key={`month-${weekIndex}`}
                  x={weekIndex * (cellSize + cellGap)}
                  y={-8}
                  fontSize={10}
                  fill="#888"
                >
                  {monthLabels[firstDay.getMonth()]}
                </text>
              );
            }
            return null;
          })}
          
          {/* Calendar cells */}
          {calendarData.weeks.map((week, weekIndex) => (
            week.map((day, dayIndex) => {
              const x = weekIndex * (cellSize + cellGap);
              const y = dayIndex * (cellSize + cellGap);
              
              return (
                <rect
                  key={`cell-${weekIndex}-${dayIndex}`}
                  x={x}
                  y={y}
                  width={cellSize}
                  height={cellSize}
                  rx={2}
                  fill={getColorForAttempts(day.count)}
                  stroke="#000"
                  strokeWidth={0.5}
                  onMouseMove={(event) => {
                    const coords = localPoint(event.target.ownerSVGElement, event);
                    showTooltip({
                      tooltipLeft: coords.x,
                      tooltipTop: coords.y,
                      tooltipData: day
                    });
                  }}
                  onMouseLeave={hideTooltip}
                  style={{ cursor: day.count > 0 ? 'pointer' : 'default' }}
                />
              );
            })
          ))}
        </Group>
      </svg>
      
      {/* Tooltip */}
      {tooltipOpen && tooltipData && (
        <Tooltip top={tooltipTop} left={tooltipLeft} style={tooltipStyles}>
          <div>
            <strong>{new Date(tooltipData.date).toLocaleDateString('en-US', { 
              weekday: 'short', 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric' 
            })}</strong>
          </div>
          <div style={{ marginTop: 8 }}>
            <div>Attempts: <strong>{tooltipData.count}</strong></div>
            {tooltipData.count > 0 && (
              <>
                <div>Category: <strong>{getIntensityCategory(tooltipData.count)}</strong></div>
                {tooltipData.details && (
                  <>
                    <div>Success Rate: <strong>{tooltipData.details.successRate}%</strong></div>
                    {tooltipData.details.avgTime > 0 && (
                      <div>Avg Time: <strong>{tooltipData.details.avgTime}s</strong></div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </Tooltip>
      )}
      
      {/* Legend */}
      <div style={{ 
        marginTop: 20, 
        display: 'flex', 
        justifyContent: 'flex-end', 
        alignItems: 'center',
        gap: 4,
        fontSize: '12px',
        color: '#888'
      }}>
        <span style={{ marginRight: 8 }}>Less</span>
        {[
          { label: '0', color: colors.none },
          { label: '1-4', color: colors.weak },
          { label: '5-9', color: colors.medium },
          { label: '10-14', color: colors.stronger },
          { label: '15+', color: colors.max }
        ].map(({ label, color }) => (
          <div 
            key={label} 
            style={{ 
              width: 14, 
              height: 14, 
              backgroundColor: color,
              border: '1px solid #000',
              borderRadius: 2
            }} 
            title={label}
          />
        ))}
        <span style={{ marginLeft: 8 }}>More</span>
      </div>
    </div>
  );
}