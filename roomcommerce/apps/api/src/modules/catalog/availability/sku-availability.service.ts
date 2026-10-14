import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { db } from '../../../database/index.js';
import { catalogSkus } from '../../../database/schema/catalog-skus.js';
import type { MatchedSkuCandidate } from '../vector/vector-retrieval.service.js';

export interface AvailabilityCheckResult {
  /** The best available candidate after fallback resolution */
  candidate: MatchedSkuCandidate;
  /** True if the original primary candidate was substituted */
  wasSubstituted: boolean;
  /** Human-readable reason for substitution (shown as subtle UI badge) */
  substitutionReason?: string;
}

@Injectable()
export class SkuAvailabilityService {
  private readonly logger = new Logger(SkuAvailabilityService.name);

  /**
   * RSK-01: Dynamic out-of-stock fallback resolver.
   *
   * At hotspot tap time, confirms the primary candidate is still in-stock.
   * If not, transparently promotes Candidate #2 → #3 from the pre-computed
   * top-3 pool (returned by VectorRetrievalService with limit=3).
   *
   * Edge cases:
   * - All 3 candidates OOS → null (caller handles graceful empty state)
   * - Substitution shown to user as subtle "Similar match substituted" badge
   */
  async resolveAvailableCandidate(
    candidates: MatchedSkuCandidate[],
  ): Promise<AvailabilityCheckResult | null> {
    for (let i = 0; i < candidates.length; i++) {
      // biome-ignore lint: index is bounds-checked by loop condition
      const candidate = candidates[i]!;

      // Re-validate against PostgreSQL live stock status
      const [row] = await db
        .select({ inStock: catalogSkus.inStock })
        .from(catalogSkus)
        .where(eq(catalogSkus.id, candidate.skuId))
        .limit(1);

      if (!row) {
        this.logger.warn(`SKU ${candidate.skuId} not found in catalog — skipping.`);
        continue;
      }

      if (row.inStock) {
        return {
          candidate,
          wasSubstituted: i > 0,
          substitutionReason: i > 0 ? 'Similar match substituted' : undefined,
        };
      }

      this.logger.debug(
        `RSK-01: Candidate #${i + 1} (skuId=${candidate.skuId}) OOS — trying next.`,
      );
    }

    // All 3 candidates out of stock — caller shows graceful empty state
    this.logger.warn('RSK-01: All candidates exhausted — no available substitution.');
    return null;
  }
}
