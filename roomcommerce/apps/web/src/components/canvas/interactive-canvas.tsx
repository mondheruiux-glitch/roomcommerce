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
  /** Optional original/pre-renovation room photo URL before AI redesign */
  rawImageUrl?: string | null;
  /** True for Free Tier — renders semi-transparent diagonal watermark (FR-503) */
  isWatermarked: boolean;
  /** Array of product hotspot pins from the API */
  hotspots: HotspotPinData[];
  className?: string;
}

const DEFAULT_BEFORE_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" fill="none">
      <rect width="1200" height="900" fill="#E8E4DF"/>
      <defs>
        <pattern id="archgrid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#D3CDC4" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="1200" height="900" fill="url(#archgrid)"/>
      <path d="M 120 780 L 320 220 L 880 220 L 1080 780 Z" stroke="#B3A99B" stroke-width="2.5" stroke-dasharray="6 6" fill="none"/>
      <path d="M 320 220 L 320 780 M 880 220 L 880 780" stroke="#B3A99B" stroke-width="2.5" stroke-dasharray="6 6"/>
      <rect x="380" y="520" width="440" height="200" rx="10" stroke="#9C9181" stroke-width="3" fill="#DDD7CE"/>
      <text x="600" y="615" text-anchor="middle" font-family="monospace" font-size="22" font-weight="bold" fill="#6A6052" letter-spacing="2">ORIGINAL ROOM GEOMETRY</text>
      <text x="600" y="650" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="500" fill="#84796B">Pre-renovation reference space</text>
    </svg>
  `);

/**
 * InteractiveCanvas — high-performance shoppable room render canvas (SCR-08).
 *
 * Supports:
 * - High-res AI redesigned room rendering
 * - Split-Screen "Before / After" comparison curtain slider with accessible scrubbing
 * - Contextual product hotspot pins with real-time price updates
 * - Free-tier watermark overlay
 */
export function InteractiveCanvas({
  renderedImageUrl,
  rawImageUrl,
  isWatermarked,
  hotspots,
  className,
}: InteractiveCanvasProps) {
  const {
    showHotspots,
    selectedHotspotId,
    selectHotspot,
    isCompareMode,
    compareSliderPosition,
    setCompareSliderPosition,
  } = useCanvasStore();

  const beforeImageSrc = rawImageUrl || DEFAULT_BEFORE_PLACEHOLDER;

  return (
    <div
      className={`relative w-full h-full overflow-hidden bg-bg-canvas flex items-center justify-center select-none ${className ?? ''}`}
      data-canvas-viewport
      role="region"
      aria-label="Shoppable room redesign canvas"
    >
      {/* ── Render Container ──────────────────────────────────────────── */}
      <div className="relative max-w-full max-h-full aspect-[4/3] shadow-xl rounded-lg overflow-hidden bg-bg-subtle">
        {/* "After" AI redesigned room layer */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={renderedImageUrl}
          alt="AI redesigned room concept"
          className="w-full h-full object-contain pointer-events-none"
          draggable={false}
        />

        {/* ── Split-Screen "Before" Curtain Overlay ─────────────────────── */}
        {isCompareMode && (
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none z-10"
            style={{
              clipPath: `inset(0 ${100 - compareSliderPosition}% 0 0)`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={beforeImageSrc}
              alt="Original room photo before redesign"
              className="w-full h-full object-contain"
              draggable={false}
            />
          </div>
        )}

        {/* ── Split-Screen Divider Line & Drag Handle ───────────────────── */}
        {isCompareMode && (
          <>
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.6)] z-20 pointer-events-none -translate-x-1/2"
              style={{ left: `${compareSliderPosition}%` }}
              aria-hidden="true"
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-brand-terracotta text-white shadow-xl border-2 border-white flex items-center justify-center pointer-events-none">
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4 fill-none stroke-current stroke-2"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7l-5 5 5 5M16 7l5 5-5 5" />
                </svg>
              </div>
            </div>

            {/* Semantic, keyboard-accessible slider input */}
            <input
              type="range"
              min={0}
              max={100}
              value={compareSliderPosition}
              onChange={(e) => setCompareSliderPosition(Number(e.target.value))}
              aria-label="Before and after room comparison slider"
              data-testid="before-after-slider"
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20 m-0 p-0 focus-visible:opacity-100 focus-visible:h-3 focus-visible:bottom-3 focus-visible:top-auto focus-visible:left-4 focus-visible:w-[calc(100%-2rem)] focus-visible:accent-brand-terracotta"
            />

            {/* High-contrast Before/After Badges (contrast > 15:1 for WCAG AAA) */}
            <div className="absolute top-3 left-3 z-30 pointer-events-none">
              <span className="px-2.5 py-1 rounded bg-[#18181B] text-[#FAF8F5] text-[10px] font-mono font-bold tracking-wider shadow-md uppercase">
                BEFORE (ORIGINAL)
              </span>
            </div>
            <div className="absolute top-3 right-3 z-30 pointer-events-none">
              <span className="px-2.5 py-1 rounded bg-[#18181B] text-[#FAF8F5] text-[10px] font-mono font-bold tracking-wider shadow-md uppercase">
                AFTER (AI REDESIGN)
              </span>
            </div>
          </>
        )}

        {/* ── Free Tier Watermark (FR-503) ──────────────────────────── */}
        {isWatermarked && (
          <div
            id="watermark"
            className="absolute inset-0 pointer-events-none flex items-center justify-center z-10"
            aria-hidden="true"
          >
            <span className="font-mono text-5xl font-bold uppercase tracking-widest text-ink-primary opacity-[0.12] rotate-[-28deg] whitespace-nowrap">
              PROJECT ROOMCOMMERCE
            </span>
          </div>
        )}

        {/* ── Pulsing Hotspot Pins Layer ────────────────────────────── */}
        {showHotspots &&
          hotspots.map((pin) => (
            <div key={pin.id} className="relative z-40">
              <AdsCanvasHotspot
                id={pin.id}
                normX={pin.normX}
                normY={pin.normY}
                category={pin.category}
                priceCents={pin.priceCents}
                isSelected={selectedHotspotId === pin.id}
                onClick={(id: string) => selectHotspot(id)}
                className="z-40"
              />
            </div>
          ))}
      </div>
    </div>
  );
}
