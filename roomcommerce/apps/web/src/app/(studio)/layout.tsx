import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Studio',
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-bg-canvas">
      {/* ── Studio nav bar ─────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-40 border-b border-border-default bg-bg-surface/90 backdrop-blur-sm"
        aria-label="Studio navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-extrabold text-brand-terracotta-hover tracking-tight"
          >
            RoomCommerce
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/studio"
              className="text-sm font-medium text-ink-secondary hover:text-ink-primary transition-colors"
            >
              My Rooms
            </Link>
            <Link
              href="/studio/new/upload"
              className="px-4 py-1.5 rounded-lg bg-brand-terracotta text-white text-sm font-semibold hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta focus-visible:ring-offset-2"
            >
              New Room
            </Link>
            <Link
              href="/account"
              className="text-sm font-medium text-ink-muted hover:text-ink-primary transition-colors"
            >
              Account
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Page content ───────────────────────────────────────────────── */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
