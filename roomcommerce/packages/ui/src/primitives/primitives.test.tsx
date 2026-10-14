import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdsButton } from '../primitives/button/ads-button';
import { AdsBadge } from '../primitives/badge/ads-badge';
import { AdsDivider } from '../primitives/divider/ads-divider';

// ─────────────────────────────────────────────────────────────────────────────
// AdsButton
// ─────────────────────────────────────────────────────────────────────────────
describe('AdsButton', () => {
  it('renders children and default primary variant', () => {
    render(<AdsButton>Book a redesign</AdsButton>);
    expect(screen.getByRole('button', { name: /book a redesign/i })).toBeTruthy();
  });

  it('renders loading spinner and sets aria-busy when isLoading', () => {
    render(<AdsButton isLoading>Save</AdsButton>);
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.hasAttribute('disabled')).toBe(true);
    expect(screen.getByTestId('ads-button-spinner')).toBeTruthy();
  });

  it('is disabled when disabled prop is set', () => {
    render(<AdsButton disabled>Pay</AdsButton>);
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
  });

  it('calls onClick handler on click', () => {
    const handler = vi.fn();
    render(<AdsButton onClick={handler}>Click</AdsButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not call onClick when loading', () => {
    const handler = vi.fn();
    render(<AdsButton isLoading onClick={handler}>Click</AdsButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('lg size has min-h-[48px] class for touch compliance', () => {
    render(<AdsButton size="lg">Large</AdsButton>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('min-h-[48px]');
  });

  it('forwards ref to button element', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<AdsButton ref={ref}>Ref</AdsButton>);
    expect(ref.current?.tagName).toBe('BUTTON');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AdsBadge
// ─────────────────────────────────────────────────────────────────────────────
describe('AdsBadge', () => {
  it('renders text content', () => {
    render(<AdsBadge>In Stock</AdsBadge>);
    expect(screen.getByText('In Stock')).toBeTruthy();
  });

  it('applies success variant class', () => {
    render(<AdsBadge variant="success">✓</AdsBadge>);
    const badge = screen.getByText('✓');
    expect(badge.className).toContain('text-semantic-success');
  });

  it('applies brand variant class', () => {
    render(<AdsBadge variant="brand">94%</AdsBadge>);
    expect(screen.getByText('94%').className).toContain('text-brand-terracotta');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AdsDivider
// ─────────────────────────────────────────────────────────────────────────────
describe('AdsDivider', () => {
  it('renders an HR element', () => {
    const { container } = render(<AdsDivider />);
    expect(container.querySelector('hr')).toBeTruthy();
  });

  it('is hidden from assistive technology via aria-hidden', () => {
    const { container } = render(<AdsDivider />);
    expect(container.querySelector('hr')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('applies strong border class when strength="strong"', () => {
    const { container } = render(<AdsDivider strength="strong" />);
    expect(container.querySelector('hr')?.className).toContain('border-border-strong');
  });
});
