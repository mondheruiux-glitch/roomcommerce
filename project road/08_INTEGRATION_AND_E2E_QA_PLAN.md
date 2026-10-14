# Plan Document: 08_INTEGRATION_AND_E2E_QA_PLAN.md
# Scope: End-to-End Browser Automation (Playwright), k6 Load Testing, Axe-Core A11y & Chaos Fault Injection
# Traceable PRD Requirements: All (US-01, US-02, US-03, NFR-01, NFR-02, NFR-03, NFR-05, NFR-06, ACC-01, ACC-02, BR-01, BR-02, BR-03)

---

## 1. Objective & Scope Boundaries

### 1.1 Objective
Construct the master automated quality assurance, integration, and reliability test suite for Project RoomCommerce. This plan validates the entire integrated stack (Next.js 15 client, NestJS API, PostgreSQL Aurora, Redis BullMQ, serverless GPU pipeline, and Qdrant vector database) against approved user stories (`US-01`, `US-02`, `US-03`), non-functional latency and concurrency SLAs (`NFR-01` to `NFR-06`), WCAG 2.1 Level AA accessibility standards, and chaos fault-injection scenarios.

### 1.2 In-Scope
* **Playwright End-to-End User Journeys (`tests/e2e/`):**
  * `US-01` (First-Time Redesign & Hotspots): Guest upload ➔ Quality inspection ➔ Style/Budget configuration ➔ SSE generation stream ➔ Shoppable canvas with 3–7 pins within budget.
  * `US-02` (Pin Interaction & Affiliate Procurement): Hotspot click ($\le 150\text{ms}$) ➔ Product Drawer ➔ Dimensions display ➔ Outbound affiliate redirect (`EV-202`).
  * `US-03` (Anchor Item Locking): Move-In Pass holder locks existing sofa ➔ Inpainting mask generation preserves couch ➔ Restyles surrounding room.
  * Negative / Edge-Case Journeys: Blurry image rejection, non-interior rejection, network disconnection recovery, GPU worker timeout recovery.
  * Mobile Touch & Layout Regression: Verified resolution of mobile canvas clipping (`DEF-008`) on iOS Safari viewport simulations.
* **k6 Concurrency & Load Stress Harness (`tests/load/`):**
  * Burst test simulating 50 concurrent room generation requests verifying auto-scaling and queue depths (`NFR-05`).
  * Vector search query load test asserting $\le 80\text{ms}$ retrieval under load (`NFR-03`).
* **Automated Accessibility Testing (`@axe-core/playwright`):**
  * 100% automated WCAG 2.1 AA audits across screens `SCR-01` through `SCR-10`.
  * Verified screen-reader compatibility of `AdsSkuSpecTable` (`SCR-08B`, `ACC-02`).
* **Chaos & Fault Injection Suite:**
  * Worker timeout simulation (> 25s) asserting user credit restitution and graceful error toasts (`NFR-06`).
  * Upstream merchant 404 dead link simulation asserting instant secondary match promotion (`RSK-01`).

### 1.3 Explicit Exclusions (Deferred to Subsequent Plans)
* Production multi-region canary rollout and AWS ECS deployment orchestration (deferred to `09_DEPLOYMENT_AND_CANARY_PLAN.md`).

---

## 2. Prerequisites & Dependency Matrix

### 2.1 Preceding Milestones
* `00_MASTER_EXECUTION_INDEX.md` through `07_SECURITY_PRIVACY_HARDENING_PLAN.md` approved.
* All application packages compiled and testable (`apps/web`, `apps/api`, `workers/gpu-runner`, `packages/*`).

### 2.2 System & Tooling Dependencies
* **E2E Automation:** `@playwright/test@^1.48.0` (Chromium, Firefox, WebKit / Mobile Safari).
* **Load Testing:** `k6` v0.54.0+ (Grafana k6).
* **Accessibility:** `@axe-core/playwright@^4.10.0`.
* **Test Fixtures:** Sample curated high-res living room photographs (Japandi, Mid-Century, blurred, pitch-black).

### 2.3 Required Environment Variables
```env
E2E_BASE_URL=http://localhost:3000
E2E_API_URL=http://localhost:4000
E2E_TEST_USER_EMAIL=qa-automation@roomcommerce.internal
E2E_MOCK_GPU_LATENCY_MS=2500
```

---

## 3. Step-by-Step Implementation Sequence

### Step 8.1: Playwright Configuration & Multi-Device Matrix (`playwright.config.ts`)
Establish the automated browser testing configuration supporting both large desktop displays ($\ge 1024\text{px}$) and touch-screen mobile viewports ($< 768\text{px}$).

* **Target Files:**
  * `playwright.config.ts`

* **Concrete Playwright Configuration:**
```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45 * 1000, // 45s global test timeout (covers async generation)
  expect: { timeout: 10 * 1000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html'], ['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'Desktop Firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'Mobile Safari (iPhone 15)',
      use: { ...devices['iPhone 15'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @roomcommerce/api start',
      url: 'http://localhost:4000/api/v1/health',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm --filter @roomcommerce/web start',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
```

---

### Step 8.2: US-01 First-Time Redesign & Hotspots Journey (`us01-generation.spec.ts`)
Automate the end-to-end guest journey: image intake, quality checks, style configuration, SSE progress, and canvas pin verification.

* **Target Files:**
  * `tests/e2e/us01-generation.spec.ts`

* **Concrete E2E Test Implementation:**
```typescript
// tests/e2e/us01-generation.spec.ts
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('US-01: First-Time Room Transformation & Hotspot Generation', () => {
  test('Scenario 1: Successful end-to-end generation under 15 seconds within budget', async ({ page }) => {
    // 1. Visit landing page (SCR-01)
    await page.goto('/');
    await expect(page.locator('h1')).toContainText(/Redesign/i);

    // 2. Click guest intake CTA -> Navigates to SCR-04
    await page.click('text=Upload Room');
    await expect(page).toHaveURL(/\/studio\/new\/upload/);

    // 3. Upload valid room photo
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="dropzone-area"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, '../fixtures/clear_living_room.jpg'));

    // 4. Verify quality gate pass (SCR-05) & Continue
    await expect(page.locator('[data-testid="quality-badge"]')).toContainText(/Passed/i);
    await page.click('text=Continue to Style');

    // 5. Select "Japandi" style and adjust budget slider to $1,500 (SCR-06)
    await page.click('[data-testid="style-card-JAPANDI"]');
    // Set budget slider value
    const slider = page.locator('role=slider[name="Room budget expenditure ceiling"]');
    await slider.focus();
    await page.click('text=Redesign Room');

    // 6. Monitor SSE Progress Screen (SCR-07)
    await expect(page).toHaveURL(/\/studio\/render\//);
    const progressText = page.locator('[data-testid="sse-status-message"]');
    await expect(progressText).toBeVisible();

    // 7. Verify automatic redirect to Interactive Canvas (SCR-08) within 15 seconds SLA
    const startTime = Date.now();
    await expect(page).toHaveURL(/\/studio\/view\//, { timeout: 15000 });
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    expect(elapsedSeconds).toBeLessThanOrEqual(15.0);

    // 8. Assert between 3 and 7 product pins rendered
    const pins = page.locator('[data-testid^="hotspot-pin-"]');
    const pinCount = await pins.count();
    expect(pinCount).toBeGreaterThanOrEqual(3);
    expect(pinCount).toBeLessThanOrEqual(7);

    // 9. Assert cumulative cart total does not exceed $1,500 budget ceiling
    const totalCostText = await page.locator('[data-testid="cart-total-gauge"]').innerText();
    const totalCost = Number(totalCostText.replace(/[^0-9.-]+/g, ''));
    expect(totalCost).toBeLessThanOrEqual(1500.0);
  });

  test('Scenario 2: Blurry photo rejected before invoking GPU inpainting (FR-105)', async ({ page }) => {
    await page.goto('/studio/new/upload');
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="dropzone-area"]');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, '../fixtures/blurred_living_room.jpg'));

    // Assert actionable error message
    const errorAlert = page.locator('[data-testid="quality-error-alert"]');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(/excessively blurry/i);

    // Verify "Continue" button is strictly disabled
    await expect(page.locator('button:has-text("Continue")')).toBeDisabled();
  });
});
```

---

### Step 8.3: US-02 Outbound Product Procurement & Redirect (`us02-procurement.spec.ts`)
Verify pin interaction latency ($\le 150\text{ms}$), product detail drawer contents, and outbound affiliate redirect generation.

* **Target Files:**
  * `tests/e2e/us02-procurement.spec.ts`

* **Concrete Implementation:**
```typescript
// tests/e2e/us02-procurement.spec.ts
import { test, expect } from '@playwright/test';

test.describe('US-02: Outbound Product Procurement via Pin Interaction', () => {
  test('Scenario 1: Tapping pin opens product drawer in under 150ms and redirects with affiliate tracking', async ({ page, context }) => {
    await page.goto('/studio/view/mock-project-japandi');

    // 1. Measure interaction latency when tapping first pin
    const pin = page.locator('[data-testid^="hotspot-pin-"]').first();
    const t0 = Date.now();
    await pin.click();

    // 2. Assert drawer visible in <= 150ms (NFR-02)
    const drawer = page.locator('role=dialog[name*="product"]');
    await expect(drawer).toBeVisible();
    const latencyMs = Date.now() - t0;
    expect(latencyMs).toBeLessThanOrEqual(150);

    // 3. Verify drawer fields (Title, Price, Retailer, Dimensions, FTC text)
    await expect(page.locator('#drawer-product-title')).toBeVisible();
    await expect(page.locator('text=Spatial Dimensions')).toBeVisible();
    await expect(page.locator('text=We may earn an affiliate commission')).toBeVisible();

    // 4. Click outbound CTA and intercept new browser tab
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      page.click('text=View at Target'),
    ]);

    // 5. Verify outbound affiliate URL format with subid click token
    await newPage.waitForLoadState();
    expect(newPage.url()).toContain('goto.target.com');
    expect(newPage.url()).toContain('subid_pin');
  });
});
```

---

### Step 8.4: US-03 Anchor Item Locking Test (`us03-anchor-locking.spec.ts`)
Verify that Move-In Pass holders can lock detected furniture pieces to preserve them during spatial inpainting (`FR-104`).

* **Target Files:**
  * `tests/e2e/us03-anchor-locking.spec.ts`

* **Concrete Implementation:**
```typescript
// tests/e2e/us03-anchor-locking.spec.ts
import { test, expect } from '@playwright/test';

test.describe('US-03: Anchor Item Locking (Preserving Existing Furniture)', () => {
  test('Move-In Pass holder locks existing sofa to exclude from inpainting', async ({ page }) => {
    // Authenticate as active Move-In Pass holder
    await page.context().addCookies([
      { name: 'prc_auth_token', value: 'valid-paid-pass-jwt', domain: 'localhost', path: '/' },
    ]);

    await page.goto('/studio/new/inspect');
    // Verify detected object bounding boxes overlay
    const sofaBoundingBox = page.locator('[data-testid="detected-box-sofa"]');
    await expect(sofaBoundingBox).toBeVisible();

    // Toggle "Keep This Item" (Anchor Lock)
    await sofaBoundingBox.click();
    await page.click('text=Lock & Keep This Sofa');
    await expect(page.locator('[data-testid="anchor-badge-sofa"]')).toHaveText(/Locked/i);

    // Proceed to generation
    await page.click('text=Continue to Style');
    await page.click('[data-testid="style-card-SCANDINAVIAN"]');
    await page.click('text=Redesign Room');

    // Canvas verification: Pin should NOT replace the original sofa
    await expect(page).toHaveURL(/\/studio\/view\//, { timeout: 15000 });
    const sofaPin = page.locator('[data-testid="hotspot-pin-sofa"]');
    await expect(sofaPin).toHaveCount(0); // Existing sofa kept; no replacement SKU pinned
  });
});
```

---

### Step 8.5: Mobile Layout & Viewport Regression Harness (`DEF-008`)
Automate viewport tests preventing clipping or hidden drawer controls on mobile devices.

* **Target Files:**
  * `tests/e2e/mobile-viewport.spec.ts`

* **Concrete Implementation:**
```typescript
// tests/e2e/mobile-viewport.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Mobile Viewport & Touch Ergonomics Audit (DEF-008)', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE / Mini

  test('Interactive canvas and product sheet do not clip off screen on small mobile', async ({ page }) => {
    await page.goto('/studio/view/mock-project-japandi');

    // Tap first pin
    await page.locator('[data-testid^="hotspot-pin-"]').first().click();

    // Mobile sheet slides up from bottom
    const sheet = page.locator('aside[role="dialog"]');
    await expect(sheet).toBeVisible();

    // Verify primary CTA button is completely within visible viewport bounds
    const ctaButton = page.locator('button:has-text("View at")');
    const box = await ctaButton.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.y + box.height).toBeLessThanOrEqual(667);
      expect(box.height).toBeGreaterThanOrEqual(48); // 48pt touch compliance
    }
  });
});
```

---

### Step 8.6: k6 Concurrency & Load Stress Harness (`tests/load/k6-burst-test.js`)
Stress the backend and queue infrastructure with 50 concurrent room generation requests (`NFR-05`).

* **Target Files:**
  * `tests/load/k6-burst-test.js`

* **Concrete k6 Script:**
```javascript
// tests/load/k6-burst-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    gpu_burst: {
      executor: 'per-vu-iterations',
      vus: 50,              // 50 concurrent users (NFR-05)
      iterations: 1,
      maxDuration: '45s',
    },
  },
  thresholds: {
    http_req_duration: ['p(90)<15000'], // p90 latency <= 15.0s SLA
    http_req_failed: ['rate<0.01'],      // Failure rate < 1%
  },
};

export default function () {
  const url = 'http://localhost:4000/api/v1/projects';
  const payload = JSON.stringify({
    style_preset: 'JAPANDI',
    room_function: 'LIVING_ROOM',
    budget_ceiling_cents: 150000,
    currency: 'USD',
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const res = http.post(url, payload, params);
  check(res, {
    'status is 201': (r) => r.status === 201,
    'has upload_url': (r) => JSON.parse(r.body).data.upload_url !== undefined,
  });

  sleep(1);
}
```

---

### Step 8.7: Automated Axe-Core Accessibility Testing (`a11y-audit.spec.ts`)
Scan all 10 core screens with `@axe-core/playwright` asserting zero WCAG 2.1 AA violations (`ACC-01`).

* **Target Files:**
  * `tests/e2e/a11y-audit.spec.ts`

* **Concrete Axe-Core Test:**
```typescript
// tests/e2e/a11y-audit.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TEST_ROUTES = ['/', '/auth', '/studio', '/studio/new/upload', '/studio/view/mock-project'];

test.describe('WCAG 2.1 Level AA Accessibility Audit', () => {
  for (const route of TEST_ROUTES) {
    test(`Route "${route}" should have zero WCAG AA accessibility violations`, async ({ page }) => {
      await page.goto(route);
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  }
});
```

---

## 4. Test & Verification Gate

### 4.1 Coverage Targets
* **E2E User Journeys:** $100\%$ pass rate across Desktop Chrome, Firefox, and Mobile Safari.
* **Concurrency SLA:** 50 concurrent requests handled with p90 latency $\le 15.0\text{s}$ and $0\%$ 500 error rate.
* **Accessibility Violations:** Exactly 0 violations detected by Axe-core.

### 4.2 Automated Verification Commands
```bash
# 1. Execute Playwright E2E test suite across all browsers
pnpm exec playwright test

# 2. Run mobile-specific touch and viewport tests
pnpm exec playwright test tests/e2e/mobile-viewport.spec.ts --project="Mobile Safari (iPhone 15)"

# 3. Execute Axe-core accessibility audit
pnpm exec playwright test tests/e2e/a11y-audit.spec.ts

# 4. Execute k6 burst load test simulating 50 concurrent room generation requests
k6 run tests/load/k6-burst-test.js
```

### 4.3 Acceptance Criteria Checklist
* [ ] `US-01` completes end-to-end generation in $\le 15\text{s}$ with 3–7 items within budget.
* [ ] `US-02` pin interaction opens product detail drawer in $\le 150\text{ms}$ and initiates valid affiliate redirect.
* [ ] `US-03` anchor item locking correctly preserves existing sofa from inpainting alterations.
* [ ] Mobile viewport tests confirm zero pin or sheet clipping on $375\text{px}$ screen widths (`DEF-008`).
* [ ] 50 concurrent requests execute without queue timeout or BullMQ dropped jobs.
* [ ] Zero accessibility violations across all evaluated screens.

---

## 5. Potential Blockers & Rollback Protocols

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                BLOCKERS & RESOLUTION MATRIX                            │
├─────────────────────────┬────────────────────────────┬─────────────────────────────────┤
│ Failure Mode            │ Impact / Symptom           │ Mitigation & Resolution         │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ Playwright Flakiness    │ Network latency causes     │ Use `page.waitForResponse` &    │
│ on SSE Progress Stream  │ intermittent timeout in CI │ test against mock SSE fixture   │
│                         │                            │ during fast local E2E runs.     │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ k6 Overloads Local      │ Local Redis/Postgres drops │ Run k6 in dedicated staging     │
│ Docker Container Fleet  │ connections during burst   │ environment with autoscaled     │
│                         │                            │ AWS Aurora connection pooling.  │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ Axe Contrast False      │ Semi-transparent watermark │ Exclude watermark overlay       │
│ Positive on Watermark   │ flags low contrast in Axe  │ container via `#watermark`      │
│                         │                            │ selector from color checks.     │
└─────────────────────────┴────────────────────────────┴─────────────────────────────────┘
```

### Rollback Protocol
If any critical E2E journey breaks during pre-release testing:
1. Block staging-to-production promotion immediately.
2. Isolate the failing layer (Frontend DOM, API endpoint, or GPU inference worker) using Playwright video and trace recordings.
3. Patch and re-run targeted spec: `pnpm exec playwright test <failing-spec>.spec.ts`.
