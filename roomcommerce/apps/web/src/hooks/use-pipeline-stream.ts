'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { fetchProject, getApiBaseUrl } from '@/lib/api-client';

export type PipelinePhase =
  | 'QUEUED'
  | 'SANITIZATION'
  | 'DEPTH_ESTIMATION'
  | 'INPAINTING'
  | 'SEGMENTATION'
  | 'CATALOG_MATCHING'
  | 'COMPLETED'
  | 'COMPLETE'
  | 'FAILED';

export interface PipelineProgress {
  phase: PipelinePhase;
  percent: number;
  message: string;
  projectId: string;
  creditsRestored?: boolean;
}

export interface UsePipelineStreamResult {
  progress: PipelineProgress;
  error: string | null;
  isComplete: boolean;
  retry: () => void;
}

export const PHASE_COPY: Record<PipelinePhase, string> = {
  QUEUED: 'Queued for rendering…',
  SANITIZATION: 'Scrubbing EXIF & blurring faces (privacy)…',
  DEPTH_ESTIMATION: 'Analyzing spatial room perspective…',
  INPAINTING: 'Generating photorealistic redesign…',
  SEGMENTATION: 'Segmenting architectural & furniture assets…',
  CATALOG_MATCHING: 'Matching verified in-stock products…',
  COMPLETED: 'Render complete! Redirecting…',
  COMPLETE: 'Render complete! Redirecting…',
  FAILED: 'Generation interrupted.',
};

/**
 * usePipelineStream — resilient Server-Sent Events consumer with HTTP polling fallback.
 * Consumes progress events from /api/v1/projects/:id/events, polls fetchProject every 3s
 * for resilience against stalls or disconnection, and handles credit restitution error states.
 *
 * Requirements: EV-101–EV-302, NFR-06, Wave 3/4 SSE Parity
 */
export function usePipelineStream(projectIdOrJobId: string | null): UsePipelineStreamResult {
  const router = useRouter();

  const [progress, setProgress] = useState<PipelineProgress>({
    phase: 'QUEUED',
    percent: 0,
    message: PHASE_COPY.QUEUED,
    projectId: projectIdOrJobId ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const resolvedProjectIdRef = useRef<string>(projectIdOrJobId ?? '');

  const retry = useCallback(() => {
    setError(null);
    setIsComplete(false);
    setRetryCount((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!projectIdOrJobId) return;

    let isDisposed = false;
    const apiBase = getApiBaseUrl();
    const resolvedId = resolvedProjectIdRef.current || projectIdOrJobId;

    const eventSource = new EventSource(
      `${apiBase}/api/v1/projects/${resolvedId}/events`,
      { withCredentials: true },
    );

    const finishSuccess = (targetProjectId: string) => {
      if (isDisposed) return;
      setIsComplete(true);
      eventSource.close();
      router.push(`/studio/view/${targetProjectId}`);
    };

    const handlePayload = (raw: any) => {
      if (!raw || typeof raw !== 'object') return;

      const phaseRaw = (raw.stage ?? raw.phase ?? 'QUEUED') as PipelinePhase;
      const targetId = raw.project_id ?? raw.projectId ?? resolvedId;
      if (targetId) resolvedProjectIdRef.current = targetId;

      const percent =
        typeof raw.progress_pct === 'number'
          ? raw.progress_pct
          : typeof raw.percent === 'number'
            ? raw.percent
            : 0;

      const creditsRestored = Boolean(raw.credits_restored ?? raw.creditsRestored);

      if (phaseRaw === 'FAILED') {
        const errorMsg = creditsRestored
          ? 'Generation interrupted. Your render credits have been automatically restored.'
          : raw.message || 'Generation failed. Please try again.';
        setError(errorMsg);
        setProgress((prev) => ({
          ...prev,
          phase: 'FAILED',
          message: errorMsg,
          creditsRestored,
        }));
        eventSource.close();
        return;
      }

      if (phaseRaw === 'COMPLETED' || phaseRaw === 'COMPLETE') {
        setProgress({
          phase: 'COMPLETED',
          percent: 100,
          message: PHASE_COPY.COMPLETED,
          projectId: targetId,
        });
        finishSuccess(targetId);
        return;
      }

      setProgress({
        phase: phaseRaw,
        percent,
        message: raw.message || PHASE_COPY[phaseRaw] || '',
        projectId: targetId,
        creditsRestored,
      });
    };

    const handleMessageEvent = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        handlePayload(data);
      } catch {
        // Silently ignore non-JSON SSE messages
      }
    };

    const handleProgressNamed = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        handlePayload(data);
      } catch {
        // Silently ignore non-JSON progress events
      }
    };

    const handleCompleteNamed = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const targetId = data.projectId ?? data.project_id ?? resolvedProjectIdRef.current ?? resolvedId;
        finishSuccess(targetId);
      } catch {
        finishSuccess(resolvedProjectIdRef.current || resolvedId);
      }
    };

    const handleErrorEvent = () => {
      // SSE connection error: don't immediately fail; HTTP polling fallback continues
      console.warn(`[usePipelineStream] SSE disconnected for ${resolvedId}; falling back to HTTP polling.`);
    };

    eventSource.onmessage = handleMessageEvent;
    eventSource.addEventListener('progress', handleProgressNamed);
    eventSource.addEventListener('complete', handleCompleteNamed);
    eventSource.addEventListener('error', handleErrorEvent);

    // ── HTTP Polling Fallback (every 3 seconds) ──────────────────────────────
    const pollInterval = setInterval(async () => {
      if (isDisposed) return;
      const targetId = resolvedProjectIdRef.current || resolvedId;
      try {
        const proj = await fetchProject(targetId);
        if (proj) {
          if (proj.status === 'COMPLETED' || proj.status === 'COMPLETE') {
            finishSuccess(targetId);
          } else if (proj.status === 'FAILED') {
            setError('Generation interrupted. Your render credits have been automatically restored.');
            eventSource.close();
            clearInterval(pollInterval);
          }
        }
      } catch {
        // Polling error: tolerate intermittent network failures
      }
    }, 3000);

    return () => {
      isDisposed = true;
      clearInterval(pollInterval);
      eventSource.removeEventListener('progress', handleProgressNamed);
      eventSource.removeEventListener('complete', handleCompleteNamed);
      eventSource.removeEventListener('error', handleErrorEvent);
      eventSource.close();
    };
  }, [projectIdOrJobId, router, retryCount]);

  return { progress, error, isComplete, retry };
}
