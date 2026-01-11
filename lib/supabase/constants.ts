/**
 * Supabase Constants
 *
 * AUTH IMPLEMENTATION NOTES:
 * When implementing authentication:
 * 1. Replace DEMO_USER_ID usage with actual auth.uid()
 * 2. Remove getDemoUserId() function
 * 3. Update all query functions to use authenticated user
 * 4. Remove demo_* RLS policies from database
 */

// Demo user ID for development (no auth)
// This will be replaced with actual auth user ID when auth is implemented
export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Get the current user ID
 *
 * TODO: Replace this with actual auth when implementing:
 * ```
 * export async function getCurrentUserId(): Promise<string | null> {
 *   const { data: { user } } = await supabase.auth.getUser();
 *   return user?.id ?? null;
 * }
 * ```
 */
export function getDemoUserId(): string {
  return DEMO_USER_ID;
}

/**
 * Check if we're in demo mode (no auth)
 * This will return false once auth is implemented
 */
export function isDemoMode(): boolean {
  return true; // TODO: Change to check for actual auth session
}
