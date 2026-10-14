'use client';
import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '../../lib/utils';

export interface AdsBudgetSliderProps {
  value: number; // in cents
  onChange: (valueCents: number) => void;
  minCents?: number; // default $300 (FR-202)
  maxCents?: number; // default $10,000
  stepCents?: number; // default $50 increments
  currency?: string;
  locale?: string;
  label?: string;
  className?: string;
}

/**
 * AdsBudgetSlider — Accessible room budget range slider (FR-202).
 * Wraps @radix-ui/react-slider.
 * Range: $300 – $10,000 USD. Step: $50.
 * Thumb touch hitbox: ≥48×48pt via negative margin trick (WCAG 2.1 AA).
 */
export function AdsBudgetSlider({
  value,
  onChange,
  minCents = 30_000,
  maxCents = 1_000_000,
  stepCents = 5_000,
  currency = 'USD',
  locale = 'en-US',
  label = 'Room Budget Guardrail',
  className,
}: AdsBudgetSliderProps) {
  const formattedValue = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value / 100);

  const formattedMin = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minCents / 100);

  const formattedMax = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(maxCents / 100);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-ink-primary">{label}</label>
        <span
          className="font-mono text-base font-semibold text-brand-terracotta tabular-nums"
          aria-live="polite"
          aria-atomic="true"
        >
          {formattedValue}
        </span>
      </div>

      <SliderPrimitive.Root
        className="relative flex items-center select-none touch-none w-full h-12"
        value={[value]}
        onValueChange={([val]) => val !== undefined && onChange(val)}
        min={minCents}
        max={maxCents}
        step={stepCents}
        aria-label={label}
      >
        <SliderPrimitive.Track className="bg-border-default relative grow rounded-full h-1.5 overflow-hidden">
          <SliderPrimitive.Range className="absolute bg-brand-terracotta h-full rounded-full" />
        </SliderPrimitive.Track>

        {/* Thumb — visual 24px, touch hitbox 48×48pt via negative margin */}
        <SliderPrimitive.Thumb
          className={cn(
            'block w-6 h-6 bg-bg-surface border-2 border-brand-terracotta rounded-full shadow-md',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary focus-visible:ring-offset-2',
            'transition-transform active:scale-110 cursor-grab active:cursor-grabbing',
            /* invisible touch area extension — -m-3 makes the effective hit area 48×48pt */
            '-m-3 p-3',
          )}
          aria-valuetext={formattedValue}
          data-testid="ads-budget-slider-thumb"
        />
      </SliderPrimitive.Root>

      <div className="flex justify-between text-xs font-mono text-ink-muted">
        <span>{formattedMin} min</span>
        <span>{formattedMax} max</span>
      </div>
    </div>
  );
}
