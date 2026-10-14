# RoomCommerce — Comprehensive Codebase Audit & Technical Reference
## Document 02: Complete File Inventory & Inspection Coverage Report

> **Audit Date:** October 14, 2026  
> **Total Discovered Files:** 9,199 files (including vendored UI packages and generated knowledge graph)  
> **Total Repository-Owned Core Application Files:** 246 files (100% Accounted For)  
> **Total Lines of Core Code:** ~22,000 lines (excluding lockfiles)  

---

## 1. Inspection Coverage & Scope Summary

| Metric | Count | Percentage | Description / Rationale |
| :--- | :--- | :--- | :--- |
| **Total Discovered Files** | 9,199 | 100.0% | Entire directory tree scanned |
| **Repository-Owned Core Files** | 246 | 100.0% of core | All hand-authored application, config, script, and test files |
| **Files Deeply Inspected** | 246 | 100.0% of core | All source code, DTOs, schemas, tests, configs, and scripts |
| **Vendored Library Files** | 6,297 | Excluded from deep audit | Vendored  animation library (third-party component base) |
| **Generated Graphify Knowledge Graph** | 2,649 | Excluded from deep audit | Automated AST code-graph cache and index files in  |
| **Serena / Playwright Artifacts** | 7 | Excluded from deep audit | Internal IDE tool state and generated HTML reports |

---

## 2. Inventory by Subsystem

### Monorepo Root & Tooling (10 files)

| File Path | Lines | Layer | Primary Responsibility | Active Usage |
| :--- | :--- | :--- | :--- | :--- |
| [`.commitlintrc.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/.commitlintrc.json) | 13 | Monorepo Root Config | Workspace, linter, turbo or package manager configuration | Confirmed Active |
| [`.env.example`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/.env.example) | 0 | Monorepo Root Config | Workspace, linter, turbo or package manager configuration | Confirmed Active |
| [`.gitignore`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/.gitignore) | 0 | Monorepo Root Config | Workspace, linter, turbo or package manager configuration | Confirmed Active |
| [`.npmrc`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/.npmrc) | 0 | Monorepo Root Config | Workspace, linter, turbo or package manager configuration | Confirmed Active |
| [`package.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/package.json) | 42 | Monorepo Root Config | Workspace, linter, turbo or package manager configuration | Confirmed Active |
| [`playwright.config.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/playwright.config.ts) | 47 | Monorepo Root Config | Workspace, linter, turbo or package manager configuration | Confirmed Active |
| [`pnpm-lock.yaml`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/pnpm-lock.yaml) | 9281 | Monorepo Root Config | Workspace, linter, turbo or package manager configuration | Confirmed Active |
| [`pnpm-workspace.yaml`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/pnpm-workspace.yaml) | 4 | Monorepo Root Config | Workspace, linter, turbo or package manager configuration | Confirmed Active |
| [`tsconfig.playwright.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/tsconfig.playwright.json) | 24 | Monorepo Root Config | Workspace, linter, turbo or package manager configuration | Confirmed Active |
| [`turbo.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/turbo.json) | 32 | Monorepo Root Config | Workspace, linter, turbo or package manager configuration | Confirmed Active |

---

### Apps: Backend API (apps/api) (86 files)

| File Path | Lines | Layer | Primary Responsibility | Active Usage |
| :--- | :--- | :--- | :--- | :--- |
| [`apps/api/Dockerfile`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/Dockerfile) | 0 | Backend Config | TypeScript / Docker / Nest build configuration | Confirmed Active |
| [`apps/api/drizzle.config.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/drizzle.config.ts) | 16 | Backend Config | TypeScript / Docker / Nest build configuration | Confirmed Active |
| [`apps/api/drizzle/0001_initial_schema.sql`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/drizzle/0001_initial_schema.sql) | 191 | Backend Config | TypeScript / Docker / Nest build configuration | Confirmed Active |
| [`apps/api/drizzle/meta/_journal.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/drizzle/meta/_journal.json) | 1 | Backend Config | TypeScript / Docker / Nest build configuration | Confirmed Active |
| [`apps/api/nest-cli.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/nest-cli.json) | 9 | Backend Config | TypeScript / Docker / Nest build configuration | Confirmed Active |
| [`apps/api/package.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/package.json) | 60 | Backend Config | TypeScript / Docker / Nest build configuration | Confirmed Active |
| [`apps/api/scripts/circuit-breaker-monitor.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/scripts/circuit-breaker-monitor.ts) | 449 | Operational Script | CLI maintenance / seed / config script | Confirmed Active |
| [`apps/api/scripts/configure-r2-lifecycle.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/scripts/configure-r2-lifecycle.ts) | 82 | Operational Script | CLI maintenance / seed / config script | Confirmed Active |
| [`apps/api/scripts/embed_catalog_skus.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/scripts/embed_catalog_skus.py) | 319 | Operational Script | CLI maintenance / seed / config script | Confirmed Active |
| [`apps/api/scripts/preflight-verify.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/scripts/preflight-verify.ts) | 260 | Operational Script | 7-gate production readiness verification probe | Confirmed Active |
| [`scripts/cloud-cutover.sh`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/scripts/cloud-cutover.sh) | 360 | Release Engineering | 5-phase Step 3 live cloud cutover orchestrator | Confirmed Active |
| [`apps/api/src/app.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/app.module.ts) | 60 | Backend Core | NestJS bootstrap, filters, guards, interceptors | Confirmed Active |
| [`apps/api/src/common/filters/global-exception.filter.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/common/filters/global-exception.filter.ts) | 57 | Backend Core | NestJS bootstrap, filters, guards, interceptors | Confirmed Active |
| [`apps/api/src/common/guards/intake-throttler.guard.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/common/guards/intake-throttler.guard.ts) | 26 | Backend Core | NestJS bootstrap, filters, guards, interceptors | Confirmed Active |
| [`apps/api/src/common/interceptors/transform-response.interceptor.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/common/interceptors/transform-response.interceptor.ts) | 51 | Backend Core | NestJS bootstrap, filters, guards, interceptors | Confirmed Active |
| [`apps/api/src/common/pipes/zod-validation.pipe.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/common/pipes/zod-validation.pipe.ts) | 27 | Backend Core | NestJS bootstrap, filters, guards, interceptors | Confirmed Active |
| [`apps/api/src/config/env.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/config/env.ts) | 46 | Backend Core | NestJS bootstrap, filters, guards, interceptors | Confirmed Active |
| [`apps/api/src/database/index.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/database/index.ts) | 24 | Data Access | Drizzle ORM schema, client or migration | Confirmed Active |
| [`apps/api/src/database/schema/affiliate-clicks.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/database/schema/affiliate-clicks.ts) | 35 | Data Access | Drizzle ORM schema, client or migration | Confirmed Active |
| [`apps/api/src/database/schema/canvas-hotspots.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/database/schema/canvas-hotspots.ts) | 29 | Data Access | Drizzle ORM schema, client or migration | Confirmed Active |
| [`apps/api/src/database/schema/catalog-skus.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/database/schema/catalog-skus.ts) | 45 | Data Access | Drizzle ORM schema, client or migration | Confirmed Active |
| [`apps/api/src/database/schema/enums.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/database/schema/enums.ts) | 35 | Data Access | Drizzle ORM schema, client or migration | Confirmed Active |
| [`apps/api/src/database/schema/index.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/database/schema/index.ts) | 12 | Data Access | Drizzle ORM schema, client or migration | Confirmed Active |
| [`apps/api/src/database/schema/move-passes.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/database/schema/move-passes.ts) | 38 | Data Access | Drizzle ORM schema, client or migration | Confirmed Active |
| [`apps/api/src/database/schema/projects.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/database/schema/projects.ts) | 41 | Data Access | Drizzle ORM schema, client or migration | Confirmed Active |
| [`apps/api/src/database/schema/users.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/database/schema/users.ts) | 21 | Data Access | Drizzle ORM schema, client or migration | Confirmed Active |
| [`apps/api/src/main.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/main.ts) | 86 | Backend Core | NestJS bootstrap, filters, guards, interceptors | Confirmed Active |
| [`apps/api/src/modules/auth/auth.controller.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/auth/auth.controller.ts) | 80 | Backend Service | NestJS auth module component | Confirmed Active |
| [`apps/api/src/modules/auth/auth.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/auth/auth.module.ts) | 12 | Backend Service | NestJS auth module component | Confirmed Active |
| [`apps/api/src/modules/auth/auth.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/auth/auth.service.ts) | 133 | Backend Service | NestJS auth module component | Confirmed Active |
| [`apps/api/src/modules/auth/guards/entitlement.guard.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/auth/guards/entitlement.guard.ts) | 70 | Backend Service | NestJS auth module component | Confirmed Active |
| [`apps/api/src/modules/auth/guards/jwt-auth.guard.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/auth/guards/jwt-auth.guard.ts) | 63 | Backend Service | NestJS auth module component | Confirmed Active |
| [`apps/api/src/modules/billing/billing.controller.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/billing/billing.controller.ts) | 69 | Backend Service | NestJS billing module component | Confirmed Active |
| [`apps/api/src/modules/billing/billing.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/billing/billing.module.ts) | 13 | Backend Service | NestJS billing module component | Confirmed Active |
| [`apps/api/src/modules/billing/billing.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/billing/billing.service.ts) | 88 | Backend Service | NestJS billing module component | Confirmed Active |
| [`apps/api/src/modules/billing/webhooks/stripe-webhook.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/billing/webhooks/stripe-webhook.service.ts) | 82 | Backend Service | NestJS billing module component | Confirmed Active |
| [`apps/api/src/modules/catalog/availability/sku-availability.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/availability/sku-availability.service.ts) | 67 | Backend Service | NestJS catalog module component | Confirmed Active |
| [`apps/api/src/modules/catalog/catalog.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/catalog.module.ts) | 26 | Backend Service | NestJS catalog module component | Confirmed Active |
| [`apps/api/src/modules/catalog/dto/catalog-ingest.dto.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/dto/catalog-ingest.dto.ts) | 28 | Backend Service | NestJS catalog module component | Confirmed Active |
| [`apps/api/src/modules/catalog/seed/catalog-seed.data.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/seed/catalog-seed.data.ts) | 232 | Backend Service | NestJS catalog module component | Confirmed Active |
| [`apps/api/src/modules/catalog/seed/seed-runner.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/seed/seed-runner.ts) | 82 | Backend Service | NestJS catalog module component | Confirmed Active |
| [`apps/api/src/modules/catalog/sync/adapters/amazon.adapter.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/sync/adapters/amazon.adapter.ts) | 156 | Backend Service | NestJS catalog module component | Confirmed Active |
| [`apps/api/src/modules/catalog/sync/adapters/composite-stock-checker.adapter.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/sync/adapters/composite-stock-checker.adapter.ts) | 36 | Backend Service | NestJS catalog module component | Confirmed Active |
| [`apps/api/src/modules/catalog/sync/adapters/wayfair.adapter.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/sync/adapters/wayfair.adapter.ts) | 123 | Backend Service | NestJS catalog module component | Confirmed Active |
| [`apps/api/src/modules/catalog/sync/catalog-sync.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/sync/catalog-sync.service.ts) | 131 | Backend Service | NestJS catalog module component | Confirmed Active |
| [`apps/api/src/modules/catalog/sync/stock-checker.interface.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/sync/stock-checker.interface.ts) | 16 | Backend Service | NestJS catalog module component | Confirmed Active |
| [`apps/api/src/modules/catalog/vector/qdrant-init.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/vector/qdrant-init.service.ts) | 69 | Backend Service | NestJS catalog module component | Confirmed Active |
| [`apps/api/src/modules/catalog/vector/qdrant.client.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/vector/qdrant.client.ts) | 14 | Backend Service | NestJS catalog module component | Confirmed Active |
| [`apps/api/src/modules/catalog/vector/vector-retrieval.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/vector/vector-retrieval.service.ts) | 85 | Backend Service | NestJS catalog module component | Confirmed Active |
| [`apps/api/src/modules/commerce/commerce.controller.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/commerce/commerce.controller.ts) | 45 | Backend Service | NestJS commerce module component | Confirmed Active |
| [`apps/api/src/modules/commerce/commerce.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/commerce/commerce.module.ts) | 12 | Backend Service | NestJS commerce module component | Confirmed Active |
| [`apps/api/src/modules/commerce/commerce.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/commerce/commerce.service.ts) | 113 | Backend Service | NestJS commerce module component | Confirmed Active |
| [`apps/api/src/modules/health/health.controller.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/health/health.controller.ts) | 43 | Backend Service | NestJS health module component | Confirmed Active |
| [`apps/api/src/modules/health/health.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/health/health.module.ts) | 11 | Backend Service | NestJS health module component | Confirmed Active |
| [`apps/api/src/modules/health/health.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/health/health.service.ts) | 104 | Backend Service | NestJS health module component | Confirmed Active |
| [`apps/api/src/modules/inference/inference.controller.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/inference/inference.controller.ts) | 55 | Backend Service | NestJS inference module component | Confirmed Active |
| [`apps/api/src/modules/inference/inference.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/inference/inference.module.ts) | 22 | Backend Service | NestJS inference module component | Confirmed Active |
| [`apps/api/src/modules/inference/inference.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/inference/inference.service.ts) | 54 | Backend Service | NestJS inference module component | Confirmed Active |
| [`apps/api/src/modules/inference/queues/inference.processor.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/inference/queues/inference.processor.ts) | 424 | Backend Service | NestJS inference module component | Confirmed Active |
| [`apps/api/src/modules/inference/sse/pipeline-sse.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/inference/sse/pipeline-sse.service.ts) | 39 | Backend Service | NestJS inference module component | Confirmed Active |
| [`apps/api/src/modules/privacy/cron/storage-purge.cron.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/privacy/cron/storage-purge.cron.ts) | 72 | Backend Service | NestJS privacy module component | Confirmed Active |
| [`apps/api/src/modules/privacy/privacy.controller.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/privacy/privacy.controller.ts) | 73 | Backend Service | NestJS privacy module component | Confirmed Active |
| [`apps/api/src/modules/privacy/privacy.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/privacy/privacy.module.ts) | 15 | Backend Service | NestJS privacy module component | Confirmed Active |
| [`apps/api/src/modules/privacy/privacy.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/privacy/privacy.service.ts) | 75 | Backend Service | NestJS privacy module component | Confirmed Active |
| [`apps/api/src/modules/projects/guards/project-ownership.guard.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/projects/guards/project-ownership.guard.ts) | 71 | Backend Service | NestJS projects module component | Confirmed Active |
| [`apps/api/src/modules/projects/projects.controller.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/projects/projects.controller.ts) | 75 | Backend Service | NestJS projects module component | Confirmed Active |
| [`apps/api/src/modules/projects/projects.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/projects/projects.module.ts) | 13 | Backend Service | NestJS projects module component | Confirmed Active |
| [`apps/api/src/modules/projects/projects.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/projects/projects.service.ts) | 108 | Backend Service | NestJS projects module component | Confirmed Active |
| [`apps/api/src/modules/projects/storage/r2-storage.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/projects/storage/r2-storage.service.ts) | 56 | Backend Service | NestJS projects module component | Confirmed Active |
| [`apps/api/src/modules/telemetry/telemetry.controller.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/telemetry/telemetry.controller.ts) | 27 | Backend Service | NestJS telemetry module component | Confirmed Active |
| [`apps/api/src/modules/telemetry/telemetry.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/telemetry/telemetry.module.ts) | 11 | Backend Service | NestJS telemetry module component | Confirmed Active |
| [`apps/api/src/modules/telemetry/telemetry.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/telemetry/telemetry.service.ts) | 104 | Backend Service | NestJS telemetry module component | Confirmed Active |
| [`apps/api/src/scripts/migrate.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/scripts/migrate.ts) | 69 | Backend Core | NestJS bootstrap, filters, guards, interceptors | Confirmed Active |
| [`apps/api/test/auth/auth.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/auth/auth.spec.ts) | 180 | Test Suite | Vitest unit/integration test suite | Confirmed Active |
| [`apps/api/test/billing/stripe-webhook.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/billing/stripe-webhook.spec.ts) | 165 | Test Suite | Vitest unit/integration test suite | Confirmed Active |
| [`apps/api/test/catalog/catalog-seed.test.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/catalog/catalog-seed.test.ts) | 61 | Test Suite | Vitest unit/integration test suite | Confirmed Active |
| [`apps/api/test/catalog/catalog-sync.test.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/catalog/catalog-sync.test.ts) | 165 | Test Suite | Vitest unit/integration test suite | Confirmed Active |
| [`apps/api/test/catalog/vector-retrieval.test.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/catalog/vector-retrieval.test.ts) | 173 | Test Suite | Vitest unit/integration test suite | Confirmed Active |
| [`apps/api/test/commerce/commerce-redirect.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/commerce/commerce-redirect.spec.ts) | 106 | Test Suite | Vitest unit/integration test suite | Confirmed Active |
| [`apps/api/test/health/health.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/health/health.spec.ts) | 50 | Test Suite | Vitest unit/integration test suite | Confirmed Active |
| [`apps/api/test/inference/inference-sse.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/inference/inference-sse.spec.ts) | 93 | Test Suite | Vitest unit/integration test suite | Confirmed Active |
| [`apps/api/test/privacy/storage-purge.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/privacy/storage-purge.spec.ts) | 104 | Test Suite | Vitest unit/integration test suite | Confirmed Active |
| [`apps/api/test/projects/projects.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/projects/projects.spec.ts) | 124 | Test Suite | Vitest unit/integration test suite | Confirmed Active |
| [`apps/api/test/security/hard-purge.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/security/hard-purge.spec.ts) | 96 | Test Suite | Vitest unit/integration test suite | Confirmed Active |
| [`apps/api/test/security/project-ownership.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/security/project-ownership.spec.ts) | 129 | Test Suite | Vitest unit/integration test suite | Confirmed Active |
| [`apps/api/test/telemetry/telemetry.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/telemetry/telemetry.spec.ts) | 75 | Test Suite | Vitest unit/integration test suite | Confirmed Active |
| [`apps/api/tsconfig.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/tsconfig.json) | 13 | Backend Config | TypeScript / Docker / Nest build configuration | Confirmed Active |
| [`apps/api/vitest.config.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/vitest.config.ts) | 12 | Backend Config | TypeScript / Docker / Nest build configuration | Confirmed Active |

---

### Apps: Frontend Web Client (apps/web) (35 files)

| File Path | Lines | Layer | Primary Responsibility | Active Usage |
| :--- | :--- | :--- | :--- | :--- |
| [`apps/web/Dockerfile`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/Dockerfile) | 0 | Frontend Config | Next.js, Tailwind, or TypeScript configuration | Confirmed Active |
| [`apps/web/next-env.d.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/next-env.d.ts) | 6 | Frontend Config | Next.js, Tailwind, or TypeScript configuration | Confirmed Active |
| [`apps/web/next.config.mjs`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/next.config.mjs) | 0 | Frontend Config | Next.js, Tailwind, or TypeScript configuration | Confirmed Active |
| [`apps/web/package.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/package.json) | 47 | Frontend Config | Next.js, Tailwind, or TypeScript configuration | Confirmed Active |
| [`apps/web/src/app/(auth`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/(auth)/auth/page.tsx) | 73 | Frontend Route | Next.js 15 App Router page, layout or route handler | Confirmed Active |
| [`apps/web/src/app/(auth`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/(auth)/layout.tsx) | 22 | Frontend Route | Next.js 15 App Router page, layout or route handler | Confirmed Active |
| [`apps/web/src/app/(studio`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/(studio)/account/page.tsx) | 132 | Frontend Route | Next.js 15 App Router page, layout or route handler | Confirmed Active |
| [`apps/web/src/app/(studio`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/(studio)/checkout/page.tsx) | 67 | Frontend Route | Next.js 15 App Router page, layout or route handler | Confirmed Active |
| [`apps/web/src/app/(studio`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/(studio)/layout.tsx) | 50 | Frontend Route | Next.js 15 App Router page, layout or route handler | Confirmed Active |
| [`apps/web/src/app/(studio`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/(studio)/studio/new/configure/page.tsx) | 153 | Frontend Route | Next.js 15 App Router page, layout or route handler | Confirmed Active |
| [`apps/web/src/app/(studio`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/(studio)/studio/new/inspect/page.tsx) | 116 | Frontend Route | Next.js 15 App Router page, layout or route handler | Confirmed Active |
| [`apps/web/src/app/(studio`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/(studio)/studio/new/upload/page.tsx) | 126 | Frontend Route | Next.js 15 App Router page, layout or route handler | Confirmed Active |
| [`apps/web/src/app/(studio`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/(studio)/studio/page.tsx) | 138 | Frontend Route | Next.js 15 App Router page, layout or route handler | Confirmed Active |
| [`apps/web/src/app/(studio`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/(studio)/studio/render/[job_id]/page.tsx) | 131 | Frontend Route | Next.js 15 App Router page, layout or route handler | Confirmed Active |
| [`apps/web/src/app/(studio`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/(studio)/studio/view/[project_id]/page.tsx) | 159 | Frontend Route | Next.js 15 App Router page, layout or route handler | Confirmed Active |
| [`apps/web/src/app/api/health/route.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/api/health/route.ts) | 42 | Frontend Route | Next.js 15 App Router page, layout or route handler | Confirmed Active |
| [`apps/web/src/app/globals.css`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/globals.css) | 79 | Frontend Route | Next.js 15 App Router page, layout or route handler | Confirmed Active |
| [`apps/web/src/app/layout.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/layout.tsx) | 45 | Frontend Route | Next.js 15 App Router page, layout or route handler | Confirmed Active |
| [`apps/web/src/app/page.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/app/page.tsx) | 59 | Frontend Route | Next.js 15 App Router page, layout or route handler | Confirmed Active |
| [`apps/web/src/components/canvas/interactive-canvas.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/components/canvas/interactive-canvas.tsx) | 88 | Frontend UI | React 19 UI component / interactive canvas | Confirmed Active |
| [`apps/web/src/config/env.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/config/env.ts) | 27 | Frontend Config | Next.js, Tailwind, or TypeScript configuration | Confirmed Active |
| [`apps/web/src/hooks/use-exif-scrubber.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/hooks/use-exif-scrubber.ts) | 57 | Frontend Config | Next.js, Tailwind, or TypeScript configuration | Confirmed Active |
| [`apps/web/src/hooks/use-pipeline-stream.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/hooks/use-pipeline-stream.ts) | 113 | Frontend Config | Next.js, Tailwind, or TypeScript configuration | Confirmed Active |
| [`apps/web/src/lib/api-client.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/lib/api-client.ts) | 170 | Frontend Utility | Client-side API wrapper or EXIF WASM scrubber | Confirmed Active |
| [`apps/web/src/lib/exif-scrubber.test.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/lib/exif-scrubber.test.ts) | 101 | Frontend Utility | Client-side API wrapper or EXIF WASM scrubber | Confirmed Active |
| [`apps/web/src/lib/exif-scrubber.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/lib/exif-scrubber.ts) | 59 | Frontend Utility | Client-side API wrapper or EXIF WASM scrubber | Confirmed Active |
| [`apps/web/src/providers/query-provider.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/providers/query-provider.tsx) | 41 | Frontend Config | Next.js, Tailwind, or TypeScript configuration | Confirmed Active |
| [`apps/web/src/stores/stores.test.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/stores/stores.test.ts) | 128 | State Management | Zustand client-side state store | Confirmed Active |
| [`apps/web/src/stores/use-canvas-store.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/stores/use-canvas-store.ts) | 47 | State Management | Zustand client-side state store | Confirmed Active |
| [`apps/web/src/stores/use-wizard-store.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/stores/use-wizard-store.ts) | 55 | State Management | Zustand client-side state store | Confirmed Active |
| [`apps/web/src/test/security/exif-scrubber.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/test/security/exif-scrubber.spec.ts) | 139 | Frontend Config | Next.js, Tailwind, or TypeScript configuration | Confirmed Active |
| [`apps/web/src/test/setup.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/src/test/setup.ts) | 34 | Frontend Config | Next.js, Tailwind, or TypeScript configuration | Confirmed Active |
| [`apps/web/tsconfig.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/tsconfig.json) | 26 | Frontend Config | Next.js, Tailwind, or TypeScript configuration | Confirmed Active |
| [`apps/web/tsconfig.tsbuildinfo`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/tsconfig.tsbuildinfo) | 0 | Frontend Config | Next.js, Tailwind, or TypeScript configuration | Confirmed Active |
| [`apps/web/vitest.config.mts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/web/vitest.config.mts) | 0 | Frontend Config | Next.js, Tailwind, or TypeScript configuration | Confirmed Active |

---

### Packages: Contracts (@roomcommerce/contracts) (11 files)

| File Path | Lines | Layer | Primary Responsibility | Active Usage |
| :--- | :--- | :--- | :--- | :--- |
| [`packages/contracts/package.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts/package.json) | 38 | API Contract | Shared Zod validation schemas & API envelopes | Confirmed Active |
| [`packages/contracts/src/api/envelope.schema.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts/src/api/envelope.schema.ts) | 37 | API Contract | Shared Zod validation schemas & API envelopes | Confirmed Active |
| [`packages/contracts/src/api/projects.schema.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts/src/api/projects.schema.ts) | 26 | API Contract | Shared Zod validation schemas & API envelopes | Confirmed Active |
| [`packages/contracts/src/canvas/hotspot.schema.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts/src/canvas/hotspot.schema.ts) | 27 | API Contract | Shared Zod validation schemas & API envelopes | Confirmed Active |
| [`packages/contracts/src/catalog/sku.schema.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts/src/catalog/sku.schema.ts) | 23 | API Contract | Shared Zod validation schemas & API envelopes | Confirmed Active |
| [`packages/contracts/src/contracts.test.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts/src/contracts.test.ts) | 393 | Contract Test | Zod schema unit tests | Confirmed Active |
| [`packages/contracts/src/enums/index.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts/src/enums/index.ts) | 33 | API Contract | Shared Zod validation schemas & API envelopes | Confirmed Active |
| [`packages/contracts/src/events/telemetry.schema.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts/src/events/telemetry.schema.ts) | 68 | API Contract | Shared Zod validation schemas & API envelopes | Confirmed Active |
| [`packages/contracts/src/index.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts/src/index.ts) | 37 | API Contract | Shared Zod validation schemas & API envelopes | Confirmed Active |
| [`packages/contracts/tsconfig.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts/tsconfig.json) | 9 | API Contract | Shared Zod validation schemas & API envelopes | Confirmed Active |
| [`packages/contracts/vitest.config.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/contracts/vitest.config.ts) | 9 | Contract Test | Zod schema unit tests | Confirmed Active |

---

### Packages: Design Tokens (@roomcommerce/tokens) (11 files)

| File Path | Lines | Layer | Primary Responsibility | Active Usage |
| :--- | :--- | :--- | :--- | :--- |
| [`packages/tokens/package.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/tokens/package.json) | 49 | Design System Tokens | Color, typography, radius, shadow tokens & Tailwind plugin | Confirmed Active |
| [`packages/tokens/src/colors.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/tokens/src/colors.ts) | 35 | Design System Tokens | Color, typography, radius, shadow tokens & Tailwind plugin | Confirmed Active |
| [`packages/tokens/src/index.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/tokens/src/index.ts) | 5 | Design System Tokens | Color, typography, radius, shadow tokens & Tailwind plugin | Confirmed Active |
| [`packages/tokens/src/shadows.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/tokens/src/shadows.ts) | 9 | Design System Tokens | Color, typography, radius, shadow tokens & Tailwind plugin | Confirmed Active |
| [`packages/tokens/src/spacing.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/tokens/src/spacing.ts) | 19 | Design System Tokens | Color, typography, radius, shadow tokens & Tailwind plugin | Confirmed Active |
| [`packages/tokens/src/tailwind-plugin.d.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/tokens/src/tailwind-plugin.d.ts) | 24 | Design System Tokens | Color, typography, radius, shadow tokens & Tailwind plugin | Confirmed Active |
| [`packages/tokens/src/tailwind-plugin.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/tokens/src/tailwind-plugin.ts) | 135 | Design System Tokens | Color, typography, radius, shadow tokens & Tailwind plugin | Confirmed Active |
| [`packages/tokens/src/tokens.test.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/tokens/src/tokens.test.ts) | 207 | Design Token Test | WCAG contrast & scale test | Confirmed Active |
| [`packages/tokens/src/typography.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/tokens/src/typography.ts) | 16 | Design System Tokens | Color, typography, radius, shadow tokens & Tailwind plugin | Confirmed Active |
| [`packages/tokens/tsconfig.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/tokens/tsconfig.json) | 11 | Design System Tokens | Color, typography, radius, shadow tokens & Tailwind plugin | Confirmed Active |
| [`packages/tokens/vitest.config.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/tokens/vitest.config.ts) | 9 | Design Token Test | WCAG contrast & scale test | Confirmed Active |

---

### Packages: UI Component Library (@roomcommerce/ui) (47 files)

| File Path | Lines | Layer | Primary Responsibility | Active Usage |
| :--- | :--- | :--- | :--- | :--- |
| [`packages/ui/package.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/package.json) | 90 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/scripts/add-bit.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/scripts/add-bit.ts) | 151 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/data-display/data-display.test.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/data-display/data-display.test.tsx) | 214 | UI Component Test | Vitest component rendering test | Confirmed Active |
| [`packages/ui/src/data-display/hotspot/ads-canvas-hotspot.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/data-display/hotspot/ads-canvas-hotspot.tsx) | 118 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/data-display/spec-table/ads-sku-spec-table.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/data-display/spec-table/ads-sku-spec-table.tsx) | 107 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/feedback/feedback.test.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/feedback/feedback.test.tsx) | 94 | UI Component Test | Vitest component rendering test | Confirmed Active |
| [`packages/ui/src/feedback/modal/ads-modal-dialog.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/feedback/modal/ads-modal-dialog.tsx) | 101 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/feedback/progress-bar/ads-progress-bar.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/feedback/progress-bar/ads-progress-bar.tsx) | 80 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/feedback/toast/ads-toast.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/feedback/toast/ads-toast.tsx) | 97 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/index.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/index.ts) | 44 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/inputs/dropzone/ads-dropzone.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/inputs/dropzone/ads-dropzone.tsx) | 159 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/inputs/inputs.test.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/inputs/inputs.test.tsx) | 129 | UI Component Test | Vitest component rendering test | Confirmed Active |
| [`packages/ui/src/inputs/slider/ads-budget-slider.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/inputs/slider/ads-budget-slider.tsx) | 99 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/inputs/style-selector/ads-style-card-selector.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/inputs/style-selector/ads-style-card-selector.tsx) | 84 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/lib/utils.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/lib/utils.ts) | 10 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/motion/SmoothScroll.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/motion/SmoothScroll.tsx) | 69 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/motion/gsap.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/motion/gsap.ts) | 10 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/motion/index.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/motion/index.ts) | 20 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/motion/lenis.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/motion/lenis.ts) | 32 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/motion/motion.test.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/motion/motion.test.ts) | 23 | UI Component Test | Vitest component rendering test | Confirmed Active |
| [`packages/ui/src/navigation/navigation.test.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/navigation/navigation.test.tsx) | 104 | UI Component Test | Vitest component rendering test | Confirmed Active |
| [`packages/ui/src/navigation/product-drawer/ads-product-drawer.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/navigation/product-drawer/ads-product-drawer.tsx) | 190 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/primitives/badge/ads-badge.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/primitives/badge/ads-badge.tsx) | 38 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/primitives/button/ads-button.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/primitives/button/ads-button.tsx) | 73 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/primitives/divider/ads-divider.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/primitives/divider/ads-divider.tsx) | 28 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/primitives/primitives.test.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/primitives/primitives.test.tsx) | 96 | UI Component Test | Vitest component rendering test | Confirmed Active |
| [`packages/ui/src/react-bits/AnimatedContent.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/react-bits/AnimatedContent.tsx) | 138 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/react-bits/Aurora.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/react-bits/Aurora.tsx) | 529 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/react-bits/BlurText.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/react-bits/BlurText.tsx) | 125 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/react-bits/ClickSpark.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/react-bits/ClickSpark.tsx) | 483 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/react-bits/CountUp.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/react-bits/CountUp.tsx) | 118 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/react-bits/DecayCard.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/react-bits/DecayCard.tsx) | 531 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/react-bits/DecryptedText.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/react-bits/DecryptedText.tsx) | 403 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/react-bits/Magnet.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/react-bits/Magnet.tsx) | 291 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/react-bits/Particles.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/react-bits/Particles.tsx) | 957 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/react-bits/ShinyText.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/react-bits/ShinyText.tsx) | 412 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/react-bits/SplitText.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/react-bits/SplitText.tsx) | 179 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/react-bits/SpotlightCard.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/react-bits/SpotlightCard.tsx) | 340 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/react-bits/StarBorder.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/react-bits/StarBorder.tsx) | 648 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/react-bits/TiltedCard.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/react-bits/TiltedCard.tsx) | 153 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/react-bits/TrueFocus.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/react-bits/TrueFocus.tsx) | 172 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/react-bits/Waves.tsx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/react-bits/Waves.tsx) | 782 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/react-bits/index.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/react-bits/index.ts) | 32 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/src/react-bits/react-bits.test.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/react-bits/react-bits.test.ts) | 32 | UI Component Test | Vitest component rendering test | Confirmed Active |
| [`packages/ui/src/test/setup.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/src/test/setup.ts) | 31 | UI Component Test | Vitest component rendering test | Confirmed Active |
| [`packages/ui/tsconfig.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/tsconfig.json) | 10 | UI Component Library | Reusable Atelier Design System React component | Confirmed Active |
| [`packages/ui/vitest.config.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/ui/vitest.config.ts) | 11 | UI Component Test | Vitest component rendering test | Confirmed Active |

---

### Packages: Shared Configuration (@roomcommerce/config) (8 files)

| File Path | Lines | Layer | Primary Responsibility | Active Usage |
| :--- | :--- | :--- | :--- | :--- |
| [`packages/config/eslint/base.mjs`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/config/eslint/base.mjs) | 0 | Shared Config | Monorepo environment validation | Confirmed Active |
| [`packages/config/eslint/nest.mjs`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/config/eslint/nest.mjs) | 0 | Shared Config | Monorepo environment validation | Confirmed Active |
| [`packages/config/eslint/react.mjs`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/config/eslint/react.mjs) | 0 | Shared Config | Monorepo environment validation | Confirmed Active |
| [`packages/config/package.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/config/package.json) | 10 | Shared Config | Monorepo environment validation | Confirmed Active |
| [`packages/config/prettier/index.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/config/prettier/index.json) | 10 | Shared Config | Monorepo environment validation | Confirmed Active |
| [`packages/config/typescript/base.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/config/typescript/base.json) | 28 | Shared Config | Monorepo environment validation | Confirmed Active |
| [`packages/config/typescript/node.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/config/typescript/node.json) | 14 | Shared Config | Monorepo environment validation | Confirmed Active |
| [`packages/config/typescript/react.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/packages/config/typescript/react.json) | 12 | Shared Config | Monorepo environment validation | Confirmed Active |

---

### Workers: Serverless GPU Runner (workers/gpu-runner) (23 files)

| File Path | Lines | Layer | Primary Responsibility | Active Usage |
| :--- | :--- | :--- | :--- | :--- |
| [`workers/gpu-runner/.pytest_cache/.gitignore`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/.pytest_cache/.gitignore) | 0 | GPU Worker Config | Modal app definition / pyproject.toml | Confirmed Active |
| [`workers/gpu-runner/.pytest_cache/CACHEDIR.TAG`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/.pytest_cache/CACHEDIR.TAG) | 0 | GPU Worker Config | Modal app definition / pyproject.toml | Confirmed Active |
| [`workers/gpu-runner/.pytest_cache/README.md`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/.pytest_cache/README.md) | 8 | GPU Worker Config | Modal app definition / pyproject.toml | Confirmed Active |
| [`workers/gpu-runner/.pytest_cache/v/cache/lastfailed`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/.pytest_cache/v/cache/lastfailed) | 0 | GPU Worker Config | Modal app definition / pyproject.toml | Confirmed Active |
| [`workers/gpu-runner/.pytest_cache/v/cache/nodeids`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/.pytest_cache/v/cache/nodeids) | 0 | GPU Worker Config | Modal app definition / pyproject.toml | Confirmed Active |
| [`workers/gpu-runner/modal_app.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/modal_app.py) | 186 | GPU Worker Config | Modal app definition / pyproject.toml | Confirmed Active |
| [`workers/gpu-runner/models/face_detection_yunet.onnx`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/models/face_detection_yunet.onnx) | 0 | GPU Worker Config | Modal app definition / pyproject.toml | Confirmed Active |
| [`workers/gpu-runner/package.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/package.json) | 11 | GPU Worker Config | Modal app definition / pyproject.toml | Confirmed Active |
| [`workers/gpu-runner/pyproject.toml`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/pyproject.toml) | 36 | GPU Worker Config | Modal app definition / pyproject.toml | Confirmed Active |
| [`workers/gpu-runner/src/__init__.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/src/__init__.py) | 3 | GPU Worker ML | Python 3.11 computer vision / deep learning stage | Confirmed Active |
| [`workers/gpu-runner/src/depth_service.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/src/depth_service.py) | 74 | GPU Worker ML | Python 3.11 computer vision / deep learning stage | Confirmed Active |
| [`workers/gpu-runner/src/inpainting_service.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/src/inpainting_service.py) | 94 | GPU Worker ML | Python 3.11 computer vision / deep learning stage | Confirmed Active |
| [`workers/gpu-runner/src/pipeline_runner.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/src/pipeline_runner.py) | 165 | GPU Worker ML | Python 3.11 computer vision / deep learning stage | Confirmed Active |
| [`workers/gpu-runner/src/sanitization.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/src/sanitization.py) | 98 | GPU Worker ML | Python 3.11 computer vision / deep learning stage | Confirmed Active |
| [`workers/gpu-runner/src/segmentation_extractor.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/src/segmentation_extractor.py) | 105 | GPU Worker ML | Python 3.11 computer vision / deep learning stage | Confirmed Active |
| [`workers/gpu-runner/src/style_prompts.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/src/style_prompts.py) | 63 | GPU Worker ML | Python 3.11 computer vision / deep learning stage | Confirmed Active |
| [`workers/gpu-runner/tests/__init__.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/tests/__init__.py) | 3 | GPU Test Suite | Pytest ML stage benchmarks & assertions | Confirmed Active |
| [`workers/gpu-runner/tests/conftest.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/tests/conftest.py) | 26 | GPU Test Suite | Pytest ML stage benchmarks & assertions | Confirmed Active |
| [`workers/gpu-runner/tests/fixtures/sample_living_room.jpg`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/tests/fixtures/sample_living_room.jpg) | 0 | GPU Test Suite | Pytest ML stage benchmarks & assertions | Confirmed Active |
| [`workers/gpu-runner/tests/test_depth.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/tests/test_depth.py) | 144 | GPU Test Suite | Pytest ML stage benchmarks & assertions | Confirmed Active |
| [`workers/gpu-runner/tests/test_embeddings.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/tests/test_embeddings.py) | 170 | GPU Test Suite | Pytest ML stage benchmarks & assertions | Confirmed Active |
| [`workers/gpu-runner/tests/test_pipeline_benchmark.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/tests/test_pipeline_benchmark.py) | 159 | GPU Test Suite | Pytest ML stage benchmarks & assertions | Confirmed Active |
| [`workers/gpu-runner/tests/test_sanitization.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/workers/gpu-runner/tests/test_sanitization.py) | 162 | GPU Test Suite | Pytest ML stage benchmarks & assertions | Confirmed Active |

---

### Infrastructure (infra) (5 files)

| File Path | Lines | Layer | Primary Responsibility | Active Usage |
| :--- | :--- | :--- | :--- | :--- |
| [`infra/cloudflare/canary-router.worker.js`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/infra/cloudflare/canary-router.worker.js) | 141 | Infrastructure | AWS ECS task definition, autoscaling, or Cloudflare Worker | Confirmed Active |
| [`infra/cloudflare/wrangler.toml`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/infra/cloudflare/wrangler.toml) | 25 | Infrastructure | AWS ECS task definition, autoscaling, or Cloudflare Worker | Confirmed Active |
| [`infra/ecs/register-autoscaling.sh`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/infra/ecs/register-autoscaling.sh) | 76 | Infrastructure | AWS ECS task definition, autoscaling, or Cloudflare Worker | Confirmed Active |
| [`infra/ecs/task-definition-api.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/infra/ecs/task-definition-api.json) | 97 | Infrastructure | AWS ECS task definition, autoscaling, or Cloudflare Worker | Confirmed Active |
| [`infra/ecs/task-definition-web.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/infra/ecs/task-definition-web.json) | 67 | Infrastructure | AWS ECS task definition, autoscaling, or Cloudflare Worker | Confirmed Active |

---

### QA & Testing (tests) (10 files)

| File Path | Lines | Layer | Primary Responsibility | Active Usage |
| :--- | :--- | :--- | :--- | :--- |
| [`tests/e2e/a11y-audit.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/tests/e2e/a11y-audit.spec.ts) | 106 | E2E / Load QA | Playwright end-to-end or k6 load scenario | Confirmed Active |
| [`tests/e2e/chaos-fault-injection.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/tests/e2e/chaos-fault-injection.spec.ts) | 321 | E2E / Load QA | Playwright end-to-end or k6 load scenario | Confirmed Active |
| [`tests/e2e/mobile-viewport.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/tests/e2e/mobile-viewport.spec.ts) | 70 | E2E / Load QA | Playwright end-to-end or k6 load scenario | Confirmed Active |
| [`tests/e2e/us01-generation.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/tests/e2e/us01-generation.spec.ts) | 144 | E2E / Load QA | Playwright end-to-end or k6 load scenario | Confirmed Active |
| [`tests/e2e/us02-procurement.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/tests/e2e/us02-procurement.spec.ts) | 75 | E2E / Load QA | Playwright end-to-end or k6 load scenario | Confirmed Active |
| [`tests/e2e/us03-anchor-locking.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/tests/e2e/us03-anchor-locking.spec.ts) | 60 | E2E / Load QA | Playwright end-to-end or k6 load scenario | Confirmed Active |
| [`tests/fixtures/blurred_living_room.jpg`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/tests/fixtures/blurred_living_room.jpg) | 0 | E2E / Load QA | Playwright end-to-end or k6 load scenario | Confirmed Active |
| [`tests/fixtures/clear_living_room.jpg`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/tests/fixtures/clear_living_room.jpg) | 0 | E2E / Load QA | Playwright end-to-end or k6 load scenario | Confirmed Active |
| [`tests/load/k6-burst-test.js`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/tests/load/k6-burst-test.js) | 48 | E2E / Load QA | Playwright end-to-end or k6 load scenario | Confirmed Active |
| [`tests/load/k6-vector-search-test.js`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/tests/load/k6-vector-search-test.js) | 192 | E2E / Load QA | Playwright end-to-end or k6 load scenario | Confirmed Active |

---

