'use client';
import * as React from 'react';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export const STYLE_PRESETS = [
  { value: 'JAPANDI', label: 'Japandi', description: 'Japanese–Scandinavian harmony' },
  { value: 'MID_CENTURY_MODERN', label: 'Mid-Century Modern', description: 'Atomic age warmth' },
  { value: 'SCANDINAVIAN', label: 'Scandinavian', description: 'Clean nordic light' },
  { value: 'INDUSTRIAL', label: 'Industrial', description: 'Raw material honesty' },
  { value: 'MINIMALIST', label: 'Minimalist', description: 'Purposeful reduction' },
  { value: 'CONTEMPORARY', label: 'Contemporary', description: 'Current design currents' },
  { value: 'BOHEMIAN', label: 'Bohemian', description: 'Layered global eclecticism' },
  { value: 'MODERN_FARMHOUSE', label: 'Modern Farmhouse', description: 'Rural meets refined' },
] as const;

export type StylePreset = (typeof STYLE_PRESETS)[number]['value'];

export interface AdsStyleCardSelectorProps {
  value: StylePreset;
  onChange: (value: StylePreset) => void;
  className?: string;
}

/**
 * AdsStyleCardSelector — 8-preset style grid using @radix-ui/react-radio-group.
 * Arrow key navigation built-in via Radix.
 * Selected state: 2px terracotta border + terracotta-subtle fill + checkmark badge.
 */
export function AdsStyleCardSelector({ value, onChange, className }: AdsStyleCardSelectorProps) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(v) => onChange(v as StylePreset)}
      className={cn('grid grid-cols-2 sm:grid-cols-4 gap-3', className)}
      aria-label="Interior design style preference"
    >
      {STYLE_PRESETS.map((preset) => {
        const isSelected = value === preset.value;
        return (
          <RadioGroup.Item
            key={preset.value}
            value={preset.value}
            className={cn(
              'relative flex flex-col items-start p-3.5 rounded-md border-2 cursor-pointer',
              'transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-primary focus-visible:ring-offset-2',
              'min-h-[80px] text-left',
              isSelected
                ? 'border-brand-terracotta bg-brand-terracotta-subtle'
                : 'border-border-default bg-bg-surface hover:border-border-strong hover:bg-bg-subtle',
            )}
            aria-label={`${preset.label}: ${preset.description}`}
          >
            {/* Selected checkmark badge */}
            {isSelected && (
              <span
                className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-terracotta flex items-center justify-center"
                aria-hidden="true"
              >
                <Check className="w-3 h-3 text-ink-inverted" strokeWidth={2.5} />
              </span>
            )}

            <span
              className={cn(
                'text-sm font-semibold leading-tight',
                isSelected ? 'text-brand-terracotta' : 'text-ink-primary',
              )}
            >
              {preset.label}
            </span>
            <span className="mt-1 text-[11px] text-ink-muted leading-snug">
              {preset.description}
            </span>

            {/* Visually hidden native radio indicator */}
            <RadioGroup.Indicator className="sr-only" />
          </RadioGroup.Item>
        );
      })}
    </RadioGroup.Root>
  );
}
