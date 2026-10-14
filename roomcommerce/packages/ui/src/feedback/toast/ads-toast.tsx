'use client';
import * as React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, X, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

export interface AdsToastProps {
  variant?: ToastVariant;
  title: string;
  description?: string;
  onDismiss?: () => void;
  duration?: number; // ms — 0 = persistent
  className?: string;
}

const ICONS: Record<ToastVariant, React.ElementType> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
};

const ICON_CLASSES: Record<ToastVariant, string> = {
  success: 'text-semantic-success',
  warning: 'text-semantic-warning',
  error: 'text-semantic-danger',
  info: 'text-semantic-info',
};

const BORDER_CLASSES: Record<ToastVariant, string> = {
  success: 'border-l-semantic-success',
  warning: 'border-l-semantic-warning',
  error: 'border-l-semantic-danger',
  info: 'border-l-semantic-info',
};

/**
 * AdsToast — Non-blocking status notification.
 * WCAG: role="status" (non-intrusive) or role="alert" (urgent).
 * Auto-dismisses after `duration` ms (default 4000). duration=0 = persistent.
 */
export function AdsToast({
  variant = 'info',
  title,
  description,
  onDismiss,
  duration = 4000,
  className,
}: AdsToastProps) {
  const Icon = ICONS[variant];
  const isUrgent = variant === 'error';

  // Auto-dismiss
  React.useEffect(() => {
    if (duration === 0 || !onDismiss) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);

  return (
    <div
      role={isUrgent ? 'alert' : 'status'}
      aria-live={isUrgent ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={cn(
        'relative flex items-start gap-3 rounded-md border border-border-default border-l-4 bg-bg-surface p-4 shadow-md',
        'min-w-[280px] max-w-[420px]',
        BORDER_CLASSES[variant],
        className,
      )}
    >
      <Icon className={cn('w-5 h-5 mt-0.5 shrink-0', ICON_CLASSES[variant])} aria-hidden="true" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink-primary">{title}</p>
        {description && (
          <p className="mt-0.5 text-xs text-ink-muted leading-snug">{description}</p>
        )}
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className={cn(
            'shrink-0 p-1 rounded-sm text-ink-muted hover:text-ink-primary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary',
            'transition-colors duration-150',
          )}
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
