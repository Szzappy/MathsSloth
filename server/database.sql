DROP TABLE IF EXISTS grade_predictions CASCADE;
DROP TABLE IF EXISTS topic_mastery_snapshots CASCADE;
DROP TABLE IF EXISTS user_topic_mastery CASCADE;
DROP TABLE IF EXISTS question_attempts CASCADE;
DROP TABLE IF EXISTS quiz_questions CASCADE;
DROP TABLE IF EXISTS quizzes CASCADE;
DROP TABLE IF EXISTS question_topics CASCADE;
DROP TABLE IF EXISTS mark_scheme_items CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS topics CASCADE;
DROP TABLE IF EXISTS user_mementos CASCADE;
DROP TABLE IF EXISTS mementos CASCADE;
DROP TABLE IF EXISTS user_progress CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================================================================================================================
--                                                       USER ACCOUNTS AND AUTHORISATION/AUTHENTICATION
-- =====================================================================================================================================================

CREATE TABLE users (
  userid SERIAL PRIMARY KEY,
  username VARCHAR(255),
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255),
  is_verified BOOLEAN DEFAULT FALSE,
  using_oauth BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  verification_token_expiry TIMESTAMP,
  reset_token VARCHAR(255),
  reset_token_expiry TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

/*CREATE TABLE oauth_providers (
  providerid SERIAL PRIMARY KEY,
  userid INTEGER REFERENCES users(userid) ON DELETE CASCADE,
  provider_name VARCHAR(255) NOT NULL, -- google, microsoft etc
  provider_userid VARCHAR(255) NOT NULL, -- OAuth's unique id for a user
  access_token TEXT, -- (Short-lived token) can call APIs on behalf of user with this
  refresh_token TEXT, -- (Long-lived token) allows us to generate new access tokens when they expire  -> VERY SENSITIVE
  token_expiry TIMESTAMP, -- When access token expires
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider_name, provider_userid) -- These two combined must be unique
);*/

-- VIEW vs INDEX
-- An index helps speed up the lookup of data (exists purely to speed up queries)
-- A view is a stored query (used for convenience and abstraction)

-- An index is a sorted and searchable copy of part of the table
-- Only stores the indexed columns and a pointer to the actual row in the table
-- Uses a btree data structure which allows for binary search rather than linear

-- regular view vs materialised view
-- regular view is just a saved query (no storage being done), always up-to-date
-- materialised view stores data physically (snapshot of table at a specific time), must be refreshed every time the table is updated - WORKS WITH INDEXES


-- =====================================================================================================================================================
--                                                                USER PROGRESS AND GAMIFICATION
-- =====================================================================================================================================================

CREATE TABLE user_progress (
  userid INTEGER PRIMARY KEY REFERENCES users(userid) ON DELETE CASCADE,

  -- Gamification
  total_xp INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1,

  -- Streaks
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,

  -- Overall stats
  total_questions_answered INTEGER DEFAULT 0,
  total_study_time INTEGER DEFAULT 0, -- in seconds

  -- Preferences
  target_grade VARCHAR(10),
  pomodoro_work_minutes INTEGER DEFAULT 25,
  pomodoro_break_minutes INTEGER DEFAULT 5,
  pomodoro_enabled BOOLEAN DEFAULT FALSE,

  updated_at TIMESTAMP DEFAULT NOW()
);


-- =====================================================================================================================================================
--                                                                  ACHIEVEMENTS / MEMENTOS 
-- =====================================================================================================================================================
/*
CREATE TABLE mementos (
  mementoid SERIAL PRIMARY KEY,
  memento_name VARCHAR(255) NOT NULL UNIQUE,
  memento_description TEXT,
  memento_icon VARCHAR(255),
  xp_reward INTEGER DEFAULT 50,
  unlock_criteria JSONB -- streak? value?
);

CREATE TABLE user_mementos (
  userid INTEGER REFERENCES users(userid) ON DELETE CASCADE,
  mementoid INTEGER REFERENCES mementos(mementoid) ON DELETE CASCADE,
  unlocked_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (userid, mementoid)
);

-- speeds up lookup for a user's mementos
CREATE INDEX idx_user_mementos_userid ON user_mementos(userid);
*/

-- =====================================================================================================================================================
--                                                                TOPICS AND QUESTIONS
-- =====================================================================================================================================================

CREATE TABLE topics (
  topicid SERIAL PRIMARY KEY,
  topic_code VARCHAR(50) NOT NULL UNIQUE,
  topic_name VARCHAR(255) NOT NULL,
  parent_topic VARCHAR(50) REFERENCES topics(topic_code) ON DELETE SET NULL,

 -- Used for objective 2d: Likelihood to appear in exam
  exam_weight DECIMAL(4,2) DEFAULT 1.0 -- total digits: 4, digits after decimal: 2
);

CREATE INDEX idx_topics_parent_topic ON topics(parent_topic);


CREATE TABLE questions (
  questionid SERIAL PRIMARY KEY,
  question_text TEXT NOT NULL,
  image_url TEXT,
  question_format VARCHAR(50) NOT NULL, -- feynman, multiple choice, self mark
  correct_answer TEXT, -- for multiple choice
  answer_options JSONB,       -- MCQ: { "options": [{ "label": "A", "text": "..." }, ...] }
  explanation TEXT,           -- Feynman rubric / mark scheme used for AI grading
  total_marks INTEGER DEFAULT 1,

  -- ELO/GLICKO-2 RATINGS (Dynamic difficulty)
  elo_rating DECIMAL(6,2) DEFAULT 1500.00 CHECK (elo_rating BETWEEN 800 AND 2400),
  glicko_rd DECIMAL(6,2) DEFAULT 150.00 CHECK (glicko_rd BETWEEN 30 AND 350),
  glicko_volatility DECIMAL(4,3) DEFAULT 0.060,

  -- CALIBRATION METADATA
  attempts_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  avg_time_seconds INTEGER,

  -- ANCHOR QUESTIONS (Fixed-difficulty reference points — never update their Elo)
  is_anchor BOOLEAN DEFAULT FALSE,
  anchor_grade_level VARCHAR(2) CHECK (anchor_grade_level IN ('E', 'D', 'C', 'B', 'A', 'A*')),

  -- MULTI-PART QUESTION SUPPORT
  -- If parent_question_id is NULL, this is a standalone or top-level question.
  -- If set, this row is a child part (e.g. part a, b, c) of the parent question.
  parent_question_id INTEGER REFERENCES questions(questionid) ON DELETE CASCADE,
  part_label VARCHAR(10),       -- e.g. 'a', 'b', 'c', '(i)', '(ii)'
  order_index INTEGER DEFAULT 0, -- display order among siblings

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- =====================
  --   CONSTRAINTS
  -- =====================

  -- A question cannot reference itself as its own parent
  CONSTRAINT no_self_reference CHECK (parent_question_id != questionid),

  -- Anchor questions must be standalone (cannot be a child part)
  CONSTRAINT anchor_no_parts CHECK (NOT (is_anchor = TRUE AND parent_question_id IS NOT NULL)),

  -- question_format must be one of the known types
  CONSTRAINT valid_question_format CHECK (
    question_format IN ('multiple_choice', 'feynman', 'self_mark')
  ),

  -- MCQ questions must have answer_options populated; others must not
  CONSTRAINT mcq_requires_options CHECK (
    (question_format = 'multiple_choice' AND answer_options IS NOT NULL)
    OR
    (question_format != 'multiple_choice' AND answer_options IS NULL)
  ),

  -- MCQ questions must have a correct_answer
  CONSTRAINT mcq_requires_correct_answer CHECK (
    question_format != 'multiple_choice' OR correct_answer IS NOT NULL
  ),

  -- Feynman questions must have a rubric
  CONSTRAINT feynman_requires_rubric CHECK (
    question_format != 'feynman' OR explanation IS NOT NULL
  ),

  -- Feynman questions must be standalone (cannot be a child part)
  CONSTRAINT feynman_no_parts CHECK (
    NOT (question_format = 'feynman' AND parent_question_id IS NOT NULL)
  )
);

CREATE INDEX idx_questions_elo ON questions(elo_rating);
CREATE INDEX idx_questions_anchor ON questions(is_anchor, anchor_grade_level) WHERE is_anchor = TRUE;
CREATE INDEX idx_questions_parent ON questions(parent_question_id) WHERE parent_question_id IS NOT NULL;

-- used for self marking -> Users should be able to click on the parts of the mark scheme they got right to award themselves marks
CREATE TABLE mark_scheme_items (
  mark_scheme_item_id SERIAL PRIMARY KEY,
  questionid INTEGER REFERENCES questions(questionid) ON DELETE CASCADE,
  
  item_order INTEGER NOT NULL, -- Display order (1, 2, 3...)
  item_description TEXT NOT NULL, -- "Correctly identified the derivative"
  marks_available INTEGER NOT NULL DEFAULT 1, 
  
  item_type VARCHAR(50), -- method mark, accuracy mark, communication mark etc
  is_mandatory BOOLEAN DEFAULT FALSE, -- Must get this to get any marks
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_mark_scheme_questionid ON mark_scheme_items(questionid, item_order);

-- A question can have multiple topics
CREATE TABLE question_topics (
  questionid INTEGER REFERENCES questions(questionid) ON DELETE CASCADE,
  topic_code VARCHAR(50) REFERENCES topics(topic_code) ON DELETE CASCADE,
  PRIMARY KEY (questionid, topic_code)
);

CREATE INDEX idx_question_topics_topicid ON question_topics(topic_code);

DELETE TABLE IF EXISTS user_hints CASCADE;
CREATE TABLE user_hints (
  hintid SERIAL PRIMARY KEY,
  userid INTEGER REFERENCES users(userid) ON DELETE CASCADE,
  questionid INTEGER REFERENCES questions(questionid) ON DELETE CASCADE,
  hint_text TEXT NOT NULL,
  helpful INTEGER, -- 1 = not helpful, 2 = didn't click yes or no, forgot 3 = helpful
  created_at TIMESTAMP DEFAULT NOW()
);


-- =====================================================================================================================================================
--                                                                      QUIZZES
-- =====================================================================================================================================================

-- quizzes will be created after the user selects all the necessary parameters and then hits start quiz and then populated with questions after too
CREATE TABLE quizzes (
  quizid SERIAL PRIMARY KEY,
  userid INTEGER REFERENCES users(userid) ON DELETE CASCADE,

  quiz_type VARCHAR(50) NOT NULL, -- adaptive or custom
  quiz_mode VARCHAR(50), -- balanced, confidence boost etc

  -- custom topics will also include tailored difficulty UNLESS CHOSEN OTHERWISE
  using_custom_difficulty BOOLEAN,
  custom_difficulty_min INTEGER,
  custom_difficulty_max INTEGER,
  custom_question_count INTEGER,
  questions_completed INTEGER,

  pomodoro_work_minutes INTEGER,
  pomodoro_break_minutes INTEGER,
  time_taken INTEGER, -- time taken in seconds

  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- add a trigger that updates the time_taken every time a quiz attempt is added to the table

CREATE INDEX idx_quizzes_userid ON quizzes(userid, created_at DESC);
CREATE INDEX idx_quizzes_completed ON quizzes(userid, completed_at DESC);

CREATE TABLE quiz_questions (
  quizid INTEGER REFERENCES quizzes(quizid) ON DELETE CASCADE,
  questionid INTEGER REFERENCES questions(questionid) ON DELETE CASCADE,
  question_order INTEGER NOT NULL,
  is_complete BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (quizid, questionid)
);

CREATE INDEX idx_quiz_questions_quizid ON quiz_questions(quizid);

-- =====================================================================================================================================================
--                                                        QUESTION ATTEMPTS AND PERFORMANCE
-- =====================================================================================================================================================

CREATE TABLE question_attempts (
  attemptid SERIAL PRIMARY KEY,
  userid INTEGER REFERENCES users(userid) ON DELETE CASCADE,
  questionid INTEGER REFERENCES questions(questionid) ON DELETE CASCADE,
  quizid INTEGER REFERENCES quizzes(quizid) ON DELETE CASCADE,

  -- The raw answer the student submitted
  user_answer TEXT,

  -- Used for MCQ (set server-side at submission time)
  is_correct BOOLEAN,

  -- Marks (marks_awarded is NULL for feynman until AI grading completes)
  marks_awarded INTEGER,
  marks_available INTEGER,

  -- Grading status: 'graded' for MCQ/short_answer, 'pending'/'failed' for feynman
  grading_status VARCHAR(20) DEFAULT 'graded' CHECK (
    grading_status IN ('graded', 'pending', 'failed')
  ),

  -- Self-assessment
  confidence INTEGER CHECK (confidence BETWEEN 1 AND 5),
  time_taken INTEGER,  -- in seconds
  hints_used INTEGER DEFAULT 0,

  -- ELO/GLICKO TRACKING (Before/After snapshots)
  user_elo_before DECIMAL(6,2),
  user_elo_after DECIMAL(6,2),
  user_rd_before DECIMAL(6,2),
  user_rd_after DECIMAL(6,2),
  question_elo_before DECIMAL(6,2),
  question_elo_after DECIMAL(6,2),
  question_rd_before DECIMAL(6,2),
  question_rd_after DECIMAL(6,2),

  -- FSRS-5 SPACED REPETITION
  fsrs_rating INTEGER CHECK (fsrs_rating BETWEEN 1 AND 4),
  fsrs_interval_days DECIMAL(8,4),
  fsrs_stability_before DECIMAL(8,4),
  fsrs_stability_after DECIMAL(8,4),
  fsrs_difficulty_before DECIMAL(4,2),
  fsrs_difficulty_after DECIMAL(4,2),

  -- Probability of success calculated before attempt using Glicko-2 expectation formula
  expected_success_probability DECIMAL(4,3),
  question_difficulty INTEGER,

  is_anchor_attempt BOOLEAN DEFAULT FALSE,
  attempted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_question_attempts_userid ON question_attempts(userid, attempted_at DESC);
CREATE INDEX idx_question_attempts_questionid ON question_attempts(questionid);
CREATE INDEX idx_question_attempts_userid_questionid ON question_attempts(userid, questionid);
CREATE INDEX idx_attempts_anchor ON question_attempts(userid, is_anchor_attempt) WHERE is_anchor_attempt = TRUE;
CREATE INDEX idx_attempts_fsrs_rating ON question_attempts(fsrs_rating);
CREATE INDEX idx_attempts_grading_status ON question_attempts(grading_status) WHERE grading_status = 'pending';

-- =====================================================================================================================================================
--                                                              TOPIC MASTERY AND USER ANALYTICS
-- =====================================================================================================================================================

-- Mastery data per user per topic
CREATE TABLE user_topic_mastery (
  userid INTEGER REFERENCES users(userid) ON DELETE CASCADE,
  topicid INTEGER REFERENCES topics(topicid) ON DELETE CASCADE,
  
  -- ELO/GLICKO-2 RATINGS (User ability per topic)
  -- Objective 2a: Difficulty calibrated to user's current ability
  elo_rating DECIMAL(6,2) DEFAULT 1500.00 CHECK (elo_rating BETWEEN 800 AND 2400),
  glicko_rd DECIMAL(6,2) DEFAULT 150.00 CHECK (glicko_rd BETWEEN 30 AND 350),
  glicko_volatility DECIMAL(4,3) DEFAULT 0.060,
  
  -- FSRS-5 PARAMETERS (Spaced repetition scheduling)
  -- Objective 2b: Time since last revised (spaced repetition factor)
  
  --FSRS-5 stability parameter: estimated days until memory retention drops to 90%.
  --Calculated using empirical weights from FSRS-5 research (Ye et al. 2024).
  --Directly used as review interval (no additional scaling needed).
  
  fsrs_stability DECIMAL(8,4) DEFAULT 1.0000,  -- Days until 90% retention probability
  fsrs_difficulty DECIMAL(4,2) DEFAULT 5.00 CHECK (fsrs_difficulty BETWEEN 1 AND 10), -- User-perceived difficulty
  fsrs_state VARCHAR(15) DEFAULT 'new' CHECK (fsrs_state IN ('new', 'learning', 'review', 'relearning')),
  last_review_date TIMESTAMP,
  
  -- Optimal next review date for 90% retention probability
  -- Calculated as: current_date + fsrs_stability (in days)
  -- Used by adaptive quiz generation to prioritize due topics
  next_review_date TIMESTAMP,
  
  -- PERFORMANCE METRICS
  -- Objective 2c: Mastery tracking (what topics does user struggle with?)
  /*questions_attempted INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0,
  accuracy DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN questions_attempted > 0 THEN ROUND((questions_correct::DECIMAL / questions_attempted) * 100, 2)
      ELSE 0
    END
  ) STORED,*/
  
  -- Recent performance (last 30 days)
  recent_attempts INTEGER DEFAULT 0,
  recent_correct INTEGER DEFAULT 0,
  recent_accuracy DECIMAL(5,2),
  
  -- Time tracking (Objective 4d: Study time per topic)
  total_study_time_seconds INTEGER DEFAULT 0,
  avg_time_per_question INTEGER,
  
  -- Confidence tracking (Objective 4b: Confidence level per topic)
  avg_confidence DECIMAL(3,2),
  
  -- GRADE PREDICTION (Objective 4c: Predicted grade per topic)
  predicted_grade_numeric DECIMAL(3,2), -- 0=E, 1=D, 2=C, 3=B, 4=A, 5=A*
  predicted_grade_letter VARCHAR(2),
  grade_confidence INTEGER CHECK (grade_confidence BETWEEN 0 AND 100), -- Based on sample size
  
  -- Anchor performance (for stable grading - solves Elo inflation problem)
  anchor_attempts_total INTEGER DEFAULT 0,
  anchor_attempts_by_grade JSONB DEFAULT '{}', -- {"C": {"attempts": 10, "correct": 7}, "B": {...}}
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  PRIMARY KEY (userid, topicid)
);

CREATE INDEX idx_mastery_userid ON user_topic_mastery(userid);
CREATE INDEX idx_mastery_topicid ON user_topic_mastery(topicid);
CREATE INDEX idx_mastery_next_review ON user_topic_mastery(userid, next_review_date) WHERE next_review_date IS NOT NULL;
CREATE INDEX idx_mastery_elo ON user_topic_mastery(elo_rating);
CREATE INDEX idx_mastery_grade ON user_topic_mastery(predicted_grade_letter);


-- Trigger to update timestamp
CREATE TRIGGER trigger_update_mastery_timestamp
BEFORE UPDATE ON user_topic_mastery
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- THIS WILL USE ONLY THE ELO SYSTEM TO TRACK THE MASTERY SO WE CAN STORE ELO OVER TIME AND USE THAT FOR PREDICTIONS
/*CREATE TABLE topic_mastery_snapshots (
  userid INTEGER REFERENCES users(userid) ON DELETE CASCADE,
  topicid INTEGER REFERENCES topics(topicid) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  
  -- Snapshot metrics (Objective 7: Predicted grade improvement tracking)
  -- accuracy DECIMAL(5,2),
  mastery_score DECIMAL(5,2),
  questions_attempted INTEGER,
  study_time INTEGER, -- seconds
  predicted_grade VARCHAR(10),
  elo_rating DECIMAL(6,2), -- For tracking improvement over time
  
  PRIMARY KEY (userid, topicid, snapshot_date)
);*/

-- CREATE INDEX idx_snapshots_userid_date ON topic_mastery_snapshots(userid, snapshot_date DESC);


-- =====================================================================================================================================================
--                                                                    PREDICTED GRADES
-- =====================================================================================================================================================

/*
CREATE TABLE grade_predictions (
  userid INTEGER REFERENCES users(userid) ON DELETE CASCADE,
  topicid INTEGER REFERENCES topics(topicid) ON DELETE CASCADE, -- NULL = overall
  
  predicted_grade VARCHAR(10), -- 'A*', 'A', 'B', etc.
  predicted_percentage DECIMAL(5,2),
  
  calculated_at TIMESTAMP DEFAULT NOW(),
  
  PRIMARY KEY (userid, topicid, calculated_at)
);

CREATE INDEX idx_predictions_userid ON grade_predictions(userid, calculated_at DESC);*/


-- =====================================================================================================================================================
--                                                                     VIEWS
-- =====================================================================================================================================================

-- =====================================================================================================================================================
--                                              CORRECTED PRIORITY SCORING FOR ADAPTIVE QUIZ GENERATION
-- =====================================================================================================================================================

-- DROP the old view
DROP VIEW IF EXISTS topics_due_for_review;

-- CREATE corrected view with multiplicative priority scoring
-- Based on: FSRS (urgency) x Glicko (difficulty matching) x Exam weight (utility)
CREATE OR REPLACE VIEW topics_due_for_review AS
SELECT 
  utm.userid,
  utm.topicid,
  t.topic_name,
  t.topic_code,
  t.exam_weight,
  utm.elo_rating,
  utm.glicko_rd,
  utm.fsrs_stability,
  utm.fsrs_difficulty,
  utm.next_review_date,
  utm.predicted_grade_letter,
  
  -- ========== COMPONENT 1: FSRS URGENCY (forgetting pressure) ==========
  -- Calculate days overdue (negative = not yet due)
  EXTRACT(EPOCH FROM (NOW() - COALESCE(utm.next_review_date, NOW() - INTERVAL '999 days')))/86400 AS days_overdue,
  
  -- Convert to recall probability using FSRS decay model
  -- P(recall) = 0.9^(days_overdue / stability)
  -- If days_overdue is negative, memory is still stable (P(recall) ≈ 1)
  CASE 
    WHEN utm.next_review_date IS NULL THEN 0.5  -- New topic, neutral urgency
    WHEN utm.next_review_date > NOW() THEN 
      -- Not yet due: high recall probability, low urgency
      POWER(0.9, GREATEST(0, -EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400) / GREATEST(utm.fsrs_stability, 0.1))
    ELSE 
      -- Overdue: decaying recall probability
      POWER(0.9, EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400 / GREATEST(utm.fsrs_stability, 0.1))
  END AS recall_probability,
  
  -- Urgency = 1 - P(recall)
  -- Higher urgency = more forgetting has occurred
  CASE 
    WHEN utm.next_review_date IS NULL THEN 0.5
    WHEN utm.next_review_date > NOW() THEN 
      1 - POWER(0.9, GREATEST(0, -EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400) / GREATEST(utm.fsrs_stability, 0.1))
    ELSE 
      1 - POWER(0.9, EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400 / GREATEST(utm.fsrs_stability, 0.1))
  END AS urgency,
  
  -- ========== COMPONENT 2: GLICKO UNCERTAINTY (calibration need) ==========
  -- High RD = uncertain about ability = need more data
  -- Normalized to [0, 1] where 350 = max uncertainty
  utm.glicko_rd / 350.0 AS uncertainty_factor,
  
  -- ========== COMPONENT 3: EXAM UTILITY (importance) ==========
  -- Already normalized to [0, 1]
  t.exam_weight AS utility,
  
  -- ========== FINAL PRIORITY SCORE (multiplicative) ==========
  -- Priority = urgency x uncertainty x utility
  -- 
  -- Semantic interpretation:
  -- - If memory is stable (urgency ≈ 0) -> low priority regardless of other factors
  -- - If ability is well-calibrated (uncertainty ≈ 0) -> lower priority
  -- - If not exam-relevant (utility ≈ 0) -> low priority
  
  -- All three must be high for maximum priority
  (
    -- Urgency component (FSRS-based)
    CASE 
      WHEN utm.next_review_date IS NULL THEN 0.5
      WHEN utm.next_review_date > NOW() THEN 
        1 - POWER(0.9, GREATEST(0, -EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400) / GREATEST(utm.fsrs_stability, 0.1))
      ELSE 
        1 - POWER(0.9, EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400 / GREATEST(utm.fsrs_stability, 0.1))
    END
  ) * 
  (
    -- Uncertainty component (Glicko-2 based)
    -- Use square root to soften the effect (RD changes slowly)
    SQRT(utm.glicko_rd / 350.0)
  ) *
  (
    -- Utility component (exam importance)
    t.exam_weight
  ) AS priority_score

FROM user_topic_mastery utm
JOIN topics t ON utm.topicid = t.topicid
-- Only show topics that are due or nearly due (within 1 day)
WHERE utm.next_review_date IS NULL OR utm.next_review_date <= NOW() + INTERVAL '1 day'
ORDER BY priority_score DESC;


-- =====================================================================================
-- MIGRATION: user_elo_snapshots
--
-- Stores one row per user per calendar day capturing their overall weighted ELO
-- at the END of that day. Used exclusively by the grade progress chart.
--
-- Weighted ELO formula (mirrors dashboard-stats and predicted-grade endpoints):
--   weighted_elo = SUM(utm.elo_rating * t.exam_weight) / SUM(t.exam_weight)
--   across all user_topic_mastery rows with a known elo_rating and exam_weight > 0.
--
-- Insert policy:
--   - One row per (userid, snapshot_date). ON CONFLICT DO UPDATE so that multiple
--     answers on the same day keep overwriting with the latest snapshot, and only
--     the final state of that day is retained.
--   - The trigger fires AFTER UPDATE OF elo_rating on user_topic_mastery, so every
--     time any topic ELO changes the snapshot for today is refreshed.
-- =====================================================================================


-- ─── TABLE ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_elo_snapshots (
  userid          INTEGER  NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
  snapshot_date   DATE     NOT NULL DEFAULT CURRENT_DATE,
  weighted_elo    INTEGER  NOT NULL,                -- whole-number weighted ELO
  topics_included INTEGER  NOT NULL,                -- how many topics contributed
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),

  PRIMARY KEY (userid, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_elo_snapshots_userid_date
  ON user_elo_snapshots (userid, snapshot_date ASC);

COMMENT ON TABLE user_elo_snapshots IS
'Daily overall weighted-ELO snapshots per user.
One row per (userid, date). Updated on every ELO change that day so the
row always reflects the end-of-session state. Used by the grade progress chart
instead of reconstructing history from question_attempts at query time.';


-- ─── FUNCTION: upsert today''s snapshot for a given user ─────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- PATCH: weighted ELO — only count attempted topics
--
-- Problem: onboarding seeds ALL 73 topics into user_topic_mastery with
-- fsrs_state = 'new'. The weighted average divided by 73 means completing
-- a quiz of 8 questions barely moves the needle.
--
-- Fix: only include topics where fsrs_state != 'new' in the weighted average.
-- Falls back to the full average if the user has never answered anything yet.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION upsert_elo_snapshot(p_userid INTEGER)
RETURNS VOID AS $$
DECLARE
  v_weighted_elo    DECIMAL(8,4);
  v_topics_included INTEGER;
BEGIN
  SELECT
    COALESCE(
      -- Primary: only topics the user has actually attempted
      NULLIF(
        SUM(CASE WHEN utm.fsrs_state != 'new' THEN utm.elo_rating * t.exam_weight END)
          / NULLIF(SUM(CASE WHEN utm.fsrs_state != 'new' THEN t.exam_weight END), 0),
        NULL
      ),
      -- Fallback: all topics (only used before first quiz)
      SUM(utm.elo_rating * t.exam_weight) / NULLIF(SUM(t.exam_weight), 0)
    ),
    COUNT(CASE WHEN utm.fsrs_state != 'new' THEN 1 END)
  INTO v_weighted_elo, v_topics_included
  FROM user_topic_mastery utm
  JOIN topics t ON utm.topicid = t.topicid
  WHERE utm.userid      = p_userid
    AND utm.elo_rating IS NOT NULL
    AND t.exam_weight   > 0;

  IF v_weighted_elo IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO user_elo_snapshots (userid, snapshot_date, weighted_elo, topics_included, updated_at)
  VALUES (
    p_userid,
    CURRENT_DATE,
    ROUND(v_weighted_elo)::INTEGER,
    v_topics_included,
    NOW()
  )
  ON CONFLICT (userid, snapshot_date) DO UPDATE
    SET weighted_elo    = ROUND(EXCLUDED.weighted_elo)::INTEGER,
        topics_included = EXCLUDED.topics_included,
        updated_at      = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION upsert_elo_snapshot(INTEGER) IS
'Recomputes and upserts today''s weighted-ELO snapshot for the given user.
Only includes attempted topics (fsrs_state != new) so quiz progress is visible.
Falls back to all topics before first quiz. Safe to call multiple times per day.';

-- Refresh today''s snapshot for all users so charts update immediately.
SELECT upsert_elo_snapshot(userid)
FROM (SELECT DISTINCT userid FROM user_topic_mastery) u;


-- ─── TRIGGER: fire after every ELO update on user_topic_mastery ──────────────
--
-- Piggybacks on the existing trigger_update_mastery trigger that already fires
-- AFTER UPDATE OF elo_rating ON user_topic_mastery. We add a separate trigger
-- so the snapshot logic is fully decoupled and easy to remove/replace.

CREATE OR REPLACE FUNCTION trigger_fn_snapshot_elo()
RETURNS TRIGGER AS $$
BEGIN
  -- NEW.userid is available because this fires on user_topic_mastery row update.
  -- We call the shared upsert function so the logic lives in one place.
  PERFORM upsert_elo_snapshot(NEW.userid);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_snapshot_elo ON user_topic_mastery;
CREATE TRIGGER trigger_snapshot_elo
  AFTER UPDATE OF elo_rating ON user_topic_mastery
  FOR EACH ROW
  EXECUTE FUNCTION trigger_fn_snapshot_elo();

COMMENT ON TRIGGER trigger_snapshot_elo ON user_topic_mastery IS
'After every per-topic ELO update, refreshes today''s overall weighted-ELO
snapshot in user_elo_snapshots. Fires once per topic per answer, but the
upsert is idempotent so multiple fires per day are safe.';


-- ─── BACKFILL: populate historical snapshots from question_attempts ───────────
--
-- For existing users who answered questions before this table existed,
-- reconstruct one snapshot per active day using the same carry-forward logic:
-- for each day, take the last known user_elo_after per topic up to that day,
-- weight by exam_weight, and insert a snapshot row.
--
-- Run once after deploying this migration. Safe to re-run (ON CONFLICT UPDATE).

DO $$
DECLARE
  v_row RECORD;
BEGIN
  FOR v_row IN
    WITH active_days AS (
      SELECT DISTINCT
        qa.userid,
        DATE(qa.attempted_at) AS day
      FROM question_attempts qa
      WHERE qa.user_elo_after IS NOT NULL
        AND qa.grading_status = 'graded'
    ),
    all_topics_used AS (
      SELECT DISTINCT
        qa.userid,
        qt.topic_code,
        t.exam_weight,
        t.topicid
      FROM question_attempts qa
      JOIN question_topics qt ON qa.questionid = qt.questionid
      JOIN topics t ON qt.topic_code = t.topic_code
      WHERE qa.user_elo_after IS NOT NULL
        AND t.exam_weight > 0
    ),
    daily_weighted AS (
      SELECT
        ad.userid,
        ad.day,
        -- For each topic, find the last user_elo_after on or before this day
        -- then compute the weighted average across all topics.
        ROUND(
          (SELECT SUM(last_elo.elo * atu.exam_weight)
                / NULLIF(SUM(atu.exam_weight), 0)
           FROM all_topics_used atu
           CROSS JOIN LATERAL (
             SELECT qa2.user_elo_after AS elo
             FROM question_attempts qa2
             JOIN question_topics qt2 ON qa2.questionid = qt2.questionid
             WHERE qa2.userid        = ad.userid
               AND qt2.topic_code    = atu.topic_code
               AND qa2.user_elo_after IS NOT NULL
               AND qa2.grading_status = 'graded'
               AND DATE(qa2.attempted_at) <= ad.day
             ORDER BY qa2.attempted_at DESC
             LIMIT 1
           ) last_elo
           WHERE atu.userid = ad.userid
          )
        )::INTEGER AS weighted_elo,
        (SELECT COUNT(DISTINCT atu.topic_code)
         FROM all_topics_used atu
         WHERE atu.userid = ad.userid
         -- only count topics that had at least one attempt on or before this day
         AND EXISTS (
           SELECT 1 FROM question_attempts qa3
           JOIN question_topics qt3 ON qa3.questionid = qt3.questionid
           WHERE qa3.userid = ad.userid
             AND qt3.topic_code = atu.topic_code
             AND DATE(qa3.attempted_at) <= ad.day
             AND qa3.grading_status = 'graded'
         )
        )::INTEGER AS topics_included
      FROM active_days ad
    )
    SELECT * FROM daily_weighted WHERE weighted_elo IS NOT NULL
  LOOP
    INSERT INTO user_elo_snapshots
      (userid, snapshot_date, weighted_elo, topics_included, created_at, updated_at)
    VALUES
      (v_row.userid, v_row.day, v_row.weighted_elo, v_row.topics_included, NOW(), NOW())
    ON CONFLICT (userid, snapshot_date) DO UPDATE
      SET weighted_elo    = EXCLUDED.weighted_elo,
          topics_included = EXCLUDED.topics_included,
          updated_at      = NOW();
  END LOOP;
END $$;


-- ─── VERIFY ───────────────────────────────────────────────────────────────────

SELECT
  userid,
  COUNT(*)            AS total_snapshots,
  MIN(snapshot_date)  AS first_day,
  MAX(snapshot_date)  AS latest_day,
  MIN(weighted_elo)   AS lowest_elo,
  MAX(weighted_elo)   AS highest_elo,
  MAX(weighted_elo) - MIN(weighted_elo) AS total_gain
FROM user_elo_snapshots
GROUP BY userid
ORDER BY userid;


COMMENT ON VIEW topics_due_for_review IS
'Adaptive quiz generation priority scoring using multiplicative model.
Components:
1. FSRS urgency: 1 - P(recall) based on time since last review
2. Glicko uncertainty: √(RD/350) to prioritize under-calibrated topics
3. Exam utility: exam_weight as importance multiplier

Priority = urgency x uncertainty x utility

This avoids scale-mixing and double-counting found in weighted sums.
Design based on cognitive science: optimal learning occurs when:
- Memory is fading (urgency)
- Ability estimate is uncertain (exploration)
- Content is exam-relevant (utility)

Reference: Desirable difficulties framework (Bjork & Bjork, 2011)';


-- VIEW: User overall grade prediction (Objective 4e: Predicted exam grade)
/*CREATE OR REPLACE VIEW user_overall_grades AS
SELECT 
  utm.userid,
  
  -- Weighted average grade (by exam importance)
  ROUND(
    SUM(utm.predicted_grade_numeric * t.exam_weight) / NULLIF(SUM(t.exam_weight), 0),
    2
  ) AS weighted_grade_numeric,
  
  CASE 
    WHEN ROUND(SUM(utm.predicted_grade_numeric * t.exam_weight) / NULLIF(SUM(t.exam_weight), 0)) >= 4.5 THEN 'A*'
    WHEN ROUND(SUM(utm.predicted_grade_numeric * t.exam_weight) / NULLIF(SUM(t.exam_weight), 0)) >= 3.5 THEN 'A'
    WHEN ROUND(SUM(utm.predicted_grade_numeric * t.exam_weight) / NULLIF(SUM(t.exam_weight), 0)) >= 2.5 THEN 'B'
    WHEN ROUND(SUM(utm.predicted_grade_numeric * t.exam_weight) / NULLIF(SUM(t.exam_weight), 0)) >= 1.5 THEN 'C'
    WHEN ROUND(SUM(utm.predicted_grade_numeric * t.exam_weight) / NULLIF(SUM(t.exam_weight), 0)) >= 0.5 THEN 'D'
    ELSE 'E'
  END AS overall_grade,
  
  -- Confidence (based on total attempts) - Objective 4f: Questions answered
  CASE 
    WHEN SUM(utm.questions_attempted) >= 100 THEN 95
    WHEN SUM(utm.questions_attempted) >= 50 THEN 80
    WHEN SUM(utm.questions_attempted) >= 20 THEN 60
    ELSE 30
  END AS confidence,
  
  SUM(utm.questions_attempted) AS total_questions,
  -- ROUND(AVG(utm.accuracy), 2) AS avg_accuracy,
  SUM(utm.total_study_time_seconds) AS total_study_time

FROM user_topic_mastery utm
JOIN topics t ON utm.topicid = t.topicid
WHERE utm.questions_attempted >= 4  -- Only include topics with sufficient data
GROUP BY utm.userid;*/


-- =====================================================================================================================================================
--                                                            GLICKO-2 VOLATILITY CALCULATION
-- =====================================================================================================================================================
-- Based on: Mark Glickman, "Example of the Glicko-2 system" (2013)
-- http://www.glicko.net/glicko/glicko2.pdf

-- Full Glicko-2 volatility calculation using Illinois algorithm (Glickman 2013)
-- Iteratively solves f(σ'') = 0 to find new volatility after a rating period
-- Typically converges in 5-10 iterations
CREATE OR REPLACE FUNCTION calculate_glicko2_volatility(
  p_phi DOUBLE PRECISION,           -- Current RD (φ) in Glicko-2 scale
  p_sigma DOUBLE PRECISION,         -- Current volatility (σ)
  p_delta DOUBLE PRECISION,         -- Performance difference (Δ)
  p_v DOUBLE PRECISION,             -- Variance (v)
  p_tau DOUBLE PRECISION DEFAULT 0.5 -- System constant (τ) - controls volatility change rate
) RETURNS DOUBLE PRECISION AS $$
DECLARE
  v_epsilon CONSTANT DOUBLE PRECISION := 0.000001; -- Convergence threshold
  v_max_iterations CONSTANT INTEGER := 100;
  
  -- Illinois algorithm variables
  v_a0 DOUBLE PRECISION;
  v_A DOUBLE PRECISION;
  v_B DOUBLE PRECISION;
  v_fA DOUBLE PRECISION;
  v_fB DOUBLE PRECISION;
  v_C DOUBLE PRECISION;
  v_fC DOUBLE PRECISION;
  v_iteration INTEGER := 0;
  
  -- Helper values for f(x) calculation
  v_phi_sq DOUBLE PRECISION;
  v_delta_sq DOUBLE PRECISION;
  v_tau_sq DOUBLE PRECISION;
  
  -- f(x) helper function from Glickman paper
  -- f(x) = [e^x(Δ² - φ² - v - e^x)] / [2(φ² + v + e^x)²] - [(x - a)/τ²]
  v_ex DOUBLE PRECISION;
  v_phi_sq_plus_v_plus_ex DOUBLE PRECISION;
  v_f_result DOUBLE PRECISION;
  
  v_k INTEGER;
BEGIN
  -- Precompute squared values
  v_phi_sq := p_phi * p_phi;
  v_delta_sq := p_delta * p_delta;
  v_tau_sq := p_tau * p_tau;
  
  -- Step 1: Initialize a = ln(σ²)
  v_a0 := LN(p_sigma * p_sigma);
  v_A := v_a0;
  
  -- Step 2: Set initial value of B
  IF v_delta_sq > v_phi_sq + p_v THEN
    v_B := LN(v_delta_sq - v_phi_sq - p_v);
  ELSE
    -- If delta is small, search downward
    v_k := 1;
    LOOP
      v_B := v_a0 - v_k * p_tau;
      
      -- Calculate f(B) to check if it's negative
      v_ex := EXP(v_B);
      v_phi_sq_plus_v_plus_ex := v_phi_sq + p_v + v_ex;
      v_f_result := (v_ex * (v_delta_sq - v_phi_sq - p_v - v_ex)) / 
                    (2 * v_phi_sq_plus_v_plus_ex * v_phi_sq_plus_v_plus_ex) - 
                    ((v_B - v_a0) / v_tau_sq);
      
      EXIT WHEN v_f_result < 0;
      v_k := v_k + 1;
      EXIT WHEN v_k > 100; -- Safety limit
    END LOOP;
  END IF;
  
  -- Calculate initial f(A) and f(B)
  -- f(A)
  v_ex := EXP(v_A);
  v_phi_sq_plus_v_plus_ex := v_phi_sq + p_v + v_ex;
  v_fA := (v_ex * (v_delta_sq - v_phi_sq - p_v - v_ex)) / 
          (2 * v_phi_sq_plus_v_plus_ex * v_phi_sq_plus_v_plus_ex) - 
          ((v_A - v_a0) / v_tau_sq);
  
  -- f(B)
  v_ex := EXP(v_B);
  v_phi_sq_plus_v_plus_ex := v_phi_sq + p_v + v_ex;
  v_fB := (v_ex * (v_delta_sq - v_phi_sq - p_v - v_ex)) / 
          (2 * v_phi_sq_plus_v_plus_ex * v_phi_sq_plus_v_plus_ex) - 
          ((v_B - v_a0) / v_tau_sq);
  
  -- Step 3: Illinois algorithm (modified regula falsi)
  WHILE ABS(v_B - v_A) > v_epsilon 
    AND ABS(v_fB) > v_epsilon 
    AND v_iteration < v_max_iterations LOOP
    
    -- Calculate new point C using linear interpolation
    v_C := v_A - v_fA * (v_A - v_B) / (v_fA - v_fB);
    
    -- Calculate f(C)
    v_ex := EXP(v_C);
    v_phi_sq_plus_v_plus_ex := v_phi_sq + p_v + v_ex;
    v_fC := (v_ex * (v_delta_sq - v_phi_sq - p_v - v_ex)) / 
            (2 * v_phi_sq_plus_v_plus_ex * v_phi_sq_plus_v_plus_ex) - 
            ((v_C - v_a0) / v_tau_sq);
    
    -- Update bounds based on sign of f(C)
    IF v_fC * v_fB < 0 THEN
      -- C and B have opposite signs - root is between them
      v_A := v_B;
      v_fA := v_fB;
    ELSE
      -- C and A have opposite signs - use Illinois algorithm modification
      -- This prevents one endpoint from staying fixed for too long
      v_fA := v_fA / 2;
    END IF;
    
    v_B := v_C;
    v_fB := v_fC;
    v_iteration := v_iteration + 1;
  END LOOP;
  
  -- Step 4: Return σ' = e^(B/2)
  RETURN EXP(v_B / 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- smarter way to calculate FSRS rating from marks and confidence
-- combines marks and confidence into a single rating adjustment
CREATE OR REPLACE FUNCTION calculate_fsrs_rating_from_marks(
  p_marks_awarded INTEGER,
  p_marks_available INTEGER,
  p_confidence INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_percentage DECIMAL(4,3);
  v_base_rating INTEGER;
BEGIN
  v_percentage := p_marks_awarded::DECIMAL / p_marks_available;
  
  -- Base rating from marks
  v_base_rating := CASE
    WHEN v_percentage < 0.25 THEN 1
    WHEN v_percentage < 0.55 THEN 2
    WHEN v_percentage < 0.85 THEN 3
    ELSE 4
  END;
  
  -- Apply full 2D matrix
  RETURN CASE
    -- Again (1) - always stays 1
    WHEN v_base_rating = 1 THEN 1
    
    -- Hard (2)
    WHEN v_base_rating = 2 AND p_confidence <= 2 THEN 1  -- Uncertain failure -> Again
    WHEN v_base_rating = 2 AND p_confidence = 3 THEN 2   -- Neutral
    WHEN v_base_rating = 2 AND p_confidence >= 4 THEN 3  -- Confident error -> Good
    
    -- Good (3)
    WHEN v_base_rating = 3 AND p_confidence <= 2 THEN 2  -- Lucky guess -> Hard
    WHEN v_base_rating = 3 AND p_confidence >= 3 THEN 3  -- Otherwise Good
    
    -- Easy (4)
    WHEN v_base_rating = 4 AND p_confidence <= 2 THEN 3  -- Very lucky -> Good
    WHEN v_base_rating = 4 AND p_confidence >= 3 THEN 4  -- True mastery
    ELSE v_base_rating  -- Fallback
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- =====================================================================================================================================================
--                                                                    TRIGGERS
-- =====================================================================================================================================================
-- =====================================================================================
-- PATCH: Add mastery_gap maintenance to update_ratings_and_schedule trigger
-- 
-- mastery_gap = topic elo - user's own average elo across all studied topics
--   Negative → this topic is below the user's average (relatively weak, higher urgency)
--   Positive → this topic is above the user's average (relatively strong, lower urgency)
--
-- Using personal average (not a fixed threshold like 1400) means the score is
-- self-relative: it identifies which topics are dragging you down compared to
-- YOUR current level, not compared to an arbitrary grade boundary.
--
-- The adaptive priority_score uses mastery_need = GREATEST(0.5, 1.0 + (mastery_gap / -200.0))
-- so mastery_gap = -200 → mastery_need = 2.0 (this topic 200 pts below your average = urgent)
--    mastery_gap =   0  → mastery_need = 1.0 (on par with your average)
--    mastery_gap = +200 → mastery_need = 0.5 (well above average, less urgent)
-- =====================================================================================

-- Step 1: Add the column if it doesn't exist yet
ALTER TABLE user_topic_mastery
  ADD COLUMN IF NOT EXISTS mastery_gap DECIMAL(8,2);

-- Step 2: Backfill all existing rows immediately
UPDATE user_topic_mastery utm
SET mastery_gap = utm.elo_rating - avg_elo.personal_avg
FROM (
  SELECT userid, AVG(elo_rating) AS personal_avg
  FROM user_topic_mastery
  WHERE elo_rating IS NOT NULL
  GROUP BY userid
) avg_elo
WHERE utm.userid = avg_elo.userid
  AND utm.elo_rating IS NOT NULL;

-- Step 3: Replace the trigger function with mastery_gap maintenance added.
-- Only the UPDATE user_topic_mastery block is changed (inside the per-topic loop).
-- The rest of the function is identical to the deployed version.
CREATE OR REPLACE FUNCTION update_ratings_and_schedule()
RETURNS TRIGGER AS $$
DECLARE
  v_question_elo        DECIMAL(6,2);
  v_question_rd         DECIMAL(6,2);
  v_question_volatility DOUBLE PRECISION;
  v_question_is_anchor  BOOLEAN;
  v_anchor_grade_level  VARCHAR(2);

  v_question_mu         DECIMAL(8,6);
  v_question_phi        DECIMAL(8,6);
  v_question_g          DECIMAL(8,6);

  v_actual_performance  DECIMAL(4,3);
  v_now                 TIMESTAMP := NOW();

  v_total_elo_change    DECIMAL(8,4) := 0;
  v_total_expected_E    DECIMAL(8,6) := 0;
  v_topic_count         INTEGER      := 0;

  v_new_question_elo    DECIMAL(6,2);
  v_new_question_rd     DECIMAL(6,2);
  v_elo_change          DECIMAL(6,2);

  _topic                RECORD;

  c_glicko_scale CONSTANT DECIMAL        := 173.7178;
  c_tau          CONSTANT DOUBLE PRECISION := 0.5;

  c_fsrs_w CONSTANT DECIMAL[] := ARRAY[
    0.4072, 1.1829,  3.1262, 15.4722,
    7.2102, 0.5316,  1.0651,  0.0234,
    1.6160, 0.1544,  0.9957,  2.0902,
    0.0726, 0.3025,  1.9661,  0.6210,
    2.9469
  ];

  c_fsrs_decay CONSTANT DECIMAL := -0.5;

  v_fsrs_snapped BOOLEAN := FALSE;

BEGIN
  -- STEP 1: Load question metadata
  SELECT elo_rating, glicko_rd, glicko_volatility, is_anchor, anchor_grade_level
  INTO   v_question_elo, v_question_rd, v_question_volatility,
         v_question_is_anchor, v_anchor_grade_level
  FROM   questions
  WHERE  questionid = NEW.questionid;

  NEW.question_elo_before := v_question_elo;
  NEW.question_rd_before  := v_question_rd;
  NEW.is_anchor_attempt   := v_question_is_anchor;

  v_question_mu  := (v_question_elo - 1500) / c_glicko_scale;
  v_question_phi := v_question_rd          / c_glicko_scale;
  v_question_g   := 1.0 / SQRT(1 + (3 * v_question_phi * v_question_phi) / (PI() * PI()));

  -- STEP 2: Determine FSRS rating
  IF NEW.grading_status = 'graded' THEN
    IF NEW.marks_available IS NOT NULL AND NEW.marks_awarded IS NOT NULL THEN
      NEW.fsrs_rating := calculate_fsrs_rating_from_marks(
        NEW.marks_awarded, NEW.marks_available, NEW.confidence
      );
    ELSIF NEW.is_correct IS NOT NULL THEN
      NEW.fsrs_rating := CASE
        WHEN NOT NEW.is_correct               THEN 1
        WHEN NEW.confidence <= 2              THEN 2
        WHEN NEW.confidence  = 3              THEN 3
        WHEN NEW.confidence  = 4              THEN 3
        ELSE                                       4
      END;
    ELSE
      NEW.fsrs_rating := 2;
    END IF;
  END IF;

  -- STEP 3: Determine objective performance for Glicko-2
  IF NEW.grading_status != 'graded' THEN
    NEW.question_elo_after := v_question_elo;
    NEW.question_rd_after  := v_question_rd;
    NEW.expected_success_probability := NULL;
    RETURN NEW;
  END IF;

  v_actual_performance := COALESCE(
    NEW.marks_awarded::DECIMAL / NULLIF(NEW.marks_available, 0),
    CASE
      WHEN NEW.is_correct IS NOT NULL AND NEW.is_correct THEN 1.0
      WHEN NEW.is_correct IS NOT NULL                    THEN 0.0
      ELSE NULL
    END,
    0.0
  );

  IF NEW.marks_available IS NOT NULL AND NEW.marks_awarded IS NOT NULL THEN
    NEW.is_correct := (NEW.marks_awarded::DECIMAL / NEW.marks_available) >= 0.75;
  END IF;

  -- STEP 4: Guard - exit if no topic mappings
  IF NOT EXISTS (
    SELECT 1 FROM question_topics WHERE questionid = NEW.questionid
  ) THEN
    NEW.question_elo_after := v_question_elo;
    NEW.question_rd_after  := v_question_rd;
    NEW.expected_success_probability := NULL;
    RETURN NEW;
  END IF;

  -- STEP 5: Per-topic Glicko-2 + FSRS loop
  FOR _topic IN
    SELECT t.topicid
    FROM   question_topics qt
    JOIN   topics t ON qt.topic_code = t.topic_code
    WHERE  qt.questionid = NEW.questionid
  LOOP
    DECLARE
      v_user_elo         DECIMAL(6,2);
      v_user_rd          DECIMAL(6,2);
      v_user_volatility  DOUBLE PRECISION;
      v_fsrs_stability   DECIMAL(8,4);
      v_fsrs_difficulty  DECIMAL(4,2);
      v_fsrs_state       VARCHAR(15);
      v_last_review      TIMESTAMP;

      v_mu               DECIMAL(8,6);
      v_phi              DECIMAL(8,6);
      v_sigma            DOUBLE PRECISION;
      v_E                DECIMAL(8,6);
      v_v                DOUBLE PRECISION;
      v_delta            DOUBLE PRECISION;
      v_phi_star         DECIMAL(8,6);
      v_new_phi          DECIMAL(8,6);
      v_new_mu           DECIMAL(8,6);
      v_new_sigma        DOUBLE PRECISION;
      v_new_user_elo     DECIMAL(6,2);
      v_new_user_rd      DECIMAL(6,2);
      v_new_user_volatility DOUBLE PRECISION;

      v_days_elapsed     DECIMAL(8,4);
      v_retrievability   DECIMAL(8,6);
      v_new_stability    DECIMAL(8,4);
      v_new_difficulty   DECIMAL(4,2);
      v_new_state        VARCHAR(15);
      v_interval_days    DECIMAL(8,4);
      v_d0_3             DECIMAL(4,2);
    BEGIN
      INSERT INTO user_topic_mastery (userid, topicid)
      VALUES (NEW.userid, _topic.topicid)
      ON CONFLICT (userid, topicid) DO NOTHING;

      SELECT elo_rating, glicko_rd, glicko_volatility,
             fsrs_stability, fsrs_difficulty, fsrs_state, last_review_date
      INTO   v_user_elo, v_user_rd, v_user_volatility,
             v_fsrs_stability, v_fsrs_difficulty, v_fsrs_state, v_last_review
      FROM   user_topic_mastery
      WHERE  userid = NEW.userid AND topicid = _topic.topicid;

      v_days_elapsed := COALESCE(
        EXTRACT(EPOCH FROM (NEW.attempted_at - v_last_review)) / 86400.0, 0
      );

      -- Glicko-2
      v_mu    := (v_user_elo - 1500) / c_glicko_scale;
      v_phi   := v_user_rd          / c_glicko_scale;
      v_sigma := v_user_volatility;

      v_E := 1.0 / (1 + EXP(-v_question_g * (v_mu - v_question_mu)));
      v_total_expected_E := v_total_expected_E + v_E;

      v_v     := 1.0 / (v_question_g * v_question_g * v_E * (1 - v_E));
      v_delta := v_v * v_question_g * (v_actual_performance - v_E);

      v_new_sigma := calculate_glicko2_volatility(v_phi, v_sigma, v_delta, v_v, c_tau);
      v_phi_star  := SQRT(v_phi * v_phi + v_new_sigma * v_new_sigma);
      v_new_phi   := 1.0 / SQRT(1.0 / (v_phi_star * v_phi_star) + 1.0 / v_v);
      v_new_mu    := v_mu + v_new_phi * v_new_phi * v_question_g * (v_actual_performance - v_E);

      v_new_user_elo        := GREATEST(800,  LEAST(2400, c_glicko_scale * v_new_mu  + 1500));
      v_new_user_rd         := GREATEST(30,   LEAST(350,  c_glicko_scale * v_new_phi       ));
      v_new_user_volatility := GREATEST(0.03, LEAST(0.15, v_new_sigma                       ));

      v_total_elo_change := v_total_elo_change + (v_new_user_elo - v_user_elo);
      v_topic_count      := v_topic_count + 1;

      IF v_topic_count = 1 THEN
        NEW.user_elo_before := v_user_elo;
        NEW.user_elo_after  := v_new_user_elo;
        NEW.user_rd_before  := v_user_rd;
        NEW.user_rd_after   := v_new_user_rd;
      END IF;

      -- FSRS
      v_fsrs_stability := GREATEST(v_fsrs_stability, 0.1);

      IF NOT v_fsrs_snapped THEN
        NEW.fsrs_stability_before  := v_fsrs_stability;
        NEW.fsrs_difficulty_before := v_fsrs_difficulty;
      END IF;

      IF v_fsrs_state = 'new' THEN
        v_new_stability  := c_fsrs_w[NEW.fsrs_rating];
        v_new_difficulty := c_fsrs_w[5] - (NEW.fsrs_rating - 3) * c_fsrs_w[6];
        v_new_difficulty := GREATEST(1, LEAST(10, v_new_difficulty));
        v_new_state := CASE WHEN NEW.fsrs_rating = 1 THEN 'learning' ELSE 'review' END;

      ELSIF NEW.fsrs_rating = 1 THEN
        v_retrievability := POWER(1 + v_days_elapsed / (9.0 * v_fsrs_stability), c_fsrs_decay);
        v_new_stability  :=
            c_fsrs_w[12]
          * POWER(v_fsrs_difficulty,   -c_fsrs_w[13])
          * (POWER(v_fsrs_stability + 1, c_fsrs_w[14]) - 1)
          * EXP(c_fsrs_w[15] * (1 - v_retrievability));
        v_new_stability := LEAST(v_new_stability, v_fsrs_stability * 0.9);
        v_new_stability := GREATEST(v_new_stability, 0.1);
        v_new_state := CASE WHEN v_fsrs_state = 'review' THEN 'relearning' ELSE 'learning' END;
        v_d0_3          := c_fsrs_w[5];
        v_new_difficulty := v_fsrs_difficulty - c_fsrs_w[7] * (NEW.fsrs_rating - 3);
        v_new_difficulty := c_fsrs_w[8] * v_d0_3 + (1 - c_fsrs_w[8]) * v_new_difficulty;
        v_new_difficulty := GREATEST(1, LEAST(10, v_new_difficulty));

      ELSE
        v_retrievability := POWER(1 + v_days_elapsed / (9.0 * v_fsrs_stability), c_fsrs_decay);
        v_new_stability  := v_fsrs_stability * (
          1 + EXP(c_fsrs_w[9]) * (11 - v_fsrs_difficulty)
            * POWER(v_fsrs_stability, -c_fsrs_w[10])
            * (EXP((1 - v_retrievability) * c_fsrs_w[11]) - 1)
            * CASE
                WHEN NEW.fsrs_rating = 2 THEN c_fsrs_w[16]
                WHEN NEW.fsrs_rating = 4 THEN c_fsrs_w[17]
                ELSE 1
              END
        );
        v_new_state := CASE
          WHEN v_fsrs_state IN ('learning', 'relearning') AND NEW.fsrs_rating >= 3 THEN 'review'
          ELSE v_fsrs_state
        END;
        v_d0_3          := c_fsrs_w[5];
        v_new_difficulty := v_fsrs_difficulty - c_fsrs_w[7] * (NEW.fsrs_rating - 3);
        v_new_difficulty := c_fsrs_w[8] * v_d0_3 + (1 - c_fsrs_w[8]) * v_new_difficulty;
        v_new_difficulty := GREATEST(1, LEAST(10, v_new_difficulty));
      END IF;

      v_interval_days := GREATEST(1, LEAST(36500,
        ROUND(v_new_stability * (POWER(0.9, 1.0 / c_fsrs_decay) - 1) * 9.0)
      ));

      IF NOT v_fsrs_snapped THEN
        NEW.fsrs_stability_after  := v_new_stability;
        NEW.fsrs_difficulty_after := v_new_difficulty;
        NEW.fsrs_interval_days    := v_interval_days;
        v_fsrs_snapped := TRUE;
      END IF;

      -- ── Persist mastery row ─────────────────────────────────────────────────────
      UPDATE user_topic_mastery SET
        elo_rating         = v_new_user_elo,
        glicko_rd          = v_new_user_rd,
        glicko_volatility  = v_new_user_volatility,

        -- mastery_gap = this topic's new ELO minus the user's current average ELO
        -- across all topics they have studied. Recomputed live on every answer so the
        -- adaptive algorithm always has an accurate picture of relative weaknesses.
        mastery_gap        = v_new_user_elo - (
          SELECT AVG(elo_rating)
          FROM user_topic_mastery
          WHERE userid = NEW.userid
            AND elo_rating IS NOT NULL
        ),

        fsrs_stability     = v_new_stability,
        fsrs_difficulty    = v_new_difficulty,
        fsrs_state         = v_new_state,
        last_review_date   = NEW.attempted_at,
        next_review_date   = NEW.attempted_at + (v_interval_days || ' days')::INTERVAL,

        total_study_time_seconds = total_study_time_seconds + COALESCE(NEW.time_taken, 0),

        anchor_attempts_total = CASE
          WHEN v_question_is_anchor THEN anchor_attempts_total + 1
          ELSE anchor_attempts_total
        END,
        anchor_attempts_by_grade = CASE
          WHEN v_question_is_anchor THEN
            jsonb_set(
              COALESCE(anchor_attempts_by_grade, '{}'::jsonb),
              ARRAY[v_anchor_grade_level],
              jsonb_build_object(
                'attempts',
                COALESCE((anchor_attempts_by_grade->v_anchor_grade_level->>'attempts')::int, 0) + 1,
                'correct',
                COALESCE((anchor_attempts_by_grade->v_anchor_grade_level->>'correct')::int, 0)
                  + (CASE WHEN NEW.is_correct THEN 1 ELSE 0 END)
              ),
              true
            )
          ELSE anchor_attempts_by_grade
        END,

        updated_at = v_now
      WHERE userid  = NEW.userid
        AND topicid = _topic.topicid;
    END;
  END LOOP;

  -- STEP 6: Store average expected success probability
  NEW.expected_success_probability := CASE
    WHEN v_topic_count > 0 THEN v_total_expected_E / v_topic_count
    ELSE NULL
  END;

  -- STEP 7: Update question ratings (skip anchors)
  IF NOT v_question_is_anchor AND v_topic_count > 0 THEN
    DECLARE
      v_current_attempts INTEGER;
    BEGIN
      SELECT attempts_count INTO v_current_attempts
      FROM   questions WHERE questionid = NEW.questionid;

      v_elo_change       := v_total_elo_change / v_topic_count;
      v_new_question_elo := GREATEST(800, LEAST(2400, v_question_elo - v_elo_change * 0.5));
      v_new_question_rd  := GREATEST(
        30,
        v_question_rd * (1 - GREATEST(0.02, 0.20 * EXP(-0.3 * v_current_attempts)))
      );

      UPDATE questions SET
        elo_rating        = v_new_question_elo,
        glicko_rd         = v_new_question_rd,
        glicko_volatility = GREATEST(0.03, v_question_volatility * 0.99),
        attempts_count    = attempts_count + 1,
        correct_count     = correct_count + (CASE WHEN NEW.is_correct THEN 1 ELSE 0 END),
        avg_time_seconds  = ROUND(
          (COALESCE(avg_time_seconds, 0) * attempts_count + COALESCE(NEW.time_taken, 0))
          / (attempts_count + 1)
        ),
        updated_at        = v_now
      WHERE questionid = NEW.questionid;

      NEW.question_elo_after := v_new_question_elo;
      NEW.question_rd_after  := v_new_question_rd;
    END;
  ELSE
    NEW.question_elo_after := v_question_elo;
    NEW.question_rd_after  := v_question_rd;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ==========================================================================================================================================================================================================================================
-- Re-attach trigger
-- ==========================================================================================================================================================================================================================================
DROP TRIGGER IF EXISTS trigger_update_ratings ON question_attempts;
CREATE TRIGGER trigger_update_ratings
BEFORE INSERT ON question_attempts
FOR EACH ROW
EXECUTE FUNCTION update_ratings_and_schedule();


-- =====================================================================================================================================================
--                                                              MAINTENANCE FUNCTIONS
-- =====================================================================================================================================================

-- Function: Refresh recent performance metrics (run daily via cron)
CREATE OR REPLACE FUNCTION refresh_recent_performance()
RETURNS void AS $$
BEGIN
  -- Update recent 30-day stats for all users
  -- This powers the "recent performance" analytics
  UPDATE user_topic_mastery utm
  SET 
    recent_attempts = COALESCE(subq.recent_attempts, 0),
    recent_correct = COALESCE(subq.recent_correct, 0),
    recent_accuracy = ROUND(
      (COALESCE(subq.recent_correct, 0)::DECIMAL / NULLIF(subq.recent_attempts, 0)) * 100, 
      2
    ),
    avg_time_per_question = subq.avg_time,
    avg_confidence = subq.avg_conf
  FROM (
    SELECT 
      qa.userid,
      t.topicid,              -- Changed from qt.topicid to t.topicid
      COUNT(*) as recent_attempts,
      SUM(CASE WHEN qa.is_correct THEN 1 ELSE 0 END) as recent_correct,
      ROUND(AVG(qa.time_taken)) as avg_time,
      ROUND(AVG(qa.confidence), 2) as avg_conf
    FROM question_attempts qa
    JOIN question_topics qt ON qa.questionid = qt.questionid
    JOIN topics t ON qt.topic_code = t.topic_code
    WHERE qa.attempted_at > NOW() - INTERVAL '30 days'
    GROUP BY qa.userid, t.topicid    -- Changed here too
  ) subq
  WHERE utm.userid = subq.userid AND utm.topicid = subq.topicid;
  END;
$$ LANGUAGE plpgsql;

-- Function: Decay rating deviation for inactive users (run weekly)
CREATE OR REPLACE FUNCTION decay_inactive_ratings()
RETURNS void AS $$
DECLARE
  v_tau CONSTANT DECIMAL := 0.5; -- System volatility constant (matches rating updates)
BEGIN
  -- Glicko-2 time decay: RD increases based on volatility and time inactive
  -- Formula: φ* = √(φ² + σ² x time_periods)
  -- 
  -- We define 1 time_period = 30 days for educational context
  -- This matches the system's natural review cycle
  
  UPDATE user_topic_mastery
  SET
    glicko_rd = LEAST(
      350,  -- Maximum uncertainty
      SQRT(
        (glicko_rd / 173.7178) * (glicko_rd / 173.7178) + 
        glicko_volatility * glicko_volatility * 
        (EXTRACT(EPOCH FROM (NOW() - last_review_date)) / (86400 * 30)) -- Time periods
      ) * 173.7178  -- Convert back to Elo scale
    ),
    updated_at = NOW()
  WHERE last_review_date < NOW() - INTERVAL '30 days'
    AND glicko_rd < 350;
  
  -- Questions decay more slowly (only if truly stale)
  UPDATE questions
  SET
    glicko_rd = LEAST(
      350,
      SQRT(
        (glicko_rd / 173.7178) * (glicko_rd / 173.7178) + 
        glicko_volatility * glicko_volatility * 
        (EXTRACT(EPOCH FROM (NOW() - updated_at)) / (86400 * 60)) -- Slower decay
      ) * 173.7178
    ),
    updated_at = NOW()
  WHERE updated_at < NOW() - INTERVAL '60 days'
    AND glicko_rd < 350
    AND NOT is_anchor;  -- Never decay anchor questions
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION decay_inactive_ratings IS 
'Canonical Glicko-2 time-based RD inflation.
Increases rating deviation (uncertainty) for inactive users using:
φ* = √(φ² + σ² * time_periods)
where 1 period = 30 days for users, 60 days for questions.';


-- =====================================================================================================================================================
--                                                              TESTING/VALIDATION FUNCTIONS
-- =====================================================================================================================================================

-- Test the volatility calculation matches Glickman's paper example
CREATE OR REPLACE FUNCTION test_glicko2_example() RETURNS TABLE(
  test_name TEXT,
  expected_value DOUBLE PRECISION,
  actual_value DOUBLE PRECISION,
  difference DOUBLE PRECISION,
  passes BOOLEAN
) AS $$
BEGIN
  -- Example from Glickman's paper:
  -- Player: µ=0, φ=1.1513, σ=0.05999
  -- Opponent: µ=0.4, φ=0.8723
  -- Result: Win (s=1)
  -- After calculation: σ' should be approximately 0.05999 (stable volatility)
  
  RETURN QUERY
  WITH calculation AS (
    SELECT 
      calculate_glicko2_volatility(
        1.1513::DOUBLE PRECISION,  -- phi
        0.05999::DOUBLE PRECISION, -- sigma
        0.1718::DOUBLE PRECISION,  -- delta (pre-calculated from paper)
        1.7790::DOUBLE PRECISION,  -- v (pre-calculated from paper)
        0.5::DOUBLE PRECISION      -- tau
      ) AS calculated_sigma
  )
  SELECT 
    'Volatility Calculation'::TEXT,
    0.05999::DOUBLE PRECISION AS expected,
    c.calculated_sigma AS actual,
    ABS(c.calculated_sigma - 0.05999) AS diff,
    ABS(c.calculated_sigma - 0.05999) < 0.001 AS passes
  FROM calculation c;
END;
$$ LANGUAGE plpgsql;

-- Run test with: SELECT * FROM test_glicko2_example();


-- =====================================================================================
-- MASTERY COMPONENT
-- =====================================================================================
-- Adds 3 columns to track relative topic weakness
-- Auto-updates via trigger when Elo changes

-- =====================================================================================
-- STEP 1: Add columns (one-time migration)
-- =====================================================================================

ALTER TABLE user_topic_mastery
ADD COLUMN IF NOT EXISTS mastery_gap DECIMAL(6,2),
ADD COLUMN IF NOT EXISTS mastery_z_score DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS mastery_category VARCHAR(20);


-- =====================================================================================
-- STEP 2: Auto-update trigger (runs after every question attempt)
-- =====================================================================================

CREATE OR REPLACE FUNCTION trigger_update_mastery_after_attempt()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate mastery for this user only
  WITH user_baseline AS (
    SELECT 
      userid,
      AVG(elo_rating) AS avg_elo,
      STDDEV(elo_rating) AS elo_stddev
    FROM user_topic_mastery
    WHERE userid = NEW.userid
      AND fsrs_state != 'new'
      AND elo_rating IS NOT NULL
    GROUP BY userid
    HAVING COUNT(*) >= 2  -- Need at least 2 topics
  )
  UPDATE user_topic_mastery utm
  SET 
    mastery_gap = utm.elo_rating - ub.avg_elo,
    mastery_z_score = 
      CASE 
        WHEN ub.elo_stddev > 0 THEN 
          ROUND(((utm.elo_rating - ub.avg_elo) / ub.elo_stddev)::numeric, 2)
        ELSE 0
      END,
    mastery_category = 
      CASE 
        WHEN ub.elo_stddev = 0 THEN 'Competent'
        WHEN (utm.elo_rating - ub.avg_elo) / ub.elo_stddev < -1.5 THEN 'Struggling'
        WHEN (utm.elo_rating - ub.avg_elo) / ub.elo_stddev < -0.5 THEN 'Developing'
        WHEN (utm.elo_rating - ub.avg_elo) / ub.elo_stddev < 0.5 THEN 'Competent'
        WHEN (utm.elo_rating - ub.avg_elo) / ub.elo_stddev < 1.5 THEN 'Proficient'
        ELSE 'Mastered'
      END
  FROM user_baseline ub
  WHERE utm.userid = NEW.userid
    AND utm.fsrs_state != 'new';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
DROP TRIGGER IF EXISTS trigger_update_mastery ON user_topic_mastery;
CREATE TRIGGER trigger_update_mastery
AFTER UPDATE OF elo_rating ON user_topic_mastery
FOR EACH ROW
EXECUTE FUNCTION trigger_update_mastery_after_attempt();


-- =====================================================================================
-- STEP 3: Initialize for existing users (run once)
-- =====================================================================================

DO $$
DECLARE
  v_user RECORD;
BEGIN
  FOR v_user IN (SELECT DISTINCT userid FROM user_topic_mastery)
  LOOP
    WITH user_baseline AS (
      SELECT 
        AVG(elo_rating) AS avg_elo,
        STDDEV(elo_rating) AS elo_stddev
      FROM user_topic_mastery
      WHERE userid = v_user.userid
        AND fsrs_state != 'new'
      HAVING COUNT(*) >= 2
    )
    UPDATE user_topic_mastery utm
    SET 
      mastery_gap = utm.elo_rating - ub.avg_elo,
      mastery_z_score = 
        CASE 
          WHEN ub.elo_stddev > 0 THEN 
            ROUND(((utm.elo_rating - ub.avg_elo) / ub.elo_stddev)::numeric, 2)
          ELSE 0
        END,
      mastery_category = 
        CASE 
          WHEN ub.elo_stddev = 0 THEN 'Competent'
          WHEN (utm.elo_rating - ub.avg_elo) / ub.elo_stddev < -1.5 THEN 'Struggling'
          WHEN (utm.elo_rating - ub.avg_elo) / ub.elo_stddev < -0.5 THEN 'Developing'
          WHEN (utm.elo_rating - ub.avg_elo) / ub.elo_stddev < 0.5 THEN 'Competent'
          WHEN (utm.elo_rating - ub.avg_elo) / ub.elo_stddev < 1.5 THEN 'Proficient'
          ELSE 'Mastered'
        END
    FROM user_baseline ub
    WHERE utm.userid = v_user.userid
      AND utm.fsrs_state != 'new';
  END LOOP;
END $$;

-- Verify it worked
SELECT 
  COUNT(*) AS total_topics,
  COUNT(mastery_gap) AS with_mastery,
  COUNT(*) FILTER (WHERE mastery_category = 'Struggling') AS struggling,
  COUNT(*) FILTER (WHERE mastery_category = 'Developing') AS developing,
  COUNT(*) FILTER (WHERE mastery_category = 'Competent') AS competent,
  COUNT(*) FILTER (WHERE mastery_category = 'Proficient') AS proficient,
  COUNT(*) FILTER (WHERE mastery_category = 'Mastered') AS mastered
FROM user_topic_mastery
WHERE fsrs_state != 'new';



-- =====================================================================================
--  ONBOARDING MIGRATION
--  Adds is_onboarded flag to users table so the app can redirect new users
--  through the grade/topic calibration wizard before reaching the dashboard.
-- =====================================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing users who already have topic mastery rows are considered onboarded
UPDATE users u
SET is_onboarded = TRUE
WHERE EXISTS (
  SELECT 1 FROM user_topic_mastery utm WHERE utm.userid = u.userid
);

-- Index for fast lookup on login
CREATE INDEX IF NOT EXISTS idx_users_is_onboarded ON users(userid) WHERE is_onboarded = FALSE;