// API Route: Save Answer
// Saves or updates participant's answer for a question

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculateRemainingTime } from '@/lib/utils';
import { SaveAnswerRequest } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body: SaveAnswerRequest = await req.json();
    const { attemptId, questionId, selectedOptionId } = body;

    if (!attemptId || !questionId) {
      return NextResponse.json(
        { error: 'Attempt ID and Question ID required' },
        { status: 400 }
      );
    }

    // Verify attempt exists and is not submitted
    const { data: attempt, error: attemptError } = await supabase
      .from('attempts')
      .select('started_at, submitted_at')
      .eq('id', attemptId)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json(
        { error: 'Invalid attempt' },
        { status: 404 }
      );
    }

    if (attempt.submitted_at) {
      return NextResponse.json(
        { error: 'Quiz already submitted' },
        { status: 400 }
      );
    }

    // Check if time expired
    const timeRemaining = calculateRemainingTime(attempt.started_at);
    if (timeRemaining === 0) {
      return NextResponse.json(
        { error: 'Quiz time expired', expired: true },
        { status: 400 }
      );
    }

    // Upsert answer (insert or update)
    const { error: answerError } = await supabase
      .from('answers')
      .upsert(
        {
          attempt_id: attemptId,
          question_id: questionId,
          selected_option_id: selectedOptionId,
          answered_at: new Date().toISOString(),
        },
        {
          onConflict: 'attempt_id,question_id',
        }
      );

    if (answerError) {
      console.error('Error saving answer:', answerError);
      return NextResponse.json(
        { error: 'Failed to save answer' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save answer error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}