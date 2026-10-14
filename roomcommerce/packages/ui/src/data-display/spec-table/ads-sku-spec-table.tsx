import * as React from 'react';
import { ExternalLink } from 'lucide-react';
import type { ProductDrawerData } from '../../navigation/product-drawer/ads-product-drawer';
import { cn } from '../../lib/utils';

export interface AdsSkuSpecTableProps {
  products: ProductDrawerData[];
  onSelectProduct?: (hotspotId: string) => void;
  className?: string;
}

/**
 * AdsSkuSpecTable — WCAG 2.1 AA accessible DOM shopping list table (ACC-02, SCR-08B).
 *
 * Provides a semantic screen-reader navigable alternative to the 2D visual canvas.
 * All ARIA patterns: <table>, <caption class="sr-only">, <th scope="col">, outbound aria-labels.
 */
export function AdsSkuSpecTable({ products, onSelectProduct, className }: AdsSkuSpecTableProps) {
  if (products.length === 0) {
    return (
      <div className={cn('py-12 text-center text-sm text-ink-muted', className)}>
        No products detected yet. Start a render to see recommendations here.
      </div>
    );
  }

  return (
    <div className={cn('w-full overflow-x-auto border border-border-default rounded-md bg-bg-surface', className)}>
      <table
        className="w-full text-left text-sm"
        aria-label="Shoppable room furniture specification list"
      >
        {/* Screen-reader only caption for full context */}
        <caption className="sr-only">
          Furniture recommendations detected in your redesigned room. Columns include item name,
          retailer, price, dimensions, visual match score, and a purchase link.
        </caption>

        <thead className="bg-bg-subtle border-b border-border-default">
          <tr className="text-[11px] font-mono font-semibold uppercase tracking-wider text-ink-secondary">
            <th scope="col" className="px-4 py-3">Item</th>
            <th scope="col" className="px-4 py-3">Retailer</th>
            <th scope="col" className="px-4 py-3 text-right tabular-nums">Price</th>
            <th scope="col" className="px-4 py-3">Dimensions (cm)</th>
            <th scope="col" className="px-4 py-3 text-right">Match</th>
            <th scope="col" className="px-4 py-3 text-right">
              <span className="sr-only">Purchase link</span>
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-border-default">
          {products.map((item) => {
            const formattedPrice = new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(item.priceCents / 100);

            const { width, depth, height } = item.dimensionsCm;
            const matchPct = Math.round(item.similarityScore * 100);

            return (
              <tr
                key={item.hotspotId}
                className="hover:bg-bg-subtle/50 transition-colors duration-100 cursor-pointer"
                onClick={() => onSelectProduct?.(item.hotspotId)}
              >
                <td className="px-4 py-3 font-medium text-ink-primary max-w-[200px]">
                  <span className="line-clamp-2 leading-snug">{item.title}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs uppercase text-ink-secondary whitespace-nowrap">
                  {item.retailerName}
                </td>
                <td className="px-4 py-3 font-mono text-sm font-bold text-ink-primary text-right tabular-nums whitespace-nowrap">
                  {formattedPrice}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink-muted whitespace-nowrap">
                  {width}W × {depth}D × {height}H
                </td>
                <td className="px-4 py-3 font-mono text-xs font-semibold text-brand-olive text-right tabular-nums whitespace-nowrap">
                  {matchPct}%
                </td>
                <td className="px-4 py-3 text-right">
                  <a
                    href={item.redirectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      'inline-flex items-center gap-1 text-brand-terracotta hover:underline',
                      'text-xs font-medium font-sans',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary rounded-sm',
                    )}
                    aria-label={`Buy ${item.title} on ${item.retailerName} for ${formattedPrice} in a new tab`}
                  >
                    Buy
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
