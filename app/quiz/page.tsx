'use client';

// Quiz Page with Timer, Anti-cheat, and Auto-save
// Handles fullscreen, tab switching detection, and auto-submit

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatTime } from '@/lib/utils';
import {
  StartQuizResponse,
  QuizQuestion,
  SubmitQuizResponse,
} from '@/types';

export default function QuizPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(7200);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);

  // Anti-cheat state
  const [violations, setViolations] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSaveRef = useRef<number>(Date.now());

  // Initialize quiz
  useEffect(() => {
    const initQuiz = async () => {
      const participantId = localStorage.getItem('participantId');
      const savedAttemptId = localStorage.getItem('attemptId');

      if (!participantId) {
        router.push('/');
        return;
      }

      try {
        const response = await fetch('/api/quiz/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participantId,
            attemptId: savedAttemptId,
          }),
        });

        const data = await response.json();

if (!response.ok) {
  if (data.expired) {
    setError('Quiz time has expired');
    setSubmitted(true);
  } else {
    setError(data.error || 'Failed to load quiz');
  }
  setLoading(false);
  return;
}

        setAttemptId(data.attemptId);
        setQuestions(data.questions);
        setAnswers(data.answers || {});
        setTimeRemaining(data.timeRemaining);
        setTotalQuestions(data.questions.length);
        localStorage.setItem('attemptId', data.attemptId);
        setLoading(false);

        // Request fullscreen
        enterFullscreen();
      } catch (err) {
        setError('Failed to load quiz. Please refresh.');
        setLoading(false);
      }
    };

    initQuiz();
  }, [router]);

  // Timer countdown
  useEffect(() => {
    if (loading || submitted || timeRemaining <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1;
        
        // Auto-submit when time reaches 0
        if (newTime <= 0) {
          handleSubmit(true);
          return 0;
        }
        
        return newTime;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [loading, submitted, timeRemaining]);

  // Auto-save answers periodically
  useEffect(() => {
    if (loading || submitted || !attemptId) return;

    const autoSaveInterval = setInterval(() => {
      // Save if there are unsaved changes
      const now = Date.now();
      if (now - lastSaveRef.current > 5000) {
        // Save current answer if exists
        const currentQ = questions[currentQuestionIndex];
        if (currentQ && answers[currentQ.id]) {
          saveAnswer(currentQ.id, answers[currentQ.id]);
        }
      }
    }, 10000); // Auto-save every 10 seconds

    return () => clearInterval(autoSaveInterval);
  }, [loading, submitted, attemptId, answers, currentQuestionIndex, questions]);

  // Fullscreen and anti-cheat monitoring
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!document.fullscreenElement;
      setIsFullscreen(isFS);
      
      if (!isFS && !submitted && !loading) {
        logViolation('fullscreen_exit');
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && !submitted && !loading) {
        logViolation('tab_switch');
      }
    };

    const handleBlur = () => {
      if (!submitted && !loading) {
        logViolation('page_blur');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [submitted, loading]);

  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().catch(() => {
        console.log('Fullscreen request failed');
      });
    }
  };

  const logViolation = async (type: 'tab_switch' | 'fullscreen_exit' | 'page_blur') => {
    if (!attemptId) return;

    try {
      const response = await fetch('/api/quiz/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          violationType: type,
        }),
      });

      const data = await response.json();
      
      if (data.violationCount) {
        setViolations(data.violationCount);
      }

      // Auto-submit if too many violations
      if (data.shouldAutoSubmit) {
        handleSubmit(true);
      }
    } catch (err) {
      console.error('Failed to log violation:', err);
    }
  };

  const saveAnswer = async (questionId: string, selectedOptionId: string) => {
    if (!attemptId) return;

    try {
      await fetch('/api/quiz/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          questionId,
          selectedOptionId,
        }),
      });
      lastSaveRef.current = Date.now();
    } catch (err) {
      console.error('Failed to save answer:', err);
    }
  };

  const handleAnswerSelect = (optionId: string) => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optionId,
    }));

    // Save immediately
    saveAnswer(currentQuestion.id, optionId);
  };

  const handleSubmit = async (isAutoSubmit = false) => {
    if (!attemptId || submitting) return;

    setSubmitting(true);

    try {
      const response = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          finalAnswers: answers,
        }),
      });

     const data = await response.json();

if (response.ok) {
  setScore(data.score);
  setTotalQuestions(data.totalQuestions);
  setSubmitted(true);
  
  // Exit fullscreen
  if (document.fullscreenElement) {
    document.exitFullscreen();
  }
} else {
  setError(data.error || 'Submission failed');
  setSubmitting(false);
}
    } catch (err) {
      setError('Network error during submission');
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !submitted) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // Results screen
  if (submitted && score !== null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Quiz Completed!</h2>
            <p className="text-gray-600">Your answers have been submitted</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <div className="text-5xl font-bold text-blue-600 mb-2">
              {score}/{totalQuestions}
            </div>
            <p className="text-gray-600">Correct Answers</p>
          </div>

          <div className="text-left space-y-2 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Score:</span>
              <span className="font-medium">{((score / totalQuestions) * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Violations:</span>
              <span className="font-medium">{violations}</span>
            </div>
          </div>

          <button
            onClick={() => router.push('/')}
            className="w-full bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700"
          >
            Exit Quiz
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const selectedOption = currentQuestion ? answers[currentQuestion.id] : null;
  const answeredCount = Object.keys(answers).length;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header with timer and navigation */}
      <div className="bg-white shadow-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="text-sm text-gray-600">Question {currentQuestionIndex + 1} of {questions.length}</span>
              <div className="text-xs text-gray-500">Answered: {answeredCount}/{questions.length}</div>
            </div>
            
            <div className="text-right">
              <div className={`text-2xl font-mono font-bold ${timeRemaining < 300 ? 'text-red-600' : 'text-blue-600'}`}>
                {formatTime(timeRemaining)}
              </div>
              {violations > 0 && (
                <div className="text-xs text-red-600">
                  Violations: {violations}
                </div>
              )}
            </div>
          </div>

          {!isFullscreen && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded text-sm">
              Please stay in fullscreen mode
            </div>
          )}
        </div>
      </div>

      {/* Question content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {currentQuestion && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">
              {currentQuestion.question_text}
            </h2>

            <div className="space-y-3">
              {currentQuestion.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleAnswerSelect(option.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedOption === option.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <span className="text-gray-800">{option.option_text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between gap-4">
          <button
            onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
            disabled={currentQuestionIndex === 0}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300"
          >
            Previous
          </button>

          {currentQuestionIndex < questions.length - 1 ? (
            <button
              onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
              className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Next
            </button>
          ) : (
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
            >
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          )}
        </div>

        {/* Question grid for navigation */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Navigation</h3>
          <div className="grid grid-cols-10 gap-2">
            {questions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => setCurrentQuestionIndex(idx)}
                className={`aspect-square rounded text-sm font-medium ${
                  idx === currentQuestionIndex
                    ? 'bg-blue-600 text-white'
                    : answers[q.id]
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-300'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}