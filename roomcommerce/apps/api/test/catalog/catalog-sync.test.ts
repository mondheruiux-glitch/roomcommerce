import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CatalogSyncService } from '../../src/modules/catalog/sync/catalog-sync.service';
import { TargetStockAdapter } from '../../src/modules/catalog/sync/adapters/target.adapter';
import { IkeaStockAdapter } from '../../src/modules/catalog/sync/adapters/ikea.adapter';
import { CompositeStockCheckerAdapter } from '../../src/modules/catalog/sync/adapters/composite-stock-checker.adapter';
import { AmazonStockAdapter } from '../../src/modules/catalog/sync/adapters/amazon.adapter';
import { WayfairStockAdapter } from '../../src/modules/catalog/sync/adapters/wayfair.adapter';

// ── Drizzle DB mock ────────────────────────────────────────────────────────────
const mockDbSelect = vi.fn();
const mockDbUpdateWhere = vi.fn();

vi.mock('../../src/database/index', () => ({
  db: {
    select: () => ({ from: () => ({ where: mockDbSelect }) }),
    update: () => ({ set: () => ({ where: mockDbUpdateWhere }) }),
  },
}));

// ── Qdrant client mock ─────────────────────────────────────────────────────────
const mockSetPayload = vi.fn();
const mockGetCollections = vi.fn();

vi.mock('../../src/modules/catalog/vector/qdrant.client', () => ({
  createQdrantClient: () => ({
    setPayload: mockSetPayload,
    getCollections: mockGetCollections,
  }),
  QdrantClient: vi.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Existing CatalogSyncService tests (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

describe('CatalogSyncService — De-indexing Pipeline (BR-02)', () => {
  let service: CatalogSyncService;

  beforeEach(() => {
    service = new CatalogSyncService();
    mockSetPayload.mockReset().mockResolvedValue({});
    mockDbUpdateWhere.mockReset().mockResolvedValue([]);
    mockDbSelect.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('validates URL and de-indexes SKU with DEAD_LINK_404 on 404 response', async () => {
    const mockSku = {
      id: 'uuid-001',
      sku: 'TGT-SOFA-000001',
      retailerId: 'TARGET',
      canonicalUrl: 'https://www.target.com/p/sofa/001',
      priceCents: 49900,
      inStock: true,
    };

    // Simulate: URL returns 404
    vi.mocked(fetch).mockResolvedValue({ status: 404 } as Response);
    mockDbSelect.mockResolvedValue([mockSku]);

    await service.executeDailySync();

    // PostgreSQL must be updated to in_stock = false
    expect(mockDbUpdateWhere).toHaveBeenCalledOnce();

    // Qdrant must receive in_stock: false payload update (BR-02)
    expect(mockSetPayload).toHaveBeenCalledWith(
      'retail_catalog_v1',
      expect.objectContaining({
        payload: { in_stock: false },
        filter: {
          must: [{ key: 'sku_id', match: { value: 'TGT-SOFA-000001' } }],
        },
      }),
    );
  });

  it('de-indexes OOS SKU in both PostgreSQL and Qdrant atomically', async () => {
    const mockSku = {
      id: 'uuid-002',
      sku: 'IKEA-SOFA-000001',
      retailerId: 'IKEA',
      canonicalUrl: 'https://www.ikea.com/p/sofa/001',
      priceCents: 39900,
      inStock: true,
    };

    // URL is valid (200), but stock check says OOS
    vi.mocked(fetch).mockResolvedValue({ status: 200 } as Response);
    mockDbSelect.mockResolvedValue([mockSku]);

    const oosChecker = {
      checkStock: vi.fn().mockResolvedValue({ inStock: false }),
    };
    const serviceWithChecker = new CatalogSyncService(oosChecker);
    await serviceWithChecker.executeDailySync();

    expect(mockDbUpdateWhere).toHaveBeenCalledOnce();
    expect(mockSetPayload).toHaveBeenCalledWith(
      'retail_catalog_v1',
      expect.objectContaining({ payload: { in_stock: false } }),
    );
  });

  it('updates price in both PostgreSQL and Qdrant when price changed', async () => {
    const mockSku = {
      id: 'uuid-003',
      sku: 'WAY-RUG-000001',
      retailerId: 'WAYFAIR',
      canonicalUrl: 'https://www.wayfair.com/p/rug/001',
      priceCents: 29900,
      inStock: true,
    };

    vi.mocked(fetch).mockResolvedValue({ status: 200 } as Response);
    mockDbSelect.mockResolvedValue([mockSku]);

    const priceChecker = {
      checkStock: vi.fn().mockResolvedValue({ inStock: true, updatedPriceCents: 24900 }),
    };
    const serviceWithChecker = new CatalogSyncService(priceChecker);
    await serviceWithChecker.executeDailySync();

    expect(mockSetPayload).toHaveBeenCalledWith(
      'retail_catalog_v1',
      expect.objectContaining({ payload: { price_cents: 24900 } }),
    );
  });

  it('does NOT call setPayload for SKUs that are valid and in-stock', async () => {
    const mockSku = {
      id: 'uuid-004',
      sku: 'AMZ-LAMP-000001',
      retailerId: 'AMAZON',
      canonicalUrl: 'https://www.amazon.com/p/lamp/001',
      priceCents: 9900,
      inStock: true,
    };

    vi.mocked(fetch).mockResolvedValue({ status: 200 } as Response);
    mockDbSelect.mockResolvedValue([mockSku]);

    const healthyChecker = {
      checkStock: vi.fn().mockResolvedValue({ inStock: true }),
    };
    const serviceWithChecker = new CatalogSyncService(healthyChecker);
    await serviceWithChecker.executeDailySync();

    // No de-index or price update should be triggered
    expect(mockSetPayload).not.toHaveBeenCalled();
    expect(mockDbUpdateWhere).not.toHaveBeenCalled();
  });

  it('de-indexed SKU is excluded from subsequent Qdrant search — filter contract test', async () => {
    mockSetPayload.mockResolvedValue({});
    mockDbUpdateWhere.mockResolvedValue([]);

    const deindexPayload = { in_stock: false };
    await mockSetPayload('retail_catalog_v1', {
      payload: deindexPayload,
      filter: { must: [{ key: 'sku_id', match: { value: 'TGT-SOFA-999999' } }] },
    });

    expect(mockSetPayload).toHaveBeenCalledWith(
      'retail_catalog_v1',
      expect.objectContaining({ payload: { in_stock: false } }),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TargetStockAdapter unit tests (TASK-008)
// ─────────────────────────────────────────────────────────────────────────────

describe('TargetStockAdapter — Unit Tests (TASK-008)', () => {
  let adapter: TargetStockAdapter;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    // Ensure env vars are cleared before each test
    delete process.env['IMPACT_RADIUS_API_TOKEN'];
    delete process.env['TARGET_API_KEY'];
    adapter = new TargetStockAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fails open (inStock: true) when credentials are missing', async () => {
    const result = await adapter.checkStock('TARGET', 'TGT-001');
    expect(result.inStock).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails open (inStock: true) when credentials start with mock_', async () => {
    process.env['IMPACT_RADIUS_API_TOKEN'] = 'mock_ir_token';
    process.env['TARGET_API_KEY'] = 'mock_target_key';
    const mockAdapter = new TargetStockAdapter();
    const result = await mockAdapter.checkStock('TARGET', 'TGT-002');
    expect(result.inStock).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns inStock: true and price when RedSky reports item as available', async () => {
    process.env['IMPACT_RADIUS_API_TOKEN'] = 'live_ir_token_abc123';
    process.env['TARGET_API_KEY'] = 'live_target_key_xyz789';
    const liveAdapter = new TargetStockAdapter();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          product: {
            fulfillment: {
              shipping_options: { availability_status: 'IN_STOCK' },
            },
            price: { current_retail: 49.99 },
          },
        },
      }),
    } as Response);

    const result = await liveAdapter.checkStock('TARGET', 'TGT-SOFA-LIVE-001');
    expect(result.inStock).toBe(true);
    expect(result.updatedPriceCents).toBe(4999);
  });

  it('returns inStock: false when RedSky reports OUT_OF_STOCK', async () => {
    process.env['IMPACT_RADIUS_API_TOKEN'] = 'live_ir_token_abc123';
    process.env['TARGET_API_KEY'] = 'live_target_key_xyz789';
    const liveAdapter = new TargetStockAdapter();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          product: {
            fulfillment: {
              shipping_options: { availability_status: 'OUT_OF_STOCK' },
            },
            price: { current_retail: 39.99 },
          },
        },
      }),
    } as Response);

    const result = await liveAdapter.checkStock('TARGET', 'TGT-SOFA-OOS-001');
    expect(result.inStock).toBe(false);
    expect(result.updatedPriceCents).toBe(3999);
  });

  it('detects price change when RedSky returns a different price', async () => {
    process.env['IMPACT_RADIUS_API_TOKEN'] = 'live_ir_token_abc123';
    process.env['TARGET_API_KEY'] = 'live_target_key_xyz789';
    const liveAdapter = new TargetStockAdapter();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          product: {
            fulfillment: {
              shipping_options: { availability_status: 'IN_STOCK' },
            },
            price: { current_retail: 29.99 },
          },
        },
      }),
    } as Response);

    const result = await liveAdapter.checkStock('TARGET', 'TGT-LAMP-PRICE-001');
    expect(result.inStock).toBe(true);
    expect(result.updatedPriceCents).toBe(2999);
  });

  it('fails open (inStock: true) on network timeout', async () => {
    process.env['IMPACT_RADIUS_API_TOKEN'] = 'live_ir_token_abc123';
    process.env['TARGET_API_KEY'] = 'live_target_key_xyz789';
    const liveAdapter = new TargetStockAdapter();

    vi.mocked(fetch).mockRejectedValueOnce(
      Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' }),
    );

    const result = await liveAdapter.checkStock('TARGET', 'TGT-TIMEOUT-001');
    expect(result.inStock).toBe(true);
  });

  it('fails open (inStock: true) on 5xx upstream error', async () => {
    process.env['IMPACT_RADIUS_API_TOKEN'] = 'live_ir_token_abc123';
    process.env['TARGET_API_KEY'] = 'live_target_key_xyz789';
    const liveAdapter = new TargetStockAdapter();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    } as Response);

    const result = await liveAdapter.checkStock('TARGET', 'TGT-5XX-001');
    expect(result.inStock).toBe(true);
  });

  it('returns inStock: false on 404 (discontinued product)', async () => {
    process.env['IMPACT_RADIUS_API_TOKEN'] = 'live_ir_token_abc123';
    process.env['TARGET_API_KEY'] = 'live_target_key_xyz789';
    const liveAdapter = new TargetStockAdapter();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as Response);

    const result = await liveAdapter.checkStock('TARGET', 'TGT-DISC-001');
    expect(result.inStock).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// IkeaStockAdapter unit tests (TASK-008)
// ─────────────────────────────────────────────────────────────────────────────

describe('IkeaStockAdapter — Unit Tests (TASK-008)', () => {
  let adapter: IkeaStockAdapter;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    delete process.env['CJ_AFFILIATE_TOKEN'];
    delete process.env['IKEA_API_KEY'];
    adapter = new IkeaStockAdapter();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fails open (inStock: true) when credentials are missing', async () => {
    const result = await adapter.checkStock('IKEA', 'IKEA-40404040');
    expect(result.inStock).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails open (inStock: true) when credentials start with mock_', async () => {
    process.env['CJ_AFFILIATE_TOKEN'] = 'mock_cj_token';
    process.env['IKEA_API_KEY'] = 'mock_ikea_key';
    const mockAdapter = new IkeaStockAdapter();
    const result = await mockAdapter.checkStock('IKEA', 'IKEA-40404040');
    expect(result.inStock).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns inStock: true when Ingka reports AVAILABLE', async () => {
    process.env['CJ_AFFILIATE_TOKEN'] = 'live_cj_token_abc123';
    process.env['IKEA_API_KEY'] = 'live_ikea_key_xyz789';
    const liveAdapter = new IkeaStockAdapter();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        availabilities: [
          {
            buyingOption: {
              cashCarry: { availability: { type: 'AVAILABLE' } },
            },
          },
        ],
        prices: [{ regularPrice: { wholeSellingPriceExclTax: 199.0 } }],
      }),
    } as Response);

    const result = await liveAdapter.checkStock('IKEA', 'IKEA-40404040');
    expect(result.inStock).toBe(true);
    expect(result.updatedPriceCents).toBe(19900);
  });

  it('returns inStock: false when Ingka reports OUT_OF_STOCK', async () => {
    process.env['CJ_AFFILIATE_TOKEN'] = 'live_cj_token_abc123';
    process.env['IKEA_API_KEY'] = 'live_ikea_key_xyz789';
    const liveAdapter = new IkeaStockAdapter();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        availabilities: [
          {
            buyingOption: {
              cashCarry: { availability: { type: 'OUT_OF_STOCK' } },
            },
          },
        ],
        prices: [{ regularPrice: { wholeSellingPriceExclTax: 149.0 } }],
      }),
    } as Response);

    const result = await liveAdapter.checkStock('IKEA', 'IKEA-50505050');
    expect(result.inStock).toBe(false);
    expect(result.updatedPriceCents).toBe(14900);
  });

  it('returns inStock: true when Ingka reports LOW_IN_STOCK', async () => {
    process.env['CJ_AFFILIATE_TOKEN'] = 'live_cj_token_abc123';
    process.env['IKEA_API_KEY'] = 'live_ikea_key_xyz789';
    const liveAdapter = new IkeaStockAdapter();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        availabilities: [
          {
            buyingOption: {
              cashCarry: { availability: { type: 'LOW_IN_STOCK' } },
            },
          },
        ],
        prices: [],
      }),
    } as Response);

    const result = await liveAdapter.checkStock('IKEA', 'IKEA-60606060');
    expect(result.inStock).toBe(true);
    expect(result.updatedPriceCents).toBeUndefined();
  });

  it('detects price change from Ingka pricing data', async () => {
    process.env['CJ_AFFILIATE_TOKEN'] = 'live_cj_token_abc123';
    process.env['IKEA_API_KEY'] = 'live_ikea_key_xyz789';
    const liveAdapter = new IkeaStockAdapter();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        availabilities: [
          {
            buyingOption: {
              homeDelivery: { availability: { type: 'AVAILABLE' } },
            },
          },
        ],
        prices: [{ regularPrice: { wholeSellingPriceExclTax: 89.99 } }],
      }),
    } as Response);

    const result = await liveAdapter.checkStock('IKEA', 'IKEA-70707070');
    expect(result.inStock).toBe(true);
    expect(result.updatedPriceCents).toBe(8999);
  });

  it('fails open (inStock: true) on network timeout', async () => {
    process.env['CJ_AFFILIATE_TOKEN'] = 'live_cj_token_abc123';
    process.env['IKEA_API_KEY'] = 'live_ikea_key_xyz789';
    const liveAdapter = new IkeaStockAdapter();

    vi.mocked(fetch).mockRejectedValueOnce(
      Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' }),
    );

    const result = await liveAdapter.checkStock('IKEA', 'IKEA-TIMEOUT-001');
    expect(result.inStock).toBe(true);
  });

  it('fails open (inStock: true) on 5xx upstream error', async () => {
    process.env['CJ_AFFILIATE_TOKEN'] = 'live_cj_token_abc123';
    process.env['IKEA_API_KEY'] = 'live_ikea_key_xyz789';
    const liveAdapter = new IkeaStockAdapter();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    const result = await liveAdapter.checkStock('IKEA', 'IKEA-5XX-001');
    expect(result.inStock).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CompositeStockCheckerAdapter routing tests — all 4 retailers
// ─────────────────────────────────────────────────────────────────────────────

describe('CompositeStockCheckerAdapter — Retailer Routing (4 Retailers)', () => {
  const makeAdapter = (inStock: boolean, updatedPriceCents?: number) => ({
    checkStock: vi.fn().mockResolvedValue({ inStock, updatedPriceCents }),
  });

  it('routes AMAZON to AmazonStockAdapter', async () => {
    const amazon = makeAdapter(true);
    const wayfair = makeAdapter(true);
    const target = makeAdapter(true);
    const ikea = makeAdapter(true);
    const composite = new CompositeStockCheckerAdapter(
      amazon as unknown as AmazonStockAdapter,
      wayfair as unknown as WayfairStockAdapter,
      target as unknown as TargetStockAdapter,
      ikea as unknown as IkeaStockAdapter,
    );

    await composite.checkStock('AMAZON', 'AMZ-001');
    expect(amazon.checkStock).toHaveBeenCalledWith('AMAZON', 'AMZ-001');
    expect(wayfair.checkStock).not.toHaveBeenCalled();
    expect(target.checkStock).not.toHaveBeenCalled();
    expect(ikea.checkStock).not.toHaveBeenCalled();
  });

  it('routes WAYFAIR to WayfairStockAdapter', async () => {
    const amazon = makeAdapter(true);
    const wayfair = makeAdapter(false);
    const target = makeAdapter(true);
    const ikea = makeAdapter(true);
    const composite = new CompositeStockCheckerAdapter(
      amazon as unknown as AmazonStockAdapter,
      wayfair as unknown as WayfairStockAdapter,
      target as unknown as TargetStockAdapter,
      ikea as unknown as IkeaStockAdapter,
    );

    const result = await composite.checkStock('WAYFAIR', 'WAY-001');
    expect(wayfair.checkStock).toHaveBeenCalledWith('WAYFAIR', 'WAY-001');
    expect(result.inStock).toBe(false);
    expect(amazon.checkStock).not.toHaveBeenCalled();
  });

  it('routes TARGET to TargetStockAdapter', async () => {
    const amazon = makeAdapter(true);
    const wayfair = makeAdapter(true);
    const target = makeAdapter(false, 4999);
    const ikea = makeAdapter(true);
    const composite = new CompositeStockCheckerAdapter(
      amazon as unknown as AmazonStockAdapter,
      wayfair as unknown as WayfairStockAdapter,
      target as unknown as TargetStockAdapter,
      ikea as unknown as IkeaStockAdapter,
    );

    const result = await composite.checkStock('TARGET', 'TGT-001');
    expect(target.checkStock).toHaveBeenCalledWith('TARGET', 'TGT-001');
    expect(result.inStock).toBe(false);
    expect(result.updatedPriceCents).toBe(4999);
  });

  it('routes IKEA to IkeaStockAdapter', async () => {
    const amazon = makeAdapter(true);
    const wayfair = makeAdapter(true);
    const target = makeAdapter(true);
    const ikea = makeAdapter(true, 19900);
    const composite = new CompositeStockCheckerAdapter(
      amazon as unknown as AmazonStockAdapter,
      wayfair as unknown as WayfairStockAdapter,
      target as unknown as TargetStockAdapter,
      ikea as unknown as IkeaStockAdapter,
    );

    const result = await composite.checkStock('IKEA', 'IKEA-001');
    expect(ikea.checkStock).toHaveBeenCalledWith('IKEA', 'IKEA-001');
    expect(result.inStock).toBe(true);
    expect(result.updatedPriceCents).toBe(19900);
  });

  it('is case-insensitive for retailer routing (lowercase input)', async () => {
    const amazon = makeAdapter(true);
    const wayfair = makeAdapter(true);
    const target = makeAdapter(true);
    const ikea = makeAdapter(true);
    const composite = new CompositeStockCheckerAdapter(
      amazon as unknown as AmazonStockAdapter,
      wayfair as unknown as WayfairStockAdapter,
      target as unknown as TargetStockAdapter,
      ikea as unknown as IkeaStockAdapter,
    );

    await composite.checkStock('amazon', 'AMZ-LOWER-001');
    expect(amazon.checkStock).toHaveBeenCalled();
  });

  it('fails open (inStock: true) for unknown / unintegrated retailers', async () => {
    const amazon = makeAdapter(true);
    const wayfair = makeAdapter(true);
    const target = makeAdapter(true);
    const ikea = makeAdapter(true);
    const composite = new CompositeStockCheckerAdapter(
      amazon as unknown as AmazonStockAdapter,
      wayfair as unknown as WayfairStockAdapter,
      target as unknown as TargetStockAdapter,
      ikea as unknown as IkeaStockAdapter,
    );

    const result = await composite.checkStock('UNKNOWN_RETAILER', 'UNKNOWN-SKU-001');
    expect(result.inStock).toBe(true);
    expect(amazon.checkStock).not.toHaveBeenCalled();
    expect(wayfair.checkStock).not.toHaveBeenCalled();
    expect(target.checkStock).not.toHaveBeenCalled();
    expect(ikea.checkStock).not.toHaveBeenCalled();
  });
});
