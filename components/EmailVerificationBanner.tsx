'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function EmailVerificationBanner() {
  const { user, emailVerified, isLoading } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);

  if (isLoading || !user || emailVerified || dismissed) return null;

  async function handleResend() {
    setResending(true);
    try {
      await fetch('/api/auth/resend-verification', { method: 'POST' });
      setSent(true);
    } catch {
      // Silently fail
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-200 flex items-center justify-between gap-4">
      <p>
        Please verify your email address.{' '}
        {sent ? (
          <span className="font-medium">Verification email sent!</span>
        ) : (
          <button
            onClick={handleResend}
            disabled={resending}
            className="font-medium underline hover:no-underline disabled:opacity-50"
          >
            {resending ? 'Sending...' : 'Resend verification email'}
          </button>
        )}
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
