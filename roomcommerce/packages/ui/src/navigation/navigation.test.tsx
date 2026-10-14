import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdsProductDrawer } from '../navigation/product-drawer/ads-product-drawer';
import type { ProductDrawerData } from '../navigation/product-drawer/ads-product-drawer';

const MOCK_PRODUCT: ProductDrawerData = {
  hotspotId: 'spot-1',
  skuId: 'sku-1',
  retailerName: 'Wayfair',
  title: 'Japandi Lounge Chair — Walnut & Ivory Boucle',
  priceCents: 149900,
  dimensionsCm: { width: 84, depth: 73, height: 92 },
  similarityScore: 0.94,
  inStock: true,
  imageUrl: 'https://cdn.example.com/chair.webp',
  redirectUrl: 'https://wayfair.com/product',
};

describe('AdsProductDrawer', () => {
  it('renders nothing when product is null', () => {
    const { container } = render(
      <AdsProductDrawer isOpen={true} onClose={vi.fn()} product={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders product title in h2 with id for aria-labelledby', () => {
    render(<AdsProductDrawer isOpen={true} onClose={vi.fn()} product={MOCK_PRODUCT} />);
    const heading = screen.getByRole('heading', { name: /japandi lounge chair/i });
    expect(heading.id).toBe('drawer-product-title');
  });

  it('renders retailer name in header', () => {
    render(<AdsProductDrawer isOpen={true} onClose={vi.fn()} product={MOCK_PRODUCT} />);
    expect(screen.getByText('Wayfair')).toBeTruthy();
  });

  it('renders In Stock badge when inStock=true', () => {
    render(<AdsProductDrawer isOpen={true} onClose={vi.fn()} product={MOCK_PRODUCT} />);
    expect(screen.getByText('In Stock')).toBeTruthy();
  });

  it('renders Out of Stock badge when inStock=false', () => {
    render(
      <AdsProductDrawer
        isOpen={true}
        onClose={vi.fn()}
        product={{ ...MOCK_PRODUCT, inStock: false }}
      />,
    );
    expect(screen.getByText('Out of Stock')).toBeTruthy();
  });

  it('renders formatted price in tabular mono', () => {
    render(<AdsProductDrawer isOpen={true} onClose={vi.fn()} product={MOCK_PRODUCT} />);
    expect(screen.getByText('$1,499.00')).toBeTruthy();
  });

  it('renders both metric and imperial dimensions', () => {
    render(<AdsProductDrawer isOpen={true} onClose={vi.fn()} product={MOCK_PRODUCT} />);
    expect(screen.getByText(/84W × 73D × 92H cm/)).toBeTruthy();
    // Imperial conversion: 84/2.54 = 33.1"
    expect(screen.getByText(/33\.1"W/)).toBeTruthy();
  });

  it('renders similarity match badge', () => {
    render(<AdsProductDrawer isOpen={true} onClose={vi.fn()} product={MOCK_PRODUCT} />);
    expect(screen.getByText('94% Visual Match')).toBeTruthy();
  });

  it('renders mandatory FTC affiliate disclosure (BR-03)', () => {
    render(<AdsProductDrawer isOpen={true} onClose={vi.fn()} product={MOCK_PRODUCT} />);
    expect(
      screen.getByText(/we may earn an affiliate commission/i),
    ).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<AdsProductDrawer isOpen={true} onClose={onClose} product={MOCK_PRODUCT} />);
    fireEvent.click(screen.getByRole('button', { name: /close product details/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when ESC key is pressed', () => {
    const onClose = vi.fn();
    render(<AdsProductDrawer isOpen={true} onClose={onClose} product={MOCK_PRODUCT} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('has role="dialog" and aria-labelledby pointing to title id', () => {
    render(<AdsProductDrawer isOpen={true} onClose={vi.fn()} product={MOCK_PRODUCT} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-labelledby')).toBe('drawer-product-title');
  });

  it('renders product image with correct alt text', () => {
    render(<AdsProductDrawer isOpen={true} onClose={vi.fn()} product={MOCK_PRODUCT} />);
    const img = screen.getByAltText('Japandi Lounge Chair — Walnut & Ivory Boucle');
    expect(img.getAttribute('src')).toBe('https://cdn.example.com/chair.webp');
  });
});
