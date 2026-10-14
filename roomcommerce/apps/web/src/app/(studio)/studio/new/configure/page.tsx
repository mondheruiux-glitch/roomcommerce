'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AdsStyleCardSelector,
  AdsBudgetSlider,
} from '@roomcommerce/ui';
import { StylePresetEnum } from '@roomcommerce/contracts';
import { useWizardStore } from '@/stores/use-wizard-store';
import { triggerRender } from '@/lib/api-client';

export default function ConfigurePage() {
  const router = useRouter();
  const {
    projectId,
    stylePreset,
    budgetCents,
    lockedAnchorCategories,
    setStylePreset,
    setBudgetCents,
  } = useWizardStore();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Guard: if no project ID yet, redirect back to upload
  React.useEffect(() => {
    if (!projectId) {
      router.replace('/studio/new/upload');
    }
  }, [projectId, router]);

  if (!projectId) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const { jobId } = await triggerRender(projectId, {
        stylePreset,
        roomFunction: 'LIVING_ROOM',
        budgetCents,
        lockedAnchorCategories,
      });

      const currentProjectId = projectId;
      router.push(`/studio/render/${jobId || currentProjectId}?project=${currentProjectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start render. Please try again.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* ── Wizard step indicator ────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-8" aria-label="Upload wizard — step 3 of 3">
        <StepBadge step={1} label="Upload" completed />
        <StepDivider />
        <StepBadge step={2} label="Review" completed />
        <StepDivider />
        <StepBadge step={3} label="Configure" active />
      </div>

      <h1 className="text-2xl font-bold text-ink-primary mb-2">Style & Budget</h1>
      <p className="text-ink-secondary text-sm mb-8">
        Choose the interior style and budget guardrail for your AI redesign.
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Style preset grid (FR-201) */}
        <section aria-labelledby="style-section-heading">
          <h2
            id="style-section-heading"
            className="text-sm font-semibold text-ink-primary uppercase tracking-wide mb-4"
          >
            Interior Style
          </h2>
          <AdsStyleCardSelector
            value={stylePreset as StylePresetEnum}
            onChange={(v: string) => setStylePreset(v as StylePresetEnum)}
          />
        </section>

        {/* Budget slider (FR-202) */}
        <section aria-labelledby="budget-section-heading">
          <h2
            id="budget-section-heading"
            className="text-sm font-semibold text-ink-primary uppercase tracking-wide mb-4"
          >
            Budget Guardrail
          </h2>
          <AdsBudgetSlider value={budgetCents} onChange={setBudgetCents} />
        </section>

        {error && (
          <p role="alert" className="text-sm text-status-danger font-medium">
            {error}
          </p>
        )}

        <button
          type="submit"
          id="configure-submit-btn"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="w-full py-3 rounded-lg bg-brand-terracotta text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-terracotta focus-visible:ring-offset-2"
        >
          {isSubmitting ? 'Starting render…' : 'Generate My Room →'}
        </button>
      </form>
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
              : 'bg-border-default text-ink-muted'
        }`}
        aria-current={active ? 'step' : undefined}
      >
        {completed ? '✓' : step}
      </span>
      <span className={`text-sm font-medium ${active || completed ? 'text-ink-primary' : 'text-ink-muted'}`}>
        {label}
      </span>
    </div>
  );
}

function StepDivider() {
  return <div className="flex-1 h-px bg-border-default mx-1" aria-hidden="true" />;
}
