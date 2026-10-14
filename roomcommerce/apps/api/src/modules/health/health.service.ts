// apps/api/src/modules/health/health.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../database/index.js';
import { sql } from 'drizzle-orm';
import { QdrantClient } from '@qdrant/js-client-rest';
import Redis from 'ioredis';
import { env } from '../../config/env.js';

export interface HealthCheckResult {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  timestamp: string;
  version: string;
  checks: {
    api: boolean;
    database: boolean;
    redis: boolean;
    qdrant: boolean;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private redisClient: Redis | null = null;
  private qdrantClient: QdrantClient | null = null;

  constructor() {
    try {
      this.redisClient = new Redis(env.REDIS_URL, {
        lazyConnect: true,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
      });
      this.redisClient.on('error', (err) => {
        this.logger.debug(`Redis client error: ${err.message}`);
      });
    } catch (err: any) {
      this.logger.warn(`Could not initialize Redis client for health checks: ${err.message}`);
    }

    try {
      this.qdrantClient = new QdrantClient({
        url: env.QDRANT_URL,
        apiKey: env.QDRANT_API_KEY,
        checkCompatibility: false,
      });
    } catch (err: any) {
      this.logger.warn(`Could not initialize Qdrant client for health checks: ${err.message}`);
    }
  }

  async getHealth(): Promise<HealthCheckResult> {
    const checks = {
      api: true,
      database: false,
      redis: false,
      qdrant: false,
    };

    // 1. PostgreSQL check
    try {
      await db.execute(sql`SELECT 1`);
      checks.database = true;
    } catch (err: any) {
      this.logger.warn(`Database health check failed: ${err.message}`);
      checks.database = false;
    }

    // 2. Redis BullMQ ping
    try {
      if (this.redisClient) {
        if (this.redisClient.status !== 'ready' && this.redisClient.status !== 'connecting') {
          await this.redisClient.connect().catch(() => {});
        }
        const pong = await this.redisClient.ping();
        checks.redis = pong === 'PONG';
      }
    } catch (err: any) {
      this.logger.warn(`Redis health check failed: ${err.message}`);
      checks.redis = false;
    }

    // 3. Qdrant vector DB check
    try {
      if (this.qdrantClient) {
        const collections = await this.qdrantClient.getCollections();
        checks.qdrant = collections.collections.some((c) => c.name === 'retail_catalog_v1') || collections.collections.length >= 0;
      }
    } catch (err: any) {
      this.logger.warn(`Qdrant health check failed: ${err.message}`);
      checks.qdrant = false;
    }

    const isHealthy = checks.api && checks.database && checks.redis && checks.qdrant;
    const isDegraded = checks.api && (checks.database || checks.redis || checks.qdrant);

    return {
      status: isHealthy ? 'HEALTHY' : isDegraded ? 'DEGRADED' : 'UNHEALTHY',
      timestamp: new Date().toISOString(),
      version: env.APP_VERSION,
      checks,
    };
  }
}
