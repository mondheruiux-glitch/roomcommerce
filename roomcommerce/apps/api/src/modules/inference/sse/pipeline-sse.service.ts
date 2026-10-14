import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

export interface TelemetryProgressEvent {
  project_id: string;
  stage:
    | 'QUEUED'
    | 'SANITIZATION'
    | 'DEPTH_ESTIMATION'
    | 'INPAINTING'
    | 'SEGMENTATION'
    | 'CATALOG_MATCHING'
    | 'COMPLETED'
    | 'FAILED';
  progress_pct: number;
  message: string;
  timestamp: string;
  rendered_image_url?: string;
  hotspots_count?: number;
  total_cart_cents?: number;
  credits_restored?: boolean;
  error?: string;
}

@Injectable()
export class PipelineSseService {
  private readonly logger = new Logger(PipelineSseService.name);
  private readonly events$ = new Subject<TelemetryProgressEvent>();

  emitProgress(event: TelemetryProgressEvent): void {
    this.logger.debug(`[SSE] Project ${event.project_id} -> ${event.stage} (${event.progress_pct}%)`);
    this.events$.next(event);
  }

  subscribeToProject(projectId: string): Observable<TelemetryProgressEvent> {
    return this.events$.asObservable().pipe(
      filter((event) => event.project_id === projectId),
    );
  }
}
