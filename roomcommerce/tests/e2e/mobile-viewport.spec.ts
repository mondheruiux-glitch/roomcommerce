// tests/e2e/mobile-viewport.spec.ts
// Scope: Mobile Viewport & Touch Ergonomics Audit (DEF-008, Step 8.5)
import { test, expect } from '@playwright/test';

test.describe('Mobile Viewport & Touch Ergonomics Audit (DEF-008)', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE / Mini

  test('Interactive canvas and product sheet do not clip off screen on small mobile', async ({ page }) => {
    // Mock endpoints
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

    await page.goto('/studio/view/mock-project-japandi');
    await page.waitForLoadState('domcontentloaded');

    // Tap first pin
    const pin = page.locator('[data-testid^="hotspot-"]').first();
    await expect(pin).toBeVisible();
    await pin.click();

    // Mobile sheet slides up from bottom
    const sheet = page.locator('aside[role="dialog"]');
    await expect(sheet).toBeVisible();

    // Verify primary CTA button is visible
    const ctaButton = page.locator('button:has-text("View at")');
    await expect(ctaButton).toBeVisible();
    const box = await ctaButton.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(44); // 44-48pt touch target compliance
    }
  });
});
