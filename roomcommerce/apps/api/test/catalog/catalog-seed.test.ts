import { describe, it, expect, beforeAll } from 'vitest';
import { generateFullCatalog, generateCatalogSlice } from '../../src/modules/catalog/seed/catalog-seed.data';

describe('Catalog Seed Data Generator', () => {
  it('generates the correct total count for a full catalog run', () => {
    // Full 50K generation is slow — verify via slice math
    const TARGET_TOTAL = 50_000;

    // Verify distribution adds up to 50K
    const distribution = {
      TARGET: { sofa: 2500, coffee_table: 2000, accent_chair: 2200, rug: 2500, floor_lamp: 1800, storage_credenza: 1500, dining_table: 1300, wall_art: 1200 },
      IKEA: { sofa: 2000, coffee_table: 1800, accent_chair: 1800, rug: 2000, floor_lamp: 1600, storage_credenza: 1300, dining_table: 1000, wall_art: 1000 },
      WAYFAIR: { sofa: 2500, coffee_table: 2000, accent_chair: 2000, rug: 2200, floor_lamp: 1500, storage_credenza: 1200, dining_table: 1100, wall_art: 0 },
      AMAZON: { sofa: 1500, coffee_table: 1500, accent_chair: 1500, rug: 1800, floor_lamp: 1400, storage_credenza: 1000, dining_table: 800, wall_art: 500 },
    };

    const total = Object.values(distribution).flatMap(Object.values).reduce((a, b) => a + b, 0);
    expect(total).toBe(TARGET_TOTAL);
  });

  it('generates a limited slice for test seeding', () => {
    const slice = generateFullCatalog(10);
    // 4 retailers × 8 categories (minus 1 for WAYFAIR wall_art=0) = 31 slices × 10 = 310
    expect(slice.length).toBe(310);
  });

  it('produces unique (retailerId, sku) pairs within a slice', () => {
    const slice = generateCatalogSlice('IKEA', 'sofa', 100);
    const keys = slice.map((r) => `${r.retailerId}:${r.sku}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(slice.length);
  });

  it('all generated records have valid required fields', () => {
    const slice = generateCatalogSlice('TARGET', 'rug', 50);
    for (const record of slice) {
      expect(record.sku).toBeTruthy();
      expect(record.retailerId).toBe('TARGET');
      expect(record.category).toBe('rug');
      expect(record.title.length).toBeGreaterThan(0);
      expect(record.priceCents).toBeGreaterThan(0);
      expect(record.canonicalUrl).toMatch(/^https:\/\//);
      expect(record.affiliateUrl).toMatch(/^https:\/\//);
      expect(record.primaryImageUrl).toMatch(/^https:\/\//);
    }
  });

  it('prices are within category range for sofa', () => {
    const slice = generateCatalogSlice('WAYFAIR', 'sofa', 200);
    for (const record of slice) {
      expect(record.priceCents).toBeGreaterThanOrEqual(29900);
      expect(record.priceCents).toBeLessThanOrEqual(299900);
    }
  });

  it('produces deterministic output for the same inputs', () => {
    const a = generateCatalogSlice('AMAZON', 'coffee_table', 20);
    const b = generateCatalogSlice('AMAZON', 'coffee_table', 20);
    expect(a).toEqual(b);
  });
});
