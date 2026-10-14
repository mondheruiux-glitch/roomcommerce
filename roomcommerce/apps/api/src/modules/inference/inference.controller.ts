import {
  Controller,
  Post,
  Param,
  Body,
  Req,
  Sse,
  UseGuards,
  MessageEvent,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { InferenceService } from './inference.service.js';
import { PipelineSseService } from './sse/pipeline-sse.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { EntitlementGuard } from '../auth/guards/entitlement.guard.js';

@Controller('api/v1/projects')
export class InferenceController {
  constructor(
    private readonly inferenceService: InferenceService,
    private readonly sseService: PipelineSseService,
  ) {}

  @Post(':id/render')
  @UseGuards(JwtAuthGuard, EntitlementGuard)
  async startRender(
    @Param('id') projectId: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const isPaidPass = req.entitlement?.tier === 'MOVE_IN_PASS';
    const key = body?.asset_key || body?.assetKey || `raw-uploads/${projectId}.jpg`;
    const lockedAnchorCategories =
      body?.locked_anchor_categories || body?.lockedAnchorCategories || [];

    return this.inferenceService.enqueueRenderJob(
      projectId,
      key,
      isPaidPass,
      req.user?.id,
      lockedAnchorCategories,
    );
  }

  @Sse(':id/events')
  streamProjectEvents(@Param('id') projectId: string): Observable<MessageEvent> {
    return this.sseService.subscribeToProject(projectId).pipe(
      map(
        (eventData) =>
          ({
            data: JSON.stringify(eventData),
          }) as MessageEvent,
      ),
    );
  }
}
