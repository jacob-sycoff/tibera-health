import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST() {
  try {
    let supabase;
    try {
      supabase = await createClient();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Server misconfigured';
      console.error('[signout] supabase init error:', err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
    await supabase.auth.signOut();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[signout] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
