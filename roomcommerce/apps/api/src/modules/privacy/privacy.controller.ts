import {
  Controller,
  Delete,
  Post,
  Param,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrivacyService } from './privacy.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('api/v1/privacy')
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  /**
   * DELETE /api/v1/privacy/projects/:id
   * Hard-delete a single project and its R2 artifacts (PRV-02)
   */
  @Delete('projects/:id')
  @UseGuards(JwtAuthGuard)
  async deleteProject(@Param('id') projectId: string, @Req() req: Request) {
    return this.privacyService.hardDeleteProject(projectId, req.user?.id);
  }

  /**
   * DELETE /api/v1/privacy/purge-me
   * 1-click GDPR/CCPA full account erasure — permanently deletes all user
   * records, photos, renders, and active passes across PostgreSQL, R2, and
   * Redis within 60 seconds (PRV-02).
   */
  @Delete('purge-me')
  @UseGuards(JwtAuthGuard)
  async purgeMe(@Req() req: Request) {
    if (!req.user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Must be authenticated to request account erasure.',
      });
    }
    return this.privacyService.hardDeleteUserData(req.user.id);
  }

  /**
   * DELETE /api/v1/privacy/account
   * Alias for purge-me — authenticated full data erasure (PRV-02)
   */
  @Delete('account')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@Req() req: Request) {
    if (!req.user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Must be authenticated to delete account.',
      });
    }
    return this.privacyService.hardDeleteUserData(req.user.id);
  }

  /**
   * POST /api/v1/privacy/purge — Admin trigger for daily purge daemon
   */
  @Post('purge')
  async triggerManualPurge() {
    const purgedCount = await this.privacyService.runDailyPurge();
    return {
      success: true,
      purged_projects: purgedCount,
    };
  }
}
