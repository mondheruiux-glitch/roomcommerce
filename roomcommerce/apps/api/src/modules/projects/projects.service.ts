import { Injectable, NotFoundException } from '@nestjs/common';
import { db } from '../../database/index.js';
import { projects, canvasHotspots, catalogSkus } from '../../database/schema/index.js';
import { eq, desc } from 'drizzle-orm';
import { CreateProjectDto } from '@roomcommerce/contracts';
import { R2StorageService } from './storage/r2-storage.service.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly r2Storage: R2StorageService) {}

  async createProject(
    dto: CreateProjectDto,
    userId?: string,
    guestSessionId?: string,
  ) {
    const rawImageKey = `raw-uploads/pending`;

    const [created] = await db
      .insert(projects)
      .values({
        userId: userId || null,
        guestSessionId: guestSessionId || null,
        stylePreset: dto.style_preset,
        roomFunction: dto.room_function,
        budgetCeilingCents: dto.budget_ceiling_cents,
        currency: dto.currency,
        rawImageUrl: this.r2Storage.getPublicUrl(rawImageKey),
        status: 'PENDING',
      })
      .returning();

    if (!created) {
      throw new Error('Failed to create project record.');
    }

    const { uploadUrl, key } = await this.r2Storage.createPresignedUploadUrl(
      created.id,
    );

    // Update with exact key public URL
    const finalRawUrl = this.r2Storage.getPublicUrl(key);
    await db
      .update(projects)
      .set({ rawImageUrl: finalRawUrl })
      .where(eq(projects.id, created.id));

    return {
      project: { ...created, rawImageUrl: finalRawUrl },
      uploadUrl,
      key,
    };
  }

  async getProject(projectId: string) {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: `Project with ID ${projectId} does not exist.`,
      });
    }

    return project;
  }

  async getProjectHotspots(projectId: string) {
    await this.getProject(projectId);

    const rows = await db
      .select({
        id: canvasHotspots.id,
        projectId: canvasHotspots.projectId,
        category: canvasHotspots.category,
        normX: canvasHotspots.normX,
        normY: canvasHotspots.normY,
        similarityScore: canvasHotspots.similarityScore,
        createdAt: canvasHotspots.createdAt,
        sku: {
          id: catalogSkus.id,
          sku: catalogSkus.sku,
          retailerId: catalogSkus.retailerId,
          title: catalogSkus.title,
          category: catalogSkus.category,
          priceCents: catalogSkus.priceCents,
          canonicalUrl: catalogSkus.canonicalUrl,
          primaryImageUrl: catalogSkus.primaryImageUrl,
          inStock: catalogSkus.inStock,
        },
      })
      .from(canvasHotspots)
      .innerJoin(catalogSkus, eq(canvasHotspots.matchedSkuId, catalogSkus.id))
      .where(eq(canvasHotspots.projectId, projectId))
      .orderBy(desc(canvasHotspots.similarityScore));

    return rows;
  }

  async getUserProjects(userId: string) {
    return db.query.projects.findMany({
      where: eq(projects.userId, userId),
      orderBy: [desc(projects.createdAt)],
    });
  }
}
