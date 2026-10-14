import { colors } from './colors.js';
import { spacing, radii } from './spacing.js';
import { typography } from './typography.js';
import { shadows } from './shadows.js';

// Tailwind plugin factory — typed manually to avoid tsup DTS resolution issues
type AddBaseFunction = (styles: Record<string, Record<string, string>>) => void;
type PluginAPI = { addBase: AddBaseFunction };
type ThemeConfig = Record<string, unknown>;

interface PluginWithOptions {
  handler: (api: PluginAPI) => void;
  config?: { theme?: { extend?: ThemeConfig } };
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const createPlugin = require('tailwindcss/plugin') as (
  handler: (api: PluginAPI) => void,
  config?: { theme?: { extend?: ThemeConfig } },
) => PluginWithOptions;

export const atelierPlugin = createPlugin(
  ({ addBase }) => {
    addBase({
      ':root': {
        // Background tokens
        '--ads-color-bg-canvas': colors.bg.canvas,
        '--ads-color-bg-surface': colors.bg.surface,
        '--ads-color-bg-subtle': colors.bg.subtle,
        '--ads-color-bg-muted': colors.bg.muted,
        '--ads-color-bg-overlay': colors.bg.overlay,

        // Ink tokens
        '--ads-color-ink-primary': colors.ink.primary,
        '--ads-color-ink-secondary': colors.ink.secondary,
        '--ads-color-ink-muted': colors.ink.muted,
        '--ads-color-ink-inverted': colors.ink.inverted,

        // Brand tokens
        '--ads-color-brand-terracotta': colors.brand.terracotta,
        '--ads-color-brand-terracotta-hover': colors.brand['terracotta-hover'],
        '--ads-color-brand-terracotta-subtle': colors.brand['terracotta-subtle'],
        '--ads-color-brand-olive': colors.brand.olive,

        // Semantic tokens
        '--ads-color-semantic-success': colors.semantic.success,
        '--ads-color-semantic-success-subtle': colors.semantic['success-subtle'],
        '--ads-color-semantic-warning': colors.semantic.warning,
        '--ads-color-semantic-warning-subtle': colors.semantic['warning-subtle'],
        '--ads-color-semantic-danger': colors.semantic.danger,
        '--ads-color-semantic-danger-subtle': colors.semantic['danger-subtle'],
        '--ads-color-semantic-info': colors.semantic.info,

        // Border tokens
        '--ads-color-border-default': colors.border.default,
        '--ads-color-border-strong': colors.border.strong,
        '--ads-color-border-interactive': colors.border.interactive,

        // Spacing tokens
        '--ads-spacing-0': spacing['0'],
        '--ads-spacing-1': spacing['1'],
        '--ads-spacing-2': spacing['2'],
        '--ads-spacing-3': spacing['3'],
        '--ads-spacing-4': spacing['4'],
        '--ads-spacing-5': spacing['5'],
        '--ads-spacing-6': spacing['6'],
        '--ads-spacing-8': spacing['8'],
        '--ads-spacing-12': spacing['12'],

        // Typography tokens
        '--ads-font-sans': typography.fonts.sans,
        '--ads-font-mono': typography.fonts.mono,
      },
    });
  },
  {
    theme: {
      extend: {
        colors: {
          'bg-canvas': 'var(--ads-color-bg-canvas)',
          'bg-surface': 'var(--ads-color-bg-surface)',
          'bg-subtle': 'var(--ads-color-bg-subtle)',
          'bg-muted': 'var(--ads-color-bg-muted)',
          'ink-primary': 'var(--ads-color-ink-primary)',
          'ink-secondary': 'var(--ads-color-ink-secondary)',
          'ink-muted': 'var(--ads-color-ink-muted)',
          'ink-inverted': 'var(--ads-color-ink-inverted)',
          'brand-terracotta': 'var(--ads-color-brand-terracotta)',
          'brand-terracotta-hover': 'var(--ads-color-brand-terracotta-hover)',
          'brand-terracotta-subtle': 'var(--ads-color-brand-terracotta-subtle)',
          'brand-olive': 'var(--ads-color-brand-olive)',
          'semantic-success': 'var(--ads-color-semantic-success)',
          'semantic-success-subtle': 'var(--ads-color-semantic-success-subtle)',
          'semantic-warning': 'var(--ads-color-semantic-warning)',
          'semantic-warning-subtle': 'var(--ads-color-semantic-warning-subtle)',
          'semantic-danger': 'var(--ads-color-semantic-danger)',
          'semantic-danger-subtle': 'var(--ads-color-semantic-danger-subtle)',
          'semantic-info': 'var(--ads-color-semantic-info)',
          'border-default': 'var(--ads-color-border-default)',
          'border-strong': 'var(--ads-color-border-strong)',
          'border-interactive': 'var(--ads-color-border-interactive)',
        },
        fontFamily: {
          sans: [typography.fonts.sans],
          mono: [typography.fonts.mono],
        },
        spacing: {
          'ads-0': spacing['0'],
          'ads-1': spacing['1'],
          'ads-2': spacing['2'],
          'ads-3': spacing['3'],
          'ads-4': spacing['4'],
          'ads-5': spacing['5'],
          'ads-6': spacing['6'],
          'ads-8': spacing['8'],
          'ads-12': spacing['12'],
        },
        borderRadius: {
          sm: radii.sm,
          md: radii.md,
          lg: radii.lg,
          full: radii.full,
        },
        boxShadow: {
          sm: shadows.sm,
          md: shadows.md,
          lg: shadows.lg,
          xl: shadows.xl,
          drawer: shadows.drawer,
          hotspot: shadows.hotspot,
        },
      },
    },
  },
);
