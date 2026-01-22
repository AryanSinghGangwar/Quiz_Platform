
// Supabase client configuration
// Backend-only - never expose credentials to frontend

import { createClient } from '@supabase/supabase-js';

// Environment variables (set in Vercel)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Service role key for backend

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create Supabase client with service role key
// This bypasses RLS and should only be used on the backend
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper function to shuffle array using Fisher-Yates algorithm
// Deterministic when given same seed (participant_id)
export function shuffleArray<T>(array: T[], seed: string): T[] {
  const arr = [...array];
  let currentIndex = arr.length;
  
  // Simple seeded random number generator
  const seededRandom = (s: string, index: number) => {
    const x = Math.sin(s.split('').reduce((a, b) => a + b.charCodeAt(0), 0) + index) * 10000;
    return x - Math.floor(x);
  };

  let randomIndex: number;

  while (currentIndex !== 0) {
    randomIndex = Math.floor(seededRandom(seed, currentIndex) * currentIndex);
    currentIndex--;
    [arr[currentIndex], arr[randomIndex]] = [arr[randomIndex], arr[currentIndex]];
  }

  return arr;
}