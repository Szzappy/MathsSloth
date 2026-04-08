import React, { useEffect, useState } from 'react';

const ACCENT   = '#67e8f9'; // cyan
const DIM      = '#374151'; // grey track / empty bars
const TEXT_HI  = '#f3f4f6'; // near-white labels
const TEXT_MID = '#9ca3af'; // secondary labels
const TEXT_LO  = '#4b5563'; // tertiary / metadata

// opacity scales with calibration score so the ring fades when confidence is way off
const ringOpacity = score => 0.25 + (score / 100) * 0.75;

const calibrationLabel = (gap) => {
  const abs = Math.abs(gap);
  if (abs <= 10) return 'Well calibrated';
  if (gap > 10)  return 'Overconfident';
  return 'Underconfident';
};

// circular progress ring showing calibration score - fades as the gap widens
function CalibrationRing({ score, size = 44 }) {
  const r      = (size - 6) / 2;
  const circ   = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const op     = ringOpacity(score);

  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={DIM} strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={ACCENT} strokeWidth={4} opacity={op}
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.5s ease, opacity 0.5s ease' }}
      />
      <text
        x={size / 2} y={size / 2 + 4}
        textAnchor="middle"
        fill={ACCENT} fillOpacity={op}
        fontSize={10} fontWeight={700}
      >
        {score}
      </text>
    </svg>
  );
}

// thin horizontal bar used for confidence and accuracy
function Bar({ pct, accent = false }) {
  return (
    <div style={{ width: '100%', height: 3, backgroundColor: DIM, borderRadius: 2, overflow: 'hidden' }}>
      <div style={{
        width: `${pct}%`,
        height: '100%',
        borderRadius: 2,
        backgroundColor: accent ? ACCENT : TEXT_MID,
        opacity: accent ? 0.85 : 0.55,
        transition: 'width 0.4s ease',
      }} />
    </div>
  );
}

// single subtopic row - shown when a parent row is expanded
function SubtopicCalibRow({ topic }) {
  const conf  = parseFloat(topic.avg_confidence);
  const acc   = parseFloat(topic.accuracy);
  const score = parseInt(topic.calibration_score);
  const gap   = parseFloat(topic.calibration_gap);

  return (
    <div style={{
      display: 'flex',
      gap: 10,
      padding: '10px 12px',
      borderRadius: 7,
      backgroundColor: '#181818',
      border: '1px solid #1f2937',
      alignItems: 'center',
    }}>
      {/* accent bar - opacity reflects calibration score */}
      <div style={{
        width: 2,
        height: 44,
        flexShrink: 0,
        borderRadius: 1,
        backgroundColor: ACCENT,
        opacity: ringOpacity(score),
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
          <span style={{ color: TEXT_MID, fontSize: 11, fontWeight: 700 }}>{topic.topic_code}</span>
          <span style={{ color: TEXT_HI,  fontSize: 13, fontWeight: 500 }}>{topic.topic_name}</span>
          <span style={{ color: TEXT_LO,  fontSize: 10, marginLeft: 'auto' }}>{topic.attempt_count} attempts</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 14px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: TEXT_LO,  fontSize: 10 }}>CONFIDENCE</span>
              <span style={{ color: TEXT_MID, fontSize: 10, fontWeight: 600 }}>{conf.toFixed(1)}/5</span>
            </div>
            <Bar pct={(conf / 5) * 100} accent />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ color: TEXT_LO,  fontSize: 10 }}>ACCURACY</span>
              <span style={{ color: TEXT_MID, fontSize: 10, fontWeight: 600 }}>{acc.toFixed(0)}%</span>
            </div>
            <Bar pct={acc} accent={false} />
          </div>
        </div>

        <div style={{ marginTop: 5 }}>
          <span style={{ color: TEXT_MID, fontSize: 10, fontWeight: 500 }}>{calibrationLabel(gap)}</span>
          {Math.abs(gap) > 5 && (
            <span style={{ color: TEXT_LO, fontSize: 10, marginLeft: 6 }}>
              ({gap > 0 ? '+' : ''}{gap.toFixed(0)}pp)
            </span>
          )}
        </div>
      </div>

      <CalibrationRing score={score} size={44} />
    </div>
  );
}

// parent topic row - click to expand/collapse subtopics
function ParentCalibRow({ group, expanded, onToggle }) {
  const hasChildren = group.children.length > 0;
  const score       = parseInt(group.avgScore);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div
        onClick={hasChildren ? onToggle : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          borderRadius: 9,
          backgroundColor: '#222',
          border: `1px solid ${expanded && hasChildren ? '#374151' : '#1f2937'}`,
          cursor: hasChildren ? 'pointer' : 'default',
          transition: 'background-color 0.15s, border-color 0.2s',
          userSelect: 'none',
        }}
        onMouseEnter={e => hasChildren && (e.currentTarget.style.backgroundColor = '#262626')}
        onMouseLeave={e => hasChildren && (e.currentTarget.style.backgroundColor = '#222')}
      >
        {/* chevron rotates when expanded */}
        <div style={{
          width: 14,
          flexShrink: 0,
          color: hasChildren ? TEXT_MID : 'transparent',
          fontSize: 9,
          transition: 'transform 0.2s',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>
          {hasChildren ? '▶' : ''}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
            <span style={{ color: TEXT_MID, fontSize: 11, fontWeight: 700 }}>{group.code}</span>
            <span style={{ color: TEXT_HI,  fontSize: 14, fontWeight: 600 }}>{group.name}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ color: TEXT_LO,  fontSize: 10 }}>AVG CONFIDENCE</span>
                <span style={{ color: TEXT_MID, fontSize: 10, fontWeight: 600 }}>{group.avgConf.toFixed(1)}/5</span>
              </div>
              <Bar pct={(group.avgConf / 5) * 100} accent />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ color: TEXT_LO,  fontSize: 10 }}>AVG ACCURACY</span>
                <span style={{ color: TEXT_MID, fontSize: 10, fontWeight: 600 }}>{group.avgAcc.toFixed(0)}%</span>
              </div>
              <Bar pct={group.avgAcc} accent={false} />
            </div>
          </div>

          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: TEXT_MID, fontSize: 10, fontWeight: 500 }}>
              {calibrationLabel(group.avgGap)}
            </span>
            {hasChildren && (
              <span style={{ color: TEXT_LO, fontSize: 10 }}>{group.children.length} subtopics</span>
            )}
          </div>
        </div>

        <CalibrationRing score={score} size={50} />
      </div>

      {/* subtopic rows - only rendered when expanded */}
      {hasChildren && expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 20 }}>
          {group.children
            .sort((a, b) => a.topic_code.localeCompare(b.topic_code))
            .map(child => <SubtopicCalibRow key={child.topic_code} topic={child} />)
          }
        </div>
      )}
    </div>
  );
}

// groups flat topic list into parent/child structure and rolls up averages
function groupCalibByParent(topics) {
  if (!Array.isArray(topics)) return [];

  const parentMap = new Map();

  for (const t of topics) {
    const parentCode = t.parent_topic || t.topic_code;
    const parentName = t.parent_topic_name || t.topic_name;

    if (!parentMap.has(parentCode)) {
      parentMap.set(parentCode, { code: parentCode, name: parentName, children: [], _self: null });
    }

    if (t.parent_topic) parentMap.get(parentCode).children.push(t);
    else parentMap.get(parentCode)._self = t;
  }

  return Array.from(parentMap.values()).map(group => {
    const all = group.children.length > 0
      ? group.children
      : (group._self ? [group._self] : []);

    return {
      ...group,
      avgScore: Math.round(all.reduce((s, t) => s + parseInt(t.calibration_score), 0) / Math.max(1, all.length)),
      avgConf: all.reduce((s, t) => s + parseFloat(t.avg_confidence), 0) / Math.max(1, all.length),
      avgAcc: all.reduce((s, t) => s + parseFloat(t.accuracy), 0) / Math.max(1, all.length),
      avgGap: all.reduce((s, t) => s + parseFloat(t.calibration_gap), 0) / Math.max(1, all.length),
    };
  }).sort((a, b) => a.code.localeCompare(b.code));
}

// top-level card - fetches calibration data and renders the grouped topic list
function ConfidenceLevelsCard({ userid }) {
  const API_URL = import.meta.env.VITE_API_URL;

  const [calibData, setCalibData] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded]  = useState({});

  useEffect(() => {
    if (!userid) return;
    (async () => {
      try {
        const res  = await fetch(`${API_URL}/analytics/topic-calibration/${userid}`);
        const data = await res.json();
        setCalibData(Array.isArray(data) ? data : []);
        setExpanded({});
      } catch (e) {
        console.error('error fetching calibration data:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [userid, API_URL]);

  const toggle       = code => setExpanded(prev => ({ ...prev, [code]: !prev[code] }));
  const groups       = groupCalibByParent(calibData);
  const overallScore = groups.length > 0
    ? Math.round(groups.reduce((s, g) => s + g.avgScore, 0) / groups.length)
    : null;

  return (
    <div style={{
      backgroundColor: '#2d2d2d',
      border: '1px solid #404040',
      borderRadius: 12,
      padding: 24,
      minHeight: 300,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
      }}>
        <div>
          <h3 style={{ color: TEXT_HI, fontSize: 18, fontWeight: 600, margin: 0 }}>
            Confidence Calibration
          </h3>
          <div style={{ color: TEXT_MID, fontSize: 12, marginTop: 4 }}>
            How accurately does your confidence match your actual performance?
          </div>
        </div>
        {overallScore !== null && (
          <div style={{ textAlign: 'center' }}>
            <CalibrationRing score={overallScore} size={56} />
            <div style={{ color: TEXT_LO, fontSize: 10, marginTop: 3 }}>OVERALL</div>
          </div>
        )}
      </div>

      {/* legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ color: TEXT_LO, fontSize: 11 }}>Ring score: 100 = perfect · fades as gap widens</span>
        <span style={{ color: TEXT_LO, fontSize: 11 }}>
          <span style={{ color: ACCENT, opacity: 0.85 }}>━</span> Confidence &nbsp;
          <span style={{ color: TEXT_MID, opacity: 0.55 }}>━</span> Accuracy
        </span>
      </div>

      {loading ? (
        <div style={centeredMsg}>Loading calibration data...</div>
      ) : groups.length === 0 ? (
        <div style={centeredMsg}>No data yet - answer some questions to see your calibration</div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxHeight: 520,
          overflowY: 'auto',
          paddingRight: 6,
          scrollbarWidth: 'thin',
          scrollbarColor: '#374151 #1a1a1a',
        }}>
          {groups.map(g => (
            <ParentCalibRow
              key={g.code}
              group={g}
              expanded={!!expanded[g.code]}
              onToggle={() => toggle(g.code)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const centeredMsg = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 200,
  color: TEXT_MID,
  fontSize: 14,
};

export default ConfidenceLevelsCard;