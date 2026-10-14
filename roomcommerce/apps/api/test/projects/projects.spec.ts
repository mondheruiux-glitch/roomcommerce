import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectsService } from '../../src/modules/projects/projects.service.js';
import { R2StorageService } from '../../src/modules/projects/storage/r2-storage.service.js';
import { NotFoundException } from '@nestjs/common';
import { StylePresetEnum, RoomFunctionEnum } from '@roomcommerce/contracts';

// ── Mock DB ──────────────────────────────────────────────────────────────────
const mockInsertProject = vi.fn();
const mockUpdateProject = vi.fn();
const mockFindFirstProject = vi.fn();
const mockSelectHotspots = vi.fn();

vi.mock('../../src/database/index.js', () => ({
  db: {
    insert: () => ({
      values: () => ({
        returning: mockInsertProject,
      }),
    }),
    update: () => ({
      set: () => ({
        where: mockUpdateProject,
      }),
    }),
    query: {
      projects: {
        findFirst: (...args: any[]) => mockFindFirstProject(...args),
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            orderBy: mockSelectHotspots,
          }),
        }),
      }),
    }),
  },
}));

describe('ProjectsService — Intake & R2 Presigned Uploads (FR-101)', () => {
  let service: ProjectsService;
  let mockR2Storage: R2StorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockR2Storage = {
      createPresignedUploadUrl: vi.fn().mockResolvedValue({
        uploadUrl: 'https://r2.cloudflarestorage.com/signed-put-url?expires=300',
        key: 'raw-uploads/proj-123.jpg',
      }),
      deleteArtifact: vi.fn().mockResolvedValue(undefined),
      getPublicUrl: (key: string) => `https://cdn.roomcommerce.internal/${key}`,
    } as unknown as R2StorageService;

    service = new ProjectsService(mockR2Storage);
  });

  it('creates project and returns 300s presigned PUT upload URL', async () => {
    mockInsertProject.mockResolvedValueOnce([
      {
        id: 'proj-123',
        stylePreset: StylePresetEnum.JAPANDI,
        roomFunction: RoomFunctionEnum.LIVING_ROOM,
        budgetCeilingCents: 150000,
        currency: 'USD',
        status: 'PENDING',
      },
    ]);
    mockUpdateProject.mockResolvedValueOnce([]);

    const result = await service.createProject(
      {
        style_preset: StylePresetEnum.JAPANDI,
        room_function: RoomFunctionEnum.LIVING_ROOM,
        budget_ceiling_cents: 150000,
        currency: 'USD',
      },
      'user-1',
    );

    expect(result.project.id).toBe('proj-123');
    expect(result.uploadUrl).toContain('signed-put-url');
    expect(result.key).toBe('raw-uploads/proj-123.jpg');
    expect(mockR2Storage.createPresignedUploadUrl).toHaveBeenCalledWith('proj-123');
  });

  it('throws NotFoundException when querying non-existent project', async () => {
    mockFindFirstProject.mockResolvedValueOnce(null);

    await expect(service.getProject('non-existent-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('retrieves canvas hotspots with joined SKU catalog items', async () => {
    mockFindFirstProject.mockResolvedValueOnce({ id: 'proj-123' });
    mockSelectHotspots.mockResolvedValueOnce([
      {
        id: 'spot-1',
        projectId: 'proj-123',
        category: 'sofa',
        normX: '0.4500',
        normY: '0.6200',
        similarityScore: '0.9450',
        sku: {
          id: 'sku-1',
          sku: 'IKEA-SOFA-01',
          retailerId: 'IKEA',
          title: 'SÖDERHAMN Sofa',
          priceCents: 89900,
          inStock: true,
        },
      },
    ]);

    const hotspots = await service.getProjectHotspots('proj-123');
    expect(hotspots).toHaveLength(1);
    expect(hotspots[0].sku.sku).toBe('IKEA-SOFA-01');
    expect(hotspots[0].similarityScore).toBe('0.9450');
  });
});
