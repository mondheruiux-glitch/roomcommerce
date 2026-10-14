import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StoragePurgeCron } from '../../src/modules/privacy/cron/storage-purge.cron.js';
import { PrivacyService } from '../../src/modules/privacy/privacy.service.js';
import { R2StorageService } from '../../src/modules/projects/storage/r2-storage.service.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

// ── Mock DB ──────────────────────────────────────────────────────────────────
const mockSelectProjects = vi.fn();
const mockDeleteProjects = vi.fn();
const mockDeleteUsers = vi.fn();
const mockFindFirstProject = vi.fn();

vi.mock('../../src/database/index.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: mockSelectProjects,
      }),
    }),
    delete: (table: any) => ({
      where: (...args: any[]) => {
        if (table._?.name === 'users') {
          return mockDeleteUsers(...args);
        }
        return mockDeleteProjects(...args);
      },
    }),
    query: {
      projects: {
        findFirst: (...args: any[]) => mockFindFirstProject(...args),
      },
    },
  },
}));

describe('PrivacyModule — Ephemeral 7-Day Purge Daemon & 1-Click Hard Delete (SEC-01, PRV-01, PRV-02)', () => {
  let purgeCron: StoragePurgeCron;
  let privacyService: PrivacyService;
  let mockR2Storage: R2StorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockR2Storage = {
      deleteArtifact: vi.fn().mockResolvedValue(undefined),
    } as unknown as R2StorageService;

    purgeCron = new StoragePurgeCron(mockR2Storage);
    privacyService = new PrivacyService(purgeCron);
  });

  it('runs daily purge daemon deleting R2 assets and database rows for expired projects', async () => {
    const expiredMock = [
      {
        id: 'proj-expired-1',
        rawImageUrl: 'https://cdn.roomcommerce.internal/raw-uploads/proj-expired-1.jpg',
        renderedImageUrl: 'https://cdn.roomcommerce.internal/renders/proj-expired-1_rendered.webp',
        depthMapUrl: null,
      },
    ];

    mockSelectProjects.mockResolvedValueOnce(expiredMock);
    mockDeleteProjects.mockResolvedValueOnce([]);

    const count = await purgeCron.executePurge();
    expect(count).toBe(1);
    expect(mockR2Storage.deleteArtifact).toHaveBeenCalledWith('raw-uploads/proj-expired-1.jpg');
    expect(mockR2Storage.deleteArtifact).toHaveBeenCalledWith('renders/proj-expired-1_rendered.webp');
    expect(mockDeleteProjects).toHaveBeenCalled();
  });

  it('executes 1-click hard deletion of user project on request (PRV-02)', async () => {
    mockFindFirstProject.mockResolvedValueOnce({
      id: 'proj-user-1',
      userId: 'user-123',
      rawImageUrl: 'https://cdn.roomcommerce.internal/raw-uploads/proj-user-1.jpg',
      renderedImageUrl: 'https://cdn.roomcommerce.internal/renders/proj-user-1.webp',
    });
    mockDeleteProjects.mockResolvedValueOnce([]);

    const res = await privacyService.hardDeleteProject('proj-user-1', 'user-123');
    expect(res.success).toBe(true);
    expect(mockR2Storage.deleteArtifact).toHaveBeenCalledTimes(2);
    expect(mockDeleteProjects).toHaveBeenCalled();
  });

  it('prevents user from deleting project owned by another user', async () => {
    mockFindFirstProject.mockResolvedValueOnce({
      id: 'proj-user-1',
      userId: 'user-other',
    });

    await expect(
      privacyService.hardDeleteProject('proj-user-1', 'user-123'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when hard deleting non-existent project', async () => {
    mockFindFirstProject.mockResolvedValueOnce(null);

    await expect(
      privacyService.hardDeleteProject('missing-id'),
    ).rejects.toThrow(NotFoundException);
  });
});
