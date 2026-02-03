'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function VerifyEmailPage() {
  const params = useParams();
  const token = params.token as string;

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (!res.ok) {
          setStatus('error');
          setError(data.error || 'Verification failed');
          return;
        }

        setStatus('success');
      } catch {
        setStatus('error');
        setError('Something went wrong. Please try again.');
      }
    }

    verify();
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 text-center">
        <Loader2 className="w-10 h-10 text-slate-400 animate-spin mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Verifying your email...
        </h1>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 text-center">
        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Verification failed
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {error}
        </p>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-slate-900 dark:text-slate-200 hover:underline"
        >
          Go to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 text-center">
      <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
        Email verified
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Your email has been verified. You&apos;re all set!
      </p>
      <Link
        href="/dashboard"
        className="inline-block py-2.5 px-6 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold text-sm hover:bg-slate-800 dark:hover:bg-slate-200 transition"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
