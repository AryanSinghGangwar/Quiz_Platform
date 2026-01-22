// API Route: Quiz Status and Violation Logging
// GET: Returns current quiz status and time remaining
// POST: Logs anti-cheat violations

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateRemainingTime } from '@/lib/utils';
import { QuizStatusResponse, LogViolationRequest, ViolationLog } from '@/types';

// GET: Check quiz status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const attemptId = searchParams.get('attemptId');

    if (!attemptId) {
      return NextResponse.json(
        { error: 'Attempt ID required' },
        { status: 400 }
      );
    }

    const { data: attempt, error } = await supabase
      .from('attempts')
      .select('started_at, submitted_at, score')
      .eq('id', attemptId)
      .single();

    if (error || !attempt) {
      return NextResponse.json(
        { error: 'Attempt not found' },
        { status: 404 }
      );
    }

    const timeRemaining = attempt.submitted_at
      ? 0
      : calculateRemainingTime(attempt.started_at);

    const response: QuizStatusResponse = {
      timeRemaining,
      isSubmitted: !!attempt.submitted_at,
      score: attempt.score || undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Log violation
export async function POST(req: NextRequest) {
  try {
    const body: LogViolationRequest = await req.json();
    const { attemptId, violationType } = body;

    if (!attemptId || !violationType) {
      return NextResponse.json(
        { error: 'Attempt ID and violation type required' },
        { status: 400 }
      );
    }

    // Get current attempt
    const { data: attempt, error } = await supabase
      .from('attempts')
      .select('violation_count, violation_log, submitted_at')
      .eq('id', attemptId)
      .single();

    if (error || !attempt) {
      return NextResponse.json(
        { error: 'Attempt not found' },
        { status: 404 }
      );
    }

    // Don't log violations for submitted attempts
    if (attempt.submitted_at) {
      return NextResponse.json({ success: true });
    }

    // Create new violation entry
    const newViolation: ViolationLog = {
      type: violationType,
      timestamp: new Date().toISOString(),
    };

    const updatedLog = [...(attempt.violation_log || []), newViolation];
    const newCount = (attempt.violation_count || 0) + 1;

    // Update attempt with new violation
    const { error: updateError } = await supabase
      .from('attempts')
      .update({
        violation_count: newCount,
        violation_log: updatedLog,
      })
      .eq('id', attemptId);

    if (updateError) {
      console.error('Error logging violation:', updateError);
      return NextResponse.json(
        { error: 'Failed to log violation' },
        { status: 500 }
      );
    }

    // Optional: Auto-submit after X violations
    const AUTO_SUBMIT_THRESHOLD = 10;
    const shouldAutoSubmit = newCount >= AUTO_SUBMIT_THRESHOLD;

    return NextResponse.json({
      success: true,
      violationCount: newCount,
      shouldAutoSubmit,
    });
  } catch (error) {
    console.error('Log violation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}