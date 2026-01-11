/**
 * Supabase Query Functions
 *
 * AUTH IMPLEMENTATION NOTES:
 * All user-specific queries use getDemoUserId() from constants.ts
 * When implementing auth, update getDemoUserId() to return actual user ID
 */

// Reference data (no auth needed)
export * from './reference';

// User data (requires auth in production)
export * from './profile';
export * from './meals';
export * from './sleep';
export * from './symptoms';
export * from './supplements';
export * from './shopping';
