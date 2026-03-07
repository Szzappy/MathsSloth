import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { jwtDecode } from 'jwt-decode';

// ── Grade config ──────────────────────────────────────────────────────────────
const GRADES = [
  { label: 'A*', center: 1900, color: '#f59e0b', description: 'Distinction' },
  { label: 'A',  center: 1700, color: '#10b981', description: 'Excellent'   },
  { label: 'B',  center: 1500, color: '#06b6d4', description: 'Good'        },
  { label: 'C',  center: 1300, color: '#3b82f6', description: 'Satisfactory'},
  { label: 'D',  center: 1100, color: '#8b5cf6', description: 'Pass'        },
  { label: 'E',  center: 900,  color: '#f97316', description: 'Below Pass'  },
  { label: 'U',  center: 700,  color: '#ef4444', description: 'Ungraded'    },
];

const STRENGTH_DELTA = 100; // ELO above/below center for strong/weak topics

// ── Helpers ───────────────────────────────────────────────────────────────────
function eloForTopic(gradeCenter, strength) {
  if (strength === 'strong') return gradeCenter + STRENGTH_DELTA;
  if (strength === 'weak')   return gradeCenter - STRENGTH_DELTA;
  return gradeCenter;
}

function groupTopicsByParent(topics) {
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

  return Array.from(parentMap.values())
    .map(group => ({
      ...group,
      // If no children, use the topic itself as the only selectable item
      children: group.children.length > 0 ? group.children : (group._self ? [group._self] : []),
    }))
    .filter(g => g.children.length > 0)
    .sort((a, b) => a.code.localeCompare(b.code));
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  const steps = ['Your Grade', 'Topic Strengths', 'Confirm'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 40 }}>
      {steps.map((label, i) => {
        const idx = i + 1;
        const active = idx === step;
        const done   = idx < step;
        return (
          <React.Fragment key={idx}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                backgroundColor: done ? '#10b981' : active ? '#3b82f6' : '#2a2a2a',
                border: `2px solid ${done ? '#10b981' : active ? '#3b82f6' : '#404040'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700,
                color: done || active ? '#fff' : '#6b7280',
                transition: 'all 0.3s',
              }}>
                {done ? '✓' : idx}
              </div>
              <span style={{ fontSize: 11, color: active ? '#fff' : '#6b7280', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: '0 8px', marginBottom: 22,
                backgroundColor: done ? '#10b981' : '#2a2a2a',
                transition: 'background-color 0.3s',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Step1_Grade({ selectedGrade, onSelect }) {
  return (
    <div>
      <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 700, margin: '0 0 8px' }}>
        What's your current working grade?
      </h2>
      <p style={{ color: '#6b7280', fontSize: 15, margin: '0 0 32px', lineHeight: 1.6 }}>
        This sets your starting ELO so the quiz selects questions at the right difficulty from day one.
        Be honest — you can always improve from here!
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
        {GRADES.slice(0, 4).map(g => (
          <GradeButton key={g.label} grade={g} selected={selectedGrade === g.label} onSelect={onSelect} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {GRADES.slice(4).map(g => (
          <GradeButton key={g.label} grade={g} selected={selectedGrade === g.label} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function GradeButton({ grade, selected, onSelect }) {
  return (
    <button
      onClick={() => onSelect(grade.label)}
      style={{
        padding: '20px 12px',
        backgroundColor: selected ? grade.color + '22' : '#1e1e1e',
        border: `2px solid ${selected ? grade.color : '#333'}`,
        borderRadius: 12,
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all 0.15s',
        boxShadow: selected ? `0 0 20px ${grade.color}33` : 'none',
      }}
      onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.borderColor = grade.color + '88'; e.currentTarget.style.backgroundColor = '#252525'; } }}
      onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.backgroundColor = '#1e1e1e'; } }}
    >
      <div style={{
        fontSize: 32, fontWeight: 900, color: grade.color,
        textShadow: selected ? `0 0 20px ${grade.color}88` : 'none',
        lineHeight: 1, marginBottom: 6,
      }}>
        {grade.label}
      </div>
      <div style={{ fontSize: 11, color: selected ? grade.color : '#6b7280', fontWeight: 600 }}>
        {grade.description}
      </div>
      <div style={{ fontSize: 10, color: '#4b5563', marginTop: 4 }}>
        ~{grade.center} ELO
      </div>
    </button>
  );
}

function Step2_Topics({ topics, topicStrengths, onToggle, gradeColor }) {
  const [expandedGroups, setExpandedGroups] = useState({});
  const grouped = useMemo(() => groupTopicsByParent(topics), [topics]);

  const toggleGroup = (code) => setExpandedGroups(p => ({ ...p, [code]: !p[code] }));

  const strengthCount = { strong: 0, weak: 0 };
  Object.values(topicStrengths).forEach(s => { if (s) strengthCount[s]++; });

  return (
    <div>
      <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 700, margin: '0 0 8px' }}>
        Any topics you're especially strong or weak at?
      </h2>
      <p style={{ color: '#6b7280', fontSize: 15, margin: '0 0 16px', lineHeight: 1.6 }}>
        Tap a topic once for <span style={{ color: '#10b981', fontWeight: 600 }}>strong ↑</span>, twice for <span style={{ color: '#ef4444', fontWeight: 600 }}>weak ↓</span>, three times to reset.
        Skip this entirely if you're not sure — the quiz will figure it out.
      </p>

      {/* Summary pills */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <div style={{ padding: '6px 14px', borderRadius: 20, backgroundColor: '#10b98122', border: '1px solid #10b98144', color: '#10b981', fontSize: 13, fontWeight: 600 }}>
          ↑ {strengthCount.strong} strong
        </div>
        <div style={{ padding: '6px 14px', borderRadius: 20, backgroundColor: '#ef444422', border: '1px solid #ef444444', color: '#ef4444', fontSize: 13, fontWeight: 600 }}>
          ↓ {strengthCount.weak} weak
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
        {grouped.map(group => {
          const isExpanded = expandedGroups[group.code] ?? false;
          const groupTopics = group.children.length > 0 ? group.children : [{ topic_code: group.code, topic_name: group.name }];
          const groupStrengths = groupTopics.map(t => topicStrengths[t.topic_code]).filter(Boolean);
          const allStrong = groupStrengths.length > 0 && groupStrengths.every(s => s === 'strong');
          const allWeak   = groupStrengths.length > 0 && groupStrengths.every(s => s === 'weak');
          const mixed     = groupStrengths.length > 0 && !allStrong && !allWeak;

          return (
            <div key={group.code} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #2a2a2a' }}>
              {/* Group header */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: '#1e1e1e',
                  cursor: 'pointer',
                }}
                onClick={() => toggleGroup(group.code)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: gradeColor, fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>{group.code}</span>
                  <span style={{ color: '#d1d5db', fontSize: 14, fontWeight: 500 }}>{group.name}</span>
                  {mixed   && <span style={{ fontSize: 11, color: '#f59e0b' }}>mixed</span>}
                  {allStrong && <span style={{ fontSize: 11, color: '#10b981' }}>↑ all strong</span>}
                  {allWeak   && <span style={{ fontSize: 11, color: '#ef4444' }}>↓ all weak</span>}
                </div>
                <span style={{ color: '#6b7280', fontSize: 12 }}>{isExpanded ? '▲' : '▼'} {groupTopics.length}</span>
              </div>

              {/* Topics */}
              {isExpanded && (
                <div style={{ backgroundColor: '#171717', borderTop: '1px solid #2a2a2a' }}>
                  {groupTopics.map(t => (
                    <TopicRow
                      key={t.topic_code}
                      topic={t}
                      strength={topicStrengths[t.topic_code] ?? null}
                      onToggle={onToggle}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopicRow({ topic, strength, onToggle }) {
  const color = strength === 'strong' ? '#10b981' : strength === 'weak' ? '#ef4444' : null;
  const bg    = strength === 'strong' ? '#10b98112' : strength === 'weak' ? '#ef444412' : 'transparent';

  return (
    <button
      onClick={() => onToggle(topic.topic_code)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px 10px 24px',
        backgroundColor: bg,
        border: 'none', borderBottom: '1px solid #222',
        cursor: 'pointer', textAlign: 'left',
        transition: 'all 0.12s',
      }}
      onMouseEnter={(e) => { if (!strength) e.currentTarget.style.backgroundColor = '#252525'; }}
      onMouseLeave={(e) => { if (!strength) e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: '#4b5563', fontSize: 11, fontFamily: 'monospace', minWidth: 44 }}>{topic.topic_code}</span>
        <span style={{ color: color ?? '#9ca3af', fontSize: 13 }}>{topic.topic_name}</span>
      </div>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        backgroundColor: color ? color + '22' : '#2a2a2a',
        border: `1px solid ${color ?? '#404040'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, color: color ?? '#6b7280', fontWeight: 700, flexShrink: 0,
      }}>
        {strength === 'strong' ? '↑' : strength === 'weak' ? '↓' : '·'}
      </div>
    </button>
  );
}

function Step3_Confirm({ selectedGrade, topicStrengths, topics, onSubmit, loading }) {
  const gradeObj  = GRADES.find(g => g.label === selectedGrade);
  const strongTopics = topics.filter(t => topicStrengths[t.topic_code] === 'strong');
  const weakTopics   = topics.filter(t => topicStrengths[t.topic_code] === 'weak');
  const defaultCount = topics.length - strongTopics.length - weakTopics.length;

  return (
    <div>
      <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 700, margin: '0 0 8px' }}>
        Looking good — ready to start?
      </h2>
      <p style={{ color: '#6b7280', fontSize: 15, margin: '0 0 28px' }}>
        Here's how we'll set up your starting ELO ratings.
      </p>

      {/* Grade summary */}
      <div style={{
        padding: '20px 24px', borderRadius: 12, marginBottom: 16,
        background: `linear-gradient(135deg, ${gradeObj.color}18, ${gradeObj.color}08)`,
        border: `1px solid ${gradeObj.color}44`,
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <div style={{ fontSize: 56, fontWeight: 900, color: gradeObj.color, lineHeight: 1, textShadow: `0 0 24px ${gradeObj.color}66` }}>
          {gradeObj.label}
        </div>
        <div>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Working Grade</div>
          <div style={{ color: '#9ca3af', fontSize: 13 }}>Starting ELO: ~{gradeObj.center}</div>
          <div style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>{defaultCount} topics set to default</div>
        </div>
      </div>

      {/* Strong / Weak summaries */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 28 }}>
        <div style={{ padding: '16px', borderRadius: 10, backgroundColor: '#10b98112', border: '1px solid #10b98133' }}>
          <div style={{ color: '#10b981', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>↑ Strong topics ({strongTopics.length})</div>
          {strongTopics.length === 0
            ? <div style={{ color: '#4b5563', fontSize: 13 }}>None selected</div>
            : strongTopics.slice(0, 5).map(t => (
                <div key={t.topic_code} style={{ color: '#9ca3af', fontSize: 12, marginBottom: 2 }}>
                  {t.topic_code} — {(gradeObj.center + STRENGTH_DELTA)} ELO
                </div>
              ))
          }
          {strongTopics.length > 5 && <div style={{ color: '#6b7280', fontSize: 12 }}>+{strongTopics.length - 5} more</div>}
        </div>
        <div style={{ padding: '16px', borderRadius: 10, backgroundColor: '#ef444412', border: '1px solid #ef444433' }}>
          <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 14, marginBottom: 8 }}>↓ Weak topics ({weakTopics.length})</div>
          {weakTopics.length === 0
            ? <div style={{ color: '#4b5563', fontSize: 13 }}>None selected</div>
            : weakTopics.slice(0, 5).map(t => (
                <div key={t.topic_code} style={{ color: '#9ca3af', fontSize: 12, marginBottom: 2 }}>
                  {t.topic_code} — {(gradeObj.center - STRENGTH_DELTA)} ELO
                </div>
              ))
          }
          {weakTopics.length > 5 && <div style={{ color: '#6b7280', fontSize: 12 }}>+{weakTopics.length - 5} more</div>}
        </div>
      </div>

      <p style={{ color: '#4b5563', fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
        Your ELO will adjust automatically as you answer questions — this is just a starting point to help the algorithm warm up faster.
      </p>

      <button
        onClick={onSubmit}
        disabled={loading}
        style={{
          width: '100%', padding: '16px 24px',
          backgroundColor: loading ? '#1a2a3a' : '#3b82f6',
          color: loading ? '#4a6a9a' : '#fff',
          fontSize: 17, fontWeight: 700,
          border: 'none', borderRadius: 10,
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          boxShadow: loading ? 'none' : '0 4px 16px rgba(59,130,246,0.35)',
        }}
        onMouseEnter={(e) => { if (!loading) { e.target.style.backgroundColor = '#2563eb'; e.target.style.transform = 'translateY(-1px)'; } }}
        onMouseLeave={(e) => { if (!loading) { e.target.style.backgroundColor = '#3b82f6'; e.target.style.transform = 'translateY(0)'; } }}
      >
        {loading ? '⏳ Setting up your profile...' : '🚀 Start Learning'}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const API_URL = import.meta.env.VITE_API_URL;
  const navigate = useNavigate();
  const { userid: ctxUserid, markOnboarded } = useAuth();

  // Derive userid directly from token so the submit works even if AuthContext
  // hasn't finished its async getUserData() call yet
  const userid = ctxUserid ?? (() => {
    try {
      const token = localStorage.getItem('token');
      return token ? jwtDecode(token).user : null;
    } catch { return null; }
  })();

  const [step, setStep]                 = useState(1);
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [topics, setTopics]             = useState([]);
  const [topicStrengths, setTopicStrengths] = useState({}); // { topic_code: 'strong'|'weak'|null }
  const [loading, setLoading]           = useState(false);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [error, setError]               = useState(null);

  const gradeObj = GRADES.find(g => g.label === selectedGrade);

  // Fetch topics on mount
  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const res = await fetch(`${API_URL}/quiz/topics`);
        const data = await res.json();
        // Filter out anchor/stem-only topics and sort
        const leafTopics = (data.topics ?? [])
          .sort((a, b) => a.topic_code.localeCompare(b.topic_code));
        setTopics(leafTopics);
      } catch (e) {
        console.error('Failed to fetch topics:', e);
      } finally {
        setTopicsLoading(false);
      }
    };
    fetchTopics();
  }, [API_URL]);

  const toggleTopicStrength = (topicCode) => {
    setTopicStrengths(prev => {
      const cur = prev[topicCode];
      if (!cur)           return { ...prev, [topicCode]: 'strong' };
      if (cur === 'strong') return { ...prev, [topicCode]: 'weak'   };
      return { ...prev, [topicCode]: null };
    });
  };

  const handleNext = () => {
    if (step === 1 && !selectedGrade) return;
    setStep(s => s + 1);
  };

  const handleBack = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    if (!selectedGrade || !userid) return;
    setLoading(true);
    setError(null);

    const gradeCenter = GRADES.find(g => g.label === selectedGrade).center;

    // Build topic_adjustments: only include topics where user indicated strong/weak
    const topic_adjustments = Object.entries(topicStrengths)
      .filter(([, strength]) => strength)
      .map(([topic_code, strength]) => ({ topic_code, strength }));

    try {
      const res = await fetch(`${API_URL}/auth/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userid,
          grade: selectedGrade,
          grade_center_elo: gradeCenter,
          topic_adjustments,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Onboarding failed');
      }

      // Update AuthContext so ProtectedRoute knows onboarding is done
      markOnboarded();
      navigate('/dashboard');
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#111',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 620,
        backgroundColor: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: 16,
        padding: '40px 40px 36px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>
            🦥 Maths Sloth
          </span>
          <p style={{ color: '#6b7280', fontSize: 13, margin: '6px 0 0' }}>
            Let's calibrate your starting point
          </p>
        </div>

        <StepIndicator step={step} />

        {/* Step content */}
        {step === 1 && (
          <Step1_Grade selectedGrade={selectedGrade} onSelect={setSelectedGrade} />
        )}
        {step === 2 && (
          topicsLoading
            ? <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px 0' }}>Loading topics…</div>
            : <Step2_Topics
                topics={topics}
                topicStrengths={topicStrengths}
                onToggle={toggleTopicStrength}
                gradeColor={gradeObj?.color ?? '#3b82f6'}
              />
        )}
        {step === 3 && (
          <Step3_Confirm
            selectedGrade={selectedGrade}
            topicStrengths={topicStrengths}
            topics={topics}
            onSubmit={handleSubmit}
            loading={loading}
          />
        )}

        {error && (
          <div style={{ marginTop: 16, padding: '12px 16px', backgroundColor: '#1c0a0a', border: '1px solid #ef4444', borderRadius: 8, color: '#fca5a5', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Navigation buttons */}
        {step < 3 && (
          <div style={{ display: 'flex', gap: 10, marginTop: 32 }}>
            {step > 1 && (
              <button
                onClick={handleBack}
                style={{
                  flex: 1, padding: '12px', backgroundColor: '#1e1e1e',
                  color: '#9ca3af', border: '1px solid #333',
                  borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500,
                }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={step === 1 && !selectedGrade}
              style={{
                flex: 3, padding: '13px',
                backgroundColor: (step === 1 && !selectedGrade) ? '#1a2a3a' : gradeObj?.color ?? '#3b82f6',
                color: (step === 1 && !selectedGrade) ? '#4a6a9a' : '#fff',
                border: 'none', borderRadius: 8,
                cursor: (step === 1 && !selectedGrade) ? 'not-allowed' : 'pointer',
                fontSize: 15, fontWeight: 700,
                transition: 'all 0.15s',
                boxShadow: (step === 1 && !selectedGrade) ? 'none' : `0 4px 14px ${(gradeObj?.color ?? '#3b82f6')}44`,
              }}
            >
              {step === 2 ? 'Review & Confirm →' : 'Next →'}
            </button>
          </div>
        )}

        {step === 2 && (
          <p style={{ color: '#4b5563', fontSize: 12, textAlign: 'center', marginTop: 12, marginBottom: 0 }}>
            You can skip topic selection — just click "Review & Confirm"
          </p>
        )}
      </div>
    </div>
  );
}