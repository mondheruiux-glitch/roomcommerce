'use client';
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAccount, triggerHardPurge } from '@/lib/api-client';

function formatCountdown(expiresAt: string | null): string {
  if (!expiresAt) return '—';
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return days > 0 ? `${days}d ${hours}h remaining` : `${hours}h remaining`;
}

export default function AccountPage() {
  const [isPurging, setIsPurging] = React.useState(false);

  const { data: account, isLoading, isError } = useQuery({
    queryKey: ['account'],
    queryFn: fetchAccount,
  });

  async function handleHardPurge() {
    const confirmed = window.confirm(
      'Are you sure you want to permanently delete ALL your rooms, photos, and project history?\n\nThis action is immediate and cannot be undone.',
    );
    if (!confirmed) return;

    setIsPurging(true);
    try {
      await triggerHardPurge();
      window.location.href = '/';
    } catch {
      alert('Purge failed. Please contact support at privacy@roomcommerce.com');
      setIsPurging(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-ink-primary mb-8">Account Settings</h1>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-bg-subtle animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-status-danger text-sm">Failed to load account. Please refresh.</p>
      )}

      {account && (
        <div className="space-y-6">
          {/* Account info */}
          <section className="bg-bg-surface rounded-xl border border-border-default p-6">
            <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-4">
              Account
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-ink-secondary">Email</span>
                <span className="text-ink-primary font-medium font-mono">{account.email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-secondary">Member since</span>
                <span className="text-ink-primary font-medium">
                  {new Date(account.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </section>

          {/* Move-In Pass status */}
          <section className="bg-bg-surface rounded-xl border border-border-default p-6">
            <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-4">
              Move-In Pass
            </h2>
            {account.hasActivePlan ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-status-success font-bold text-lg">●</span>
                  <span className="text-ink-primary font-semibold">Active</span>
                </div>
                <p className="text-sm text-ink-secondary">
                  {formatCountdown(account.planExpiresAt)}
                </p>
                <p className="text-xs text-ink-muted">
                  Your renders are stored indefinitely until your pass expires.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-ink-secondary text-sm mb-4">
                  Unlock full-resolution renders and 30-day storage for $14.99.
                </p>
                <a
                  href="/checkout"
                  className="inline-block px-5 py-2 rounded-lg bg-brand-terracotta text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Get Move-In Pass →
                </a>
              </div>
            )}
          </section>

          {/* Privacy / Data deletion (PRV-02) */}
          <section className="bg-bg-surface rounded-xl border border-status-danger/20 p-6">
            <h2 className="text-sm font-semibold text-status-danger uppercase tracking-wide mb-2">
              Data Deletion
            </h2>
            <p className="text-ink-secondary text-sm mb-4">
              Permanently erase all your rooms, uploaded photos, render outputs, and personal
              data from RoomCommerce servers. This cannot be undone.
            </p>
            <button
              id="account-purge-btn"
              onClick={handleHardPurge}
              disabled={isPurging}
              aria-busy={isPurging}
              className="px-5 py-2 rounded-lg border-2 border-status-danger text-status-danger text-sm font-semibold hover:bg-status-danger hover:text-white transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-danger focus-visible:ring-offset-2"
            >
              {isPurging ? 'Deleting…' : '🗑 Delete All My Data'}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
