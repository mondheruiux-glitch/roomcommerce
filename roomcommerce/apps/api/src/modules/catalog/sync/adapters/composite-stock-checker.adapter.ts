/**
 * adapters/composite-stock-checker.adapter.ts
 *
 * Routes stock check calls to the correct per-retailer adapter.
 * Unknown retailer IDs fall through to a safe fail-open default (inStock=true).
 *
 * This is the single adapter wired into CatalogSyncService via DI.
 * Supported retailers: AMAZON, WAYFAIR, TARGET, IKEA
 */
import { Injectable } from '@nestjs/common';
import type { IStockCheckerAdapter, StockCheckResult } from '../stock-checker.interface.js';
import { AmazonStockAdapter } from './amazon.adapter.js';
import { WayfairStockAdapter } from './wayfair.adapter.js';
import { TargetStockAdapter } from './target.adapter.js';
import { IkeaStockAdapter } from './ikea.adapter.js';

@Injectable()
export class CompositeStockCheckerAdapter implements IStockCheckerAdapter {
  private readonly adapters: Record<string, IStockCheckerAdapter>;

  constructor(
    private readonly amazon: AmazonStockAdapter,
    private readonly wayfair: WayfairStockAdapter,
    private readonly target: TargetStockAdapter,
    private readonly ikea: IkeaStockAdapter,
  ) {
    this.adapters = {
      AMAZON: this.amazon,
      WAYFAIR: this.wayfair,
      TARGET: this.target,
      IKEA: this.ikea,
    };
  }

  async checkStock(retailerId: string, sku: string): Promise<StockCheckResult> {
    const adapter = this.adapters[retailerId.toUpperCase()];
    if (!adapter) {
      // Retailer not yet integrated — fail-open so we don't de-index valid SKUs
      return { inStock: true };
    }
    return adapter.checkStock(retailerId, sku);
  }
}
