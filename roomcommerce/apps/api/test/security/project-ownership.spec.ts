/**
 * Security Test: BOLA / IDOR — Project Ownership Guard (SEC-01)
 *
 * Verifies that the ProjectOwnershipGuard:
 *   1. Returns HTTP 404 (not 403) for projects belonging to another user.
 *   2. Returns HTTP 404 for non-existent project UUIDs.
 *   3. Allows access when the JWT user ID matches the project's userId.
 *   4. Allows access when the guest session cookie matches the project's guestSessionId.
 *   5. Obscures project existence — identical 404 response body for unauthorized vs. non-existent.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectOwnershipGuard } from '../../src/modules/projects/guards/project-ownership.guard.js';
import { NotFoundException } from '@nestjs/common';

// ── Mock Drizzle DB ────────────────────────────────────────────────────────────
const mockFindFirst = vi.fn();

vi.mock('../../src/database/index.js', () => ({
  db: {
    query: {
      projects: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
      },
    },
  },
}));

function mockExecutionContext(params: Record<string, string>, user?: { id: string }, cookies?: Record<string, string>) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        params,
        user,
        cookies: cookies ?? {},
        project: undefined,
      }),
    }),
  } as any;
}

describe('Security: ProjectOwnershipGuard — BOLA/IDOR Defense (SEC-01)', () => {
  let guard: ProjectOwnershipGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new ProjectOwnershipGuard();
  });

  it('returns true and attaches project when authenticated user owns the project', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'proj-uuid-1',
      userId: 'user-abc',
      guestSessionId: null,
    });

    const ctx = mockExecutionContext({ id: 'proj-uuid-1' }, { id: 'user-abc' });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('throws NotFoundException — not ForbiddenException — when user does not own the project (no metadata leakage)', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'proj-uuid-2',
      userId: 'user-other',
      guestSessionId: null,
    });

    const ctx = mockExecutionContext({ id: 'proj-uuid-2' }, { id: 'user-attacker' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException with PROJECT_NOT_FOUND code for non-existent project (enumeration prevention)', async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    const ctx = mockExecutionContext({ id: 'non-existent-uuid' }, { id: 'user-any' });
    try {
      await guard.canActivate(ctx);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundException);
      const response = (err as NotFoundException).getResponse() as Record<string, string>;
      expect(response['code']).toBe('PROJECT_NOT_FOUND');
    }
  });

  it('CRITICAL: 404 response body is identical for "not found" vs "unauthorized" (no information leakage)', async () => {
    // not-found case
    mockFindFirst.mockResolvedValueOnce(null);
    const notFoundResponse = await guard
      .canActivate(mockExecutionContext({ id: 'no-proj' }, { id: 'user-1' }))
      .catch((e: NotFoundException) => e.getResponse());

    // unauthorized case
    mockFindFirst.mockResolvedValueOnce({
      id: 'proj-other',
      userId: 'user-other',
      guestSessionId: null,
    });
    const unauthorizedResponse = await guard
      .canActivate(mockExecutionContext({ id: 'proj-other' }, { id: 'user-attacker' }))
      .catch((e: NotFoundException) => e.getResponse());

    // Both responses must be identical — no way to distinguish not-found from unauthorized
    expect(notFoundResponse).toEqual(unauthorizedResponse);
  });

  it('grants access when prc_guest_session cookie matches project guestSessionId', async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: 'proj-guest-1',
      userId: null,
      guestSessionId: 'guest-session-xyz',
    });

    const ctx = mockExecutionContext(
      { id: 'proj-guest-1' },
      undefined,
      { prc_guest_session: 'guest-session-xyz' },
    );
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('bypasses guard when no project id param is present (collection routes)', async () => {
    const ctx = mockExecutionContext({}, { id: 'user-abc' });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });
});
