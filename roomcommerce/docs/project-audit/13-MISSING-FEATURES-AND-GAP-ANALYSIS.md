# RoomCommerce — Comprehensive Codebase Audit & Technical Reference
## Document 13: Missing Features & Detailed Gap Analysis

> **Audit Date:** October 14, 2026  
> **Evaluation Scope:** 20 Standard Product & Engineering Dimensions  
> **Status:** Evidence-Based Gap Audit  

---

## 1. 20-Dimension Gap Analysis

### Dimension 1: Missing Core Functionality
* **Current State:** The end-to-end core redesign loop (upload ➔ EXIF scrub ➔ 3D depth ➔ inpainting ➔ segmentation ➔ vector retrieval ➔ Konva interactive canvas ➔ affiliate redirect) is fully implemented in code.
* **Identified Gap:** The GPU inference worker (`workers/gpu-runner/modal_app.py`) is written but not yet deployed to Modal Cloud.
* **Impact:** Without deployment, the live inference endpoint does not exist.
* **Resolution:** Execute `python3 -m modal deploy workers/gpu-runner/modal_app.py` and set `MODAL_API_ENDPOINT`.
* **Priority:** P1 | **Confidence:** High.

### Dimension 2: Incomplete Feature Implementation
* **Current State:** Affiliate stock checking is implemented for Amazon PA-API 5.0 and Wayfair Supplier OAuth.
* **Identified Gap:** Target and IKEA currently fall through to the default fail-open (`inStock: true`) in `CompositeStockCheckerAdapter`.
* **Impact:** Discontinued Target or IKEA items remain indexed until manually pruned.
* **Resolution:** Build `TargetAdapter` and `IkeaAdapter` implementing `IStockCheckerAdapter`.
* **Priority:** P2 | **Confidence:** High.

### Dimension 3: Missing Backend Functionality
* **Current State:** 9 NestJS modules are fully functional with 61 unit tests.
* **Identified Gap:** None in core APIs. Rate limiting (`@nestjs/throttler`) is present via `IntakeThrottlerGuard` on project creation, but not on public health or auth endpoints.
* **Resolution:** Bind global `@nestjs/throttler` in `app.module.ts`.
* **Priority:** P3 | **Confidence:** High.

### Dimension 4: Missing Database Functionality
* **Current State:** PostgreSQL 16 schema with Drizzle ORM covers users, passes, projects, hotspots, catalog SKUs, and click events.
* **Identified Gap:** Missing a dedicated index on `projects.created_at` for high-volume chronological dashboard pagination.
* **Resolution:** Add `index("projects_created_at_idx").on(projects.createdAt)` to `apps/api/src/database/schema/projects.ts`.
* **Priority:** P3 | **Confidence:** High.

### Dimension 5: Missing Frontend Integration
* **Current State:** All 11 pages (SCR-01 through SCR-10) are built and compile cleanly.
* **Identified Gap:** Real-time credit counter in `Header` reads from `useAuthStore`; needs automated re-validation on window focus.
* **Resolution:** Add SWR / React Query or `useEffect` polling on window focus.
* **Priority:** P3 | **Confidence:** Medium.

### Dimension 6: Missing Validation
* **Current State:** Comprehensive Zod schemas in `@roomcommerce/contracts`.
* **Identified Gap:** Maximum image aspect ratio validation (e.g. ultra-wide panoramas $> 3:1$) is not checked before R2 upload.
* **Resolution:** Add aspect ratio check in `use-exif-scrubber.ts`.
* **Priority:** P3 | **Confidence:** High.

### Dimension 7: Missing Error Handling
* **Current State:** Global exception filter catches all HTTP errors; `InferenceProcessor` catches Modal timeouts.
* **Identified Gap:** If user loses internet connectivity during the SSE stream, client does not automatically attempt exponential backoff reconnection.
* **Resolution:** Enhance EventSource consumer in `render/[job_id]/page.tsx` with exponential retry.
* **Priority:** P2 | **Confidence:** High.

### Dimension 8: Missing Loading or Empty States
* **Current State:** Skeleton loaders and empty project states exist.
* **Identified Gap:** Product Drawer displays a basic spinner when fetching SKU specifications.
* **Resolution:** Add skeleton loader mirroring card layout in `product-drawer.tsx`.
* **Priority:** P3 | **Confidence:** Medium.

### Dimension 9: Missing Security Controls
* **Current State:** Helmet CSP, HSTS, JWT cookies, and ownership guards verified.
* **Identified Gap:** Production CORS origin list in `main.ts` currently reads a single string `env.WEB_BASE_URL`. Preview branch deployments require dynamic regex matching.
* **Resolution:** Update CORS origin callback to match `*.roomcommerce.internal`.
* **Priority:** P3 | **Confidence:** High.

### Dimension 10: Missing Automated Tests
* **Current State:** 203 unit/contract tests passing; 6 Playwright E2E specs exist.
* **Identified Gap:** Playwright specs do not yet run automatically as a required blocking gate on every pull request in `ci.yml`.
* **Resolution:** Complete the `e2e` job in `.github/workflows/ci.yml`.
* **Priority:** P2 | **Confidence:** High.

### Dimension 11: Missing Monitoring or Logging
* **Current State:** Structured NestJS logs and PostHog event sink implemented.
* **Identified Gap:** No OpenTelemetry / Datadog distributed tracing for end-to-end request latency breakdown across ECS ➔ Redis ➔ Modal ➔ Qdrant.
* **Resolution:** Add OpenTelemetry Node SDK instrumentation to `main.ts`.
* **Priority:** P3 | **Confidence:** Medium.

### Dimension 12: Missing Deployment Configuration
* **Current State:** ECS task definitions and Cloudflare worker configs written.
* **Identified Gap:** `task-definition-api.json` contains placeholder strings (`ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com`) that must be substituted during CI deploy.
* **Resolution:** Verify GitHub Actions workflow automatically substitutes `${{ secrets.AWS_ACCOUNT_ID }}`.
* **Priority:** P2 | **Confidence:** High.

### Dimension 13: Missing Developer Documentation
* **Current State:** Addressed comprehensively by this 19-document audit suite.
* **Identified Gap:** Local development setup guide for engineers installing CUDA dependencies locally.
* **Resolution:** Clarify in `12-CONFIGURATION-AND-DEPLOYMENT.md` that GPU workers run on Modal.com serverless containers, eliminating local CUDA requirements.
* **Priority:** P3 | **Confidence:** High.

### Dimension 14: Missing User Documentation
* **Current State:** Informative onboarding copy in wizards.
* **Identified Gap:** No public FAQ page explaining fair-use limits and data retention policies.
* **Resolution:** Add `/faq` page to marketing routes.
* **Priority:** P3 | **Confidence:** Medium.

### Dimension 15: Missing Accessibility Support
* **Current State:** WCAG 2.1 AA compliant contrast ratios and keyboard canvas focus verified.
* **Identified Gap:** Interactive canvas zoom controls lack explicit `aria-keyshortcuts` labels.
* **Resolution:** Add `aria-keyshortcuts="Ctrl+Plus Ctrl+Minus"` to zoom button toolbar.
* **Priority:** P3 | **Confidence:** High.

### Dimension 16: Missing Responsive Behavior
* **Current State:** Canvas auto-scales; Product Drawer transforms to bottom sheet on mobile.
* **Identified Gap:** On small 320px devices (e.g. iPhone SE 1st gen), budget slider label can wrap.
* **Resolution:** Adjust text size to `text-xs` on `<360px` screens.
* **Priority:** P3 | **Confidence:** High.

### Dimension 17: Missing Design-System Consistency
* **Current State:** `@roomcommerce/ui` and `@roomcommerce/tokens` applied across all screens.
* **Identified Gap:** Some legacy inline classes in `apps/web/src/app/globals.css`.
* **Resolution:** Purge deprecated helper classes.
* **Priority:** P3 | **Confidence:** High.

### Dimension 18: Missing Performance Safeguards
* **Current State:** Sub-80ms vector search SLA verified.
* **Identified Gap:** Canvas image rendering loads uncompressed WebP; client-side image thumbnail caching using IndexedDB would reduce redundant re-fetches.
* **Resolution:** Implement service worker caching for rendered project assets.
* **Priority:** P3 | **Confidence:** Medium.

### Dimension 19: Missing Recovery or Retry Behavior
* **Current State:** Circuit breakers fail-open on stock APIs; BullMQ retries failed jobs up to 3 times.
* **Identified Gap:** If Stripe webhook delivery fails 3 times, there is no manual reconciliation script to re-sync customer entitlement.
* **Resolution:** Add `pnpm billing:reconcile` script.
* **Priority:** P3 | **Confidence:** High.

### Dimension 20: Unresolved Product or Business Requirements
* **Current State:** Single $14.99 Move-In Pass model.
* **Identified Gap:** Business has not decided whether to introduce recurring subscriptions ($29/month) or multi-room bundle passes.
* **Resolution:** Documented in [`17-OPEN-QUESTIONS-AND-DECISIONS.md`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/docs/project-audit/17-OPEN-QUESTIONS-AND-DECISIONS.md).
* **Priority:** P3 | **Confidence:** High.
