# RoomCommerce — Comprehensive Codebase Audit & Technical Reference
## Document 12: Configuration, Environment & Deployment Operations

> **Audit Date:** October 14, 2026  
> **Deployment Targets:** AWS ECS Fargate, Cloudflare Workers & R2, Modal.com GPU Fleet  
> **CI/CD:** GitHub Actions  

---

## 1. Environment Variables Specification

The canonical template is stored in [`.env.example`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/.env.example). In production on AWS ECS Fargate, secrets are securely injected from **AWS SSM Parameter Store** as defined in [`infra/ecs/task-definition-api.json`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/infra/ecs/task-definition-api.json).

| Variable Name | Required | Architectural Purpose | Production Source |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | Runtime environment (`production`, `staging`, `test`) | ECS Environment |
| `PORT` | Yes | HTTP listening port (default: `4000`) | ECS Environment |
| `DATABASE_URL` | Yes | PostgreSQL connection string with SSL | SSM: `/roomcommerce/prod/DATABASE_URL` |
| `REDIS_URL` | Yes | Redis cluster connection string for BullMQ queues | SSM: `/roomcommerce/prod/REDIS_URL` |
| `JWT_SECRET` | Yes | Secret key for signing session tokens ($\ge 32$ chars) | SSM: `/roomcommerce/prod/JWT_SECRET` |
| `COOKIE_SECRET` | Yes | Secret key for signing HTTP cookies | SSM: `/roomcommerce/prod/COOKIE_SECRET` |
| `CLOUDFLARE_R2_ACCOUNT_ID` | Yes | Cloudflare account identifier | SSM: `/roomcommerce/prod/R2_ACCOUNT_ID` |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Yes | S3-compatible R2 access key ID | SSM: `/roomcommerce/prod/R2_ACCESS_KEY_ID` |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | Yes | S3-compatible R2 secret access key | SSM: `/roomcommerce/prod/R2_SECRET_ACCESS_KEY` |
| `CLOUDFLARE_R2_BUCKET_NAME` | Yes | Target bucket name (e.g. `roomcommerce-renders`) | SSM: `/roomcommerce/prod/R2_BUCKET_NAME` |
| `CLOUDFLARE_R2_PUBLIC_DOMAIN` | Yes | Public CDN domain for WebP/PNG assets | SSM: `/roomcommerce/prod/R2_PUBLIC_DOMAIN` |
| `QDRANT_URL` | Yes | Qdrant Cloud cluster HTTPS endpoint | SSM: `/roomcommerce/prod/QDRANT_URL` |
| `QDRANT_API_KEY` | Yes | Qdrant Cloud API authentication key | SSM: `/roomcommerce/prod/QDRANT_API_KEY` |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret API key for checkout sessions | SSM: `/roomcommerce/prod/STRIPE_SECRET_KEY` |
| `STRIPE_WEBHOOK_SECRET` | Yes | Webhook signature secret for payload verification | SSM: `/roomcommerce/prod/STRIPE_WEBHOOK_SECRET` |
| `MODAL_API_ENDPOINT` | Yes | HTTPS web endpoint URL of deployed Modal GPU worker | SSM: `/roomcommerce/prod/MODAL_API_ENDPOINT` |
| `MODAL_API_TOKEN` | Yes | Bearer token for authenticating calls to Modal | SSM: `/roomcommerce/prod/MODAL_API_TOKEN` |
| `AMAZON_PAAPI_ACCESS_KEY` | Optional | Amazon PA-API 5.0 AWS Access Key | SSM: `/roomcommerce/prod/AMAZON_PAAPI_ACCESS_KEY` |
| `AMAZON_PAAPI_SECRET_KEY` | Optional | Amazon PA-API 5.0 AWS Secret Key | SSM: `/roomcommerce/prod/AMAZON_PAAPI_SECRET_KEY` |
| `AMAZON_PAAPI_PARTNER_TAG` | Optional | Amazon Associates tracking ID (default: `roomcommerce-20`)| SSM: `/roomcommerce/prod/AMAZON_PAAPI_PARTNER_TAG` |
| `WAYFAIR_API_CLIENT_ID` | Optional | Wayfair Supplier API OAuth2 Client ID | SSM: `/roomcommerce/prod/WAYFAIR_API_CLIENT_ID` |
| `WAYFAIR_API_CLIENT_SECRET`| Optional | Wayfair Supplier API OAuth2 Client Secret | SSM: `/roomcommerce/prod/WAYFAIR_API_CLIENT_SECRET` |
| `POSTHOG_API_KEY` | Optional | PostHog project API key for event telemetry sink | SSM: `/roomcommerce/prod/POSTHOG_API_KEY` |

---

## 2. Local Development & Operational Commands

### Prerequisites
* Node.js $\ge 22.0.0$ LTS
* pnpm $\ge 9.0.0$
* Python 3.11 with pip3
* Running PostgreSQL 16 & Redis 7 instances

### Monorepo CLI Commands (`package.json`)
```bash
# Install all dependencies across monorepo packages
pnpm install

# Run full monorepo typecheck across all workspaces
pnpm typecheck

# Run unit and contract test suites (203 tests)
pnpm test

# Run Next.js and NestJS production builds
pnpm build

# Start all dev servers in parallel (API on 4000, Web on 3000)
pnpm dev

# Run Playwright E2E tests
pnpm test:e2e

# Run k6 load tests
pnpm test:load
```

---

## 3. Production Deployment Workflows

### 3.1 Step 1: Deploy Serverless GPU Worker to Modal
```bash
# Authenticate Modal CLI (one-time setup)
python3 -m modal setup

# Deploy GPU pipeline to Modal Cloud
python3 -m modal deploy workers/gpu-runner/modal_app.py
```
*Output:* Provides the HTTPS web endpoint (e.g. `https://<org>--roomcommerce-gpu-render.modal.run`). Copy this URL into `MODAL_API_ENDPOINT`.

### 3.2 Step 2: Seed Qdrant Cloud Vector Index
```bash
# Populate 50K SKU SigLIP embeddings into retail_catalog_v1
python3 apps/api/scripts/embed_catalog_skus.py
```

### 3.3 Step 3: Apply Cloudflare R2 7-Day Auto-Purge Policy
```bash
pnpm --filter @roomcommerce/api exec ts-node scripts/configure-r2-lifecycle.ts
```

### 3.4 Step 4: Deploy Cloudflare Canary Router
```bash
pnpm infra:deploy-worker
```

### 3.5 Step 5: AWS ECS Fargate Deployment
The GitHub Actions workflow [`.github/workflows/deploy-production.yml`](file:///Users/mondhermac/Desktop/project%20commerce/roomcommerce/.github/workflows/deploy-production.yml) builds Docker images, pushes to Amazon ECR, registers task definitions, and shifts traffic:
1. Deploys canary container to ECS.
2. Cloudflare Canary Router routes 10% traffic to canary.
3. Observes 5xx error rate and latency metrics for 15 minutes.
4. If healthy, cuts over 100% traffic; otherwise triggers automated rollback.
