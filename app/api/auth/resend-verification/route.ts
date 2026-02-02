import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { sendEmail } from '@/lib/email';
import { buildVerificationEmail } from '@/lib/emails/templates';
import { siteUrl } from '@/lib/env';
import crypto from 'crypto';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const admin = createAdminClient();

    // Check if already verified
    const { data: profile } = await admin
      .from('profiles')
      .select('email_verified')
      .eq('id', user.id)
      .single();

    if (profile?.email_verified) {
      return NextResponse.json({ error: 'Email is already verified' }, { status: 400 });
    }

    // Generate new token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await admin.from('email_verification_tokens').insert({
      token,
      user_id: user.id,
      expires_at: expiresAt.toISOString(),
    });

    // Send email
    const verifyLink = `${siteUrl}/verify-email/${token}`;
    const result = await sendEmail({
      to: user.email!,
      subject: 'Verify your email - Tibera Health',
      html: buildVerificationEmail(verifyLink),
    });

    if (!result.success) {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[resend-verification] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
