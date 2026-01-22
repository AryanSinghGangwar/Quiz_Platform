// Type definitions for the quiz application

export interface Participant {
  id: string;
  name: string;
  class: string;
  school: string;
  phone: string;
  created_at: string;
}

export interface Question {
  id: string;
  question_text: string;
  created_at: string;
}

export interface Option {
  id: string;
  question_id: string;
  option_text: string;
  is_correct: boolean; // Never sent to frontend
  created_at: string;
}

// Frontend-safe option (without is_correct)
export interface SafeOption {
  id: string;
  question_id: string;
  option_text: string;
}

export interface Attempt {
  id: string;
  participant_id: string;
  started_at: string;
  submitted_at: string | null;
  time_remaining: number; // seconds
  score: number | null;
  question_order: string[]; // Array of question IDs
  option_orders: Record<string, string[]>; // question_id -> option_ids
  violation_count: number;
  violation_log: ViolationLog[];
  created_at: string;
}

export interface Answer {
  attempt_id: string;
  question_id: string;
  selected_option_id: string | null;
  answered_at: string;
}

export interface ViolationLog {
  type: 'tab_switch' | 'fullscreen_exit' | 'page_blur';
  timestamp: string;
}

// API Request/Response types

export interface RegisterRequest {
  name: string;
  class: string;
  school: string;
  phone: string;
}

export interface RegisterResponse {
  participant: Participant;
  hasActiveAttempt: boolean;
  attemptId?: string;
}

export interface StartQuizResponse {
  attemptId: string;
  timeRemaining: number;
  questions: QuizQuestion[];
  answers: Record<string, string>; // question_id -> selected_option_id
}

export interface QuizQuestion {
  id: string;
  question_text: string;
  options: SafeOption[]; // Randomized, no is_correct field
}

export interface SaveAnswerRequest {
  attemptId: string;
  questionId: string;
  selectedOptionId: string | null;
}

export interface SubmitQuizRequest {
  attemptId: string;
  finalAnswers: Record<string, string>; // question_id -> selected_option_id
}

export interface SubmitQuizResponse {
  score: number;
  totalQuestions: number;
  submittedAt: string;
}

export interface QuizStatusResponse {
  timeRemaining: number;
  isSubmitted: boolean;
  score?: number;
}

export interface LogViolationRequest {
  attemptId: string;
  violationType: 'tab_switch' | 'fullscreen_exit' | 'page_blur';
}