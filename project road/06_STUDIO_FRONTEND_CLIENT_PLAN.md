# Plan Document: 06_STUDIO_FRONTEND_CLIENT_PLAN.md
# Scope: Next.js 15 App Router Frontend Client (`apps/web`), Screen Inventory (SCR-01 to SCR-10), Interactive Canvas & Client State
# Traceable PRD Requirements: FR-101, FR-102, FR-201, FR-202, FR-301, FR-401, FR-402, FR-501, FR-503, FR-504, NFR-01, NFR-02, ACC-01, ACC-02, BR-03, EV-101–EV-302

---

## 1. Objective & Scope Boundaries

### 1.1 Objective
Build the production responsive web application for Project RoomCommerce in `apps/web` using **Next.js 15 (App Router, React 19)**, Tailwind CSS, `@roomcommerce/ui`, and `@roomcommerce/tokens`. This client orchestrates the end-to-end user journey across all ten canonical screens (`SCR-01` through `SCR-10`), featuring client-side WebAssembly EXIF sanitization, a multi-step intake wizard, a real-time SSE progress interface, and a high-performance interactive shoppable canvas with touch gestures and WCAG AA accessibility.

### 1.2 In-Scope
* **Full Screen Inventory Implementation (`SCR-01` to `SCR-10`):**
  * `SCR-01` (`/`): Landing & Discovery Showcase with guest upload CTA and FTC disclosure.
  * `SCR-02` (`/auth`): Passwordless magic link and social OAuth modal.
  * `SCR-03` (`/studio`): Workspace Hub displaying active renders within the 7-day retention window.
  * `SCR-04` (`/studio/new/upload`): Wizard Step 1 — Photo intake with client-side WASM EXIF/GPS scrubbing.
  * `SCR-05` (`/studio/new/inspect`): Wizard Step 2 — Automated quality gate review and perspective crop.
  * `SCR-06` (`/studio/new/configure`): Wizard Step 3 — Style preset selector and budget slider.
  * `SCR-07` (`/studio/render/[job_id]`): Real-time SSE generation pipeline status monitor.
  * `SCR-08` (`/studio/view/[project_id]`): Interactive Shoppable Canvas with zoom/pan and pulsing pins.
  * `SCR-08A`: Contextual Product Detail Drawer (responsive desktop sidebar / mobile bottom sheet).
  * `SCR-08B` (`/studio/view/[project_id]#list`): WCAG 2.1 AA compliant DOM table shopping list view.
  * `SCR-09` (`/checkout`): Stripe $14.99 30-Day Move-In Pass checkout overlay.
  * `SCR-10` (`/account`): Account settings, pass duration countdown, and 1-click hard deletion (`PRV-02`).
* **State Management Architecture:**
  * Zustand store (`useCanvasStore`) for zoom scale, pan coordinates, active pin ID, and sheet open states.
  * TanStack Query v5 for server state caching and optimistic UI updates.
  * Custom SSE hook (`usePipelineStream`) consuming real-time pipeline status events.
* **Core Web Vitals Optimization:** Next.js Image component optimization, font preloading (`Plus Jakarta Sans`), LCP $< 2.5\text{s}$, CLS $< 0.1$.

### 1.3 Explicit Exclusions (Deferred to Subsequent Plans)
* Implementing automated security penetration tests and BOLA audits (deferred to `07_SECURITY_PRIVACY_HARDENING_PLAN.md`).
* Playwright end-to-end multi-browser test suites (deferred to `08_INTEGRATION_AND_E2E_QA_PLAN.md`).
* Staging deployment, Cloudflare edge caching, and canary traffic routing (deferred to `09_DEPLOYMENT_AND_CANARY_PLAN.md`).

---

## 2. Prerequisites & Dependency Matrix

### 2.1 Preceding Milestones
* `00_MASTER_EXECUTION_INDEX.md` approved.
* `01_MONOREPO_FOUNDATION_PLAN.md` approved (`packages/tokens` and `packages/contracts` ready).
* `04_CORE_BACKEND_API_PLAN.md` approved (NestJS backend API endpoints accessible).
* `05_DESIGN_SYSTEM_AND_UI_PLAN.md` approved (`@roomcommerce/ui` components ready).

### 2.2 System & Tooling Dependencies
* **Framework:** Next.js `15.0.3` (App Router), React `19.0.0`.
* **State & Query:** `zustand@^5.0.1`, `@tanstack/react-query@^5.59.0`.
* **Client Sanitization:** `piexifjs` / WebAssembly EXIF scrubber module.
* **Payment Integration:** `@stripe/stripe-js@^4.9.0`.

### 2.3 Required Environment Variables
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_mock_stripe_key
NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_DOMAIN=https://cdn.roomcommerce.internal
```

---

## 3. Step-by-Step Implementation Sequence

### Step 6.1: Next.js Root Layout & Font Orchestration (`apps/web/src/app/layout.tsx`)
Configure the global HTML shell, preloading `Plus Jakarta Sans` and `JetBrains Mono` fonts and injecting Atelier Design System theme CSS variables.

* **Target Files:**
  * `apps/web/src/app/layout.tsx`
  * `apps/web/src/app/globals.css`
  * `apps/web/src/providers/query-provider.tsx`

* **Concrete Root Layout Implementation:**
```tsx
// apps/web/src/app/layout.tsx
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { QueryProvider } from '../providers/query-provider';
import '../globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Project RoomCommerce — AI Spatial Interior Redesign & Multi-Retailer Commerce',
  description: 'Photograph your room and receive a photorealistic redesign populated with verified, in-stock furniture from IKEA, Target, Wayfair, and Amazon.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${jetBrainsMono.variable}`}>
      <body className="bg-bg-canvas text-ink-primary font-sans antialiased min-h-screen flex flex-col selection:bg-brand-terracotta-subtle selection:text-brand-terracotta">
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
```

---

### Step 6.2: Client-Side EXIF Scrubbing Utility (`useExifScrubber.ts`)
Implement zero-leak client-side privacy sanitization stripping all GPS, device telemetry, and camera serial numbers before image upload (`FR-102`, `SEC-02`).

* **Target Files:**
  * `apps/web/src/lib/exif-scrubber.ts`
  * `apps/web/src/hooks/use-exif-scrubber.ts`

* **Concrete EXIF Stripper Implementation:**
```typescript
// apps/web/src/lib/exif-scrubber.ts
/**
 * Strips all EXIF, GPS, and device metadata by rendering the file
 * onto an offscreen HTML5 canvas element and re-exporting clean binary blobs.
 */
export async function stripExifMetadata(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to acquire 2D canvas context'));
        return;
      }

      // Draw image onto canvas (Canvas export naturally discards all EXIF segments)
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create sanitized blob'));
          }
        },
        file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        0.95
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Invalid image file'));
    };

    img.src = objectUrl;
  });
}
```

---

### Step 6.3: Multi-Step Redesign Intake Wizard (`SCR-04` to `SCR-06`)
Build the seamless 3-step capture flow in `apps/web/src/app/(studio)/studio/new/`.

* **Target Files:**
  * `apps/web/src/app/(studio)/studio/new/upload/page.tsx` (`SCR-04`: Intake Dropzone)
  * `apps/web/src/app/(studio)/studio/new/inspect/page.tsx` (`SCR-05`: Quality Review)
  * `apps/web/src/app/(studio)/studio/new/configure/page.tsx` (`SCR-06`: Style & Budget)

* **Intake Wizard State Store:**
```typescript
// apps/web/src/stores/use-wizard-store.ts
import { create } from 'zustand';
import { StylePresetEnum, RoomFunctionEnum } from '@roomcommerce/contracts';

interface WizardState {
  rawImageFile: File | null;
  sanitizedBlob: Blob | null;
  previewUrl: string | null;
  stylePreset: StylePresetEnum;
  roomFunction: RoomFunctionEnum;
  budgetCents: number;
  projectId: string | null;
  setRawImage: (file: File, sanitized: Blob, previewUrl: string) => void;
  setStylePreset: (style: StylePresetEnum) => void;
  setBudgetCents: (cents: number) => void;
  setProjectId: (id: string) => void;
  reset: () => void;
}

export const useWizardStore = create<WizardState>((set) => ({
  rawImageFile: null,
  sanitizedBlob: null,
  previewUrl: null,
  stylePreset: StylePresetEnum.JAPANDI,
  roomFunction: RoomFunctionEnum.LIVING_ROOM,
  budgetCents: 150000, // $1,500.00 default
  projectId: null,
  setRawImage: (file, sanitized, previewUrl) => set({ rawImageFile: file, sanitizedBlob: sanitized, previewUrl }),
  setStylePreset: (stylePreset) => set({ stylePreset }),
  setBudgetCents: (budgetCents) => set({ budgetCents }),
  setProjectId: (projectId) => set({ projectId }),
  reset: () => set({ rawImageFile: null, sanitizedBlob: null, previewUrl: null, projectId: null }),
}));
```

---

### Step 6.4: Real-Time SSE Inference Status View (`SCR-07`)
Build `/studio/render/[job_id]` consuming live Server-Sent Events with automated timeout error handling (`NFR-06`, `EV-102`).

* **Target Files:**
  * `apps/web/src/app/(studio)/studio/render/[job_id]/page.tsx`
  * `apps/web/src/hooks/use-pipeline-stream.ts`

* **Concrete Pipeline Stream Hook:**
```typescript
// apps/web/src/hooks/use-pipeline-stream.ts
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface PipelineProgress {
  phase: 'DEPTH_ESTIMATION' | 'INPAINTING' | 'CATALOG_MATCHING' | 'COMPLETE';
  percent: number;
  message: string;
  projectId: string;
}

export function usePipelineStream(projectId: string | null) {
  const router = useRouter();
  const [progress, setProgress] = useState<PipelineProgress>({
    phase: 'DEPTH_ESTIMATION',
    percent: 15,
    message: 'Analyzing spatial room perspective...',
    projectId: projectId || '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const eventSource = new EventSource(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/projects/${projectId}/events`
    );

    eventSource.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data) as PipelineProgress;
      setProgress(data);
    });

    eventSource.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      eventSource.close();
      router.push(`/studio/view/${data.projectId}`);
    });

    eventSource.addEventListener('error', () => {
      eventSource.close();
      setError('Generation process interrupted. Your render credits have been restored.');
    });

    return () => eventSource.close();
  }, [projectId, router]);

  return { progress, error };
}
```

---

### Step 6.5: Interactive Shoppable Canvas & Hotspot Pins (`SCR-08`)
Implement the high-performance canvas component with pan/zoom gestures, pulsing pins, and drawer locking (`FR-401`, `SCR-08`).

* **Target Files:**
  * `apps/web/src/app/(studio)/studio/view/[project_id]/page.tsx`
  * `apps/web/src/components/canvas/interactive-canvas.tsx`
  * `apps/web/src/stores/use-canvas-store.ts`

* **Zustand Canvas State Store:**
```typescript
// apps/web/src/stores/use-canvas-store.ts
import { create } from 'zustand';

interface CanvasState {
  zoomScale: number;
  panOffset: { x: number; y: number };
  selectedHotspotId: string | null;
  isDrawerOpen: boolean;
  showHotspots: boolean;
  setZoomScale: (scale: number) => void;
  setPanOffset: (offset: { x: number; y: number }) => void;
  selectHotspot: (id: string | null) => void;
  toggleHotspots: () => void;
  closeDrawer: () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  zoomScale: 1.0,
  panOffset: { x: 0, y: 0 },
  selectedHotspotId: null,
  isDrawerOpen: false,
  showHotspots: true,
  setZoomScale: (zoomScale) => set({ zoomScale }),
  setPanOffset: (panOffset) => set({ panOffset }),
  selectHotspot: (id) => set({ selectedHotspotId: id, isDrawerOpen: Boolean(id) }),
  toggleHotspots: () => set((s) => ({ showHotspots: !s.showHotspots })),
  closeDrawer: () => set({ isDrawerOpen: false, selectedHotspotId: null }),
}));
```

* **Interactive Canvas Component (`interactive-canvas.tsx`):**
```tsx
// apps/web/src/components/canvas/interactive-canvas.tsx
'use client';
import * as React from 'react';
import { useCanvasStore } from '../../stores/use-canvas-store';
import { AdsCanvasHotspot } from '@roomcommerce/ui';

export interface HotspotPinData {
  id: string;
  normX: number;
  normY: number;
  category: string;
  priceCents: number;
}

export interface InteractiveCanvasProps {
  renderedImageUrl: string;
  isWatermarked: boolean;
  hotspots: HotspotPinData[];
}

export function InteractiveCanvas({ renderedImageUrl, isWatermarked, hotspots }: InteractiveCanvasProps) {
  const { showHotspots, selectedHotspotId, selectHotspot } = useCanvasStore();

  return (
    <div className="relative w-full h-full overflow-hidden bg-bg-canvas flex items-center justify-center select-none">
      {/* Visual Render Container */}
      <div className="relative max-w-full max-h-full aspect-[4/3] shadow-lg rounded-md overflow-hidden">
        <img
          src={renderedImageUrl}
          alt="AI Redesigned Room Concept"
          className="w-full h-full object-contain pointer-events-none"
        />

        {/* Free Tier Semi-Transparent Diagonal Watermark (FR-503) */}
        {isWatermarked && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center rotate-[-30deg] opacity-20">
            <span className="font-mono text-4xl font-bold uppercase tracking-widest text-ink-primary">
              PROJECT ROOMCOMMERCE
            </span>
          </div>
        )}

        {/* Pulsing Hotspot Pins Layer */}
        {showHotspots &&
          hotspots.map((pin) => (
            <AdsCanvasHotspot
              key={pin.id}
              id={pin.id}
              normX={pin.normX}
              normY={pin.normY}
              category={pin.category}
              priceCents={pin.priceCents}
              isSelected={selectedHotspotId === pin.id}
              onClick={(id) => selectHotspot(id)}
            />
          ))}
      </div>
    </div>
  );
}
```

---

### Step 6.6: Workspace Hub & Account Settings (`SCR-03`, `SCR-10`)
Implement `/studio` project management with 7-day expiration indicators and `/account` 1-click hard erasure dialog (`PRV-02`).

* **Target Files:**
  * `apps/web/src/app/(studio)/studio/page.tsx` (`SCR-03`: Projects Hub)
  * `apps/web/src/app/(account)/account/page.tsx` (`SCR-10`: Account & Purge)

* **Purge Confirmation Trigger (`account/page.tsx`):**
```tsx
// Handled within apps/web/src/app/(account)/account/page.tsx
async function handleHardPurge() {
  if (confirm('Are you sure you want to permanently delete all your rooms, photos, and project history? This action is immediate and cannot be undone.')) {
    await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/privacy/purge-me`, {
      method: 'POST',
      credentials: 'include',
    });
    window.location.href = '/';
  }
}
```

---

## 4. Test & Verification Gate

### 4.1 Coverage Targets
* **Client Component Unit Tests:** $\ge 85\%$ coverage on React components and custom hooks.
* **Core Web Vitals:** LCP $< 2.5\text{s}$, FID $< 100\text{ms}$, CLS $< 0.1$ across all routes.
* **A11y Automated Audit:** Zero Axe violations across `SCR-01` through `SCR-10`.

### 4.2 Automated Verification Commands
```bash
# 1. Run Next.js production build and static analysis
pnpm --filter @roomcommerce/web build

# 2. Run unit and hook testing suite with Vitest
pnpm --filter @roomcommerce/web test -- --coverage

# 3. Verify zero EXIF metadata transmission in client upload test
pnpm --filter @roomcommerce/web test test/exif-scrubber.spec.ts

# 4. Verify lighthouse performance benchmark
pnpm --filter @roomcommerce/web exec lighthouse-ci collect
```

### 4.3 Acceptance Criteria Checklist
* [ ] `stripExifMetadata` completely removes GPS coordinates and camera serial tags from uploaded JPEGs.
* [ ] Multi-step intake wizard smoothly transitions: `upload` ➔ `inspect` ➔ `configure`.
* [ ] SSE progress screen (`SCR-07`) receives phased progress and redirects automatically to canvas upon completion.
* [ ] Interactive canvas renders hotspot pins at exact normalized coordinates with zero clipping.
* [ ] Tapping a pin opens `AdsProductDrawer` in $\le 150\text{ms}$ displaying title, verified price, and dimensions.
* [ ] Free-tier renders display the semi-transparent diagonal watermark (`FR-503`).
* [ ] Accessible DOM shopping list view (`SCR-08B`) presents screen-reader table alternative.

---

## 5. Potential Blockers & Rollback Protocols

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                BLOCKERS & RESOLUTION MATRIX                            │
├─────────────────────────┬────────────────────────────┬─────────────────────────────────┤
│ Failure Mode            │ Impact / Symptom           │ Mitigation & Resolution         │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ Mobile Canvas Pinch-to- │ Unintentional page refresh │ Apply CSS `touch-action: none`  │
│ Zoom Triggers Pull-Down │ or browser zoom gesture    │ on canvas viewport wrapper.     │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ Heavy Image Hydration   │ Next.js Image component    │ Use standard HTML5 `<img>` with │
│ Lag on Low-End Mobile   │ causes UI stutter on zoom  │ `mix-blend-multiply` for pins.  │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ Safari WebAssembly      │ EXIF scrubber hangs on     │ Implement canvas fallback if    │
│ Compatibility Issue     │ legacy iOS WebKit          │ WASM fails initialization.      │
└─────────────────────────┴────────────────────────────┴─────────────────────────────────┘
```

### Rollback Protocol
If any client route breaks in production:
1. Revert to previous Next.js standalone container deployment.
2. Invalidate Cloudflare CDN edge cache for affected routes (`/studio/*`).
