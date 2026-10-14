# Plan Document: 04_CORE_BACKEND_API_PLAN.md
# Scope: NestJS 11 Application API (Modular Monolith), Domain Modules, BullMQ Queues, SSE Hub & Privacy Purge
# Traceable PRD Requirements: FR-101, FR-102, FR-401, FR-403, FR-501, FR-502, FR-503, FR-504, NFR-01, NFR-04, NFR-06, SEC-01, SEC-03, PRV-01, PRV-02, BR-01, BR-03, EV-101–EV-302

---

## 1. Objective & Scope Boundaries

### 1.1 Objective
Construct the production backend application server for Project RoomCommerce using **NestJS 11** (Node.js 22 LTS Modular Monolith). This service acts as the central business orchestrator, coordinating user identity, Stripe billing, Cloudflare R2 presigned uploads, prioritized BullMQ job dispatching, real-time Server-Sent Events (SSE) telemetry, programmatic outbound affiliate redirects, and automated GDPR/CCPA privacy purge daemons.

### 1.2 In-Scope
* **Modular Monolith Architecture:** Assembly of core domain modules in `apps/api/src/modules/`:
  * `AuthModule`: Passwordless magic links, JWT issuance, HTTP-only session cookies, guest session tokens.
  * `ProjectsModule`: Intake initiation, presigned R2 PUT URL generation (`FR-101`), canvas hotspot retrieval (`FR-401`).
  * `BillingModule`: Stripe Checkout session creation for $14.99 Move-In Pass (`FR-501`) and $4.99 credit packs (`FR-502`), cryptographic webhook listener with idempotent entitlement granting (`BR-01`).
  * `InferenceModule`: Dual-priority BullMQ job queues (Paid Pass high-priority vs. Free standard), Modal GPU dispatcher, and Server-Sent Events (SSE) streaming hub (`NFR-06`, `SCR-07`).
  * `CatalogModule`: Relational SKU inspection and Qdrant candidate retrieval integration (`02_CATALOG_AND_VECTOR_PLAN.md`).
  * `CommerceModule`: Outbound programmatic affiliate redirect router (`/api/v1/commerce/redirect/:hotspot_id`), click attribution logging (`EV-202`), and session cookie stamping (`FR-403`).
  * `PrivacyModule`: Automated 7-day image and metadata purge cron (`SEC-01`, `PRV-01`) and 1-click hard deletion API (`PRV-02`).
* **Global Middleware & Security Pipeline:**
  * Contract-first validation pipe consuming `@roomcommerce/contracts` Zod schemas.
  * Standardized JSON success (`ApiSuccessResponse<T>`) and error (`ApiErrorResponse`) envelopes.
  * Global exception filter preventing raw stack traces from reaching clients.
  * Rate-limiting guard (`@nestjs/throttler`) protecting against scraping and API abuse.

### 1.3 Explicit Exclusions (Deferred to Subsequent Plans)
* Atelier UI components and Next.js frontend pages (deferred to `05_DESIGN_SYSTEM_AND_UI_PLAN.md` and `06_STUDIO_FRONTEND_CLIENT_PLAN.md`).
* PyTorch model weights and Modal serverless runner code (covered in `03_ML_WORKER_PIPELINE_PLAN.md`).
* AWS ECS Fargate infrastructure provisioning and GitHub Actions deployment scripts (deferred to `09_DEPLOYMENT_AND_CANARY_PLAN.md`).

---

## 2. Prerequisites & Dependency Matrix

### 2.1 Preceding Milestones
* `00_MASTER_EXECUTION_INDEX.md` approved.
* `01_MONOREPO_FOUNDATION_PLAN.md` approved (`packages/contracts` exporting Zod DTOs).
* `02_CATALOG_AND_VECTOR_PLAN.md` approved (PostgreSQL DDL schema and Qdrant client ready).
* `03_ML_WORKER_PIPELINE_PLAN.md` approved (Modal GPU worker interface established).

### 2.2 System & Tooling Dependencies
* **Runtime:** Node.js `22.11.0 LTS` with NestJS `11.0.0`.
* **Database & Queues:** PostgreSQL 16 (AWS Aurora) and Redis 7 (BullMQ & SSE pub/sub).
* **Storage:** Cloudflare R2 bucket with AWS S3 SDK (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`).
* **Payment Gateway:** Stripe Node SDK (`stripe@^17.2.0`).

### 2.3 Required Environment Variables
```env
# Server Runtime
PORT=4000
NODE_ENV=development
API_BASE_URL=http://localhost:4000
WEB_BASE_URL=http://localhost:3000
JWT_SECRET=super_secret_jwt_signing_key_at_least_32_chars
COOKIE_SECRET=super_secret_cookie_parser_secret

# Database & Cache
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/roomcommerce_dev?schema=public
REDIS_URL=redis://localhost:6379

# Cloudflare R2 Storage
CLOUDFLARE_R2_ACCOUNT_ID=mock_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=mock_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=mock_secret_key
CLOUDFLARE_R2_BUCKET_NAME=roomcommerce-uploads
CLOUDFLARE_R2_PUBLIC_DOMAIN=https://cdn.roomcommerce.internal

# Stripe Billing
STRIPE_SECRET_KEY=sk_test_mock_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_mock_stripe_webhook_secret

# Modal GPU Worker
MODAL_API_ENDPOINT=https://api.modal.run/v1/roomcommerce/render
MODAL_API_TOKEN=mock_modal_token
```

---

## 3. Step-by-Step Implementation Sequence

### Step 4.1: Server Core Bootstrap & Validation Pipeline (`main.ts`)
Configure the NestJS application entry point with CORS, cookie parsing, security headers, global exception filters, and Zod validation pipes.

* **Target Files:**
  * `apps/api/src/main.ts`
  * `apps/api/src/app.module.ts`
  * `apps/api/src/common/pipes/zod-validation.pipe.ts`
  * `apps/api/src/common/filters/global-exception.filter.ts`
  * `apps/api/src/common/interceptors/transform-response.interceptor.ts`

* **Concrete Zod Validation Pipe:**
```typescript
// apps/api/src/common/pipes/zod-validation.pipe.ts
import { PipeTransform, ArgumentMetadata, BadRequestException, Injectable } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema?: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (!this.schema) return value;
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: 'The submitted request parameters failed validation schema checks.',
          details,
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}
```

---

### Step 4.2: Authentication & Entitlements Engine (`AuthModule`)
Implement passwordless magic links and entitlement verification governing generation allowances (Free: 2 renders; Pass: 60 renders / 30 days).

* **Target Files:**
  * `apps/api/src/modules/auth/auth.controller.ts`
  * `apps/api/src/modules/auth/auth.service.ts`
  * `apps/api/src/modules/auth/guards/jwt-auth.guard.ts`
  * `apps/api/src/modules/auth/guards/entitlement.guard.ts`

* **Entitlement Verification Guard (`entitlement.guard.ts`):**
```typescript
// apps/api/src/modules/auth/guards/entitlement.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { db } from '../../../database';
import { users, movePasses } from '../../../database/schema';
import { eq, and, gt } from 'drizzle-orm';

@Injectable()
export class EntitlementGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Injected via JwtAuthGuard or GuestSession

    if (!user) {
      // Anonymous Guest: Check session generation count
      const guestUsed = request.cookies['prc_guest_render_count'] || 0;
      if (guestUsed >= 1) {
        throw new ForbiddenException({
          code: 'ENTITLEMENT_EXCEEDED',
          message: 'Guest trial generation used. Create an account to unlock your 2 free renders.',
        });
      }
      return true;
    }

    // 1. Check active Move-In Pass ($14.99)
    const activePass = await db.query.movePasses.findFirst({
      where: and(
        eq(movePasses.userId, user.id),
        eq(movePasses.isActive, true)
      ),
    });

    if (activePass) {
      if (activePass.generationsExecuted >= 60) { // BR-01 Fair Use Cap
        throw new ForbiddenException({
          code: 'FAIR_USE_EXCEEDED',
          message: '30-Day Move-In Pass fair use ceiling (60 renders) reached.',
        });
      }
      request.entitlement = { tier: 'MOVE_IN_PASS', passId: activePass.id };
      return true;
    }

    // 2. Check Free Tier Allowance (Max 2 renders)
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    if (!dbUser || dbUser.freeRendersUsed >= 2) {
      throw new ForbiddenException({
        code: 'ENTITLEMENT_EXCEEDED',
        message: 'You have used your 2 free redesigns. Unlock 30 days of 4K renders with a Move-In Pass.',
      });
    }

    request.entitlement = { tier: 'FREE_TIER', rendersUsed: dbUser.freeRendersUsed };
    return true;
  }
}
```

---

### Step 4.3: Projects & Presigned Upload Initiation (`ProjectsModule`)
Implement project instantiation and presigned S3/R2 direct upload URLs (`FR-101`, `FR-102`), offloading raw image payloads from API servers.

* **Target Files:**
  * `apps/api/src/modules/projects/projects.controller.ts`
  * `apps/api/src/modules/projects/projects.service.ts`
  * `apps/api/src/modules/projects/storage/r2-storage.service.ts`

* **Concrete Presigned S3/R2 Implementation:**
```typescript
// apps/api/src/modules/projects/storage/r2-storage.service.ts
import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../../config/env';

@Injectable()
export class R2StorageService {
  private readonly s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
  });

  async createPresignedUploadUrl(projectId: string, fileExtension = 'jpg'): Promise<{ uploadUrl: string; key: string }> {
    const key = `raw-uploads/${projectId}.${fileExtension}`;
    const command = new PutObjectCommand({
      Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      ContentType: `image/${fileExtension === 'heic' ? 'heic' : 'jpeg'}`,
    });

    // 5-minute expiry URL (FR-101, SEC-03)
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    return { uploadUrl, key };
  }
}
```

* **Projects Controller Method:**
```typescript
// apps/api/src/modules/projects/projects.controller.ts
@Post()
@UsePipes(new ZodValidationPipe(CreateProjectSchema))
async createProject(@Body() dto: CreateProjectDto, @Req() req: Request) {
  const user = req.user;
  const project = await this.projectsService.createProject(dto, user?.id);
  const { uploadUrl, key } = await this.r2Storage.createPresignedUploadUrl(project.id);

  return {
    success: true,
    data: {
      project_id: project.id,
      upload_url: uploadUrl,
      upload_method: 'PUT',
      expires_in_seconds: 300,
      max_size_bytes: 20971520, // 20MB limit (FR-101)
      key,
    },
  };
}
```

---

### Step 4.4: BullMQ Queue Dispatcher & Real-Time SSE Stream (`InferenceModule`)
Orchestrate serverless GPU workers via BullMQ and stream phased progress events to the client over Server-Sent Events (`NFR-06`, `SCR-07`).

* **Target Files:**
  * `apps/api/src/modules/inference/inference.controller.ts`
  * `apps/api/src/modules/inference/inference.service.ts`
  * `apps/api/src/modules/inference/queues/inference.processor.ts`
  * `apps/api/src/modules/inference/sse/pipeline-sse.service.ts`

* **BullMQ Dual-Priority Dispatcher:**
```typescript
// apps/api/src/modules/inference/inference.service.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class InferenceService {
  constructor(
    @InjectQueue('inference-jobs') private readonly queue: Queue,
    private readonly sseService: PipelineSseService,
  ) {}

  async enqueueRenderJob(projectId: string, assetKey: string, isPaidPass: boolean) {
    const job = await this.queue.add(
      'render-room',
      { projectId, assetKey },
      {
        priority: isPaidPass ? 1 : 10, // Priority 1 executes ahead of free users (10)
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
      }
    );

    return {
      job_id: job.id,
      status: 'QUEUED',
      estimated_duration_seconds: 14,
      telemetry_stream_url: `/api/v1/projects/${projectId}/events`,
    };
  }
}
```

* **Server-Sent Events (SSE) Endpoint:**
```typescript
// apps/api/src/modules/inference/inference.controller.ts
@Sse(':id/events')
streamProjectEvents(@Param('id') projectId: string): Observable<MessageEvent> {
  return this.sseService.subscribeToProject(projectId).pipe(
    map((eventData) => ({
      data: JSON.stringify(eventData),
    } as MessageEvent))
  );
}
```

---

### Step 4.5: Stripe Move-In Pass Billing Engine (`BillingModule`)
Implement Stripe Checkout integration and cryptographic webhook processing for the $14.99 30-Day Move-In Pass (`FR-501`, `BR-01`).

* **Target Files:**
  * `apps/api/src/modules/billing/billing.controller.ts`
  * `apps/api/src/modules/billing/billing.service.ts`
  * `apps/api/src/modules/billing/webhooks/stripe-webhook.service.ts`

* **Stripe Webhook Listener with Idempotency:**
```typescript
// apps/api/src/modules/billing/webhooks/stripe-webhook.service.ts
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { env } from '../../../config/env';
import { db } from '../../../database';
import { movePasses, users } from '../../../database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);
  private readonly stripe = new Stripe(env.STRIPE_SECRET_KEY);

  async handleStripeEvent(rawBody: Buffer, signature: string) {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      await this.activateMoveInPass(session);
    }
  }

  private async activateMoveInPass(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    if (!userId) return;

    // Idempotent insertion into move_passes table
    await db.transaction(async (tx) => {
      await tx.insert(movePasses).values({
        userId,
        stripeSessionId: session.id,
        amountCents: session.amount_total || 1499,
        currency: (session.currency || 'USD').toUpperCase(),
        activatedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Exactly 30 days
        generationsExecuted: 0,
      }).onConflictDoNothing();

      await tx.update(users)
        .set({ hasActivePass: true })
        .where(eq(users.id, userId));
    });

    this.logger.log(`Activated 30-Day Move-In Pass for user: ${userId}`);
  }
}
```

---

### Step 4.6: Outbound Programmatic Affiliate Redirect Router (`CommerceModule`)
Implement `/api/v1/commerce/redirect/:hotspot_id`, appending tracking subIDs, generating telemetry events (`EV-202`), and issuing an HTTP 302 redirect (`FR-403`, `BR-03`).

* **Target Files:**
  * `apps/api/src/modules/commerce/commerce.controller.ts`
  * `apps/api/src/modules/commerce/commerce.service.ts`

* **Concrete Redirect Implementation:**
```typescript
// apps/api/src/modules/commerce/commerce.controller.ts
import { Controller, Get, Param, Req, Res, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { CommerceService } from './commerce.service';

@Controller('api/v1/commerce')
export class CommerceController {
  constructor(private readonly commerceService: CommerceService) {}

  @Get('redirect/:hotspot_id')
  async handleAffiliateRedirect(
    @Param('hotspot_id') hotspotId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { destinationUrl, clickId } = await this.commerceService.processAffiliateClick(
      hotspotId,
      req.user?.id,
      req.headers['user-agent'],
      req.ip,
    );

    // Set secure 24-hour click session cookie
    res.cookie('prc_click_session', clickId, {
      path: '/',
      maxAge: 86400 * 1000,
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
    });

    // HTTP 302 Outbound Redirect
    return res.redirect(HttpStatus.FOUND, destinationUrl);
  }
}
```

---

### Step 4.7: Privacy & Ephemeral Purge Daemon (`PrivacyModule`)
Implement the automated 7-day storage purge cron and the user 1-click hard deletion API (`SEC-01`, `PRV-01`, `PRV-02`).

* **Target Files:**
  * `apps/api/src/modules/privacy/privacy.controller.ts`
  * `apps/api/src/modules/privacy/privacy.service.ts`
  * `apps/api/src/modules/privacy/cron/storage-purge.cron.ts`

* **Concrete Purge Daemon:**
```typescript
// apps/api/src/modules/privacy/cron/storage-purge.cron.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { db } from '../../../database';
import { projects } from '../../../database/schema';
import { lte, eq } from 'drizzle-orm';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../../../config/env';

@Injectable()
export class StoragePurgeCron {
  private readonly logger = new Logger(StoragePurgeCron.name);
  private readonly s3 = new S3Client({ region: 'auto' });

  // Runs daily at 03:00 UTC (SEC-01, PRV-01)
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async executePurge() {
    this.logger.log('Starting daily 7-day ephemeral image purge...');
    const expiredProjects = await db.select().from(projects).where(lte(projects.purgeScheduledAt, new Date()));

    for (const proj of expiredProjects) {
      try {
        // Delete raw photo and rendered image from Cloudflare R2
        await this.deleteR2Artifact(proj.rawImageUrl);
        if (proj.renderedImageUrl) await this.deleteR2Artifact(proj.renderedImageUrl);

        // Delete database record (cascading deletes hotspots)
        await db.delete(projects).where(eq(projects.id, proj.id));
      } catch (err: any) {
        this.logger.error(`Failed to purge project ${proj.id}: ${err.message}`);
      }
    }
    this.logger.log(`Purged ${expiredProjects.length} expired project records.`);
  }

  private async deleteR2Artifact(url: string) {
    const key = url.split('/').slice(-2).join('/'); // extracts folder/file.jpg
    await this.s3.send(new DeleteObjectCommand({ Bucket: env.CLOUDFLARE_R2_BUCKET_NAME, Key: key }));
  }
}
```

---

## 4. Test & Verification Gate

### 4.1 Coverage Targets
* **NestJS Domain Controllers & Services:** $\ge 85\%$ unit and integration coverage.
* **Stripe Webhook Idempotency:** $100\%$ verified with duplicate event replay tests.
* **Entitlement & Rate Limiting Guards:** $100\%$ boundary condition coverage (0, 1, 2, 60 runs).

### 4.2 Automated Verification Commands
```bash
# 1. Run backend unit tests with Jest
pnpm --filter @roomcommerce/api test -- --coverage

# 2. Run Stripe Webhook integration test via Stripe CLI fixture
stripe trigger checkout.session.completed
pnpm --filter @roomcommerce/api test test/billing/stripe-webhook.e2e-spec.ts

# 3. Test SSE stream connectivity and event emission
pnpm --filter @roomcommerce/api test test/inference/sse-stream.e2e-spec.ts

# 4. Verify 7-day ephemeral purge cron execution
pnpm --filter @roomcommerce/api test test/privacy/storage-purge.spec.ts
```

### 4.3 Acceptance Criteria Checklist
* [ ] Presigned R2 upload URLs generated with strict 300s TTL and 20MB payload ceiling.
* [ ] Stripe webhook idempotently activates 30-Day Move-In Pass without race conditions.
* [ ] BullMQ prioritizes Move-In Pass jobs ahead of free-tier jobs.
* [ ] Real-time SSE endpoint streams phased status events (`DEPTH_ESTIMATION` ➔ `INPAINTING` ➔ `CATALOG_MATCHING` ➔ `complete`).
* [ ] Outbound affiliate router logs `EV-202` click events and issues HTTP 302 redirect.
* [ ] Daily storage purge cron removes database rows and issues R2 delete commands for records older than 7 days.

---

## 5. Potential Blockers & Rollback Protocols

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                BLOCKERS & RESOLUTION MATRIX                            │
├─────────────────────────┬────────────────────────────┬─────────────────────────────────┤
│ Failure Mode            │ Impact / Symptom           │ Mitigation & Resolution         │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ Redis BullMQ Outage     │ Inference jobs fail to     │ Use Redis Sentinel / Cluster;   │
│                         │ enqueue; API returns 500   │ return 503 Service Unavailable  │
│                         │                            │ with graceful retry header.     │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ Stripe Webhook Latency  │ User pays but pass does    │ Provide client polling fallback │
│ or Delivery Failure     │ not unlock immediately     │ via `GET /api/v1/billing/status`│
│                         │                            │ calling Stripe API directly.    │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ SSE Connection Drops    │ Client stuck on progress   │ Implement auto-reconnect with   │
│ Through Edge Proxies    │ screen during generation   │ exponential backoff in hook;    │
│                         │                            │ add polling fallback every 4s.  │
└─────────────────────────┴────────────────────────────┴─────────────────────────────────┘
```

### Rollback Protocol
If any critical API module fails post-deployment:
1. Revert ECS task definition to previous stable container digest.
2. Invalidate Cloudflare API cache and monitor Redis queue drain rate.
3. If database schema was altered, execute down migration via `drizzle-kit drop`.
