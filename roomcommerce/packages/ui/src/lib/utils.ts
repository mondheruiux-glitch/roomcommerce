import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Standard Tailwind class-merging utility for the Atelier Design System.
 * Combines `clsx` (conditional joining) with `tailwind-merge` (conflict resolution).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
