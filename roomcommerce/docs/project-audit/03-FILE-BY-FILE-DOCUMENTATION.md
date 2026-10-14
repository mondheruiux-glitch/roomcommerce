# RoomCommerce — Comprehensive Codebase Audit & Technical Reference
## Document 03: Master File-by-File Documentation Hub

> **Audit Date:** October 14, 2026  
> **Total Core Application Files Covered:** 246 files (100% complete coverage)  

---

## 1. Structure of the File-by-File Technical Reference

Due to the depth of analysis required across all 246 files in the repository, the complete file-by-file documentation has been partitioned into 5 modular, specialized reference guides located in [`roomcommerce/docs/project-audit/file-docs/`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/docs/project-audit/file-docs/):

1. **Backend Application (`apps/api`):**  
   [`file-docs/apps-api.md`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/docs/project-audit/file-docs/apps-api.md)  
   *Covers all 86 files:* NestJS 10 bootstrap (`main.ts`), modules (`auth`, `billing`, `projects`, `inference`, `catalog`, `commerce`, `privacy`, `telemetry`, `health`), Drizzle ORM schemas, database migrations, operational CLI scripts, and 13 Vitest test suites.

2. **Frontend Web Client (`apps/web`):**  
   [`file-docs/apps-web.md`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/docs/project-audit/file-docs/apps-web.md)  
   *Covers all 35 files:* Next.js 15 App Router pages (SCR-01 through SCR-10), HTML5 `react-konva` interactive canvas, slide-out product drawer, Zustand client stores (`useWizardStore`, `useCanvasStore`, `useAuthStore`), typed API client, and client-side WASM EXIF scrubber.

3. **Shared Packages (`packages/*`):**  
   [`file-docs/packages.md`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/docs/project-audit/file-docs/packages.md)  
   *Covers all 77 files:*
   * `@roomcommerce/contracts`: Shared Zod schemas, API request/response envelopes, and 35 unit tests.
   * `@roomcommerce/tokens`: Atelier Design System color tokens, 8pt spatial grid, typography scale, Tailwind preset, and 29 WCAG 2.1 AA/AAA mathematical contrast tests.
   * `@roomcommerce/ui`: 47 reusable React 19 / Radix UI component library files with 78 unit tests.
   * `@roomcommerce/config`: Monorepo-wide environment variable validation schemas.

4. **Serverless GPU Runner (`workers/gpu-runner`):**  
   [`file-docs/workers.md`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/docs/project-audit/file-docs/workers.md)  
   *Covers all 23 files:* Modal.com application definition (`modal_app.py`), OpenCV YuNet face obfuscation, Depth Anything V2, SDXL ControlNet inpainting, Grounding DINO + MobileSAM segmentation, SigLIP-SO400M 768-dim embedding extractor, prompt engineering presets, and Pytest ML benchmark suites.

5. **Infrastructure, Tests & Tooling (`infra/`, `tests/`, root):**  
   [`file-docs/infra-tests-configs.md`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/docs/project-audit/file-docs/infra-tests-configs.md)  
   *Covers all 25 files:* AWS ECS Fargate task definitions, Cloudflare canary routing worker, Playwright E2E suites (US-01, US-02, US-03, a11y, mobile, chaos), k6 load testing scripts, Turbo configuration, and GitHub Actions CI/CD workflows.

---

## 2. Standardized File Analysis Methodology

For every source file documented across the reference guides, the following criteria were systematically evaluated:
* **File Identification:** Absolute project path, architectural layer, runtime role, and confirmed usage status.
* **Purpose & Problem Solved:** Business and technical problem addressed by the file.
* **Exported Symbols & Classes:** Detailed breakdown of functions, classes, interfaces, schemas, and guards.
* **Dependencies & Coupling:** Imported packages, database tables touched, external APIs called, and events emitted.
* **Business Rules Implemented:** Validation boundaries, error-handling paths, fail-open vs fail-closed logic, and fallback behaviors.
* **Security & Reliability:** Parameter sanitization, secret management, rate limiting, and defensive error recovery.
* **Test Verification:** Link to dedicated unit, contract, or end-to-end tests validating the file's behavior.
