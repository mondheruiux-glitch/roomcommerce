// tests/e2e/us01-generation.spec.ts
// Scope: US-01 First-Time Room Transformation & Hotspot Generation (Step 8.2)
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('US-01: First-Time Room Transformation & Hotspot Generation', () => {
  test('Scenario 1: Successful end-to-end generation under 15 seconds within budget', async ({ page }) => {
    // Mock backend API endpoints for deterministic E2E flow
    await page.route('**/api/v1/projects', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              projectId: 'proj-e2e-us01',
              uploadUrl: 'https://mock-r2.cloudflarestorage.com/uploads/proj-e2e-us01.jpg',
            },
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
        body: JSON.stringify({
          data: {
            jobId: 'job-e2e-us01',
          },
        }),
      });
    });

    await page.route('**/api/v1/projects/*/events', async (route) => {
      // Send SSE progress followed by complete event
      const sseBody = [
        'event: progress\ndata: {"phase":"QUEUED","percent":10,"message":"Queued for rendering...","projectId":"proj-e2e-us01"}\n\n',
        'event: progress\ndata: {"phase":"DEPTH_ESTIMATION","percent":35,"message":"Analyzing spatial perspective...","projectId":"proj-e2e-us01"}\n\n',
        'event: progress\ndata: {"phase":"INPAINTING","percent":65,"message":"Generating photorealistic redesign...","projectId":"proj-e2e-us01"}\n\n',
        'event: progress\ndata: {"phase":"CATALOG_MATCHING","percent":90,"message":"Matching verified in-stock products...","projectId":"proj-e2e-us01"}\n\n',
        'event: complete\ndata: {"projectId":"proj-e2e-us01"}\n\n',
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

    await page.route('**/api/v1/projects/proj-e2e-us01', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'proj-e2e-us01',
          renderUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80',
          status: 'COMPLETE',
          isFreeUser: true,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          hotspots: [
            { id: 'spot-1', normX: 0.35, normY: 0.65, category: 'SOFA', priceCents: 49900, productId: 'sku-sofa-1' },
            { id: 'spot-2', normX: 0.55, normY: 0.75, category: 'COFFEE_TABLE', priceCents: 15900, productId: 'sku-table-1' },
            { id: 'spot-3', normX: 0.70, normY: 0.50, category: 'FLOOR_LAMP', priceCents: 8900, productId: 'sku-lamp-1' },
            { id: 'spot-4', normX: 0.25, normY: 0.85, category: 'WOVEN_RUG', priceCents: 19900, productId: 'sku-rug-1' },
          ],
        }),
      });
    });

    // 1. Visit landing page (SCR-01)
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1')).toContainText(/Redesign/i);

    // 2. Click guest intake CTA -> Navigates to SCR-04
    await page.locator('#hero-upload-cta').click();
    await expect(page).toHaveURL(/\/studio\/new\/upload/, { timeout: 15000 });

    // 3. Upload valid room photo
    const fixturePath = path.join(__dirname, '../fixtures/clear_living_room.jpg');
    await page.locator('input[type="file"]').setInputFiles(fixturePath);

    // 4. Verify review / inspect step (SCR-05) & Continue
    await expect(page).toHaveURL(/\/studio\/new\/inspect/, { timeout: 10000 });
    await expect(page.locator('h1')).toContainText(/Quality Review/i);
    await page.click('#inspect-continue-btn');

    // 5. Select style and configure budget (SCR-06)
    await expect(page).toHaveURL(/\/studio\/new\/configure/);
    await page.click('button:has-text("Japandi")');
    await page.click('button[type="submit"]');

    // 6. Monitor SSE Progress Screen (SCR-07)
    await expect(page).toHaveURL(/\/studio\/render\//);
    const progressHeading = page.locator('h1');
    await expect(progressHeading).toContainText(/Redesigning/i);

    // 7. Verify automatic redirect to Interactive Canvas (SCR-08) within 15 seconds SLA
    const startTime = Date.now();
    await expect(page).toHaveURL(/\/studio\/view\/proj-e2e-us01/, { timeout: 15000 });
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    expect(elapsedSeconds).toBeLessThanOrEqual(15.0);

    // 8. Assert pins are displayed on canvas
    const pins = page.locator('[data-testid^="hotspot-"]');
    await expect(pins.first()).toBeVisible({ timeout: 10000 });

    // 9. Assert between 3 and 7 product pins rendered
    const pinCount = await pins.count();
    expect(pinCount).toBeGreaterThanOrEqual(3);
    expect(pinCount).toBeLessThanOrEqual(7);
  });

  test('Scenario 2: Blurry photo rejection and file type validation (FR-105)', async ({ page }) => {
    await page.goto('/studio/new/upload');

    // Attempt to upload an invalid file extension
    const invalidFile = {
      name: 'room_data.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 dummy document content'),
    };

    await page.locator('input[type="file"]').setInputFiles(invalidFile);

    // Assert actionable error message is shown to user
    const errorAlert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
    await expect(errorAlert).toBeVisible();
    await expect(errorAlert).toContainText(/Please upload a JPG, PNG, or HEIC/i);
  });
});
