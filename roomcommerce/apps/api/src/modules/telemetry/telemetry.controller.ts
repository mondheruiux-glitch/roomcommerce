// apps/api/src/modules/telemetry/telemetry.controller.ts
import { Controller, Post, Body, Req, BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { TelemetryService } from './telemetry.service.js';
import { TelemetryEventSchema } from '@roomcommerce/contracts';

@Controller('api/v1/telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('events')
  async ingestEvent(@Body() body: unknown, @Req() req: Request) {
    const parseResult = TelemetryEventSchema.safeParse(body);
    if (!parseResult.success) {
      throw new BadRequestException({
        code: 'INVALID_TELEMETRY_PAYLOAD',
        message: 'Invalid telemetry event schema',
        errors: parseResult.error.errors,
      });
    }

    const userId = (req as any).user?.id || (req.cookies && req.cookies['prc_guest_session']);
    const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    return this.telemetryService.trackEvent(parseResult.data, userId, clientIp);
  }
}
