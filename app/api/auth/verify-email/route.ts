import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Look up token
    const { data: tokenRow, error: tokenError } = await admin
      .from('email_verification_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .single();

    if (tokenError || !tokenRow) {
      return NextResponse.json(
        { error: 'Invalid or expired verification link' },
        { status: 400 }
      );
    }

    // Check expiry
    if (new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This verification link has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Mark email as verified
    const { error: profileError } = await admin
      .from('profiles')
      .update({ email_verified: true })
      .eq('id', tokenRow.user_id);

    if (profileError) {
      console.error('[verify-email] profile update error:', profileError);
      return NextResponse.json({ error: 'Failed to verify email' }, { status: 500 });
    }

    // Mark token as used
    await admin
      .from('email_verification_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRow.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[verify-email] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
