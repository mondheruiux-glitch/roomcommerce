import { describe, it, expect } from 'vitest';
import { colors } from './colors.js';
import { spacing, radii } from './spacing.js';
import { typography } from './typography.js';
import { shadows } from './shadows.js';

// ──────────────────────────────────────────────────────────
// WCAG Contrast Ratio Calculator
// ──────────────────────────────────────────────────────────
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  return {
    r: parseInt(cleaned.substring(0, 2), 16),
    g: parseInt(cleaned.substring(2, 4), 16),
    b: parseInt(cleaned.substring(4, 6), 16),
  };
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * rs! + 0.7152 * gs! + 0.0722 * bs!;
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ──────────────────────────────────────────────────────────
// 1. Color token completeness
// ──────────────────────────────────────────────────────────
describe('Color Tokens', () => {
  it('defines all background tokens', () => {
    expect(colors.bg.canvas).toBe('#F9F8F6');
    expect(colors.bg.surface).toBe('#FFFFFF');
    expect(colors.bg.subtle).toBe('#F2EFEB');
    expect(colors.bg.muted).toBe('#E6E2DC');
    expect(colors.bg.overlay).toBe('rgba(26, 25, 23, 0.45)');
  });

  it('defines all ink tokens', () => {
    expect(colors.ink.primary).toBe('#1A1917');
    expect(colors.ink.secondary).toBe('#57534E');
    expect(colors.ink.muted).toBe('#6B655B');
    expect(colors.ink.inverted).toBe('#FFFFFF');
  });

  it('defines all brand tokens', () => {
    expect(colors.brand.terracotta).toBe('#B85D3A');
    expect(colors.brand['terracotta-hover']).toBe('#984B2E');
    expect(colors.brand['terracotta-subtle']).toBe('#F7EBE6');
    expect(colors.brand.olive).toBe('#4E5E4A');
  });

  it('defines all semantic tokens', () => {
    expect(colors.semantic.success).toBe('#2E6945');
    expect(colors.semantic.warning).toBe('#A16207');
    expect(colors.semantic.danger).toBe('#B91C1C');
    expect(colors.semantic.info).toBe('#2563EB');
  });

  it('defines all border tokens', () => {
    expect(colors.border.default).toBe('#E6E2DC');
    expect(colors.border.strong).toBe('#D6D1CA');
    expect(colors.border.interactive).toBe('#1A1917');
  });
});

// ──────────────────────────────────────────────────────────
// 2. WCAG Contrast Ratio Verification (≥ 4.5:1 body text)
// ──────────────────────────────────────────────────────────
describe('WCAG Contrast Ratios', () => {
  it('ink.primary on bg.canvas >= 15:1 (AAA)', () => {
    const ratio = contrastRatio(colors.ink.primary, colors.bg.canvas);
    expect(ratio).toBeGreaterThanOrEqual(15);
  });

  it('ink.primary on bg.surface >= 15:1 (AAA)', () => {
    const ratio = contrastRatio(colors.ink.primary, colors.bg.surface);
    expect(ratio).toBeGreaterThanOrEqual(15);
  });

  it('ink.secondary on bg.canvas >= 4.5:1 (AA body)', () => {
    const ratio = contrastRatio(colors.ink.secondary, colors.bg.canvas);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('ink.muted on bg.canvas >= 4.5:1 (AA body)', () => {
    const ratio = contrastRatio(colors.ink.muted, colors.bg.canvas);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('ink.muted on bg.surface >= 4.5:1 (AA body)', () => {
    const ratio = contrastRatio(colors.ink.muted, colors.bg.surface);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('brand.terracotta on bg.surface >= 3:1 (AA large text / buttons)', () => {
    const ratio = contrastRatio(colors.brand.terracotta, colors.bg.surface);
    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  it('ink.inverted on brand.terracotta >= 4.5:1 (AA body)', () => {
    const ratio = contrastRatio(colors.ink.inverted, colors.brand.terracotta);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('semantic.danger on bg.surface >= 4.5:1 (AA body)', () => {
    const ratio = contrastRatio(colors.semantic.danger, colors.bg.surface);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

// ──────────────────────────────────────────────────────────
// 3. Spacing scale
// ──────────────────────────────────────────────────────────
describe('Spacing Tokens', () => {
  it('defines 9 spacing values on 8pt grid', () => {
    expect(Object.keys(spacing)).toHaveLength(9);
  });

  it('spacing.0 is 0px', () => {
    expect(spacing['0']).toBe('0px');
  });

  it('spacing.4 is 16px (1rem)', () => {
    expect(spacing['4']).toBe('16px');
  });

  it('spacing.12 is 64px (4rem)', () => {
    expect(spacing['12']).toBe('64px');
  });
});

// ──────────────────────────────────────────────────────────
// 4. Radii
// ──────────────────────────────────────────────────────────
describe('Radii Tokens', () => {
  it('defines 5 radius values', () => {
    expect(Object.keys(radii)).toHaveLength(5);
  });

  it('radii.full is 9999px', () => {
    expect(radii.full).toBe('9999px');
  });

  it('radii.sm is 4px', () => {
    expect(radii.sm).toBe('4px');
  });
});

// ──────────────────────────────────────────────────────────
// 5. Typography
// ──────────────────────────────────────────────────────────
describe('Typography Tokens', () => {
  it('defines Plus Jakarta Sans as primary font', () => {
    expect(typography.fonts.sans).toContain('Plus Jakarta Sans');
  });

  it('defines JetBrains Mono as monospace font', () => {
    expect(typography.fonts.mono).toContain('JetBrains Mono');
  });

  it('defines 8 type scale entries', () => {
    expect(Object.keys(typography.scale)).toHaveLength(8);
  });

  it('d1 is 36px / 44px / 700', () => {
    expect(typography.scale.d1.size).toBe('36px');
    expect(typography.scale.d1.lineHeight).toBe('44px');
    expect(typography.scale.d1.weight).toBe('700');
  });

  it('body is 15px / 22px / 400', () => {
    expect(typography.scale.body.size).toBe('15px');
    expect(typography.scale.body.lineHeight).toBe('22px');
    expect(typography.scale.body.weight).toBe('400');
  });

  it('label is 11px / 14px / 600 with +0.040em tracking', () => {
    expect(typography.scale.label.size).toBe('11px');
    expect(typography.scale.label.tracking).toBe('+0.040em');
  });
});

// ──────────────────────────────────────────────────────────
// 6. Shadows
// ──────────────────────────────────────────────────────────
describe('Shadow Tokens', () => {
  it('defines 7 shadow values', () => {
    expect(Object.keys(shadows)).toHaveLength(7);
  });

  it('shadows.none is "none"', () => {
    expect(shadows.none).toBe('none');
  });

  it('shadows.hotspot contains terracotta-derived color', () => {
    expect(shadows.hotspot).toContain('184, 93, 58');
  });
});
