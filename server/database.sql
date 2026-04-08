-- =====================================================================================================================================================
--                                                                     FULL SCHEMA RESET
-- =====================================================================================================================================================

DROP TABLE IF EXISTS user_elo_snapshots CASCADE;
DROP TABLE IF EXISTS user_topic_mastery CASCADE;
DROP TABLE IF EXISTS question_attempts CASCADE;
DROP TABLE IF EXISTS quiz_questions CASCADE;
DROP TABLE IF EXISTS quizzes CASCADE;
DROP TABLE IF EXISTS question_topics CASCADE;
DROP TABLE IF EXISTS mark_scheme_items CASCADE;
DROP TABLE IF EXISTS user_hints CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS topics CASCADE;
DROP TABLE IF EXISTS user_progress CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================================================================================================================
--                                                       USER ACCOUNTS AND AUTHENTICATION
-- =====================================================================================================================================================

CREATE TABLE users (
  userid SERIAL PRIMARY KEY,
  username VARCHAR(255),
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255),
  is_verified BOOLEAN DEFAULT FALSE,
  using_oauth BOOLEAN DEFAULT FALSE,
  is_onboarded BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token VARCHAR(255),
  verification_token_expiry TIMESTAMP,
  reset_token VARCHAR(255),
  reset_token_expiry TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- reused by multiple tables
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_users_is_onboarded ON users(userid) WHERE is_onboarded = FALSE;

-- =====================================================================================================================================================
--                                                                TOPICS AND QUESTIONS
-- =====================================================================================================================================================

CREATE TABLE topics (
  topicid SERIAL PRIMARY KEY,
  topic_code VARCHAR(50) NOT NULL UNIQUE,
  topic_name VARCHAR(255) NOT NULL,
  parent_topic VARCHAR(50) REFERENCES topics(topic_code) ON DELETE SET NULL,
  exam_weight DECIMAL(4,2) DEFAULT 1.0
);

CREATE INDEX idx_topics_parent_topic ON topics(parent_topic);

CREATE TABLE questions (
  questionid SERIAL PRIMARY KEY,
  question_text TEXT NOT NULL,
  image_url TEXT,
  question_format VARCHAR(50) NOT NULL,
  correct_answer TEXT, -- MCQ only
  answer_options JSONB, -- MCQ: { "options": [{ "label": "A", "text": "..." }, ...] }
  explanation TEXT, -- Feynman rubric / mark scheme for AI grading
  total_marks INTEGER DEFAULT 1,

  -- ELO / GLICKO-2 RATINGS (dynamic difficulty)
  elo_rating DECIMAL(6,2) DEFAULT 1500.00 CHECK (elo_rating BETWEEN 800 AND 2400),
  glicko_rd DECIMAL(6,2) DEFAULT 150.00 CHECK (glicko_rd BETWEEN 30 AND 350),
  glicko_volatility DECIMAL(4,3) DEFAULT 0.060,

  -- CALIBRATION METADATA
  attempts_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  avg_time_seconds INTEGER,

  -- ANCHOR QUESTIONS (fixed-difficulty reference points, Elo never updated)
  is_anchor BOOLEAN DEFAULT FALSE,
  anchor_grade_level VARCHAR(2) CHECK (anchor_grade_level IN ('E', 'D', 'C', 'B', 'A', 'A*')),
  anchor_source VARCHAR(255),

  -- MULTI-PART QUESTION SUPPORT
  -- parent_question_id NULL -> standalone or stem question
  -- parent_question_id SET -> child part (a, b, c...) of the parent stem
  parent_question_id INTEGER REFERENCES questions(questionid) ON DELETE CASCADE,
  part_label VARCHAR(10), -- 'a', 'b', '(i)', '(ii)'
  order_index INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT no_self_reference CHECK (parent_question_id != questionid),
  CONSTRAINT anchor_no_parts CHECK (NOT (is_anchor = TRUE AND parent_question_id IS NOT NULL)),
  CONSTRAINT valid_question_format CHECK (question_format IN ('multiple_choice', 'feynman', 'self_mark')),
  CONSTRAINT mcq_requires_options CHECK (
    (question_format = 'multiple_choice' AND answer_options IS NOT NULL)
    OR (question_format != 'multiple_choice' AND answer_options IS NULL)
  ),
  CONSTRAINT mcq_requires_answer CHECK (question_format != 'multiple_choice' OR correct_answer IS NOT NULL),
  CONSTRAINT feynman_requires_rubric CHECK (question_format != 'feynman' OR explanation IS NOT NULL),
  CONSTRAINT feynman_no_parts CHECK (NOT (question_format = 'feynman' AND parent_question_id IS NOT NULL))
);

CREATE INDEX idx_questions_elo ON questions(elo_rating);
CREATE INDEX idx_questions_anchor ON questions(is_anchor, anchor_grade_level) WHERE is_anchor = TRUE;
CREATE INDEX idx_questions_parent ON questions(parent_question_id) WHERE parent_question_id IS NOT NULL;


-- students click the mark scheme items they got right
CREATE TABLE mark_scheme_items (
  mark_scheme_item_id SERIAL PRIMARY KEY,
  questionid INTEGER REFERENCES questions(questionid) ON DELETE CASCADE,
  item_order INTEGER NOT NULL,
  item_description TEXT NOT NULL,
  marks_available INTEGER NOT NULL DEFAULT 1,
  item_type VARCHAR(50), -- 'method', 'accuracy', 'communication'
  is_mandatory BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_mark_scheme_questionid ON mark_scheme_items(questionid, item_order);


CREATE TABLE question_topics (
  questionid INTEGER REFERENCES questions(questionid) ON DELETE CASCADE,
  topic_code VARCHAR(50) REFERENCES topics(topic_code) ON DELETE CASCADE,
  PRIMARY KEY (questionid, topic_code)
);

CREATE INDEX idx_question_topics_topicid ON question_topics(topic_code);


CREATE TABLE user_hints (
  hintid SERIAL PRIMARY KEY,
  userid INTEGER REFERENCES users(userid) ON DELETE CASCADE,
  questionid INTEGER REFERENCES questions(questionid) ON DELETE CASCADE,
  hint_text TEXT NOT NULL,
  helpful INTEGER, -- 1 = not helpful, 2 = no response, 3 = helpful
  created_at TIMESTAMP DEFAULT NOW()
);


-- =====================================================================================================================================================
--                                                                        QUIZZES
-- =====================================================================================================================================================

CREATE TABLE quizzes (
  quizid SERIAL PRIMARY KEY,
  userid INTEGER REFERENCES users(userid) ON DELETE CASCADE,
  quiz_type VARCHAR(50) NOT NULL, -- 'adaptive' | 'custom'
  quiz_mode VARCHAR(50), -- 'balanced' | 'confidence_boost' etc.
  using_custom_difficulty BOOLEAN,
  custom_difficulty_min INTEGER,
  custom_difficulty_max INTEGER,
  custom_question_count INTEGER,
  questions_completed INTEGER,
  pomodoro_work_minutes INTEGER,
  pomodoro_break_minutes INTEGER,
  time_taken INTEGER,             -- seconds
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

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
--                                                          QUESTION ATTEMPTS AND PERFORMANCE
-- =====================================================================================================================================================

CREATE TABLE question_attempts (
  attemptid SERIAL PRIMARY KEY,
  userid INTEGER REFERENCES users(userid) ON DELETE CASCADE,
  questionid INTEGER REFERENCES questions(questionid) ON DELETE CASCADE,
  quizid INTEGER REFERENCES quizzes(quizid) ON DELETE CASCADE,

  user_answer TEXT,
  is_correct BOOLEAN,

  marks_awarded INTEGER,
  marks_available INTEGER,

  grading_status VARCHAR(20) DEFAULT 'graded' CHECK (
    grading_status IN ('graded', 'pending', 'failed')
  ),

  confidence INTEGER CHECK (confidence BETWEEN 1 AND 5),
  time_taken INTEGER,  -- seconds
  hints_used INTEGER DEFAULT 0,

  -- ELO / GLICKO snapshots (before and after this attempt)
  user_elo_before DECIMAL(6,2),
  user_elo_after DECIMAL(6,2),
  user_rd_before DECIMAL(6,2),
  user_rd_after DECIMAL(6,2),
  question_elo_before DECIMAL(6,2),
  question_elo_after DECIMAL(6,2),
  question_rd_before DECIMAL(6,2),
  question_rd_after DECIMAL(6,2),

  -- FSRS-4.5 spaced repetition
  fsrs_rating INTEGER CHECK (fsrs_rating BETWEEN 1 AND 4),
  fsrs_interval_days DECIMAL(8,4),
  fsrs_stability_before DECIMAL(8,4),
  fsrs_stability_after DECIMAL(8,4),
  fsrs_difficulty_before DECIMAL(4,2),
  fsrs_difficulty_after DECIMAL(4,2),

  expected_success_probability DECIMAL(4,3),
  question_difficulty INTEGER,

  is_anchor_attempt BOOLEAN DEFAULT FALSE,
  attempted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_question_attempts_userid ON question_attempts(userid, attempted_at DESC);
CREATE INDEX idx_question_attempts_questionid ON question_attempts(questionid);
CREATE INDEX idx_question_attempts_userid_question ON question_attempts(userid, questionid);
CREATE INDEX idx_attempts_anchor ON question_attempts(userid, is_anchor_attempt) WHERE is_anchor_attempt = TRUE;
CREATE INDEX idx_attempts_fsrs_rating ON question_attempts(fsrs_rating);
CREATE INDEX idx_attempts_grading_status ON question_attempts(grading_status) WHERE grading_status = 'pending';


-- =====================================================================================================================================================
--                                                            TOPIC MASTERY AND USER ANALYTICS
-- =====================================================================================================================================================

CREATE TABLE user_topic_mastery (
  userid INTEGER REFERENCES users(userid) ON DELETE CASCADE,
  topicid INTEGER REFERENCES topics(topicid) ON DELETE CASCADE,

  -- ELO / GLICKO-2 (user ability per topic)
  elo_rating DECIMAL(6,2) DEFAULT 1500.00 CHECK (elo_rating BETWEEN 800 AND 2400),
  glicko_rd DECIMAL(6,2) DEFAULT 150.00 CHECK (glicko_rd BETWEEN 30 AND 350),
  glicko_volatility DECIMAL(4,3) DEFAULT 0.060,

  -- FSRS-4.5 spaced repetition
  fsrs_stability DECIMAL(8,4) DEFAULT 1.0000,
  fsrs_difficulty DECIMAL(4,2) DEFAULT 5.00 CHECK (fsrs_difficulty BETWEEN 1 AND 10),
  fsrs_state VARCHAR(15) DEFAULT 'new' CHECK (fsrs_state IN ('new', 'learning', 'review', 'relearning')),
  last_review_date TIMESTAMP,
  next_review_date TIMESTAMP,

  -- relative mastery, recomputed by trigger_update_mastery after every ELO change
  mastery_gap DECIMAL(8,2), -- topic_elo - user's personal average ELO
  mastery_z_score DECIMAL(4,2), -- standard deviations from personal mean
  mastery_category VARCHAR(20), -- 'Struggling' | 'Developing' | 'Competent' | 'Proficient' | 'Mastered'

  -- recent performance, refreshed daily by refresh_recent_performance cron
  recent_attempts INTEGER DEFAULT 0,
  recent_correct INTEGER DEFAULT 0,
  recent_accuracy DECIMAL(5,2),

  -- time and confidence
  total_study_time_seconds INTEGER DEFAULT 0,
  avg_time_per_question INTEGER,
  avg_confidence DECIMAL(3,2),

  -- per-topic grade prediction (populated by application layer)
  predicted_grade_numeric DECIMAL(3,2), -- 0=E, 1=D, 2=C, 3=B, 4=A, 5=A*
  predicted_grade_letter VARCHAR(2),
  grade_confidence INTEGER CHECK (grade_confidence BETWEEN 0 AND 100),

  -- anchor performance used to cross-check ELO grade estimates
  anchor_attempts_total INTEGER DEFAULT 0,
  anchor_attempts_by_grade JSONB DEFAULT '{}', -- {"C": {"attempts": 10, "correct": 7}, ...}

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  PRIMARY KEY (userid, topicid)
);

CREATE INDEX idx_mastery_userid ON user_topic_mastery(userid);
CREATE INDEX idx_mastery_topicid ON user_topic_mastery(topicid);
CREATE INDEX idx_mastery_next_review ON user_topic_mastery(userid, next_review_date) WHERE next_review_date IS NOT NULL;
CREATE INDEX idx_mastery_elo ON user_topic_mastery(elo_rating);
CREATE INDEX idx_mastery_grade ON user_topic_mastery(predicted_grade_letter);

CREATE TRIGGER trigger_update_mastery_timestamp
BEFORE UPDATE ON user_topic_mastery
FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- =====================================================================================================================================================
--                                                                  ELO PROGRESS SNAPSHOTS
-- =====================================================================================================================================================
-- one row per (user, calendar day), updated on every ELO change and used by the
-- grade progress chart
-- weighted ELO only counts topics where fsrs_state != 'new' so that quiz progress
-- is visible immediately (onboarding seeds all topics as 'new')

CREATE TABLE user_elo_snapshots (
  userid INTEGER NOT NULL REFERENCES users(userid) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weighted_elo INTEGER NOT NULL,
  topics_included INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  PRIMARY KEY (userid, snapshot_date)
);

CREATE INDEX idx_elo_snapshots_userid_date ON user_elo_snapshots(userid, snapshot_date ASC);


-- =====================================================================================================================================================
--                                                                       VIEWS
-- =====================================================================================================================================================

-- priority scoring for adaptive quiz generation: urgency x uncertainty x exam_weight

-- urgency     = 1 - FSRS-4.5 retrievability R(t, S) = (1 + (19/81) x t / S)^{-0.5}
--               0.5 for never-reviewed topics
-- uncertainty = sqrt(glicko_rd / 350)
-- exam_weight = topics.exam_weight

-- only includes topics due or within 1 day of being due
-- matches the retrievability formula used in quiz.js pool selection

DROP VIEW IF EXISTS topics_due_for_review;

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

  -- days elapsed since next_review_date (negative = not yet due)
  EXTRACT(EPOCH FROM (NOW() - COALESCE(utm.next_review_date, NOW())))/86400 AS days_overdue,

  -- FSRS-4.5 retrievability R = (1 + max(0, days_overdue) / (9 * S))^-1
  CASE
    WHEN utm.next_review_date IS NULL THEN 0.5
    ELSE POWER(
      1.0 + GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400)
            / (9.0 * GREATEST(utm.fsrs_stability, 0.1)),
      -1.0
    )
  END AS recall_probability,

  -- urgency = 1 - recall_probability
  CASE
    WHEN utm.next_review_date IS NULL THEN 0.5
    ELSE 1.0 - POWER(
      1.0 + GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400)
            / (9.0 * GREATEST(utm.fsrs_stability, 0.1)),
      -1.0
    )
  END AS urgency,

  SQRT(utm.glicko_rd / 350.0) AS uncertainty_factor,
  t.exam_weight AS utility,

  -- final priority score
  CASE
    WHEN utm.next_review_date IS NULL THEN 0.5
    ELSE 1.0 - POWER(
      1.0 + GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - utm.next_review_date))/86400)
            / (9.0 * GREATEST(utm.fsrs_stability, 0.1)),
      -1.0
    )
  END
  * SQRT(utm.glicko_rd / 350.0)
  * t.exam_weight
  AS priority_score

FROM user_topic_mastery utm
JOIN topics t ON utm.topicid = t.topicid
WHERE utm.next_review_date IS NULL
   OR utm.next_review_date <= NOW() + INTERVAL '1 day'
ORDER BY priority_score DESC;

-- =====================================================================================================================================================
--                                                            GLICKO-2 VOLATILITY CALCULATION
-- =====================================================================================================================================================
-- Illinois algorithm (modified regula falsi) from Glickman (2013)
-- solves f(sigma') = 0, typically converges in 5-10 iterations
-- reference: http://www.glicko.net/glicko/glicko2.pdf

CREATE OR REPLACE FUNCTION calculate_glicko2_volatility(
  p_phi DOUBLE PRECISION,
  p_sigma DOUBLE PRECISION,
  p_delta DOUBLE PRECISION,
  p_v DOUBLE PRECISION,
  p_tau DOUBLE PRECISION DEFAULT 0.5
) RETURNS DOUBLE PRECISION AS $$
DECLARE
  v_epsilon CONSTANT DOUBLE PRECISION := 0.000001;
  v_max_iterations CONSTANT INTEGER := 100;

  v_a0 DOUBLE PRECISION; v_A DOUBLE PRECISION; v_B DOUBLE PRECISION;
  v_fA DOUBLE PRECISION; v_fB DOUBLE PRECISION;
  v_C  DOUBLE PRECISION; v_fC DOUBLE PRECISION;
  v_iteration INTEGER := 0;

  v_phi_sq DOUBLE PRECISION;
  v_delta_sq DOUBLE PRECISION;
  v_tau_sq DOUBLE PRECISION;
  v_ex DOUBLE PRECISION;
  v_phi_sq_plus_v_plus_ex DOUBLE PRECISION;
  v_f_result DOUBLE PRECISION;
  v_k INTEGER;
BEGIN
  v_phi_sq   := p_phi   * p_phi;
  v_delta_sq := p_delta * p_delta;
  v_tau_sq   := p_tau   * p_tau;

  v_a0 := LN(p_sigma * p_sigma);
  v_A  := v_a0;

  IF v_delta_sq > v_phi_sq + p_v THEN
    v_B := LN(v_delta_sq - v_phi_sq - p_v);
  ELSE
    v_k := 1;
    LOOP
      v_B := v_a0 - v_k * p_tau;
      v_ex := EXP(v_B);
      v_phi_sq_plus_v_plus_ex := v_phi_sq + p_v + v_ex;
      v_f_result := (v_ex * (v_delta_sq - v_phi_sq - p_v - v_ex))
                  / (2 * v_phi_sq_plus_v_plus_ex * v_phi_sq_plus_v_plus_ex)
                  - ((v_B - v_a0) / v_tau_sq);
      EXIT WHEN v_f_result < 0;
      v_k := v_k + 1;
      EXIT WHEN v_k > 100;
    END LOOP;
  END IF;

  v_ex := EXP(v_A);
  v_phi_sq_plus_v_plus_ex := v_phi_sq + p_v + v_ex;
  v_fA := (v_ex * (v_delta_sq - v_phi_sq - p_v - v_ex))
        / (2 * v_phi_sq_plus_v_plus_ex * v_phi_sq_plus_v_plus_ex)
        - ((v_A - v_a0) / v_tau_sq);

  v_ex := EXP(v_B);
  v_phi_sq_plus_v_plus_ex := v_phi_sq + p_v + v_ex;
  v_fB := (v_ex * (v_delta_sq - v_phi_sq - p_v - v_ex))
        / (2 * v_phi_sq_plus_v_plus_ex * v_phi_sq_plus_v_plus_ex)
        - ((v_B - v_a0) / v_tau_sq);

  WHILE ABS(v_B - v_A) > v_epsilon
    AND ABS(v_fB) > v_epsilon
    AND v_iteration < v_max_iterations LOOP

    v_C := v_A - v_fA * (v_A - v_B) / (v_fA - v_fB);
    v_ex := EXP(v_C);
    v_phi_sq_plus_v_plus_ex := v_phi_sq + p_v + v_ex;
    v_fC := (v_ex * (v_delta_sq - v_phi_sq - p_v - v_ex))
          / (2 * v_phi_sq_plus_v_plus_ex * v_phi_sq_plus_v_plus_ex)
          - ((v_C - v_a0) / v_tau_sq);

    IF v_fC * v_fB < 0 THEN
      v_A := v_B; v_fA := v_fB;
    ELSE
      v_fA := v_fA / 2;
    END IF;

    v_B := v_C; v_fB := v_fC;
    v_iteration := v_iteration + 1;
  END LOOP;

  RETURN EXP(v_B / 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- =====================================================================================================================================================
--                                                         FSRS RATING FROM MARKS + CONFIDENCE
-- =====================================================================================================================================================
-- converts a partial-credit score (marks_awarded / marks_available) combined with
-- self-reported confidence (1-5) into an FSRS rating (1=Again, 2=Hard, 3=Good, 4=Easy)

CREATE OR REPLACE FUNCTION calculate_fsrs_rating_from_marks(
  p_marks_awarded INTEGER,
  p_marks_available INTEGER,
  p_confidence INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_percentage  DECIMAL(4,3);
  v_base_rating INTEGER;
BEGIN
  v_percentage  := p_marks_awarded::DECIMAL / p_marks_available;

  v_base_rating := CASE
    WHEN v_percentage < 0.25 THEN 1 -- Again
    WHEN v_percentage < 0.55 THEN 2 -- Hard
    WHEN v_percentage < 0.85 THEN 3 -- Good
    ELSE 4 -- Easy
  END;

  RETURN CASE
    WHEN v_base_rating = 1 THEN 1  -- fail always = Again
    WHEN v_base_rating = 2 AND p_confidence <= 2 THEN 1 -- uncertain failure -> Again
    WHEN v_base_rating = 2 AND p_confidence =  3 THEN 2 -- neutral -> Hard
    WHEN v_base_rating = 2 AND p_confidence >= 4 THEN 3 -- confident on hard -> Good
    WHEN v_base_rating = 3 AND p_confidence <= 2 THEN 2 -- lucky pass -> Hard
    WHEN v_base_rating = 3 AND p_confidence >= 3 THEN 3 -- solid pass -> Good
    WHEN v_base_rating = 4 AND p_confidence <= 2 THEN 3 -- very lucky -> Good
    WHEN v_base_rating = 4 AND p_confidence >= 3 THEN 4 -- true mastery -> Easy
    ELSE v_base_rating
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- =====================================================================================================================================================
--                                                         MAIN RATINGS + SCHEDULE TRIGGER
-- =====================================================================================================================================================
-- fires BEFORE INSERT on question_attempts
-- runs Glicko-2 and FSRS-4.5 for every topic mapped to the answered question
-- mastery_gap / mastery_z_score / mastery_category are not set here -
-- they are recomputed by trigger_update_mastery which fires AFTER the ELO update

CREATE OR REPLACE FUNCTION update_ratings_and_schedule()
RETURNS TRIGGER AS $$
DECLARE
  v_question_elo DECIMAL(6,2);
  v_question_rd DECIMAL(6,2);
  v_question_volatility DOUBLE PRECISION;
  v_question_is_anchor BOOLEAN;
  v_anchor_grade_level VARCHAR(2);
  v_question_mu DECIMAL(8,6);
  v_question_phi DECIMAL(8,6);
  v_question_g DECIMAL(8,6);
  v_actual_performance DECIMAL(4,3);
  v_now  TIMESTAMP := NOW();
  v_total_elo_change DECIMAL(8,4) := 0;
  v_total_expected_E DECIMAL(8,6) := 0;
  v_topic_count INTEGER := 0;
  v_new_question_elo DECIMAL(6,2);
  v_new_question_rd DECIMAL(6,2);
  v_elo_change DECIMAL(6,2);
  _topic RECORD;
  c_glicko_scale CONSTANT DECIMAL := 173.7178;
  c_tau CONSTANT DOUBLE PRECISION := 0.5;
  c_fsrs_decay CONSTANT DECIMAL := -0.5;
  -- FACTOR = 0.9^(1/DECAY) - 1 = 0.9^(-2) - 1 = 19/81
  -- used in both R(t,S) and the interval formula
  c_fsrs_factor  CONSTANT DECIMAL         := 19.0 / 81.0;
  -- FSRS-4.5 weights (Ye et al. 2024)
  c_fsrs_w CONSTANT DECIMAL[] := ARRAY[
    0.4072, 1.1829, 3.1262, 15.4722,
    7.2102, 0.5316, 1.0651,  0.0234,
    1.6160, 0.1544, 0.9957, 2.0902,
    0.0726, 0.3025, 1.9661, 0.6210,
    2.9469
  ];
  v_fsrs_snapped BOOLEAN := FALSE;
BEGIN
  -- step 1: load question metadata
  SELECT elo_rating, glicko_rd, glicko_volatility, is_anchor, anchor_grade_level
  INTO   v_question_elo, v_question_rd, v_question_volatility,
         v_question_is_anchor, v_anchor_grade_level
  FROM   questions WHERE questionid = NEW.questionid;
  NEW.question_elo_before := v_question_elo;
  NEW.question_rd_before := v_question_rd;
  NEW.is_anchor_attempt := v_question_is_anchor;
  v_question_mu  := (v_question_elo - 1500) / c_glicko_scale;
  v_question_phi := v_question_rd / c_glicko_scale;
  v_question_g   := 1.0 / SQRT(1 + (3 * v_question_phi * v_question_phi) / (PI() * PI()));

  -- step 2: determine FSRS rating
  IF NEW.grading_status = 'graded' THEN
    IF NEW.marks_available IS NOT NULL AND NEW.marks_awarded IS NOT NULL THEN
      NEW.fsrs_rating := calculate_fsrs_rating_from_marks(
        NEW.marks_awarded, NEW.marks_available, NEW.confidence
      );
    ELSIF NEW.is_correct IS NOT NULL THEN
      NEW.fsrs_rating := CASE
        WHEN NOT NEW.is_correct THEN 1
        WHEN NEW.confidence <= 2 THEN 2
        WHEN NEW.confidence = 3 THEN 3
        WHEN NEW.confidence = 4 THEN 3
        ELSE 4
      END;
    ELSE
      NEW.fsrs_rating := 2;
    END IF;
  END IF;

  -- step 3: bail early for ungraded attempts
  IF NEW.grading_status != 'graded' THEN
    NEW.question_elo_after := v_question_elo;
    NEW.question_rd_after := v_question_rd;
    NEW.expected_success_probability := NULL;
    RETURN NEW;
  END IF;

  -- step 4: determine objective performance
  v_actual_performance := COALESCE(
    NEW.marks_awarded::DECIMAL / NULLIF(NEW.marks_available, 0),
    CASE
      WHEN NEW.is_correct IS NOT NULL AND NEW.is_correct THEN 1.0
      WHEN NEW.is_correct IS NOT NULL THEN 0.0
      ELSE NULL
    END,
    0.0
  );
  IF NEW.marks_available IS NOT NULL AND NEW.marks_awarded IS NOT NULL THEN
    NEW.is_correct := (NEW.marks_awarded::DECIMAL / NEW.marks_available) >= 0.75;
  END IF;

  -- step 5: exit if no topic mappings exist
  IF NOT EXISTS (SELECT 1 FROM question_topics WHERE questionid = NEW.questionid) THEN
    NEW.question_elo_after := v_question_elo;
    NEW.question_rd_after := v_question_rd;
    NEW.expected_success_probability := NULL;
    RETURN NEW;
  END IF;

  -- step 6: per-topic Glicko-2 + FSRS loop
  FOR _topic IN
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
      v_mu DECIMAL(8,6);
      v_phi DECIMAL(8,6);
      v_sigma DOUBLE PRECISION;
      v_E DECIMAL(8,6);
      v_v DOUBLE PRECISION;
      v_delta DOUBLE PRECISION;
      v_phi_star DECIMAL(8,6);
      v_new_phi DECIMAL(8,6);
      v_new_mu DECIMAL(8,6);
      v_new_sigma DOUBLE PRECISION;
      v_new_user_elo DECIMAL(6,2);
      v_new_user_rd DECIMAL(6,2);
      v_new_user_volatility DOUBLE PRECISION;
      v_days_elapsed DECIMAL(8,4);
      v_retrievability DECIMAL(8,6);
      v_new_stability DECIMAL(8,4);
      v_new_difficulty DECIMAL(4,2);
      v_new_state VARCHAR(15);
      v_interval_days DECIMAL(8,4);
      v_d0_3 DECIMAL(4,2);
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
      v_mu := (v_user_elo - 1500) / c_glicko_scale;
      v_phi := v_user_rd / c_glicko_scale;
      v_sigma := v_user_volatility;
      v_E := 1.0 / (1 + EXP(-v_question_g * (v_mu - v_question_mu)));
      v_total_expected_E := v_total_expected_E + v_E;
      v_v := 1.0 / (v_question_g * v_question_g * v_E * (1 - v_E));
      v_delta := v_v * v_question_g * (v_actual_performance - v_E);
      v_new_sigma := calculate_glicko2_volatility(v_phi, v_sigma, v_delta, v_v, c_tau);
      v_phi_star := SQRT(v_phi * v_phi + v_new_sigma * v_new_sigma);
      v_new_phi := 1.0 / SQRT(1.0 / (v_phi_star * v_phi_star) + 1.0 / v_v);
      v_new_mu := v_mu + v_new_phi * v_new_phi * v_question_g * (v_actual_performance - v_E);
      v_new_user_elo := GREATEST(800,  LEAST(2400, c_glicko_scale * v_new_mu  + 1500));
      v_new_user_rd := GREATEST(30,   LEAST(350,  c_glicko_scale * v_new_phi       ));
      v_new_user_volatility := GREATEST(0.03, LEAST(0.15, v_new_sigma                       ));
      v_total_elo_change := v_total_elo_change + (v_new_user_elo - v_user_elo);
      v_topic_count := v_topic_count + 1;
      IF v_topic_count = 1 THEN
        NEW.user_elo_before := v_user_elo;
        NEW.user_elo_after := v_new_user_elo;
        NEW.user_rd_before := v_user_rd;
        NEW.user_rd_after := v_new_user_rd;
      END IF;

      -- FSRS-4.5
      v_fsrs_stability := GREATEST(v_fsrs_stability, 0.1);
      IF NOT v_fsrs_snapped THEN
        NEW.fsrs_stability_before  := v_fsrs_stability;
        NEW.fsrs_difficulty_before := v_fsrs_difficulty;
      END IF;

      IF v_fsrs_state = 'new' THEN
        -- S0(G) = w[G-1]
        v_new_stability  := c_fsrs_w[NEW.fsrs_rating];
        -- D0(G) = w[4] - exp(w[5] * (G-1)) + 1
        v_new_difficulty := c_fsrs_w[5]
                            - EXP(c_fsrs_w[6] * (NEW.fsrs_rating - 1))
                            + 1;
        v_new_difficulty := GREATEST(1, LEAST(10, v_new_difficulty));
        v_new_state := CASE WHEN NEW.fsrs_rating = 1 THEN 'learning' ELSE 'review' END;

      ELSIF NEW.fsrs_rating = 1 THEN
        -- lapse branch
        -- R(t,S) = (1 + FACTOR * t/S)^DECAY
        v_retrievability := POWER(
          1 + c_fsrs_factor * v_days_elapsed / v_fsrs_stability,
          c_fsrs_decay
        );
        v_new_stability  :=
            c_fsrs_w[12]
          * POWER(v_fsrs_difficulty, -c_fsrs_w[13])
          * (POWER(v_fsrs_stability + 1, c_fsrs_w[14]) - 1)
          * EXP(c_fsrs_w[15] * (1 - v_retrievability));
        v_new_stability := GREATEST(v_new_stability, 0.1);
        v_new_state := CASE WHEN v_fsrs_state = 'review' THEN 'relearning' ELSE 'learning' END;
        v_d0_3 := c_fsrs_w[5] - EXP(c_fsrs_w[6] * (3 - 1)) + 1;
        v_new_difficulty := v_fsrs_difficulty - c_fsrs_w[7] * (NEW.fsrs_rating - 3);
        v_new_difficulty := GREATEST(1, LEAST(10, c_fsrs_w[8] * v_d0_3 + (1 - c_fsrs_w[8]) * v_new_difficulty));

      ELSE
        -- recall branch (rating 2, 3 or 4)
        v_retrievability := POWER(
          1 + c_fsrs_factor * v_days_elapsed / v_fsrs_stability,
          c_fsrs_decay
        );
        v_new_stability  := v_fsrs_stability * (
          1 + EXP(c_fsrs_w[9]) * (11 - v_fsrs_difficulty)
            * POWER(v_fsrs_stability, -c_fsrs_w[10])
            * (EXP((1 - v_retrievability) * c_fsrs_w[11]) - 1)
            * CASE WHEN NEW.fsrs_rating = 2 THEN c_fsrs_w[16]
                   WHEN NEW.fsrs_rating = 4 THEN c_fsrs_w[17]
                   ELSE 1 END
        );
        v_new_state := CASE
          WHEN v_fsrs_state IN ('learning', 'relearning') AND NEW.fsrs_rating >= 3 THEN 'review'
          ELSE v_fsrs_state
        END;
        v_d0_3           := c_fsrs_w[5] - EXP(c_fsrs_w[6] * (3 - 1)) + 1;
        v_new_difficulty := v_fsrs_difficulty - c_fsrs_w[7] * (NEW.fsrs_rating - 3);
        v_new_difficulty := GREATEST(1, LEAST(10, c_fsrs_w[8] * v_d0_3 + (1 - c_fsrs_w[8]) * v_new_difficulty));
      END IF;

      -- interval I = S * (R_target^(1/DECAY) - 1) / FACTOR
      v_interval_days := GREATEST(1, LEAST(36500,
        ROUND(
          v_new_stability
          * (POWER(0.9, 1.0 / c_fsrs_decay) - 1)
          / c_fsrs_factor
        )
      ));

      IF NOT v_fsrs_snapped THEN
        NEW.fsrs_stability_after  := v_new_stability;
        NEW.fsrs_difficulty_after := v_new_difficulty;
        NEW.fsrs_interval_days    := v_interval_days;
        v_fsrs_snapped := TRUE;
      END IF;

      -- persist - mastery_gap / mastery_z_score / mastery_category are not set here
      -- they are recomputed by trigger_update_mastery (AFTER UPDATE OF elo_rating)
      UPDATE user_topic_mastery SET
        elo_rating = v_new_user_elo,
        glicko_rd = v_new_user_rd,
        glicko_volatility = v_new_user_volatility,
        fsrs_stability = v_new_stability,
        fsrs_difficulty = v_new_difficulty,
        fsrs_state = v_new_state,
        last_review_date = NEW.attempted_at,
        next_review_date = NEW.attempted_at + (v_interval_days || ' days')::INTERVAL,
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
                'attempts', COALESCE((anchor_attempts_by_grade->v_anchor_grade_level->>'attempts')::int, 0) + 1,
                'correct',  COALESCE((anchor_attempts_by_grade->v_anchor_grade_level->>'correct' )::int, 0)
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

  -- step 7: store average expected success probability
  NEW.expected_success_probability := CASE
    WHEN v_topic_count > 0 THEN v_total_expected_E / v_topic_count
    ELSE NULL
  END;

  -- step 8: update question ELO (skipped for anchors)
  IF NOT v_question_is_anchor AND v_topic_count > 0 THEN
    DECLARE
      v_current_attempts INTEGER;
    BEGIN
      SELECT attempts_count INTO v_current_attempts
      FROM questions WHERE questionid = NEW.questionid;
      v_elo_change := v_total_elo_change / v_topic_count;
      v_new_question_elo := GREATEST(800, LEAST(2400, v_question_elo - v_elo_change * 0.5));
      v_new_question_rd := GREATEST(30,
        v_question_rd * (1 - GREATEST(0.02, 0.20 * EXP(-0.3 * v_current_attempts)))
      );
      UPDATE questions SET
        elo_rating = v_new_question_elo,
        glicko_rd = v_new_question_rd,
        glicko_volatility = GREATEST(0.03, v_question_volatility * 0.99),
        attempts_count = attempts_count + 1,
        correct_count = correct_count + (CASE WHEN NEW.is_correct THEN 1 ELSE 0 END),
        avg_time_seconds = ROUND(
          (COALESCE(avg_time_seconds, 0) * attempts_count + COALESCE(NEW.time_taken, 0))
          / (attempts_count + 1)
        ),
        updated_at = v_now
      WHERE questionid = NEW.questionid;
      NEW.question_elo_after := v_new_question_elo;
      NEW.question_rd_after := v_new_question_rd;
    END;
  ELSE
    NEW.question_elo_after := v_question_elo;
    NEW.question_rd_after := v_question_rd;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ratings ON question_attempts;
CREATE TRIGGER trigger_update_ratings
BEFORE INSERT ON question_attempts
FOR EACH ROW EXECUTE FUNCTION update_ratings_and_schedule();


-- =====================================================================================================================================================
--                                                         MASTERY GAP / Z-SCORE TRIGGER
-- =====================================================================================================================================================
-- fires AFTER UPDATE OF elo_rating on user_topic_mastery
-- recomputes mastery_gap, mastery_z_score and mastery_category for all of this
-- user's attempted topics using the standard deviation of their own ELO distribution
-- only runs when the user has answered at least 2 topics (stddev requires n >= 2)

CREATE OR REPLACE FUNCTION trigger_update_mastery_after_attempt()
RETURNS TRIGGER AS $$
BEGIN
  WITH user_baseline AS (
    SELECT
      userid,
      AVG(elo_rating)    AS avg_elo,
      STDDEV(elo_rating) AS elo_stddev
    FROM user_topic_mastery
    WHERE userid = NEW.userid
      AND fsrs_state != 'new'
      AND elo_rating IS NOT NULL
    GROUP BY userid
    HAVING COUNT(*) >= 2
  )
  UPDATE user_topic_mastery utm
  SET
    mastery_gap = utm.elo_rating - ub.avg_elo,
    mastery_z_score = CASE
      WHEN ub.elo_stddev > 0
      THEN ROUND(((utm.elo_rating - ub.avg_elo) / ub.elo_stddev)::NUMERIC, 2)
      ELSE 0
    END,
    mastery_category = CASE
      WHEN ub.elo_stddev = 0 THEN 'Competent'
      WHEN (utm.elo_rating - ub.avg_elo) / ub.elo_stddev < -1.5 THEN 'Struggling'
      WHEN (utm.elo_rating - ub.avg_elo) / ub.elo_stddev < -0.5 THEN 'Developing'
      WHEN (utm.elo_rating - ub.avg_elo) / ub.elo_stddev <  0.5 THEN 'Competent'
      WHEN (utm.elo_rating - ub.avg_elo) / ub.elo_stddev <  1.5 THEN 'Proficient'
      ELSE 'Mastered'
    END
  FROM user_baseline ub
  WHERE utm.userid     = NEW.userid
    AND utm.fsrs_state != 'new';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_mastery ON user_topic_mastery;
CREATE TRIGGER trigger_update_mastery
AFTER UPDATE OF elo_rating ON user_topic_mastery
FOR EACH ROW EXECUTE FUNCTION trigger_update_mastery_after_attempt();


-- =====================================================================================================================================================
--                                                           ELO SNAPSHOT FUNCTION + TRIGGER
-- =====================================================================================================================================================
-- upsert_elo_snapshot: recomputes today's weighted ELO for a user and upserts the
-- snapshot row. only counts topics where fsrs_state != 'new' so the chart shows real
-- progress immediately after the first quiz. falls back to all topics for users who have not yet answered a single question

CREATE OR REPLACE FUNCTION upsert_elo_snapshot(p_userid INTEGER)
RETURNS VOID AS $$
DECLARE
  v_weighted_elo DECIMAL(8,4);
  v_topics_included INTEGER;
BEGIN
  SELECT
    COALESCE(
      NULLIF(
        SUM(CASE WHEN utm.fsrs_state != 'new' THEN utm.elo_rating * t.exam_weight END)
          / NULLIF(SUM(CASE WHEN utm.fsrs_state != 'new' THEN t.exam_weight END), 0),
        NULL
      ),
      SUM(utm.elo_rating * t.exam_weight) / NULLIF(SUM(t.exam_weight), 0)
    ),
    COUNT(CASE WHEN utm.fsrs_state != 'new' THEN 1 END)
  INTO v_weighted_elo, v_topics_included
  FROM user_topic_mastery utm
  JOIN topics t ON utm.topicid = t.topicid
  WHERE utm.userid = p_userid
    AND utm.elo_rating IS NOT NULL
    AND t.exam_weight > 0;

  IF v_weighted_elo IS NULL THEN RETURN; END IF;

  INSERT INTO user_elo_snapshots (userid, snapshot_date, weighted_elo, topics_included, updated_at)
  VALUES (p_userid, CURRENT_DATE, ROUND(v_weighted_elo)::INTEGER, v_topics_included, NOW())
  ON CONFLICT (userid, snapshot_date) DO UPDATE
    SET weighted_elo = ROUND(EXCLUDED.weighted_elo)::INTEGER,
        topics_included = EXCLUDED.topics_included,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_fn_snapshot_elo()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM upsert_elo_snapshot(NEW.userid);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_snapshot_elo ON user_topic_mastery;
CREATE TRIGGER trigger_snapshot_elo
AFTER UPDATE OF elo_rating ON user_topic_mastery
FOR EACH ROW EXECUTE FUNCTION trigger_fn_snapshot_elo();


-- =====================================================================================================================================================
--                                                                 MAINTENANCE FUNCTIONS
-- =====================================================================================================================================================

-- refresh recent 30-day stats for all users (run daily via cron)
CREATE OR REPLACE FUNCTION refresh_recent_performance()
RETURNS VOID AS $$
BEGIN
  UPDATE user_topic_mastery utm
  SET
    recent_attempts = COALESCE(s.recent_attempts, 0),
    recent_correct = COALESCE(s.recent_correct,  0),
    recent_accuracy = ROUND((COALESCE(s.recent_correct, 0)::DECIMAL / NULLIF(s.recent_attempts, 0)) * 100, 2),
    avg_time_per_question = s.avg_time,
    avg_confidence = s.avg_conf
  FROM (
    SELECT
      qa.userid,
      t.topicid,
      COUNT(*) AS recent_attempts,
      SUM(CASE WHEN qa.is_correct THEN 1 ELSE 0 END) AS recent_correct,
      ROUND(AVG(qa.time_taken)) AS avg_time,
      ROUND(AVG(qa.confidence), 2) AS avg_conf
    FROM question_attempts qa
    JOIN question_topics qt ON qa.questionid  = qt.questionid
    JOIN topics t  ON qt.topic_code = t.topic_code
    WHERE qa.attempted_at > NOW() - INTERVAL '30 days'
    GROUP BY qa.userid, t.topicid
  ) s
  WHERE utm.userid = s.userid AND utm.topicid = s.topicid;
END;
$$ LANGUAGE plpgsql;


-- decay RD for inactive users (run weekly via cron)
-- formula: phi* = sqrt(phi^2 + sigma^2 * time_periods), 1 period = 30 days for users, 60 for questions
CREATE OR REPLACE FUNCTION decay_inactive_ratings()
RETURNS VOID AS $$
BEGIN
  UPDATE user_topic_mastery
  SET
    glicko_rd = LEAST(350, SQRT(
      (glicko_rd / 173.7178) * (glicko_rd / 173.7178)
      + glicko_volatility * glicko_volatility
        * (EXTRACT(EPOCH FROM (NOW() - last_review_date)) / (86400 * 30))
    ) * 173.7178),
    updated_at = NOW()
  WHERE last_review_date < NOW() - INTERVAL '30 days'
    AND glicko_rd < 350;

  UPDATE questions
  SET
    glicko_rd = LEAST(350, SQRT(
      (glicko_rd / 173.7178) * (glicko_rd / 173.7178)
      + glicko_volatility * glicko_volatility
        * (EXTRACT(EPOCH FROM (NOW() - updated_at)) / (86400 * 60))
    ) * 173.7178),
    updated_at = NOW()
  WHERE updated_at < NOW() - INTERVAL '60 days'
    AND glicko_rd < 350
    AND NOT is_anchor;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================================================================================================
--                                                             TESTING / VALIDATION
-- =====================================================================================================================================================

-- validates calculate_glicko2_volatility against Glickman (2013) paper example
-- run with: SELECT * FROM test_glicko2_example();
CREATE OR REPLACE FUNCTION test_glicko2_example()
RETURNS TABLE(test_name TEXT, expected_value DOUBLE PRECISION,
              actual_value DOUBLE PRECISION, difference DOUBLE PRECISION, passes BOOLEAN)
AS $$
BEGIN
  RETURN QUERY
  WITH c AS (
    SELECT calculate_glicko2_volatility(
      1.1513::DOUBLE PRECISION, 0.05999::DOUBLE PRECISION,
      0.1718::DOUBLE PRECISION, 1.7790::DOUBLE PRECISION,
      0.5::DOUBLE PRECISION
    ) AS sigma
  )
  SELECT
    'Volatility Calculation'::TEXT,
    0.05999::DOUBLE PRECISION,
    c.sigma,
    ABS(c.sigma - 0.05999),
    ABS(c.sigma - 0.05999) < 0.001
  FROM c;
END;
$$ LANGUAGE plpgsql;


-- =====================================================================================================================================================
--                                               BACKFILL: historical ELO snapshots from question_attempts
-- =====================================================================================================================================================
-- run once after deploying - reconstructs one snapshot per active day per user
-- using carry-forward ELO. safe to re-run (ON CONFLICT DO UPDATE)

DO $$
DECLARE v_row RECORD;
BEGIN
  FOR v_row IN
    WITH active_days AS (
      SELECT DISTINCT qa.userid, DATE(qa.attempted_at) AS day
      FROM question_attempts qa
      WHERE qa.user_elo_after IS NOT NULL AND qa.grading_status = 'graded'
    ),
    all_topics_used AS (
      SELECT DISTINCT qa.userid, qt.topic_code, t.exam_weight, t.topicid
      FROM question_attempts qa
      JOIN question_topics qt ON qa.questionid  = qt.questionid
      JOIN topics           t  ON qt.topic_code = t.topic_code
      WHERE qa.user_elo_after IS NOT NULL AND t.exam_weight > 0
    ),
    daily_weighted AS (
      SELECT
        ad.userid,
        ad.day,
        ROUND((
          SELECT SUM(last_elo.elo * atu.exam_weight) / NULLIF(SUM(atu.exam_weight), 0)
          FROM all_topics_used atu
          CROSS JOIN LATERAL (
            SELECT qa2.user_elo_after AS elo
            FROM question_attempts qa2
            JOIN question_topics qt2 ON qa2.questionid = qt2.questionid
            WHERE qa2.userid = ad.userid AND qt2.topic_code = atu.topic_code
              AND qa2.user_elo_after IS NOT NULL AND qa2.grading_status = 'graded'
              AND DATE(qa2.attempted_at) <= ad.day
            ORDER BY qa2.attempted_at DESC LIMIT 1
          ) last_elo
          WHERE atu.userid = ad.userid
        ))::INTEGER AS weighted_elo,
        (
          SELECT COUNT(DISTINCT atu.topic_code)
          FROM all_topics_used atu
          WHERE atu.userid = ad.userid
            AND EXISTS (
              SELECT 1 FROM question_attempts qa3
              JOIN question_topics qt3 ON qa3.questionid = qt3.questionid
              WHERE qa3.userid = ad.userid AND qt3.topic_code = atu.topic_code
                AND DATE(qa3.attempted_at) <= ad.day AND qa3.grading_status = 'graded'
            )
        )::INTEGER AS topics_included
      FROM active_days ad
    )
    SELECT * FROM daily_weighted WHERE weighted_elo IS NOT NULL
  LOOP
    INSERT INTO user_elo_snapshots (userid, snapshot_date, weighted_elo, topics_included, created_at, updated_at)
    VALUES (v_row.userid, v_row.day, v_row.weighted_elo, v_row.topics_included, NOW(), NOW())
    ON CONFLICT (userid, snapshot_date) DO UPDATE
      SET weighted_elo = EXCLUDED.weighted_elo,
          topics_included = EXCLUDED.topics_included,
          updated_at = NOW();
  END LOOP;
END $$;