'use client';

import { useState } from 'react';
import { Mail } from 'lucide-react';

export default function ConfirmEmailPage() {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');

  async function handleResend() {
    setResending(true);
    setError('');

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to resend');
        return;
      }

      setResent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 text-center">
      <div className="flex justify-center mb-4">
        <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <Mail className="w-7 h-7 text-slate-600 dark:text-slate-400" />
        </div>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        Check your email
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        We sent you a verification link. Click the link in the email to verify your account.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {resent ? (
        <p className="text-sm text-green-600 dark:text-green-400">
          Verification email sent! Check your inbox.
        </p>
      ) : (
        <button
          onClick={handleResend}
          disabled={resending}
          className="text-sm font-medium text-slate-900 dark:text-slate-200 hover:underline disabled:opacity-50"
        >
          {resending ? 'Sending...' : "Didn't receive the email? Resend"}
        </button>
      )}
    </div>
  );
}
