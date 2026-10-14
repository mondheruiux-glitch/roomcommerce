import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const catalogSkus = pgTable(
  'catalog_skus',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sku: varchar('sku', { length: 128 }).notNull(),
    retailerId: varchar('retailer_id', { length: 32 }).notNull(), // 'IKEA' | 'TARGET' | 'WAYFAIR' | 'AMAZON'
    title: varchar('title', { length: 512 }).notNull(),
    category: varchar('category', { length: 64 }).notNull(),
    priceCents: integer('price_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    // Physical dimensions for room-fit validation
    widthCm: numeric('width_cm', { precision: 6, scale: 2 }),
    depthCm: numeric('depth_cm', { precision: 6, scale: 2 }),
    heightCm: numeric('height_cm', { precision: 6, scale: 2 }),
    canonicalUrl: varchar('canonical_url', { length: 2048 }).notNull(),
    affiliateUrl: varchar('affiliate_url', { length: 2048 }).notNull(),
    primaryImageUrl: varchar('primary_image_url', { length: 2048 }).notNull(),
    inStock: boolean('in_stock').notNull().default(true),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Idempotent upsert key (retailer_id, sku) — enforces no duplicate SKUs per merchant
    uniqueIndex('uq_retailer_sku').on(table.retailerId, table.sku),
    // Composite index for vector pre-filter queries: category + in_stock + price (FR-303, FR-304)
    index('idx_catalog_retrieval').on(table.category, table.inStock, table.priceCents),
  ],
);

export type CatalogSku = typeof catalogSkus.$inferSelect;
export type NewCatalogSku = typeof catalogSkus.$inferInsert;
