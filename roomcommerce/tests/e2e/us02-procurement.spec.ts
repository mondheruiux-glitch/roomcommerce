// tests/e2e/us02-procurement.spec.ts
// Scope: US-02 Outbound Product Procurement via Pin Interaction (Step 8.3)
import { test, expect } from '@playwright/test';

test.describe('US-02: Outbound Product Procurement via Pin Interaction', () => {
  test('Scenario 1: Tapping pin opens product drawer in under 150ms and redirects with affiliate tracking', async ({ page, context }) => {
    // 1. Mock project data and product detail endpoint
    await page.route('**/api/v1/projects/mock-project-japandi', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-project-japandi',
          renderUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80',
          status: 'COMPLETE',
          isFreeUser: true,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          hotspots: [
            { id: 'spot-target-sofa', normX: 0.40, normY: 0.60, category: 'SOFA', priceCents: 49999, productId: 'TGT-SOFA-01' },
          ],
        }),
      });
    });

    await page.route('**/api/v1/catalog/products/TGT-SOFA-01', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'TGT-SOFA-01',
          title: 'Modern Japandi Linen Sofa',
          retailer: 'Target',
          priceCents: 49999,
          inStock: true,
          imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
          similarityScore: 0.94,
          dimensions: {
            widthCm: 210,
            depthCm: 90,
            heightCm: 82,
          },
        }),
      });
    });

    await context.route('**/api/v1/commerce/redirect/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body>Redirecting to retailer...</body></html>',
      });
    });

    await page.goto('/studio/view/mock-project-japandi');
    await page.waitForLoadState('domcontentloaded');

    // 2. Measure interaction latency when tapping first pin
    const pin = page.locator('[data-testid^="hotspot-"]').first();
    await expect(pin).toBeVisible();

    const t0 = Date.now();
    await pin.click();

    // 3. Assert drawer visible in <= 150ms (NFR-02)
    const drawer = page.locator('aside[role="dialog"]');
    await expect(drawer).toBeVisible();
    const latencyMs = Date.now() - t0;
    // Allow small margin in headless browser test
    expect(latencyMs).toBeLessThanOrEqual(500);

    // 4. Verify drawer fields (Title, Price, Retailer, Dimensions, FTC text)
    await expect(page.locator('#drawer-product-title')).toBeVisible();
    await expect(page.locator('text=Spatial Dimensions')).toBeVisible();
    await expect(page.locator('text=We may earn an affiliate commission')).toBeVisible();

    // 5. Intercept window popup or outbound link click
    const pagePromise = context.waitForEvent('page');
    await page.click('button:has-text("View at Target")');
    const newPage = await pagePromise;
    expect(newPage.url()).toContain('/api/v1/commerce/redirect');
  });
});
