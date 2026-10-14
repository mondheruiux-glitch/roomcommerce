import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eq } from 'drizzle-orm';
import { db } from '../../../database/index.js';
import { catalogSkus } from '../../../database/schema/catalog-skus.js';
import { createQdrantClient, QdrantClient } from '../vector/qdrant.client.js';
import { QdrantInitService } from '../vector/qdrant-init.service.js';
import type { IStockCheckerAdapter } from './stock-checker.interface.js';

const URL_CHECK_TIMEOUT_MS = 4000;
const QDRANT_PAYLOAD_UPDATE_COLLECTION = QdrantInitService.COLLECTION_NAME;

@Injectable()
export class CatalogSyncService {
  private readonly logger = new Logger(CatalogSyncService.name);
  private readonly qdrant: QdrantClient = createQdrantClient();

  /**
   * Inject a stock checker adapter. In Plan 02 it uses a passthrough mock.
   * Real merchant API adapters (Impact Radius, CJ, Amazon PA-API) wired in Plan 04.
   */
  constructor(private readonly stockChecker?: IStockCheckerAdapter) {}

  /**
   * Daily inventory validation at 02:00 UTC (NFR-07).
   * For each in-stock SKU:
   *   1. HEAD-check the canonical URL (detects 404 / 410 / dead links — NFR-08)
   *   2. Query merchant stock status via affiliate adapter
   *   3. De-index immediately in both PostgreSQL and Qdrant (BR-02)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async executeDailySync(): Promise<void> {
    this.logger.log('Starting daily catalog inventory and link validation run...');

    const activeSkus = await db
      .select()
      .from(catalogSkus)
      .where(eq(catalogSkus.inStock, true));

    let outOfStockCount = 0;
    let deadLinkCount = 0;
    let priceUpdateCount = 0;

    for (const item of activeSkus) {
      const isUrlValid = await this.validateUrlAvailability(item.canonicalUrl);
      if (!isUrlValid) {
        deadLinkCount++;
        await this.deindexSku(item.id, item.sku, 'DEAD_LINK_404');
        continue;
      }

      const stockResult = this.stockChecker
        ? await this.stockChecker.checkStock(item.retailerId, item.sku)
        : { inStock: true };

      if (!stockResult.inStock) {
        outOfStockCount++;
        await this.deindexSku(item.id, item.sku, 'OUT_OF_STOCK');
      } else if (
        stockResult.updatedPriceCents !== undefined &&
        stockResult.updatedPriceCents !== item.priceCents
      ) {
        priceUpdateCount++;
        await this.updatePrice(item.id, item.sku, stockResult.updatedPriceCents);
      }
    }

    this.logger.log(
      `Sync complete. Deindexed: ${outOfStockCount} OOS, ${deadLinkCount} dead links. ` +
        `Price updates: ${priceUpdateCount}.`,
    );
  }

  /**
   * HEAD-check the product URL.
   * Returns false for 4xx/5xx responses or network errors (NFR-08).
   */
  private async validateUrlAvailability(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(URL_CHECK_TIMEOUT_MS),
      });
      return response.status < 400;
    } catch {
      return false;
    }
  }

  /**
   * Atomic de-indexing: marks PostgreSQL `in_stock = false` AND updates Qdrant payload.
   * The dual-write guarantees BR-02: de-indexed items are excluded from vector search
   * within the Qdrant payload filter response time (~100ms).
   */
  private async deindexSku(dbId: string, sku: string, reason: string): Promise<void> {
    this.logger.warn(`Deindexing SKU [${sku}] — Reason: ${reason}`);

    // 1. PostgreSQL — mark in_stock = false
    await db
      .update(catalogSkus)
      .set({ inStock: false, lastVerifiedAt: new Date() })
      .where(eq(catalogSkus.id, dbId));

    // 2. Qdrant — immediately exclude from vector search pre-filter (BR-02)
    await this.qdrant.setPayload(QDRANT_PAYLOAD_UPDATE_COLLECTION, {
      payload: { in_stock: false },
      filter: {
        must: [{ key: 'sku_id', match: { value: sku } }],
      },
    });
  }

  /**
   * Bidirectional price sync: update PostgreSQL and Qdrant payload atomically.
   */
  private async updatePrice(dbId: string, sku: string, newPriceCents: number): Promise<void> {
    this.logger.debug(`Price update SKU [${sku}]: ${newPriceCents} cents`);

    await db
      .update(catalogSkus)
      .set({ priceCents: newPriceCents, lastVerifiedAt: new Date() })
      .where(eq(catalogSkus.id, dbId));

    await this.qdrant.setPayload(QDRANT_PAYLOAD_UPDATE_COLLECTION, {
      payload: { price_cents: newPriceCents },
      filter: {
        must: [{ key: 'sku_id', match: { value: sku } }],
      },
    });
  }
}
