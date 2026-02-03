import { createBrowserClient } from '@supabase/ssr';

function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL');
  }
  return value;
}

function getSupabaseAnonKey() {
  const value =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!value) {
    throw new Error(
      'Missing env: NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY'
    );
  }
  return value;
}

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
  return browserClient;
}
