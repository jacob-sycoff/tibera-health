import { supportEmail } from '@/lib/env';

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tibera Health</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #f1f5f9;">
              <span style="font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.3px;">Tibera Health</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
                If you didn&rsquo;t request this email, you can safely ignore it.<br />
                Need help? Contact <a href="mailto:${supportEmail}" style="color:#64748b;">${supportEmail}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
  <tr>
    <td style="background-color:#0f172a;border-radius:8px;">
      <a href="${href}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

export function buildVerificationEmail(link: string): string {
  return layout(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;">Verify your email</h1>
    <p style="margin:0 0 8px;font-size:15px;color:#475569;line-height:1.6;">
      Thanks for signing up for Tibera Health. Click the button below to verify your email address.
    </p>
    ${button(link, 'Verify Email')}
    <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
      Or copy and paste this link:<br />
      <a href="${link}" style="color:#64748b;word-break:break-all;">${link}</a>
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">
      This link expires in 24 hours.
    </p>
  `);
}

export function buildPasswordResetEmail(link: string, name?: string): string {
  const greeting = name ? `Hi ${name},` : 'Hi,';
  return layout(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;color:#0f172a;">Reset your password</h1>
    <p style="margin:0 0 8px;font-size:15px;color:#475569;line-height:1.6;">
      ${greeting} we received a request to reset your password. Click the button below to choose a new one.
    </p>
    ${button(link, 'Reset Password')}
    <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.5;">
      Or copy and paste this link:<br />
      <a href="${link}" style="color:#64748b;word-break:break-all;">${link}</a>
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">
      This link expires in 1 hour. If you didn&rsquo;t request a password reset, you can ignore this email.
    </p>
  `);
}
