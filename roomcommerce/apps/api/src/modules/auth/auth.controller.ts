import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';

const MagicLinkRequestSchema = z.object({
  email: z.string().email(),
});

type MagicLinkRequestDto = z.infer<typeof MagicLinkRequestSchema>;

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('magic-link')
  async requestMagicLink(
    @Body(new ZodValidationPipe(MagicLinkRequestSchema)) dto: MagicLinkRequestDto,
  ) {
    return this.authService.sendMagicLink(dto.email);
  }

  @Get('verify')
  async verifyMagicLink(
    @Query('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!token) {
      throw new UnauthorizedException({
        code: 'MISSING_TOKEN',
        message: 'Verification token must be provided.',
      });
    }

    const { sessionToken, user } = await this.authService.verifyMagicLink(token);

    // Set HTTP-only session cookie
    res.cookie('prc_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      session_token: sessionToken,
      user,
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request) {
    if (!req.user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Must be authenticated to view user profile.',
      });
    }
    return this.authService.getUserProfile(req.user.id);
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('prc_token');
    return { success: true, message: 'Logged out successfully.' };
  }
}
