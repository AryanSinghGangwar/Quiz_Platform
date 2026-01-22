// API Route: Register participant
// Handles new registration and checks for existing participants

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { normalizePhone, validatePhone } from '@/lib/utils';
import { RegisterRequest, RegisterResponse } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body: RegisterRequest = await req.json();
    const { name, class: className, school, phone } = body;

    // Validation
    if (!name || !className || !school || !phone) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    if (!validatePhone(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(phone);

    // Check if participant already exists
    const { data: existingParticipant, error: findError } = await supabase
      .from('participants')
      .select('*')
      .eq('phone', normalizedPhone)
      .single();

    let participant = existingParticipant;

    // If participant doesn't exist, create new one
    if (!participant) {
      const { data: newParticipant, error: createError } = await supabase
        .from('participants')
        .insert([
          {
            name,
            class: className,
            school,
            phone: normalizedPhone,
          },
        ])
        .select()
        .single();

      if (createError) {
        console.error('Error creating participant:', createError);
        return NextResponse.json(
          { error: 'Failed to create participant' },
          { status: 500 }
        );
      }

      participant = newParticipant;
    }

    // Check for active (non-submitted) attempt
    const { data: activeAttempt, error: attemptError } = await supabase
      .from('attempts')
      .select('id')
      .eq('participant_id', participant.id)
      .is('submitted_at', null)
      .single();

    const response: RegisterResponse = {
      participant,
      hasActiveAttempt: !!activeAttempt,
      attemptId: activeAttempt?.id,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}