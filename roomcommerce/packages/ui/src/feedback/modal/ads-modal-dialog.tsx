'use client';
import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface AdsModalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Controls width — default centered dialog on desktop, bottom sheet on mobile */
  className?: string;
  showClose?: boolean;
}

/**
 * AdsModalDialog — Accessible modal built on @radix-ui/react-dialog.
 * Features: focus trapping, Escape dismissal, ARIA-labeled by title,
 * blurred backdrop overlay (rgba(26,25,23,0.45) + blur(4px)).
 * Responsive: Centered 560px on desktop → bottom sheet on mobile.
 */
export function AdsModalDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  showClose = true,
}: AdsModalDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Backdrop overlay */}
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-50',
            'bg-bg-overlay backdrop-blur-[4px]',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        />

        {/* Dialog panel */}
        <Dialog.Content
          className={cn(
            'fixed z-50 bg-bg-surface shadow-xl focus:outline-none',
            // Desktop: centered 560px modal
            'sm:left-[50%] sm:top-[50%] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[560px] sm:rounded-lg sm:border sm:border-border-default',
            // Mobile: bottom sheet
            'max-sm:left-0 max-sm:right-0 max-sm:bottom-0 max-sm:rounded-t-xl max-sm:w-full',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95',
            'max-sm:data-[state=closed]:slide-out-to-bottom max-sm:data-[state=open]:slide-in-from-bottom',
            'duration-200',
            className,
          )}
          aria-describedby={description ? 'ads-modal-description' : undefined}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-border-default">
            <div>
              <Dialog.Title className="text-base font-semibold text-ink-primary leading-tight">
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description
                  id="ads-modal-description"
                  className="mt-1 text-sm text-ink-muted"
                >
                  {description}
                </Dialog.Description>
              )}
            </div>
            {showClose && (
              <Dialog.Close
                className={cn(
                  'ml-4 p-2 rounded-sm text-ink-muted hover:text-ink-primary shrink-0',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary',
                  'transition-colors duration-150',
                )}
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </Dialog.Close>
            )}
          </div>

          {/* Content slot */}
          <div className="p-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Re-export Trigger for convenience
export const AdsModalTrigger = Dialog.Trigger;
