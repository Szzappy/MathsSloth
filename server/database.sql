DROP TABLE IF EXISTS grade_predictions CASCADE;
DROP TABLE IF EXISTS topic_mastery_snapshots CASCADE;
DROP MATERIALIZED VIEW IF EXISTS user_topic_mastery CASCADE;
DROP TABLE IF EXISTS question_attempts CASCADE;
DROP TABLE IF EXISTS quiz_questions CASCADE;
DROP TABLE IF EXISTS quiz_custom_topics CASCADE;
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


-- =====================================================================================================================================================
--                                                                TOPICS AND QUESTIONS
-- =====================================================================================================================================================

CREATE TABLE topics (
  topicid SERIAL PRIMARY KEY,
  topic_code VARCHAR(50) NOT NULL UNIQUE,
  topic_name VARCHAR(255) NOT NULL,
  parent_topic VARCHAR(50) REFERENCES topics(topic_code) ON DELETE SET NULL,

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
  total_marks INTEGER DEFAULT 1 -- might not be needed
);

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
CREATE INDEX idx_questions_difficulty ON questions(difficulty);


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

CREATE TABLE quiz_custom_topics (
  quizid INTEGER REFERENCES quizzes(quizid) ON DELETE CASCADE,
  topicid INTEGER REFERENCES topics(topicid) ON DELETE CASCADE,
  PRIMARY KEY (quizid, topicid)
);

CREATE INDEX idx_quiz_custom_topics_quizid ON quiz_custom_topics(quizid);
CREATE INDEX idx_quiz_custom_topics_topicid ON quiz_custom_topics(topicid);

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

  ease_factor DECIMAL(3,2) DEFAULT 2.5,
  interval_days INTEGER DEFAULT 1,
  repetitions INTEGER DEFAULT 0,
  next_review_date DATE,
  is_review BOOLEAN DEFAULT FALSE,

  question_difficulty INTEGER,
  attempted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_question_attempts_userid ON question_attempts(userid, attempted_at DESC);
CREATE INDEX idx_question_attempts_questionid ON question_attempts(questionid);
CREATE INDEX idx_question_attempts_review ON question_attempts(userid, next_review_date) WHERE next_review_date IS NOT NULL;
CREATE INDEX idx_question_attempts_userid_questionid ON question_attempts(userid, questionid);

-- =====================================================================================================================================================
--                                                              TOPIC MASTERY AND USER ANALYTICS
-- =====================================================================================================================================================

CREATE MATERIALIZED VIEW user_topic_mastery AS
SELECT 
  qa.userid,
  qt.topicid,
  
  -- Performance metrics
  COUNT(*) as total_attempts,
  SUM(CASE WHEN qa.is_correct THEN 1 ELSE 0 END) as correct_attempts,
  ROUND(AVG(CASE WHEN qa.is_correct THEN 100.0 ELSE 0.0 END), 2) as accuracy,
  
  -- Recent performance (last 10 attempts)
  ROUND(AVG(CASE WHEN qa.is_correct THEN 100.0 ELSE 0.0 END) 
    FILTER (WHERE qa.attempted_at >= NOW() - INTERVAL '30 days'), 2) as recent_accuracy,
  
  -- Confidence metrics
  ROUND(AVG(qa.confidence), 2) as avg_confidence,
  
  -- Time metrics
  SUM(qa.time_taken) as total_time_spent,
  ROUND(AVG(qa.time_taken), 0) as avg_time_per_question,
  
  -- Difficulty & mastery score (0-100 scale based on difficulty-adjusted performance)
  ROUND(AVG(CASE 
    WHEN qa.is_correct THEN qa.question_difficulty 
    ELSE qa.question_difficulty * 0.5 
  END), 2) as ability_level,
  
  -- Last activity
  MAX(qa.attempted_at) as last_revised,
  MIN(qa.next_review_date) as next_review_due,
  
  -- Hints
  SUM(qa.hints_used) as total_hints_used

FROM question_attempts qa
JOIN question_topics qt ON qa.questionid = qt.questionid
GROUP BY qa.userid, qt.topicid;

CREATE UNIQUE INDEX idx_mastery_userid_topicid ON user_topic_mastery(userid, topicid);
CREATE INDEX idx_mastery_userid ON user_topic_mastery(userid);


CREATE TABLE topic_mastery_snapshots (
  userid INTEGER REFERENCES users(userid) ON DELETE CASCADE,
  topicid INTEGER REFERENCES topics(topicid) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  
  -- Snapshot metrics
  accuracy DECIMAL(5,2),
  mastery_score DECIMAL(5,2),
  questions_attempted INTEGER,
  study_time INTEGER, -- seconds
  predicted_grade VARCHAR(10),
  
  PRIMARY KEY (userid, topicid, snapshot_date)
);

CREATE INDEX idx_snapshots_userid_date ON topic_mastery_snapshots(userid, snapshot_date DESC);


-- =====================================================================================================================================================
--                                                                    PREDICTED GRADES
-- =====================================================================================================================================================


CREATE TABLE grade_predictions (
  userid INTEGER REFERENCES users(userid) ON DELETE CASCADE,
  topicid INTEGER REFERENCES topics(topicid) ON DELETE CASCADE, -- NULL = overall
  
  predicted_grade VARCHAR(10), -- 'A*', 'A', 'B', etc.
  predicted_percentage DECIMAL(5,2),
  
  calculated_at TIMESTAMP DEFAULT NOW(),
  
  PRIMARY KEY (userid, topicid, calculated_at)
);

CREATE INDEX idx_predictions_userid ON grade_predictions(userid, calculated_at DESC);

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
  
  -- Update streak logic
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
  
  -- Update stats (always runs)
  UPDATE user_progress
  SET 
    total_questions_answered = total_questions_answered + 1,
    total_study_time = total_study_time + NEW.time_taken,
    total_xp = total_xp + (CASE WHEN NEW.is_correct THEN 10 ELSE 5 END),
    updated_at = NOW()
  WHERE userid = NEW.userid;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_progress
AFTER INSERT ON question_attempts
FOR EACH ROW
EXECUTE FUNCTION update_user_progress();


-- To refresh the materialized view periodically (e.g., after new question attempts)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY user_topic_mastery;