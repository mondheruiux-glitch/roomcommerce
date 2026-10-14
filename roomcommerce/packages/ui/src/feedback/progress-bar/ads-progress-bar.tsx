import * as React from 'react';
import { cn } from '../../lib/utils';

export type ProgressStage =
  | 'QUEUED'
  | 'SANITIZATION'
  | 'DEPTH_ESTIMATION'
  | 'INPAINTING'
  | 'SEGMENTATION'
  | 'CATALOG_MATCHING'
  | 'COMPLETED'
  | 'FAILED';

const STAGE_LABELS: Record<ProgressStage, string> = {
  QUEUED: 'Queued',
  SANITIZATION: 'Privacy scan',
  DEPTH_ESTIMATION: 'Depth mapping',
  INPAINTING: 'Style synthesis',
  SEGMENTATION: 'Object detection',
  CATALOG_MATCHING: 'Matching catalog',
  COMPLETED: 'Complete',
  FAILED: 'Failed',
};

export interface AdsProgressBarProps {
  value: number; // 0–100
  stage?: ProgressStage;
  message?: string;
  className?: string;
}

/**
 * AdsProgressBar — Phased linear SSE progress indicator.
 * WCAG: role="progressbar", aria-live="polite" for screen reader announcements.
 * Smooth CSS transitions matching SSE stage intervals.
 */
export function AdsProgressBar({ value, stage, message, className }: AdsProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const isFailed = stage === 'FAILED';

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-xs">
        {stage && (
          <span className={cn('font-medium', isFailed ? 'text-semantic-danger' : 'text-ink-secondary')}>
            {STAGE_LABELS[stage]}
          </span>
        )}
        <span
          className="font-mono tabular-nums text-ink-muted ml-auto"
          aria-hidden="true"
        >
          {clampedValue}%
        </span>
      </div>

      <div className="h-1.5 w-full bg-border-default rounded-full overflow-hidden">
        <div
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={stage ? `${STAGE_LABELS[stage]}: ${clampedValue}%` : `${clampedValue}%`}
          aria-live="polite"
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            isFailed ? 'bg-semantic-danger' : 'bg-brand-terracotta',
          )}
          style={{ width: `${clampedValue}%` }}
        />
      </div>

      {message && (
        <p className="text-xs text-ink-muted leading-snug" aria-live="polite" aria-atomic="true">
          {message}
        </p>
      )}
    </div>
  );
}
