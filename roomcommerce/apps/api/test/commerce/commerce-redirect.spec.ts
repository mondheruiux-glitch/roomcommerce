import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommerceService } from '../../src/modules/commerce/commerce.service.js';
import { NotFoundException } from '@nestjs/common';
import crypto from 'crypto';

// ── Mock DB ──────────────────────────────────────────────────────────────────
const mockFindFirstHotspot = vi.fn();
const mockFindFirstSku = vi.fn();
const mockInsertClick = vi.fn();

vi.mock('../../src/database/index.js', () => ({
  db: {
    query: {
      canvasHotspots: {
        findFirst: (...args: any[]) => mockFindFirstHotspot(...args),
      },
      catalogSkus: {
        findFirst: (...args: any[]) => mockFindFirstSku(...args),
      },
    },
    insert: () => ({
      values: (...args: any[]) => mockInsertClick(...args),
    }),
  },
}));

// ── Shared helpers ────────────────────────────────────────────────────────────

function makeHotspot(overrides: Record<string, string> = {}) {
  return {
    id: 'spot-1',
    projectId: 'proj-1',
    matchedSkuId: 'sku-1',
    ...overrides,
  };
}

function makeSku(retailerId: string, overrides: Record<string, string> = {}) {
  return {
    id: 'sku-1',
    sku: `${retailerId}-CHAIR-01`,
    retailerId,
    canonicalUrl: `https://www.${retailerId.toLowerCase()}.com/p/chair-01`,
    affiliateUrl: `https://www.${retailerId.toLowerCase()}.com/p/chair-01`,
    ...overrides,
  };
}

describe('CommerceModule — Programmatic Affiliate Redirect Router (FR-403, BR-03)', () => {
  let service: CommerceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CommerceService();
    mockInsertClick.mockResolvedValue([]);
  });

  // ── Error paths ─────────────────────────────────────────────────────────────

  it('throws NotFoundException when hotspot ID is missing', async () => {
    mockFindFirstHotspot.mockResolvedValueOnce(null);

    await expect(
      service.processAffiliateClick('unknown-spot'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when SKU is not found for a valid hotspot', async () => {
    mockFindFirstHotspot.mockResolvedValueOnce(makeHotspot());
    mockFindFirstSku.mockResolvedValueOnce(null);

    await expect(
      service.processAffiliateClick('spot-1'),
    ).rejects.toThrow(NotFoundException);
  });

  // ── AMAZON ──────────────────────────────────────────────────────────────────

  it('AMAZON: appends associate tag, ascsubtag=pin_{hotspotId}, and utm_source=roomcommerce', async () => {
    const hotspot = makeHotspot({ id: 'spot-amz', matchedSkuId: 'sku-amz' });
    mockFindFirstHotspot.mockResolvedValueOnce(hotspot);
    mockFindFirstSku.mockResolvedValueOnce(
      makeSku('AMAZON', {
        id: 'sku-amz',
        sku: 'AMZ-RUG-01',
        canonicalUrl: 'https://www.amazon.com/dp/B000TEST',
        affiliateUrl: 'https://www.amazon.com/dp/B000TEST',
      }),
    );

    const result = await service.processAffiliateClick('spot-amz');
    const parsed = new URL(result.destinationUrl);

    expect(parsed.searchParams.get('tag')).toBe('roomcommerce-20');
    expect(parsed.searchParams.get('ascsubtag')).toBe('pin_spot-amz');
    expect(parsed.searchParams.get('utm_source')).toBe('roomcommerce');
    expect(parsed.searchParams.get('utm_medium')).toBe('spatial_canvas');
    expect(parsed.searchParams.get('utm_content')).toBe('pin_spot-amz');
  });

  // ── TARGET ──────────────────────────────────────────────────────────────────

  it('TARGET: appends afid, subid1=pin_{hotspotId}, and UTM attribution', async () => {
    const hotspot = makeHotspot({ id: 'spot-tgt', matchedSkuId: 'sku-tgt' });
    mockFindFirstHotspot.mockResolvedValueOnce(hotspot);
    mockFindFirstSku.mockResolvedValueOnce(
      makeSku('TARGET', {
        id: 'sku-tgt',
        sku: 'TGT-SOFA-01',
        canonicalUrl: 'https://www.target.com/p/sofa-01',
        affiliateUrl: 'https://goto.target.com/c/123/sub?u=https://www.target.com/p/sofa-01',
      }),
    );

    const result = await service.processAffiliateClick('spot-tgt', 'user-1', 'Mozilla/5.0', '1.2.3.4');
    const parsed = new URL(result.destinationUrl);

    expect(parsed.searchParams.get('afid')).toBe('roomcommerce');
    expect(parsed.searchParams.get('subid1')).toBe('pin_spot-tgt');
    expect(parsed.searchParams.get('utm_source')).toBe('roomcommerce');
    expect(parsed.searchParams.get('utm_medium')).toBe('spatial_canvas');
    expect(parsed.searchParams.get('utm_content')).toBe('pin_spot-tgt');
    expect(result.clickId).toBeDefined();
  });

  it('TARGET: logs attribution event with hashed IP (GDPR — SEC-01)', async () => {
    const hotspot = makeHotspot({ id: 'spot-tgt-ip', matchedSkuId: 'sku-tgt-ip' });
    mockFindFirstHotspot.mockResolvedValueOnce(hotspot);
    mockFindFirstSku.mockResolvedValueOnce(
      makeSku('TARGET', { id: 'sku-tgt-ip', sku: 'TGT-SOFA-02' }),
    );

    const rawIp = '198.51.100.42';
    const expectedIpHash = crypto.createHash('sha256').update(rawIp).digest('hex');

    await service.processAffiliateClick('spot-tgt-ip', 'user-42', 'Mozilla/5.0 Mac', rawIp);

    expect(mockInsertClick).toHaveBeenCalledWith(
      expect.objectContaining({
        hotspotId: 'spot-tgt-ip',
        retailerId: 'TARGET',
        ipHash: expectedIpHash,
      }),
    );
  });

  // ── WAYFAIR ─────────────────────────────────────────────────────────────────

  it('WAYFAIR: appends refid, subid=pin_{hotspotId}, and UTM attribution', async () => {
    const hotspot = makeHotspot({ id: 'spot-way', matchedSkuId: 'sku-way' });
    mockFindFirstHotspot.mockResolvedValueOnce(hotspot);
    mockFindFirstSku.mockResolvedValueOnce(
      makeSku('WAYFAIR', {
        id: 'sku-way',
        sku: 'WAY-RUG-01',
        canonicalUrl: 'https://www.wayfair.com/furniture/pdp/rug-01.html',
        affiliateUrl: 'https://www.wayfair.com/furniture/pdp/rug-01.html',
      }),
    );

    const result = await service.processAffiliateClick('spot-way');
    const parsed = new URL(result.destinationUrl);

    expect(parsed.searchParams.get('refid')).toBe('roomcommerce');
    expect(parsed.searchParams.get('subid')).toBe('pin_spot-way');
    expect(parsed.searchParams.get('utm_source')).toBe('roomcommerce');
    expect(parsed.searchParams.get('utm_medium')).toBe('spatial_canvas');
    expect(parsed.searchParams.get('utm_content')).toBe('pin_spot-way');
  });

  // ── IKEA ────────────────────────────────────────────────────────────────────

  it('IKEA: appends cjevent=pin_{hotspotId} and UTM attribution', async () => {
    const hotspot = makeHotspot({ id: 'spot-ikea', matchedSkuId: 'sku-ikea' });
    mockFindFirstHotspot.mockResolvedValueOnce(hotspot);
    mockFindFirstSku.mockResolvedValueOnce(
      makeSku('IKEA', {
        id: 'sku-ikea',
        sku: 'IKEA-40404040',
        canonicalUrl: 'https://www.ikea.com/us/en/p/kallax-shelf-unit-white-40404040/',
        affiliateUrl: 'https://www.ikea.com/us/en/p/kallax-shelf-unit-white-40404040/',
      }),
    );

    const result = await service.processAffiliateClick('spot-ikea');
    const parsed = new URL(result.destinationUrl);

    expect(parsed.searchParams.get('cjevent')).toBe('pin_spot-ikea');
    expect(parsed.searchParams.get('utm_source')).toBe('roomcommerce');
    expect(parsed.searchParams.get('utm_medium')).toBe('spatial_canvas');
    expect(parsed.searchParams.get('utm_content')).toBe('pin_spot-ikea');
    // No 'afid', 'subid1', 'refid', 'subid' — IKEA uses only cjevent
    expect(parsed.searchParams.get('afid')).toBeNull();
    expect(parsed.searchParams.get('refid')).toBeNull();
  });

  // ── Existing query parameters are preserved ─────────────────────────────────

  it('preserves any pre-existing query parameters on the affiliate URL', async () => {
    const hotspot = makeHotspot({ id: 'spot-params', matchedSkuId: 'sku-params' });
    mockFindFirstHotspot.mockResolvedValueOnce(hotspot);
    mockFindFirstSku.mockResolvedValueOnce({
      id: 'sku-params',
      sku: 'TGT-CHAIR-01',
      retailerId: 'TARGET',
      canonicalUrl: 'https://www.target.com/p/chair-01',
      affiliateUrl: 'https://goto.target.com/c/456?existing=value&foo=bar',
    });

    const result = await service.processAffiliateClick('spot-params');
    const parsed = new URL(result.destinationUrl);

    // Pre-existing params must be retained
    expect(parsed.searchParams.get('existing')).toBe('value');
    expect(parsed.searchParams.get('foo')).toBe('bar');
    // Affiliate params must also be present
    expect(parsed.searchParams.get('afid')).toBe('roomcommerce');
    expect(parsed.searchParams.get('subid1')).toBe('pin_spot-params');
  });

  // ── Universal UTM consistency check across all retailers ────────────────────

  it.each([
    ['AMAZON', 'https://www.amazon.com/dp/B001TEST'],
    ['TARGET', 'https://www.target.com/p/chair-01'],
    ['WAYFAIR', 'https://www.wayfair.com/furniture/pdp/chair-01.html'],
    ['IKEA',   'https://www.ikea.com/us/en/p/chair-40404040/'],
  ])('%s: always includes utm_source=roomcommerce and utm_medium=spatial_canvas', async (retailerId, url) => {
    const hotspotId = `spot-utm-${retailerId.toLowerCase()}`;
    mockFindFirstHotspot.mockResolvedValueOnce(
      makeHotspot({ id: hotspotId, matchedSkuId: `sku-utm-${retailerId}` }),
    );
    mockFindFirstSku.mockResolvedValueOnce(
      makeSku(retailerId, { id: `sku-utm-${retailerId}`, canonicalUrl: url, affiliateUrl: url }),
    );

    const result = await service.processAffiliateClick(hotspotId);
    const parsed = new URL(result.destinationUrl);

    expect(parsed.searchParams.get('utm_source')).toBe('roomcommerce');
    expect(parsed.searchParams.get('utm_medium')).toBe('spatial_canvas');
    expect(parsed.searchParams.get('utm_content')).toBe(`pin_${hotspotId}`);
  });

  // ── clickId uniqueness ───────────────────────────────────────────────────────

  it('generates a unique clickId for each affiliate click', async () => {
    const clicks = await Promise.all(
      Array.from({ length: 3 }, async (_, i) => {
        const hotspotId = `spot-unique-${i}`;
        mockFindFirstHotspot.mockResolvedValueOnce(
          makeHotspot({ id: hotspotId, matchedSkuId: `sku-unique-${i}` }),
        );
        mockFindFirstSku.mockResolvedValueOnce(
          makeSku('AMAZON', { id: `sku-unique-${i}` }),
        );
        return service.processAffiliateClick(hotspotId);
      }),
    );

    const clickIds = clicks.map((r) => r.clickId);
    const unique = new Set(clickIds);
    expect(unique.size).toBe(3);
  });
});
