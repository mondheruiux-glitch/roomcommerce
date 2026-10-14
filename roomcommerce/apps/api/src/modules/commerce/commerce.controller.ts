import {
  Controller,
  Get,
  Param,
  Req,
  Res,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CommerceService } from './commerce.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('api/v1/commerce')
export class CommerceController {
  constructor(private readonly commerceService: CommerceService) {}

  @Get('redirect/:hotspot_id')
  @UseGuards(JwtAuthGuard)
  async handleAffiliateRedirect(
    @Param('hotspot_id') hotspotId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { destinationUrl, clickId } =
      await this.commerceService.processAffiliateClick(
        hotspotId,
        req.user?.id,
        req.headers['user-agent'],
        req.ip,
      );

    // Set secure 24-hour click session cookie (FR-403)
    res.cookie('prc_click_session', clickId, {
      path: '/',
      maxAge: 86400 * 1000,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
    });

    // HTTP 302 Found redirect
    return res.redirect(HttpStatus.FOUND, destinationUrl);
  }
}
