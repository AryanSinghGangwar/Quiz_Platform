-- Quiz Application Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Participants table
CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    class VARCHAR(50) NOT NULL,
    school VARCHAR(255) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Questions table
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Options table
CREATE TABLE options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Attempts table
-- Stores quiz attempts with randomized question and option orders
CREATE TABLE attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    submitted_at TIMESTAMP WITH TIME ZONE,
    time_remaining INTEGER NOT NULL DEFAULT 7200, -- 2 hours in seconds
    score INTEGER,
    question_order JSONB NOT NULL, -- Array of question IDs in random order
    option_orders JSONB NOT NULL, -- Map of question_id -> array of option IDs
    violation_count INTEGER DEFAULT 0,
    violation_log JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT one_active_attempt_per_participant UNIQUE (participant_id, submitted_at)
);

-- Answers table
-- Stores participant's selected answers
CREATE TABLE answers (
    attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    selected_option_id UUID REFERENCES options(id) ON DELETE CASCADE,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (attempt_id, question_id)
);

-- Indexes for performance
CREATE INDEX idx_participants_phone ON participants(phone);
CREATE INDEX idx_attempts_participant ON attempts(participant_id);
CREATE INDEX idx_attempts_submitted ON attempts(submitted_at);
CREATE INDEX idx_answers_attempt ON answers(attempt_id);
CREATE INDEX idx_options_question ON options(question_id);

-- Function to get or create active attempt
CREATE OR REPLACE FUNCTION get_active_attempt(p_participant_id UUID)
RETURNS UUID AS $$
DECLARE
    v_attempt_id UUID;
BEGIN
    SELECT id INTO v_attempt_id
    FROM attempts
    WHERE participant_id = p_participant_id
    AND submitted_at IS NULL
    LIMIT 1;
    
    RETURN v_attempt_id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate score
CREATE OR REPLACE FUNCTION calculate_score(p_attempt_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_score INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_score
    FROM answers a
    JOIN options o ON a.selected_option_id = o.id
    WHERE a.attempt_id = p_attempt_id
    AND o.is_correct = TRUE;
    
    RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- Disable Row Level Security (backend-only access)
ALTER TABLE participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE options DISABLE ROW LEVEL SECURITY;
ALTER TABLE attempts DISABLE ROW LEVEL SECURITY;
ALTER TABLE answers DISABLE ROW LEVEL SECURITY;