import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { db } from '../../../database/index.js';
import { projects } from '../../../database/schema/index.js';
import { lte, eq } from 'drizzle-orm';
import { R2StorageService } from '../../projects/storage/r2-storage.service.js';

@Injectable()
export class StoragePurgeCron {
  private readonly logger = new Logger(StoragePurgeCron.name);

  constructor(private readonly r2Storage: R2StorageService) {}

  // Runs daily at 03:00 UTC (SEC-01, PRV-01)
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async executePurge(): Promise<number> {
    this.logger.log('Starting daily 7-day ephemeral image purge...');
    const now = new Date();

    const expiredProjects = await db
      .select()
      .from(projects)
      .where(lte(projects.purgeScheduledAt, now));

    let purgedCount = 0;

    for (const proj of expiredProjects) {
      try {
        await this.purgeProjectArtifacts(proj);
        // Delete database record (cascading deletes canvasHotspots and click events)
        await db.delete(projects).where(eq(projects.id, proj.id));
        purgedCount++;
      } catch (err: any) {
        this.logger.error(`Failed to purge project ${proj.id}: ${err.message}`);
      }
    }

    this.logger.log(`Purged ${purgedCount} expired project records.`);
    return purgedCount;
  }

  async purgeProjectArtifacts(proj: {
    rawImageUrl?: string | null;
    renderedImageUrl?: string | null;
    depthMapUrl?: string | null;
  }) {
    const urls = [proj.rawImageUrl, proj.renderedImageUrl, proj.depthMapUrl].filter(
      Boolean,
    ) as string[];

    for (const url of urls) {
      try {
        const key = this.extractR2Key(url);
        if (key) {
          await this.r2Storage.deleteArtifact(key);
        }
      } catch (err: any) {
        this.logger.warn(`Could not delete artifact ${url}: ${err.message}`);
      }
    }
  }

  private extractR2Key(url: string): string | null {
    try {
      const parsed = new URL(url);
      return parsed.pathname.replace(/^\//, '');
    } catch {
      // Fallback relative split
      return url.split('/').slice(-2).join('/');
    }
  }
}
