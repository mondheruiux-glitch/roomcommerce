import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { db } from '../../database/index.js';
import { projects, users } from '../../database/schema/index.js';
import { eq } from 'drizzle-orm';
import { StoragePurgeCron } from './cron/storage-purge.cron.js';

@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(private readonly purgeCron: StoragePurgeCron) {}

  async hardDeleteProject(projectId: string, userId?: string): Promise<{ success: boolean; message: string }> {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message: `Project ${projectId} not found.`,
      });
    }

    if (userId && project.userId && project.userId !== userId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Cannot delete project owned by another user.',
      });
    }

    // 1. Purge S3 / R2 storage artifacts
    await this.purgeCron.purgeProjectArtifacts(project);

    // 2. Delete database record
    await db.delete(projects).where(eq(projects.id, projectId));

    this.logger.log(`Hard deleted project ${projectId} per PRV-02 privacy request.`);

    return {
      success: true,
      message: 'Project and all associated room imagery permanently deleted.',
    };
  }

  async hardDeleteUserData(userId: string): Promise<{ success: boolean; message: string }> {
    const userProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.userId, userId));

    for (const proj of userProjects) {
      await this.purgeCron.purgeProjectArtifacts(proj);
    }

    // Deleting user cascades to projects, movePasses, etc.
    await db.delete(users).where(eq(users.id, userId));

    this.logger.log(`Hard deleted user account ${userId} and all personal data.`);

    return {
      success: true,
      message: 'Account and all spatial redesign data have been permanently erased.',
    };
  }

  async runDailyPurge() {
    return this.purgeCron.executePurge();
  }
}
