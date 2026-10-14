import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { db } from '../../database/index.js';
import { users, movePasses } from '../../database/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { env } from '../../config/env.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  async sendMagicLink(email: string): Promise<{ success: boolean; message: string; magicLinkUrl?: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    // Upsert or find user
    let user = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    if (!user) {
      const [created] = await db
        .insert(users)
        .values({ email: normalizedEmail })
        .returning();
      if (!created) {
        throw new Error('Failed to create user record.');
      }
      user = created;
    }

    // 15-minute magic link token
    const magicToken = jwt.sign(
      { sub: user.id, email: user.email, type: 'magic_link' },
      env.JWT_SECRET,
      { expiresIn: '15m' },
    );

    const magicLinkUrl = `${env.WEB_BASE_URL}/auth/verify?token=${magicToken}`;
    this.logger.log(`Magic link generated for ${normalizedEmail}: ${magicLinkUrl}`);

    return {
      success: true,
      message: 'Magic link has been dispatched to your email.',
      // Expose URL in dev/test for seamless developer verification
      ...(env.NODE_ENV !== 'production' ? { magicLinkUrl } : {}),
    };
  }

  async verifyMagicLink(token: string): Promise<{ sessionToken: string; user: { id: string; email: string } }> {
    let payload: any;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_MAGIC_LINK',
        message: 'The magic login link has expired or is invalid.',
      });
    }

    if (payload.type !== 'magic_link') {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN_TYPE',
        message: 'Supplied token is not a valid login link.',
      });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User associated with login token no longer exists.',
      });
    }

    // Issue 7-day session token
    const sessionToken = jwt.sign(
      { id: user.id, email: user.email },
      env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    return {
      sessionToken,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  async getUserProfile(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found.',
      });
    }

    const activePass = await db.query.movePasses.findFirst({
      where: and(
        eq(movePasses.userId, user.id),
        eq(movePasses.isActive, true),
      ),
    });

    return {
      id: user.id,
      email: user.email,
      free_renders_used: user.freeRendersUsed,
      free_renders_remaining: Math.max(0, 2 - user.freeRendersUsed),
      has_active_pass: !!activePass,
      active_pass: activePass
        ? {
            id: activePass.id,
            expires_at: activePass.expiresAt,
            generations_executed: activePass.generationsExecuted,
            generations_remaining: Math.max(0, 60 - activePass.generationsExecuted),
          }
        : null,
    };
  }
}
