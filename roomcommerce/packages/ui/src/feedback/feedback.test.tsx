import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AdsProgressBar } from '../feedback/progress-bar/ads-progress-bar';
import { AdsToast } from '../feedback/toast/ads-toast';

// ─────────────────────────────────────────────────────────────────────────────
// AdsProgressBar
// ─────────────────────────────────────────────────────────────────────────────
describe('AdsProgressBar', () => {
  it('renders progressbar role with correct aria values', () => {
    render(<AdsProgressBar value={65} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('65');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });

  it('displays stage label when stage prop is provided', () => {
    render(<AdsProgressBar value={35} stage="DEPTH_ESTIMATION" />);
    expect(screen.getByText('Depth mapping')).toBeTruthy();
  });

  it('displays progress message when provided', () => {
    render(<AdsProgressBar value={90} message="Matching catalog..." />);
    expect(screen.getByText('Matching catalog...')).toBeTruthy();
  });

  it('clamps value above 100 to 100', () => {
    render(<AdsProgressBar value={150} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  it('clamps value below 0 to 0', () => {
    render(<AdsProgressBar value={-10} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('applies danger color for FAILED stage', () => {
    render(<AdsProgressBar value={100} stage="FAILED" />);
    expect(screen.getByRole('progressbar').className).toContain('bg-semantic-danger');
  });

  it('has aria-live="polite" for non-intrusive announcements', () => {
    render(<AdsProgressBar value={50} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-live')).toBe('polite');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AdsToast
// ─────────────────────────────────────────────────────────────────────────────
describe('AdsToast', () => {
  it('renders title and description', () => {
    render(<AdsToast title="Saved!" description="Your changes were saved." />);
    expect(screen.getByText('Saved!')).toBeTruthy();
    expect(screen.getByText('Your changes were saved.')).toBeTruthy();
  });

  it('uses role="status" for non-urgent variants', () => {
    render(<AdsToast title="Copied to clipboard" variant="success" />);
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('uses role="alert" for error variant', () => {
    render(<AdsToast title="Payment failed" variant="error" />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(<AdsToast title="Hello" onDismiss={onDismiss} />);
    screen.getByRole('button', { name: /dismiss/i }).click();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('auto-dismisses after duration ms', async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<AdsToast title="Auto" onDismiss={onDismiss} duration={2000} />);
    await act(async () => vi.advanceTimersByTime(2001));
    expect(onDismiss).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('does not auto-dismiss when duration=0', async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<AdsToast title="Persistent" onDismiss={onDismiss} duration={0} />);
    await act(async () => vi.advanceTimersByTime(10_000));
    expect(onDismiss).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
