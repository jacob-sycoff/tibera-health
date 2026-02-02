import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ user: null, role: 'anon', emailVerified: false });
    }

    const admin = createAdminClient();

    // Check admin status
    const { data: adminRow } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .single();

    // Check email verification
    const { data: profile } = await admin
      .from('profiles')
      .select('email_verified')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.user_metadata?.full_name,
      },
      role: adminRow ? 'admin' : 'user',
      emailVerified: profile?.email_verified ?? false,
    });
  } catch (err) {
    console.error('[me] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
