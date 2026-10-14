export const typography = {
  fonts: {
    sans: 'var(--font-sans, "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, sans-serif)',
    mono: 'var(--font-mono, "JetBrains Mono", Menlo, Consolas, monospace)',
  },
  scale: {
    d1: { size: '36px', lineHeight: '44px', weight: '700', tracking: '-0.025em' },
    h1: { size: '28px', lineHeight: '36px', weight: '600', tracking: '-0.020em' },
    h2: { size: '22px', lineHeight: '28px', weight: '600', tracking: '-0.015em' },
    h3: { size: '18px', lineHeight: '24px', weight: '500', tracking: '-0.010em' },
    body: { size: '15px', lineHeight: '22px', weight: '400', tracking: '0.000em' },
    'body-sm': { size: '13px', lineHeight: '18px', weight: '400', tracking: '+0.005em' },
    'mono-sm': { size: '12px', lineHeight: '16px', weight: '500', tracking: '+0.020em' },
    label: { size: '11px', lineHeight: '14px', weight: '600', tracking: '+0.040em' },
  },
} as const;
