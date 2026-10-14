'use client';
import * as React from 'react';
import { useCanvasStore } from '@/stores/use-canvas-store';
import { AdsCanvasHotspot } from '@roomcommerce/ui';

export interface HotspotPinData {
  id: string;
  normX: number;  // 0.0–1.0 horizontal position (FR-401)
  normY: number;  // 0.0–1.0 vertical position
  category: string;
  priceCents: number;
}

export interface InteractiveCanvasProps {
  /** Fully-qualified WebP/JPEG URL from Cloudflare R2 */
  renderedImageUrl: string;
  /** True for Free Tier — renders semi-transparent diagonal watermark (FR-503) */
  isWatermarked: boolean;
  /** Array of product hotspot pins from the API */
  hotspots: HotspotPinData[];
  className?: string;
}

/**
 * InteractiveCanvas — high-performance shoppable room render canvas (SCR-08).
 *
 * Accessibility note: `touch-action: none` via `data-canvas-viewport` prevents
 * mobile pull-to-refresh and native viewport zoom from interfering with
 * custom pan/zoom gestures (see globals.css).
 */
export function InteractiveCanvas({
  renderedImageUrl,
  isWatermarked,
  hotspots,
  className,
}: InteractiveCanvasProps) {
  const { showHotspots, selectedHotspotId, selectHotspot } = useCanvasStore();

  return (
    <div
      className={`relative w-full h-full overflow-hidden bg-bg-canvas flex items-center justify-center select-none ${className ?? ''}`}
      data-canvas-viewport
      role="region"
      aria-label="Shoppable room redesign canvas"
    >
      {/* ── Render Container ──────────────────────────────────────────── */}
      <div className="relative max-w-full max-h-full aspect-[4/3] shadow-xl rounded-lg overflow-hidden">
        {/* Room render — standard <img> avoids Next.js Image hydration lag (plan blocker B2) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={renderedImageUrl}
          alt="AI redesigned room concept"
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
        />

        {/* ── Free Tier Watermark (FR-503) ──────────────────────────── */}
        {isWatermarked && (
          <div
            className="absolute inset-0 pointer-events-none flex items-center justify-center"
            aria-hidden="true"
          >
            <span
              className="font-mono text-5xl font-bold uppercase tracking-widest text-ink-primary opacity-[0.12] rotate-[-28deg] whitespace-nowrap"
            >
              PROJECT ROOMCOMMERCE
            </span>
          </div>
        )}

        {/* ── Pulsing Hotspot Pins Layer ────────────────────────────── */}
        {showHotspots &&
          hotspots.map((pin) => (
            <AdsCanvasHotspot
              key={pin.id}
              id={pin.id}
              normX={pin.normX}
              normY={pin.normY}
              category={pin.category}
              priceCents={pin.priceCents}
              isSelected={selectedHotspotId === pin.id}
              onClick={(id: string) => selectHotspot(id)}
            />
          ))}
      </div>
    </div>
  );
}
