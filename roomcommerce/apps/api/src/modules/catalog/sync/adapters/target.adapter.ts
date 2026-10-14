/**
 * adapters/target.adapter.ts
 *
 * Target RedSky / Impact Radius catalog stock + price adapter.
 * Satisfies: IStockCheckerAdapter contract (Plan 04 / TASK-008)
 *
 * Requirements:
 *   env.IMPACT_RADIUS_API_TOKEN  — Impact Radius publisher token
 *   env.TARGET_API_KEY           — Target API key (RedSky v3)
 *
 * Fail-open policy:
 *   Missing / empty / mock_ credentials   → { inStock: true }
 *   Network timeout or 5xx upstream error → { inStock: true }
 *   This prevents catastrophic mass de-indexing during transient outages.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { IStockCheckerAdapter, StockCheckResult } from '../stock-checker.interface.js';

/**
 * Target RedSky v3 product availability endpoint.
 * The `key` query parameter is the public RedSky API key.
 */
const REDSKY_BASE_URL = 'https://redsky.target.com/redsky_aggregations/v1/web/pdp_client_v1';
const TIMEOUT_MS = 4_000;

/** True when the credential value is absent or is a placeholder */
function isMockOrMissing(value: string): boolean {
  return !value || value.startsWith('mock_');
}

@Injectable()
export class TargetStockAdapter implements IStockCheckerAdapter {
  private readonly logger = new Logger(TargetStockAdapter.name);

  private readonly impactToken: string;
  private readonly targetApiKey: string;

  constructor() {
    this.impactToken = process.env['IMPACT_RADIUS_API_TOKEN'] ?? '';
    this.targetApiKey = process.env['TARGET_API_KEY'] ?? '';
  }

  async checkStock(_retailerId: string, sku: string): Promise<StockCheckResult> {
    // ── Fail-open for dev / test environments ──────────────────────────────
    if (isMockOrMissing(this.impactToken) || isMockOrMissing(this.targetApiKey)) {
      this.logger.warn(
        `[TargetAdapter] Credentials not configured or are mock values — ` +
          `assuming in-stock for SKU ${sku}`,
      );
      return { inStock: true };
    }

    try {
      const url = new URL(REDSKY_BASE_URL);
      url.searchParams.set('key', this.targetApiKey);
      url.searchParams.set('tcin', sku);
      url.searchParams.set('channel', 'WEB');
      url.searchParams.set('is_bot', 'false');

      const response = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.impactToken}`,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (response.status >= 500) {
        this.logger.warn(
          `[TargetAdapter] Upstream 5xx HTTP ${response.status} for SKU ${sku} — failing open`,
        );
        return { inStock: true };
      }

      if (response.status === 404) {
        // Product not found in RedSky — treat as discontinued
        return { inStock: false };
      }

      if (!response.ok) {
        this.logger.warn(
          `[TargetAdapter] Unexpected HTTP ${response.status} for SKU ${sku} — failing open`,
        );
        return { inStock: true };
      }

      const data: any = await response.json();

      // RedSky v3 response: data.product.item.enrichment.buy_url + fulfillment.product_fulfillment_type
      const availability: string | undefined =
        data?.data?.product?.fulfillment?.shipping_options?.availability_status ??
        data?.data?.product?.fulfillment?.store_options?.[0]?.availability?.availability_status;

      const inStock = !availability || availability.toUpperCase() !== 'OUT_OF_STOCK';

      // Price is nested under price.current_retail in cents
      const priceRaw: number | undefined = data?.data?.product?.price?.current_retail;
      const updatedPriceCents = priceRaw !== undefined ? Math.round(priceRaw * 100) : undefined;

      return { inStock, updatedPriceCents };
    } catch (err: any) {
      this.logger.error(
        `[TargetAdapter] Request failed for SKU ${sku}: ${err?.message ?? String(err)} — failing open`,
      );
      return { inStock: true };
    }
  }
}
