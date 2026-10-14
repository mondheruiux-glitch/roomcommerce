'use client';
import * as React from 'react';
import { cn } from '../../lib/utils';

export interface AdsCanvasHotspotProps {
  id: string;
  /** Normalized horizontal position 0.0–1.0 (FR-401) */
  normX: number;
  /** Normalized vertical position 0.0–1.0 (FR-401) */
  normY: number;
  category: string;
  priceCents: number;
  isSelected?: boolean;
  onClick: (id: string) => void;
  className?: string;
}

/**
 * AdsCanvasHotspot — Spatial coordinate pin for the rendered room canvas (FR-401, SCR-08).
 *
 * Positioning: absolute, via `left: normX * 100%` / `top: normY * 100%`.
 * Normalized coords are clamped [0.04, 0.96] to prevent edge clipping.
 *
 * Visual geometry:
 *   Idle:     8px terracotta core · 28px white-bordered ring · 2400ms ping pulse
 *   Hover:    ring expands to 32px · mini retailer + price tooltip appears
 *   Selected: 36px ring · charcoal (#1A1917) border · white center dot
 *
 * Touch hitbox: 48×48pt invisible button wrapper (WCAG 2.1 AA).
 */
export function AdsCanvasHotspot({
  id,
  normX,
  normY,
  category,
  priceCents,
  isSelected = false,
  onClick,
  className,
}: AdsCanvasHotspotProps) {
  // Clamp to [0.04, 0.96] to prevent edge clipping (plan blocker resolution)
  const clampedX = Math.min(Math.max(normX, 0.04), 0.96);
  const clampedY = Math.min(Math.max(normY, 0.04), 0.96);

  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(priceCents / 100);

  return (
    <div
      style={{
        left: `${clampedX * 100}%`,
        top: `${clampedY * 100}%`,
      }}
      className={cn('absolute -translate-x-1/2 -translate-y-1/2 group z-20', className)}
    >
      {/* 48×48pt touch hitbox button (WCAG 2.1 AA) */}
      <button
        type="button"
        onClick={() => onClick(id)}
        className={cn(
          'relative w-12 h-12 flex items-center justify-center',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary focus-visible:ring-offset-2 rounded-full',
        )}
        aria-label={`View ${category.replace(/_/g, ' ')} priced at ${formattedPrice}`}
        aria-pressed={isSelected}
        data-testid={category.toLowerCase() === 'sofa' || id === 'sofa' ? 'hotspot-sofa' : `hotspot-pin-${id}`}
      >
        {/* 2400ms ping pulse — idle only */}
        {!isSelected && (
          <span
            className="absolute w-7 h-7 rounded-full bg-brand-terracotta/35 animate-[ping_2.4s_cubic-bezier(0,0,0.2,1)_infinite] pointer-events-none"
            aria-hidden="true"
          />
        )}

        {/* Outer ring */}
        <span
          className={cn(
            'relative flex items-center justify-center rounded-full transition-all duration-200 ease-out shadow-hotspot',
            isSelected
              ? 'w-9 h-9 bg-bg-surface border-2 border-ink-primary'
              : 'w-7 h-7 bg-bg-surface/90 border border-white group-hover:w-8 group-hover:h-8',
          )}
          aria-hidden="true"
        >
          {/* Inner core dot */}
          <span
            className={cn(
              'rounded-full transition-all duration-150',
              isSelected
                ? 'w-3 h-3 bg-bg-surface border-2 border-ink-primary'
                : 'w-2 h-2 bg-brand-terracotta group-hover:w-2.5 group-hover:h-2.5',
            )}
          />
        </span>
      </button>

      {/* Desktop hover micro-tooltip */}
      <div
        className={cn(
          'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 pointer-events-none',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-150 scale-95 group-hover:scale-100',
        )}
        aria-hidden="true"
      >
        <div className="bg-ink-primary text-ink-inverted px-2.5 py-1.5 rounded-sm text-xs font-mono whitespace-nowrap shadow-lg flex items-center gap-2">
          <span className="capitalize">{category.replace(/_/g, ' ')}</span>
          <span className="text-brand-terracotta font-semibold">{formattedPrice}</span>
        </div>
        {/* Tooltip caret */}
        <div className="w-2 h-2 bg-ink-primary rotate-45 mx-auto -mt-1" />
      </div>
    </div>
  );
}
