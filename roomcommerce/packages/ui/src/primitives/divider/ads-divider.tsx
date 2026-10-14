import * as React from 'react';
import { cn } from '../../lib/utils';

export interface AdsDividerProps extends React.HTMLAttributes<HTMLHRElement> {
  strength?: 'subtle' | 'strong';
}

/**
 * AdsDivider — Architectural structural separator.
 * Hidden from assistive technology via aria-hidden.
 * subtle: #E6E2DC (border-default), strong: #D6D1CA (border-strong).
 */
export const AdsDivider = React.forwardRef<HTMLHRElement, AdsDividerProps>(
  ({ className, strength = 'subtle', ...props }, ref) => (
    <hr
      ref={ref}
      aria-hidden="true"
      className={cn(
        'border-0 border-t',
        strength === 'subtle' ? 'border-border-default' : 'border-border-strong',
        className,
      )}
      {...props}
    />
  ),
);

AdsDivider.displayName = 'AdsDivider';
