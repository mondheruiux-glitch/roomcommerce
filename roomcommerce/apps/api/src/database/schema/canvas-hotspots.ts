import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
} from 'drizzle-orm/pg-core';
import { projects } from './projects.js';
import { catalogSkus } from './catalog-skus.js';

export const canvasHotspots = pgTable('canvas_hotspots', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  matchedSkuId: uuid('matched_sku_id')
    .notNull()
    .references(() => catalogSkus.id),
  category: varchar('category', { length: 64 }).notNull(),
  // Normalized [0,1] position within the rendered image canvas
  normX: numeric('norm_x', { precision: 5, scale: 4 }).notNull(),
  normY: numeric('norm_y', { precision: 5, scale: 4 }).notNull(),
  // SigLIP cosine similarity score [0,1]
  similarityScore: numeric('similarity_score', { precision: 5, scale: 4 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type CanvasHotspot = typeof canvasHotspots.$inferSelect;
export type NewCanvasHotspot = typeof canvasHotspots.$inferInsert;
