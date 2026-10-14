'use client';
import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { requestMagicLink, verifyMagicLink } from '@/lib/api-client';

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const next = searchParams.get('next') ?? '/studio';

  const [email, setEmail] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [isError, setIsError] = React.useState(false);

  // Auto-verify token from magic link query string
  React.useEffect(() => {
    if (!token) return;

    let isMounted = true;
    setIsLoading(true);
    setStatusMessage('Verifying your magic link…');

    verifyMagicLink(token)
      .then(() => {
        if (!isMounted) return;
        setStatusMessage('Verified! Redirecting to studio…');
        setTimeout(() => {
          router.push(next);
        }, 600);
      })
      .catch((err) => {
        if (!isMounted) return;
        setIsError(true);
        setStatusMessage(
          err instanceof Error
            ? err.message
            : 'Magic link verification failed or link expired.',
        );
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, next, router]);

  async function handleMagicLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || isLoading) return;

    setIsLoading(true);
    setIsError(false);
    setStatusMessage(null);

    try {
      const res = await requestMagicLink(email);
      setStatusMessage(res.message || `Magic link sent to ${email}. Check your inbox!`);
    } catch (err) {
      setIsError(true);
      setStatusMessage(err instanceof Error ? err.message : 'Failed to send magic link.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div
      className="bg-bg-surface rounded-xl border border-border-default shadow-sm p-8"
      role="main"
    >
      <h1 className="text-xl font-bold text-ink-primary mb-2">Welcome back</h1>
      <p className="text-ink-secondary text-sm mb-6">
        Sign in to access your AI-redesigned rooms and shoppable projects.
      </p>

      {statusMessage && (
        <div
          role="alert"
          className={`mb-6 p-4 rounded-lg text-sm font-medium ${
            isError
              ? 'bg-status-danger/10 text-status-danger border border-status-danger/20'
              : 'bg-status-success/10 text-status-success border border-status-success/20'
          }`}
        >
          {statusMessage}
        </div>
      )}

      {/* Magic link form */}
      <form className="space-y-4" onSubmit={handleMagicLinkSubmit}>
        <div>
          <label
            htmlFor="auth-email"
            className="block text-sm font-medium text-ink-primary mb-1.5"
          >
            Email address
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            placeholder="you@example.com"
            disabled={isLoading}
            className="w-full px-3.5 py-2.5 rounded-lg border border-border-default bg-bg-surface text-ink-primary placeholder:text-ink-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-terracotta focus:border-transparent disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          id="auth-magic-link-btn"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-lg bg-brand-terracotta text-white font-semibold text-sm hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {isLoading ? 'Processing…' : 'Send Magic Link'}
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border-default" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-bg-surface px-2 text-ink-muted font-medium">or</span>
        </div>
      </div>

      {/* Social OAuth */}
      <div className="space-y-2">
        <a
          href="/api/auth/google"
          id="auth-google-btn"
          className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg border border-border-default text-ink-primary font-medium text-sm hover:bg-bg-subtle transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </a>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-sm text-ink-muted">Loading…</div>}>
      <AuthContent />
    </React.Suspense>
  );
}
