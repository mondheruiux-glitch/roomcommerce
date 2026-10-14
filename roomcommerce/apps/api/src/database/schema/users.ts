import {
  pgTable,
  uuid,
  varchar,
  smallint,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  freeRendersUsed: smallint('free_renders_used').notNull().default(0),
  /** Denormalized flag updated atomically on pass activation (FR-501) */
  hasActivePass: boolean('has_active_pass').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
