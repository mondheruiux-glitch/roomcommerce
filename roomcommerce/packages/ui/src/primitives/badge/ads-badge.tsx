'use client';
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold leading-none tracking-wide select-none',
  {
    variants: {
      variant: {
        neutral: 'bg-bg-muted text-ink-secondary',
        success: 'bg-semantic-success-subtle text-semantic-success',
        warning: 'bg-semantic-warning-subtle text-semantic-warning',
        brand: 'bg-brand-terracotta-subtle text-brand-terracotta-hover',
        danger: 'bg-semantic-danger-subtle text-semantic-danger',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface AdsBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * AdsBadge — Pill-shaped metadata label.
 * Variants: neutral, success (In Stock), warning (Low Stock), brand (Match %), danger.
 */
export const AdsBadge = React.forwardRef<HTMLSpanElement, AdsBadgeProps>(
  ({ className, variant, children, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant, className }))} {...props}>
      {children}
    </span>
  ),
);

AdsBadge.displayName = 'AdsBadge';
