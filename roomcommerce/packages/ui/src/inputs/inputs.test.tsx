import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdsBudgetSlider } from '../inputs/slider/ads-budget-slider';
import { AdsStyleCardSelector, STYLE_PRESETS } from '../inputs/style-selector/ads-style-card-selector';
import { AdsDropzone } from '../inputs/dropzone/ads-dropzone';

// ─────────────────────────────────────────────────────────────────────────────
// AdsBudgetSlider
// ─────────────────────────────────────────────────────────────────────────────
describe('AdsBudgetSlider', () => {
  it('renders label and formatted currency value', () => {
    render(<AdsBudgetSlider value={150000} onChange={vi.fn()} />);
    expect(screen.getByText('Room Budget Guardrail')).toBeTruthy();
    expect(screen.getByText('$1,500')).toBeTruthy();
  });

  it('renders custom label', () => {
    render(<AdsBudgetSlider value={50000} onChange={vi.fn()} label="Budget Cap" />);
    expect(screen.getByText('Budget Cap')).toBeTruthy();
  });

  it('thumb has data-testid for touch target verification', () => {
    render(<AdsBudgetSlider value={30000} onChange={vi.fn()} />);
    expect(screen.getByTestId('ads-budget-slider-thumb')).toBeTruthy();
  });

  it('thumb element has padding class for 48pt touch area', () => {
    render(<AdsBudgetSlider value={30000} onChange={vi.fn()} />);
    const thumb = screen.getByTestId('ads-budget-slider-thumb');
    // -m-3 p-3 creates an effective 48×48pt touch hitbox around the 24px visual thumb
    expect(thumb.className).toContain('-m-3');
    expect(thumb.className).toContain('p-3');
  });

  it('shows min and max boundary labels', () => {
    render(<AdsBudgetSlider value={50000} onChange={vi.fn()} />);
    expect(screen.getByText('$300 min')).toBeTruthy();
    expect(screen.getByText('$10,000 max')).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AdsStyleCardSelector
// ─────────────────────────────────────────────────────────────────────────────
describe('AdsStyleCardSelector', () => {
  it('renders all 8 style preset cards', () => {
    render(<AdsStyleCardSelector value="JAPANDI" onChange={vi.fn()} />);
    STYLE_PRESETS.forEach((preset) => {
      expect(screen.getByText(preset.label)).toBeTruthy();
    });
  });

  it('shows checkmark badge on selected preset', () => {
    render(<AdsStyleCardSelector value="MINIMALIST" onChange={vi.fn()} />);
    // The selected item should have the terracotta border class
    const selected = screen.getByRole('radio', { name: /minimalist/i });
    expect(selected.className).toContain('border-brand-terracotta');
  });

  it('calls onChange with correct value when card is clicked', () => {
    const onChange = vi.fn();
    render(<AdsStyleCardSelector value="JAPANDI" onChange={onChange} />);
    // Use exact aria-label to avoid matching "Scandinavian" inside Japandi's description
    fireEvent.click(screen.getByRole('radio', { name: 'Scandinavian: Clean nordic light' }));
    expect(onChange).toHaveBeenCalledWith('SCANDINAVIAN');
  });

  it('has aria-label on the radio group for screen readers', () => {
    render(<AdsStyleCardSelector value="JAPANDI" onChange={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: /interior design style/i })).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AdsDropzone
// ─────────────────────────────────────────────────────────────────────────────
describe('AdsDropzone', () => {
  it('renders idle state with upload instruction', () => {
    render(<AdsDropzone onFileAccepted={vi.fn()} />);
    expect(screen.getByText(/drag & drop or click to upload/i)).toBeTruthy();
    expect(screen.getByText(/JPG, PNG, HEIC/)).toBeTruthy();
  });

  it('renders GDPR trust assurance badge', () => {
    render(<AdsDropzone onFileAccepted={vi.fn()} />);
    expect(screen.getByText(/permanently deleted after 7 days/i)).toBeTruthy();
  });

  it('renders uploading state with progress bar', () => {
    render(<AdsDropzone onFileAccepted={vi.fn()} isUploading uploadProgress={42} />);
    expect(screen.getByText(/uploading your photo/i)).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('calls onError and shows error state for oversized file', () => {
    const onError = vi.fn();
    const onFileAccepted = vi.fn();
    render(<AdsDropzone onFileAccepted={onFileAccepted} onError={onError} />);

    const oversizedFile = new File([new ArrayBuffer(21 * 1024 * 1024)], 'big.jpg', {
      type: 'image/jpeg',
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [oversizedFile], configurable: true });
    fireEvent.change(input);

    expect(onError).toHaveBeenCalledWith('Photo must be under 20MB.');
    expect(onFileAccepted).not.toHaveBeenCalled();
  });

  it('calls onFileAccepted with valid JPEG file', () => {
    const onFileAccepted = vi.fn();
    render(<AdsDropzone onFileAccepted={onFileAccepted} />);

    const validFile = new File([new ArrayBuffer(1024)], 'room.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [validFile], configurable: true });
    fireEvent.change(input);

    expect(onFileAccepted).toHaveBeenCalledWith(validFile);
  });

  it('has accessible role and label', () => {
    render(<AdsDropzone onFileAccepted={vi.fn()} />);
    expect(screen.getByRole('button', { name: /upload room photo/i })).toBeTruthy();
  });
});
