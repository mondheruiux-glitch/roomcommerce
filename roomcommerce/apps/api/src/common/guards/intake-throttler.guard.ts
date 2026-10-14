import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Intake-specific throttler guard applying a stricter 5 requests/minute limit
 * on render-initiating endpoints (POST /projects, POST /:id/render).
 * Falls back to the global 120 req/min ceiling for all other routes.
 *
 * Applied via @UseGuards(IntakeThrottlerGuard) at controller or method level.
 */
@Injectable()
export class IntakeThrottlerGuard extends ThrottlerGuard {
  protected readonly intakeTtl = 60000; // 1-minute window
  protected readonly intakeLimit = 5; // max 5 render dispatches/min per IP

  protected override errorMessage =
    'Too many render requests. Please wait before submitting again.';

  protected override async getTracker(request: Record<string, any>): Promise<string> {
    const ip =
      (request as any)?.ip ||
      (request as any)?.connection?.remoteAddress ||
      'unknown';
    return `intake:${ip}`;
  }
}
