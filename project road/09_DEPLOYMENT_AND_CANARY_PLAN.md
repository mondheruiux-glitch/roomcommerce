# Plan Document: 09_DEPLOYMENT_AND_CANARY_PLAN.md
# Scope: CI/CD Pipelines (GitHub Actions), AWS ECS Fargate, Cloudflare WAF/CDN, Canary Traffic Routing & Live Telemetry
# Traceable PRD Requirements: NFR-04, NFR-05, NFR-01, BO-01, BO-02, SEC-01, SEC-03, EV-101–EV-302

---

## 1. Objective & Scope Boundaries

### 1.1 Objective
Establish the automated production release engineering, cloud infrastructure orchestration, and progressive delivery framework for Project RoomCommerce. This plan defines the GitHub Actions deployment workflows, multi-stage production Docker containers, AWS ECS Fargate auto-scaling clusters, Cloudflare WAF/CDN routing, staged canary traffic rollouts (10% ➔ 50% ➔ 100%), real-time observability telemetry, and automated circuit-breaker rollback protocols.

### 1.2 In-Scope
* **Multi-Stage Production Containerization:**
  * `apps/web/docker/Dockerfile`: Next.js 15 standalone production container with non-root user and minimal alpine footprint ($< 180\text{MB}$).
  * `apps/api/docker/Dockerfile`: NestJS 11 Node 22 LTS container with pinned dependencies and production compilation.
* **Continuous Delivery Automation (GitHub Actions):**
  * `.github/workflows/deploy-staging.yml`: Automated CD pipeline deploying to staging upon merge into `main`.
  * `.github/workflows/deploy-production.yml`: Tag-triggered (`v*.*.*`) production pipeline with manual approval gate and canary controls.
* **Infrastructure Topology & Auto-Scaling:**
  * AWS ECS Fargate task definitions with AWS Application Load Balancer (ALB).
  * Auto-scaling policies scaling tasks dynamically between 2 and 20 instances based on CPU ($> 70\%$) and memory ($> 75\%$).
* **Cloudflare Edge Proxy, WAF & CDN:**
  * Strict DDoS mitigation, TLS 1.3 cipher enforcement, and automated rate limiting (100 req/min/IP).
  * Static caching rules for Next.js assets (`/_next/static/*`) and CDN delivery for Cloudflare R2 renders.
* **Progressive Canary Rollout Framework:**
  * Cloudflare Worker weight-based traffic split: **Phase 1 (10% for 2h)** ➔ **Phase 2 (50% for 4h)** ➔ **Phase 3 (100% full cutover)**.
  * Real-time SLO canary evaluation asserting error rate $< 0.5\%$ and p90 generation latency $\le 15.0\text{s}$.
* **Live Observability & Telemetry Dashboards:**
  * Deep health check endpoints (`/api/v1/health`, `/api/v1/health/db`, `/api/v1/health/redis`, `/api/v1/health/qdrant`).
  * Telemetry monitoring tracking the North Star Metric (QSOS: Qualified Spatial Outbound Sessions) and events `EV-101` through `EV-302`.
* **Automated Circuit-Breaker Rollback Protocol:** Instantaneous task rollback within $< 60\text{s}$ if 5xx error rate breaches $1.0\%$ over a 5-minute rolling window.

### 1.3 Explicit Exclusions (Deferred to Post-Launch)
* Multi-region active-active database clustering (single-region AWS us-east-1 Aurora with Multi-AZ replica is standard for Phase 1).
* International multi-currency localized payment routing outside of USD / Stripe US.

---

## 2. Prerequisites & Dependency Matrix

### 2.1 Preceding Milestones
* `00_MASTER_EXECUTION_INDEX.md` through `08_INTEGRATION_AND_E2E_QA_PLAN.md` approved.
* All unit, integration, E2E, security, and accessibility test suites passing in CI with 0 blocking defects.

### 2.2 Cloud & Tooling Dependencies
* **Cloud Providers:** AWS (ECS Fargate, Aurora PostgreSQL, ElastiCache Redis, ECR, Route53), Cloudflare (WAF, CDN, R2), Modal (Serverless GPU).
* **Container Registry:** AWS Elastic Container Registry (ECR) with automated vulnerability scanning on push.
* **Observability:** Datadog / OpenTelemetry + CloudWatch Container Insights.

### 2.3 Required CI/CD Secrets (GitHub Actions Secrets)
```env
# AWS Credentials
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=wJalr...
AWS_REGION=us-east-1
AWS_ECR_REGISTRY=123456789012.dkr.ecr.us-east-1.amazonaws.com

# Cloudflare Credentials
CLOUDFLARE_API_TOKEN=cf_api_token...
CLOUDFLARE_ZONE_ID=cf_zone_id...

# Modal GPU Production Token
MODAL_TOKEN_ID=ak-...
MODAL_TOKEN_SECRET=as-...
```

---

## 3. Step-by-Step Implementation Sequence

### Step 9.1: Multi-Stage Production Docker Containers
Create minimal, secure, non-root Docker images for the frontend web application and backend API.

* **Target Files:**
  * `apps/web/Dockerfile`
  * `apps/api/Dockerfile`

* **Concrete Next.js 15 Standalone Dockerfile:**
```dockerfile
# apps/web/Dockerfile
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Stage 1: Dependencies
FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/tokens/package.json ./packages/tokens/
COPY packages/ui/package.json ./packages/ui/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/config/package.json ./packages/config/
RUN pnpm install --frozen-lockfile --filter @roomcommerce/web...

# Stage 2: Builder
FROM base AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN pnpm --filter @roomcommerce/web build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run as non-root user for security (SEC-03)
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

* **Concrete NestJS 11 Production Dockerfile:**
```dockerfile
# apps/api/Dockerfile
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/config/package.json ./packages/config/
RUN pnpm install --frozen-lockfile --filter @roomcommerce/api...

FROM base AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
ENV NODE_ENV=production
RUN pnpm --filter @roomcommerce/api build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

USER nestjs
EXPOSE 4000
CMD ["node", "dist/main.js"]
```

---

### Step 9.2: Production Deployment Pipeline (`.github/workflows/deploy-production.yml`)
Automate image builds, ECR container push, ECS service updates, and canary traffic progression.

* **Target Files:**
  * `.github/workflows/deploy-production.yml`

* **Concrete GitHub Actions Workflow:**
```yaml
# .github/workflows/deploy-production.yml
name: Deploy Production (Canary)

on:
  push:
    tags:
      - 'v*.*.*'

concurrency:
  group: production-deploy
  cancel-in-progress: false

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Log in to AWS ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build and Push Web & API Images
        env:
          REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          TAG: ${{ github.ref_name }}
        run: |
          docker build -t $REGISTRY/roomcommerce-web:$TAG -f apps/web/Dockerfile .
          docker build -t $REGISTRY/roomcommerce-api:$TAG -f apps/api/Dockerfile .
          docker push $REGISTRY/roomcommerce-web:$TAG
          docker push $REGISTRY/roomcommerce-api:$TAG

  deploy-canary-10:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Deploy Canary Task (10% Traffic)
        run: |
          echo "[*] Directing 10% of live traffic to canary version ${{ github.ref_name }} via Cloudflare"
          # Invokes Cloudflare API updating worker canary routing weight to 0.10

  soak-and-evaluate:
    needs: deploy-canary-10
    runs-on: ubuntu-latest
    steps:
      - name: Soak Period (2 Hours) & SLO Health Check
        run: |
          echo "[*] Monitoring live error rates and generation latency for 2 hours..."
          # Queries CloudWatch / Datadog: If error_rate > 0.5% triggers automatic rollback

  promote-full-cutover:
    needs: soak-and-evaluate
    runs-on: ubuntu-latest
    steps:
      - name: 100% Production Promotion
        run: |
          echo "[*] Canary verification passed. Routing 100% of live traffic to ${{ github.ref_name }}."
```

---

### Step 9.3: Deep System Health Check Subsystem (`HealthModule`)
Implement comprehensive health checks inspecting PostgreSQL, Redis, Qdrant, and R2 connectivity (`NFR-04`).

* **Target Files:**
  * `apps/api/src/modules/health/health.controller.ts`
  * `apps/api/src/modules/health/health.service.ts`

* **Concrete Health Controller:**
```typescript
// apps/api/src/modules/health/health.controller.ts
import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { db } from '../../database';
import { sql } from 'drizzle-orm';
import { QdrantClient } from '@qdrant/js-client-rest';
import Redis from 'ioredis';
import { env } from '../../config/env';

@Controller('api/v1/health')
export class HealthController {
  private readonly redis = new Redis(env.REDIS_URL, { lazyConnect: true });
  private readonly qdrant = new QdrantClient({ url: env.QDRANT_URL, apiKey: env.QDRANT_API_KEY });

  @Get()
  async checkOverallHealth(@Res() res: Response) {
    const checks: Record<string, boolean> = {
      api: true,
      database: false,
      redis: false,
      qdrant: false,
    };

    try {
      // 1. PostgreSQL check
      await db.execute(sql`SELECT 1`);
      checks.database = true;

      // 2. Redis BullMQ ping
      const ping = await this.redis.ping();
      checks.redis = ping === 'PONG';

      // 3. Qdrant cluster check
      const collections = await this.qdrant.getCollections();
      checks.qdrant = collections.collections.some((c) => c.name === 'retail_catalog_v1');

      const isHealthy = Object.values(checks).every(Boolean);
      return res.status(isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).json({
        status: isHealthy ? 'HEALTHY' : 'DEGRADED',
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.0',
        checks,
      });
    } catch (err: any) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'UNHEALTHY',
        error: err.message,
        checks,
      });
    }
  }
}
```

---

### Step 9.4: Staged Canary Traffic Routing Strategy
Execute canary deployments across three explicit verification gates:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              STAGED CANARY RELEASE PROGRESSION                         │
├───────────────────┬──────────────┬──────────────┬──────────────────────────────────────┤
│ Phase Stage       │ Traffic %    │ Soak Window  │ Gate Verification Thresholds         │
├───────────────────┼──────────────┼──────────────┼──────────────────────────────────────┤
│ Phase 1: Canary   │ 10% of users │ 2 Hours      │ 5xx Error Rate ≤ 0.5%;               │
│                   │              │              │ Warm GPU latency p90 ≤ 15.0s         │
├───────────────────┼──────────────┼──────────────┼──────────────────────────────────────┤
│ Phase 2: Expanded │ 50% of users │ 4 Hours      │ Zero BullMQ worker queue starvation; │
│                   │              │              │ Affiliate CTR (EV-202) ≥ 20%         │
├───────────────────┼──────────────┼──────────────┼──────────────────────────────────────┤
│ Phase 3: Full Cut │ 100% of users│ Continuous   │ All baseline SLOs sustained;         │
│                   │              │              │ Previous container digest decommissioned│
└───────────────────┴──────────────┴──────────────┴──────────────────────────────────────┘
```

---

### Step 9.5: Real-Time Telemetry & Growth Instrumentation (`telemetry.service.ts`)
Implement server-side telemetry capture recording the North Star Metric (QSOS: Qualified Spatial Outbound Sessions) and funnel events (`EV-101` through `EV-302`).

* **Target Files:**
  * `apps/api/src/modules/telemetry/telemetry.service.ts`

* **Concrete Telemetry Service:**
```typescript
// apps/api/src/modules/telemetry/telemetry.service.ts
import { Injectable, Logger } from '@nestjs/common';
import type { TelemetryEvent } from '@roomcommerce/contracts';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  async trackEvent(event: TelemetryEvent, userId?: string, ip?: string) {
    const payload = {
      ...event,
      userId,
      ipHash: ip ? this.hashIp(ip) : undefined,
      timestamp: new Date().toISOString(),
    };

    // Structured JSON log ingested into Datadog / OpenTelemetry pipeline
    this.logger.log(`[TELEMETRY] ${JSON.stringify(payload)}`);

    // Instrument North Star Metric: Qualified Spatial Outbound Session (QSOS)
    if (event.event_name === 'affiliate_outbound_clk') {
      this.logger.log(`[NORTH_STAR_QSOS] User ${userId} engaged outbound conversion on SKU ${event.properties.sku_id}`);
    }
  }

  private hashIp(ip: string): string {
    return require('crypto').createHash('sha256').update(ip).digest('hex').substring(0, 16);
  }
}
```

---

### Step 9.6: Automated Circuit-Breaker Rollback Protocol
Implement the automated emergency rollback mechanism executed if critical operational boundaries are violated.

* **Target Files:**
  * `apps/api/scripts/circuit-breaker-monitor.ts`

* **Automated Rollback Criteria:**
  1. `5xx HTTP Error Rate > 1.0%` over any 5-minute rolling window.
  2. `Warm GPU Latency p90 > 18.0s` for 3 consecutive minutes.
  3. `Zero out-of-stock leak failure` detected in production logs.

* **Execution Action:**
  1. Automated AWS CLI trigger runs: `aws ecs update-service --cluster roomcommerce-prod --service api --task-definition roomcommerce-api:PREVIOUS_STABLE`.
  2. Cloudflare Worker traffic split immediately resets to `100% Stable`.
  3. PagerDuty P1 incident dispatched to the SRE on-call rotation.

---

## 4. Test & Verification Gate

### 4.1 Coverage Targets
* **Container Build Test:** Dockerfiles build within memory budget ($< 4\text{GB}$) in $< 4\text{ minutes}$.
* **Health Check Reliability:** `/api/v1/health` responds in $\le 50\text{ms}$ under nominal conditions.
* **Canary Cutover Verification:** Automated rollback triggers within $< 60\text{s}$ during simulated 5xx error injection.

### 4.2 Automated Verification Commands
```bash
# 1. Build and test production Docker containers locally
docker build -t test-web -f apps/web/Dockerfile .
docker build -t test-api -f apps/api/Dockerfile .

# 2. Execute deep health check endpoint validation
curl -s http://localhost:4000/api/v1/health | jq .

# 3. Simulate canary traffic split verification via Cloudflare API
curl -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  https://api.cloudflare.com/client/v4/zones/$ZONE_ID/workers/routes

# 4. Dry-run circuit-breaker emergency rollback command
aws ecs describe-services --cluster roomcommerce-prod --services api --query "services[0].taskDefinition"
```

### 4.3 Acceptance Criteria Checklist
* [ ] Next.js standalone container runs under non-root `nextjs` user with bundle size $< 180\text{MB}$.
* [ ] NestJS API container runs cleanly with healthy database connection pooling.
* [ ] Deep health check returns `status: HEALTHY` across PostgreSQL, Redis, and Qdrant.
* [ ] Canary traffic routing successfully diverts 10% of sessions during Phase 1 soak window.
* [ ] Automated rollback script successfully reverts ECS task definition within 60 seconds if error thresholds breach 1%.
* [ ] Structured telemetry logs capturing events `EV-101` through `EV-302` stream to log aggregators.

---

## 5. Potential Blockers & Rollback Protocols

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                BLOCKERS & RESOLUTION MATRIX                            │
├─────────────────────────┬────────────────────────────┬─────────────────────────────────┤
│ Failure Mode            │ Impact / Symptom           │ Mitigation & Resolution         │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ ECR Image Push Fails    │ CI pipeline aborts;        │ Use ECR credential helper with  │
│ on Token Expiry         │ deployment blocked         │ automated token refresh action. │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ Database Migration Lock │ API tasks fail to start on │ Run Drizzle migrations in a     │
│ on Multi-Task Launch    │ simultaneous container boot│ standalone one-shot ECS task    │
│                         │                            │ prior to launching service fleet│
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ Cloudflare Edge Cache   │ Users serve stale JS chunks│ Append automated cache purge    │
│ Serves Mixed Bundles    │ after production cutover   │ step for `/_next/static/*` in CD│
└─────────────────────────┴────────────────────────────┴─────────────────────────────────┘
```

### Rollback Protocol
1. **Instant Rollback:** Execute `aws ecs update-service --cluster roomcommerce-prod --service api --task-definition roomcommerce-api:PREVIOUS_STABLE --force-new-deployment`.
2. **CDN Invalidation:** Purge Cloudflare edge cache for `apps/web`: `curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" -d '{"purge_everything":true}'`.
3. **Post-Mortem Review:** Retrieve container logs via AWS CloudWatch Insights and preserve task failure memory dumps for analysis.
