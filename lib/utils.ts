// Utility functions for the quiz application

/**
 * Calculate remaining time based on start time and duration
 * Ensures accurate time tracking even after refresh/disconnect
 */
export function calculateRemainingTime(
  startedAt: string,
  totalDuration: number = 7200 // 2 hours in seconds
): number {
  const startTime = new Date(startedAt).getTime();
  const currentTime = Date.now();
  const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
  const remaining = Math.max(0, totalDuration - elapsedSeconds);
  
  return remaining;
}

/**
 * Format seconds to HH:MM:SS
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Validate phone number format
 * Accepts: 10 digits, with or without country code
 */
export function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || cleaned.length === 12;
}

/**
 * Normalize phone number for storage
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Check if attempt has expired (time reached zero)
 */
export function isAttemptExpired(startedAt: string, totalDuration: number = 7200): boolean {
  return calculateRemainingTime(startedAt, totalDuration) === 0;
}