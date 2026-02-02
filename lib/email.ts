import { resendApiKey, emailFrom } from '@/lib/env';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!resendApiKey) {
    if (isProduction) {
      return { success: false, error: 'RESEND_API_KEY is not set' };
    }
    console.log('[email:dry-run]', { to, subject });
    console.log(html);
    return { success: true };
  }

  let res: Response;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to,
        subject,
        html,
      }),
    });
  } catch (err) {
    console.error('[email:error] network error:', err);
    return { success: false, error: 'Email send failed: network error' };
  }

  if (!res.ok) {
    const body = await res.text();
    console.error('[email:error]', res.status, body);
    return { success: false, error: `Email send failed: ${res.status}` };
  }

  return { success: true };
}
