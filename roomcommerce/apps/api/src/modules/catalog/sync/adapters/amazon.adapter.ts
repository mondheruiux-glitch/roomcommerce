/**
 * adapters/amazon.adapter.ts
 *
 * Amazon PA-API 5.0 stock + price adapter.
 * Satisfies: IStockCheckerAdapter contract (Plan 04)
 *
 * Requirements:
 *   env.AMAZON_PAAPI_ACCESS_KEY   — AWS Access Key ID with PA-API scope
 *   env.AMAZON_PAAPI_SECRET_KEY   — AWS Secret Access Key
 *   env.AMAZON_PAAPI_PARTNER_TAG  — Associates tag (e.g. "roomcommerce-20")
 *   env.AMAZON_PAAPI_HOST         — Regional host, e.g. "webservices.amazon.com"
 *   env.AMAZON_PAAPI_REGION       — AWS region, e.g. "us-east-1"
 */
import { Injectable, Logger } from '@nestjs/common';
import crypto from 'crypto';
import type { IStockCheckerAdapter, StockCheckResult } from '../stock-checker.interface.js';

const PAAPI_HOST_DEFAULT = 'webservices.amazon.com';
const PAAPI_REGION_DEFAULT = 'us-east-1';
const PAAPI_PATH = '/paapi5/getitems';
const PAAPI_SERVICE = 'ProductAdvertisingAPI';
const TIMEOUT_MS = 5_000;

@Injectable()
export class AmazonStockAdapter implements IStockCheckerAdapter {
  private readonly logger = new Logger(AmazonStockAdapter.name);

  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly partnerTag: string;
  private readonly host: string;
  private readonly region: string;

  constructor() {
    this.accessKey = process.env['AMAZON_PAAPI_ACCESS_KEY'] ?? '';
    this.secretKey = process.env['AMAZON_PAAPI_SECRET_KEY'] ?? '';
    this.partnerTag = process.env['AMAZON_PAAPI_PARTNER_TAG'] ?? 'roomcommerce-20';
    this.host = process.env['AMAZON_PAAPI_HOST'] ?? PAAPI_HOST_DEFAULT;
    this.region = process.env['AMAZON_PAAPI_REGION'] ?? PAAPI_REGION_DEFAULT;
  }

  async checkStock(_retailerId: string, sku: string): Promise<StockCheckResult> {
    if (!this.accessKey || !this.secretKey) {
      this.logger.warn(`[AmazonAdapter] PA-API credentials not configured — falling back to in-stock for SKU ${sku}`);
      return { inStock: true };
    }

    const payload = JSON.stringify({
      PartnerTag: this.partnerTag,
      PartnerType: 'Associates',
      ItemIds: [sku],
      Resources: ['Offers.Listings.Availability.Type', 'Offers.Listings.Price'],
    });

    const now = new Date();
    const amzDate = toAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);

    const headers = await this.signedHeaders(payload, amzDate, dateStamp);

    try {
      const response = await fetch(`https://${this.host}${PAAPI_PATH}`, {
        method: 'POST',
        headers,
        body: payload,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(`[AmazonAdapter] PA-API HTTP ${response.status} for SKU ${sku}`);
        return { inStock: true }; // fail-open: don't de-index on API errors
      }

      const data: any = await response.json();
      const item = data?.ItemsResult?.Items?.[0];
      const listing = item?.Offers?.Listings?.[0];

      if (!listing) {
        // Item not found in results → treat as out-of-stock
        return { inStock: false };
      }

      const availabilityType: string = listing?.Availability?.Type ?? 'Now';
      const inStock = availabilityType === 'Now';
      const priceCents = listing?.Price?.Amount
        ? Math.round(listing.Price.Amount * 100)
        : undefined;

      return { inStock, updatedPriceCents: priceCents };
    } catch (err: any) {
      this.logger.error(`[AmazonAdapter] Request failed for SKU ${sku}: ${err.message}`);
      return { inStock: true }; // fail-open
    }
  }

  // ---------------------------------------------------------------------------
  // AWS Signature Version 4 — HMAC-SHA256
  // ---------------------------------------------------------------------------

  private async signedHeaders(
    payload: string,
    amzDate: string,
    dateStamp: string,
  ): Promise<Record<string, string>> {
    const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');

    const canonicalHeaders =
      `content-type:application/json; charset=utf-8\n` +
      `host:${this.host}\n` +
      `x-amz-date:${amzDate}\n` +
      `x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems\n`;

    const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';

    const canonicalRequest = [
      'POST',
      PAAPI_PATH,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${this.region}/${PAAPI_SERVICE}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const signingKey = this.deriveSigningKey(dateStamp);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    return {
      'Content-Type': 'application/json; charset=utf-8',
      host: this.host,
      'x-amz-date': amzDate,
      'x-amz-target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems',
      Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
  }

  private deriveSigningKey(dateStamp: string): Buffer {
    const hmac = (key: string | Buffer, data: string) =>
      crypto.createHmac('sha256', key).update(data).digest();
    const kDate = hmac(`AWS4${this.secretKey}`, dateStamp);
    const kRegion = hmac(kDate, this.region);
    const kService = hmac(kRegion, PAAPI_SERVICE);
    return hmac(kService, 'aws4_request');
  }
}

function toAmzDate(d: Date): string {
  return d.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
}
