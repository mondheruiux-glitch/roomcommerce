// tests/e2e/chaos-fault-injection.spec.ts
// Scope: Chaos & Fault Injection Suite (NFR-06, RSK-01, Step 8.2 In-Scope §1.2)
//
// Covers:
//   - Worker timeout simulation (> 25s) → user credit restitution + graceful error toast
//   - Upstream merchant 404 dead link → instant secondary match promotion (RSK-01)
//   - Network disconnection recovery during SSE stream
//   - Non-interior image rejection (negative path)

import { test, expect } from '@playwright/test';
import path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// CHAOS SCENARIO 1: GPU Worker Timeout → Credit Restitution (NFR-06)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Chaos: GPU Worker Timeout & Credit Restitution (NFR-06)', () => {
  test('Timeout after 25s causes graceful error toast and credits are refunded', async ({ page }) => {
    // Seed authenticated user with 1 credit
    await page.context().addCookies([
      { name: 'prc_auth_token', value: 'valid-paid-pass-jwt', domain: 'localhost', path: '/' },
    ]);

    // Mock project creation — returns a normal job ID
    await page.route('**/api/v1/projects', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              projectId: 'proj-timeout-chaos',
              uploadUrl: 'https://mock-r2.cloudflarestorage.com/uploads/proj-timeout-chaos.jpg',
            },
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock R2 upload as instant success
    await page.route('https://mock-r2.cloudflarestorage.com/**', async (route) => {
      await route.fulfill({ status: 200, body: 'OK' });
    });

    // Mock render trigger
    await page.route('**/api/v1/projects/*/render', async (route) => {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ data: { jobId: 'job-timeout-chaos' } }),
      });
    });

    // ← KEY CHAOS INJECTION: SSE stream emits a timeout failure event
    await page.route('**/api/v1/projects/*/events', async (route) => {
      const sseBody = [
        'event: progress\ndata: {"phase":"QUEUED","percent":10,"message":"Queued for rendering..."}\n\n',
        'event: progress\ndata: {"phase":"INPAINTING","percent":40,"message":"Generating redesign..."}\n\n',
        // Worker exceeds 25s SLA → orchestrator emits failure
        'event: error\ndata: {"code":"WORKER_TIMEOUT","message":"GPU worker exceeded 25s threshold. Your credit has been refunded.","creditRefunded":true}\n\n',
      ].join('');

      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
        body: sseBody,
      });
    });

    // Navigate to the upload page and submit a room photo
    await page.goto('/studio/new/upload');
    const fixturePath = path.join(__dirname, '../fixtures/clear_living_room.jpg');
    await page.locator('input[type="file"]').setInputFiles(fixturePath);

    await expect(page).toHaveURL(/\/studio\/new\/inspect/, { timeout: 10000 });
    await page.click('#inspect-continue-btn');
    await expect(page).toHaveURL(/\/studio\/new\/configure/);
    await page.click('button:has-text("Japandi")');
    await page.click('button[type="submit"]');

    // Should navigate to SSE progress screen
    await expect(page).toHaveURL(/\/studio\/render\//);

    // ── ASSERTIONS ──
    // 1. Error toast / alert must be visible and mention the timeout
    const errorToast = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await expect(errorToast).toBeVisible({ timeout: 10000 });
    await expect(errorToast).toContainText(/exceeded|timeout|refunded/i);

    // 2. User must NOT be redirected to canvas (generation failed)
    await expect(page).not.toHaveURL(/\/studio\/view\//);

    // 3. "Try Again" recovery CTA must be visible so user isn't stranded
    const retryBtn = page.locator('button:has-text("Try Again"), a:has-text("Try Again")');
    await expect(retryBtn).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAOS SCENARIO 2: Upstream Merchant 404 → Secondary Match Promotion (RSK-01)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Chaos: Merchant 404 Dead Link → Secondary SKU Promotion (RSK-01)', () => {
  test('When primary product URL returns 404, secondary match is auto-promoted to drawer', async ({ page }) => {
    // Project canvas with a hotspot whose primary SKU will return 404
    await page.route('**/api/v1/projects/proj-dead-link', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'proj-dead-link',
          renderUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80',
          status: 'COMPLETE',
          isFreeUser: true,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          hotspots: [
            {
              id: 'spot-dead-product',
              normX: 0.45,
              normY: 0.60,
              category: 'SOFA',
              priceCents: 59900,
              productId: 'DEAD-SKU-001',
            },
          ],
        }),
      });
    });

    // ← CHAOS: Primary product endpoint returns 404 (dead link / OOS)
    await page.route('**/api/v1/catalog/products/DEAD-SKU-001', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Product no longer available' }),
      });
    });

    // ← API responds with a promoted secondary match when primary is unavailable
    await page.route('**/api/v1/catalog/products/DEAD-SKU-001/alternatives*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'ALT-SKU-002',
              title: 'Alternative Japandi Sofa (In-Stock)',
              retailer: 'IKEA',
              priceCents: 54900,
              inStock: true,
              similarityScore: 0.91,
              imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
              dimensions: { widthCm: 205, depthCm: 88, heightCm: 80 },
            },
          ],
        }),
      });
    });

    await page.goto('/studio/view/proj-dead-link');
    await page.waitForLoadState('domcontentloaded');

    // Click the hotspot pin with dead product
    const pin = page.locator('[data-testid^="hotspot-"]').first();
    await expect(pin).toBeVisible();
    await pin.click();

    // ── ASSERTIONS ──
    // 1. Drawer must open (no broken / blank state)
    const drawer = page.locator('aside[role="dialog"]');
    await expect(drawer).toBeVisible();

    // 2. Drawer shows a promoted secondary match — NOT an error state
    await expect(drawer).not.toContainText(/unavailable|not found|error/i);
    await expect(page.locator('#drawer-product-title')).toBeVisible();

    // 3. "Alternative" or "Similar" label signals to user it is a secondary match
    const altLabel = page.locator('text=Alternative, text=Similar Item, [data-testid="alt-badge"]');
    await expect(altLabel.first()).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAOS SCENARIO 3: Network Disconnection Recovery During SSE Stream
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Chaos: Network Disconnection During SSE → Auto-Reconnect (NFR-06)', () => {
  test('Progress screen auto-reconnects and resumes polling after brief network outage', async ({ page, context }) => {
    await page.route('**/api/v1/projects', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: { projectId: 'proj-reconnect-chaos', uploadUrl: 'https://mock-r2.cloudflarestorage.com/uploads/rc.jpg' },
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route('https://mock-r2.cloudflarestorage.com/**', async (route) => {
      await route.fulfill({ status: 200, body: 'OK' });
    });

    await page.route('**/api/v1/projects/*/render', async (route) => {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ data: { jobId: 'job-reconnect' } }),
      });
    });

    let requestCount = 0;
    await page.route('**/api/v1/projects/*/events', async (route) => {
      requestCount++;

      if (requestCount === 1) {
        // First connection: send partial progress then abort (simulates network drop)
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
          body: 'event: progress\ndata: {"phase":"QUEUED","percent":10,"message":"Queued..."}\n\n',
        });
      } else {
        // Second connection (reconnect): deliver full success
        const sseBody = [
          'event: progress\ndata: {"phase":"INPAINTING","percent":65,"message":"Generating redesign..."}\n\n',
          'event: complete\ndata: {"projectId":"proj-reconnect-chaos"}\n\n',
        ].join('');
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
          body: sseBody,
        });
      }
    });

    await page.route('**/api/v1/projects/proj-reconnect-chaos', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'proj-reconnect-chaos',
          renderUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80',
          status: 'COMPLETE',
          isFreeUser: true,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          hotspots: [
            { id: 'spot-r1', normX: 0.3, normY: 0.5, category: 'SOFA', priceCents: 45000, productId: 'sku-r1' },
            { id: 'spot-r2', normX: 0.6, normY: 0.7, category: 'COFFEE_TABLE', priceCents: 12000, productId: 'sku-r2' },
            { id: 'spot-r3', normX: 0.8, normY: 0.4, category: 'FLOOR_LAMP', priceCents: 8000, productId: 'sku-r3' },
          ],
        }),
      });
    });

    await page.goto('/studio/new/upload');
    const fixturePath = path.join(__dirname, '../fixtures/clear_living_room.jpg');
    await page.locator('input[type="file"]').setInputFiles(fixturePath);

    await expect(page).toHaveURL(/\/studio\/new\/inspect/, { timeout: 10000 });
    await page.click('#inspect-continue-btn');
    await expect(page).toHaveURL(/\/studio\/new\/configure/);
    await page.click('button:has-text("Japandi")');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/studio\/render\//);

    // After reconnect, generation completes — redirects to canvas
    await expect(page).toHaveURL(/\/studio\/view\/proj-reconnect-chaos/, { timeout: 30000 });

    // Canvas shows pins from the completed generation
    const pins = page.locator('[data-testid^="hotspot-"]');
    const pinCount = await pins.count();
    expect(pinCount).toBeGreaterThanOrEqual(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAOS SCENARIO 4: Non-Interior Image Rejection (Negative Path)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Chaos: Non-Interior Image Rejection (Negative Path, FR-105)', () => {
  test('Uploading a non-room image is rejected with instructive error', async ({ page }) => {
    // Simulate the quality-gate API returning a non-interior rejection
    await page.route('**/api/v1/inspect', async (route) => {
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'NOT_INTERIOR',
          message: 'This image does not appear to be an interior room. Please upload a photo of your living space.',
        }),
      });
    });

    await page.goto('/studio/new/upload');

    // Simulate uploading a non-interior file (use blurred fixture as stand-in)
    const fixturePath = path.join(__dirname, '../fixtures/blurred_living_room.jpg');
    await page.locator('input[type="file"]').setInputFiles(fixturePath);

    // ── ASSERTIONS ──
    // 1. Rejection alert must be clearly visible
    const errorAlert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await expect(errorAlert).toBeVisible({ timeout: 10000 });

    // 2. Message must be instructive (not just a code)
    await expect(errorAlert).toContainText(/interior|living space|room/i);

    // 3. Continue / Submit must be disabled to block further progression
    const continueBtn = page.locator('button:has-text("Continue"), button[type="submit"]');
    await expect(continueBtn.first()).toBeDisabled();
  });
});
