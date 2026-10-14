# Plan Document: 05_DESIGN_SYSTEM_AND_UI_PLAN.md
# Scope: Atelier Design System (ADS) Component Library (`packages/ui`), Primitives, Inputs, Feedback & Accessibility
# Traceable PRD Requirements: ACC-01, ACC-02, FR-201, FR-202, FR-401, FR-402, BR-03, NFR-02

---

## 1. Objective & Scope Boundaries

### 1.1 Objective
Construct the shared, accessible UI component library for Project RoomCommerce in `packages/ui`. This library materializes **Direction A: Editorial Atelier** into reusable, forward-ref capable React 19 components using `@roomcommerce/tokens`, Tailwind CSS, and Radix UI headless primitives. The component system establishes the tactile, architectural aesthetic required for high-capital home decor procurement while enforcing strict WCAG 2.1 Level AA compliance.

### 1.2 In-Scope
* **Component Architecture & Directory Topology:** Co-located component structure (`[name].tsx`, `[name].types.ts`, `[name].test.tsx`, `[name].stories.tsx`, `index.ts`).
* **Primitives Category (`packages/ui/src/primitives/`):**
  * `AdsButton`: Primary (Terracotta), Secondary (Bordered), Ghost, Danger, with loading spinner (`aria-busy`), disabled states, and size scales.
  * `AdsBadge`: Metadata badges (Similarity score, "In Stock", "Only 2 Left", Retailer tags).
  * `AdsIcon`: Lucide icon wrapper standardized to $1.75\text{px}$ optical stroke.
  * `AdsDivider`: Structural architectural separators (`#E6E2DC`).
* **Inputs Category (`packages/ui/src/inputs/`):**
  * `AdsBudgetSlider`: Accessible range slider ($300 to $10,000) with thumb touch target $\ge 48\text{px}$.
  * `AdsStyleCardSelector`: Grid selector for the 8 approved style presets with active selection rings.
  * `AdsDropzone`: Drag-and-drop file intake supporting JPG, PNG, HEIC with validation feedback.
* **Feedback Category (`packages/ui/src/feedback/`):**
  * `AdsProgressBar`: Phased linear indicator matching SSE status intervals (Depth ➔ Style ➔ SKUs).
  * `AdsModalDialog`: Accessible modal container with focus trapping and ESC dismissal.
  * `AdsToast`: Non-blocking system feedback toasts (success, warning, error).
* **Navigation Category (`packages/ui/src/navigation/`):**
  * `AdsAppHeader`: Desktop fixed header with logo, project links, pass counter, and account menu.
  * `AdsMobileBottomBar`: Fixed 3-button bottom bar with central floating capture action.
  * `AdsProductDrawer`: Desktop sliding drawer (400px) / mobile bottom sheet with SKU metadata, verified price, metric/imperial dimensions, outbound affiliate CTA, and mandatory FTC disclosure (`BR-03`).
* **Data Display Category (`packages/ui/src/data-display/`):**
  * `AdsCanvasHotspot`: Concentric pulsating coordinate pin ($8\text{px}$ core, $24\text{px}$ ring, $2400\text{ms}$ pulse, hover/selected states).
  * `AdsSkuSpecTable`: Full WCAG 2.1 AA compliant DOM table alternative for screen readers (`SCR-08B`, `ACC-02`).
  * `AdsBudgetGauge`: Spending progress bar comparing cumulative cart total against room ceiling.
  * `AdsProjectCard`: Saved render card with 7-day expiration countdown meter.

### 1.3 Explicit Exclusions (Deferred to Subsequent Plans)
* Building route layouts and Next.js page controllers (deferred to `06_STUDIO_FRONTEND_CLIENT_PLAN.md`).
* Implementing client-side WebAssembly EXIF scrubber (deferred to `06_STUDIO_FRONTEND_CLIENT_PLAN.md` and `07_SECURITY_PRIVACY_HARDENING_PLAN.md`).
* Integrating live API endpoints and SSE stream subscriptions (deferred to `06_STUDIO_FRONTEND_CLIENT_PLAN.md`).

---

## 2. Prerequisites & Dependency Matrix

### 2.1 Preceding Milestones
* `00_MASTER_EXECUTION_INDEX.md` approved.
* `01_MONOREPO_FOUNDATION_PLAN.md` approved (`packages/tokens` CSS variables and Tailwind plugin exported).

### 2.2 System & Tooling Dependencies
* **Framework:** React `19.0.0` (Client & Server Components compatibility).
* **Styling:** Tailwind CSS `v3.4.x` consuming `@roomcommerce/tokens` plugin, `class-variance-authority` (cva), `clsx`, `tailwind-merge`.
* **Headless Primitives:** Radix UI (`@radix-ui/react-dialog`, `@radix-ui/react-slider`, `@radix-ui/react-radio-group`, `@radix-ui/react-tooltip`).
* **Icons:** `lucide-react@^0.460.0`.
* **Testing:** Vitest `v2.1.0` + React Testing Library + `@testing-library/jest-dom` + `axe-core`.

---

## 3. Step-by-Step Implementation Sequence

### Step 5.1: Package Foundation & Utility Helpers (`packages/ui`)
Configure package manifests, build scripts, and the standard Tailwind class merging utility (`cn`).

* **Target Files:**
  * `packages/ui/package.json`
  * `packages/ui/tsconfig.json`
  * `packages/ui/src/lib/utils.ts`

* **Concrete Utility Implementation:**
```typescript
// packages/ui/src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

### Step 5.2: Primitives Implementation (`AdsButton`, `AdsBadge`, `AdsDivider`)
Implement foundational interactive elements enforcing Direction A colors and focus rings.

* **Target Files:**
  * `packages/ui/src/primitives/button/ads-button.tsx`
  * `packages/ui/src/primitives/button/ads-button.types.ts`
  * `packages/ui/src/primitives/badge/ads-badge.tsx`
  * `packages/ui/src/primitives/divider/ads-divider.tsx`

* **Concrete `AdsButton` Implementation:**
```tsx
// packages/ui/src/primitives/button/ads-button.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-brand-terracotta text-ink-inverted hover:bg-brand-terracotta-hover focus-visible:ring-ink-primary shadow-sm',
        secondary: 'bg-bg-surface text-ink-primary border border-border-default hover:bg-bg-subtle focus-visible:ring-ink-primary',
        ghost: 'text-ink-secondary hover:text-ink-primary hover:bg-bg-subtle focus-visible:ring-ink-primary',
        danger: 'bg-bg-surface text-semantic-danger border border-semantic-danger hover:bg-semantic-danger-subtle focus-visible:ring-semantic-danger',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-sm gap-1.5',
        md: 'h-10 px-4 text-sm rounded-md gap-2',
        lg: 'h-12 px-6 text-base rounded-md gap-2.5 min-h-[48px]', // Touch compliance
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface AdsButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const AdsButton = React.forwardRef<HTMLButtonElement, AdsButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);

AdsButton.displayName = 'AdsButton';
```

---

### Step 5.3: Specialized Inputs (`AdsBudgetSlider`, `AdsStyleCardSelector`, `AdsDropzone`)
Implement core wizard configuration controls (`SCR-04`, `SCR-06`).

* **Target Files:**
  * `packages/ui/src/inputs/slider/ads-budget-slider.tsx`
  * `packages/ui/src/inputs/style-selector/ads-style-card-selector.tsx`
  * `packages/ui/src/inputs/dropzone/ads-dropzone.tsx`

* **Concrete `AdsBudgetSlider` Implementation:**
```tsx
// packages/ui/src/inputs/slider/ads-budget-slider.tsx
import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '../../lib/utils';

export interface AdsBudgetSliderProps {
  value: number; // in cents
  onChange: (valueCents: number) => void;
  minCents?: number;
  maxCents?: number;
  stepCents?: number;
  className?: string;
}

export function AdsBudgetSlider({
  value,
  onChange,
  minCents = 30000,   // $300 (FR-202)
  maxCents = 1000000, // $10,000
  stepCents = 5000,   // $50 increments
  className,
}: AdsBudgetSliderProps) {
  const formattedValue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value / 100);

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-ink-primary">Room Budget Guardrail</label>
        <span className="font-mono text-base font-semibold text-brand-terracotta">{formattedValue}</span>
      </div>

      <SliderPrimitive.Root
        className="relative flex items-center select-none touch-none w-full h-8"
        value={[value]}
        onValueChange={([val]) => val !== undefined && onChange(val)}
        min={minCents}
        max={maxCents}
        step={stepCents}
        aria-label="Room budget expenditure ceiling"
      >
        <SliderPrimitive.Track className="bg-border-default relative grow rounded-full h-1.5 overflow-hidden">
          <SliderPrimitive.Range className="absolute bg-brand-terracotta h-full rounded-full" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="block w-6 h-6 bg-bg-surface border-2 border-brand-terracotta rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-ink-primary focus:ring-offset-2 transition-transform active:scale-110 cursor-grab active:cursor-grabbing min-w-[48px] min-h-[48px] flex items-center justify-center -m-3"
          aria-valuetext={formattedValue}
        />
      </SliderPrimitive.Root>

      <div className="flex justify-between text-xs font-mono text-ink-muted">
        <span>$300 min</span>
        <span>$10,000 max</span>
      </div>
    </div>
  );
}
```

---

### Step 5.4: Interactive Canvas Hotspot Pin (`AdsCanvasHotspot`)
Implement the spatial coordinate pin satisfying Direction A physical motion and visual hierarchy (`FR-401`, `SCR-08`).

* **Target Files:**
  * `packages/ui/src/data-display/hotspot/ads-canvas-hotspot.tsx`
  * `packages/ui/src/data-display/hotspot/ads-canvas-hotspot.types.ts`

* **Concrete `AdsCanvasHotspot` Implementation:**
```tsx
// packages/ui/src/data-display/hotspot/ads-canvas-hotspot.tsx
import * as React from 'react';
import { cn } from '../../lib/utils';

export interface AdsCanvasHotspotProps {
  id: string;
  normX: number; // 0.0000 to 1.0000
  normY: number; // 0.0000 to 1.0000
  category: string;
  priceCents: number;
  isSelected: boolean;
  onClick: (id: string) => void;
  className?: string;
}

export function AdsCanvasHotspot({
  id,
  normX,
  normY,
  category,
  priceCents,
  isSelected,
  onClick,
  className,
}: AdsCanvasHotspotProps) {
  const formattedPrice = `$${(priceCents / 100).toFixed(0)}`;

  return (
    <div
      style={{ left: `${normX * 100}%`, top: `${normY * 100}%` }}
      className={cn('absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-20', className)}
    >
      {/* 48x48pt invisible touch hitbox for mobile touch compliance */}
      <button
        type="button"
        onClick={() => onClick(id)}
        className="relative w-12 h-12 flex items-center justify-center focus:outline-none"
        aria-label={`View ${category} priced at ${formattedPrice}`}
        aria-pressed={isSelected}
      >
        {/* Pulsing Beacon Ring (Idle State: 2400ms looping pulse) */}
        {!isSelected && (
          <span className="absolute w-6 h-6 rounded-full bg-brand-terracotta/40 animate-ping pointer-events-none duration-1000" />
        )}

        {/* Outer Ring */}
        <span
          className={cn(
            'relative flex items-center justify-center rounded-full transition-all duration-200 shadow-md',
            isSelected
              ? 'w-9 h-9 bg-bg-surface border-2 border-ink-primary scale-110'
              : 'w-7 h-7 bg-bg-surface/90 border border-white hover:scale-110 group-hover:bg-bg-surface'
          )}
        >
          {/* Inner Coordinate Core */}
          <span
            className={cn(
              'rounded-full transition-colors duration-150',
              isSelected ? 'w-2.5 h-2.5 bg-brand-terracotta' : 'w-2 h-2 bg-brand-terracotta'
            )}
          />
        </span>
      </button>

      {/* Mini Desktop Hover Tooltip */}
      <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none transition-opacity duration-150 z-30">
        <div className="bg-ink-primary text-ink-inverted px-2.5 py-1 rounded-sm text-xs font-mono whitespace-nowrap shadow-lg flex items-center gap-1.5">
          <span className="capitalize">{category.replace('_', ' ')}</span>
          <span className="text-brand-terracotta font-semibold">{formattedPrice}</span>
        </div>
      </div>
    </div>
  );
}
```

---

### Step 5.5: Contextual Product Detail Drawer (`AdsProductDrawer`)
Implement the responsive detail sheet (`SCR-08A`) with retailer branding, dimensions, similarity rating, affiliate CTA, and mandatory FTC disclosure (`FR-402`, `BR-03`).

* **Target Files:**
  * `packages/ui/src/navigation/product-drawer/ads-product-drawer.tsx`

* **Concrete Implementation:**
```tsx
// packages/ui/src/navigation/product-drawer/ads-product-drawer.tsx
import * as React from 'react';
import { X, ExternalLink, ShieldCheck } from 'lucide-react';
import { AdsButton } from '../../primitives/button/ads-button';
import { AdsBadge } from '../../primitives/badge/ads-badge';
import { cn } from '../../lib/utils';

export interface ProductDrawerData {
  hotspotId: string;
  skuId: string;
  retailerName: string;
  title: string;
  priceCents: number;
  dimensionsCm: { width: number; depth: number; height: number };
  similarityScore: number;
  inStock: boolean;
  imageUrl: string;
  redirectUrl: string;
}

export interface AdsProductDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductDrawerData | null;
  className?: string;
}

export function AdsProductDrawer({ isOpen, onClose, product, className }: AdsProductDrawerProps) {
  if (!isOpen || !product) return null;

  const matchPercent = Math.round(product.similarityScore * 100);
  const formattedPrice = `$${(product.priceCents / 100).toFixed(2)}`;
  const { width, depth, height } = product.dimensionsCm;
  // Metric and Imperial conversion
  const widthIn = (width / 2.54).toFixed(1);
  const depthIn = (depth / 2.54).toFixed(1);
  const heightIn = (height / 2.54).toFixed(1);

  return (
    <aside
      className={cn(
        // Desktop: Right fixed sidebar (400px); Mobile: Bottom slide sheet
        'fixed inset-y-0 right-0 z-40 w-full sm:w-[400px] bg-bg-surface border-l border-border-default shadow-xl flex flex-col transition-transform duration-280 ease-out',
        className
      )}
      role="dialog"
      aria-labelledby="drawer-product-title"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-default">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-secondary">
            {product.retailerName}
          </span>
          <AdsBadge variant={product.inStock ? 'success' : 'danger'}>
            {product.inStock ? 'In Stock' : 'Out of Stock'}
          </AdsBadge>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-ink-muted hover:text-ink-primary rounded-sm focus:outline-none focus:ring-2 focus:ring-ink-primary"
          aria-label="Close product details"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Isolated Product Image Container (1:1 Aspect Ratio) */}
        <div className="w-full aspect-square bg-bg-canvas rounded-md overflow-hidden border border-border-default flex items-center justify-center p-4">
          <img
            src={product.imageUrl}
            alt={product.title}
            className="w-full h-full object-contain mix-blend-multiply"
          />
        </div>

        {/* Product Identity */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-mono font-semibold text-brand-olive bg-brand-terracotta-subtle px-2 py-0.5 rounded-sm">
              {matchPercent}% Visual Match
            </span>
          </div>
          <h2 id="drawer-product-title" className="text-lg font-semibold text-ink-primary leading-snug">
            {product.title}
          </h2>
          <div className="mt-2 text-2xl font-mono font-bold text-ink-primary">{formattedPrice}</div>
        </div>

        {/* Physical Dimensions Spec Table */}
        <div className="border border-border-default rounded-md p-3.5 bg-bg-subtle/50 space-y-1.5">
          <div className="text-xs font-medium text-ink-secondary uppercase tracking-wider">Spatial Dimensions</div>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div>
              <span className="text-ink-muted">Metric: </span>
              <span className="text-ink-primary font-medium">{width}W × {depth}D × {height}H cm</span>
            </div>
            <div>
              <span className="text-ink-muted">Imperial: </span>
              <span className="text-ink-primary font-medium">{widthIn}"W × {depthIn}"D × {heightIn}"H</span>
            </div>
          </div>
        </div>
      </div>

      {/* Drawer Footer & Compliance CTA */}
      <div className="p-5 border-t border-border-default bg-bg-surface space-y-3">
        <AdsButton
          variant="primary"
          size="lg"
          className="w-full justify-between"
          onClick={() => window.open(product.redirectUrl, '_blank', 'noopener,noreferrer')}
        >
          <span>View at {product.retailerName}</span>
          <ExternalLink className="w-4 h-4 ml-2" />
        </AdsButton>

        {/* Mandatory FTC Affiliate Disclosure (BR-03) */}
        <p className="text-[11px] text-ink-muted leading-tight text-center">
          We may earn an affiliate commission from qualifying purchases made via links on this page.
        </p>
      </div>
    </aside>
  );
}
```

---

### Step 5.6: Accessible DOM Shopping List (`AdsSkuSpecTable`)
Implement the screen-reader accessible structured DOM table alternative (`SCR-08B`, `ACC-02`).

* **Target Files:**
  * `packages/ui/src/data-display/spec-table/ads-sku-spec-table.tsx`

* **Concrete Implementation:**
```tsx
// packages/ui/src/data-display/spec-table/ads-sku-spec-table.tsx
import * as React from 'react';
import { ExternalLink } from 'lucide-react';
import type { ProductDrawerData } from '../product-drawer/ads-product-drawer';

export interface AdsSkuSpecTableProps {
  products: ProductDrawerData[];
  onSelectProduct: (hotspotId: string) => void;
}

export function AdsSkuSpecTable({ products, onSelectProduct }: AdsSkuSpecTableProps) {
  return (
    <div className="w-full overflow-x-auto border border-border-default rounded-md bg-bg-surface">
      <table className="w-full text-left text-sm" aria-label="Shoppable room furniture specification list">
        <thead className="bg-bg-subtle border-b border-border-default text-xs font-mono text-ink-secondary">
          <tr>
            <th scope="col" className="px-4 py-3">Item</th>
            <th scope="col" className="px-4 py-3">Retailer</th>
            <th scope="col" className="px-4 py-3">Price</th>
            <th scope="col" className="px-4 py-3">Dimensions (cm)</th>
            <th scope="col" className="px-4 py-3">Match</th>
            <th scope="col" className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-default font-mono text-xs">
          {products.map((item) => (
            <tr key={item.hotspotId} className="hover:bg-bg-subtle/50 transition-colors">
              <td className="px-4 py-3 font-sans font-medium text-ink-primary">{item.title}</td>
              <td className="px-4 py-3 uppercase text-ink-secondary">{item.retailerName}</td>
              <td className="px-4 py-3 font-bold text-ink-primary">${(item.priceCents / 100).toFixed(2)}</td>
              <td className="px-4 py-3 text-ink-muted">
                {item.dimensionsCm.width}W × {item.dimensionsCm.depth}D × {item.dimensionsCm.height}H
              </td>
              <td className="px-4 py-3 text-brand-olive font-semibold">
                {Math.round(item.similarityScore * 100)}%
              </td>
              <td className="px-4 py-3 text-right">
                <a
                  href={item.redirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-brand-terracotta hover:underline font-sans font-medium"
                  aria-label={`Buy ${item.title} on ${item.retailerName} for $${(item.priceCents / 100).toFixed(2)}`}
                >
                  Buy <ExternalLink className="w-3 h-3" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 4. Test & Verification Gate

### 4.1 Coverage Targets
* **Component Test Coverage:** $\ge 85\%$ across all components in `packages/ui`.
* **A11y Automated Audit:** Zero violations on `axe-core` assertions across all components.
* **Touch Target Enforcement:** $100\%$ compliance checking $\ge 48 \times 48\text{pt}$ bounding boxes on interactive elements.

### 4.2 Automated Verification Commands
```bash
# 1. Run Vitest component testing suite with jsdom
pnpm --filter @roomcommerce/ui test -- --coverage

# 2. Run automated Axe accessibility testing suite
pnpm --filter @roomcommerce/ui test test/a11y.spec.tsx

# 3. Verify Storybook isolated build
pnpm --filter @roomcommerce/ui build-storybook
```

### 4.3 Acceptance Criteria Checklist
* [ ] All buttons, drawer triggers, and hotspot pins have minimum touch boundaries $\ge 48\times48\text{pt}$.
* [ ] Contrast verification: Primary ink (`#1A1917`) on canvas (`#F9F8F6`) meets **15.8:1** (AAA); brand terracotta buttons meet $\ge 4.5:1$ (AA).
* [ ] Hotspot pins render concentric pulse animation with smooth hover expansion.
* [ ] Product drawer accurately formats metric and imperial dimensions and includes the mandatory FTC disclosure text.
* [ ] Accessible DOM shopping list table (`AdsSkuSpecTable`) passes screen reader navigational headers and row labeling.

---

## 5. Potential Blockers & Rollback Protocols

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                BLOCKERS & RESOLUTION MATRIX                            │
├─────────────────────────┬────────────────────────────┬─────────────────────────────────┤
│ Failure Mode            │ Impact / Symptom           │ Mitigation & Resolution         │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ Radix Slider Touch Event│ Budget slider thumb stutters│ Add `touch-action: none` to the │
│ Conflict on Mobile      │ on iOS Safari swipe        │ slider root element.            │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ Canvas Hotspot Clipping │ Pins positioned near image │ Clamp normalized coordinates:   │
│ Beyond Viewport Edge    │ edges clip off screen      │ `Math.min(Math.max(norm, 0.04), │
│                         │                            │ 0.96)`.                         │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ Next.js 15 SSR Hydration│ Discrepancies between SSR  │ Ensure interactive Radix        │
│ Mismatch on Dialogs     │ HTML and client state      │ primitives use `'use client'`   │
│                         │                            │ directive at file top.          │
└─────────────────────────┴────────────────────────────┴─────────────────────────────────┘
```

### Rollback Protocol
If any component introduces breaking visual or DOM regressions:
1. Revert to previous component git commit in `packages/ui`.
2. Clean rebuild tokens and UI packages: `pnpm --filter @roomcommerce/tokens build && pnpm --filter @roomcommerce/ui build`.
