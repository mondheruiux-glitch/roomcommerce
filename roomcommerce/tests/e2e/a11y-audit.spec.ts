// tests/e2e/a11y-audit.spec.ts
// Scope: Automated Axe-Core Accessibility Testing — WCAG 2.1 Level AA
// Covers: SCR-01 through SCR-10, ACC-01, ACC-02 (AdsSkuSpecTable screen-reader)
// Plan Reference: Step 8.7

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// All 10 core application screens mapped to their plan screen IDs
const AUDIT_ROUTES: Array<{ scr: string; path: string }> = [
  { scr: 'SCR-01', path: '/' },                                          // Landing / Hero
  { scr: 'SCR-02', path: '/auth' },                                       // Sign-in / Auth
  { scr: 'SCR-03', path: '/studio' },                                     // Studio Dashboard
  { scr: 'SCR-04', path: '/studio/new/upload' },                          // Image Upload / Dropzone
  { scr: 'SCR-05', path: '/studio/new/inspect' },                         // Quality Inspection
  { scr: 'SCR-06', path: '/studio/new/configure' },                       // Style & Budget Config
  { scr: 'SCR-07', path: '/studio/render/mock-render-progress' },         // SSE Progress Screen
  { scr: 'SCR-08', path: '/studio/view/mock-project' },                   // Shoppable Canvas
  { scr: 'SCR-09', path: '/account/billing' },                            // Billing / Pass Management
  { scr: 'SCR-10', path: '/account/settings' },                           // Account Settings
];

test.describe('WCAG 2.1 Level AA Accessibility Audit (ACC-01)', () => {
  for (const { scr, path } of AUDIT_ROUTES) {
    test(`${scr}: "${path}" has zero WCAG 2.1 AA violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('domcontentloaded');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        // Exclude semi-transparent watermark overlay per blocker matrix §5
        .exclude('#watermark')
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
});

// ── ACC-02: AdsSkuSpecTable screen-reader role validation (SCR-08B) ──────────
test.describe('ACC-02: AdsSkuSpecTable Screen-Reader Compatibility (SCR-08B)', () => {
  test('Product dimension spec table has correct ARIA table role and accessible headers', async ({ page }) => {
    await page.route('**/api/v1/projects/mock-project', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-project',
          renderUrl: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80',
          status: 'COMPLETE',
          isFreeUser: true,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          hotspots: [
            { id: 'spot-1', normX: 0.4, normY: 0.6, category: 'SOFA', priceCents: 49900, productId: 'ACC-TEST-SKU' },
          ],
        }),
      });
    });

    await page.route('**/api/v1/catalog/products/ACC-TEST-SKU', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'ACC-TEST-SKU',
          title: 'Accessible Japandi Sofa',
          retailer: 'Target',
          priceCents: 49900,
          inStock: true,
          similarityScore: 0.93,
          imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
          dimensions: { widthCm: 210, depthCm: 90, heightCm: 82 },
        }),
      });
    });

    await page.goto('/studio/view/mock-project');
    await page.waitForLoadState('domcontentloaded');

    // Open the product drawer by clicking the first hotspot
    const pin = page.locator('[data-testid^="hotspot-"]').first();
    await expect(pin).toBeVisible();
    await pin.click();

    const drawer = page.locator('aside[role="dialog"]');
    await expect(drawer).toBeVisible();

    // ACC-02: Dimension spec table must use semantic <table> or role="table"
    const specTable = drawer.locator('[data-testid="sku-spec-table"], table, [role="table"]').first();
    await expect(specTable).toBeVisible();

    // Column headers must be present for screen readers
    const headers = specTable.locator('th, [role="columnheader"]');
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThanOrEqual(2); // e.g. "Dimension" | "Metric" | "Imperial"

    // Run targeted Axe-core audit on the drawer only (faster, focused scan)
    const drawerResults = await new AxeBuilder({ page })
      .include('aside[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(drawerResults.violations).toEqual([]);
  });
});
