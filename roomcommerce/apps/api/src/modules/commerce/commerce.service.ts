import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import crypto from 'crypto';
import { db } from '../../database/index.js';
import {
  canvasHotspots,
  catalogSkus,
  affiliateClickEvents,
} from '../../database/schema/index.js';
import { eq } from 'drizzle-orm';

@Injectable()
export class CommerceService {
  private readonly logger = new Logger(CommerceService.name);

  async processAffiliateClick(
    hotspotId: string,
    userId?: string,
    userAgent?: string,
    rawIp?: string,
  ): Promise<{ destinationUrl: string; clickId: string }> {
    // 1. Fetch hotspot with matched SKU
    const hotspot = await db.query.canvasHotspots.findFirst({
      where: eq(canvasHotspots.id, hotspotId),
    });

    if (!hotspot) {
      throw new NotFoundException({
        code: 'HOTSPOT_NOT_FOUND',
        message: `Hotspot with ID ${hotspotId} not found.`,
      });
    }

    const sku = await db.query.catalogSkus.findFirst({
      where: eq(catalogSkus.id, hotspot.matchedSkuId),
    });

    if (!sku) {
      throw new NotFoundException({
        code: 'SKU_NOT_FOUND',
        message: 'Catalog product associated with hotspot not found.',
      });
    }

    // 2. Hash IP with SHA-256 for GDPR compliance (SEC-01, PRV-01)
    const ipHash = rawIp
      ? crypto.createHash('sha256').update(rawIp).digest('hex')
      : null;

    // 3. Generate unique click tracking ID
    const clickId = crypto.randomUUID();

    // 4. Construct outbound affiliate URL with retailer-specific tracking tags (BR-03)
    const destinationUrl = this.buildAffiliateUrl(
      sku.affiliateUrl || sku.canonicalUrl,
      sku.retailerId,
      hotspotId,
      clickId,
    );

    // 5. Asynchronously log attribution event (EV-202 / TelemetryService integration point)
    try {
      await db.insert(affiliateClickEvents).values({
        userId: userId || null,
        projectId: hotspot.projectId,
        hotspotId: hotspot.id,
        skuId: sku.id,
        retailerId: sku.retailerId,
        clickId,
        userAgent: userAgent ? userAgent.substring(0, 512) : null,
        ipHash,
      });
    } catch (err: any) {
      this.logger.error(`Failed to log affiliate click event: ${err.message}`);
    }

    this.logger.log(
      `Redirecting hotspot ${hotspotId} -> SKU ${sku.sku} [${sku.retailerId}] via clickId: ${clickId}`,
    );

    return { destinationUrl, clickId };
  }

  /**
   * Constructs a deterministic outbound affiliate URL by enriching the base URL
   * with retailer-specific affiliate tags, hotspot pin sub-IDs, and universal UTM parameters.
   *
   * Retailer conventions (BR-03):
   *   AMAZON  : tag + ascsubtag=pin_{hotspotId}
   *   TARGET  : afid + subid1=pin_{hotspotId}
   *   WAYFAIR : refid + subid=pin_{hotspotId}
   *   IKEA    : cjevent=pin_{hotspotId}
   *
   * Universal UTM (all retailers):
   *   utm_source=roomcommerce, utm_medium=spatial_canvas, utm_content=pin_{hotspotId}
   */
  private buildAffiliateUrl(
    baseUrl: string,
    retailer: string,
    hotspotId: string,
    clickId: string,
  ): string {
    try {
      const url = new URL(baseUrl);
      const pinTag = `pin_${hotspotId}`;

      // Retailer-specific affiliate tracking parameters
      switch (retailer.toUpperCase()) {
        case 'AMAZON':
          url.searchParams.set('tag', process.env['AMAZON_PAAPI_PARTNER_TAG'] ?? 'roomcommerce-20');
          url.searchParams.set('ascsubtag', pinTag);
          break;
        case 'TARGET':
          url.searchParams.set('afid', process.env['IMPACT_RADIUS_AFID'] ?? 'roomcommerce');
          url.searchParams.set('subid1', pinTag);
          break;
        case 'WAYFAIR':
          url.searchParams.set('refid', process.env['WAYFAIR_REFID'] ?? 'roomcommerce');
          url.searchParams.set('subid', pinTag);
          break;
        case 'IKEA':
          url.searchParams.set('cjevent', pinTag);
          break;
        default:
          // Generic fallback for future retailers
          url.searchParams.set('subId', clickId);
          url.searchParams.set('pinId', pinTag);
          break;
      }

      // Universal UTM parameters — applied to all retailers
      url.searchParams.set('utm_source', 'roomcommerce');
      url.searchParams.set('utm_medium', 'spatial_canvas');
      url.searchParams.set('utm_content', pinTag);

      return url.toString();
    } catch {
      // Malformed base URL — return as-is to avoid breaking the redirect
      return baseUrl;
    }
  }
}
