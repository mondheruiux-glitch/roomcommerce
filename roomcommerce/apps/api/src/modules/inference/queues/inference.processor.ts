import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { db } from '../../../database/index.js';
import {
  projects,
  canvasHotspots,
  catalogSkus,
  users,
  movePasses,
} from '../../../database/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';
import { PipelineSseService } from '../sse/pipeline-sse.service.js';
import { VectorRetrievalService } from '../../catalog/vector/vector-retrieval.service.js';
import { env } from '../../../config/env.js';

export interface RenderJobData {
  projectId: string;
  assetKey: string;
  userId?: string;
  isPaidPass: boolean;
  /** US-03: categories excluded from replacement (user-locked anchor items) */
  lockedAnchorCategories?: string[];
}

// ---------------------------------------------------------------------------
// Modal API response contract (matches workers/gpu-runner/modal_app.py)
// ---------------------------------------------------------------------------

/**
 * Shape returned by modal_app.py → run_pipeline.
 * The web endpoint wraps this in { "result": <ModalPipelineResult> }.
 */
interface ModalPipelineResult {
  status: 'COMPLETED' | 'FAILED';
  /** Base64-encoded WebP rendered image */
  rendered_image_b64?: string;
  /** Base64-encoded PNG depth map */
  depth_map_b64?: string;
  error_code?: string;
  message?: string;
  faces_obfuscated?: number;
  compute_cost_usd?: number;
  timings?: Record<string, number>;
  hotspots?: Array<{
    category: string;
    norm_x: number;
    norm_y: number;
    /** 768-dim SigLIP embedding from the GPU pipeline */
    crop_embedding: number[];
    bounding_box?: { xmin: number; ymin: number; xmax: number; ymax: number };
  }>;
}

// ---------------------------------------------------------------------------
// Pipeline stage manifest — maps stage → SSE progress %
// ---------------------------------------------------------------------------

const PIPELINE_STAGES = [
  { stage: 'SANITIZATION',    pct: 15, message: 'Validating image resolution and applying privacy face obfuscation...' },
  { stage: 'DEPTH_ESTIMATION', pct: 35, message: 'Extracting 3D room geometry and monocular depth perspective...' },
  { stage: 'INPAINTING',      pct: 65, message: (style: string) => `Synthesizing spatial architectural redesign conditioned on ${style}...` },
  { stage: 'SEGMENTATION',    pct: 80, message: 'Detecting placed furniture elements and cropping semantic regions...' },
  { stage: 'CATALOG_MATCHING', pct: 90, message: 'Querying Qdrant HNSW vector index for in-stock retail catalog matches...' },
] as const;

/** Minimum 768-dim L2-normalized deterministic vector for mock mode */
function makeMockEmbedding(seed: number): number[] {
  const vec = Array.from({ length: 768 }, (_, i) => Math.sin((seed + i) * 0.01));
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return vec.map((v) => v / norm);
}

// ---------------------------------------------------------------------------
// Mode determination helper
// ---------------------------------------------------------------------------

/**
 * Returns true when a real Modal GPU endpoint is configured and MODAL_MOCK_MODE
 * is NOT set to 'true'. When false the processor runs a deterministic simulation
 * that never spends GPU credits (safe for CI / local dev / Playwright E2E).
 */
function isLiveModalConfigured(): boolean {
  if (process.env['MODAL_MOCK_MODE'] === 'true') return false;
  const endpoint = process.env['MODAL_API_ENDPOINT'] ?? env.MODAL_API_ENDPOINT ?? '';
  return endpoint.startsWith('http') && !endpoint.includes('mock');
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

@Processor('inference-jobs')
export class InferenceProcessor extends WorkerHost {
  private readonly logger = new Logger(InferenceProcessor.name);

  constructor(
    private readonly sseService: PipelineSseService,
    private readonly vectorRetrieval: VectorRetrievalService,
  ) {
    super();
  }

  // ─── Entry point ─────────────────────────────────────────────────────────

  async process(job: Job<RenderJobData>): Promise<any> {
    const { projectId, assetKey, userId, isPaidPass, lockedAnchorCategories = [] } = job.data;
    const now = () => new Date().toISOString();

    this.logger.log(
      `Processing render job ${job.id} for project ${projectId} [${assetKey}] ` +
        `(Priority: ${job.opts.priority ?? 10}, live: ${isLiveModalConfigured()})`,
    );

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      this.logger.error(`Project ${projectId} not found in database.`);
      return;
    }

    try {
      let result: ModalPipelineResult;
      let renderedImageUrl: string;
      let depthMapUrl: string;

      if (isLiveModalConfigured()) {
        // ── LIVE MODAL GPU PATH ─────────────────────────────────────────────
        result = await this.executeLiveModalPath(project, projectId, assetKey, now);
      } else {
        // ── MOCK / CI SIMULATION PATH ───────────────────────────────────────
        result = await this.executeMockPath(project, projectId, lockedAnchorCategories, now);
      }

      // ── Upload rendered images to R2 ───────────────────────────────────
      const renderedKey = `renders/${projectId}_rendered.webp`;
      const depthKey    = `depth/${projectId}_depth.png`;

      await this.uploadBase64ToR2(result.rendered_image_b64, renderedKey, 'image/webp');
      await this.uploadBase64ToR2(result.depth_map_b64, depthKey, 'image/png');

      const publicBase = env.CLOUDFLARE_R2_PUBLIC_DOMAIN.replace(/\/$/, '');
      renderedImageUrl = `${publicBase}/${renderedKey}`;
      depthMapUrl      = `${publicBase}/${depthKey}`;

      // ── Unit cost guardrail logging ─────────────────────────────────────
      const costUsd = result.compute_cost_usd ?? 0;
      if (costUsd > env.MODAL_COST_WARN_USD) {
        this.logger.warn(
          `[NFR-05] Compute cost guardrail exceeded: $${costUsd.toFixed(5)} > ` +
            `$${env.MODAL_COST_WARN_USD.toFixed(3)} cap. ` +
            `Timings: ${JSON.stringify(result.timings)}`,
        );
      } else {
        this.logger.log(
          `Modal pipeline completed — cost: $${costUsd.toFixed(4)}, ` +
            `faces_obfuscated: ${result.faces_obfuscated ?? 0}`,
        );
      }

      // ── SEGMENTATION + CATALOG_MATCHING SSE ────────────────────────────
      this.emitStage(projectId, 'SEGMENTATION', 80,
        PIPELINE_STAGES[3].message, now());
      this.emitStage(projectId, 'CATALOG_MATCHING', 90,
        PIPELINE_STAGES[4].message, now());

      // ── Hotspot matching with cumulative budget ceiling (FR-304) ────────
      const { hotspotsCount, totalCartCents } = await this.persistHotspots(
        projectId,
        result.hotspots ?? [],
        project.budgetCeilingCents ?? 150_000,
        lockedAnchorCategories,
      );

      // ── Persist final project state ─────────────────────────────────────
      await db
        .update(projects)
        .set({ status: 'COMPLETED', renderedImageUrl, depthMapUrl })
        .where(eq(projects.id, projectId));

      // ── Entitlement accounting ──────────────────────────────────────────
      await this.incrementEntitlement(userId, isPaidPass);

      // ── Terminal COMPLETED SSE event ────────────────────────────────────
      this.sseService.emitProgress({
        project_id: projectId,
        stage: 'COMPLETED',
        progress_pct: 100,
        message: 'Redesign rendering completed successfully.',
        timestamp: now(),
        rendered_image_url: renderedImageUrl,
        hotspots_count: hotspotsCount,
        total_cart_cents: totalCartCents,
      });

      return {
        status: 'COMPLETED',
        projectId,
        renderedImageUrl,
        hotspotsCount,
        totalCartCents,
        computeCostUsd: costUsd,
      };
    } catch (err: any) {
      this.logger.error(`Error in render pipeline: ${err.message}`, err.stack);
      await this.handleFailure(projectId, userId, isPaidPass, err.message, now);
      throw err;
    }
  }

  // ─── Live Modal GPU execution path ───────────────────────────────────────

  private async executeLiveModalPath(
    project: any,
    projectId: string,
    assetKey: string,
    now: () => string,
  ): Promise<ModalPipelineResult> {
    // Build the R2 public URL — Modal will fetch the image directly from R2
    const rawImageUrl = `${env.CLOUDFLARE_R2_PUBLIC_DOMAIN.replace(/\/$/, '')}/${assetKey}`;
    this.logger.debug(`Raw image R2 URL: ${rawImageUrl}`);

    // Emit pre-call SSE stages
    this.emitStage(projectId, 'SANITIZATION', 15, PIPELINE_STAGES[0].message, now());
    this.emitStage(projectId, 'DEPTH_ESTIMATION', 35, PIPELINE_STAGES[1].message, now());

    // Build JSON payload (matches modal_app.py render_endpoint contract)
    const payload = JSON.stringify({
      project_id: projectId,
      raw_image_url: rawImageUrl,
      style_preset: project.stylePreset ?? 'MODERN',
      room_function: project.roomFunction ?? 'LIVING_ROOM',
      budget_ceiling_cents: project.budgetCeilingCents ?? 150_000,
      locked_anchor_categories: project.lockedAnchorCategories ?? [],
    });

    this.logger.log(`Dispatching to Modal endpoint: ${env.MODAL_API_ENDPOINT}`);

    const modalResponse = await fetch(env.MODAL_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.MODAL_API_TOKEN}`,
      },
      body: payload,
      // NFR-01: allow up to 90s to tolerate Modal cold starts (~25s)
      signal: AbortSignal.timeout(90_000),
    });

    if (modalResponse.status === 401) {
      throw new Error('Modal endpoint rejected Bearer token — check MODAL_API_TOKEN secret.');
    }

    if (!modalResponse.ok) {
      const errText = await modalResponse.text().catch(() => '(unreadable body)');
      throw new Error(`Modal endpoint returned HTTP ${modalResponse.status}: ${errText}`);
    }

    const modalJson = (await modalResponse.json()) as { result: ModalPipelineResult };
    const result: ModalPipelineResult = modalJson.result ?? (modalJson as any);

    // Quality gate: IMAGE_QUALITY_FAILED → structured error → credit restitution
    if (result.status === 'FAILED') {
      throw Object.assign(
        new Error(
          `Modal pipeline failed [${result.error_code ?? 'UNKNOWN'}]: ` +
            `${result.message ?? 'No details'}`,
        ),
        { errorCode: result.error_code, modalFailed: true },
      );
    }

    // Emit inpainting progress after successful GPU call
    this.emitStage(
      projectId, 'INPAINTING', 65,
      `Synthesizing spatial architectural redesign conditioned on ${project.stylePreset}...`,
      now(),
    );

    return result;
  }

  // ─── Deterministic mock / CI simulation path ──────────────────────────────

  private async executeMockPath(
    project: any,
    projectId: string,
    lockedAnchorCategories: string[],
    now: () => string,
  ): Promise<ModalPipelineResult> {
    this.logger.warn(
      `[MockMode] MODAL_MOCK_MODE=true — running deterministic simulation for project ${projectId}`,
    );

    // Emit the same sequence of SSE stages as the live path
    this.emitStage(projectId, 'SANITIZATION', 15, PIPELINE_STAGES[0].message, now());
    this.emitStage(projectId, 'DEPTH_ESTIMATION', 35, PIPELINE_STAGES[1].message, now());
    this.emitStage(projectId, 'INPAINTING', 65,
      `Synthesizing spatial architectural redesign conditioned on ${project.stylePreset ?? 'MODERN'}...`,
      now());

    // Generate deterministic hotspots, excluding locked anchor categories (US-03)
    const candidateCategories = ['sofa', 'coffee_table', 'floor_lamp', 'rug'].filter(
      (cat) => !lockedAnchorCategories.includes(cat),
    );

    const mockHotspots: ModalPipelineResult['hotspots'] = candidateCategories
      .slice(0, 3)
      .map((category, idx) => ({
        category,
        norm_x: parseFloat((0.30 + idx * 0.20).toFixed(4)),
        norm_y: parseFloat((0.55 + idx * 0.05).toFixed(4)),
        crop_embedding: makeMockEmbedding(idx),
      }));

    // Try Qdrant vector search; fall back to in-stock PG catalog if unreachable
    const resolvedHotspots: typeof mockHotspots = [];
    for (const h of mockHotspots) {
      try {
        const candidates = await this.vectorRetrieval.findMatchingSkus({
          cropEmbedding: h.crop_embedding,
          category: h.category,
          maxPriceCents: project.budgetCeilingCents ?? 150_000,
          limit: 1,
        });
        if (candidates.length > 0) resolvedHotspots.push(h);
      } catch {
        // Qdrant unreachable in local dev — include hotspot anyway,
        // persistHotspots will fall back to PG catalog
        resolvedHotspots.push(h);
      }
    }

    return {
      status: 'COMPLETED',
      rendered_image_b64: undefined,
      depth_map_b64: undefined,
      hotspots: resolvedHotspots.length > 0 ? resolvedHotspots : mockHotspots,
      compute_cost_usd: 0,
      timings: { total_latency_ms: 0 },
      faces_obfuscated: 0,
    };
  }

  // ─── Hotspot persistence with cumulative budget ceiling (FR-304) ──────────

  private async persistHotspots(
    projectId: string,
    pipelineHotspots: NonNullable<ModalPipelineResult['hotspots']>,
    budgetCeilingCents: number,
    lockedAnchorCategories: string[],
  ): Promise<{ hotspotsCount: number; totalCartCents: number }> {
    let hotspotsCount = 0;
    let runningCartCents = 0;

    if (pipelineHotspots.length > 0) {
      for (const spot of pipelineHotspots) {
        // US-03: skip locked anchor categories — don't replace user-chosen items
        if (lockedAnchorCategories.includes(spot.category)) {
          this.logger.debug(
            `[US-03] Skipping locked anchor category "${spot.category}" for project ${projectId}`,
          );
          continue;
        }

        const remainingBudgetCents = budgetCeilingCents - runningCartCents;
        if (remainingBudgetCents <= 0) {
          this.logger.warn(`[FR-304] Budget ceiling reached for project ${projectId}. Stopping hotspot pinning.`);
          break;
        }

        try {
          const candidates = await this.vectorRetrieval.findMatchingSkus({
            cropEmbedding: spot.crop_embedding,
            category: spot.category,
            maxPriceCents: remainingBudgetCents,
            limit: 1,
          });

          const topCandidate = candidates[0];
          if (
            topCandidate &&
            runningCartCents + topCandidate.priceCents <= budgetCeilingCents
          ) {
            await db
              .insert(canvasHotspots)
              .values({
                projectId,
                matchedSkuId: topCandidate.skuId,
                category: spot.category,
                normX: String(spot.norm_x),
                normY: String(spot.norm_y),
                similarityScore: String(topCandidate.similarityScore),
              })
              .onConflictDoNothing();

            runningCartCents += topCandidate.priceCents;
            hotspotsCount++;
          }
        } catch (err: any) {
          this.logger.warn(
            `Vector retrieval failed for hotspot (${spot.category}): ${err.message}`,
          );
        }
      }
    } else {
      // Fallback: no hotspots from GPU — use top in-stock PG SKUs as placeholder pins
      this.logger.warn(
        `Modal returned 0 hotspots for project ${projectId}; using catalog fallback.`,
      );

      const fallbackSkus = await db
        .select()
        .from(catalogSkus)
        .where(eq(catalogSkus.inStock, true))
        .limit(2);

      const defaultPins = [
        { normX: '0.4500', normY: '0.6200', similarityScore: '0.0000' },
        { normX: '0.6800', normY: '0.5100', similarityScore: '0.0000' },
      ];

      for (let i = 0; i < fallbackSkus.length; i++) {
        const sku = fallbackSkus[i];
        const pin = defaultPins[i];
        if (!sku || !pin) break;

        if (runningCartCents + sku.priceCents > budgetCeilingCents) break;

        await db
          .insert(canvasHotspots)
          .values({
            projectId,
            matchedSkuId: sku.id,
            category: sku.category,
            normX: pin.normX,
            normY: pin.normY,
            similarityScore: pin.similarityScore,
          })
          .onConflictDoNothing();

        runningCartCents += sku.priceCents;
        hotspotsCount++;
      }
    }

    return { hotspotsCount, totalCartCents: runningCartCents };
  }

  // ─── Entitlement accounting ────────────────────────────────────────────────

  private async incrementEntitlement(userId: string | undefined, isPaidPass: boolean): Promise<void> {
    if (!userId) return;

    if (isPaidPass) {
      const pass = await db.query.movePasses.findFirst({
        where: and(eq(movePasses.userId, userId), eq(movePasses.isActive, true)),
      });
      if (pass) {
        await db
          .update(movePasses)
          .set({ generationsExecuted: pass.generationsExecuted + 1 })
          .where(eq(movePasses.id, pass.id));
      }
    } else {
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });
      if (dbUser) {
        await db
          .update(users)
          .set({ freeRendersUsed: dbUser.freeRendersUsed + 1 })
          .where(eq(users.id, userId));
      }
    }
  }

  // ─── Failure recovery & credit restitution (NFR-06) ───────────────────────

  private async handleFailure(
    projectId: string,
    userId: string | undefined,
    isPaidPass: boolean,
    errorMessage: string,
    now: () => string,
  ): Promise<void> {
    // Mark project FAILED
    await db
      .update(projects)
      .set({ status: 'FAILED' })
      .where(eq(projects.id, projectId));

    // Restore render credit (GREATEST prevents going below 0)
    if (userId) {
      if (isPaidPass) {
        await db
          .update(movePasses)
          .set({
            generationsExecuted: sql`GREATEST(0, ${movePasses.generationsExecuted} - 1)`,
          })
          .where(and(eq(movePasses.userId, userId), eq(movePasses.isActive, true)));
      } else {
        await db
          .update(users)
          .set({
            freeRendersUsed: sql`GREATEST(0, ${users.freeRendersUsed} - 1)`,
          })
          .where(eq(users.id, userId));
      }
    }

    // Emit error SSE event with creditsRestored flag
    this.sseService.emitProgress({
      project_id: projectId,
      stage: 'FAILED',
      progress_pct: 100,
      message: `Rendering pipeline failed: ${errorMessage}. Your credit has been restored.`,
      timestamp: now(),
      error: errorMessage,
      credits_restored: !!userId,
    });
  }

  // ─── SSE helper ──────────────────────────────────────────────────────────

  private emitStage(
    projectId: string,
    stage: Parameters<PipelineSseService['emitProgress']>[0]['stage'],
    pct: number,
    message: string,
    timestamp: string,
  ): void {
    this.sseService.emitProgress({ project_id: projectId, stage, progress_pct: pct, message, timestamp });
  }

  // ─── R2 upload helper ─────────────────────────────────────────────────────

  /**
   * Upload a base64-encoded image directly to R2 via the S3-compatible endpoint.
   * Skips silently when no data was returned (e.g. depth map in mock mode).
   */
  private async uploadBase64ToR2(
    b64: string | undefined,
    key: string,
    contentType: string,
  ): Promise<void> {
    if (!b64) {
      this.logger.warn(`Skipping R2 upload for key "${key}" — no data returned from Modal.`);
      return;
    }

    const buffer = Buffer.from(b64, 'base64');
    const endpoint = `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const s3 = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      },
    });

    const cmd = new PutObjectCommand({
      Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ContentLength: buffer.byteLength,
    });

    const signedUrl = await getSignedUrl(s3, cmd, { expiresIn: 120 });

    const putResponse = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: buffer,
    });

    if (!putResponse.ok) {
      throw new Error(
        `R2 upload failed for "${key}" — HTTP ${putResponse.status}: ` +
          `${await putResponse.text().catch(() => '')}`,
      );
    }

    this.logger.log(`Uploaded ${key} to R2 (${buffer.byteLength} bytes)`);
  }
}
