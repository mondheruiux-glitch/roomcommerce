'use client';
import * as React from 'react';

export default function CheckoutPage() {
  const [isLoading, setIsLoading] = React.useState(false);

  async function handlePurchase() {
    setIsLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/billing/checkout-session`,
        { method: 'POST', credentials: 'include' },
      );
      const { sessionUrl } = await res.json();
      window.location.href = sessionUrl;
    } catch {
      alert('Could not initiate checkout. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-bg-surface rounded-2xl border border-border-default shadow-lg p-8 text-center">
        <span className="inline-block text-4xl mb-4" aria-hidden="true">🏠</span>
        <h1 className="text-2xl font-bold text-ink-primary mb-2">Move-In Pass</h1>
        <p className="text-ink-secondary text-sm mb-6">
          Unlock your full-resolution redesign, remove the watermark, and keep your
          rooms for 30 days — then download any time.
        </p>

        <div className="text-5xl font-extrabold text-brand-terracotta mb-1">$14.99</div>
        <p className="text-xs text-ink-muted mb-8">One-time payment · 30-day access</p>

        <ul className="text-left space-y-2 mb-8">
          {[
            '4K full-resolution render download',
            'Watermark removed',
            '30-day project storage',
            'Shoppable pins with verified prices',
          ].map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm text-ink-primary">
              <span className="text-status-success font-bold" aria-hidden="true">✓</span>
              {feature}
            </li>
          ))}
        </ul>

        <button
          id="checkout-purchase-btn"
          onClick={handlePurchase}
          disabled={isLoading}
          aria-busy={isLoading}
          className="w-full py-3 rounded-xl bg-brand-terracotta text-white font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta focus-visible:ring-offset-2"
        >
          {isLoading ? 'Redirecting to Stripe…' : 'Purchase Now →'}
        </button>

        {/* FTC disclosure (BR-03) */}
        <p className="text-xs text-ink-muted mt-4">
          Secure payment via Stripe. You'll be redirected to Stripe Checkout.
          Product links are affiliate — we may earn a commission.
        </p>
      </div>
    </div>
  );
}
