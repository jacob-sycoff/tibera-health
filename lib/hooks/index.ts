/**
 * React Query Hooks
 *
 * These hooks provide data fetching and mutations using React Query
 * backed by Supabase. All user-specific hooks use requireAuthUserId()
 * internally to read the authenticated user from the Supabase session.
 */

// Reference data (read-only, no auth needed)
export * from './use-reference-data';

// User data (requires auth in production)
export * from './use-profile';
export * from './use-effective-goals';
export * from './use-meals';
export * from './use-meal-plans';
export * from './use-sleep';
export * from './use-symptoms';
export * from './use-supplements';
export * from './use-shopping';
