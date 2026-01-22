// API Route: Start or Resume Quiz
// Creates new attempt or resumes existing one with randomized questions

import { NextRequest, NextResponse } from 'next/server';
import { supabase, shuffleArray } from '@/lib/supabase';
import { calculateRemainingTime } from '@/lib/utils';
import { StartQuizResponse, QuizQuestion, SafeOption } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { participantId, attemptId } = await req.json();

    if (!participantId) {
      return NextResponse.json(
        { error: 'Participant ID required' },
        { status: 400 }
      );
    }

    let attempt;
    let isNewAttempt = false;

    // If attemptId provided, try to resume
    if (attemptId) {
      const { data } = await supabase
        .from('attempts')
        .select('*')
        .eq('id', attemptId)
        .eq('participant_id', participantId)
        .is('submitted_at', null)
        .single();

      attempt = data;
    }

    // If no existing attempt, create new one
    if (!attempt) {
      isNewAttempt = true;

      // Fetch all questions and options
      const { data: questions, error: qError } = await supabase
        .from('questions')
        .select('id');

      if (qError || !questions || questions.length === 0) {
        return NextResponse.json(
          { error: 'No questions available' },
          { status: 500 }
        );
      }

      // Randomize question order using participant ID as seed
      const questionOrder = shuffleArray(
        questions.map((q) => q.id),
        participantId
      );

      // For each question, randomize option order
      const optionOrders: Record<string, string[]> = {};

      for (const questionId of questionOrder) {
        const { data: options } = await supabase
          .from('options')
          .select('id')
          .eq('question_id', questionId);

        if (options && options.length > 0) {
          optionOrders[questionId] = shuffleArray(
            options.map((o) => o.id),
            participantId + questionId // Unique seed per question
          );
        }
      }

      // Create new attempt
      const { data: newAttempt, error: createError } = await supabase
        .from('attempts')
        .insert([
          {
            participant_id: participantId,
            question_order: questionOrder,
            option_orders: optionOrders,
            time_remaining: 7200, // 2 hours
          },
        ])
        .select()
        .single();

      if (createError) {
        console.error('Error creating attempt:', createError);
        return NextResponse.json(
          { error: 'Failed to create quiz attempt' },
          { status: 500 }
        );
      }

      attempt = newAttempt;
    }

    // Calculate current remaining time based on server time
    const timeRemaining = calculateRemainingTime(attempt.started_at);

    // If time expired, auto-submit
    if (timeRemaining === 0) {
      return NextResponse.json(
        { error: 'Quiz time has expired', expired: true },
        { status: 400 }
      );
    }

    // Fetch questions and options in the randomized order
    const questionOrder = attempt.question_order as string[];
    const optionOrders = attempt.option_orders as Record<string, string[]>;

    const quizQuestions: QuizQuestion[] = [];

    for (const questionId of questionOrder) {
      // Fetch question
      const { data: question } = await supabase
        .from('questions')
        .select('id, question_text')
        .eq('id', questionId)
        .single();

      if (!question) continue;

      // Fetch options in randomized order (WITHOUT is_correct field)
      const optionIds = optionOrders[questionId] || [];
      const options: SafeOption[] = [];

      for (const optionId of optionIds) {
        const { data: option } = await supabase
          .from('options')
          .select('id, question_id, option_text') // NEVER select is_correct
          .eq('id', optionId)
          .single();

        if (option) {
          options.push(option);
        }
      }

      quizQuestions.push({
        id: question.id,
        question_text: question.question_text,
        options,
      });
    }

    // Fetch existing answers
    const { data: existingAnswers } = await supabase
      .from('answers')
      .select('question_id, selected_option_id')
      .eq('attempt_id', attempt.id);

    const answers: Record<string, string> = {};
    if (existingAnswers) {
      existingAnswers.forEach((ans) => {
        if (ans.selected_option_id) {
          answers[ans.question_id] = ans.selected_option_id;
        }
      });
    }

    const response: StartQuizResponse = {
      attemptId: attempt.id,
      timeRemaining,
      questions: quizQuestions,
      answers,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Start quiz error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}