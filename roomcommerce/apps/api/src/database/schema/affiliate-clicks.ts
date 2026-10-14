import {
  pgTable,
  uuid,
  varchar,
  timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { projects } from './projects.js';
import { canvasHotspots } from './canvas-hotspots.js';
import { catalogSkus } from './catalog-skus.js';

export const affiliateClickEvents = pgTable('affiliate_click_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Nullable: anonymous users have no account
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  hotspotId: uuid('hotspot_id')
    .notNull()
    .references(() => canvasHotspots.id),
  skuId: uuid('sku_id')
    .notNull()
    .references(() => catalogSkus.id),
  retailerId: varchar('retailer_id', { length: 32 }).notNull(),
  // Unique click ID for affiliate deduplication and commission attribution
  clickId: uuid('click_id').defaultRandom().notNull(),
  userAgent: varchar('user_agent', { length: 512 }),
  // SHA-256 hashed IP for GDPR compliance (SEC-01, PRV-01) — never raw IP
  ipHash: varchar('ip_hash', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AffiliateClickEvent = typeof affiliateClickEvents.$inferSelect;
export type NewAffiliateClickEvent = typeof affiliateClickEvents.$inferInsert;
