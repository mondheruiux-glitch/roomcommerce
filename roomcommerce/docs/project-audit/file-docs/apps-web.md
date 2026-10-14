# RoomCommerce — Comprehensive Codebase Audit & Technical Reference
## Document 03.2: File-by-File Reference — Frontend Web Client (`apps/web`)

> **Subsystem:** Next.js 15 App Router (React 19, TypeScript)  
> **Total Files:** 35 files  
> **Production Build:** Verified Clean Compilation (11/11 static/dynamic routes generated)  
> **Styling Framework:** Tailwind CSS 3.4 with `@roomcommerce/tokens` preset  

---

## 1. Application Shell & Global Layout

### [`apps/web/src/app/layout.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/layout.tsx)
* **Layer:** Root Application Layout
* **Primary Responsibility:** Injects Plus Jakarta Sans (primary body/heading) and JetBrains Mono (numbers/metadata/badges) Google Fonts, applies global design tokens (`bg-canvas text-ink-primary`), configures global viewport meta tags, Sonner toast notification provider, and global app shell header/footer.
* **Key Dependencies:** `next/font/google`, `@roomcommerce/ui`, `@roomcommerce/tokens`, `Header`, `Footer`
* **Status:** Verified Active & Clean Build.

### [`apps/web/src/app/globals.css`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/globals.css)
* **Layer:** Global Stylesheet
* **Primary Responsibility:** Tailwind directives (`@tailwind base`, `@tailwind components`, `@tailwind utilities`), CSS variable mappings for Atelier Design System tokens, and custom scrollbar resets.
* **Status:** Verified Active.

---

## 2. Page Routes & User Screens

### [`apps/web/src/app/page.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/page.tsx)
* **Route:** `/`
* **Primary Responsibility:** Landing page / hero introducing RoomCommerce spatial redesign engine. Redirects authenticated users directly to `/studio`.
* **Key Interactive Elements:** "Try RoomCommerce Free" CTA, style showcase gallery, live interactive hotspot preview.
* **Status:** Verified Active (Static Route).

### [`apps/web/src/app/auth/page.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/auth/page.tsx)
* **Route:** `/auth`
* **Primary Responsibility:** User sign-in and account registration. Supports passwordless email magic link requests and demo one-click guest authentication.
* **Status:** Verified Active.

### [`apps/web/src/app/studio/page.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/studio/page.tsx)
* **Route:** `/studio`
* **Primary Responsibility:** Project gallery dashboard (SCR-02). Lists all existing user redesign projects with status badges (`PROCESSING`, `COMPLETED`, `FAILED`), thumbnail previews, and a prominent "Start New Redesign" CTA.
* **Key Components:** `ProjectCard`, `EmptyProjectsState`, `NewProjectButton`
* **Status:** Verified Active.

### [`apps/web/src/app/studio/new/upload/page.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/studio/new/upload/page.tsx)
* **Route:** `/studio/new/upload` (SCR-03)
* **Primary Responsibility:** Room photo intake wizard. Enforces client-side EXIF GPS metadata stripping via `use-exif-scrubber.ts`, drag-and-drop file upload, file type validation (JPEG, PNG, WebP $\le 20\text{MB}$), and resolution checks ($\ge 1024\times 1024\text{px}$).
* **Security Feature:** PRV-01 compliance — EXIF GPS tags are removed before the byte array leaves the browser.
* **Status:** Verified Active.

### [`apps/web/src/app/studio/new/configure/page.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/studio/new/configure/page.tsx)
* **Route:** `/studio/new/configure` (SCR-04)
* **Primary Responsibility:** Spatial redesign configuration wizard. Allows users to select:
  1. Room Function (`LIVING_ROOM`, `BEDROOM`, `DINING_ROOM`, `HOME_OFFICE`, `OPEN_PLAN`).
  2. Interior Design Style Preset (`JAPANDI`, `WARM_MINIMALIST`, `SCANDINAVIAN`, `MID_CENTURY_MODERN`, `INDUSTRIAL_CHIC`, `COASTAL`, `MEDITERRANEAN`, `TRANSITIONAL`).
  3. Total Furniture Budget Ceiling slider ($300 to $10,000).
* **State Store:** `use-wizard-store.ts`
* **Status:** Verified Active.

### [`apps/web/src/app/studio/new/inspect/page.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/studio/new/inspect/page.tsx)
* **Route:** `/studio/new/inspect` (SCR-05)
* **Primary Responsibility:** Pre-flight review screen displaying uploaded room photo with privacy badge ("Faces will be automatically blurred"), selected style prompt, budget ceiling, and confirmation button triggering project creation and R2 upload.
* **Status:** Verified Active.

### [`apps/web/src/app/studio/render/[job_id]/page.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/studio/render/[job_id])
* **Route:** `/studio/render/[job_id]` (SCR-06)
* **Primary Responsibility:** Real-time generation progress monitor. Connects to `/api/v1/inference/:id/sse` via `EventSource`. Renders animated step indicators across the 5 pipeline stages:
  1. Sanitization & Face Obfuscation (15%)
  2. 3D Monocular Depth Extraction (35%)
  3. SDXL Spatial Inpainting (65%)
  4. SAM Furniture Segmentation (80%)
  5. Catalog Vector Matching (90%)
* **Status:** Verified Active (Dynamic Server Route).

### [`apps/web/src/app/studio/view/[project_id]/page.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/studio/view/[project_id])
* **Route:** `/studio/view/[project_id]` (SCR-07, SCR-08)
* **Primary Responsibility:** The core interactive redesign viewer. Renders the synthesized room image, overlays 3D-aware Konva canvas hotspot pins, supports depth map inspection toggle, and opens the product drawer when a hotspot is tapped.
* **Key Components:** `InteractiveCanvas`, `ProductDrawer`, `DepthToggle`, `SharePopover`
* **Status:** Verified Active (Dynamic Server Route).

### [`apps/web/src/app/checkout/page.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/checkout/page.tsx)
* **Route:** `/checkout` (SCR-09)
* **Primary Responsibility:** Move-In Pass purchase flow ($14.99). Displays pass features (60 generations, priority GPU queue, high-res downloads, 30 days validity) and embeds Stripe Checkout session redirect.
* **Status:** Verified Active.

### [`apps/web/src/app/account/page.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/account/page.tsx)
* **Route:** `/account` (SCR-10)
* **Primary Responsibility:** Account settings, active Move-In Pass expiration countdown, generation usage meter, and PRV-02 compliant **1-Click Hard Deletion** button ("Permanently Delete My Data").
* **Status:** Verified Active.

---

## 3. Core Studio Components

### [`apps/web/src/components/studio/interactive-canvas.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/components/studio/interactive-canvas.tsx)
* **Primary Responsibility:** Implements the zoomable, pannable spatial hotspot canvas using HTML5 `react-konva`. Renders circular animated pin markers at normalized `(normX, normY)` coordinates on top of the rendered room image.
* **Interaction:** Hovering enlarges pin; clicking dispatches hotspot selection to `useCanvasStore` and opens `ProductDrawer`.
* **Accessibility:** Supports keyboard tab navigation across pins with screen-reader accessible product announcements.

### [`apps/web/src/components/studio/product-drawer.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/components/studio/product-drawer.tsx)
* **Primary Responsibility:** Slide-out drawer presenting the matched retail SKU for the selected hotspot: merchant badge (IKEA, Target, Wayfair, Amazon), high-res catalog photo, title, dimensions, price in USD, similarity confidence score, and outbound "Buy on Merchant" affiliate link.

---

## 4. Client State Management (`src/stores`)

* [`use-wizard-store.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/stores/use-wizard-store.ts): Manages multi-step project creation state (`rawFile`, `scrubbedBlob`, `previewUrl`, `stylePreset`, `roomFunction`, `budgetCeilingCents`).
* [`use-canvas-store.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/stores/use-canvas-store.ts): Controls active hotspot ID, zoom level (1x to 4x), pan offsets, and depth map comparison overlay toggle.
* [`use-auth-store.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/stores/use-auth-store.ts): Caches authenticated user info, JWT token, and active Move-In Pass entitlement.

---

## 5. Client Utilities (`src/lib`)

* [`api-client.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/lib/api-client.ts): Type-safe HTTP client wrapping all backend endpoints (`createProject`, `uploadToR2`, `triggerRender`, `fetchProject`, `fetchProductDetail`, `getCommerceRedirectUrl`, `triggerHardPurge`, `fetchAccount`).
* [`use-exif-scrubber.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/lib/use-exif-scrubber.ts): Client-side image sanitization hook. Loads images into a clean HTML5 canvas and re-encodes as a clean JPEG blob, stripping all EXIF, GPS, camera serial, and date tags before upload.
