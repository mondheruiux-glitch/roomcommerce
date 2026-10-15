'use client';
import * as React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { AdsButton } from '../../primitives/button/ads-button';
import { AdsBadge } from '../../primitives/badge/ads-badge';
import { AdsDivider } from '../../primitives/divider/ads-divider';
import { cn } from '../../lib/utils';

export interface ProductDrawerData {
  hotspotId: string;
  skuId: string;
  retailerName: string;
  title: string;
  priceCents: number;
  dimensionsCm: { width: number; depth: number; height: number };
  similarityScore: number; // 0.0–1.0
  inStock: boolean;
  imageUrl: string;
  redirectUrl: string;
  isAlternative?: boolean;
}

export interface AdsProductDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductDrawerData | null;
  className?: string;
}

/**
 * AdsProductDrawer — Responsive contextual product detail panel (FR-402, BR-03).
 *
 * Desktop (≥1024px): 400px fixed right sidebar.
 * Mobile (<1024px): Slide-up bottom sheet.
 *
 * Includes:
 * - Retailer badge + in-stock indicator
 * - 1:1 aspect product cutout image
 * - Metric + Imperial dual dimensions
 * - Cosine visual similarity badge
 * - Affiliate CTA button
 * - Mandatory FTC disclosure (BR-03)
 */
export function AdsProductDrawer({ isOpen, onClose, product, className }: AdsProductDrawerProps) {
  // ESC key dismissal
  React.useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [isOpen, onClose]);

  if (!product) return null;

  const matchPercent = Math.round(product.similarityScore * 100);
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(product.priceCents / 100);

  const { width, depth, height } = product.dimensionsCm;
  const toIn = (cm: number) => (cm / 2.54).toFixed(1);

  return (
    <>
      {/* Backdrop (mobile only) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-bg-overlay backdrop-blur-sm lg:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}

      <aside
        role="dialog"
        aria-labelledby="drawer-product-title"
        aria-modal="true"
        className={cn(
          'fixed z-40 bg-bg-surface flex flex-col transition-transform duration-280 ease-out',
          // Desktop: right sidebar
          'lg:inset-y-0 lg:right-0 lg:w-[400px] lg:border-l lg:border-border-default lg:shadow-drawer',
          isOpen ? 'lg:translate-x-0' : 'lg:translate-x-full',
          // Mobile: bottom sheet
          'max-lg:inset-x-0 max-lg:bottom-0 max-lg:rounded-t-2xl max-lg:border-t max-lg:border-border-default max-lg:shadow-xl max-lg:max-h-[85dvh]',
          isOpen ? 'max-lg:translate-y-0' : 'max-lg:translate-y-full',
          className,
        )}
      >
        {/* Drag handle (mobile) */}
        <div className="lg:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border-strong" aria-hidden="true" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-default shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-widest text-ink-secondary">
              {product.retailerName}
            </span>
            <AdsBadge variant={product.inStock ? 'success' : 'danger'}>
              {product.inStock ? 'In Stock' : 'Out of Stock'}
            </AdsBadge>
          </div>
          <button
            onClick={onClose}
            className={cn(
              'p-2 rounded-sm text-ink-muted hover:text-ink-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary',
              'transition-colors duration-150',
            )}
            aria-label="Close product details"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 1:1 Product Image */}
          <div className="w-full aspect-square bg-bg-canvas rounded-md overflow-hidden border border-border-default flex items-center justify-center p-6">
            <img
              src={product.imageUrl}
              alt={product.title}
              className="w-full h-full object-contain mix-blend-multiply"
              loading="lazy"
            />
          </div>

          {/* Identity */}
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <AdsBadge variant="brand">{matchPercent}% Visual Match</AdsBadge>
              {product.isAlternative && (
                <span
                  data-testid="alt-badge"
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand-terracotta/10 text-brand-terracotta border border-brand-terracotta/20"
                >
                  Alternative Item
                </span>
              )}
            </div>
            <h2
              id="drawer-product-title"
              className="text-lg font-semibold text-ink-primary leading-snug line-clamp-2"
              title={product.title}
            >
              {product.title}
            </h2>
            <div className="mt-2 text-2xl font-mono font-bold text-ink-primary tabular-nums">
              {formattedPrice}
            </div>
          </div>

          <AdsDivider />

          {/* Dual Dimensions Table (ACC-02 semantic table) */}
          <div className="rounded-md border border-border-default bg-bg-subtle/50 p-4 space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-ink-secondary">
              Spatial Dimensions
            </div>
            <table
              data-testid="sku-spec-table"
              className="w-full text-left text-xs font-mono"
              aria-label="Spatial dimensions specification"
            >
              <thead>
                <tr className="border-b border-border-default text-ink-secondary text-[11px]">
                  <th scope="col" className="pb-1.5 font-semibold">Unit</th>
                  <th scope="col" className="pb-1.5 font-semibold text-right">Dimensions (W × D × H)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default/50">
                <tr>
                  <td className="py-1 text-ink-muted">Metric</td>
                  <td className="py-1 text-ink-primary font-medium text-right">
                    {width}W × {depth}D × {height}H cm
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-ink-muted">Imperial</td>
                  <td className="py-1 text-ink-primary font-medium text-right">
                    {toIn(width)}&quot;W × {toIn(depth)}&quot;D × {toIn(height)}&quot;H
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer CTA + FTC Disclosure */}
        <div className="p-5 border-t border-border-default bg-bg-surface space-y-3 shrink-0">
          <AdsButton
            variant="primary"
            size="lg"
            className="w-full justify-between"
            onClick={() => window.open(product.redirectUrl, '_blank', 'noopener,noreferrer')}
          >
            <span>View at {product.retailerName}</span>
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
          </AdsButton>

          {/* Mandatory FTC Affiliate Disclosure — BR-03 */}
          <p className="text-[11px] text-ink-muted leading-snug text-center">
            We may earn an affiliate commission from qualifying purchases made via links on this page.
          </p>
        </div>
      </aside>
    </>
  );
}
