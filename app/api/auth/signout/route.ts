import { NextResponse, type NextRequest } from 'next/server';
import { applyCookiesToResponse, createRouteClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { supabase, cookiesToSet } = createRouteClient(request);
    await supabase.auth.signOut();
    return applyCookiesToResponse(NextResponse.json({ success: true }), cookiesToSet);
  } catch (err) {
    console.error('[signout] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
