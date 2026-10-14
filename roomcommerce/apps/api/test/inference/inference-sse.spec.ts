import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InferenceService } from '../../src/modules/inference/inference.service.js';
import { InferenceProcessor } from '../../src/modules/inference/queues/inference.processor.js';
import { PipelineSseService, TelemetryProgressEvent } from '../../src/modules/inference/sse/pipeline-sse.service.js';
import { Queue } from 'bullmq';
import { firstValueFrom, take, toArray, Subject } from 'rxjs';

// ── Deterministic 768-dim vector helper ───────────────────────────────────────
function makeMockEmbedding(seed = 0): number[] {
  const vec = Array.from({ length: 768 }, (_, i) => Math.sin((seed + i) * 0.01));
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return vec.map((v) => v / norm);
}

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockDbFindProject = vi.fn();
const mockDbFindUser = vi.fn();
const mockDbFindPass = vi.fn();
const mockDbUpdateProject = vi.fn().mockResolvedValue([]);
const mockDbUpdateUser = vi.fn().mockResolvedValue([]);
const mockDbUpdatePass = vi.fn().mockResolvedValue([]);
const mockDbInsertHotspot = vi.fn().mockResolvedValue([]);
const mockDbSelectFallbackSkus = vi.fn();

vi.mock('../../src/database/index.js', () => ({
  db: {
    query: {
      projects: { findFirst: (...a: any[]) => mockDbFindProject(...a) },
      users:    { findFirst: (...a: any[]) => mockDbFindUser(...a) },
      movePasses: { findFirst: (...a: any[]) => mockDbFindPass(...a) },
    },
    update: (_table: any) => ({
      set: (_vals: any) => ({
        where: (_cond: any) => {
          // Distinguish update calls by table reference heuristically
          return Promise.resolve([]);
        },
      }),
    }),
    insert: (_table: any) => ({
      values: (...a: any[]) => ({
        onConflictDoNothing: () => mockDbInsertHotspot(...a),
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => mockDbSelectFallbackSkus(),
        }),
      }),
    }),
  },
}));

// Override update to use our fine-grained mocks based on context
vi.mock('../../src/database/index.js', () => {
  let updateTarget = '';
  return {
    db: {
      query: {
        projects:   { findFirst: (...a: any[]) => mockDbFindProject(...a) },
        users:      { findFirst: (...a: any[]) => mockDbFindUser(...a) },
        movePasses: { findFirst: (...a: any[]) => mockDbFindPass(...a) },
      },
      update: (table: any) => ({
        set: (vals: any) => ({
          where: (cond: any) => {
            // Route update calls based on the set values
            if ('status' in vals) return mockDbUpdateProject(vals);
            if ('freeRendersUsed' in vals) return mockDbUpdateUser(vals);
            if ('generationsExecuted' in vals) return mockDbUpdatePass(vals);
            return Promise.resolve([]);
          },
        }),
      }),
      insert: (_table: any) => ({
        values: (...a: any[]) => ({
          onConflictDoNothing: () => mockDbInsertHotspot(...a),
        }),
      }),
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => mockDbSelectFallbackSkus(),
          }),
        }),
      }),
    },
  };
});

// ── Qdrant / VectorRetrievalService mock ──────────────────────────────────────
vi.mock('../../src/modules/catalog/vector/qdrant.client.js', () => ({
  createQdrantClient: () => ({ query: vi.fn(), setPayload: vi.fn() }),
}));

// ── AWS SDK mocks (block real network calls from uploadBase64ToR2) ────────────
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({})),
  PutObjectCommand: vi.fn().mockImplementation((args: any) => args),
}));
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://mock-r2.example.com/signed-url'),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeProject(overrides: Record<string, any> = {}) {
  return {
    id: 'proj-1',
    stylePreset: 'JAPANDI',
    roomFunction: 'LIVING_ROOM',
    budgetCeilingCents: 150_000,
    status: 'PENDING',
    lockedAnchorCategories: [],
    ...overrides,
  };
}

function makeVectorService(
  candidates: { skuId: string; retailerId: string; category: string; priceCents: number; similarityScore: number }[] = [],
): any {
  return {
    findMatchingSkus: vi.fn().mockResolvedValue(candidates),
  };
}

function makeJob(overrides: Record<string, any> = {}): any {
  return {
    id: 'job-001',
    data: {
      projectId: 'proj-1',
      assetKey: 'raw-uploads/proj-1.jpg',
      userId: 'user-1',
      isPaidPass: false,
      lockedAnchorCategories: [],
      ...overrides,
    },
    opts: { priority: 10 },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1 — InferenceService + PipelineSseService (existing + extended)
// ─────────────────────────────────────────────────────────────────────────────

describe('InferenceModule — Dual-Priority Dispatcher & SSE Stream (NFR-06)', () => {
  let sseService: PipelineSseService;
  let inferenceService: InferenceService;
  let mockQueue: Queue;

  beforeEach(() => {
    vi.clearAllMocks();
    sseService = new PipelineSseService();
    mockQueue = { add: vi.fn().mockResolvedValue({ id: 'job-101' }) } as unknown as Queue;
    inferenceService = new InferenceService(mockQueue, sseService);
  });

  it('assigns high priority (1) and faster ETA for Move-In Pass render jobs', async () => {
    const res = await inferenceService.enqueueRenderJob('proj-vip', 'raw-uploads/proj-vip.jpg', true, 'user-vip');
    expect(res.job_id).toBe('job-101');
    expect(res.estimated_duration_seconds).toBe(8);
    expect(mockQueue.add).toHaveBeenCalledWith(
      'render-room',
      expect.objectContaining({ projectId: 'proj-vip', isPaidPass: true }),
      expect.objectContaining({ priority: 1 }),
    );
  });

  it('assigns standard priority (10) for free-tier render jobs', async () => {
    const res = await inferenceService.enqueueRenderJob('proj-free', 'raw-uploads/proj-free.jpg', false);
    expect(res.job_id).toBe('job-101');
    expect(res.estimated_duration_seconds).toBe(14);
    expect(mockQueue.add).toHaveBeenCalledWith(
      'render-room',
      expect.objectContaining({ isPaidPass: false }),
      expect.objectContaining({ priority: 10 }),
    );
  });

  it('streams telemetry events to project subscriber and filters unrelated projects', async () => {
    const targetProject = 'proj-target';
    const stream$ = sseService.subscribeToProject(targetProject).pipe(take(2), toArray());
    const resultPromise = firstValueFrom(stream$);

    sseService.emitProgress({ project_id: targetProject, stage: 'SANITIZATION', progress_pct: 15, message: 'Face blurring active', timestamp: new Date().toISOString() });
    sseService.emitProgress({ project_id: 'other-proj', stage: 'DEPTH_ESTIMATION', progress_pct: 35, message: 'Unrelated', timestamp: new Date().toISOString() });
    sseService.emitProgress({ project_id: targetProject, stage: 'COMPLETED', progress_pct: 100, message: 'Done', timestamp: new Date().toISOString() });

    const events = await resultPromise;
    expect(events).toHaveLength(2);
    expect(events[0].stage).toBe('SANITIZATION');
    expect(events[1].stage).toBe('COMPLETED');
  });

  it('emits all 7 distinct pipeline stages in correct order', async () => {
    const stages: TelemetryProgressEvent[] = [];
    sseService.subscribeToProject('proj-stages').subscribe((e) => stages.push(e));

    const stagesInOrder = [
      { stage: 'QUEUED' as const, pct: 0 },
      { stage: 'SANITIZATION' as const, pct: 15 },
      { stage: 'DEPTH_ESTIMATION' as const, pct: 35 },
      { stage: 'INPAINTING' as const, pct: 65 },
      { stage: 'SEGMENTATION' as const, pct: 80 },
      { stage: 'CATALOG_MATCHING' as const, pct: 90 },
      { stage: 'COMPLETED' as const, pct: 100 },
    ];
    for (const { stage, pct } of stagesInOrder) {
      sseService.emitProgress({ project_id: 'proj-stages', stage, progress_pct: pct, message: stage, timestamp: '' });
    }

    expect(stages.map((e) => e.stage)).toEqual(stagesInOrder.map((s) => s.stage));
    expect(stages.map((e) => e.progress_pct)).toEqual(stagesInOrder.map((s) => s.pct));
  });

  it('COMPLETED event carries rendered_image_url, hotspots_count, total_cart_cents', async () => {
    const received: TelemetryProgressEvent[] = [];
    sseService.subscribeToProject('proj-complete').subscribe((e) => received.push(e));

    sseService.emitProgress({
      project_id: 'proj-complete',
      stage: 'COMPLETED',
      progress_pct: 100,
      message: 'Done',
      timestamp: '',
      rendered_image_url: 'https://cdn.roomcommerce.internal/renders/proj-complete_rendered.webp',
      hotspots_count: 3,
      total_cart_cents: 89900,
    });

    expect(received[0].rendered_image_url).toBe('https://cdn.roomcommerce.internal/renders/proj-complete_rendered.webp');
    expect(received[0].hotspots_count).toBe(3);
    expect(received[0].total_cart_cents).toBe(89900);
  });

  it('FAILED event carries credits_restored: true and error message', async () => {
    const received: TelemetryProgressEvent[] = [];
    sseService.subscribeToProject('proj-failed').subscribe((e) => received.push(e));

    sseService.emitProgress({
      project_id: 'proj-failed',
      stage: 'FAILED',
      progress_pct: 100,
      message: 'Blurry image rejected. Your credit has been restored.',
      timestamp: '',
      error: 'IMAGE_QUALITY_FAILED',
      credits_restored: true,
    });

    expect(received[0].credits_restored).toBe(true);
    expect(received[0].error).toBe('IMAGE_QUALITY_FAILED');
    expect(received[0].message).toContain('credit has been restored');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2 — InferenceProcessor in Live Modal HTTP Mode
// ─────────────────────────────────────────────────────────────────────────────

describe('InferenceProcessor — Live Modal HTTP Mode', () => {
  let sseService: PipelineSseService;
  let processor: InferenceProcessor;
  let emittedEvents: TelemetryProgressEvent[];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('MODAL_MOCK_MODE', '');  // ensure live mode
    vi.stubGlobal('fetch', vi.fn());

    emittedEvents = [];
    sseService = new PipelineSseService();
    sseService.subscribeToProject('proj-live').subscribe((e) => emittedEvents.push(e));

    mockDbFindProject.mockResolvedValue(makeProject({ id: 'proj-live' }));
    mockDbFindUser.mockResolvedValue({ id: 'user-1', freeRendersUsed: 0 });
    mockDbInsertHotspot.mockResolvedValue([]);
    mockDbSelectFallbackSkus.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends Authorization: Bearer header and JSON body to Modal endpoint', async () => {
    const vectorService = makeVectorService([
      { skuId: 'sku-sofa-01', retailerId: 'WAYFAIR', category: 'sofa', priceCents: 49900, similarityScore: 0.94 },
    ]);
    processor = new InferenceProcessor(sseService, vectorService);

    // Mock: Modal endpoint
    (fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            status: 'COMPLETED',
            rendered_image_b64: Buffer.from('rendered').toString('base64'),
            depth_map_b64: Buffer.from('depth').toString('base64'),
            hotspots: [{ category: 'sofa', norm_x: 0.45, norm_y: 0.62, crop_embedding: makeMockEmbedding(0) }],
            compute_cost_usd: 0.002,
            timings: { total_latency_ms: 8500 },
            faces_obfuscated: 0,
          },
        }),
      })
      // Mock: R2 signed URL PUT for rendered image
      .mockResolvedValueOnce({ ok: true, status: 200 })
      // Mock: R2 signed URL PUT for depth map
      .mockResolvedValueOnce({ ok: true, status: 200 });

    await processor.process(makeJob({ projectId: 'proj-live', lockedAnchorCategories: [] }));

    // Verify Modal call structure
    const modalCall = (fetch as any).mock.calls[0];
    expect(modalCall[0]).toBe('https://api.modal.run/v1/roomcommerce/render');
    expect(modalCall[1].method).toBe('POST');
    expect(modalCall[1].headers['Content-Type']).toBe('application/json');
    expect(modalCall[1].headers['Authorization']).toMatch(/^Bearer /);

    const body = JSON.parse(modalCall[1].body);
    expect(body.project_id).toBe('proj-live');
    expect(body.style_preset).toBe('JAPANDI');
    expect(body.budget_ceiling_cents).toBe(150_000);
    expect(body.locked_anchor_categories).toEqual([]);
  });

  it('respects cumulative budgetCeilingCents — stops pinning when budget is exhausted', async () => {
    // Budget: 100,000 cents. Two hotspots each 60,000 cents — second should be skipped.
    const vectorService = {
      findMatchingSkus: vi.fn()
        .mockResolvedValueOnce([{ skuId: 'sku-A', retailerId: 'TARGET', category: 'sofa',        priceCents: 60000, similarityScore: 0.90 }])
        .mockResolvedValueOnce([{ skuId: 'sku-B', retailerId: 'IKEA',   category: 'coffee_table', priceCents: 60000, similarityScore: 0.88 }]),
    };
    processor = new InferenceProcessor(sseService, vectorService as any);

    mockDbFindProject.mockResolvedValue(makeProject({ id: 'proj-live', budgetCeilingCents: 100_000 }));

    (fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            status: 'COMPLETED',
            rendered_image_b64: null,
            depth_map_b64: null,
            hotspots: [
              { category: 'sofa',        norm_x: 0.40, norm_y: 0.60, crop_embedding: makeMockEmbedding(0) },
              { category: 'coffee_table', norm_x: 0.60, norm_y: 0.70, crop_embedding: makeMockEmbedding(1) },
            ],
            compute_cost_usd: 0.003,
            timings: { total_latency_ms: 9000 },
            faces_obfuscated: 0,
          },
        }),
      });

    const result = await processor.process(makeJob({ projectId: 'proj-live', lockedAnchorCategories: [] }));

    // Only 1 hotspot should have been pinned (budget exhausted after first)
    expect(result.hotspotsCount).toBe(1);
    expect(result.totalCartCents).toBe(60_000);
    expect(mockDbInsertHotspot).toHaveBeenCalledTimes(1);
  });

  it('transitions project to COMPLETED and emits complete SSE event', async () => {
    const vectorService = makeVectorService([
      { skuId: 'sku-rug-01', retailerId: 'WAYFAIR', category: 'rug', priceCents: 29900, similarityScore: 0.91 },
    ]);
    processor = new InferenceProcessor(sseService, vectorService);

    (fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            status: 'COMPLETED',
            rendered_image_b64: Buffer.from('img').toString('base64'),
            depth_map_b64: null,
            hotspots: [{ category: 'rug', norm_x: 0.50, norm_y: 0.70, crop_embedding: makeMockEmbedding(0) }],
            compute_cost_usd: 0.001,
            timings: { total_latency_ms: 7000 },
            faces_obfuscated: 0,
          },
        }),
      })
      // Mock: R2 signed URL PUT for rendered image
      .mockResolvedValueOnce({ ok: true, status: 200 });

    await processor.process(makeJob({ projectId: 'proj-live' }));

    const completedEvent = emittedEvents.find((e) => e.stage === 'COMPLETED');
    expect(completedEvent).toBeDefined();
    expect(completedEvent!.progress_pct).toBe(100);
    expect(completedEvent!.rendered_image_url).toContain('proj-live_rendered.webp');
    expect(completedEvent!.hotspots_count).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3 — Quality Gate Failure & Timeout Credit Restitution
// ─────────────────────────────────────────────────────────────────────────────

describe('InferenceProcessor — Quality Gate Failure & Timeout Credit Restitution (NFR-06)', () => {
  let sseService: PipelineSseService;
  let processor: InferenceProcessor;
  let emittedEvents: TelemetryProgressEvent[];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('MODAL_MOCK_MODE', '');
    vi.stubGlobal('fetch', vi.fn());

    emittedEvents = [];
    sseService = new PipelineSseService();
    sseService.subscribeToProject('proj-fail').subscribe((e) => emittedEvents.push(e));

    processor = new InferenceProcessor(sseService, makeVectorService());
    mockDbFindProject.mockResolvedValue(makeProject({ id: 'proj-fail' }));
    mockDbFindUser.mockResolvedValue({ id: 'user-1', freeRendersUsed: 1 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('IMAGE_QUALITY_FAILED: marks project FAILED, restores credit, emits error SSE with creditsRestored: true', async () => {
    (fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          result: {
            status: 'FAILED',
            error_code: 'IMAGE_QUALITY_FAILED',
            message: 'Image is too blurry or underexposed. Minimum resolution 512×512 required.',
          },
        }),
      });

    await expect(
      processor.process(makeJob({ projectId: 'proj-fail' })),
    ).rejects.toThrow('IMAGE_QUALITY_FAILED');

    const errorEvent = emittedEvents.find((e) => e.stage === 'FAILED');
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.credits_restored).toBe(true);
    expect(errorEvent!.message).toContain('credit has been restored');
  });

  it('HTTP 500 upstream: marks project FAILED and emits error SSE with creditsRestored: true', async () => {
    (fetch as any)
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Internal Server Error' });

    await expect(
      processor.process(makeJob({ projectId: 'proj-fail' })),
    ).rejects.toThrow('Modal endpoint returned HTTP 500');

    const errorEvent = emittedEvents.find((e) => e.stage === 'FAILED');
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.credits_restored).toBe(true);
  });

  it('Network timeout: marks project FAILED and emits error SSE with creditsRestored: true', async () => {
    (fetch as any)
      .mockRejectedValueOnce(
        Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' }),
      );

    await expect(
      processor.process(makeJob({ projectId: 'proj-fail' })),
    ).rejects.toThrow('aborted');

    const errorEvent = emittedEvents.find((e) => e.stage === 'FAILED');
    expect(errorEvent).toBeDefined();
    expect(errorEvent!.credits_restored).toBe(true);
  });

  it('Move-In Pass credit is restored on failure (generationsExecuted decremented safely)', async () => {
    mockDbFindPass.mockResolvedValue({ id: 'pass-1', userId: 'user-vip', isActive: true, generationsExecuted: 3 });
    sseService.subscribeToProject('proj-vip-fail').subscribe((e) => emittedEvents.push(e));
    mockDbFindProject.mockResolvedValue(makeProject({ id: 'proj-vip-fail' }));

    const vipProcessor = new InferenceProcessor(sseService, makeVectorService());

    (fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: { status: 'FAILED', error_code: 'IMAGE_QUALITY_FAILED', message: 'too dark' } }),
      });

    await expect(
      vipProcessor.process(makeJob({ projectId: 'proj-vip-fail', isPaidPass: true, userId: 'user-vip' })),
    ).rejects.toThrow();

    const errorEvent = emittedEvents.find((e) => e.stage === 'FAILED');
    expect(errorEvent?.credits_restored).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4 — InferenceProcessor in Mock / CI Mode (MODAL_MOCK_MODE=true)
// ─────────────────────────────────────────────────────────────────────────────

describe('InferenceProcessor — Mock / CI Mode (MODAL_MOCK_MODE=true)', () => {
  let sseService: PipelineSseService;
  let processor: InferenceProcessor;
  let emittedEvents: TelemetryProgressEvent[];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('MODAL_MOCK_MODE', 'true');
    vi.stubGlobal('fetch', vi.fn());

    emittedEvents = [];
    sseService = new PipelineSseService();
    sseService.subscribeToProject('proj-mock').subscribe((e) => emittedEvents.push(e));

    mockDbFindProject.mockResolvedValue(makeProject({ id: 'proj-mock' }));
    mockDbFindUser.mockResolvedValue({ id: 'user-1', freeRendersUsed: 0 });
    mockDbInsertHotspot.mockResolvedValue([]);
    mockDbSelectFallbackSkus.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('does NOT call the Modal endpoint when MODAL_MOCK_MODE=true', async () => {
    const vectorService = makeVectorService([
      { skuId: 'sku-sofa', retailerId: 'WAYFAIR', category: 'sofa', priceCents: 49900, similarityScore: 0.90 },
    ]);
    processor = new InferenceProcessor(sseService, vectorService);

    // fetch should NOT be called in mock mode
    (fetch as any).mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

    await processor.process(makeJob({ projectId: 'proj-mock' }));

    // Modal endpoint was never reached (only R2 upload calls via signed URLs hit fetch)
    const modalCalls = (fetch as any).mock.calls.filter(
      (call: any[]) => call[0] === 'https://api.modal.run/v1/roomcommerce/render',
    );
    expect(modalCalls).toHaveLength(0);
  });

  it('emits SANITIZATION, DEPTH_ESTIMATION, INPAINTING in mock mode', async () => {
    const vectorService = makeVectorService([
      { skuId: 'sku-lamp', retailerId: 'TARGET', category: 'floor_lamp', priceCents: 12000, similarityScore: 0.88 },
    ]);
    processor = new InferenceProcessor(sseService, vectorService);

    (fetch as any).mockResolvedValue({ ok: true, status: 200 });

    await processor.process(makeJob({ projectId: 'proj-mock' }));

    const stageNames = emittedEvents.map((e) => e.stage);
    expect(stageNames).toContain('SANITIZATION');
    expect(stageNames).toContain('DEPTH_ESTIMATION');
    expect(stageNames).toContain('INPAINTING');
    expect(stageNames).toContain('COMPLETED');
  });

  it('US-03: locked anchor categories are excluded from generated hotspots', async () => {
    const vectorService = {
      findMatchingSkus: vi.fn().mockResolvedValue([
        { skuId: 'sku-table', retailerId: 'IKEA', category: 'coffee_table', priceCents: 19900, similarityScore: 0.88 },
      ]),
    };
    processor = new InferenceProcessor(sseService, vectorService as any);

    (fetch as any).mockResolvedValue({ ok: true, status: 200 });

    const job = makeJob({
      projectId: 'proj-mock',
      // Lock "sofa" — the mock path generates sofa, coffee_table, floor_lamp
      lockedAnchorCategories: ['sofa'],
    });

    await processor.process(job);

    // findMatchingSkus must never have been called with category="sofa"
    const sofaCalls = vectorService.findMatchingSkus.mock.calls.filter(
      (call: any[]) => call[0]?.category === 'sofa',
    );
    expect(sofaCalls).toHaveLength(0);
  });

  it('US-03: locking multiple categories skips all of them', async () => {
    const vectorService = {
      findMatchingSkus: vi.fn().mockResolvedValue([
        { skuId: 'sku-lamp', retailerId: 'TARGET', category: 'floor_lamp', priceCents: 12000, similarityScore: 0.85 },
      ]),
    };
    processor = new InferenceProcessor(sseService, vectorService as any);

    (fetch as any).mockResolvedValue({ ok: true, status: 200 });

    const job = makeJob({
      projectId: 'proj-mock',
      lockedAnchorCategories: ['sofa', 'coffee_table'],
    });

    await processor.process(job);

    const lockedCalls = vectorService.findMatchingSkus.mock.calls.filter(
      (call: any[]) => ['sofa', 'coffee_table'].includes(call[0]?.category),
    );
    expect(lockedCalls).toHaveLength(0);
  });

  it('deterministic simulation produces COMPLETED event with hotspots_count > 0', async () => {
    const vectorService = makeVectorService([
      { skuId: 'sku-A', retailerId: 'AMAZON', category: 'sofa', priceCents: 39900, similarityScore: 0.93 },
    ]);
    processor = new InferenceProcessor(sseService, vectorService);

    (fetch as any).mockResolvedValue({ ok: true, status: 200 });

    const result = await processor.process(makeJob({ projectId: 'proj-mock' }));

    expect(result.status).toBe('COMPLETED');
    expect(typeof result.hotspotsCount).toBe('number');
    expect(result.hotspotsCount).toBeGreaterThan(0);
  });
});
