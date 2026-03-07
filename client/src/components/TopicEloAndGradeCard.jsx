import React, { useEffect, useState } from 'react';

const getGradeFromElo = (elo) => {
  if (elo >= 1800) return { grade: 'A*', color: '#f59e0b' };
  if (elo >= 1600) return { grade: 'A',  color: '#10b981' };
  if (elo >= 1400) return { grade: 'B',  color: '#06b6d4' };
  if (elo >= 1200) return { grade: 'C',  color: '#3b82f6' };
  if (elo >= 1000) return { grade: 'D',  color: '#8b5cf6' };
  if (elo >= 800)  return { grade: 'E',  color: '#f97316' };
  return               { grade: 'U',  color: '#ef4444' };
};

function groupByParent(topics) {
  const parentMap = new Map();

  for (const t of topics) {
    const parentCode = t.parent_topic || t.topic_code;
    const parentName = t.parent_topic_name || t.topic_name;
    if (!parentMap.has(parentCode)) {
      parentMap.set(parentCode, { code: parentCode, name: parentName, children: [], _self: null });
    }
    if (t.parent_topic) {
      parentMap.get(parentCode).children.push(t);
    } else {
      parentMap.get(parentCode)._self = t;
    }
  }

  return Array.from(parentMap.values()).map(group => {
    const allTopics = group.children.length > 0 ? group.children : (group._self ? [group._self] : []);
    const totalWeight = allTopics.reduce((s, t) => s + parseFloat(t.exam_weight || 1), 0);
    const weightedElo = totalWeight > 0
      ? allTopics.reduce((s, t) => s + Number(t.elo_rating) * parseFloat(t.exam_weight || 1), 0) / totalWeight
      : (allTopics[0] ? Number(allTopics[0].elo_rating) : 1200);
    return { ...group, weightedElo, allTopics };
  }).sort((a, b) => a.code.localeCompare(b.code));
}

function EloBar({ elo, color }) {
  const pct = Math.min(100, Math.max(0, ((elo - 1000) / 1000) * 100));
  return (
    <div style={{ width: '100%', height: 4, backgroundColor: '#2a2a2a', borderRadius: 2, overflow: 'hidden', marginTop: 5 }}>
      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
    </div>
  );
}

function GradeBadge({ elo, size = 'md' }) {
  const { grade, color } = getGradeFromElo(elo);
  const dim = size === 'sm' ? { padding: '3px 8px', fontSize: 12 } : { padding: '5px 12px', fontSize: 16 };
  return (
    <div style={{ backgroundColor: color + '22', border: `1px solid ${color}55`, color, borderRadius: 7, fontWeight: 700, minWidth: 34, textAlign: 'center', flexShrink: 0, ...dim }}>
      {grade}
    </div>
  );
}

function SubtopicRow({ topic }) {
  const elo = Number(topic.elo_rating);
  const { color } = getGradeFromElo(elo);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 7, backgroundColor: '#181818', border: '1px solid #262626' }}>
      <div style={{ width: 2, height: 26, backgroundColor: color + '55', borderRadius: 1, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#c9d1db', fontSize: 13, fontWeight: 500 }}>
          <span style={{ color, fontSize: 11, fontWeight: 700, marginRight: 6 }}>{topic.topic_code}</span>
          {topic.topic_name}
        </div>
        <EloBar elo={elo} color={color} />
      </div>
      <div style={{ color: '#6b7280', fontSize: 11, marginRight: 4, flexShrink: 0 }}>{Math.round(elo)}</div>
      <GradeBadge elo={elo} size="sm" />
    </div>
  );
}

function ParentTopicRow({ group, expanded, onToggle }) {
  const { color } = getGradeFromElo(group.weightedElo);
  const hasChildren = group.children.length > 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        onClick={hasChildren ? onToggle : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 9, backgroundColor: '#222', border: `1px solid ${expanded && hasChildren ? color + '55' : '#333'}`, cursor: hasChildren ? 'pointer' : 'default', transition: 'border-color 0.2s', userSelect: 'none' }}
        onMouseEnter={e => hasChildren && (e.currentTarget.style.backgroundColor = '#282828')}
        onMouseLeave={e => hasChildren && (e.currentTarget.style.backgroundColor = '#222')}
      >
        <div style={{ width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: hasChildren ? color : 'transparent', fontSize: 9, transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          {hasChildren ? '▶' : ''}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color, fontSize: 11, fontWeight: 700 }}>{group.code}</span>
            <span style={{ color: '#d1d5db', fontSize: 14, fontWeight: 600 }}>{group.name}</span>
          </div>
          <EloBar elo={group.weightedElo} color={color} />
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0, marginRight: 8 }}>
          <div style={{ color: '#6b7280', fontSize: 11 }}>{Math.round(group.weightedElo)} ELO</div>
          {hasChildren && <div style={{ color: '#444', fontSize: 10 }}>{group.children.length} subtopics</div>}
        </div>
        <GradeBadge elo={group.weightedElo} size="md" />
      </div>
      {hasChildren && expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 20 }}>
          {group.children.sort((a, b) => a.topic_code.localeCompare(b.topic_code)).map(child => (
            <SubtopicRow key={child.topic_code} topic={child} />
          ))}
        </div>
      )}
    </div>
  );
}

function TopicEloAndGradeCard({ userid, user }) {
  const API_URL = import.meta.env.VITE_API_URL;
  const [topicElos, setTopicElos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    if (!userid) return;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/analytics/topic-elos/${userid}`);
        const data = await res.json();
        setTopicElos(data);
        setExpanded({});
      } catch (e) {
        console.error('Error fetching topic elos:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [userid, API_URL]);

  const toggle = code => setExpanded(prev => ({ ...prev, [code]: !prev[code] }));
  const groups = groupByParent(topicElos);

  return (
    <div style={{ backgroundColor: '#2d2d2d', border: '1px solid #404040', borderRadius: 12, padding: 24, minHeight: 300 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 600, margin: 0 }}>Topic ELO &amp; Grade</h3>
        <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>Click a parent topic to expand subtopics</div>
      </div>
      {loading ? (
        <div style={centeredMsg}>Loading topic data...</div>
      ) : groups.length === 0 ? (
        <div style={centeredMsg}>No topic data available yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 520, overflowY: 'auto', paddingRight: 6, scrollbarWidth: 'thin', scrollbarColor: '#444 #1a1a1a' }}>
          {groups.map(g => <ParentTopicRow key={g.code} group={g} expanded={!!expanded[g.code]} onToggle={() => toggle(g.code)} />)}
        </div>
      )}
    </div>
  );
}

const centeredMsg = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: '#6b7280', fontSize: 14 };

export default TopicEloAndGradeCard;