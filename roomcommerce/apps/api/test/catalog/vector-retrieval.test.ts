import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VectorRetrievalService, type VectorQueryOptions } from '../../src/modules/catalog/vector/vector-retrieval.service';
import { QdrantInitService } from '../../src/modules/catalog/vector/qdrant-init.service';

// ── Qdrant client mock ─────────────────────────────────────────────────────────
const mockQuery = vi.fn();

vi.mock('../../src/modules/catalog/vector/qdrant.client', () => ({
  createQdrantClient: () => ({ query: mockQuery }),
  QdrantClient: vi.fn(),
}));

// Helper: build a valid 768-dim mock embedding
function mockEmbedding(): number[] {
  return Array.from({ length: QdrantInitService.VECTOR_SIZE }, (_, i) =>
    Math.sin(i) / Math.sqrt(QdrantInitService.VECTOR_SIZE),
  );
}

// Helper: build a mock Qdrant search result hit
function mockHit(overrides: {
  sku_id?: string;
  retailer_id?: string;
  category?: string;
  price_cents?: number;
  in_stock?: boolean;
  score?: number;
}) {
  return {
    id: 'mock-uuid',
    score: overrides.score ?? 0.91,
    payload: {
      sku_id: overrides.sku_id ?? 'TGT-SOFA-000001',
      retailer_id: overrides.retailer_id ?? 'TARGET',
      category: overrides.category ?? 'sofa',
      price_cents: overrides.price_cents ?? 49900,
      in_stock: overrides.in_stock ?? true,
    },
  };
}

describe('VectorRetrievalService', () => {
  let service: VectorRetrievalService;

  beforeEach(() => {
    service = new VectorRetrievalService();
    mockQuery.mockReset();
  });

  it('throws for incorrect embedding dimension', async () => {
    const opts: VectorQueryOptions = {
      cropEmbedding: [0.1, 0.2, 0.3], // wrong dims
      category: 'sofa',
      maxPriceCents: 100_000,
    };
    await expect(service.findMatchingSkus(opts)).rejects.toThrow(
      /Invalid embedding dimension: got 3, expected 768/,
    );
  });

  it('passes the three hard pre-filters (in_stock, category, price_cents) to Qdrant', async () => {
    mockQuery.mockResolvedValue({ points: [] });
    const opts: VectorQueryOptions = {
      cropEmbedding: mockEmbedding(),
      category: 'sofa',
      maxPriceCents: 75_000,
      limit: 3,
    };
    await service.findMatchingSkus(opts);

    expect(mockQuery).toHaveBeenCalledOnce();
    const callArgs = mockQuery.mock.calls[0]?.[1] as { filter: { must: unknown[] }; limit: number };
    const mustClauses = callArgs.filter.must;

    // Verify all 3 required guards are present
    expect(mustClauses).toContainEqual({ key: 'in_stock', match: { value: true } });
    expect(mustClauses).toContainEqual({ key: 'category', match: { value: 'sofa' } });
    expect(mustClauses).toContainEqual({ key: 'price_cents', range: { lte: 75_000 } });
  });

  it('returns top-3 candidates by default', async () => {
    const hits = [
      mockHit({ sku_id: 'SKU-001', price_cents: 49900 }),
      mockHit({ sku_id: 'SKU-002', price_cents: 39900 }),
      mockHit({ sku_id: 'SKU-003', price_cents: 59900 }),
    ];
    mockQuery.mockResolvedValue({ points: hits });

    const results = await service.findMatchingSkus({
      cropEmbedding: mockEmbedding(),
      category: 'sofa',
      maxPriceCents: 100_000,
    });

    expect(results).toHaveLength(3);
    expect(results[0]?.skuId).toBe('SKU-001');
  });

  it('NEVER returns items with in_stock=false — Qdrant filter verified', async () => {
    // Qdrant enforces this at the filter level; VectorRetrievalService always passes must.in_stock=true
    mockQuery.mockResolvedValue({ points: [
      mockHit({ sku_id: 'SKU-INSTOCK', in_stock: true }),
    ] });

    const results = await service.findMatchingSkus({
      cropEmbedding: mockEmbedding(),
      category: 'sofa',
      maxPriceCents: 100_000,
    });

    const callArgs = mockQuery.mock.calls[0]?.[1] as { filter: { must: unknown[] } };
    const mustClauses = callArgs.filter.must;
    expect(mustClauses).toContainEqual({ key: 'in_stock', match: { value: true } });
    expect(results.every((r) => r !== null)).toBe(true);
  });

  it('NEVER returns items exceeding maxPriceCents — budget guardrail (FR-304)', async () => {
    mockQuery.mockResolvedValue({ points: [] });

    await service.findMatchingSkus({
      cropEmbedding: mockEmbedding(),
      category: 'coffee_table',
      maxPriceCents: 50_000,
    });

    const callArgs = mockQuery.mock.calls[0]?.[1] as { filter: { must: unknown[] } };
    const priceFilter = (callArgs.filter.must as Array<{ key?: string; range?: { lte: number } }>)
      .find((m) => m.key === 'price_cents');

    expect(priceFilter?.range?.lte).toBe(50_000);
  });

  it('maps Qdrant hits to MatchedSkuCandidate correctly', async () => {
    mockQuery.mockResolvedValue({ points: [
      mockHit({
        sku_id: 'IKEA-SOFA-001',
        retailer_id: 'IKEA',
        category: 'sofa',
        price_cents: 79900,
        score: 0.956,
      }),
    ] });

    const [result] = await service.findMatchingSkus({
      cropEmbedding: mockEmbedding(),
      category: 'sofa',
      maxPriceCents: 100_000,
    });

    expect(result).toMatchObject({
      skuId: 'IKEA-SOFA-001',
      retailerId: 'IKEA',
      category: 'sofa',
      priceCents: 79900,
      similarityScore: 0.956,
    });
  });

  it('completes within 80ms SLA on mocked data (NFR-03)', async () => {
    mockQuery.mockImplementation(() => Promise.resolve({ points: [] }));

    const start = performance.now();
    await service.findMatchingSkus({
      cropEmbedding: mockEmbedding(),
      category: 'rug',
      maxPriceCents: 30_000,
    });
    const elapsed = performance.now() - start;

    // Mocked Qdrant responds instantly — overhead should be < 50ms
    expect(elapsed).toBeLessThan(80);
  });
});
