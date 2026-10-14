# Plan Document: 02_CATALOG_AND_VECTOR_PLAN.md
# Scope: Relational Schema (PostgreSQL 16), Vector Search (Qdrant), 50K SKU Catalog ETL & Inventory Sync Engine
# Traceable PRD Requirements: FR-303, FR-304, NFR-03, NFR-07, NFR-08, BR-02, RSK-01, SEC-01

---

## 1. Objective & Scope Boundaries

### 1.1 Objective
Design, scaffold, and implement the complete data infrastructure for Project RoomCommerce. This encompasses:
1. The **relational persistence layer** in PostgreSQL 16 (AWS Aurora) managed via Drizzle ORM, storing user accounts, episodic passes, room projects, catalog metadata, canvas hotspots, and affiliate telemetry.
2. The **high-performance vector search engine** in managed Qdrant Cloud (`retail_catalog_v1`), indexing 768-dimensional SigLIP-SO400M multimodal embeddings with HNSW indexing and payload pre-filtering.
3. The **50,000 SKU Catalog ETL Ingestion Pipeline** aggregating inventory across IKEA, Target, Wayfair, and Amazon US.
4. The **Automated Inventory Synchronizer & Broken Link Validator** enforcing the non-negotiable **0% Out-of-Stock Hotspot Guarantee** (BR-02, NFR-07, NFR-08) through automated daily feed synchronization and instant vector payload de-indexing.

### 1.2 In-Scope
* Drizzle ORM schema definitions, relations, and migration scripts in `apps/api/src/database/schema/`.
* PostgreSQL connection pooling, health checks, and seed scripts.
* Qdrant collection initialization client and indexing scripts (`apps/api/src/modules/catalog/vector/`).
* Multimodal embedding ingestion pipeline: Batch ingestion script extracting 768-dim SigLIP embeddings from catalog product imagery and upserting into Qdrant.
* 50K SKU starter catalog dataset generator/loader mapping to the 8 core furniture categories (`sofa`, `coffee_table`, `accent_chair`, `rug`, `floor_lamp`, `wall_art`, `dining_table`, `storage_credenza`).
* Automated Daily Catalog Sync Cron Worker (`catalog-sync.service.ts`) checking stock flags, updated pricing, and URL availability.
* Real-time SKU candidate retrieval service returning Top-3 matches with pre-filtering on `category`, `in_stock == true`, and `price_cents <= remaining_budget_cents`.
* Dynamic out-of-stock fallback resolver (RSK-01) substituting the secondary candidate if a primary SKU is detected unavailable at view time.

### 1.3 Explicit Exclusions (Deferred to Subsequent Plans)
* Building the Python GPU worker pipeline for real-time room image crop segmentation (deferred to `03_ML_WORKER_PIPELINE_PLAN.md`).
* Building NestJS HTTP controllers and Stripe webhook handlers (deferred to `04_CORE_BACKEND_API_PLAN.md`).
* Front-facing UI components and interactive canvas (deferred to `05_DESIGN_SYSTEM_AND_UI_PLAN.md` and `06_STUDIO_FRONTEND_CLIENT_PLAN.md`).

---

## 2. Prerequisites & Dependency Matrix

### 2.1 Preceding Milestones
* `00_MASTER_EXECUTION_INDEX.md` approved.
* `01_MONOREPO_FOUNDATION_PLAN.md` approved; `@roomcommerce/contracts` package ready with Zod schemas and TypeScript types.

### 2.2 System & Tooling Dependencies
* **PostgreSQL:** `16.x` (Local Docker container for dev, AWS Aurora Serverless v2 for staging/prod).
* **Qdrant:** `1.11.x+` (Local Docker container at `http://localhost:6333` for dev, Managed Qdrant Cloud for staging/prod).
* **Node.js / pnpm:** Node 22 LTS, `drizzle-orm@^0.36.0`, `drizzle-kit@^0.28.0`, `@qdrant/js-client-rest@^1.11.0`, `pg@^8.13.0`.
* **Python (ETL Support):** Python 3.11 with `transformers`, `torch`, `Pillow`, `requests` for offline 50K batch SigLIP embedding generation.

### 2.3 Required Environment Variables
```env
# Relational Database (PostgreSQL 16)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/roomcommerce_dev?schema=public
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20

# Vector Database (Qdrant)
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=mock_qdrant_api_key
QDRANT_COLLECTION_NAME=retail_catalog_v1

# Catalog Feed / Affiliate Credentials
AMAZON_PA_API_KEY=mock_amazon_key
AMAZON_PA_SECRET_KEY=mock_amazon_secret
IMPACT_RADIUS_API_TOKEN=mock_impact_token
CJ_AFFILIATE_TOKEN=mock_cj_token
```

---

## 3. Step-by-Step Implementation Sequence

### Step 2.1: Relational Schema & Migration Pipeline (PostgreSQL 16 / Drizzle ORM)
Implement strict relational tables in `apps/api/src/database/schema/` mapping directly to the data dictionary approved in Technical Architecture §3.1.

* **Target Files:**
  * `apps/api/drizzle.config.ts`
  * `apps/api/src/database/index.ts` (Connection pool & drizzle instance)
  * `apps/api/src/database/schema/enums.ts` (Postgres ENUM types)
  * `apps/api/src/database/schema/users.ts` (`users` table)
  * `apps/api/src/database/schema/move-passes.ts` (`move_passes` table with generated column)
  * `apps/api/src/database/schema/projects.ts` (`projects` table with 7-day purge column)
  * `apps/api/src/database/schema/catalog-skus.ts` (`catalog_skus` table with unique constraint)
  * `apps/api/src/database/schema/canvas-hotspots.ts` (`canvas_hotspots` table)
  * `apps/api/src/database/schema/affiliate-clicks.ts` (`affiliate_click_events` table)
  * `apps/api/src/database/schema/index.ts` (Schema barrel export)

* **Concrete Schema Definitions:**

```typescript
// apps/api/src/database/schema/enums.ts
import { pgEnum } from 'drizzle-orm/pg-core';

export const stylePresetEnum = pgEnum('style_preset_enum', [
  'JAPANDI',
  'MID_CENTURY_MODERN',
  'SCANDINAVIAN',
  'INDUSTRIAL',
  'MINIMALIST',
  'CONTEMPORARY',
  'BOHEMIAN',
  'MODERN_FARMHOUSE',
]);

export const roomFunctionEnum = pgEnum('room_function_enum', [
  'LIVING_ROOM',
  'BEDROOM',
  'HOME_OFFICE',
  'DINING_ROOM',
  'PATIO',
]);

export const retailerIdEnum = pgEnum('retailer_id_enum', [
  'IKEA',
  'TARGET',
  'WAYFAIR',
  'AMAZON',
]);
```

```typescript
// apps/api/src/database/schema/catalog-skus.ts
import { pgTable, uuid, varchar, integer, numeric, boolean, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const catalogSkus = pgTable('catalog_skus', {
  id: uuid('id').defaultRandom().primaryKey(),
  sku: varchar('sku', { length: 128 }).notNull(),
  retailerId: varchar('retailer_id', { length: 32 }).notNull(), // 'IKEA', 'TARGET', 'WAYFAIR', 'AMAZON'
  title: varchar('title', { length: 512 }).notNull(),
  category: varchar('category', { length: 64 }).notNull(),
  priceCents: integer('price_cents').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  widthCm: numeric('width_cm', { precision: 6, scale: 2 }),
  depthCm: numeric('depth_cm', { precision: 6, scale: 2 }),
  heightCm: numeric('height_cm', { precision: 6, scale: 2 }),
  canonicalUrl: varchar('canonical_url', { length: 2048 }).notNull(),
  affiliateUrl: varchar('affiliate_url', { length: 2048 }).notNull(),
  primaryImageUrl: varchar('primary_image_url', { length: 2048 }).notNull(),
  inStock: boolean('in_stock').notNull().default(true),
  lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('uq_retailer_sku').on(table.retailerId, table.sku),
  index('idx_catalog_retrieval').on(table.category, table.inStock, table.priceCents),
]);
```

```typescript
// apps/api/src/database/schema/projects.ts
import { pgTable, uuid, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { stylePresetEnum, roomFunctionEnum } from './enums';

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  guestSessionId: varchar('guest_session_id', { length: 128 }),
  stylePreset: stylePresetEnum('style_preset').notNull(),
  roomFunction: roomFunctionEnum('room_function').notNull().default('LIVING_ROOM'),
  budgetCeilingCents: integer('budget_ceiling_cents').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  rawImageUrl: varchar('raw_image_url', { length: 2048 }).notNull(),
  depthMapUrl: varchar('depth_map_url', { length: 2048 }),
  renderedImageUrl: varchar('rendered_image_url', { length: 2048 }),
  purgeScheduledAt: timestamp('purge_scheduled_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW() + INTERVAL '7 days'`), // SEC-01 Ephemeral Storage
  status: varchar('status', { length: 32 }).notNull().default('PENDING'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('idx_projects_user').on(table.userId),
  index('idx_projects_purge').on(table.purgeScheduledAt),
]);
```

```typescript
// apps/api/src/database/schema/move-passes.ts
import { pgTable, uuid, varchar, integer, smallint, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const movePasses = pgTable('move_passes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  stripeSessionId: varchar('stripe_session_id', { length: 255 }).unique().notNull(),
  amountCents: integer('amount_cents').notNull().default(1499),
  currency: varchar('currency', { length: 3 }).notNull().default('USD'),
  activatedAt: timestamp('activated_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true })
    .notNull()
    .default(sql`NOW() + INTERVAL '30 days'`),
  generationsExecuted: smallint('generations_executed').notNull().default(0),
  isActive: boolean('is_active')
    .generatedAlwaysAs(sql`NOW() < expires_at AND generations_executed < 60`), // BR-01 Fair Use Cap
}, (table) => [
  index('idx_move_passes_user').on(table.userId),
]);
```

---

### Step 2.2: Managed Vector Database Initialization (Qdrant)
Establish the `retail_catalog_v1` collection in Qdrant with precise HNSW parameterization and indexed payload keys.

* **Target Files:**
  * `apps/api/src/modules/catalog/vector/qdrant.client.ts`
  * `apps/api/src/modules/catalog/vector/qdrant-init.service.ts`

* **Concrete Qdrant Vector Configuration:**
```typescript
// apps/api/src/modules/catalog/vector/qdrant-init.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from '../../../config/env';

@Injectable()
export class QdrantInitService implements OnModuleInit {
  private readonly logger = new Logger(QdrantInitService.name);
  private readonly client = new QdrantClient({
    url: env.QDRANT_URL,
    apiKey: env.QDRANT_API_KEY,
  });

  public static readonly COLLECTION_NAME = 'retail_catalog_v1';
  public static readonly VECTOR_SIZE = 768; // SigLIP-SO400M

  async onModuleInit() {
    await this.ensureCollectionExists();
  }

  async ensureCollectionExists() {
    const collections = await this.client.getCollections();
    const exists = collections.collections.some((c) => c.name === QdrantInitService.COLLECTION_NAME);

    if (!exists) {
      this.logger.log(`Creating Qdrant collection: ${QdrantInitService.COLLECTION_NAME}`);
      await this.client.createCollection(QdrantInitService.COLLECTION_NAME, {
        vectors: {
          size: QdrantInitService.VECTOR_SIZE,
          distance: 'Cosine',
        },
        hnsw_config: {
          m: 16,
          ef_construct: 128, // Optimized for <= 50ms retrieval latency (NFR-03)
          full_scan_threshold: 10000,
        },
        optimizers_config: {
          default_segment_number: 4,
          indexing_threshold: 20000,
        },
      });

      // Create payload indexes for strict sub-second pre-filtering
      await this.createPayloadIndexes();
      this.logger.log(`Qdrant collection and payload indexes initialized successfully.`);
    }
  }

  private async createPayloadIndexes() {
    const payloadFields: Array<{ field_name: string; field_schema: 'keyword' | 'integer' | 'bool' }> = [
      { field_name: 'sku_id', field_schema: 'keyword' },
      { field_name: 'retailer_id', field_schema: 'keyword' },
      { field_name: 'category', field_schema: 'keyword' },
      { field_name: 'price_cents', field_schema: 'integer' },
      { field_name: 'in_stock', field_schema: 'bool' },
      { field_name: 'last_sync_timestamp', field_schema: 'integer' },
    ];

    for (const field of payloadFields) {
      await this.client.createPayloadIndex(QdrantInitService.COLLECTION_NAME, {
        field_name: field.field_name,
        field_schema: field.field_schema,
      });
    }
  }
}
```

---

### Step 2.3: 50,000 SKU Catalog Data Model & Seed Pipeline
Construct a realistic, deduplicated 50K SKU seed dataset partitioned across the 4 approved merchants and 8 core furniture categories.

* **Target Files:**
  * `apps/api/src/modules/catalog/seed/catalog-seed.data.ts`
  * `apps/api/src/modules/catalog/seed/seed-runner.ts`
  * `apps/api/src/modules/catalog/dto/catalog-ingest.dto.ts`

* **Catalog Distribution Matrix (50,000 SKUs):**
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              50,000 SKU CATALOG DISTRIBUTION                           │
├─────────────────────┬──────────────┬──────────────┬──────────────┬─────────────────────┤
│ Category            │ Target (30%) │ IKEA (25%)   │ Wayfair (25%)│ Amazon (20%)        │
├─────────────────────┼──────────────┼──────────────┼──────────────┼─────────────────────┤
│ Sofa & Couches      │ 2,500        │ 2,000        │ 2,500        │ 1,500  (8,500 Total)│
│ Coffee Tables       │ 2,000        │ 1,800        │ 2,000        │ 1,500  (7,300 Total)│
│ Accent Chairs       │ 2,200        │ 1,800        │ 2,000        │ 1,500  (7,500 Total)│
│ Area Rugs           │ 2,500        │ 2,000        │ 2,200        │ 1,800  (8,500 Total)│
│ Lighting & Lamps    │ 1,800        │ 1,600        │ 1,500        │ 1,400  (6,300 Total)│
│ Storage & Credenzas │ 1,500        │ 1,300        │ 1,200        │ 1,000  (5,000 Total)│
│ Dining Tables       │ 1,300        │ 1,000        │ 1,100        │ 800    (4,200 Total)│
│ Wall Art & Mirrors  │ 1,200        │ 1,000        │ 0            │ 500    (2,700 Total)│
├─────────────────────┼──────────────┼──────────────┼──────────────┼─────────────────────┤
│ Total Per Merchant  │ 15,000 SKUs  │ 12,500 SKUs  │ 12,500 SKUs  │ 10,000 SKUs         │
└─────────────────────┴──────────────┴──────────────┴──────────────┴─────────────────────┘
```

* **Batch Ingestion Flow:**
  1. Load SKU metadata into PostgreSQL `catalog_skus` with idempotent `ON CONFLICT (retailer_id, sku) DO UPDATE`.
  2. Emit SKU batches (chunk size: 100) to SigLIP embedding extractor.
  3. Batch upsert 768-dim vectors + payloads into Qdrant collection `retail_catalog_v1`.

---

### Step 2.4: Offline SigLIP-SO400M Embedding Extraction Worker
Implement the Python embedding worker that consumes raw catalog product images and produces 768-dimensional normalized vectors matching the query encoder.

* **Target Files:**
  * `apps/api/scripts/embed_catalog_skus.py`

* **Concrete Python Embedding Script:**
```python
"""
Offline Catalog Ingestion & SigLIP-SO400M Embedding Pipeline
File: apps/api/scripts/embed_catalog_skus.py
Dependencies: torch, transformers, qdrant-client, psycopg2-binary, Pillow, requests
"""
import os
import sys
import time
from typing import List, Dict, Any
import requests
from PIL import Image
import torch
from transformers import AutoProcessor, AutoModel
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct

MODEL_ID = "google/siglip-so400m-patch14-384"
COLLECTION_NAME = "retail_catalog_v1"
BATCH_SIZE = 64

device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
print(f"[*] Loading SigLIP encoder: {MODEL_ID} on {device}")
processor = AutoProcessor.from_pretrained(MODEL_ID)
model = AutoModel.from_pretrained(MODEL_ID).to(device).eval()

qdrant = QdrantClient(url=os.getenv("QDRANT_URL", "http://localhost:6333"))

def generate_image_embeddings(image_urls: List[str]) -> List[List[float]]:
    images = []
    valid_indices = []
    for idx, url in enumerate(image_urls):
        try:
            resp = requests.get(url, timeout=5, stream=True)
            if resp.status_code == 200:
                img = Image.open(resp.raw).convert("RGB")
                images.append(img)
                valid_indices.append(idx)
        except Exception as e:
            print(f"[!] Warning: Failed to fetch image {url}: {e}")

    if not images:
        return []

    inputs = processor(images=images, return_tensors="pt").to(device)
    with torch.no_grad():
        image_features = model.get_image_features(**inputs)
        # Normalize vectors for Cosine distance
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
    
    return image_features.cpu().numpy().tolist()
```

---

### Step 2.5: High-Performance Vector Query Service (`vector-retrieval.service.ts`)
Implement the core retrieval engine satisfying **FR-303**, **FR-304**, and **NFR-03** ($\le 80\text{ms}$ query latency with pre-filtering).

* **Target Files:**
  * `apps/api/src/modules/catalog/vector/vector-retrieval.service.ts`

* **Concrete Implementation with Hard Pre-Filters:**
```typescript
// apps/api/src/modules/catalog/vector/vector-retrieval.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from '../../../config/env';

export interface VectorQueryOptions {
  cropEmbedding: number[]; // 768-dim float vector
  category: string;
  maxPriceCents: number; // Enforces room budget guardrail (FR-304)
  limit?: number; // Top-K candidate pool (Default: 3)
}

export interface MatchedSkuCandidate {
  skuId: string;
  retailerId: string;
  category: string;
  priceCents: number;
  similarityScore: number;
}

@Injectable()
export class VectorRetrievalService {
  private readonly logger = new Logger(VectorRetrievalService.name);
  private readonly client = new QdrantClient({
    url: env.QDRANT_URL,
    apiKey: env.QDRANT_API_KEY,
  });

  async findMatchingSkus(options: VectorQueryOptions): Promise<MatchedSkuCandidate[]> {
    const startTime = performance.now();
    const { cropEmbedding, category, maxPriceCents, limit = 3 } = options;

    // Hard pre-filters guarantee:
    // 1. in_stock == true (BR-02 zero out-of-stock pins)
    // 2. category match
    // 3. price <= available budget ceiling (FR-304)
    const result = await this.client.search('retail_catalog_v1', {
      vector: cropEmbedding,
      filter: {
        must: [
          { key: 'in_stock', match: { value: true } },
          { key: 'category', match: { value: category } },
          { key: 'price_cents', range: { lte: maxPriceCents } },
        ],
      },
      limit,
      with_payload: true,
    });

    const elapsedMs = performance.now() - startTime;
    if (elapsedMs > 80) {
      this.logger.warn(`Vector search exceeded 80ms SLA: ${elapsedMs.toFixed(2)}ms`);
    }

    return result.map((hit) => ({
      skuId: String(hit.payload?.sku_id),
      retailerId: String(hit.payload?.retailer_id),
      category: String(hit.payload?.category),
      priceCents: Number(hit.payload?.price_cents),
      similarityScore: hit.score,
    }));
  }
}
```

---

### Step 2.6: Automated Inventory Sync & Dead Link Crawler (`catalog-sync.service.ts`)
Implement the background synchronization cron worker that fulfills **NFR-07** (24-hour stock refresh), **NFR-08** (broken link suppression), and **BR-02** (zero out-of-stock pins).

* **Target Files:**
  * `apps/api/src/modules/catalog/sync/catalog-sync.service.ts`
  * `apps/api/src/modules/catalog/sync/stock-checker.interface.ts`

* **Concrete Synchronization Logic:**
```typescript
// apps/api/src/modules/catalog/sync/catalog-sync.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { db } from '../../../database';
import { catalogSkus } from '../../../database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { QdrantClient } from '@qdrant/js-client-rest';
import { env } from '../../../config/env';

@Injectable()
export class CatalogSyncService {
  private readonly logger = new Logger(CatalogSyncService.name);
  private readonly qdrant = new QdrantClient({ url: env.QDRANT_URL, apiKey: env.QDRANT_API_KEY });

  // Executes every night at 02:00 UTC (NFR-07)
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async executeDailySync() {
    this.logger.log('Starting daily catalog inventory and link validation run...');
    const skus = await db.select().from(catalogSkus).where(eq(catalogSkus.inStock, true));

    let outOfStockCount = 0;
    let deadLinkCount = 0;

    for (const item of skus) {
      const isUrlValid = await this.validateUrlAvailability(item.canonicalUrl);
      if (!isUrlValid) {
        deadLinkCount++;
        await this.deindexSku(item.id, item.sku, 'DEAD_LINK_404');
        continue;
      }

      const stockStatus = await this.queryMerchantStock(item.retailerId, item.sku);
      if (!stockStatus.inStock) {
        outOfStockCount++;
        await this.deindexSku(item.id, item.sku, 'OUT_OF_STOCK');
      } else if (stockStatus.updatedPriceCents && stockStatus.updatedPriceCents !== item.priceCents) {
        await this.updatePrice(item.id, item.sku, stockStatus.updatedPriceCents);
      }
    }

    this.logger.log(`Sync complete. Deindexed ${outOfStockCount} OOS items and ${deadLinkCount} dead links.`);
  }

  private async validateUrlAvailability(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(4000) });
      return response.status < 400; // Returns false for 404, 410, 500
    } catch {
      return false;
    }
  }

  private async deindexSku(dbId: string, sku: string, reason: string) {
    this.logger.warn(`Deindexing SKU [${sku}]: Reason: ${reason}`);

    // 1. Mark in_stock = false in PostgreSQL
    await db.update(catalogSkus)
      .set({ inStock: false, lastVerifiedAt: new Date() })
      .where(eq(catalogSkus.id, dbId));

    // 2. Instantly update Qdrant payload so vector search excludes it (BR-02)
    await this.qdrant.setPayload('retail_catalog_v1', {
      payload: { in_stock: false },
      filter: {
        must: [{ key: 'sku_id', match: { value: sku } }],
      },
    });
  }

  private async updatePrice(dbId: string, sku: string, newPriceCents: number) {
    await db.update(catalogSkus)
      .set({ priceCents: newPriceCents, lastVerifiedAt: new Date() })
      .where(eq(catalogSkus.id, dbId));

    await this.qdrant.setPayload('retail_catalog_v1', {
      payload: { price_cents: newPriceCents },
      filter: {
        must: [{ key: 'sku_id', match: { value: sku } }],
      },
    });
  }

  private async queryMerchantStock(retailerId: string, sku: string): Promise<{ inStock: boolean; updatedPriceCents?: number }> {
    // Adapter integration for Impact, CJ, or Amazon PA-API
    return { inStock: true };
  }
}
```

---

### Step 2.7: Dynamic Out-of-Stock Fallback Resolver (RSK-01)
Implement the client/server optimistic check: When a user taps a hotspot (`SCR-08`), if the SKU went out-of-stock between generation time and click time, smoothly promote Candidate #2 from the candidate pool without breaking the hotspot pin.

* **Target Files:**
  * `apps/api/src/modules/catalog/availability/sku-availability.service.ts`

* **Edge Cases Handled:**
  * Primary SKU discontinued during active session: Candidate #2 seamlessly promoted; user notified via subtle badge ("Similar match substituted").
  * All 3 candidates out of stock: Graceful fallback to category baseline hero product within price ceiling.

---

## 4. Test & Verification Gate

### 4.1 Coverage Targets
* **Relational Schema & Drizzle Queries:** $\ge 90\%$ test coverage.
* **Vector Retrieval Service:** $100\%$ query coverage including edge-case budget boundaries.
* **Stock De-indexing Pipeline:** $100\%$ verification that deindexed items are never returned in search results.

### 4.2 Automated Verification Commands
```bash
# 1. Run Drizzle migration generation and schema integrity check
pnpm --filter @roomcommerce/api exec drizzle-kit generate
pnpm --filter @roomcommerce/api exec drizzle-kit migrate

# 2. Seed test PostgreSQL and Qdrant instances with 1,000 baseline SKUs
pnpm --filter @roomcommerce/api exec ts-node src/modules/catalog/seed/seed-runner.ts --limit 1000

# 3. Execute Vector Retrieval Benchmark & SLA latency test (asserting <= 80ms)
pnpm --filter @roomcommerce/api test src/modules/catalog/vector/vector-retrieval.service.spec.ts

# 4. Execute Out-of-Stock Zero-Leak Test (BR-02 compliance test)
pnpm --filter @roomcommerce/api test src/modules/catalog/sync/catalog-sync.service.spec.ts
```

### 4.3 Acceptance Criteria Checklist
* [ ] PostgreSQL 16 schema cleanly applies migrations with correct indexes (`idx_catalog_retrieval`, `idx_projects_purge`).
* [ ] Qdrant collection `retail_catalog_v1` initialized with 768 dimensions, Cosine metric, and payload indexes.
* [ ] 50,000 SKUs ingested with valid titles, categories, metric dimensions, and working affiliate URLs.
* [ ] Vector query with 768-dim mock vector completes in $\le 80\text{ms}$ (p95) under simulated load.
* [ ] Pre-filter test confirms **zero items with `in_stock == false`** or `price_cents > budget` are returned.
* [ ] De-indexing an item immediately excludes it from subsequent vector search queries within 100ms.

---

## 5. Potential Blockers & Rollback Protocols

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                BLOCKERS & RESOLUTION MATRIX                            │
├─────────────────────────┬────────────────────────────┬─────────────────────────────────┤
│ Failure Mode            │ Impact / Symptom           │ Mitigation & Resolution         │
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ Qdrant Cloud Connection │ Vector queries fail;       │ Enable local Qdrant container   │
│ Latency Spike (> 120ms) │ breaks 15s generation SLA  │ fallback; review AWS VPC peering│
│                         │                            │ or co-locate in same AWS region.│
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ Retailer API Rate Limit │ Daily sync fails; SKUs go  │ Add exponential backoff & jitter;│
│ During Bulk Sync Run    │ stale without updates      │ partition sync into 4 hourly     │
│                         │                            │ merchant batches (IKEA, Target).│
├─────────────────────────┼────────────────────────────┼─────────────────────────────────┤
│ PostgreSQL Cascade      │ Expired projects fail to   │ Verify ON DELETE CASCADE foreign │
│ Deletion Foreign Lock   │ purge after 7 days         │ key constraints on hotspots and  │
│                         │                            │ telemetry records.               │
└─────────────────────────┴────────────────────────────┴─────────────────────────────────┘
```

### Rollback Protocol
1. **Database Migration Failure:** Run `drizzle-kit drop` to revert to previous migration state.
2. **Qdrant Index Corruption:** Rebuild index using `QdrantInitService.ensureCollectionExists()` and re-stream vectors from PostgreSQL cold snapshot.
