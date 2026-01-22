// API Route: Submit Quiz
// Calculates score server-side and marks attempt as submitted

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { SubmitQuizRequest, SubmitQuizResponse } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body: SubmitQuizRequest = await req.json();
    const { attemptId, finalAnswers } = body;

    if (!attemptId) {
      return NextResponse.json(
        { error: 'Attempt ID required' },
        { status: 400 }
      );
    }

    // Verify attempt exists and is not already submitted
    const { data: attempt, error: attemptError } = await supabase
      .from('attempts')
      .select('*, participant_id, question_order')
      .eq('id', attemptId)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json(
        { error: 'Invalid attempt' },
        { status: 404 }
      );
    }

    if (attempt.submitted_at) {
      // Already submitted, return existing score
      return NextResponse.json({
        score: attempt.score,
        totalQuestions: (attempt.question_order as string[]).length,
        submittedAt: attempt.submitted_at,
      } as SubmitQuizResponse);
    }

    // Save any final answers that weren't saved yet
    if (finalAnswers && Object.keys(finalAnswers).length > 0) {
      const answersToInsert = Object.entries(finalAnswers).map(
        ([questionId, selectedOptionId]) => ({
          attempt_id: attemptId,
          question_id: questionId,
          selected_option_id: selectedOptionId,
          answered_at: new Date().toISOString(),
        })
      );

      await supabase.from('answers').upsert(answersToInsert, {
        onConflict: 'attempt_id,question_id',
      });
    }

    // Calculate score server-side
    // Count correct answers by joining answers with options
    const { data: correctAnswers, error: scoreError } = await supabase
      .from('answers')
      .select('selected_option_id, options!inner(is_correct)')
      .eq('attempt_id', attemptId);

    if (scoreError) {
      console.error('Error calculating score:', scoreError);
      return NextResponse.json(
        { error: 'Failed to calculate score' },
        { status: 500 }
      );
    }

    // Count how many answers are correct
    const score = correctAnswers?.filter(
      (ans: any) => ans.options?.is_correct === true
    ).length || 0;

    const totalQuestions = (attempt.question_order as string[]).length;
    const submittedAt = new Date().toISOString();

    // Update attempt with score and submission time
    const { error: updateError } = await supabase
      .from('attempts')
      .update({
        score,
        submitted_at: submittedAt,
      })
      .eq('id', attemptId);

    if (updateError) {
      console.error('Error updating attempt:', updateError);
      return NextResponse.json(
        { error: 'Failed to submit quiz' },
        { status: 500 }
      );
    }

    const response: SubmitQuizResponse = {
      score,
      totalQuestions,
      submittedAt,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Submit quiz error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}