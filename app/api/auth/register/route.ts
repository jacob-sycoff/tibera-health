import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { sendEmail } from '@/lib/email';
import { buildVerificationEmail } from '@/lib/emails/templates';
import { siteUrl } from '@/lib/env';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { email, password, displayName } = await request.json();

    if (!email || !password || !displayName) {
      return NextResponse.json(
        { error: 'Email, password, and display name are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Server misconfigured';
      console.error('[register] supabase admin init error:', err);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    // Create user via admin client (bypasses email confirmation)
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName },
    });

    if (authError) {
      if (authError.message?.includes('already been registered')) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 }
        );
      }
      console.error('[register] auth error:', authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const userId = authData.user.id;

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await admin.from('email_verification_tokens').insert({
      token,
      user_id: userId,
      expires_at: expiresAt.toISOString(),
    });

    // Send verification email (fire-and-forget)
    const verifyLink = `${siteUrl}/verify-email/${token}`;
    const emailResult = await sendEmail({
      to: email,
      subject: 'Verify your email - Tibera Health',
      html: buildVerificationEmail(verifyLink),
    });

    if (!emailResult.success) {
      console.error('[register] verification email send failed:', emailResult.error);
      await admin.from('email_verification_tokens').delete().eq('token', token);
      await admin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: emailResult.error || 'Failed to send verification email' },
        { status: 500 }
      );
    }

    // Sign the user in server-side
    try {
      const supabase = await createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        console.error('[register] sign-in error:', signInError);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Server misconfigured';
      console.error('[register] supabase client init error:', err);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ success: true, userId });
  } catch (err) {
    console.error('[register] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
