/**
 * Supabase Query Functions
 *
 * All user-specific queries use requireAuthUserId() from constants.ts
 * which reads the authenticated user from the Supabase session.
 */

// Reference data (no auth needed)
export * from './reference';
export * from './categories';

// User data (requires auth in production)
export * from './profile';
export * from './meals';
export * from './meal-plans';
export * from './sleep';
export * from './symptoms';
export * from './supplements';
export * from './shopping';
export * from './food-overrides';
export * from './food-match-audits';
