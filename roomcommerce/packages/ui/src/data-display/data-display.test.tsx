import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdsCanvasHotspot } from '../data-display/hotspot/ads-canvas-hotspot';
import { AdsSkuSpecTable } from '../data-display/spec-table/ads-sku-spec-table';
import type { ProductDrawerData } from '../navigation/product-drawer/ads-product-drawer';

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────
const MOCK_PRODUCTS: ProductDrawerData[] = [
  {
    hotspotId: 'spot-1',
    skuId: 'sku-1',
    retailerName: 'Wayfair',
    title: 'Eames-Style Lounge Chair in Walnut & Black Leather',
    priceCents: 89900,
    dimensionsCm: { width: 84, depth: 73, height: 92 },
    similarityScore: 0.94,
    inStock: true,
    imageUrl: 'https://cdn.example.com/chair.webp',
    redirectUrl: 'https://wayfair.com/chair',
  },
  {
    hotspotId: 'spot-2',
    skuId: 'sku-2',
    retailerName: 'IKEA',
    title: 'KALLAX Shelving Unit, White',
    priceCents: 11999,
    dimensionsCm: { width: 147, depth: 39, height: 147 },
    similarityScore: 0.87,
    inStock: false,
    imageUrl: 'https://cdn.example.com/shelf.webp',
    redirectUrl: 'https://ikea.com/shelf',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// AdsCanvasHotspot
// ─────────────────────────────────────────────────────────────────────────────
describe('AdsCanvasHotspot', () => {
  it('renders accessible button with category and price label', () => {
    render(
      <AdsCanvasHotspot
        id="h1"
        normX={0.45}
        normY={0.62}
        category="sofa"
        priceCents={89900}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /view sofa priced at \$899/i })).toBeTruthy();
  });

  it('positions via normX and normY percentages', () => {
    const { container } = render(
      <AdsCanvasHotspot
        id="h2"
        normX={0.5}
        normY={0.7}
        category="chair"
        priceCents={45000}
        onClick={vi.fn()}
      />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.left).toBe('50%');
    expect(wrapper.style.top).toBe('70%');
  });

  it('clamps normX below 0.04 to 0.04', () => {
    const { container } = render(
      <AdsCanvasHotspot
        id="h3"
        normX={0.01}
        normY={0.5}
        category="lamp"
        priceCents={5000}
        onClick={vi.fn()}
      />,
    );
    expect((container.firstElementChild as HTMLElement).style.left).toBe('4%');
  });

  it('clamps normY above 0.96 to 0.96', () => {
    const { container } = render(
      <AdsCanvasHotspot
        id="h4"
        normX={0.5}
        normY={0.99}
        category="rug"
        priceCents={30000}
        onClick={vi.fn()}
      />,
    );
    expect((container.firstElementChild as HTMLElement).style.top).toBe('96%');
  });

  it('sets aria-pressed=true when isSelected', () => {
    render(
      <AdsCanvasHotspot
        id="h5"
        normX={0.5}
        normY={0.5}
        category="table"
        priceCents={20000}
        isSelected
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
  });

  it('button has 48×48pt touch hitbox dimensions', () => {
    render(
      <AdsCanvasHotspot
        id="h6"
        normX={0.5}
        normY={0.5}
        category="lamp"
        priceCents={10000}
        onClick={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button');
    // w-12 h-12 = 48px × 48px
    expect(btn.className).toContain('w-12');
    expect(btn.className).toContain('h-12');
  });

  it('calls onClick with hotspot id when clicked', () => {
    const onClick = vi.fn();
    render(
      <AdsCanvasHotspot
        id="h7"
        normX={0.5}
        normY={0.5}
        category="chair"
        priceCents={59900}
        onClick={onClick}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith('h7');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AdsSkuSpecTable
// ─────────────────────────────────────────────────────────────────────────────
describe('AdsSkuSpecTable', () => {
  it('renders semantic table element', () => {
    const { container } = render(<AdsSkuSpecTable products={MOCK_PRODUCTS} />);
    expect(container.querySelector('table')).toBeTruthy();
  });

  it('has sr-only caption for screen readers', () => {
    const { container } = render(<AdsSkuSpecTable products={MOCK_PRODUCTS} />);
    const caption = container.querySelector('caption');
    expect(caption).toBeTruthy();
    expect(caption?.className).toContain('sr-only');
  });

  it('renders column headers with scope="col"', () => {
    const { container } = render(<AdsSkuSpecTable products={MOCK_PRODUCTS} />);
    const ths = container.querySelectorAll('th[scope="col"]');
    expect(ths.length).toBeGreaterThanOrEqual(5);
  });

  it('renders one row per product', () => {
    const { container } = render(<AdsSkuSpecTable products={MOCK_PRODUCTS} />);
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
  });

  it('renders product title in first column', () => {
    render(<AdsSkuSpecTable products={MOCK_PRODUCTS} />);
    expect(screen.getByText('Eames-Style Lounge Chair in Walnut & Black Leather')).toBeTruthy();
  });

  it('renders outbound link with full aria-label', () => {
    render(<AdsSkuSpecTable products={MOCK_PRODUCTS} />);
    const link = screen.getByRole('link', {
      name: /buy eames-style lounge chair in walnut & black leather on wayfair for \$899\.00 in a new tab/i,
    });
    expect(link).toBeTruthy();
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('renders metric dimensions', () => {
    render(<AdsSkuSpecTable products={MOCK_PRODUCTS} />);
    expect(screen.getByText('84W × 73D × 92H')).toBeTruthy();
  });

  it('renders empty state when products array is empty', () => {
    render(<AdsSkuSpecTable products={[]} />);
    expect(screen.getByText(/no products detected yet/i)).toBeTruthy();
  });

  it('calls onSelectProduct when row is clicked', () => {
    const onSelect = vi.fn();
    render(<AdsSkuSpecTable products={MOCK_PRODUCTS} onSelectProduct={onSelect} />);
    fireEvent.click(screen.getByText('KALLAX Shelving Unit, White'));
    expect(onSelect).toHaveBeenCalledWith('spot-2');
  });

  it('renders match percentage for each product', () => {
    render(<AdsSkuSpecTable products={MOCK_PRODUCTS} />);
    expect(screen.getByText('94%')).toBeTruthy();
    expect(screen.getByText('87%')).toBeTruthy();
  });
});
