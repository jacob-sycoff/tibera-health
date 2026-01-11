import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

// Using untyped client temporarily to avoid TypeScript strict mode issues
// TODO: Regenerate types with `npx supabase gen types typescript` when Supabase types are stabilized
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to get current user
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Helper to get current session
export async function getSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}
