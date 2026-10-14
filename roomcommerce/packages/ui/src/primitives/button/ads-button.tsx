'use client';
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center font-medium transition-all duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]',
    'cursor-pointer',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-brand-terracotta text-ink-inverted hover:bg-brand-terracotta-hover focus-visible:ring-ink-primary shadow-sm',
        secondary:
          'bg-bg-surface text-ink-primary border border-border-default hover:bg-bg-subtle focus-visible:ring-ink-primary',
        ghost:
          'text-ink-secondary hover:text-ink-primary hover:bg-bg-subtle focus-visible:ring-ink-primary',
        danger:
          'bg-bg-surface text-semantic-danger border border-semantic-danger hover:bg-semantic-danger-subtle focus-visible:ring-semantic-danger',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-sm gap-1.5',
        md: 'h-10 px-4 text-sm rounded-md gap-2',
        lg: 'h-12 px-6 text-base rounded-md gap-2.5 min-h-[48px]', // WCAG AA touch target
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface AdsButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

/**
 * AdsButton — Primary interactive element for the Atelier Design System.
 *
 * Variants: primary (terracotta), secondary (bordered), ghost, danger.
 * Sizes: sm (h-8), md (h-10), lg (h-12, WCAG 48pt min touch target).
 * States: isLoading (aria-busy + spinner), disabled, active scale.
 */
export const AdsButton = React.forwardRef<HTMLButtonElement, AdsButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading && (
        <Loader2
          className="w-4 h-4 mr-2 animate-spin shrink-0"
          aria-hidden="true"
          data-testid="ads-button-spinner"
        />
      )}
      {children}
    </button>
  ),
);

AdsButton.displayName = 'AdsButton';
