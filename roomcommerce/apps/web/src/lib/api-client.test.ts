import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiFetch,
  setAuthToken,
  getAuthToken,
  createProject,
  triggerRender,
  fetchProject,
  verifyMagicLink,
  logout,
} from './api-client';

describe('api-client', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setAuthToken(null);
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('includes credentials: "include" and Content-Type: application/json by default', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    await apiFetch('/api/v1/test');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/test'),
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });

  it('forwards Authorization: Bearer <token> when authToken is set', async () => {
    setAuthToken('jwt-session-xyz');
    expect(getAuthToken()).toBe('jwt-session-xyz');

    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authenticated: true }),
    });

    await apiFetch('/api/v1/auth/me');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/me'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt-session-xyz',
        }),
      }),
    );
  });

  it('throws descriptive error on non-2xx responses using error envelope', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: { message: 'Budget out of bounds ($300-$10,000)' } }),
    });

    await expect(apiFetch('/api/v1/projects')).rejects.toThrow(
      'API 400: Budget out of bounds ($300-$10,000)',
    );
  });

  it('createProject handles snake_case, camelCase, and data envelope formats', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        project_id: 'proj-001',
        upload_url: 'https://r2.example.com/upload-001',
      }),
    });

    const res = await createProject();
    expect(res.projectId).toBe('proj-001');
    expect(res.uploadUrl).toBe('https://r2.example.com/upload-001');
  });

  it('triggerRender passes lockedAnchorCategories and locked_anchor_categories in request body', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          jobId: 'job-locked-01',
        },
      }),
    });

    const res = await triggerRender('proj-123', {
      stylePreset: 'JAPANDI',
      roomFunction: 'LIVING_ROOM',
      budgetCents: 120_000,
      lockedAnchorCategories: ['sofa', 'rug'],
    });

    expect(res.jobId).toBe('job-locked-01');

    const callArgs = (globalThis.fetch as any).mock.calls[0];
    const sentBody = JSON.parse(callArgs[1].body);

    expect(sentBody.lockedAnchorCategories).toEqual(['sofa', 'rug']);
    expect(sentBody.locked_anchor_categories).toEqual(['sofa', 'rug']);
    expect(sentBody.budget_ceiling_cents).toBe(120_000);
    expect(sentBody.style_preset).toBe('JAPANDI');
  });

  it('fetchProject normalizes renderUrl and hotspot coordinates', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'proj-456',
        rendered_image_url: 'https://r2.example.com/render-456.webp',
        status: 'COMPLETE',
        is_free_user: true,
        hotspots: [
          {
            id: 'spot-1',
            norm_x: '0.4500',
            norm_y: '0.6200',
            category: 'sofa',
            price_cents: 89900,
            matched_sku_id: 'sku-sofa-1',
          },
        ],
      }),
    });

    const proj = await fetchProject('proj-456');
    expect(proj.id).toBe('proj-456');
    expect(proj.renderUrl).toBe('https://r2.example.com/render-456.webp');
    expect(proj.isFreeUser).toBe(true);
    expect(proj.hotspots[0]!.normX).toBe(0.45);
    expect(proj.hotspots[0]!.normY).toBe(0.62);
    expect(proj.hotspots[0]!.productId).toBe('sku-sofa-1');
  });

  it('verifyMagicLink sets auth token and logout clears it', async () => {
    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session_token: 'new-magic-token',
        user: { id: 'u1', email: 'test@example.com' },
      }),
    });

    const verifyRes = await verifyMagicLink('token-abc');
    expect(verifyRes.session_token).toBe('new-magic-token');
    expect(getAuthToken()).toBe('new-magic-token');

    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    await logout();
    expect(getAuthToken()).toBeNull();
  });
});
