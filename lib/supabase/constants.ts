/**
 * Supabase Constants
 *
 * Uses Supabase Auth for user identification.
 */

import { supabase } from './client';

/**
 * Get the authenticated user ID from the current session.
 * Returns null if not authenticated.
 */
export async function getAuthUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Get the authenticated user ID, throwing if not authenticated.
 * Use this in query functions that require auth.
 */
export async function requireAuthUserId(): Promise<string> {
  const userId = await getAuthUserId();
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

/**
 * Check if we're in demo mode (no auth).
 * Always returns false now that auth is implemented.
 */
export function isDemoMode(): boolean {
  return false;
}
