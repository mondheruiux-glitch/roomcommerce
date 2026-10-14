# Plan Document: 01_MONOREPO_FOUNDATION_PLAN.md
# Scope: Monorepo Foundation, Workspace Tooling, Shared Contracts & Design Tokens
# Traceable PRD Requirements: SEC-03, NFR-04, FR-101, FR-102, FR-201, FR-202, BR-01, BR-02, BR-03, EV-101–EV-302

---

## 1. Objective & Scope Boundaries

### 1.1 Objective
Establish the production monorepo infrastructure using **Turborepo + pnpm workspaces** for Project RoomCommerce. This phase sets up the single source of truth for all data contracts (`packages/contracts`), the master token engine for the Atelier Design System (`packages/tokens`), shared workspace configurations (`packages/config`), and scaffolds clean application boundary stubs for `apps/web`, `apps/api`, and `workers/gpu-runner`.

### 1.2 In-Scope
* Root workspace configuration (`pnpm-workspace.yaml`, `turbo.json`, root `package.json`, `.npmrc`, `.gitignore`).
* Shared configuration packages (`packages/config/eslint`, `packages/config/typescript`, `packages/config/prettier`).
* Single Source of Truth contracts package (`packages/contracts`) exporting Zod schemas and TypeScript DTOs for:
  * Application Enums (`StylePresetEnum`, `RoomFunctionEnum`, `PassTierEnum`, `JobStatusEnum`).
  * API Request/Response Envelopes (`ApiSuccessResponse<T>`, `ApiErrorResponse`).
  * Project Intake & Ingestion schemas (`CreateProjectSchema`, `PresignedUploadSchema`).
  * Canonical Product Catalog SKU schema (`CatalogSkuSchema`, 50K SKU data structure).
  * Canvas Hotspots & Outbound Affiliate Click schemas (`CanvasHotspotSchema`, `AffiliateRedirectSchema`).
  * Funnel Telemetry Event schemas (`EV-101` through `EV-302`).
* Atelier Design System (ADS) master tokens package (`packages/tokens`) encoding Direction A (Editorial Atelier):
  * Physical color primitives and semantic ink/surface tokens.
  * Typographic scale (Plus Jakarta Sans + JetBrains Mono).
  * 8pt linear spacing scale and corner radii.
  * Structural borders, elevation shadows, and Tailwind CSS theme plugin.
* Application package skeletons (`apps/web`, `apps/api`, `workers/gpu-runner`, `packages/ui`).
* Environment variable schema using `@t3-oss/env-core` and root `.env.example`.
* GitHub Actions CI workflow (`.github/workflows/ci.yml`) and commit governance templates.

### 1.3 Explicit Exclusions (Deferred to Subsequent Plans)
* Implementing database DDL migrations and Qdrant indexers (deferred to `02_CATALOG_AND_VECTOR_PLAN.md`).
* Implementing PyTorch ML models and GPU worker logic (deferred to `03_ML_WORKER_PIPELINE_PLAN.md`).
* Implementing NestJS domain controllers, services, and BullMQ queues (deferred to `04_CORE_BACKEND_API_PLAN.md`).
* Building full React UI component library primitives (deferred to `05_DESIGN_SYSTEM_AND_UI_PLAN.md`).
* Building Next.js 15 pages and interactive canvas views (deferred to `06_STUDIO_FRONTEND_CLIENT_PLAN.md`).

---

## 2. Prerequisites & Dependency Matrix

### 2.1 Preceding Milestones
* `00_MASTER_EXECUTION_INDEX.md` reviewed and approved.

### 2.2 System & Tooling Requirements
* **Node.js:** `v22.11.0 LTS` or higher.
* **pnpm:** `v9.12.0` or higher (`corepack enable pnpm`).
* **Python:** `3.11.x` with `poetry >= 1.8.0` (for GPU runner container stub).
* **Turborepo:** `v2.2.0` or higher.
* **Git:** With Conventional Commits hook enforcement (`husky` + `commitlint`).

### 2.3 Environment Variables Required (`.env.example`)
```env
# System Runtime
NODE_ENV=development
PORT=4000
API_BASE_URL=http://localhost:4000
WEB_BASE_URL=http://localhost:3000

# PostgreSQL (Aurora)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/roomcommerce_dev?schema=public

# Redis (BullMQ & Cache)
REDIS_URL=redis://localhost:6379

# Cloudflare R2 (Presigned Uploads & Ephemeral Storage)
CLOUDFLARE_R2_ACCOUNT_ID=mock_r2_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=mock_r2_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=mock_r2_secret_key
CLOUDFLARE_R2_BUCKET_NAME=roomcommerce-dev-raw-uploads
CLOUDFLARE_R2_PUBLIC_DOMAIN=https://cdn-dev.roomcommerce.internal

# Qdrant Managed Vector DB
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=mock_qdrant_api_key

# Stripe Payment Processing
STRIPE_SECRET_KEY=sk_test_mock_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_mock_stripe_webhook_secret

# Serverless GPU Fleet (Modal)
MODAL_API_ENDPOINT=https://api.modal.run/v1/roomcommerce/render
MODAL_API_TOKEN=mock_modal_token
```

---

## 3. Step-by-Step Implementation Sequence

### Step 1.1: Root Monorepo Configuration & Tooling Setup
Configure root workspace definition files to establish strict package boundaries and intelligent pipeline caching.

* **Target Files:**
  * `package.json` (Root scripts, dev dependencies, engines constraint)
  * `pnpm-workspace.yaml` (Workspace package glob paths)
  * `turbo.json` (Task pipeline with strict input/output caching)
  * `.npmrc` (Strict hoist settings and peer dependency resolution)
  * `.gitignore` (Standardized monorepo ignore rules)

* **Concrete Configuration Artifacts:**

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'workers/*'
```

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "package.json", "tsconfig.json"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "test/**", "**/*.test.ts", "**/*.test.tsx"],
      "outputs": ["coverage/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    }
  }
}
```

```ini
# .npmrc
shamefully-hoist=false
strict-peer-dependencies=false
auto-install-peers=true
link-workspace-packages=true
```

---

### Step 1.2: Shared Configurations Package (`packages/config`)
Standardize linting, formatting, and TypeScript compilation rules across all frontend and backend codebases.

* **Target Files:**
  * `packages/config/package.json`
  * `packages/config/typescript/base.json` (Node 22 strict settings)
  * `packages/config/typescript/react.json` (Next.js 15 / React 19 JSX settings)
  * `packages/config/typescript/node.json` (NestJS 11 backend settings)
  * `packages/config/eslint/base.mjs` (ESLint 9 flat config for TypeScript)
  * `packages/config/eslint/react.mjs` (Next.js & React hooks rules)
  * `packages/config/eslint/nest.mjs` (NestJS backend rules)
  * `packages/config/prettier/index.json` (Prettier code formatting standard)

* **Concrete TypeScript Base Config:**
```json
// packages/config/typescript/base.json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

---

### Step 1.3: Data Contracts Package (`packages/contracts`)
Implement the Single Source of Truth for shared data models, API envelopes, and validation schemas using Zod.

* **Target Files:**
  * `packages/contracts/package.json`
  * `packages/contracts/tsconfig.json`
  * `packages/contracts/src/enums/index.ts`
  * `packages/contracts/src/api/envelope.schema.ts`
  * `packages/contracts/src/api/projects.schema.ts`
  * `packages/contracts/src/catalog/sku.schema.ts`
  * `packages/contracts/src/canvas/hotspot.schema.ts`
  * `packages/contracts/src/events/telemetry.schema.ts`
  * `packages/contracts/src/index.ts`

* **Concrete Contract Schemas:**

```typescript
// packages/contracts/src/enums/index.ts
export enum StylePresetEnum {
  JAPANDI = 'JAPANDI',
  MID_CENTURY_MODERN = 'MID_CENTURY_MODERN',
  SCANDINAVIAN = 'SCANDINAVIAN',
  INDUSTRIAL = 'INDUSTRIAL',
  MINIMALIST = 'MINIMALIST',
  CONTEMPORARY = 'CONTEMPORARY',
  BOHEMIAN = 'BOHEMIAN',
  MODERN_FARMHOUSE = 'MODERN_FARMHOUSE',
}

export enum RoomFunctionEnum {
  LIVING_ROOM = 'LIVING_ROOM',
  BEDROOM = 'BEDROOM',
  HOME_OFFICE = 'HOME_OFFICE',
  DINING_ROOM = 'DINING_ROOM',
  PATIO = 'PATIO',
}

export enum RetailerEnum {
  IKEA = 'IKEA',
  TARGET = 'TARGET',
  WAYFAIR = 'WAYFAIR',
  AMAZON = 'AMAZON',
}

export enum JobStatusEnum {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  TIMED_OUT = 'TIMED_OUT',
}
```

```typescript
// packages/contracts/src/api/envelope.schema.ts
import { z } from 'zod';

export const ApiSuccessEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z
      .object({
        timestamp: z.string().datetime(),
        requestId: z.string().uuid().optional(),
      })
      .optional(),
  });

export const ApiErrorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z
      .array(
        z.object({
          field: z.string(),
          message: z.string(),
        })
      )
      .optional(),
  }),
});

export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  meta?: { timestamp: string; requestId?: string };
};

export type ApiErrorResponse = z.infer<typeof ApiErrorEnvelopeSchema>;
```

```typescript
// packages/contracts/src/api/projects.schema.ts
import { z } from 'zod';
import { StylePresetEnum, RoomFunctionEnum } from '../enums';

export const CreateProjectSchema = z.object({
  style_preset: z.nativeEnum(StylePresetEnum),
  room_function: z.nativeEnum(RoomFunctionEnum).default(RoomFunctionEnum.LIVING_ROOM),
  budget_ceiling_cents: z.number().int().min(30000, 'Budget must be at least $300').max(1000000, 'Budget ceiling is $10,000'),
  currency: z.literal('USD').default('USD'),
});

export type CreateProjectDto = z.infer<typeof CreateProjectSchema>;

export const PresignedUploadResponseSchema = z.object({
  project_id: z.string().uuid(),
  upload_url: z.string().url(),
  upload_method: z.literal('PUT'),
  expires_in_seconds: z.number().int().default(300),
  max_size_bytes: z.number().int().default(20971520), // 20MB (FR-101)
  key: z.string(),
});

export type PresignedUploadResponseDto = z.infer<typeof PresignedUploadResponseSchema>;
```

```typescript
// packages/contracts/src/catalog/sku.schema.ts
import { z } from 'zod';
import { RetailerEnum } from '../enums';

export const CatalogSkuSchema = z.object({
  sku_id: z.string(),
  retailer_id: z.nativeEnum(RetailerEnum),
  title: z.string().min(1).max(512),
  category: z.string(),
  price_cents: z.number().int().nonnegative(),
  currency: z.literal('USD').default('USD'),
  dimensions_cm: z.object({
    width: z.number().positive(),
    depth: z.number().positive(),
    height: z.number().positive(),
  }),
  in_stock: z.boolean(),
  canonical_url: z.string().url(),
  affiliate_url: z.string().url(),
  primary_image_url: z.string().url(),
  last_verified_at: z.string().datetime(),
});

export type CatalogSkuDto = z.infer<typeof CatalogSkuSchema>;
```

```typescript
// packages/contracts/src/events/telemetry.schema.ts
import { z } from 'zod';

export const TelemetryEventSchema = z.discriminatedUnion('event_name', [
  z.object({
    event_name: z.literal('room_photo_uploaded'), // EV-101
    properties: z.object({
      file_format: z.enum(['image/jpeg', 'image/png', 'image/heic']),
      file_size_kb: z.number().positive(),
      resolution: z.string(),
      capture_source: z.enum(['camera', 'file_picker', 'drag_drop']),
    }),
  }),
  z.object({
    event_name: z.literal('generation_initiated'), // EV-102
    properties: z.object({
      style_preset: z.string(),
      budget_ceiling_cents: z.number().int(),
      anchor_items_count: z.number().int().default(0),
      pass_tier: z.enum(['anonymous', 'free', 'move_in_pass']),
    }),
  }),
  z.object({
    event_name: z.literal('generation_completed'), // EV-103
    properties: z.object({
      duration_ms: z.number().positive(),
      items_detected: z.number().int(),
      total_cart_val_cents: z.number().int(),
      gpu_worker_id: z.string(),
    }),
  }),
  z.object({
    event_name: z.literal('product_pin_tapped'), // EV-201
    properties: z.object({
      sku_id: z.string(),
      retailer_id: z.string(),
      price_cents: z.number().int(),
      similarity_score: z.number(),
      category: z.string(),
    }),
  }),
  z.object({
    event_name: z.literal('affiliate_outbound_clk'), // EV-202
    properties: z.object({
      sku_id: z.string(),
      retailer_id: z.string(),
      price_cents: z.number().int(),
      affiliate_network: z.string(),
      click_id: z.string().uuid(),
    }),
  }),
  z.object({
    event_name: z.literal('pass_paywall_viewed'), // EV-301
    properties: z.object({
      trigger_source: z.string(),
      renders_used_count: z.number().int(),
    }),
  }),
  z.object({
    event_name: z.literal('pass_purchased'), // EV-302
    properties: z.object({
      transaction_id: z.string(),
      revenue_cents: z.literal(1499),
      pass_type: z.literal('30_day_pass'),
    }),
  }),
]);

export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
```

---

### Step 1.4: Atelier Design System Master Tokens Package (`packages/tokens`)
Codify Direction A (Editorial Atelier) design tokens into immutable TypeScript dictionaries, native CSS variable injections, and a reusable Tailwind CSS plugin.

* **Target Files:**
  * `packages/tokens/package.json`
  * `packages/tokens/tsconfig.json`
  * `packages/tokens/src/colors.ts`
  * `packages/tokens/src/typography.ts`
  * `packages/tokens/src/spacing.ts`
  * `packages/tokens/src/shadows.ts`
  * `packages/tokens/src/tailwind-plugin.ts`
  * `packages/tokens/src/index.ts`

* **Concrete Token Implementations:**

```typescript
// packages/tokens/src/colors.ts
export const colors = {
  bg: {
    canvas: '#F9F8F6',    // Alabaster - Primary screen background
    surface: '#FFFFFF',   // Pure White - Elevated cards and modal surfaces
    subtle: '#F2EFEB',    // Warm Stone - Table header, hover fills
    muted: '#E6E2DC',     // Sandstone - Inactive boundaries, chip borders
    overlay: 'rgba(26, 25, 23, 0.45)', // Modal dimming backdrop
  },
  ink: {
    primary: '#1A1917',   // Charcoal Ash - High contrast body (15.8:1 WCAG AAA)
    secondary: '#57534E', // Slate Stone - Secondary labels, spec keys (6.8:1 WCAG AA)
    muted: '#8C857B',     // Dry Clay - Timestamps, helper notes (4.6:1 WCAG AA)
    inverted: '#FAF8F5',  // Pure Cream - Text on dark buttons & terracotta CTA
  },
  brand: {
    terracotta: '#B85D3A',       // Terre Battue - Primary CTA, active hotspots
    'terracotta-hover': '#984B2E',// Pressed / hover button state
    'terracotta-subtle': '#F7EBE6',// Pill badge backgrounds
    olive: '#4E5E4A',            // Spatial dimensions & bounding wireframes
  },
  semantic: {
    success: '#2E6945',          // Verified stock, valid payment
    'success-subtle': '#EDF5F0',
    warning: '#A16207',          // Low stock alert (<= 2 left)
    'warning-subtle': '#FEF9C3',
    danger: '#B91C1C',           // Blur failure, payment error, purge action
    'danger-subtle': '#FEE2E2',
    info: '#2563EB',             // Depth guidelines & tips
  },
  border: {
    default: '#E6E2DC',
    strong: '#D6D1CA',
    interactive: '#1A1917',
  },
} as const;
```

```typescript
// packages/tokens/src/spacing.ts
export const spacing = {
  '0': '0px',
  '1': '4px',   // 0.25rem - Micro padding, badge vertical
  '2': '8px',   // 0.50rem - Icon-to-text gap, compact buttons
  '3': '12px',  // 0.75rem - Input vertical padding, chip spacing
  '4': '16px',  // 1.00rem - Container padding, card inner gaps
  '5': '24px',  // 1.50rem - Desktop gutters, drawer padding
  '6': '32px',  // 2.00rem - Section separation
  '8': '48px',  // 3.00rem - Major viewport division
  '12': '64px', // 4.00rem - Hero section vertical padding
} as const;

export const radii = {
  none: '0px',
  sm: '4px',    // Form inputs, badges, budget slider handles
  md: '8px',    // Drawer cards, thumbnails, dialog modals
  lg: '16px',   // Mobile sheet top edges
  full: '9999px', // Hotspot pins, pill chips, action buttons
} as const;
```

```typescript
// packages/tokens/src/typography.ts
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
```

```typescript
// packages/tokens/src/tailwind-plugin.ts
import plugin from 'tailwindcss/plugin';
import { colors } from './colors';
import { spacing, radii } from './spacing';
import { typography } from './typography';

export const atelierPlugin = plugin(
  ({ addBase }) => {
    addBase({
      ':root': {
        '--ads-color-bg-canvas': colors.bg.canvas,
        '--ads-color-bg-surface': colors.bg.surface,
        '--ads-color-bg-subtle': colors.bg.subtle,
        '--ads-color-bg-muted': colors.bg.muted,
        '--ads-color-ink-primary': colors.ink.primary,
        '--ads-color-ink-secondary': colors.ink.secondary,
        '--ads-color-ink-muted': colors.ink.muted,
        '--ads-color-ink-inverted': colors.ink.inverted,
        '--ads-color-brand-terracotta': colors.brand.terracotta,
        '--ads-color-brand-terracotta-hover': colors.brand['terracotta-hover'],
        '--ads-color-brand-terracotta-subtle': colors.brand['terracotta-subtle'],
        '--ads-color-brand-olive': colors.brand.olive,
        '--ads-color-border-default': colors.border.default,
        '--ads-color-border-strong': colors.border.strong,
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
          'border-default': 'var(--ads-color-border-default)',
          'border-strong': 'var(--ads-color-border-strong)',
        },
        fontFamily: {
          sans: [typography.fonts.sans],
          mono: [typography.fonts.mono],
        },
        borderRadius: {
          sm: radii.sm,
          md: radii.md,
          lg: radii.lg,
          full: radii.full,
        },
      },
    },
  }
);
```

---

### Step 1.5: Workspace Application Skeletons
Scaffold the minimal package skeletons with exact dependency declarations to verify Turborepo resolution.

* **Target Packages:**
  * `apps/web/package.json` (`next@15.0.3`, `react@19.0.0`, `@roomcommerce/tokens`, `@roomcommerce/contracts`)
  * `apps/web/next.config.mjs` (Standalone output, security headers, image domains for Cloudflare R2)
  * `apps/web/tsconfig.json` (References `@roomcommerce/config/typescript/react.json`)
  * `apps/api/package.json` (`@nestjs/core@11.0.0`, `@roomcommerce/contracts`, `zod`, `drizzle-orm`/`pg`, `bullmq`)
  * `apps/api/tsconfig.json` (References `@roomcommerce/config/typescript/node.json`)
  * `apps/api/nest-cli.json`
  * `workers/gpu-runner/pyproject.toml` (Poetry manifest: `torch >= 2.4.0`, `diffusers`, `transformers`, `modal >= 0.64.0`)
  * `packages/ui/package.json` (Package manifest stub consuming `@roomcommerce/tokens`)

* **Edge Cases Handled in Step 1.5:**
  * Strict separation between React 19 web dependencies and NestJS 11 Node dependencies to prevent root hoist collisions.
  * NodeNext module resolution configured uniformly so contracts export both ESM and CJS types without import errors.

---

### Step 1.6: Environment & Secret Management Protocol
Implement boot-time environment validation using `@t3-oss/env-core`.

* **Target Files:**
  * `apps/api/src/config/env.ts`
  * `apps/web/src/config/env.ts`
  * `.env.example`

* **Failure Mode Handled:** If any required variable (`DATABASE_URL`, `REDIS_URL`, `STRIPE_SECRET_KEY`) is missing or invalid on boot, the process immediately logs an explicit Zod validation table and terminates before accepting HTTP requests, preventing silent runtime failures.

---

### Step 1.7: CI/CD Pipeline & Development Hygiene
Establish automated gatekeeping on every Pull Request and commit.

* **Target Files:**
  * `.github/workflows/ci.yml` (Lint, typecheck, test, build matrix on Ubuntu)
  * `.github/pull_request_template.md` (Mandatory checklist and PRD requirement link)
  * `.commitlintrc.json` (Conventional commits rule: `feat:`, `fix:`, `chore:`, `perf:`)

* **Concrete GitHub Actions CI Pipeline:**
```yaml
# .github/workflows/ci.yml
name: Monorepo CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node.js 22 LTS
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - name: Install Monorepo Dependencies
        run: pnpm install --frozen-lockfile

      - name: Monorepo Typecheck & Lint
        run: pnpm turbo run typecheck lint

      - name: Unit & Contract Tests
        run: pnpm turbo run test -- --coverage

      - name: Production Build Check
        run: pnpm turbo run build
```

---

## 4. Test & Verification Gate

### 4.1 Coverage & Quality Targets
* **Unit Test Coverage:** $\ge 85\%$ across `packages/contracts` and `packages/tokens`.
* **TypeScript Compilation:** Zero errors under `strict: true` and `noImplicitAny: true`.
* **Turborepo Cache Efficiency:** Secondary run executes in $< 1.5\text{s}$ with `FULL TURBO` cache hits.

### 4.2 Automated Verification Commands
```bash
# 1. Verify clean dependency installation and lockfile immutability
pnpm install --frozen-lockfile

# 2. Verify TypeScript strict type-checking across all packages
pnpm turbo run typecheck

# 3. Verify linting compliance across workspace
pnpm turbo run lint

# 4. Execute unit test harness for tokens and contracts
pnpm turbo run test

# 5. Verify isolated compilation of all packages and application stubs
pnpm turbo run build
```

### 4.3 Acceptance Criteria Checklist
* [ ] Monorepo root cleanly executes `pnpm install` without hoist warnings or peer dependency conflicts.
* [ ] `@roomcommerce/contracts` correctly exports TypeScript types and Zod schemas with zero emitted `any` types.
* [ ] `@roomcommerce/tokens` outputs all Direction A color primitives, radii, spacing, and the Tailwind CSS plugin.
* [ ] WCAG contrast ratios in `colors.ts` verified programmatically ($\ge 4.5:1$ for body text, $\ge 15:1$ for primary ink).
* [ ] Turborepo task pipeline correctly caches builds with expected hash fingerprints.
* [ ] `.github/workflows/ci.yml` validates clean build on pull requests.

---

## 5. Potential Blockers & Rollback Protocols

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                BLOCKERS & RESOLUTION MATRIX                            │
├─────────────────────────┬────────────────────────────┬─────────────────────────────────┤
│ Failure Mode            │ Impact / Symptom           │ Mitigation & Resolution         │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ React 19 vs. NestJS 11  │ Dependency hoist collisions│ Enforce `shamefully-hoist=false`│
│ Peer Resolution Error   │ during root `pnpm install` │ in `.npmrc`; keep app lockfiles │
│                         │                            │ isolated in respective dirs.    │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ ESM/CJS Module Import   │ NestJS fails to import     │ Configure `moduleResolution:    │
│ Failure in Contracts    │ ESM-only Zod DTOs at boot  │ NodeNext` with dual exports in  │
│                         │                            │ `packages/contracts/package.json│
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ Turborepo Cache Misses  │ Build times exceed 3 mins  │ Pin input globs in `turbo.json` │
│ on Unchanged Packages   │ on unchanged modules       │ strictly to `src/**` & configs; │
│                         │                            │ exclude log files & `.env`.     │
└─────────────────────────┴────────────────────────────┴─────────────────────────────────┘
```

### Rollback Protocol
If dependency resolution or TypeScript transpilation fails catastrophically during initial scaffolding:
1. Revert `pnpm-lock.yaml` to last verified commit.
2. Run `pnpm store prune && rm -rf node_modules apps/*/node_modules packages/*/node_modules`.
3. Isolate the failing package using `pnpm --filter <pkg-name> install` before re-linking the workspace.
