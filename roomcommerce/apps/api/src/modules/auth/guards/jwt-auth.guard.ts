import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../../config/env.js';

export interface AuthUserPayload {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
      entitlement?: {
        tier: 'FREE_TIER' | 'MOVE_IN_PASS';
        passId?: string;
        rendersUsed?: number;
        isGuest?: boolean;
      };
    }
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      // Allow request to continue without user (for guest handling in downstream guards)
      return true;
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as AuthUserPayload;
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Provided authentication token is invalid or has expired.',
      });
    }
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    if (request.cookies) {
      if (request.cookies['prc_token']) return request.cookies['prc_token'];
      if (request.cookies['prc_session']) return request.cookies['prc_session'];
      if (request.cookies['prc_auth_token']) return request.cookies['prc_auth_token'];
    }
    return null;
  }
}
