/**
 * Centralized environment variable exports.
 * Import from here instead of accessing process.env directly.
 */

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;
export const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
export const resendApiKey = process.env.RESEND_API_KEY;
export const emailFrom = process.env.EMAIL_FROM || 'Tibera Health <noreply@tiberahealth.com>';
export const supportEmail = process.env.SUPPORT_EMAIL || 'support@tiberahealth.com';
