/**
 * Atelier Design System — Tailwind CSS Plugin Declaration
 * Maps all ADS tokens to CSS variables and extends Tailwind theme.
 */

/**
 * The Atelier Tailwind plugin. Add to your tailwind.config.ts plugins array.
 *
 * @example
 * ```ts
 * import { atelierPlugin } from '@roomcommerce/tokens/tailwind-plugin';
 * export default { plugins: [atelierPlugin] };
 * ```
 */
export declare const atelierPlugin: {
  handler: (api: {
    addBase: (styles: Record<string, Record<string, string>>) => void;
  }) => void;
  config?: {
    theme?: {
      extend?: Record<string, unknown>;
    };
  };
};
