import React, { useState, useEffect } from 'react';
import { AreaClosed, Line, Bar } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { GridRows, GridColumns } from '@visx/grid';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { LinearGradient } from '@visx/gradient';
import { Group } from '@visx/group';
import { Tooltip, useTooltip, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { bisector } from 'd3-array';

const tooltipStyles = {
  ...defaultStyles,
  backgroundColor: 'rgba(0, 0, 0, 0.95)',
  color: 'white',
  padding: 12,
  borderRadius: 4,
  border: '1px solid #555',
  fontSize: 12
};

function GradeProgressChart({ userid, width = 600, height = 400 }) {
  const API_URL = import.meta.env.VITE_API_URL;
  const [progressData, setProgressData] = useState([]);
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
    const fetchProgressData = async () => {
      try {
        const response = await fetch(`${API_URL}/analytics/grade-progress/${userid}`);
        const data = await response.json();
        // Transform data to include date objects
        const transformed = data.map(d => ({
          ...d,
          date: new Date(d.date),
          elo: parseFloat(d.avg_elo)
        }));
        setProgressData(transformed);
      } catch (error) {
        console.error("Error fetching grade progress:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userid) {
      fetchProgressData();
    }
  }, [userid, API_URL]);

  if (loading) {
    return (
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '12px',
        padding: '24px',
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#888'
      }}>
        Loading progress data...
      </div>
    );
  }

  if (progressData.length === 0) {
    return (
      <div style={{
        backgroundColor: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: '12px',
        padding: '24px',
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#888'
      }}>
        No progress data available
      </div>
    );
  }

  const margin = { top: 40, right: 40, bottom: 60, left: 60 };
  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;

  // Accessors
  const getDate = d => d.date;
  const getElo = d => d.elo;

  // Scales
  const dateScale = scaleTime({
    domain: [Math.min(...progressData.map(getDate)), Math.max(...progressData.map(getDate))],
    range: [0, xMax],
    nice: true
  });

  const eloScale = scaleLinear({
    domain: [
      Math.min(...progressData.map(getElo)) - 50,
      Math.max(...progressData.map(getElo)) + 50
    ],
    range: [yMax, 0],
    nice: true
  });

  // Bisector for tooltip
  const bisectDate = bisector(d => d.date).left;

  const handleTooltip = (event) => {
    const { x } = localPoint(event) || { x: 0 };
    const x0 = dateScale.invert(x - margin.left);
    const index = bisectDate(progressData, x0, 1);
    const d0 = progressData[index - 1];
    const d1 = progressData[index];
    let d = d0;
    if (d1 && getDate(d1)) {
      d = x0.valueOf() - getDate(d0).valueOf() > getDate(d1).valueOf() - x0.valueOf() ? d1 : d0;
    }
    showTooltip({
      tooltipData: d,
      tooltipLeft: dateScale(getDate(d)) + margin.left,
      tooltipTop: eloScale(getElo(d)) + margin.top,
    });
  };

  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '12px',
      padding: '24px',
      position: 'relative'
    }}>
      <h3 style={{ 
        color: '#fff', 
        fontSize: '18px', 
        fontWeight: '600',
        marginBottom: '16px',
        marginTop: 0
      }}>
        Grade Progress Over Time
      </h3>

      <svg width={width} height={height}>
        <LinearGradient id="area-gradient" from="#3b82f6" to="#1e40af" fromOpacity={0.4} toOpacity={0.1} />
        
        <Group left={margin.left} top={margin.top}>
          <GridRows
            scale={eloScale}
            width={xMax}
            stroke="#333"
            strokeOpacity={0.3}
            pointerEvents="none"
          />
          <GridColumns
            scale={dateScale}
            height={yMax}
            stroke="#333"
            strokeOpacity={0.3}
            pointerEvents="none"
          />

          {/* Area */}
          <AreaClosed
            data={progressData}
            x={d => dateScale(getDate(d))}
            y={d => eloScale(getElo(d))}
            yScale={eloScale}
            strokeWidth={0}
            fill="url(#area-gradient)"
            curve={curveMonotoneX}
          />

          {/* Line */}
          <Line
            data={progressData}
            x={d => dateScale(getDate(d))}
            y={d => eloScale(getElo(d))}
            stroke="#3b82f6"
            strokeWidth={2}
            curve={curveMonotoneX}
          />

          {/* Axes */}
          <AxisBottom
            top={yMax}
            scale={dateScale}
            numTicks={6}
            stroke="#666"
            tickStroke="#666"
            tickLabelProps={() => ({
              fill: '#ddd',
              fontSize: 10,
              textAnchor: 'middle'
            })}
          />
          <AxisLeft
            scale={eloScale}
            numTicks={6}
            stroke="#666"
            tickStroke="#666"
            tickLabelProps={() => ({
              fill: '#ddd',
              fontSize: 10,
              textAnchor: 'end',
              dx: -4
            })}
            label="ELO Rating"
            labelProps={{
              fill: '#ddd',
              fontSize: 12,
              textAnchor: 'middle'
            }}
          />

          {/* Invisible bar for tooltip */}
          <Bar
            x={0}
            y={0}
            width={xMax}
            height={yMax}
            fill="transparent"
            onMouseMove={handleTooltip}
            onMouseLeave={hideTooltip}
          />

          {/* Tooltip indicator */}
          {tooltipData && (
            <>
              <circle
                cx={dateScale(getDate(tooltipData))}
                cy={eloScale(getElo(tooltipData))}
                r={4}
                fill="#3b82f6"
                stroke="white"
                strokeWidth={2}
                pointerEvents="none"
              />
              <line
                x1={dateScale(getDate(tooltipData))}
                x2={dateScale(getDate(tooltipData))}
                y1={0}
                y2={yMax}
                stroke="#666"
                strokeWidth={1}
                strokeDasharray="4,4"
                pointerEvents="none"
              />
            </>
          )}
        </Group>
      </svg>

      {/* Tooltip */}
      {tooltipOpen && tooltipData && (
        <Tooltip top={tooltipTop} left={tooltipLeft} style={tooltipStyles}>
          <div>
            <strong>{tooltipData.date.toLocaleDateString()}</strong>
          </div>
          <div style={{ marginTop: 4 }}>
            ELO: <strong>{Math.round(tooltipData.elo)}</strong>
          </div>
          <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>
            {tooltipData.question_count} questions answered
          </div>
        </Tooltip>
      )}
    </div>
  );
}

export default GradeProgressChart;