/**
 * adapters/wayfair.adapter.ts
 *
 * Wayfair Supplier API (CastleGate / Storefront feed) stock + price adapter.
 * Satisfies: IStockCheckerAdapter contract (Plan 04)
 *
 * Requirements:
 *   env.WAYFAIR_API_CLIENT_ID     — OAuth2 client ID
 *   env.WAYFAIR_API_CLIENT_SECRET — OAuth2 client secret
 *   env.WAYFAIR_SUPPLIER_ID       — Your Wayfair supplier ID
 *
 * Authentication: Wayfair uses OAuth 2.0 client_credentials grant.
 * The token is cached per instance (TTL = expires_in from the response).
 */
import { Injectable, Logger } from '@nestjs/common';
import type { IStockCheckerAdapter, StockCheckResult } from '../stock-checker.interface.js';

const TOKEN_URL = 'https://api.wayfair.com/v1/auth/access-token';
const INVENTORY_URL = 'https://api.wayfair.com/v1/supplier/{supplierId}/products/{sku}/inventory';
const TIMEOUT_MS = 5_000;

interface CachedToken {
  token: string;
  expiresAt: number; // unix epoch ms
}

@Injectable()
export class WayfairStockAdapter implements IStockCheckerAdapter {
  private readonly logger = new Logger(WayfairStockAdapter.name);

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly supplierId: string;
  private tokenCache: CachedToken | null = null;

  constructor() {
    this.clientId = process.env['WAYFAIR_API_CLIENT_ID'] ?? '';
    this.clientSecret = process.env['WAYFAIR_API_CLIENT_SECRET'] ?? '';
    this.supplierId = process.env['WAYFAIR_SUPPLIER_ID'] ?? '';
  }

  async checkStock(_retailerId: string, sku: string): Promise<StockCheckResult> {
    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(`[WayfairAdapter] API credentials not configured — assuming in-stock for SKU ${sku}`);
      return { inStock: true };
    }

    try {
      const token = await this.getAccessToken();
      const url = INVENTORY_URL
        .replace('{supplierId}', encodeURIComponent(this.supplierId))
        .replace('{sku}', encodeURIComponent(sku));

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (response.status === 404) {
        // Product discontinued or unlisted
        return { inStock: false };
      }

      if (!response.ok) {
        this.logger.warn(`[WayfairAdapter] HTTP ${response.status} for SKU ${sku}`);
        return { inStock: true }; // fail-open
      }

      const data: any = await response.json();

      // Wayfair inventory response: { quantityOnHand, price, ... }
      const qty: number = data?.quantityOnHand ?? data?.quantity ?? -1;
      const inStock = qty !== 0;
      const updatedPriceCents = data?.price
        ? Math.round(parseFloat(data.price) * 100)
        : undefined;

      return { inStock, updatedPriceCents };
    } catch (err: any) {
      this.logger.error(`[WayfairAdapter] Request failed for SKU ${sku}: ${err.message}`);
      return { inStock: true }; // fail-open
    }
  }

  // ---------------------------------------------------------------------------
  // OAuth 2.0 client_credentials token with in-memory cache
  // ---------------------------------------------------------------------------

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 30_000) {
      return this.tokenCache.token;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Wayfair OAuth failed: HTTP ${response.status}`);
    }

    const data: any = await response.json();
    this.tokenCache = {
      token: data.access_token,
      expiresAt: now + (data.expires_in ?? 3600) * 1000,
    };

    return this.tokenCache.token;
  }
}
