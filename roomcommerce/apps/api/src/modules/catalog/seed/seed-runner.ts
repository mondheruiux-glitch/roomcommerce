/**
 * Catalog Seed Runner
 * Idempotent batch upsert of 50,000 synthetic SKUs into PostgreSQL catalog_skus.
 *
 * Usage:
 *   pnpm --filter @roomcommerce/api exec ts-node --esm src/modules/catalog/seed/seed-runner.ts
 *   pnpm --filter @roomcommerce/api exec ts-node --esm src/modules/catalog/seed/seed-runner.ts --limit 1000
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { catalogSkus } from '../../../database/schema/catalog-skus.js';
import { generateFullCatalog } from './catalog-seed.data.js';
import type { CatalogIngestDto } from '../dto/catalog-ingest.dto.js';

const BATCH_SIZE = 250;

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limitPerSlice = limitArg ? parseInt(limitArg.split('=')[1] ?? '0', 10) : undefined;

  console.log(`[seed] Generating catalog${limitPerSlice ? ` (${limitPerSlice} per slice)` : ' (full 50K)'}...`);
  const records = generateFullCatalog(limitPerSlice);
  console.log(`[seed] Total records to upsert: ${records.length.toLocaleString()}`);

  const pool = new Pool({
    connectionString:
      process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres_password@localhost:5432/roomcommerce',
  });
  const db = drizzle(pool);

  let upserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch: CatalogIngestDto[] = records.slice(i, i + BATCH_SIZE);

    await db
      .insert(catalogSkus)
      .values(
        batch.map((r) => ({
          sku: r.sku,
          retailerId: r.retailerId,
          title: r.title,
          category: r.category,
          priceCents: r.priceCents,
          currency: r.currency ?? 'USD',
          widthCm: r.widthCm?.toString(),
          depthCm: r.depthCm?.toString(),
          heightCm: r.heightCm?.toString(),
          canonicalUrl: r.canonicalUrl,
          affiliateUrl: r.affiliateUrl,
          primaryImageUrl: r.primaryImageUrl,
          inStock: r.inStock ?? true,
          lastVerifiedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [catalogSkus.retailerId, catalogSkus.sku],
        set: {
          title: sql`excluded.title`,
          priceCents: sql`excluded.price_cents`,
          inStock: sql`excluded.in_stock`,
          lastVerifiedAt: sql`excluded.last_verified_at`,
        },
      });

    upserted += batch.length;

    if (upserted % 5000 === 0 || upserted === records.length) {
      const pct = ((upserted / records.length) * 100).toFixed(1);
      console.log(`[seed] Progress: ${upserted.toLocaleString()} / ${records.length.toLocaleString()} (${pct}%)`);
    }
  }

  await pool.end();
  console.log(`[seed] ✅ Completed. ${upserted.toLocaleString()} SKUs upserted into catalog_skus.`);
}

main().catch((err) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
