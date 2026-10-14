'use client';
import * as React from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { AdsProgressBar, type ProgressStage } from '@roomcommerce/ui';
import { usePipelineStream, type PipelinePhase } from '@/hooks/use-pipeline-stream';

const PHASE_LABELS: Record<PipelinePhase, string> = {
  QUEUED: 'Queued for rendering…',
  SANITIZATION: 'Scrubbing EXIF & blurring faces (privacy)…',
  DEPTH_ESTIMATION: 'Analyzing spatial perspective…',
  INPAINTING: 'Generating photorealistic redesign…',
  SEGMENTATION: 'Segmenting architectural & furniture assets…',
  CATALOG_MATCHING: 'Matching verified in-stock products…',
  COMPLETED: 'Render complete! Redirecting…',
  COMPLETE: 'Render complete! Redirecting…',
  FAILED: 'Generation interrupted.',
};

const PHASE_STAGE_MAP: Record<PipelinePhase, ProgressStage> = {
  QUEUED: 'QUEUED',
  SANITIZATION: 'SANITIZATION',
  DEPTH_ESTIMATION: 'DEPTH_ESTIMATION',
  INPAINTING: 'INPAINTING',
  SEGMENTATION: 'SEGMENTATION',
  CATALOG_MATCHING: 'CATALOG_MATCHING',
  COMPLETED: 'COMPLETED',
  COMPLETE: 'COMPLETED',
  FAILED: 'FAILED',
};

const PIPELINE_ORDER: PipelinePhase[] = [
  'QUEUED',
  'SANITIZATION',
  'DEPTH_ESTIMATION',
  'INPAINTING',
  'SEGMENTATION',
  'CATALOG_MATCHING',
  'COMPLETED',
];

interface RenderPageProps {
  params: Promise<{ job_id: string }>;
}

export default function RenderPage({ params }: RenderPageProps) {
  const { job_id } = use(params);
  const router = useRouter();
  const { progress, error, retry } = usePipelineStream(job_id);

  const activeStage = PHASE_STAGE_MAP[progress.phase] ?? 'QUEUED';
  const displayMessage = progress.message || PHASE_LABELS[progress.phase] || 'Processing…';

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <div className="mb-8">
        <span className="inline-block w-16 h-16 rounded-full bg-brand-terracotta-subtle flex items-center justify-center mx-auto mb-4">
          {/* Animated spinner */}
          <svg
            className="w-8 h-8 text-brand-terracotta animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </span>

        <h1 className="text-2xl font-bold text-ink-primary mb-2">
          Redesigning Your Room
        </h1>
        <p className="text-ink-secondary text-sm">
          This usually takes 45–90 seconds. You can safely leave this page and
          return to <em>My Rooms</em> — your render will complete in the background.
        </p>
      </div>

      {/* Error state */}
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-6 mb-6 text-left"
        >
          <p className="text-status-danger font-medium text-sm mb-4">{error}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={retry}
              className="px-5 py-2 rounded-lg bg-brand-terracotta text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Retry Connection
            </button>
            <button
              onClick={() => router.push('/studio')}
              className="px-4 py-2 rounded-lg border border-border-default text-ink-secondary text-sm hover:bg-bg-subtle transition-colors"
            >
              Return to Studio
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <AdsProgressBar
            value={progress.percent}
            stage={activeStage}
            message={displayMessage}
            aria-label={`Render pipeline: ${displayMessage}`}
          />

          {/* Phase steps */}
          <ol className="text-left space-y-2 mt-6" aria-label="Pipeline phases">
            {[
              'SANITIZATION',
              'DEPTH_ESTIMATION',
              'INPAINTING',
              'SEGMENTATION',
              'CATALOG_MATCHING',
            ].map((phaseStr, i) => {
              const phase = phaseStr as PipelinePhase;
              const currentPhaseNormalized =
                progress.phase === 'COMPLETE' ? 'COMPLETED' : progress.phase;
              const currentIdx = PIPELINE_ORDER.indexOf(currentPhaseNormalized);
              const phaseIdx = PIPELINE_ORDER.indexOf(phase);
              const isDone = currentIdx > phaseIdx || currentPhaseNormalized === 'COMPLETED';
              const isActive = currentIdx === phaseIdx;

              return (
                <li
                  key={phase}
                  className={`flex items-center gap-3 text-sm ${
                    isDone
                      ? 'text-status-success'
                      : isActive
                        ? 'text-ink-primary font-medium'
                        : 'text-ink-muted'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 text-xs font-bold border-current"
                  >
                    {isDone ? '✓' : i + 1}
                  </span>
                  {PHASE_LABELS[phase]}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <button
        onClick={() => router.push('/studio')}
        className="mt-8 text-sm text-ink-muted hover:text-ink-primary transition-colors underline underline-offset-2"
      >
        ← Back to My Rooms
      </button>
    </div>
  );
}
