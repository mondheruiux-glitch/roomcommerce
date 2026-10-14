import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';
import { stylePresetEnum, roomFunctionEnum } from './enums.js';

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Nullable — anonymous users have no userId (SEC-01 ephemeral sessions)
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    guestSessionId: varchar('guest_session_id', { length: 128 }),
    stylePreset: stylePresetEnum('style_preset').notNull(),
    roomFunction: roomFunctionEnum('room_function').notNull().default('LIVING_ROOM'),
    budgetCeilingCents: integer('budget_ceiling_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    rawImageUrl: varchar('raw_image_url', { length: 2048 }).notNull(),
    depthMapUrl: varchar('depth_map_url', { length: 2048 }),
    renderedImageUrl: varchar('rendered_image_url', { length: 2048 }),
    status: varchar('status', { length: 32 }).notNull().default('PENDING'),
    // SEC-01 / PRV-01: Images and project data auto-purged after 7 days
    purgeScheduledAt: timestamp('purge_scheduled_at', { withTimezone: true })
      .notNull()
      .default(sql`NOW() + INTERVAL '7 days'`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_projects_user').on(table.userId),
    index('idx_projects_purge').on(table.purgeScheduledAt),
  ],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
