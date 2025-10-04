-- metrics to implement
-- accuracty per topic + overall score trends
-- topic mastery scores + weak area detection
-- confidence vs accuracy
-- time spent per topic + time per question
-- 

CREATE TABLE users (
  userid SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  verification_token_expiry TIMESTAMP
);

-- a subtopic could reference a topicid in this table 
-- if trigonometry is the parent topic, a subtopic could be trig differentiation
-- could also be placed under calculus though
-- maybe add a composite primary key
CREATE TABLE topics (
  topicid VARCHAR(255) PRIMARY KEY,
  topic_name VARCHAR(255) NOT NULL UNIQUE,
  parent_topic VARCHAR(255) REFERENCES topics(topicid)
);

CREATE TABLE questions (
  questionid SERIAL PRIMARY KEY,
  -- topic INTEGER REFERENCES topics(topicid) ON DELETE CASCADE,
  question_text TEXT,
  image_url TEXT,
  format VARCHAR(255), -- does it require long answer or multiple choice
  answer TEXT,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 100),
  marks INTEGER
);

CREATE TABLE question_topic (
  questionid INTEGER REFERENCES questions(questionid) ON DELETE CASCADE,
  topicid INTEGER REFERENCES topics(topicid) ON DELETE CASCADE,
  PRIMARY KEY (questionid, topicid)
);

-- could have a topic category called mixed where you can have multiple different topics
-- a quiz is made for a specific user
CREATE TABLE quiz (
  quizid SERIAL PRIMARY KEY,
  userid INTEGER REFERENCES users(userid),
  quiz_topic INTEGER REFERENCES topics(topicid) ON DELETE CASCADE,
  -- question_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- joining table as many quizes have many questions
-- breaks down many to many into one to many 
CREATE TABLE quiz_questions (
  quizid INTEGER REFERENCES quiz(quizid) ON DELETE CASCADE,
  questionid INTEGER REFERENCES questions(questionid) ON DELETE CASCADE,
  question_order INTEGER,
  PRIMARY KEY(quizid, questionid) 
);


CREATE TABLE question_attempts (
  attemptid SERIAL PRIMARY KEY,
  userid INTEGER REFERENCES users(userid),
  questionid INTEGER REFERENCES questions(questionid),
  quizid INTEGER REFERENCES quiz(quizid), -- maybe include for context??
  
  -- performance data
  attempt_mark INTEGER,
  confidence INTEGER CHECK (confidence BETWEEN 1 AND 8),
  time_taken INTEGER,
  attempted_at TIMESTAMP DEFAULT NOW(),
  
  -- Spaced repetition fields
  ease_factor DECIMAL(3,2) DEFAULT 2.5,
  interval_days INTEGER DEFAULT 1,
  repetitions INTEGER DEFAULT 0,
  next_review_date DATE,
  
  -- track if this was a "review" question or first-time doing it
  is_review BOOLEAN DEFAULT FALSE
);

-- table for the analytics of users and specific topics
-- also used for spaced repetition
CREATE TABLE user_topics (
  userid INTEGER REFERENCES users(userid),
  topicid INTEGER REFERENCES topics(topicid),
  mastery DECIMAL(5,2) DEFAULT 0 CHECK (mastery BETWEEN 1 AND 100),
  accuracy DECIMAL(5,2) DEFAULT 0 CHECK (accuracy BETWEEN 1 AND 100),
  study_time INTEGER DEFAULT 0, -- study time in seconds
  last_studied_at TIMESTAMP,
  PRIMARY KEY(userid, topicid)
);

CREATE TABLE formulae (
  -- included in examFormSheet
  formulaid SERIAL PRIMARY KEY,

  -- store in latex then render to frontend and format?
  formula_text TEXT,
  included_in_formula_sheet BOOLEAN,
  formula_topic INTEGER REFERENCES topics(topicid) ON DELETE CASCADE -- foreign key referencing topic id
);

-- CREATE FUNCTIONS FOR ACCESSING DATA 