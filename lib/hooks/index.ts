/**
 * React Query Hooks
 *
 * These hooks provide data fetching and mutations using React Query
 * backed by Supabase.
 *
 * AUTH IMPLEMENTATION NOTES:
 * All user-specific hooks use getDemoUserId() internally.
 * When implementing auth, no changes needed here - just update
 * getDemoUserId() in lib/supabase/constants.ts to return actual user ID.
 */

// Reference data (read-only, no auth needed)
export * from './use-reference-data';

// User data (requires auth in production)
export * from './use-profile';
export * from './use-meals';
export * from './use-sleep';
export * from './use-symptoms';
export * from './use-supplements';
export * from './use-shopping';
