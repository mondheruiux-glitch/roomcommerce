# Plan Document: 07_SECURITY_PRIVACY_HARDENING_PLAN.md
# Scope: Security Threat Modeling (STRIDE), Privacy Engineering (GDPR/CCPA/BIPA), Ephemeral Purge & OWASP Hardening
# Traceable PRD Requirements: SEC-01, SEC-02, SEC-03, PRV-01, PRV-02, FR-102, NFR-04

---

## 1. Objective & Scope Boundaries

### 1.1 Objective
Establish the enterprise security, privacy, and regulatory compliance posture for Project RoomCommerce. This plan enforces the core zero-leak domestic spatial data guarantees: client-side EXIF GPS sanitization, automated facial obfuscation, automated 7-day storage lifecycle purging, 1-click irreversible data erasure, Broken Object Level Authorization (BOLA/IDOR) defenses, and automated security verification test suites.

### 1.2 In-Scope
* **STRIDE Threat Model Hardening:** Systemic mitigations against Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege across all public and internal interfaces.
* **Client-Side Metadata Scrubbing Verification (`FR-102`):** Automated binary test asserting 100% elimination of EXIF, GPS coordinates, device serials, and timestamps before transmission.
* **Biometric & Face Obfuscation Harness (`SEC-02`):** OpenCV YuNet face detection validation ensuring family portraits and domestic human figures receive irreversible $31\times31$ Gaussian blur before model processing.
* **Ephemeral Storage Lifecycle Engine (`SEC-01`, `PRV-01`):**
  * Cloudflare R2 automated 7-day bucket lifecycle expiration configuration.
  * PostgreSQL daily cron daemon purging expired project records, hotspot pins, and raw asset keys.
* **One-Click Hard Erasure API (`PRV-02`):** Irreversible deletion endpoint `/api/v1/privacy/purge-me` cascading across PostgreSQL, Cloudflare R2, Redis, and Qdrant within single transaction boundaries.
* **BOLA / IDOR Defense Pipeline:** NestJS project ownership guards asserting that users can only inspect or modify their own domestic floorplans.
* **Network & Transit Hardening (`SEC-03`):** Strict Content Security Policy (CSP), TLS 1.3 enforcement, HSTS headers, CORS origin whitelisting, and tiered rate-limiting.

### 1.3 Explicit Exclusions (Deferred to Subsequent Plans)
* Multi-user end-to-end integration journeys and Playwright browser regression test suites (deferred to `08_INTEGRATION_AND_E2E_QA_PLAN.md`).
* Production AWS ECS task definition security groups, VPC peering, and KMS key rotation (deferred to `09_DEPLOYMENT_AND_CANARY_PLAN.md`).

---

## 2. Prerequisites & Dependency Matrix

### 2.1 Preceding Milestones
* `00_MASTER_EXECUTION_INDEX.md` approved.
* `01_MONOREPO_FOUNDATION_PLAN.md` approved.
* `04_CORE_BACKEND_API_PLAN.md` approved (`ProjectsModule` and `PrivacyModule` ready).
* `06_STUDIO_FRONTEND_CLIENT_PLAN.md` approved (`apps/web` client upload flow ready).

### 2.2 System & Security Dependencies
* **Static Analysis & Supply Chain:** `snyk@^1.1290.0`, `trivy`, `pnpm audit`.
* **API Security Testing:** OWASP ZAP automated scanner, `supertest`.
* **Cryptographic Libraries:** Node.js native `crypto` (HMAC SHA-256), `@aws-sdk/client-s3`.

### 2.3 Required Environment Variables
```env
# Security & Crypto
JWT_SECRET=super_secret_jwt_signing_key_at_least_32_chars
SESSION_SECRET=super_secret_session_encryption_key
ENCRYPTION_KEY_AES256=32_byte_hex_encoded_symmetric_key

# Cloudflare R2 Security
CLOUDFLARE_R2_BUCKET_NAME=roomcommerce-uploads
CLOUDFLARE_R2_ACCOUNT_ID=mock_account_id

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=30
```

---

## 3. Step-by-Step Implementation Sequence

### Step 7.1: STRIDE Threat Model & Architectural Mitigation Matrix
Document and implement explicit security controls against the six primary STRIDE threat vectors.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              STRIDE THREAT MITIGATION MATRIX                          │
├───────────────────┬──────────────────────────────┬─────────────────────────────────────┤
│ Threat Category   │ Vulnerability Vector         │ Engineered Mitigation Architecture  │
├───────────────────┼──────────────────────────────┼─────────────────────────────────────┤
│ Spoofing          │ Malicious actor impersonating│ Passwordless magic links with       │
│                   │ registered user or admin     │ cryptographic HMAC tokens (15m TTL);│
│                   │                              │ HTTP-only SameSite=Lax JWT cookies. │
├───────────────────┼──────────────────────────────┼─────────────────────────────────────┤
│ Tampering         │ Altering upload payloads or  │ Short-lived presigned R2 PUT URLs   │
│                   │ modifying budget parameters  │ (300s TTL); strict Zod validation   │
│                   │                              │ schema clamping budgets ($300-$10k).│
├───────────────────┼──────────────────────────────┼─────────────────────────────────────┤
│ Repudiation       │ Disputing purchases or       │ Cryptographic Stripe webhook logging│
│                   │ affiliate click attributions │ with unique session IDs and raw     │
│                   │                              │ payload signature verification.     │
├───────────────────┼──────────────────────────────┼─────────────────────────────────────┤
│ Information       │ Leaking domestic photos or   │ Client-side EXIF GPS stripping;     │
│ Disclosure (BOLA) │ accessing another user's room│ Strict ProjectOwnershipGuard on all │
│                   │ via guessable project UUID   │ `/api/v1/projects/:id` endpoints.   │
├───────────────────┼──────────────────────────────┼─────────────────────────────────────┤
│ Denial of Service │ GPU queue exhaustion via bulk│ Tiered rate limiting: 5 uploads/hr  │
│ (DoS)             │ image upload attacks         │ for guests; 60 runs/30d pass cap.   │
├───────────────────┼──────────────────────────────┼─────────────────────────────────────┤
│ Elevation of      │ Free-tier user attempting to │ Server-side EntitlementGuard; clean │
│ Privilege         │ download clean 4K renders    │ 4K assets served only via signed    │
│                   │                              │ Cloudflare R2 tokens to pass holders│
└───────────────────┴──────────────────────────────┴─────────────────────────────────────┘
```

---

### Step 7.2: Broken Object Level Authorization (BOLA / IDOR) Defense Guard
Implement strict project ownership authorization verifying that the calling session owns the requested resource before returning room imagery or hotspots.

* **Target Files:**
  * `apps/api/src/modules/projects/guards/project-ownership.guard.ts`

* **Concrete Implementation:**
```typescript
// apps/api/src/modules/projects/guards/project-ownership.guard.ts
import { Injectable, CanActivate, ExecutionContext, NotFoundException, ForbiddenException } from '@nestjs/common';
import { db } from '../../../database';
import { projects } from '../../../database/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class ProjectOwnershipGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const projectId = request.params.id;
    const user = request.user;
    const guestSessionId = request.cookies['prc_guest_session'];

    if (!projectId) return true;

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    // 1. Prevent resource enumeration by returning 404 instead of 403 if project does not exist
    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'This project does not exist or has passed the 7-day retention period.',
      });
    }

    // 2. Assert ownership: User ID matches or Guest Session matches
    const isOwner =
      (user && project.userId === user.id) ||
      (guestSessionId && project.guestSessionId === guestSessionId);

    if (!isOwner) {
      // Return 404 to avoid leaking information about existing project UUIDs
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: 'This project does not exist or has passed the 7-day retention period.',
      });
    }

    request.project = project;
    return true;
  }
}
```

---

### Step 7.3: Automated Cloudflare R2 Bucket Lifecycle Expiration Policy (`SEC-01`)
Configure automated object expiration on Cloudflare R2 / AWS S3 storage buckets, guaranteeing zero indefinite storage of domestic spatial imagery.

* **Target Files:**
  * `apps/api/scripts/configure-r2-lifecycle.ts`

* **Concrete S3/R2 Lifecycle Rule:**
```typescript
// apps/api/scripts/configure-r2-lifecycle.ts
import { S3Client, PutBucketLifecycleConfigurationCommand } from '@aws-sdk/client-s3';
import { env } from '../src/config/env';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

export async function applyR2LifecyclePolicy() {
  const command = new PutBucketLifecycleConfigurationCommand({
    Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
    LifecycleConfiguration: {
      Rules: [
        {
          ID: 'PurgeRawUserUploadsAfter7Days',
          Filter: { Prefix: 'raw-uploads/' },
          Status: 'Enabled',
          Expiration: { Days: 7 }, // SEC-01 & PRV-01
        },
        {
          ID: 'PurgeRenderedOutputAfter7Days',
          Filter: { Prefix: 'renders/' },
          Status: 'Enabled',
          Expiration: { Days: 7 },
        },
      ],
    },
  });

  await s3.send(command);
  console.log('[*] Cloudflare R2 7-day ephemeral lifecycle configuration successfully applied.');
}
```

---

### Step 7.4: One-Click Hard Erasure API Implementation (`PRV-02`)
Implement the GDPR Article 17 / CCPA compliant 1-click full erasure endpoint `/api/v1/privacy/purge-me`.

* **Target Files:**
  * `apps/api/src/modules/privacy/privacy.controller.ts`
  * `apps/api/src/modules/privacy/privacy.service.ts`

* **Concrete Purge Service:**
```typescript
// apps/api/src/modules/privacy/privacy.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../../database';
import { users, projects, movePasses, canvasHotspots } from '../../../database/schema';
import { eq } from 'drizzle-orm';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { env } from '../../../config/env';

@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);
  private readonly s3 = new S3Client({ region: 'auto' });

  async executeHardPurge(userId: string): Promise<{ success: boolean; deletedCount: number }> {
    this.logger.warn(`Executing immediate 1-click hard erasure for user: ${userId} (PRV-02)`);

    // 1. Retrieve all project asset keys belonging to user
    const userProjects = await db.select().from(projects).where(eq(projects.userId, userId));
    const objectKeysToDelete: string[] = [];

    for (const proj of userProjects) {
      if (proj.rawImageUrl) objectKeysToDelete.push(this.extractKey(proj.rawImageUrl));
      if (proj.renderedImageUrl) objectKeysToDelete.push(this.extractKey(proj.renderedImageUrl));
    }

    // 2. Batch delete object storage artifacts from Cloudflare R2
    if (objectKeysToDelete.length > 0) {
      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
          Delete: { Objects: objectKeysToDelete.map((Key) => ({ Key })) },
        })
      );
    }

    // 3. Atomically delete user record from PostgreSQL (cascades to projects, hotspots, passes)
    await db.delete(users).where(eq(users.id, userId));

    this.logger.log(`Hard erasure completed for user: ${userId}. Purged ${userProjects.length} projects.`);
    return { success: true, deletedCount: userProjects.length };
  }

  private extractKey(url: string): string {
    return url.split('/').slice(-2).join('/');
  }
}
```

---

### Step 7.5: Client-Side EXIF Stripper Automated Test Harness
Verify that no EXIF GPS data passes through the client intake module (`useExifScrubber.ts`).

* **Target Files:**
  * `apps/web/test/security/exif-scrubber.spec.ts`

* **Concrete Verification Test:**
```typescript
// apps/web/test/security/exif-scrubber.spec.ts
import { describe, it, expect } from 'vitest';
import { stripExifMetadata } from '../../src/lib/exif-scrubber';
import * as piexif from 'piexifjs';

describe('Security Gate: Client-Side EXIF Scrubbing (FR-102, SEC-02)', () => {
  it('should completely strip GPS latitude, longitude, and camera serial tags', async () => {
    // 1. Construct a mock JPEG binary with embedded GPS coordinates
    const zeroth: any = {};
    const gps: any = {};
    zeroth[piexif.ImageIFD.Make] = 'Apple';
    zeroth[piexif.ImageIFD.Model] = 'iPhone 15 Pro';
    gps[piexif.GPSIFD.GPSLatitude] = [[37, 1], [46, 1], [29, 1]]; // 37°46'29" N
    gps[piexif.GPSIFD.GPSLongitude] = [[122, 1], [25, 1], [10, 1]]; // 122°25'10" W

    const exifBytes = piexif.dump({ '0th': zeroth, GPS: gps });
    const dummyJpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRg...'; // Base JPEG data
    const jpegWithExif = piexif.insert(exifBytes, dummyJpeg);

    // Convert to File object
    const res = await fetch(jpegWithExif);
    const rawFile = new File([await res.blob()], 'room_with_gps.jpg', { type: 'image/jpeg' });

    // 2. Execute client-side scrubber
    const sanitizedBlob = await stripExifMetadata(rawFile);

    // 3. Inspect binary to confirm ZERO EXIF metadata remains
    const arrayBuffer = await sanitizedBlob.arrayBuffer();
    const binaryString = String.fromCharCode(...new Uint8Array(arrayBuffer));

    expect(() => piexif.load(binaryString)).toThrow(); // Fails because EXIF header is completely erased
  });
});
```

---

### Step 7.6: Content Security Policy & Security Headers (`next.config.mjs`)
Configure defense-in-depth HTTP headers mitigating XSS, clickjacking, and MIME sniffing attacks.

* **Target Files:**
  * `apps/web/next.config.mjs`

* **Concrete Headers Configuration:**
```javascript
// apps/web/next.config.mjs
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://cdn.roomcommerce.internal https://*.r2.cloudflarestorage.com",
      "connect-src 'self' http://localhost:4000 https://api.roomcommerce.com https://api.stripe.com",
      "frame-src https://js.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];
```

---

## 4. Test & Verification Gate

### 4.1 Coverage Targets
* **Security & Auth Unit Tests:** $100\%$ pass on BOLA ownership assertions and entitlement guards.
* **Metadata Sanitization:** $0\%$ EXIF/GPS leakage across 1,000 randomized image test runs.
* **Supply Chain Vulnerabilities:** Zero high or critical CVEs detected by `pnpm audit` and Snyk.

### 4.2 Automated Verification Commands
```bash
# 1. Verify client-side EXIF scrubbing test
pnpm --filter @roomcommerce/web test test/security/exif-scrubber.spec.ts

# 2. Run BOLA ownership guard integration tests in NestJS
pnpm --filter @roomcommerce/api test test/security/project-ownership.e2e-spec.ts

# 3. Verify 1-click hard erasure API (PRV-02) transaction integrity
pnpm --filter @roomcommerce/api test test/privacy/hard-purge.e2e-spec.ts

# 4. Supply chain dependency audit
pnpm audit --audit-level=high
```

### 4.3 Acceptance Criteria Checklist
* [ ] Attempting to access another user's project ID returns HTTP 404 (zero metadata leakage).
* [ ] Raw image uploads tested with EXIF data have 100% of GPS coordinates and camera serials removed.
* [ ] YuNet model tests verify $31\times31$ Gaussian blur on detected faces in interior portraits.
* [ ] Cloudflare R2 bucket lifecycle rules configured for 7-day automated expiration.
* [ ] Executing `POST /api/v1/privacy/purge-me` cleanly deletes user, projects, R2 assets, and passes.
* [ ] Security headers (HSTS, CSP, X-Frame-Options) verified on all HTTP responses.

---

## 5. Potential Blockers & Rollback Protocols

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                BLOCKERS & RESOLUTION MATRIX                            │
├─────────────────────────┬────────────────────────────┬─────────────────────────────────┤
│ Failure Mode            │ Impact / Symptom           │ Mitigation & Resolution         │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ Presigned PUT URL       │ Malicious actor uploads    │ Enforce `ContentLengthRange` cap│
│ Exploited with Huge File│ 500MB video to R2          │ (20MB max) directly in S3 PUT   │
│                         │                            │ presigned signature conditions. │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ CSP Policy Blocks       │ Checkout overlay fails to  │ Whitelist `https://js.stripe.com`│
│ Stripe Elements Modal   │ mount inside client iframe │ in both `script-src` & `frame-src`.│
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ Daily Purge Cron Fails  │ Storage costs accumulate;  │ Set Cloudflare R2 automated     │
│ on Locked PostgreSQL DB │ violates 7-day guarantee   │ bucket lifecycle rules as the   │
│                         │                            │ hardware-level fallback.        │
└─────────────────────────┴────────────────────────────┴─────────────────────────────────┘
```

### Rollback Protocol
1. If Content Security Policy causes client script breakage: Temporarily revert CSP header to `Report-Only` mode while investigating blocked domains.
2. If BOLA guard causes legitimate guest session lockout: Inspect `prc_guest_session` cookie encryption keys and adjust cookie SameSite parameters.
