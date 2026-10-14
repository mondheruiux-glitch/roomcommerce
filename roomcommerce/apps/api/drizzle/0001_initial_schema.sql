-- Migration: 0001_initial_schema.sql
-- Project RoomCommerce — Initial PostgreSQL Schema
-- Generated from Drizzle ORM schema definitions in apps/api/src/database/schema/
-- Applied by: apps/api/src/scripts/migrate.ts (one-shot ECS Fargate task)

--> statement-breakpoint

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "style_preset_enum" AS ENUM (
  'JAPANDI',
  'MID_CENTURY_MODERN',
  'SCANDINAVIAN',
  'INDUSTRIAL',
  'MINIMALIST',
  'CONTEMPORARY',
  'BOHEMIAN',
  'MODERN_FARMHOUSE'
);
--> statement-breakpoint

CREATE TYPE "room_function_enum" AS ENUM (
  'LIVING_ROOM',
  'BEDROOM',
  'HOME_OFFICE',
  'DINING_ROOM',
  'PATIO'
);
--> statement-breakpoint

CREATE TYPE "retailer_id_enum" AS ENUM (
  'IKEA',
  'TARGET',
  'WAYFAIR',
  'AMAZON'
);
--> statement-breakpoint

CREATE TYPE "job_status_enum" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'TIMED_OUT'
);
--> statement-breakpoint

-- ─── users ────────────────────────────────────────────────────────────────────
-- Core identity table — passwordless magic link auth (FR-101)

CREATE TABLE "users" (
  "id"                UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "email"             VARCHAR(255)  NOT NULL UNIQUE,
  "free_renders_used" SMALLINT      NOT NULL DEFAULT 0,
  "has_active_pass"   BOOLEAN       NOT NULL DEFAULT false,
  "created_at"        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

-- ─── catalog_skus ─────────────────────────────────────────────────────────────
-- 50K SKU catalog: IKEA, Target, Wayfair, Amazon (FR-303, BR-02)

CREATE TABLE "catalog_skus" (
  "id"                UUID             NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "sku"               VARCHAR(128)     NOT NULL,
  "retailer_id"       VARCHAR(32)      NOT NULL,
  "title"             VARCHAR(512)     NOT NULL,
  "category"          VARCHAR(64)      NOT NULL,
  "price_cents"       INTEGER          NOT NULL,
  "currency"          VARCHAR(3)       NOT NULL DEFAULT 'USD',
  "width_cm"          NUMERIC(6, 2),
  "depth_cm"          NUMERIC(6, 2),
  "height_cm"         NUMERIC(6, 2),
  "canonical_url"     VARCHAR(2048)    NOT NULL,
  "affiliate_url"     VARCHAR(2048)    NOT NULL,
  "primary_image_url" VARCHAR(2048)    NOT NULL,
  "in_stock"          BOOLEAN          NOT NULL DEFAULT true,
  "last_verified_at"  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  "created_at"        TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

-- Idempotent upsert key — one entry per (retailer, SKU) pair
CREATE UNIQUE INDEX "uq_retailer_sku"
  ON "catalog_skus" ("retailer_id", "sku");
--> statement-breakpoint

-- Composite pre-filter index for vector search (category + stock + price) (FR-303)
CREATE INDEX "idx_catalog_retrieval"
  ON "catalog_skus" ("category", "in_stock", "price_cents");
--> statement-breakpoint

-- ─── move_passes ──────────────────────────────────────────────────────────────
-- Stripe-backed Move-In Pass: $14.99 / 30-day / 60-generation cap (BR-01)

CREATE TABLE "move_passes" (
  "id"                    UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "user_id"               UUID         NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
  "stripe_session_id"     VARCHAR(255) NOT NULL UNIQUE,
  "amount_cents"          INTEGER      NOT NULL DEFAULT 1499,
  "currency"              VARCHAR(3)   NOT NULL DEFAULT 'USD',
  "activated_at"          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "expires_at"            TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  "generations_executed"  SMALLINT     NOT NULL DEFAULT 0,
  -- Generated always column: active when within 30-day window AND under 60-gen cap
  "is_active"             BOOLEAN GENERATED ALWAYS AS
                            (NOW() < "expires_at" AND "generations_executed" < 60) STORED
);
--> statement-breakpoint

CREATE INDEX "idx_move_passes_user"
  ON "move_passes" ("user_id");
--> statement-breakpoint

-- ─── projects ─────────────────────────────────────────────────────────────────
-- Generation jobs with 7-day auto-purge (SEC-01, PRV-01)

CREATE TABLE "projects" (
  "id"                    UUID                  NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Nullable: anonymous users can create projects without accounts
  "user_id"               UUID                  REFERENCES "users" ("id") ON DELETE CASCADE,
  "guest_session_id"      VARCHAR(128),
  "style_preset"          "style_preset_enum"   NOT NULL,
  "room_function"         "room_function_enum"  NOT NULL DEFAULT 'LIVING_ROOM',
  "budget_ceiling_cents"  INTEGER               NOT NULL,
  "currency"              VARCHAR(3)            NOT NULL DEFAULT 'USD',
  "raw_image_url"         VARCHAR(2048)         NOT NULL,
  "depth_map_url"         VARCHAR(2048),
  "rendered_image_url"    VARCHAR(2048),
  "status"                VARCHAR(32)           NOT NULL DEFAULT 'PENDING',
  -- PRV-01: Scheduled for purge 7 days after creation
  "purge_scheduled_at"    TIMESTAMPTZ           NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  "created_at"            TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

CREATE INDEX "idx_projects_user"
  ON "projects" ("user_id");
--> statement-breakpoint

-- Used by privacy cron to find expired projects efficiently
CREATE INDEX "idx_projects_purge"
  ON "projects" ("purge_scheduled_at");
--> statement-breakpoint

-- ─── canvas_hotspots ──────────────────────────────────────────────────────────
-- Detected furniture segments mapped to matched SKUs (FR-301, FR-302)

CREATE TABLE "canvas_hotspots" (
  "id"               UUID           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "project_id"       UUID           NOT NULL REFERENCES "projects" ("id") ON DELETE CASCADE,
  "matched_sku_id"   UUID           NOT NULL REFERENCES "catalog_skus" ("id"),
  "category"         VARCHAR(64)    NOT NULL,
  -- Normalized [0,1] position within rendered image canvas
  "norm_x"           NUMERIC(5, 4)  NOT NULL,
  "norm_y"           NUMERIC(5, 4)  NOT NULL,
  -- SigLIP-SO400M cosine similarity score [0,1] (FR-302)
  "similarity_score" NUMERIC(5, 4)  NOT NULL,
  "created_at"       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

-- ─── affiliate_click_events ───────────────────────────────────────────────────
-- EV-202: Affiliate outbound click tracking for QSOS North Star metric (EV-302)

CREATE TABLE "affiliate_click_events" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Nullable: anonymous users can click without an account
  "user_id"      UUID         REFERENCES "users" ("id") ON DELETE SET NULL,
  "project_id"   UUID         NOT NULL REFERENCES "projects" ("id") ON DELETE CASCADE,
  "hotspot_id"   UUID         NOT NULL REFERENCES "canvas_hotspots" ("id"),
  "sku_id"       UUID         NOT NULL REFERENCES "catalog_skus" ("id"),
  "retailer_id"  VARCHAR(32)  NOT NULL,
  -- Unique click ID for affiliate deduplication and commission attribution
  "click_id"     UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_agent"   VARCHAR(512),
  -- SHA-256 truncated IP hash for GDPR compliance (PRV-01) — never raw IP
  "ip_hash"      VARCHAR(64),
  "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
--> statement-breakpoint

-- ─── Drizzle internal migrations table ───────────────────────────────────────
-- Tracks applied migrations — managed by drizzle-orm/node-postgres/migrator

CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
  "id"         SERIAL PRIMARY KEY,
  "hash"       TEXT NOT NULL,
  "created_at" BIGINT
);
