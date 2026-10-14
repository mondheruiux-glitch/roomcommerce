import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../src/modules/auth/auth.service.js';
import { EntitlementGuard } from '../../src/modules/auth/guards/entitlement.guard.js';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

// ── Mock DB ──────────────────────────────────────────────────────────────────
const mockFindFirstUser = vi.fn();
const mockFindFirstPass = vi.fn();
const mockInsertUser = vi.fn();

vi.mock('../../src/database/index.js', () => ({
  db: {
    query: {
      users: {
        findFirst: (...args: any[]) => mockFindFirstUser(...args),
      },
      movePasses: {
        findFirst: (...args: any[]) => mockFindFirstPass(...args),
      },
    },
    insert: () => ({
      values: () => ({
        returning: mockInsertUser,
      }),
    }),
  },
}));

describe('AuthService — Passwordless Magic Links & Entitlements', () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService();
  });

  it('generates a 15-minute magic link token for existing user', async () => {
    mockFindFirstUser.mockResolvedValueOnce({
      id: 'user-uuid-1',
      email: 'test@example.com',
      freeRendersUsed: 0,
    });

    const result = await authService.sendMagicLink('TEST@example.com');
    expect(result.success).toBe(true);
    expect(result.magicLinkUrl).toBeDefined();
    expect(result.magicLinkUrl).toContain('/auth/verify?token=');
  });

  it('creates a new user and generates magic link when email is not found', async () => {
    mockFindFirstUser.mockResolvedValueOnce(null);
    mockInsertUser.mockResolvedValueOnce([
      { id: 'new-user-uuid', email: 'new@example.com', freeRendersUsed: 0 },
    ]);

    const result = await authService.sendMagicLink('new@example.com');
    expect(result.success).toBe(true);
    expect(result.magicLinkUrl).toBeDefined();
  });

  it('verifies valid magic link token and issues 7-day session token', async () => {
    mockFindFirstUser.mockResolvedValueOnce({
      id: 'user-uuid-1',
      email: 'verified@example.com',
      freeRendersUsed: 1,
    });

    const sendRes = await authService.sendMagicLink('verified@example.com');
    const token = sendRes.magicLinkUrl!.split('token=')[1];

    mockFindFirstUser.mockResolvedValueOnce({
      id: 'user-uuid-1',
      email: 'verified@example.com',
      freeRendersUsed: 1,
    });

    const verifyRes = await authService.verifyMagicLink(token);
    expect(verifyRes.sessionToken).toBeDefined();
    expect(verifyRes.user.email).toBe('verified@example.com');
  });

  it('returns profile with free renders remaining and active pass details', async () => {
    mockFindFirstUser.mockResolvedValueOnce({
      id: 'user-uuid-1',
      email: 'member@example.com',
      freeRendersUsed: 1,
    });
    mockFindFirstPass.mockResolvedValueOnce({
      id: 'pass-uuid-1',
      expiresAt: new Date(Date.now() + 86400000),
      generationsExecuted: 12,
      isActive: true,
    });

    const profile = await authService.getUserProfile('user-uuid-1');
    expect(profile.has_active_pass).toBe(true);
    expect(profile.active_pass?.generations_remaining).toBe(48);
    expect(profile.free_renders_remaining).toBe(1);
  });
});

describe('EntitlementGuard — Fair Use & Quota Boundaries', () => {
  let guard: EntitlementGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new EntitlementGuard();
  });

  function createMockContext(request: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('permits first trial generation for anonymous guest', async () => {
    const req: any = { cookies: { prc_guest_render_count: '0' } };
    const canActivate = await guard.canActivate(createMockContext(req));
    expect(canActivate).toBe(true);
    expect(req.entitlement.tier).toBe('FREE_TIER');
    expect(req.entitlement.isGuest).toBe(true);
  });

  it('throws ForbiddenException when anonymous guest has already used trial', async () => {
    const req: any = { cookies: { prc_guest_render_count: '1' } };
    await expect(guard.canActivate(createMockContext(req))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('permits free tier user with 0 or 1 renders used', async () => {
    mockFindFirstPass.mockResolvedValueOnce(null);
    mockFindFirstUser.mockResolvedValueOnce({ id: 'u1', freeRendersUsed: 1 });

    const req: any = { user: { id: 'u1', email: 'user@test.com' } };
    const canActivate = await guard.canActivate(createMockContext(req));
    expect(canActivate).toBe(true);
    expect(req.entitlement.tier).toBe('FREE_TIER');
  });

  it('rejects free tier user who has reached 2 free renders limit', async () => {
    mockFindFirstPass.mockResolvedValueOnce(null);
    mockFindFirstUser.mockResolvedValueOnce({ id: 'u1', freeRendersUsed: 2 });

    const req: any = { user: { id: 'u1', email: 'user@test.com' } };
    await expect(guard.canActivate(createMockContext(req))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('permits Move-In Pass holder with under 60 generations', async () => {
    mockFindFirstPass.mockResolvedValueOnce({
      id: 'pass-1',
      userId: 'u2',
      isActive: true,
      generationsExecuted: 59,
    });

    const req: any = { user: { id: 'u2', email: 'pass@test.com' } };
    const canActivate = await guard.canActivate(createMockContext(req));
    expect(canActivate).toBe(true);
    expect(req.entitlement.tier).toBe('MOVE_IN_PASS');
  });

  it('rejects Move-In Pass holder who has hit fair-use cap of 60 renders', async () => {
    mockFindFirstPass.mockResolvedValueOnce({
      id: 'pass-1',
      userId: 'u2',
      isActive: true,
      generationsExecuted: 60,
    });

    const req: any = { user: { id: 'u2', email: 'pass@test.com' } };
    await expect(guard.canActivate(createMockContext(req))).rejects.toThrow(
      ForbiddenException,
    );
  });
});
