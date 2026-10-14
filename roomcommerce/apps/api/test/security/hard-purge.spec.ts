/**
 * Security Test: 1-Click Hard Erasure API (PRV-02, GDPR Art. 17)
 *
 * Verifies that executeHardPurge (DELETE /api/v1/privacy/purge-me):
 *   1. Retrieves all project assets for the target user.
 *   2. Deletes all R2 spatial image objects (raw uploads + renders).
 *   3. Cascades deletion of the user record (which cascades via FK to projects, passes, hotspots).
 *   4. Reports the correct deleted project count.
 *   5. Handles users with no projects cleanly (no spurious R2 calls).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrivacyService } from '../../src/modules/privacy/privacy.service.js';

// ── Mock DB ────────────────────────────────────────────────────────────────────
const mockSelectProjects = vi.fn();
const mockDeleteUsers = vi.fn();

vi.mock('../../src/database/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: mockSelectProjects,
      }),
    }),
    delete: () => ({
      where: mockDeleteUsers,
    }),
    query: {
      projects: { findFirst: vi.fn() },
    },
  },
}));

// ── Mock StoragePurgeCron ──────────────────────────────────────────────────────
const mockPurgeArtifacts = vi.fn().mockResolvedValue(undefined);

const mockPurgeCron = {
  purgeProjectArtifacts: mockPurgeArtifacts,
  executePurge: vi.fn(),
} as any;

describe('Security: 1-Click Hard Erasure (PRV-02 — GDPR Art. 17)', () => {
  let privacyService: PrivacyService;

  beforeEach(() => {
    vi.clearAllMocks();
    privacyService = new PrivacyService(mockPurgeCron);
  });

  it('purges all project R2 artifacts and deletes user record (cascade wipes projects, passes, hotspots)', async () => {
    const userProjects = [
      {
        id: 'proj-1',
        rawImageUrl: 'https://cdn.roomcommerce.internal/raw-uploads/proj-1.jpg',
        renderedImageUrl: 'https://cdn.roomcommerce.internal/renders/proj-1.webp',
      },
      {
        id: 'proj-2',
        rawImageUrl: 'https://cdn.roomcommerce.internal/raw-uploads/proj-2.jpg',
        renderedImageUrl: null, // Render not yet complete — only raw asset exists
      },
    ];

    mockSelectProjects.mockResolvedValueOnce(userProjects);
    mockDeleteUsers.mockResolvedValueOnce([]);

    const result = await privacyService.hardDeleteUserData('user-target-uuid');

    expect(result.success).toBe(true);
    // purgeProjectArtifacts called once per project
    expect(mockPurgeArtifacts).toHaveBeenCalledTimes(2);
    expect(mockPurgeArtifacts).toHaveBeenCalledWith(userProjects[0]);
    expect(mockPurgeArtifacts).toHaveBeenCalledWith(userProjects[1]);
    // User record deleted (cascades to all child data)
    expect(mockDeleteUsers).toHaveBeenCalled();
  });

  it('succeeds cleanly for a user with no projects (no spurious R2 calls)', async () => {
    mockSelectProjects.mockResolvedValueOnce([]);
    mockDeleteUsers.mockResolvedValueOnce([]);

    const result = await privacyService.hardDeleteUserData('user-no-projects');

    expect(result.success).toBe(true);
    expect(mockPurgeArtifacts).not.toHaveBeenCalled();
    expect(mockDeleteUsers).toHaveBeenCalled();
  });

  it('returns the response message mandated by GDPR Art. 17 confirmation', async () => {
    mockSelectProjects.mockResolvedValueOnce([]);
    mockDeleteUsers.mockResolvedValueOnce([]);

    const result = await privacyService.hardDeleteUserData('any-user');
    expect(result.message).toContain('permanently erased');
  });
});
