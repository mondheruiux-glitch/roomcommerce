import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePipelineStream } from './use-pipeline-stream';
import * as apiClient from '@/lib/api-client';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  opts?: any;
  listeners: Record<string, ((e: any) => void)[]> = {};
  onmessage: ((e: any) => void) | null = null;
  closed = false;

  constructor(url: string, opts?: any) {
    this.url = url;
    this.opts = opts;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, cb: (e: any) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  removeEventListener(event: string, cb: (e: any) => void) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((fn) => fn !== cb);
    }
  }

  emit(event: string, data: any) {
    const e = { data: typeof data === 'string' ? data : JSON.stringify(data) };
    if (event === 'message' && this.onmessage) {
      this.onmessage(e);
    }
    const cbs = this.listeners[event] || [];
    cbs.forEach((cb) => cb(e));
  }

  close() {
    this.closed = true;
  }
}

describe('usePipelineStream', () => {
  const originalEventSource = globalThis.EventSource;

  beforeEach(() => {
    mockPush.mockReset();
    MockEventSource.instances = [];
    (globalThis as any).EventSource = MockEventSource as any;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    (globalThis as any).EventSource = originalEventSource;
    vi.restoreAllMocks();
  });

  it('connects to EventSource with withCredentials: true and sets initial QUEUED progress', () => {
    const { result } = renderHook(() => usePipelineStream('proj-stream-1'));

    expect(result.current.progress.phase).toBe('QUEUED');
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]!.url).toContain('/api/v1/projects/proj-stream-1/events');
    expect(MockEventSource.instances[0]!.opts).toEqual({ withCredentials: true });
  });

  it('updates progress state on progress event', () => {
    const { result } = renderHook(() => usePipelineStream('proj-stream-1'));
    const es = MockEventSource.instances[0]!;

    act(() => {
      es.emit('progress', {
        stage: 'INPAINTING',
        progress_pct: 65,
        message: 'Synthesizing spatial redesign...',
        project_id: 'proj-stream-1',
      });
    });

    expect(result.current.progress.phase).toBe('INPAINTING');
    expect(result.current.progress.percent).toBe(65);
    expect(result.current.progress.message).toBe('Synthesizing spatial redesign...');
  });

  it('handles FAILED stage and sets credit restitution error message', () => {
    const { result } = renderHook(() => usePipelineStream('proj-fail-1'));
    const es = MockEventSource.instances[0]!;

    act(() => {
      es.emit('progress', {
        stage: 'FAILED',
        progress_pct: 0,
        message: 'GPU timeout',
        credits_restored: true,
        project_id: 'proj-fail-1',
      });
    });

    expect(result.current.error).toBe(
      'Generation interrupted. Your render credits have been automatically restored.',
    );
    expect(result.current.progress.phase).toBe('FAILED');
    expect(es.closed).toBe(true);
  });

  it('redirects to /studio/view/:id when receiving complete event', () => {
    const { result } = renderHook(() => usePipelineStream('proj-done-1'));
    const es = MockEventSource.instances[0]!;

    act(() => {
      es.emit('complete', { projectId: 'proj-done-1' });
    });

    expect(result.current.isComplete).toBe(true);
    expect(mockPush).toHaveBeenCalledWith('/studio/view/proj-done-1');
    expect(es.closed).toBe(true);
  });

  it('HTTP polling fallback checks project status and redirects when status is COMPLETED', async () => {
    vi.spyOn(apiClient, 'fetchProject').mockResolvedValue({
      id: 'proj-poll-1',
      renderUrl: 'https://r2.example.com/render.webp',
      status: 'COMPLETED',
      isFreeUser: false,
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
      hotspots: [],
    });

    renderHook(() => usePipelineStream('proj-poll-1'));
    const es = MockEventSource.instances[0]!;

    // Fast-forward polling timer by 3000ms
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(apiClient.fetchProject).toHaveBeenCalledWith('proj-poll-1');
    expect(mockPush).toHaveBeenCalledWith('/studio/view/proj-poll-1');
    expect(es.closed).toBe(true);
  });
});
