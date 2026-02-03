import { NextResponse, type NextRequest } from 'next/server';
import { applyCookiesToResponse, createRouteClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const { supabase, cookiesToSet } = createRouteClient(request);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return applyCookiesToResponse(
        NextResponse.json({ error: 'Invalid email or password' }, { status: 401 }),
        cookiesToSet
      );
    }

    return applyCookiesToResponse(
      NextResponse.json({
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      }),
      cookiesToSet
    );
  } catch (err) {
    console.error('[login] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
