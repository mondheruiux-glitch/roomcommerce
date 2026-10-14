import { Injectable, Logger } from '@nestjs/common';
import { createQdrantClient, QdrantClient } from './qdrant.client.js';
import { QdrantInitService } from './qdrant-init.service.js';

export interface VectorQueryOptions {
  /** 768-dim float vector from SigLIP-SO400M image encoder */
  cropEmbedding: number[];
  /** Furniture category slug — must match Qdrant payload `category` field */
  category: string;
  /** Maximum price in cents — enforces room budget guardrail (FR-304) */
  maxPriceCents: number;
  /** Top-K candidates returned. Default: 3 (primary + 2 fallbacks for RSK-01) */
  limit?: number;
}

export interface MatchedSkuCandidate {
  skuId: string;
  retailerId: string;
  category: string;
  priceCents: number;
  similarityScore: number;
}

const LATENCY_SLA_MS = 80; // NFR-03: warn if search exceeds 80ms

@Injectable()
export class VectorRetrievalService {
  private readonly logger = new Logger(VectorRetrievalService.name);
  private readonly client: QdrantClient = createQdrantClient();

  /**
   * Find top-K SKU candidates via HNSW cosine search with hard pre-filters.
   *
   * Hard filter invariants (MUST conditions):
   * 1. `in_stock == true`           — BR-02: zero out-of-stock pins guarantee
   * 2. `category == options.category` — match semantic crop category
   * 3. `price_cents <= maxPriceCents`  — FR-304: budget ceiling guardrail
   */
  async findMatchingSkus(options: VectorQueryOptions): Promise<MatchedSkuCandidate[]> {
    const { cropEmbedding, category, maxPriceCents, limit = 3 } = options;

    if (cropEmbedding.length !== QdrantInitService.VECTOR_SIZE) {
      throw new Error(
        `Invalid embedding dimension: got ${cropEmbedding.length}, expected ${QdrantInitService.VECTOR_SIZE}`,
      );
    }

    const startTime = performance.now();

    const results = await this.client.query(QdrantInitService.COLLECTION_NAME, {
      query: cropEmbedding,
      filter: {
        must: [
          // Guard 1: BR-02 — zero out-of-stock pins
          { key: 'in_stock', match: { value: true } },
          // Guard 2: semantic category match
          { key: 'category', match: { value: category } },
          // Guard 3: FR-304 budget ceiling — range filter (lte = less-than-or-equal)
          { key: 'price_cents', range: { lte: maxPriceCents } },
        ],
      },
      limit,
      with_payload: true,
    });

    const elapsedMs = performance.now() - startTime;
    if (elapsedMs > LATENCY_SLA_MS) {
      this.logger.warn(
        `[NFR-03] Vector search exceeded ${LATENCY_SLA_MS}ms SLA: ${elapsedMs.toFixed(2)}ms ` +
          `(category=${category}, maxPrice=${maxPriceCents})`,
      );
    }

    return results.points.map((hit) => {
      const p = hit.payload ?? {};
      return {
        skuId: String(p['sku_id'] ?? ''),
        retailerId: String(p['retailer_id'] ?? ''),
        category: String(p['category'] ?? ''),
        priceCents: Number(p['price_cents'] ?? 0),
        similarityScore: hit.score,
      };
    });
  }
}
