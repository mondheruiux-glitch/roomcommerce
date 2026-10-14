/**
 * Synthetic SKU Catalog Seed Data Generator
 * Produces deterministic, realistic furniture records across 4 retailers and 8 categories.
 *
 * Distribution matrix (50,000 SKUs):
 * ┌──────────────────────┬──────────┬──────┬─────────┬────────┐
 * │ Category             │ TARGET   │ IKEA │ WAYFAIR │ AMAZON │
 * ├──────────────────────┼──────────┼──────┼─────────┼────────┤
 * │ sofa                 │ 2,500    │ 2,000│ 2,500   │ 1,500  │
 * │ coffee_table         │ 2,000    │ 1,800│ 2,000   │ 1,500  │
 * │ accent_chair         │ 2,200    │ 1,800│ 2,000   │ 1,500  │
 * │ rug                  │ 2,500    │ 2,000│ 2,200   │ 1,800  │
 * │ floor_lamp           │ 1,800    │ 1,600│ 1,500   │ 1,400  │
 * │ storage_credenza     │ 1,500    │ 1,300│ 1,200   │ 1,000  │
 * │ dining_table         │ 1,300    │ 1,000│ 1,100   │ 800    │
 * │ wall_art             │ 1,200    │ 1,000│ 0       │ 500    │
 * ├──────────────────────┼──────────┼──────┼─────────┼────────┤
 * │ Total Per Merchant   │ 15,000   │12,500│ 12,500  │ 10,000 │
 * └──────────────────────┴──────────┴──────┴─────────┴────────┘
 */

import type { CatalogIngestDto } from '../dto/catalog-ingest.dto.js';

type Retailer = 'IKEA' | 'TARGET' | 'WAYFAIR' | 'AMAZON';
type Category =
  | 'sofa'
  | 'coffee_table'
  | 'accent_chair'
  | 'rug'
  | 'floor_lamp'
  | 'storage_credenza'
  | 'dining_table'
  | 'wall_art';

interface SkuSpec {
  count: number;
}

const DISTRIBUTION: Record<Retailer, Record<Category, SkuSpec>> = {
  TARGET: {
    sofa: { count: 2500 },
    coffee_table: { count: 2000 },
    accent_chair: { count: 2200 },
    rug: { count: 2500 },
    floor_lamp: { count: 1800 },
    storage_credenza: { count: 1500 },
    dining_table: { count: 1300 },
    wall_art: { count: 1200 },
  },
  IKEA: {
    sofa: { count: 2000 },
    coffee_table: { count: 1800 },
    accent_chair: { count: 1800 },
    rug: { count: 2000 },
    floor_lamp: { count: 1600 },
    storage_credenza: { count: 1300 },
    dining_table: { count: 1000 },
    wall_art: { count: 1000 },
  },
  WAYFAIR: {
    sofa: { count: 2500 },
    coffee_table: { count: 2000 },
    accent_chair: { count: 2000 },
    rug: { count: 2200 },
    floor_lamp: { count: 1500 },
    storage_credenza: { count: 1200 },
    dining_table: { count: 1100 },
    wall_art: { count: 0 },
  },
  AMAZON: {
    sofa: { count: 1500 },
    coffee_table: { count: 1500 },
    accent_chair: { count: 1500 },
    rug: { count: 1800 },
    floor_lamp: { count: 1400 },
    storage_credenza: { count: 1000 },
    dining_table: { count: 800 },
    wall_art: { count: 500 },
  },
};

const CATEGORY_PRICE_RANGES: Record<Category, [number, number]> = {
  sofa: [29900, 299900],
  coffee_table: [4999, 99900],
  accent_chair: [8999, 149900],
  rug: [2999, 89900],
  floor_lamp: [1999, 49900],
  storage_credenza: [14999, 189900],
  dining_table: [19999, 249900],
  wall_art: [1499, 49900],
};

const CATEGORY_DIMENSIONS: Record<Category, { w: [number, number]; d: [number, number]; h: [number, number] }> = {
  sofa: { w: [150, 280], d: [80, 100], h: [70, 100] },
  coffee_table: { w: [60, 150], d: [40, 90], h: [35, 55] },
  accent_chair: { w: [60, 100], d: [70, 90], h: [70, 100] },
  rug: { w: [120, 300], d: [80, 250], h: [1, 3] },
  floor_lamp: { w: [20, 50], d: [20, 50], h: [140, 200] },
  storage_credenza: { w: [100, 220], d: [35, 60], h: [60, 90] },
  dining_table: { w: [100, 240], d: [80, 110], h: [72, 80] },
  wall_art: { w: [20, 120], d: [2, 5], h: [20, 120] },
};

const STYLE_PREFIXES: Record<Retailer, string[]> = {
  IKEA: ['KALLAX', 'BILLY', 'SÖDERHAMN', 'POÄNG', 'FRIHETEN', 'KIVIK', 'HEMNES', 'BRIMNES'],
  TARGET: ['Threshold', 'Project 62', 'Studio McGee', 'Made By Design', 'Room Essentials'],
  WAYFAIR: ['Birch Lane', 'Kelly Clarkson', 'Joss & Main', 'AllModern', 'Mercury Row'],
  AMAZON: ['ZINUS', 'Christopher Knight', 'AmazonBasics', 'Nathan James', 'Yaheetech'],
};

const RETAILER_DOMAINS: Record<Retailer, string> = {
  IKEA: 'www.ikea.com',
  TARGET: 'www.target.com',
  WAYFAIR: 'www.wayfair.com',
  AMAZON: 'www.amazon.com',
};

const AFFILIATE_DOMAINS: Record<Retailer, string> = {
  IKEA: 'affiliate.roomcommerce.com/ikea',
  TARGET: 'goto.target.com/rc',
  WAYFAIR: 'www.wayfair.com/rc',
  AMAZON: 'www.amazon.com/dp',
};

/** Seeded pseudo-random to ensure deterministic, reproducible datasets */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function randInRange(min: number, max: number, seed: number): number {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

function buildSkuId(retailer: Retailer, category: Category, index: number): string {
  const prefix = retailer.substring(0, 3).toUpperCase();
  const cat = category.substring(0, 4).toUpperCase();
  return `${prefix}-${cat}-${String(index).padStart(6, '0')}`;
}

function buildTitle(retailer: Retailer, category: Category, index: number): string {
  const prefixes = STYLE_PREFIXES[retailer];
  const prefix = prefixes[index % prefixes.length];
  const suffix = (seededRandom(index * 7) * 1000).toFixed(0);
  const categoryLabel: Record<Category, string> = {
    sofa: 'Sofa',
    coffee_table: 'Coffee Table',
    accent_chair: 'Accent Chair',
    rug: 'Area Rug',
    floor_lamp: 'Floor Lamp',
    storage_credenza: 'Sideboard & Credenza',
    dining_table: 'Dining Table',
    wall_art: 'Wall Art Print',
  };
  return `${prefix} ${categoryLabel[category]} - Model ${suffix}`;
}

function buildUrls(
  retailer: Retailer,
  category: Category,
  skuId: string,
): { canonicalUrl: string; affiliateUrl: string; primaryImageUrl: string } {
  const domain = RETAILER_DOMAINS[retailer];
  const affDomain = AFFILIATE_DOMAINS[retailer];
  const slug = skuId.toLowerCase().replace(/-/g, '/');

  return {
    canonicalUrl: `https://${domain}/p/${category}/${slug}`,
    affiliateUrl: `https://${affDomain}/${slug}?ref=roomcommerce`,
    primaryImageUrl: `https://cdn.roomcommerce.internal/catalog/${retailer.toLowerCase()}/${category}/${skuId}.jpg`,
  };
}

/**
 * Generate a slice of the catalog for a given retailer + category.
 * @param limit Optional limit — useful for test seeding (default: full count per distribution matrix)
 */
export function generateCatalogSlice(
  retailer: Retailer,
  category: Category,
  limit?: number,
): CatalogIngestDto[] {
  const spec = DISTRIBUTION[retailer][category];
  const count = limit !== undefined ? Math.min(limit, spec.count) : spec.count;
  const [minPrice, maxPrice] = CATEGORY_PRICE_RANGES[category];
  const dims = CATEGORY_DIMENSIONS[category];
  const records: CatalogIngestDto[] = [];

  for (let i = 0; i < count; i++) {
    const seed = retailer.charCodeAt(0) * 1000 + category.charCodeAt(0) * 100 + i;
    const skuId = buildSkuId(retailer, category, i);
    const urls = buildUrls(retailer, category, skuId);

    records.push({
      sku: skuId,
      retailerId: retailer,
      title: buildTitle(retailer, category, i),
      category,
      priceCents: randInRange(minPrice, maxPrice, seed),
      currency: 'USD',
      widthCm: randInRange(dims.w[0], dims.w[1], seed + 1),
      depthCm: randInRange(dims.d[0], dims.d[1], seed + 2),
      heightCm: randInRange(dims.h[0], dims.h[1], seed + 3),
      canonicalUrl: urls.canonicalUrl,
      affiliateUrl: urls.affiliateUrl,
      primaryImageUrl: urls.primaryImageUrl,
      inStock: seededRandom(seed + 4) > 0.05, // 95% in-stock rate
    });
  }

  return records;
}

/**
 * Generate the full 50,000-SKU catalog across all retailers and categories.
 * Memory note: ~50K records ≈ 25MB in-process — stream in batches for production.
 */
export function generateFullCatalog(limitPerSlice?: number): CatalogIngestDto[] {
  const retailers = Object.keys(DISTRIBUTION) as Retailer[];
  const categories = Object.keys(CATEGORY_PRICE_RANGES) as Category[];
  const records: CatalogIngestDto[] = [];

  for (const retailer of retailers) {
    for (const category of categories) {
      if (DISTRIBUTION[retailer][category].count > 0) {
        records.push(...generateCatalogSlice(retailer, category, limitPerSlice));
      }
    }
  }

  return records;
}
