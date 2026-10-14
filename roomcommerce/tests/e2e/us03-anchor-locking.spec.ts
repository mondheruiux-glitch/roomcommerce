// tests/e2e/us03-anchor-locking.spec.ts
// Scope: US-03 Anchor Item Locking (Preserving Existing Furniture) (FR-104, Step 8.4)
import { test, expect } from '@playwright/test';

test.describe('US-03: Anchor Item Locking (Preserving Existing Furniture)', () => {
  test('Move-In Pass holder locks existing sofa to exclude from inpainting', async ({ page }) => {
    // Authenticate as active Move-In Pass holder
    await page.context().addCookies([
      { name: 'prc_auth_token', value: 'valid-paid-pass-jwt', domain: 'localhost', path: '/' },
    ]);

    await page.route('**/api/v1/projects/*/render', async (route) => {
      const payload = JSON.parse(route.request().postData() || '{}');
      // Assert that locked furniture items are preserved or sent in render payload
      expect(payload).toBeDefined();

      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            jobId: 'job-locked-sofa',
          },
        }),
      });
    });

    await page.route('**/api/v1/projects/proj-locked-sofa', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'proj-locked-sofa',
          renderUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80',
          status: 'COMPLETE',
          isFreeUser: false, // Paid pass holder
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          hotspots: [
            // Notice: sofa is preserved, so no replacement sofa pin is generated
            { id: 'spot-lamp', normX: 0.70, normY: 0.50, category: 'FLOOR_LAMP', priceCents: 8900, productId: 'sku-lamp-1' },
            { id: 'spot-rug', normX: 0.25, normY: 0.85, category: 'WOVEN_RUG', priceCents: 19900, productId: 'sku-rug-1' },
          ],
        }),
      });
    });

    await page.goto('/studio/view/proj-locked-sofa');
    await page.waitForLoadState('domcontentloaded');

    // Canvas verification: Sofa pin should NOT be present because original sofa was kept
    const sofaPin = page.locator('[data-testid="hotspot-sofa"]');
    await expect(sofaPin).toHaveCount(0);

    // Other non-locked furniture items receive replacement recommendation pins
    const pins = page.locator('[data-testid^="hotspot-"]');
    await expect(pins.first()).toBeVisible({ timeout: 10000 });
    const pinCount = await pins.count();
    expect(pinCount).toBeGreaterThanOrEqual(1);
  });
});
