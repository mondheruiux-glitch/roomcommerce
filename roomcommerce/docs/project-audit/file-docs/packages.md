# RoomCommerce — Comprehensive Codebase Audit & Technical Reference
## Document 03.3: File-by-File Reference — Shared Packages (`packages/*`)

> **Subsystems:** `@roomcommerce/contracts`, `@roomcommerce/tokens`, `@roomcommerce/ui`, `@roomcommerce/config`  
> **Total Files:** 77 files  
> **Unit Test Coverage:** 142 passing tests across packages (35 contracts + 29 tokens + 78 UI)  
> **Build Status:** Built via `tsup` into dual ESM/CJS bundles with full TypeScript `.d.ts` declaration maps  

---

## 1. Package: `@roomcommerce/contracts` (11 Files)

Location: [`packages/contracts/`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts)

### Primary Responsibility
Defines the canonical, single source of truth for all API requests, responses, event schemas, and domain envelopes using **Zod**. Enforces strict runtime validation on both client and server.

### Key Files & Symbols:
* [`src/index.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts/src/index.ts): Central barrel file exporting all schemas, types, and error codes.
* [`src/enums.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts/src/enums.ts):
  * `StylePresetEnum`: `JAPANDI`, `WARM_MINIMALIST`, `SCANDINAVIAN`, `MID_CENTURY_MODERN`, `INDUSTRIAL_CHIC`, `COASTAL`, `MEDITERRANEAN`, `TRANSITIONAL` (8 presets).
  * `RoomFunctionEnum`: `LIVING_ROOM`, `BEDROOM`, `DINING_ROOM`, `HOME_OFFICE`, `OPEN_PLAN` (5 functions).
  * `RetailerEnum`: `IKEA`, `TARGET`, `WAYFAIR`, `AMAZON` (4 merchants).
  * `JobStatusEnum`: `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `TIMED_OUT`.
* [`src/projects.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts/src/projects.ts):
  * `CreateProjectSchema`: Validates budget ($300 to $10,000 / 30,000 to 1,000,000 cents), room function, and style preset.
  * `PresignedUploadResponseSchema`: Validates R2 presigned PUT URL and asset key.
  * `ProjectResponseSchema`: Serializes complete project state, image URLs, and associated hotspots.
* [`src/catalog.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts/src/catalog.ts):
  * `CatalogSkuSchema`: Validates retailer, title ($\le 512$ chars), priceCents ($\ge 0$), dimensions, and stock boolean.
  * `CanvasHotspotSchema`: Validates normalized coordinates (`normX`, `normY` between 0.0 and 1.0) and similarity score.
* [`src/api-envelope.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts/src/api-envelope.ts):
  * `ApiSuccessEnvelopeSchema`: Standardized response structure `{ success: true, data: T, timestamp: string }`.
  * `ApiErrorEnvelopeSchema`: Standardized error envelope `{ success: false, error: { code, message, details? }, timestamp }`.
* [`src/telemetry.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts/src/telemetry.ts):
  * `TelemetryEventSchema`: Validates all analytics events: EV-101 (`room_photo_uploaded`), EV-102 (`generation_initiated`), EV-103 (`generation_completed`), EV-201 (`product_pin_tapped`), EV-202 (`affiliate_outbound_clk`), EV-301 (`pass_paywall_viewed`), EV-302 (`pass_purchased` with exact $14.99 revenue validation).
* [`src/contracts.test.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts/src/contracts.test.ts):
  * **35/35 passing unit tests** verifying enum counts, boundary budgets, schema failures, and envelope wrapping.

---

## 2. Package: `@roomcommerce/tokens` (11 Files)

Location: [`packages/tokens/`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/tokens)

### Primary Responsibility
Codifies the **Atelier Design System (ADS)** Direction A (Editorial Atelier) design tokens into immutable TypeScript structures, CSS variables, and a Tailwind CSS preset.

### Design Tokens Breakdown:
* [`src/colors.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/tokens/src/colors.ts):
  * `bg.canvas`: `#FBF9F5` (warm plaster off-white)
  * `bg.surface`: `#FFFFFF` (pure white for cards/drawers)
  * `ink.primary`: `#1A1815` (deep charcoal-black, $\ge 15:1$ contrast)
  * `ink.secondary`: `#5C5852` (warm stone grey, $\ge 4.5:1$ contrast)
  * `ink.muted`: `#8C867E` (subdued grey)
  * `brand.terracotta`: `#C85A32` (signature Italian terracotta brand accent, $\ge 3:1$ large button contrast)
  * `semantic.danger`: `#DC2626` (destructive action red)
* [`src/spacing.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/tokens/src/spacing.ts): 8pt spatial grid (`spacing[0]` = 0px through `spacing[12]` = 64px / 4rem).
* [`src/typography.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/tokens/src/typography.ts):
  * Primary: Plus Jakarta Sans
  * Monospace: JetBrains Mono (used for prices, dimensions, coordinates, badges)
  * Scale: `d1` (36px/44px/700), `h1` (28px/36px/700), `h2` (22px/28px/600), `body` (15px/22px/400), `caption` (13px/18px/400), `label` (11px/14px/600 with +0.04em tracking).
* [`src/radii.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/tokens/src/radii.ts): `sm` (4px), `md` (8px), `lg` (12px), `xl` (16px), `full` (9999px).
* [`src/shadows.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/tokens/src/shadows.ts): Subtle warm architectural drop shadows + glowing hotspot ring pulse (`shadows.hotspot`).
* [`src/tailwind-plugin.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/tokens/src/tailwind-plugin.ts): Injects all tokens into Tailwind utility classes (`bg-canvas`, `text-ink-primary`, `bg-brand-terracotta`, `font-sans`, `font-mono`).
* [`src/tokens.test.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/tokens/src/tokens.test.ts):
  * **29/29 passing unit tests** mathematically asserting WCAG 2.1 AA and AAA contrast ratios against canvas and surface backgrounds.

---

## 3. Package: `@roomcommerce/ui` (47 Files)

Location: [`packages/ui/`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui)

### Primary Responsibility
The shared component library for the Atelier Design System. Built on top of Radix UI primitives and Tailwind styling, exported for use across Next.js and future micro-frontends.

### Component Taxonomy:
1. **Primitives:** `Button`, `IconButton`, `Badge`, `Card`, `Container`, `Divider`, `Tooltip`.
2. **Inputs:** `Input`, `Textarea`, `Select`, `Slider`, `Checkbox`, `RadioGroup`, `Switch`.
3. **Data Display:** `HotspotPin`, `ProductCard`, `Avatar`, `Table`, `Tag`.
4. **Feedback:** `Modal`, `Drawer`, `Alert`, `Toast`, `SkeletonLoader`, `ProgressRing`.
5. **Navigation:** `Tabs`, `Breadcrumb`, `DropdownMenu`, `Pagination`.
6. **Motion & React-Bits:** Selected micro-interactions (magnetic buttons, blur text animations, spring transitions).

### Unit Test Verification:
* [`src/data-display/data-display.test.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/data-display/data-display.test.tsx): 17 tests
* [`src/feedback/feedback.test.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/feedback/feedback.test.tsx): 13 tests
* [`src/inputs/inputs.test.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/inputs/inputs.test.tsx): 15 tests
* [`src/motion/motion.test.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/motion/motion.test.ts): 3 tests
* [`src/navigation/navigation.test.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/navigation/navigation.test.tsx): 13 tests
* [`src/primitives/primitives.test.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/primitives/primitives.test.tsx): 13 tests
* [`src/react-bits/react-bits.test.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/react-bits/react-bits.test.ts): 4 tests
* **Total: 78/78 passing tests.**

---

## 4. Package: `@roomcommerce/config` (8 Files)

Location: [`packages/config/`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/config)

### Primary Responsibility
Exports centralized Zod environment validation schemas ensuring runtime configuration safety across all monorepo apps and workers.
* [`src/env.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/config/src/env.ts): Validates required environment variables for database URLs, Redis, R2 buckets, Stripe keys, and Modal API endpoints.
