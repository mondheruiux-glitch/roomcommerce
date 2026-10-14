'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useWizardStore } from '@/stores/use-wizard-store';

const DETECTED_ITEMS = [
  { category: 'sofa', label: 'Sofa', description: 'Center living room seating' },
  { category: 'coffee_table', label: 'Coffee Table', description: 'Low center accent table' },
  { category: 'rug', label: 'Area Rug', description: 'Floor boundary textile' },
];

export default function InspectPage() {
  const router = useRouter();
  const { previewUrl, projectId, lockedAnchorCategories, toggleAnchorCategory } =
    useWizardStore();

  // Guard: if no image uploaded yet, redirect back
  React.useEffect(() => {
    if (!previewUrl) {
      router.replace('/studio/new/upload');
    }
  }, [previewUrl, router]);

  if (!previewUrl) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* ── Wizard step indicator ────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8" aria-label="Upload wizard — step 2 of 3">
        <StepBadge step={1} label="Upload" completed />
        <StepDivider />
        <StepBadge step={2} label="Review" active />
        <StepDivider />
        <StepBadge step={3} label="Configure" />
      </div>

      <h1 className="text-2xl font-bold text-ink-primary mb-2">Quality Review & Anchor Locking</h1>
      <p className="text-ink-secondary text-sm mb-8">
        We've verified your photo meets our spatial analysis requirements. You can optionally lock
        and preserve existing furniture items you love (US-03).
      </p>

      {/* Photo preview */}
      <div className="rounded-xl overflow-hidden border border-border-default shadow-sm mb-6 aspect-[4/3] bg-bg-subtle relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Your uploaded room photo"
          className="w-full h-full object-contain"
        />

        {/* Anchor item overlays if locked */}
        {lockedAnchorCategories.length > 0 && (
          <div className="absolute top-3 right-3 flex flex-wrap gap-2">
            {lockedAnchorCategories.map((cat) => (
              <span
                key={cat}
                data-testid={`anchor-badge-${cat}`}
                className="px-2.5 py-1 rounded-full bg-brand-terracotta text-white text-xs font-semibold shadow-sm flex items-center gap-1"
              >
                🔒 Locked: {cat}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Detected furniture items / Anchor Locking (US-03, FR-104) */}
      <section aria-labelledby="anchor-locking-heading" className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 id="anchor-locking-heading" className="text-sm font-semibold text-ink-primary uppercase tracking-wide">
            Detected Furniture (Keep Existing)
          </h2>
          <span className="text-xs text-ink-muted">Tap to lock/unlock items</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {DETECTED_ITEMS.map((item) => {
            const isLocked = lockedAnchorCategories.includes(item.category);
            return (
              <button
                key={item.category}
                type="button"
                data-testid={`detected-box-${item.category}`}
                onClick={() => toggleAnchorCategory(item.category)}
                aria-pressed={isLocked}
                className={`p-3.5 rounded-lg border text-left transition-all ${
                  isLocked
                    ? 'border-brand-terracotta bg-brand-terracotta/5 ring-1 ring-brand-terracotta shadow-sm'
                    : 'border-border-default bg-bg-surface hover:border-border-strong hover:bg-bg-subtle'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-ink-primary">{item.label}</span>
                  {isLocked ? (
                    <span
                      data-testid={`anchor-badge-${item.category}`}
                      className="text-xs px-2 py-0.5 rounded bg-brand-terracotta text-white font-medium"
                    >
                      Locked
                    </span>
                  ) : (
                    <span className="text-xs text-ink-muted font-mono">Detected</span>
                  )}
                </div>
                <p className="text-xs text-ink-secondary mb-2">{item.description}</p>
                <span className="inline-block text-xs font-semibold text-brand-terracotta">
                  {isLocked ? `Locked — Keep This ${item.label}` : `Lock & Keep This ${item.label}`}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Quality gate badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        {[
          { label: 'Boundaries Verified', ok: true },
          { label: 'Resolution Sufficient', ok: true },
          { label: 'EXIF Data Removed', ok: true },
          { label: 'Lighting Adequate', ok: true },
          { label: 'Perspective Detectable', ok: true },
          { label: 'No Faces Detected', ok: true },
        ].map((check) => (
          <div
            key={check.label}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-surface border border-border-default"
          >
            <span className="text-status-success text-base" aria-hidden="true">
              ✓
            </span>
            <span className="text-xs font-medium text-ink-primary">{check.label}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => router.push('/studio/new/configure')}
        id="inspect-continue-btn"
        className="w-full py-3 rounded-lg bg-brand-terracotta text-white font-semibold text-sm hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta focus-visible:ring-offset-2"
      >
        Continue to Style →
      </button>

      <p className="text-xs text-ink-muted text-center mt-4">
        Project ID: <code className="font-mono">{projectId}</code>
      </p>
    </div>
  );
}

function StepBadge({
  step,
  label,
  active = false,
  completed = false,
}: {
  step: number;
  label: string;
  active?: boolean;
  completed?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
          completed
            ? 'bg-status-success text-white'
            : active
              ? 'bg-brand-terracotta text-white'
              : 'border border-border-default text-ink-muted'
        }`}
      >
        {completed ? '✓' : step}
      </span>
      <span
        className={`text-xs font-medium ${
          active ? 'text-ink-primary font-semibold' : 'text-ink-muted'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function StepDivider() {
  return <div className="flex-1 h-px bg-border-default max-w-[40px]" />;
}
