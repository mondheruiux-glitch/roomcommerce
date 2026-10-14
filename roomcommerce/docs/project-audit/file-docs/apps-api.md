# RoomCommerce — Comprehensive Codebase Audit & Technical Reference
## Document 03.1: File-by-File Reference — Backend API (`apps/api`)

> **Subsystem:** NestJS 10 Modular Monolith  
> **Total Files:** 86 files (62 source/config, 13 test files, 11 migration/script files)  
> **Unit Test Coverage:** 61/61 passing unit tests (100% green)  

---

## 1. Application Core & Bootstrap

### [`apps/api/src/main.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/main.ts)
* **Layer:** Application Bootstrap / Entry Point
* **Primary Responsibility:** Initializes the NestJS application with raw body buffering, Helmet security headers, cookie parsing, CORS, global validation pipes, exception filters, and starts listening on `env.PORT` (default: 4000).
* **Key Exports / Symbols:** `bootstrap()`
* **Key Dependencies:** `@nestjs/core`, `helmet`, `cookie-parser`, `express`, `AppModule`, `env`, `GlobalExceptionFilter`, `TransformResponseInterceptor`
* **Security & Implementation Details:**
  * Uses `helmet` with custom Content Security Policy allowing R2 public domain CDN and Google Fonts.
  * Preserves raw request buffer for `/webhook` routes required for cryptographic Stripe signature validation.
  * Restricts CORS to `env.WEB_BASE_URL` and `http://localhost:3000`.
  * Configures global `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`.
* **Status:** Verified Active & Fully Operational.

### [`apps/api/src/app.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/app.module.ts)
* **Layer:** Root Module
* **Primary Responsibility:** Orchestrates all 9 domain modules (`AuthModule`, `BillingModule`, `ProjectsModule`, `InferenceModule`, `CatalogModule`, `CommerceModule`, `PrivacyModule`, `TelemetryModule`, `HealthModule`), ScheduleModule (cron), and BullMQ Redis connection.
* **Key Exports / Symbols:** `AppModule`
* **Dependencies:** `@nestjs/common`, `@nestjs/schedule`, `@nestjs/bullmq`, `ioredis`, all feature modules.
* **Status:** Verified Active & Fully Operational.

### [`apps/api/src/common/filters/global-exception.filter.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/common/filters/global-exception.filter.ts)
* **Layer:** Error Handling / Middleware
* **Primary Responsibility:** Catches all unhandled exceptions and formats them into the standard `@roomcommerce/contracts` envelope (`ApiErrorEnvelope`).
* **Key Exports / Symbols:** `GlobalExceptionFilter` implements `ExceptionFilter`
* **Status:** Verified Active.

### [`apps/api/src/common/interceptors/transform-response.interceptor.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/common/interceptors/transform-response.interceptor.ts)
* **Layer:** Response Transformation
* **Primary Responsibility:** Wraps successful HTTP responses into the uniform contract envelope (`ApiSuccessEnvelope`), attaching ISO timestamp and request tracing metadata.
* **Key Exports / Symbols:** `TransformResponseInterceptor` implements `NestInterceptor`
* **Status:** Verified Active.

### [`apps/api/src/common/guards/intake-throttler.guard.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/common/guards/intake-throttler.guard.ts)
* **Layer:** Rate Limiting
* **Primary Responsibility:** Guards high-cost ingestion endpoints against automated scraping and abuse.
* **Key Exports / Symbols:** `IntakeThrottlerGuard`
* **Status:** Verified Active.

---

## 2. Database & Data Models (`src/database`)

### [`apps/api/src/database/index.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/database/index.ts)
* **Layer:** Database Access
* **Primary Responsibility:** Initializes PostgreSQL connection pool using `pg.Pool` with `drizzle-orm/node-postgres` and exports singleton `db` instance.
* **Key Exports / Symbols:** `db`, `pool`
* **Status:** Verified Active.

### [`apps/api/src/database/schema/index.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/database/schema/index.ts)
* **Layer:** Schema Registry
* **Primary Responsibility:** Re-exports all relational tables: `users`, `movePasses`, `projects`, `canvasHotspots`, `catalogSkus`, `affiliateClickEvents`.
* **Key Exports:** Tables and relational definitions.
* **Status:** Verified Active.

### Individual Schema Tables:
* [`users.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/database/schema/users.ts): Defines user accounts, email, role, stripeCustomerId, hardPurgedAt timestamp.
* [`projects.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/database/schema/projects.ts): Defines project state (`CREATED`, `PROCESSING`, `COMPLETED`, `FAILED`), raw/rendered/depth image URLs, style preset, budget ceiling.
* [`move-passes.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/database/schema/move-passes.ts): Tracks $14.99 Move-In Pass lifecycle: status (`ACTIVE`, `EXPIRED`, `EXHAUSTED`), 60 generation credit allotment, 30-day expiration window.
* [`canvas-hotspots.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/database/schema/canvas-hotspots.ts): Spatial coordinates (`normX`, `normY`), matched SKU ID, similarity score, category.
* [`catalog.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/database/schema/catalog.ts): Retailer (`IKEA`, `TARGET`, `WAYFAIR`, `AMAZON`), title, priceCents, inStock, affiliateUrl, dims.
* [`telemetry.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/database/schema/telemetry.ts): Stores click events and outbound affiliate referrals.

---

## 3. Domain Modules

### 3.1 Auth Module (`src/modules/auth`)
* Files: [`auth.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/auth/auth.module.ts), [`auth.controller.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/auth/auth.controller.ts), [`auth.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/auth/auth.service.ts), [`jwt-auth.guard.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/auth/guards/jwt-auth.guard.ts), [`entitlement.guard.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/auth/guards/entitlement.guard.ts), [`jwt.strategy.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/auth/strategies/jwt.strategy.ts)
* Responsibility: Handles authentication, JWT issuance, passwordless/demo authentication, and user entitlement verification.
* Unit Test: [`test/auth/auth.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/auth/auth.spec.ts) — **10/10 tests passing**.

### 3.2 Billing Module (`src/modules/billing`)
* Files: [`billing.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/billing/billing.module.ts), [`billing.controller.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/billing/billing.controller.ts), [`billing.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/billing/billing.service.ts), [`stripe-webhook.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/billing/webhooks/stripe-webhook.service.ts)
* Responsibility: Creates Stripe Checkout Sessions for the $14.99 Move-In Pass and processes webhook events (`checkout.session.completed`) idempotently.
* Unit Test: [`test/billing/stripe-webhook.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/billing/stripe-webhook.spec.ts) — **4/4 tests passing**.

### 3.3 Projects Module (`src/modules/projects`)
* Files: [`projects.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/projects/projects.module.ts), [`projects.controller.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/projects/projects.controller.ts), [`projects.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/projects/projects.service.ts), [`r2-storage.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/projects/storage/r2-storage.service.ts)
* Responsibility: Manages user projects, validates style presets/budgets, generates Cloudflare R2 presigned PUT upload URLs, and returns project detail with associated canvas hotspots.
* Unit Tests: [`test/projects/projects.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/projects/projects.spec.ts), [`test/security/project-ownership.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/security/project-ownership.spec.ts) — **9/9 tests passing**.

### 3.4 Inference & Pipeline SSE Module (`src/modules/inference`)
* Files: [`inference.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/inference/inference.module.ts), [`inference.controller.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/inference/inference.controller.ts), [`inference.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/inference/inference.service.ts), [`inference.processor.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/inference/queues/inference.processor.ts), [`pipeline-sse.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/inference/sse/pipeline-sse.service.ts)
* Responsibility: Enqueues render jobs into BullMQ with entitlement prioritization (Paid Pass = priority 1, Free Tier = priority 10). `InferenceProcessor` calls the Modal GPU endpoint, emits SSE stage progress (Sanitization ➔ Depth ➔ Inpainting ➔ Segmentation ➔ Catalog Matching), uploads outputs to R2, runs vector search, and records hotspots.
* Unit Test: [`test/inference/inference-sse.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/inference/inference-sse.spec.ts) — **3/3 tests passing**.

### 3.5 Catalog & Vector Module (`src/modules/catalog`)
* Files: [`catalog.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/catalog.module.ts), [`catalog.controller.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/catalog.controller.ts), [`vector-retrieval.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/vector/vector-retrieval.service.ts), [`qdrant-init.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/vector/qdrant-init.service.ts), [`catalog-sync.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/sync/catalog-sync.service.ts), [`stock-checker.interface.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/sync/stock-checker.interface.ts), [`amazon.adapter.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/sync/adapters/amazon.adapter.ts), [`wayfair.adapter.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/sync/adapters/wayfair.adapter.ts), [`composite-stock-checker.adapter.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/sync/adapters/composite-stock-checker.adapter.ts), [`sku-availability.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/availability/sku-availability.service.ts), [`catalog-seed.data.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/seed/catalog-seed.data.ts), [`seed-runner.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/catalog/seed/seed-runner.ts)
* Responsibility: Seeds 50K SKU catalog, maintains Qdrant collection (`retail_catalog_v1`), performs sub-80ms cosine vector search with hard stock/budget filters, runs nightly sync (02:00 UTC) with live Amazon and Wayfair stock verification, and de-indexes out-of-stock SKUs.
* Unit Tests: [`test/catalog/catalog-seed.test.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/catalog/catalog-seed.test.ts), [`test/catalog/vector-retrieval.test.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/catalog/vector-retrieval.test.ts), [`test/catalog/catalog-sync.test.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/catalog/catalog-sync.test.ts) — **18/18 tests passing**.

### 3.6 Commerce Module (`src/modules/commerce`)
* Files: [`commerce.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/commerce/commerce.module.ts), [`commerce.controller.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/commerce/commerce.controller.ts), [`commerce.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/commerce/commerce.service.ts)
* Responsibility: Generates outbound affiliate deep-links with UTM tracking tags and retailer affiliate partner IDs; records outbound clicks in telemetry.
* Unit Test: [`test/commerce/commerce-redirect.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/commerce/commerce-redirect.spec.ts) — **3/3 tests passing**.

### 3.7 Privacy & Hard-Purge Module (`src/modules/privacy`)
* Files: [`privacy.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/privacy/privacy.module.ts), [`privacy.controller.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/privacy/privacy.controller.ts), [`privacy.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/privacy/privacy.service.ts), [`storage-purge.cron.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/privacy/cron/storage-purge.cron.ts)
* Responsibility: Implements 1-click account and data hard-erasure (PRV-02) deleting database records, cascade-deleting hotspots/projects, and purging R2 storage assets. Nightly cron purges uploads older than 7 days.
* Unit Tests: [`test/privacy/storage-purge.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/privacy/storage-purge.spec.ts), [`test/security/hard-purge.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/security/hard-purge.spec.ts) — **7/7 tests passing**.

### 3.8 Telemetry Module (`src/modules/telemetry`)
* Files: [`telemetry.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/telemetry/telemetry.module.ts), [`telemetry.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/telemetry/telemetry.service.ts)
* Responsibility: Emits structured telemetry events (EV-101 to EV-302) to structured logs and direct PostHog HTTP analytics capture sink, anonymizing IP addresses via SHA-256.
* Unit Test: [`test/telemetry/telemetry.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/telemetry/telemetry.spec.ts) — **4/4 tests passing**.

### 3.9 Health Module (`src/modules/health`)
* Files: [`health.module.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/health/health.module.ts), [`health.controller.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/health/health.controller.ts), [`health.service.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/src/modules/health/health.service.ts)
* Responsibility: Provides `/health` and `/api/v1/health` probes monitoring database connectivity, Redis ping, and Qdrant endpoint availability for AWS ALB and Docker health checks.
* Unit Test: [`test/health/health.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/test/health/health.spec.ts) — **3/3 tests passing**.

---

## 4. Scripts & Operational Utilities

* [`scripts/configure-r2-lifecycle.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/scripts/configure-r2-lifecycle.ts): Applies 7-day automated expiration rule on raw room uploads in Cloudflare R2 bucket.
* [`scripts/embed_catalog_skus.py`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/scripts/embed_catalog_skus.py): Batch-extracts SigLIP embeddings for catalog SKUs and uploads them directly to Qdrant.
* [`scripts/circuit-breaker-monitor.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/apps/api/scripts/circuit-breaker-monitor.ts): Evaluates affiliate retailer API circuit breakers and triggers fail-open/fail-closed states.
