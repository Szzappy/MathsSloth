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

const GRADE_BANDS = [
  { min: 2000, label: 'A*', color: '#10b981' },
  { min: 1800, label: 'A',  color: '#10b981' },
  { min: 1600, label: 'B',  color: '#3b82f6' },
  { min: 1400, label: 'C',  color: '#3b82f6' },
  { min: 1200, label: 'D',  color: '#f59e0b' },
  { min: 1000, label: 'E',  color: '#f59e0b' },
  { min: 0,    label: 'U',  color: '#ef4444' },
];

function eloToGrade(elo) {
  for (const band of GRADE_BANDS) {
    if (elo >= band.min) return band;
  }
  return GRADE_BANDS[GRADE_BANDS.length - 1];
}

const tooltipStyles = {
  ...defaultStyles,
  backgroundColor: '#1e1e1e',
  color: 'white',
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid #10b981',
  fontSize: 12,
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
};

function GradeProgressChart({ userid, width = 750, height = 340 }) {
  const API_URL = import.meta.env.VITE_API_URL;
  const [progressData, setProgressData] = useState([]);
  const [loading, setLoading] = useState(true);

  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip();

  useEffect(() => {
    if (!userid) return;
    const fetchData = async () => {
      try {
        const res = await fetch(`${API_URL}/analytics/grade-progress/${userid}`);
        const raw = await res.json();
        const mapped = raw.map(d => ({
          date: new Date(d.date),
          elo: Number(d.weighted_elo),
          topicsIncluded: Number(d.topics_included) || 0,
          eloChangeFromStart: Number(d.elo_change_from_start) || 0,
          eloChangeFromPrev: d.elo_change_from_prev != null ? Number(d.elo_change_from_prev) : null,
        }));
        setProgressData(mapped);
      } catch (e) {
        console.error('Error fetching grade progress:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userid, API_URL]);

  if (loading) return (
    <div style={cardStyle}>
      <div style={centeredMsg}>Loading progress data...</div>
    </div>
  );

  if (progressData.length === 0) return (
    <div style={cardStyle}>
      <div style={centeredMsg}>No progress data yet — answer some questions to see your grade trend.</div>
    </div>
  );

  const margin = { top: 20, right: 24, bottom: 52, left: 64 };
  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;

  const allElos = progressData.map(d => d.elo).filter(Boolean);
  const minElo = Math.min(...allElos);
  const maxElo = Math.max(...allElos);
  const padding = Math.max(50, (maxElo - minElo) * 0.15);

  const dateScale = scaleTime({
    domain: [progressData[0].date, progressData[progressData.length - 1].date],
    range: [0, xMax],
    nice: true,
  });
  const eloScale = scaleLinear({
    domain: [Math.max(800, minElo - padding), Math.min(2200, maxElo + padding)],
    range: [yMax, 0],
    nice: true,
  });

  const bisectDate = bisector(d => d.date).left;

  const handleTooltip = (event) => {
    const { x } = localPoint(event) || { x: 0 };
    const x0 = dateScale.invert(x - margin.left);
    const i = bisectDate(progressData, x0, 1);
    const d0 = progressData[i - 1];
    const d1 = progressData[i];
    const d = d1 && (x0 - d0.date > d1.date - x0) ? d1 : d0;
    if (!d) return;
    showTooltip({
      tooltipData: d,
      tooltipLeft: dateScale(d.date) + margin.left,
      tooltipTop: eloScale(d.elo) + margin.top,
    });
  };

  const currentGrade = eloToGrade(progressData[progressData.length - 1]?.elo || 0);

  // Grade band reference lines
  const visibleBands = GRADE_BANDS.filter(b => {
    const y = eloScale(b.min);
    return y >= 0 && y <= yMax;
  });

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: 0 }}>Grade Progress</h3>
          <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
            Overall weighted ELO at end of each study day
            {progressData.length > 1 && (() => {
              const total = progressData[progressData.length - 1].eloChangeFromStart;
              const color = total >= 0 ? '#10b981' : '#ef4444';
              return <span style={{ color, marginLeft: 8, fontWeight: 600 }}>
                {total >= 0 ? '+' : ''}{total} ELO total
              </span>;
            })()}
          </div>
        </div>
        <div style={{
          backgroundColor: currentGrade.color + '22',
          border: `1px solid ${currentGrade.color}55`,
          borderRadius: 8,
          padding: '6px 14px',
          textAlign: 'center',
        }}>
          <div style={{ color: '#9ca3af', fontSize: 10, marginBottom: 2 }}>CURRENT</div>
          <div style={{ color: currentGrade.color, fontSize: 22, fontWeight: 700 }}>{currentGrade.label}</div>
          <div style={{ color: '#6b7280', fontSize: 11 }}>{progressData[progressData.length - 1]?.elo} ELO</div>
        </div>
      </div>

      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        <defs>
          <LinearGradient id="elo-gradient" from="#10b981" to="#059669" fromOpacity={0.35} toOpacity={0.03} vertical />
        </defs>

        <Group left={margin.left} top={margin.top}>
          {/* Grade band reference lines */}
          {visibleBands.map(band => (
            <g key={band.label}>
              <line
                x1={0} x2={xMax}
                y1={eloScale(band.min)} y2={eloScale(band.min)}
                stroke={band.color} strokeOpacity={0.15} strokeWidth={1}
                strokeDasharray="3,5"
              />
              <text
                x={xMax + 6} y={eloScale(band.min) + 4}
                fill={band.color} fontSize={9} opacity={0.6}
              >
                {band.label}
              </text>
            </g>
          ))}

          <GridRows scale={eloScale} width={xMax} stroke="#2a2a2a" numTicks={5} />

          <AreaClosed
            data={progressData}
            x={d => dateScale(d.date)}
            y={d => eloScale(d.elo)}
            yScale={eloScale}
            fill="url(#elo-gradient)"
            curve={curveMonotoneX}
          />

          {/* Line drawn as path manually for colour based on grade */}
          <Line
            data={progressData}
            x={d => dateScale(d.date)}
            y={d => eloScale(d.elo)}
            stroke="#10b981"
            strokeWidth={2.5}
            curve={curveMonotoneX}
          />

          {/* Data point dots */}
          {progressData.map((d, i) => (
            <circle
              key={i}
              cx={dateScale(d.date)}
              cy={eloScale(d.elo)}
              r={3}
              fill={eloToGrade(d.elo).color}
              stroke="#1a1a1a"
              strokeWidth={1.5}
            />
          ))}

          <AxisBottom
            top={yMax}
            scale={dateScale}
            numTicks={Math.min(6, progressData.length)}
            stroke="#333"
            tickStroke="#333"
            tickLabelProps={() => ({ fill: '#6b7280', fontSize: 10, textAnchor: 'middle', dy: 4 })}
          />
          <AxisLeft
            scale={eloScale}
            numTicks={5}
            stroke="#333"
            tickStroke="#333"
            tickLabelProps={() => ({ fill: '#6b7280', fontSize: 10, textAnchor: 'end', dx: -4 })}
            label="Weighted ELO"
            labelProps={{ fill: '#6b7280', fontSize: 11, textAnchor: 'middle' }}
            labelOffset={44}
          />

          {/* Invisible hover target */}
          <Bar x={0} y={0} width={xMax} height={yMax} fill="transparent"
            onMouseMove={handleTooltip} onMouseLeave={hideTooltip} />

          {tooltipData && (
            <>
              <line
                x1={dateScale(tooltipData.date)} x2={dateScale(tooltipData.date)}
                y1={0} y2={yMax}
                stroke="#444" strokeWidth={1} strokeDasharray="4,4" pointerEvents="none"
              />
              <circle
                cx={dateScale(tooltipData.date)} cy={eloScale(tooltipData.elo)}
                r={5} fill={eloToGrade(tooltipData.elo).color}
                stroke="white" strokeWidth={2} pointerEvents="none"
              />
            </>
          )}
        </Group>
      </svg>

      {tooltipOpen && tooltipData && (
        <Tooltip top={tooltipTop - 12} left={tooltipLeft + 12} style={tooltipStyles}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {tooltipData.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <div style={{ color: '#6b7280', fontSize: 10 }}>WEIGHTED ELO</div>
              <div style={{ color: eloToGrade(tooltipData.elo).color, fontWeight: 700, fontSize: 16 }}>
                {tooltipData.elo}
              </div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: 10 }}>GRADE</div>
              <div style={{ color: eloToGrade(tooltipData.elo).color, fontWeight: 700, fontSize: 16 }}>
                {eloToGrade(tooltipData.elo).label}
              </div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: 10 }}>DAY CHANGE</div>
              <div style={{ color: tooltipData.eloChangeFromPrev === null ? '#6b7280' : tooltipData.eloChangeFromPrev >= 0 ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: 16 }}>
                {tooltipData.eloChangeFromPrev === null ? '—' : (tooltipData.eloChangeFromPrev >= 0 ? '+' : '') + tooltipData.eloChangeFromPrev}
              </div>
            </div>
            <div>
              <div style={{ color: '#6b7280', fontSize: 10 }}>TOTAL GAIN</div>
              <div style={{ color: tooltipData.eloChangeFromStart >= 0 ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: 16 }}>
                {tooltipData.eloChangeFromStart >= 0 ? '+' : ''}{tooltipData.eloChangeFromStart}
              </div>
            </div>
          </div>
        </Tooltip>
      )}
    </div>
  );
}

const cardStyle = {
  backgroundColor: '#2d2d2d',
  border: '1px solid #404040',
  borderRadius: 12,
  padding: 24,
  position: 'relative',
};

const centeredMsg = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  minHeight: 200, color: '#6b7280', fontSize: 14,
};

export default GradeProgressChart;