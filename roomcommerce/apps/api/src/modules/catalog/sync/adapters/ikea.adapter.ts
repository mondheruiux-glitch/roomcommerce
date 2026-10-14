/**
 * adapters/ikea.adapter.ts
 *
 * IKEA Ingka Availability API / CJ Affiliate stock + price adapter.
 * Satisfies: IStockCheckerAdapter contract (Plan 04 / TASK-008)
 *
 * Requirements:
 *   env.CJ_AFFILIATE_TOKEN  — CJ Affiliate publisher token
 *   env.IKEA_API_KEY        — IKEA Ingka API key (from IKEA for Business / Ingka Group API)
 *
 * Fail-open policy:
 *   Missing / empty / mock_ credentials   → { inStock: true }
 *   Network timeout or 5xx upstream error → { inStock: true }
 *   This prevents catastrophic mass de-indexing during transient outages.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { IStockCheckerAdapter, StockCheckResult } from '../stock-checker.interface.js';

/**
 * IKEA Ingka Group Availability API endpoint.
 * Docs: https://api.ingka.ikea.com/product/availability/{countryCode}/{languageCode}/{itemNo}
 */
const INGKA_AVAILABILITY_BASE = 'https://api.ingka.ikea.com/product/availability';
const INGKA_COUNTRY = 'us';
const INGKA_LANGUAGE = 'en';
const TIMEOUT_MS = 4_000;

/** True when the credential value is absent or is a placeholder */
function isMockOrMissing(value: string): boolean {
  return !value || value.startsWith('mock_');
}

@Injectable()
export class IkeaStockAdapter implements IStockCheckerAdapter {
  private readonly logger = new Logger(IkeaStockAdapter.name);

  private readonly cjToken: string;
  private readonly ikeaApiKey: string;

  constructor() {
    this.cjToken = process.env['CJ_AFFILIATE_TOKEN'] ?? '';
    this.ikeaApiKey = process.env['IKEA_API_KEY'] ?? '';
  }

  async checkStock(_retailerId: string, sku: string): Promise<StockCheckResult> {
    // ── Fail-open for dev / test environments ──────────────────────────────
    if (isMockOrMissing(this.cjToken) || isMockOrMissing(this.ikeaApiKey)) {
      this.logger.warn(
        `[IkeaAdapter] Credentials not configured or are mock values — ` +
          `assuming in-stock for SKU ${sku}`,
      );
      return { inStock: true };
    }

    try {
      // IKEA item numbers are numeric; strip any prefix for the API call
      const itemNo = sku.replace(/^IKEA-/i, '');
      const url = `${INGKA_AVAILABILITY_BASE}/${INGKA_COUNTRY}/${INGKA_LANGUAGE}/${encodeURIComponent(itemNo)}`;

      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'X-Client-Id': this.ikeaApiKey,
          Authorization: `Bearer ${this.cjToken}`,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (response.status >= 500) {
        this.logger.warn(
          `[IkeaAdapter] Upstream 5xx HTTP ${response.status} for SKU ${sku} — failing open`,
        );
        return { inStock: true };
      }

      if (response.status === 404) {
        // Product not found in IKEA catalog — treat as discontinued
        return { inStock: false };
      }

      if (!response.ok) {
        this.logger.warn(
          `[IkeaAdapter] Unexpected HTTP ${response.status} for SKU ${sku} — failing open`,
        );
        return { inStock: true };
      }

      const data: any = await response.json();

      // Ingka availability response: { availabilities: [{ buyingOption: { cashCarry: { availability: { type } } } }] }
      const availability = data?.availabilities?.[0];
      const availabilityType: string | undefined =
        availability?.buyingOption?.cashCarry?.availability?.type ??
        availability?.buyingOption?.homeDelivery?.availability?.type;

      // IKEA availability types: AVAILABLE, LOW_IN_STOCK, OUT_OF_STOCK
      const inStock =
        !availabilityType ||
        availabilityType.toUpperCase() === 'AVAILABLE' ||
        availabilityType.toUpperCase() === 'LOW_IN_STOCK';

      // IKEA pricing: data.prices?.[0]?.regularPrice?.wholeSellingPriceExclTax in local currency
      const priceRaw: number | undefined = data?.prices?.[0]?.regularPrice?.wholeSellingPriceExclTax;
      const updatedPriceCents = priceRaw !== undefined ? Math.round(priceRaw * 100) : undefined;

      return { inStock, updatedPriceCents };
    } catch (err: any) {
      this.logger.error(
        `[IkeaAdapter] Request failed for SKU ${sku}: ${err?.message ?? String(err)} — failing open`,
      );
      return { inStock: true };
    }
  }
}
