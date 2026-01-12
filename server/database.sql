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
  username VARCHAR(255) NOT NULL UNIQUE,
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
  exam_weight DECIMAL(3,2) DEFAULT 1.0 -- total digits: 3, digits after decimal: 2
);

CREATE INDEX idx_topics_parent_topic ON topics(parent_topic);


CREATE TABLE questions (
  questionid SERIAL PRIMARY KEY,
  question_text TEXT NOT NULL,
  image_url TEXT,
  question_format VARCHAR(50) NOT NULL,
  correct_answer TEXT,
  answer_options JSONB, -- will be used for multiple choice questions
  explanation TEXT, -- The rubric used for feynman-style questions

  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 100) NOT NULL,
  total_marks INTEGER DEFAULT 1, -- might not be needed

  -- ELO/GLICKO-2 RATINGS (Dynamic difficulty) 
  -- Question difficulty rating. 1500 = average, higher = harder
  elo_rating DECIMAL(6,2) DEFAULT 1500.00 CHECK (elo_rating BETWEEN 800 AND 2400),
  
  -- Rating Deviation (uncertainty about difficulty). 350 = new question, <100 = well-calibrated
  glicko_rd DECIMAL(6,2) DEFAULT 350.00 CHECK (glicko_rd BETWEEN 30 AND 350),
  
  -- Rating volatility (how much the rating fluctuates)
  glicko_volatility DECIMAL(4,3) DEFAULT 0.060,

  -- ==== CALIBRATION METADATA ====
  attempts_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  avg_time_seconds INTEGER,

  -- ANCHOR QUESTIONS (Fixed-difficulty reference points for stable grading)
  -- These questions NEVER update their Elo rating - they define grade boundaries
  is_anchor BOOLEAN DEFAULT FALSE,
  anchor_grade_level VARCHAR(2) CHECK (anchor_grade_level IN ('E', 'D', 'C', 'B', 'A', 'A*')),
  anchor_source VARCHAR(200), -- e.g., "Edexcel June 2023 Paper 1 Q7"

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_questions_difficulty ON questions(difficulty);
CREATE INDEX idx_questions_elo ON questions(elo_rating);
CREATE INDEX idx_questions_anchor ON questions(is_anchor, anchor_grade_level) WHERE is_anchor = TRUE;

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

  user_answer TEXT,
  is_correct BOOLEAN, -- used for mcq questions

  -- Self-assessment
  marks_awarded INTEGER, -- What student thinks they got
  marks_available INTEGER,

  confidence INTEGER CHECK (confidence BETWEEN 1 AND 5),
  time_taken INTEGER, -- in seconds
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
  fsrs_rating INTEGER CHECK (fsrs_rating BETWEEN 1 AND 4), -- 1=again, 2=hard, 3=good, 4=easy
  fsrs_interval_days DECIMAL(8,4), -- Days until next review
  fsrs_stability_before DECIMAL(8,4), -- Memory strength before this attempt
  fsrs_stability_after DECIMAL(8,4),  -- Memory strength after this attempt
  fsrs_difficulty_before DECIMAL(4,2), -- User-perceived difficulty (1-10) before
  fsrs_difficulty_after DECIMAL(4,2),  -- User-perceived difficulty after

  -- Probability that user would answer the question correctly, calculated using Glicko-2 expectation formula
  -- Based on user ability vs question difficulty (averaged across all topics if multi-topic question)
  -- Used for adaptive difficulty targeting and performance analysis

  expected_success_probability DECIMAL(4,3), -- Calculated before attempt using Elo formula

  question_difficulty INTEGER, -- may be redundant
  is_anchor_attempt BOOLEAN DEFAULT FALSE, -- Was this an anchor question?

  attempted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_question_attempts_userid ON question_attempts(userid, attempted_at DESC);
CREATE INDEX idx_question_attempts_questionid ON question_attempts(questionid);
CREATE INDEX idx_question_attempts_userid_questionid ON question_attempts(userid, questionid);
CREATE INDEX idx_attempts_anchor ON question_attempts(userid, is_anchor_attempt) WHERE is_anchor_attempt = TRUE;
CREATE INDEX idx_attempts_fsrs_rating ON question_attempts(fsrs_rating);


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
  glicko_rd DECIMAL(6,2) DEFAULT 350.00 CHECK (glicko_rd BETWEEN 30 AND 350),
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




-- =====================================================================================================================================================
--                                                                    TRIGGERS
-- =====================================================================================================================================================

-- Auto-update user_progress when questions are answered
CREATE OR REPLACE FUNCTION update_user_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_last_activity DATE;
BEGIN
  -- Get user's last activity date
  SELECT last_activity_date INTO v_last_activity
  FROM user_progress
  WHERE userid = NEW.userid;
  
  -- Update streak logic (Objective 11: Daily streak system)
  IF v_last_activity IS NULL THEN
    -- First ever activity
    UPDATE user_progress
    SET 
      current_streak = 1,
      longest_streak = 1,
      last_activity_date = CURRENT_DATE
    WHERE userid = NEW.userid;
    
  ELSIF v_last_activity = CURRENT_DATE THEN
    -- Already studied today, no streak change
    NULL;
    
  ELSIF v_last_activity = CURRENT_DATE - INTERVAL '1 day' THEN
    -- Consecutive day - increment streak
    UPDATE user_progress
    SET 
      current_streak = current_streak + 1,
      longest_streak = GREATEST(longest_streak, current_streak + 1),
      last_activity_date = CURRENT_DATE
    WHERE userid = NEW.userid;
    
  ELSE
    -- Streak broken - reset to 1
    UPDATE user_progress
    SET 
      current_streak = 1,
      last_activity_date = CURRENT_DATE
    WHERE userid = NEW.userid;
  END IF;
  
  -- Update stats (always runs) - Objective 4f: Questions answered
  UPDATE user_progress
  SET 
    total_questions_answered = total_questions_answered + 1,
    total_study_time = total_study_time + COALESCE(NEW.time_taken, 0),
    total_xp = total_xp + (CASE WHEN NEW.is_correct THEN 15 ELSE 5 END),
    updated_at = NOW()
  WHERE userid = NEW.userid;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_progress
AFTER INSERT ON question_attempts
FOR EACH ROW
EXECUTE FUNCTION update_user_progress();


-- =====================================================================================================================================================
--                                    CORE ADAPTIVE ALGORITHM: Auto-update Elo/Glicko-2 ratings and FSRS schedule
-- =====================================================================================================================================================

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


-- =====================================================================================
--                    CORRECTED TRIGGER WITH OBJECTIVE GLICKO-2
-- =====================================================================================

-- our smart trigger function that updates both user and question ratings and the FSRS schedule
CREATE OR REPLACE FUNCTION update_ratings_and_schedule()
RETURNS TRIGGER AS $$
DECLARE
  v_topic_record RECORD;
  v_question_elo DECIMAL(6,2);
  v_question_rd DECIMAL(6,2);
  v_question_volatility DOUBLE PRECISION;
  v_question_is_anchor BOOLEAN;
  v_anchor_grade_level VARCHAR(2);
  v_new_question_elo DECIMAL(6,2);
  v_new_question_rd DECIMAL(6,2);
  v_elo_change DECIMAL(6,2);
  v_days_since_last_review DECIMAL(8,4);
  v_now TIMESTAMP := NOW(); -- Single timestamp for consistency
  
  -- NEW: Objective performance for Glicko-2 (marks only, no confidence)
  v_actual_performance DECIMAL(4,3);
  
  -- Glicko-2 constants
  c_glicko_scale CONSTANT DECIMAL := 173.7178; -- 400/ln(10)
  c_tau CONSTANT DOUBLE PRECISION := 0.5; -- System volatility constant (0.3-1.2 recommended)
  
  -- FSRS-5 weights (from research) - NOTE: PostgreSQL arrays are 1-indexed
  -- Mapping: w[0] -> c_fsrs_w[1], w[1] -> c_fsrs_w[2], etc.
  c_fsrs_w CONSTANT DECIMAL[] := ARRAY[
    0.4072, 1.1829, 3.1262, 15.4722, -- w[0-3]: initial stability by rating
    7.2102, 0.5316, 1.0651, 0.0234,  -- w[4-7]: difficulty adjustments
    1.616, 0.1544, 0.9957, 2.0902,   -- w[8-11]: failed review parameters
    0.0726, 0.3025, 1.9661, 0.621,   -- w[12-15]: successful review parameters
    2.9469                            -- w[16]: hard penalty multiplier
  ];
  c_fsrs_decay CONSTANT DECIMAL := -0.5;
  
  -- FSRS retention target (configurable per user in future)
  -- 0.9 = 90% retention probability at next review
  c_target_retention CONSTANT DECIMAL := 0.9;
  
  -- Accumulator for multi-topic question rating adjustment
  v_total_elo_change DECIMAL(8,4) := 0;
  v_topic_count INTEGER := 0;
  
  -- Expected success vs question (calculated once)
  v_question_expected_score DECIMAL(4,3);
  v_question_mu DECIMAL(8,6);
  v_question_phi DECIMAL(8,6);
  v_question_g DECIMAL(8,6);
BEGIN
  -- ========== STEP 1: Get question's current ratings ==========
  SELECT elo_rating, glicko_rd, glicko_volatility, is_anchor, anchor_grade_level
  INTO v_question_elo, v_question_rd, v_question_volatility, v_question_is_anchor, v_anchor_grade_level
  FROM questions 
  WHERE questionid = NEW.questionid;
  
  -- Store question data in attempt
  NEW.question_elo_before := v_question_elo;
  NEW.question_rd_before := v_question_rd;
  NEW.is_anchor_attempt := v_question_is_anchor;
  NEW.question_difficulty := (SELECT difficulty FROM questions WHERE questionid = NEW.questionid);
  
  -- Pre-calculate question parameters for expected success (used for all topics)
  v_question_mu := (v_question_elo - 1500) / c_glicko_scale;
  v_question_phi := v_question_rd / c_glicko_scale;
  v_question_g := 1.0 / SQRT(1 + (3 * v_question_phi * v_question_phi) / (PI() * PI()));
  
  -- ========== STEP 2: Calculate FSRS rating from marks + confidence ==========
  -- FSRS uses BOTH marks and confidence (subjective memory strength)
  -- This is for scheduling reviews based on how well the material is retained
  
  IF NEW.marks_available IS NOT NULL AND NEW.marks_awarded IS NOT NULL THEN
    NEW.fsrs_rating := calculate_fsrs_rating_from_marks(
      NEW.marks_awarded,
      NEW.marks_available,
      NEW.confidence
    );
  -- For MCQ questions (is_correct is definitive)
  ELSIF NEW.is_correct IS NOT NULL THEN
    NEW.fsrs_rating := CASE 
      WHEN NOT NEW.is_correct THEN 1
      WHEN NEW.confidence <= 2 THEN 1
      WHEN NEW.confidence = 3 THEN 2
      WHEN NEW.confidence = 4 THEN 3
      ELSE 4
    END;
  -- Fallback (shouldn't happen)
  ELSE
    NEW.fsrs_rating := 2;  -- Default to "Hard"
  END IF;
  
  -- ========== STEP 2.5: Calculate OBJECTIVE performance for Glicko-2 ==========
  -- Glicko-2 uses ONLY marks (objective ability estimation)
  -- Confidence is ignored - we only care about actual performance
  
  v_actual_performance := COALESCE(
    -- If marks provided, use percentage (self-assessed questions)
    NEW.marks_awarded::DECIMAL / NULLIF(NEW.marks_available, 0),
    -- If binary is_correct provided, use it (MCQ questions)
    CASE 
      WHEN NEW.is_correct IS NOT NULL AND NEW.is_correct THEN 1.0
      WHEN NEW.is_correct IS NOT NULL THEN 0.0
      ELSE NULL
    END,
    0.0  -- Fallback to 0 if neither provided
  );
  
  -- Populate is_correct for database consistency (>=75% = correct)
  IF NEW.is_correct IS NULL AND NEW.marks_available IS NOT NULL THEN
    NEW.is_correct := (NEW.marks_awarded::DECIMAL / NEW.marks_available) >= 0.75;
  END IF;
  
  -- ========== STEP 3: Loop through ALL topics for this question ==========
  FOR v_topic_record IN 
    SELECT t.topicid 
    FROM question_topics qt
    JOIN topics t ON qt.topic_code = t.topic_code
    WHERE qt.questionid = NEW.questionid
  LOOP
    DECLARE
      v_user_elo DECIMAL(6,2);
      v_user_rd DECIMAL(6,2);
      v_user_volatility DOUBLE PRECISION;
      v_fsrs_stability DECIMAL(8,4);
      v_fsrs_difficulty DECIMAL(4,2);
      v_fsrs_state VARCHAR(15);
      v_last_review TIMESTAMP;
      v_new_user_elo DECIMAL(6,2);
      v_new_user_rd DECIMAL(6,2);
      v_new_user_volatility DOUBLE PRECISION;
      v_new_stability DECIMAL(8,4);
      v_new_difficulty DECIMAL(4,2);
      v_new_state VARCHAR(15);
      v_interval_days DECIMAL(8,4);
      v_retrievability DECIMAL(8,6);
      
      -- Glicko-2 variables
      v_mu DECIMAL(8,6);
      v_phi DECIMAL(8,6);
      v_sigma DOUBLE PRECISION;
      v_E DECIMAL(8,6);
      v_v DECIMAL(8,6);
      v_delta DECIMAL(8,6);
      v_phi_star DECIMAL(8,6);
      v_new_phi DECIMAL(8,6);
      v_new_mu DECIMAL(8,6);
      v_new_sigma DOUBLE PRECISION;
    BEGIN
      -- Create user_topic_mastery if doesn't exist
      INSERT INTO user_topic_mastery (userid, topicid)
      VALUES (NEW.userid, v_topic_record.topicid)
      ON CONFLICT (userid, topicid) DO NOTHING;
      
      -- Get user's current ratings for this topic
      SELECT 
        elo_rating, glicko_rd, glicko_volatility, 
        fsrs_stability, fsrs_difficulty, fsrs_state, last_review_date
      INTO 
        v_user_elo, v_user_rd, v_user_volatility,
        v_fsrs_stability, v_fsrs_difficulty, v_fsrs_state, v_last_review
      FROM user_topic_mastery
      WHERE userid = NEW.userid AND topicid = v_topic_record.topicid;
      
      -- FIXED: Use NEW.attempted_at instead of v_now for proper spacing calculation
      v_days_since_last_review := COALESCE(EXTRACT(EPOCH FROM (NEW.attempted_at - v_last_review)) / 86400, 0);
      
      -- ========== GLICKO-2 RATING UPDATE ==========
      -- Uses OBJECTIVE performance only (v_actual_performance)
      -- Confidence does NOT affect ability estimation
      
      -- Convert to Glicko-2 scale
      v_mu := (v_user_elo - 1500) / c_glicko_scale;
      v_phi := v_user_rd / c_glicko_scale;
      v_sigma := v_user_volatility;
      
      -- Expected outcome E(µ, µⱼ, φⱼ) using pre-calculated question values
      v_E := 1.0 / (1 + EXP(-v_question_g * (v_mu - v_question_mu)));
      
      -- Store expected success vs question (once, for primary comparison)
      IF v_topic_count = 0 THEN
        v_question_expected_score := v_E;
      END IF;
      
      -- Variance v
      v_v := 1.0 / (v_question_g * v_question_g * v_E * (1 - v_E));
      
      -- Performance difference Δ
      -- FIX: Use v_actual_performance instead of is_correct
      v_delta := v_v * v_question_g * (v_actual_performance - v_E);
      
      -- New volatility using Illinois algorithm (FULL GLICKO-2)
      v_new_sigma := calculate_glicko2_volatility(v_phi, v_sigma, v_delta, v_v, c_tau);
      
      -- Pre-rating period RD φ*
      v_phi_star := SQRT(v_phi * v_phi + v_new_sigma * v_new_sigma);
      
      -- New RD φ'
      v_new_phi := 1.0 / SQRT(1.0 / (v_phi_star * v_phi_star) + 1.0 / v_v);
      
      -- New rating µ'
      -- FIX: Use v_actual_performance instead of is_correct
      v_new_mu := v_mu + v_new_phi * v_new_phi * v_question_g * (v_actual_performance - v_E);
      
      -- Convert back to Elo scale
      v_new_user_elo := c_glicko_scale * v_new_mu + 1500;
      v_new_user_rd := c_glicko_scale * v_new_phi;
      v_new_user_volatility := v_new_sigma;
      
      -- Clamp to valid ranges
      v_new_user_elo := GREATEST(800, LEAST(2400, v_new_user_elo));
      v_new_user_rd := GREATEST(30, LEAST(350, v_new_user_rd));
      v_new_user_volatility := GREATEST(0.03, LEAST(0.15, v_new_user_volatility));
      
      -- Accumulate Elo changes
      v_total_elo_change := v_total_elo_change + (v_new_user_elo - v_user_elo);
      v_topic_count := v_topic_count + 1;
      
      -- Store first topic's data in attempt record
      IF v_topic_count = 1 THEN
        NEW.user_elo_before := v_user_elo;
        NEW.user_elo_after := v_new_user_elo;
        NEW.user_rd_before := v_user_rd;
        NEW.user_rd_after := v_new_user_rd;
      END IF;
      
      -- ========== FSRS-5 UPDATE ==========
      
      NEW.fsrs_stability_before := v_fsrs_stability;
      NEW.fsrs_difficulty_before := v_fsrs_difficulty;
      
      -- Safety guard
      v_fsrs_stability := GREATEST(v_fsrs_stability, 0.1);
      
      IF v_fsrs_state = 'new' THEN
        -- Initial stability: w[0-3] -> c_fsrs_w[1-4]
        v_new_stability := c_fsrs_w[NEW.fsrs_rating];
        v_new_state := CASE WHEN NEW.fsrs_rating = 1 THEN 'learning' ELSE 'review' END;
        v_new_difficulty := 5.0;
        
      ELSIF NEW.fsrs_rating = 1 THEN
        -- Failed review: calculate retrievability and reduce stability
        v_retrievability := POWER(1 + v_days_since_last_review / (9 * v_fsrs_stability), c_fsrs_decay);
        
        -- FIXED: Subtraction must be OUTSIDE the multiplication
        -- Formula: S' = w[7] × D^(-w[8]) × (S+1)^w[9] - 1
        v_new_stability := c_fsrs_w[9] * POWER(v_fsrs_difficulty, -c_fsrs_w[10]) * 
                          POWER(v_fsrs_stability + 1, c_fsrs_w[11]) - 1;
        
        -- SAFETY: Failed stability should NEVER exceed current stability
        -- Cap at 50% of previous stability when failing
        v_new_stability := LEAST(v_new_stability, v_fsrs_stability * 0.5);
        
        -- Ensure minimum stability (review within 24 hours for failures)
        v_new_stability := GREATEST(v_new_stability, 0.1);
        
        v_new_state := 'relearning';
        v_new_difficulty := LEAST(10, v_fsrs_difficulty - c_fsrs_w[8] * (NEW.fsrs_rating - 3));
        
      ELSE
        -- Successful review: exponential stability growth
        v_retrievability := POWER(1 + v_days_since_last_review / (9 * v_fsrs_stability), c_fsrs_decay);
        
        -- DEBUG: Log values
        RAISE NOTICE 'FSRS Growth Debug: days=%, stab=%, R=%, diff=%', 
          v_days_since_last_review, v_fsrs_stability, v_retrievability, v_fsrs_difficulty;
        
        v_new_stability := v_fsrs_stability * (
          1 + 
          EXP(c_fsrs_w[12]) * 
          (11 - v_fsrs_difficulty) * 
          POWER(v_fsrs_stability, -c_fsrs_w[13]) * 
          (EXP((1 - v_retrievability) * c_fsrs_w[14]) - 1) *
          CASE WHEN NEW.fsrs_rating = 2 THEN c_fsrs_w[17] ELSE 1 END
        );
        
        RAISE NOTICE 'FSRS Growth Debug: new_stab=%', v_new_stability;
        
        v_new_state := CASE 
          WHEN v_fsrs_state IN ('learning', 'relearning') AND NEW.fsrs_rating >= 3 THEN 'review'
          ELSE v_fsrs_state
        END;
        
        v_new_difficulty := GREATEST(1, LEAST(10, 
          v_fsrs_difficulty - c_fsrs_w[8] * (NEW.fsrs_rating - 3)
        ));
      END IF;
      
      -- FSRS-5 stability is ALREADY "days until 90% retention"
      v_interval_days := v_new_stability;
      
      -- Clamp to reasonable bounds
      v_interval_days := GREATEST(0.1, LEAST(36500, v_interval_days));
      
      NEW.fsrs_stability_after := v_new_stability;
      NEW.fsrs_difficulty_after := v_new_difficulty;
      NEW.fsrs_interval_days := v_interval_days;
      
      -- ========== Update user_topic_mastery ==========
      UPDATE user_topic_mastery SET
        -- Update Elo/Glicko-2 ratings
        elo_rating = v_new_user_elo,
        glicko_rd = v_new_user_rd,
        glicko_volatility = v_new_user_volatility,
        
        -- Update FSRS scheduling
        fsrs_stability = v_new_stability,
        fsrs_difficulty = v_new_difficulty,
        fsrs_state = v_new_state,
        -- FIXED: Use NEW.attempted_at instead of v_now for proper date tracking
        last_review_date = NEW.attempted_at,
        next_review_date = NEW.attempted_at + (v_interval_days || ' days')::INTERVAL,
        
        -- Update performance counters
        total_study_time_seconds = total_study_time_seconds + COALESCE(NEW.time_taken, 0),
        
        -- Track anchor attempts separately
        anchor_attempts_total = CASE
          WHEN v_question_is_anchor THEN anchor_attempts_total + 1
          ELSE anchor_attempts_total
        END,
        
        -- Update anchor tracking with grade-specific stats
        anchor_attempts_by_grade = CASE
          WHEN v_question_is_anchor THEN
            jsonb_set(
              COALESCE(anchor_attempts_by_grade, '{}'::jsonb),
              ARRAY[v_anchor_grade_level],
              jsonb_build_object(
                'attempts', 
                COALESCE((anchor_attempts_by_grade->v_anchor_grade_level->>'attempts')::int, 0) + 1,
                'correct',
                COALESCE((anchor_attempts_by_grade->v_anchor_grade_level->>'correct')::int, 0) + 
                  (CASE WHEN NEW.is_correct THEN 1 ELSE 0 END)
              ),
              true
            )
          ELSE anchor_attempts_by_grade
        END,
        
        updated_at = v_now
      WHERE userid = NEW.userid AND topicid = v_topic_record.topicid;
      
    END;
  END LOOP;
  
  -- Store expected success probability (vs question, not topic-specific)
  NEW.expected_success_probability := v_question_expected_score;
  
  -- ========== Update question stats (SKIP if anchor!) ==========
  IF NOT v_question_is_anchor THEN
    -- Use AVERAGE of Elo changes across all topics
    v_elo_change := v_total_elo_change / GREATEST(v_topic_count, 1);
    v_new_question_elo := GREATEST(800, LEAST(2400, v_question_elo - v_elo_change * 0.5));
    v_new_question_rd := GREATEST(30, v_question_rd - 2);
    
    UPDATE questions SET
      elo_rating = v_new_question_elo,
      glicko_rd = v_new_question_rd,
      glicko_volatility = GREATEST(0.03, v_question_volatility * 0.99),
      attempts_count = attempts_count + 1,
      correct_count = correct_count + (CASE WHEN NEW.is_correct THEN 1 ELSE 0 END),
      
      -- Update average time (running average)
      avg_time_seconds = ROUND(
        (COALESCE(avg_time_seconds, 0) * attempts_count + COALESCE(NEW.time_taken, 0))
        / (attempts_count + 1)
      ),
      
      updated_at = v_now
    WHERE questionid = NEW.questionid;
    
    NEW.question_elo_after := v_new_question_elo;
    NEW.question_rd_after := v_new_question_rd;
  ELSE
    -- Anchor: no Elo change
    NEW.question_elo_after := v_question_elo;
    NEW.question_rd_after := v_question_rd;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_ratings_and_schedule IS 
'Core adaptive learning algorithm combining:
- Full Glicko-2 rating system for OBJECTIVE ability estimation (marks only)
- FSRS-5 spaced repetition using SUBJECTIVE memory strength (marks + confidence)
- Multi-topic mastery tracking
- Anchor-based grade calibration

Key design decisions:
1. Glicko-2 uses objective performance only (confidence ignored)
2. FSRS uses both marks and confidence (metacognitive monitoring)
3. This separation reflects: Glicko = what you CAN do, FSRS = what you WILL REMEMBER
4. FSRS stability = days to 90% retention (no additional scaling)
5. Expected success probability = user ability vs question difficulty
6. Question rating = inverse average of all topic rating changes
7. Anchor questions never update ratings (stable grade boundaries)

Academic justification:
- Glicko-2 estimates ground truth ability (objective)
- FSRS predicts retention probability (subjective + objective)
- Confidence modulates review timing but not ability estimates
- Consistent with metacognitive monitoring theory (Koriat & Bjork, 2005)';

-- Apply the trigger
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