import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'RoomCommerce — AI Spatial Interior Redesign',
  description:
    'Upload a photo of your room and receive a photorealistic redesign with shoppable products from IKEA, Target, Wayfair, and Amazon.',
};

export default function LandingPage() {
  return (
    <main className="flex-1 flex flex-col">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center animate-fade-up">
        <span className="inline-block px-3 py-1 rounded-full bg-brand-terracotta-subtle text-brand-terracotta-hover text-xs font-semibold tracking-wide uppercase mb-6">
          AI Interior Redesign
        </span>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-ink-primary leading-tight max-w-3xl mb-6">
          Your Room,{' '}
          <span className="text-brand-terracotta">Redesigned</span> and
          Shoppable
        </h1>

        <p className="text-ink-secondary text-lg sm:text-xl max-w-2xl mb-10 leading-relaxed">
          Upload a photo of any room. Our AI renders a photorealistic redesign
          populated with real, in-stock furniture from IKEA, Target, Wayfair,
          and Amazon — every pin links straight to the product page.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/studio/new/upload"
            className="px-8 py-4 rounded-lg bg-brand-terracotta text-white font-semibold text-base hover:bg-brand-terracotta-hover transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta focus-visible:ring-offset-2"
            id="hero-upload-cta"
          >
            Upload Your Room →
          </Link>
          <Link
            href="/studio"
            className="px-8 py-4 rounded-lg border-2 border-border-strong text-ink-primary font-semibold text-base hover:bg-bg-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary focus-visible:ring-offset-2"
          >
            View My Projects
          </Link>
        </div>
      </section>

      {/* ── FTC Disclosure (BR-03) ────────────────────────────────────── */}
      <footer className="border-t border-border-default px-6 py-4 text-center">
        <p className="text-xs text-ink-muted max-w-2xl mx-auto">
          <strong>Affiliate Disclosure:</strong> RoomCommerce participates in
          affiliate programs with IKEA, Target, Wayfair, and Amazon. We may earn
          a commission on qualifying purchases at no extra cost to you. Product
          availability and pricing are verified at time of render but may change.
        </p>
      </footer>
    </main>
  );
}
