// apps/api/src/modules/health/health.controller.ts
import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthService } from './health.service.js';

@Controller(['health', 'api/v1/health'])
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async checkOverallHealth(@Res() res: Response) {
    const health = await this.healthService.getHealth();
    const httpStatus = health.status === 'HEALTHY' || health.status === 'DEGRADED'
      ? HttpStatus.OK
      : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(httpStatus).json(health);
  }

  @Get('db')
  async checkDb(@Res() res: Response) {
    const health = await this.healthService.getHealth();
    return res
      .status(health.checks.database ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json({ database: health.checks.database });
  }

  @Get('redis')
  async checkRedis(@Res() res: Response) {
    const health = await this.healthService.getHealth();
    return res
      .status(health.checks.redis ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json({ redis: health.checks.redis });
  }

  @Get('qdrant')
  async checkQdrant(@Res() res: Response) {
    const health = await this.healthService.getHealth();
    return res
      .status(health.checks.qdrant ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json({ qdrant: health.checks.qdrant });
  }
}
