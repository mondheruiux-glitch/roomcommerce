import {
  pgTable,
  uuid,
  varchar,
  integer,
  smallint,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

export const movePasses = pgTable(
  'move_passes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    stripeSessionId: varchar('stripe_session_id', { length: 255 }).notNull().unique(),
    amountCents: integer('amount_cents').notNull().default(1499), // $14.99 (BR-01)
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    activatedAt: timestamp('activated_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull()
      .default(sql`NOW() + INTERVAL '30 days'`), // BR-01: 30-day window
    generationsExecuted: smallint('generations_executed').notNull().default(0),
    // Generated stored column: active when within 30-day window AND under 60 gen cap (BR-01)
    isActive: boolean('is_active').generatedAlwaysAs(
      sql`NOW() < expires_at AND generations_executed < 60`,
    ),
  },
  (table) => [index('idx_move_passes_user').on(table.userId)],
);

export type MovePass = typeof movePasses.$inferSelect;
export type NewMovePass = typeof movePasses.$inferInsert;
