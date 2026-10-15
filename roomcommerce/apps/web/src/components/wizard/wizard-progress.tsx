'use client';
/**
 * WizardProgress — shared multi-step wizard progress indicator.
 *
 * Renders numbered step badges connected by dividers, supporting three states:
 * - completed: green check ✓ (all prior steps)
 * - active: terracotta fill (current step, aria-current="step")
 * - pending: muted border (future steps)
 *
 * Usage:
 *   <WizardProgress currentStep={2} steps={['Upload', 'Review', 'Configure']} />
 */

import * as React from 'react';

export interface WizardProgressProps {
  /** 1-indexed current step (1 = first step) */
  currentStep: number;
  /** Ordered list of step label strings */
  steps: string[];
  /** Optional aria-label for the containing nav. Defaults to "Wizard progress" */
  ariaLabel?: string;
}

export function WizardProgress({ currentStep, steps, ariaLabel }: WizardProgressProps) {
  return (
    <nav
      aria-label={ariaLabel ?? 'Wizard progress'}
      className="flex items-center gap-2 mb-8"
    >
      {steps.map((label, idx) => {
        const stepNumber = idx + 1;
        const isCompleted = stepNumber < currentStep;
        const isActive = stepNumber === currentStep;

        return (
          <React.Fragment key={label}>
            {/* Step badge */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={[
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  isCompleted
                    ? 'bg-status-success text-white'
                    : isActive
                      ? 'bg-brand-terracotta text-white'
                      : 'border border-border-default text-ink-muted bg-bg-surface',
                ].join(' ')}
                aria-current={isActive ? 'step' : undefined}
              >
                {isCompleted ? (
                  <svg
                    viewBox="0 0 12 12"
                    className="w-3.5 h-3.5"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 6.5l2.5 2.5 5.5-5.5"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  stepNumber
                )}
              </span>
              <span
                className={[
                  'text-xs font-medium transition-colors',
                  isActive
                    ? 'text-ink-primary font-semibold'
                    : isCompleted
                      ? 'text-ink-secondary'
                      : 'text-ink-muted',
                ].join(' ')}
              >
                {label}
              </span>
            </div>

            {/* Divider — rendered between every pair of steps */}
            {idx < steps.length - 1 && (
              <div
                className={[
                  'flex-1 h-px transition-colors',
                  isCompleted ? 'bg-status-success/40' : 'bg-border-default',
                ].join(' ')}
                aria-hidden="true"
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
