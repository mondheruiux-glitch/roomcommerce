import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PipelineSseService } from './sse/pipeline-sse.service.js';

@Injectable()
export class InferenceService {
  private readonly logger = new Logger(InferenceService.name);

  constructor(
    @InjectQueue('inference-jobs') private readonly queue: Queue,
    private readonly sseService: PipelineSseService,
  ) {}

  async enqueueRenderJob(
    projectId: string,
    assetKey: string,
    isPaidPass: boolean,
    userId?: string,
    lockedAnchorCategories: string[] = [],
  ) {
    this.logger.log(
      `Enqueuing render job for project ${projectId} (isPaidPass: ${isPaidPass}, lockedAnchors: [${lockedAnchorCategories.join(', ')}])`,
    );

    // Initial QUEUED event on SSE stream
    this.sseService.emitProgress({
      project_id: projectId,
      stage: 'QUEUED',
      progress_pct: 0,
      message: isPaidPass
        ? 'High-priority GPU slot assigned (Move-In Pass).'
        : 'Assigned to standard generation queue.',
      timestamp: new Date().toISOString(),
    });

    const job = await this.queue.add(
      'render-room',
      { projectId, assetKey, userId, isPaidPass, lockedAnchorCategories },
      {
        priority: isPaidPass ? 1 : 10, // Priority 1 executes ahead of free users (10)
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
      },
    );

    return {
      job_id: job.id,
      status: 'QUEUED',
      estimated_duration_seconds: isPaidPass ? 8 : 14,
      telemetry_stream_url: `/api/v1/projects/${projectId}/events`,
    };
  }
}
