# RoomCommerce — Comprehensive Codebase Audit & Technical Reference
## Document 03.5: File-by-File Reference — Infrastructure, Testing & Monorepo Tooling

> **Subsystems:** AWS ECS Fargate, Cloudflare Edge, Playwright E2E, k6 Load Tests, GitHub Actions  
> **Total Files:** 25 files  

---

## 1. Infrastructure Specifications (`infra/`)

### [`infra/ecs/task-definition-api.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/infra/ecs/task-definition-api.json)
* **Layer:** Container Orchestration (AWS ECS Fargate)
* **Primary Responsibility:** Declares the production container definition for `@roomcommerce/api`.
* **Resources:** 1024 CPU units (1 vCPU), 2048 MB RAM.
* **Security:** Runs as non-root user `1001:1001` with read-only root options and AWS SSM Parameter Store secret references for `DATABASE_URL`, `REDIS_URL`, `QDRANT_URL`, `JWT_SECRET`, and `STRIPE_SECRET_KEY`.
* **Health Check:** `wget -qO- http://localhost:4000/api/v1/health || exit 1` (interval: 30s, timeout: 10s, retries: 3, startPeriod: 90s).

### [`infra/ecs/task-definition-web.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/infra/ecs/task-definition-web.json)
* **Layer:** Container Orchestration (AWS ECS Fargate)
* **Primary Responsibility:** Declares the production container definition for `@roomcommerce/web` (Next.js 15).
* **Resources:** 1024 CPU units, 2048 MB RAM.
* **Health Check:** `wget -qO- http://localhost:3000/api/health || exit 1`.

### [`infra/ecs/register-autoscaling.sh`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/infra/ecs/register-autoscaling.sh)
* **Layer:** Auto-Scaling Policy
* **Primary Responsibility:** Uses AWS CLI (`aws application-autoscaling`) to register target tracking scaling policies on ECS services based on average CPU utilization ($\ge 70\%$) and ALB request count per target.

### [`infra/cloudflare/canary-router.worker.js`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/infra/cloudflare/canary-router.worker.js)
* **Layer:** Edge Traffic Routing (Cloudflare Worker)
* **Primary Responsibility:** Weighted canary traffic splitter. Intercepts incoming requests at Cloudflare edge and routes a configurable percentage of traffic (`CANARY_PERCENTAGE`, e.g. 10%, 50%, 100%) to the canary ECS cluster while preserving session affinity via cookie headers.

### [`infra/cloudflare/wrangler.toml`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/infra/cloudflare/wrangler.toml)
* **Layer:** Cloudflare Worker Configuration
* **Primary Responsibility:** Declares worker name, compatibility date, and environment variable bindings.

---

## 2. End-to-End & Load Testing (`tests/`)

### [`playwright.config.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/playwright.config.ts)
* **Primary Responsibility:** Playwright test runner configuration with multi-project targets: Desktop Chromium, Firefox, WebKit, and Mobile Safari (iPhone 15).

### Core Playwright Test Suites:
* [`tests/e2e/us01-generation.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/tests/e2e/us01-generation.spec.ts):
  * Scope: User Story 1 (Spatial Redesign Generation). Uploads room photo, selects style preset, verifies SSE progress updates, and validates output image load.
* [`tests/e2e/us02-procurement.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/tests/e2e/us02-procurement.spec.ts):
  * Scope: User Story 2 (Product Procurement). Clicks canvas hotspot pin, verifies product drawer pop-up with matching SKU, and clicks "Buy on Retailer" to verify 302 affiliate redirect.
* [`tests/e2e/us03-anchor-locking.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/tests/e2e/us03-anchor-locking.spec.ts):
  * Scope: User Story 3 (Spatial Anchor Locking). Tests multi-furniture spatial relationships and persistence across zoom levels.
* [`tests/e2e/a11y-audit.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/tests/e2e/a11y-audit.spec.ts):
  * Scope: Accessibility Audit. Uses `@axe-core/playwright` to crawl all screens (SCR-01 through SCR-10) and asserts 0 WCAG 2.1 AA violations.
* [`tests/e2e/chaos-fault-injection.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/tests/e2e/chaos-fault-injection.spec.ts):
  * Scope: Resilience. Simulates 500 errors on Modal API, Cloudflare R2 timeouts, and tests client retry mechanisms.
* [`tests/e2e/mobile-viewport.spec.ts`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/tests/e2e/mobile-viewport.spec.ts):
  * Scope: Mobile Usability. Asserts touch targets ($\ge 44\times 44\text{px}$), bottom sheet gestures, and no horizontal scroll overflow on 320px–390px viewports.

### Load Testing Scripts (k6):
* [`tests/load/k6-burst-test.js`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/tests/load/k6-burst-test.js):
  * Simulates 50 concurrent users bursting project creation, image uploads, and SSE event streaming against the API cluster.
* [`tests/load/k6-vector-search-test.js`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/tests/load/k6-vector-search-test.js):
  * Executes 200 req/sec against Qdrant vector retrieval service to prove p95 latency stays $\le 80\text{ms}$.

---

## 3. Monorepo Root Tooling & Workflows

* [`package.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/package.json): Root script runner coordinating turbo tasks (`build`, `dev`, `lint`, `typecheck`, `test`, `test:e2e`).
* [`pnpm-workspace.yaml`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/pnpm-workspace.yaml): Defines workspace packages: `apps/*`, `packages/*`, `workers/*`.
* [`turbo.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/turbo.json): Configures dependency pipeline caching (`build`, `typecheck`, `lint`, `test`) ensuring zero redundant work.
* [`.github/workflows/ci.yml`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/.github/workflows/ci.yml): Automated CI testing pipeline executing typecheck, lint, unit tests, and Playwright E2E suite against PostgreSQL and Redis service containers.
* [`.github/workflows/deploy-staging.yml`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/.github/workflows/deploy-staging.yml): Continuous delivery pipeline building Docker images, pushing to AWS ECR, and executing ECS rolling update on staging.
* [`.github/workflows/deploy-production.yml`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/.github/workflows/deploy-production.yml): Multi-phase production release pipeline deploying Cloudflare Canary Router (10% ➔ 50% ➔ 100% traffic shifting with health monitoring).
