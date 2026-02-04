import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/server';
import { sendEmail } from '@/lib/email';
import { buildPasswordResetEmail } from '@/lib/emails/templates';
import { siteUrl } from '@/lib/env';
import crypto from 'crypto';

// POST: Request password reset (send email)
export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Server misconfigured';
      console.error('[reset-password:POST] supabase admin init error:', err);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    // Look up user by email
    const { data: userData } = await admin.auth.admin.listUsers();
    const user = userData?.users?.find(
      (u: User) => u.email?.toLowerCase() === email.toLowerCase()
    );

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({ success: true });
    }

    // Get display name for email
    const { data: profile } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single();

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

    await admin.from('password_reset_tokens').insert({
      token,
      user_id: user.id,
      expires_at: expiresAt.toISOString(),
    });

    // Send email
    const resetLink = `${siteUrl}/reset-password?token=${token}`;
    sendEmail({
      to: email,
      subject: 'Reset your password - Tibera Health',
      html: buildPasswordResetEmail(resetLink, profile?.display_name),
    }).catch((err: unknown) => console.error('[reset-password] email error:', err));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[reset-password:POST] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Set new password using token
export async function PUT(request: Request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token and password are required' },
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
      console.error('[reset-password:PUT] supabase admin init error:', err);
      return NextResponse.json({ error: message }, { status: 500 });
    }

    // Look up token
    const { data: tokenRow, error: tokenError } = await admin
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .single();

    if (tokenError || !tokenRow) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link' },
        { status: 400 }
      );
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'This reset link has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Update password via admin API
    const { error: updateError } = await admin.auth.admin.updateUserById(
      tokenRow.user_id,
      { password }
    );

    if (updateError) {
      console.error('[reset-password:PUT] update error:', updateError);
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    // Mark token as used
    await admin
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRow.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[reset-password:PUT] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
