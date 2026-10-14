import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { db } from '../../../database/index.js';
import { users, movePasses } from '../../../database/schema/index.js';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class EntitlementGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // Injected via JwtAuthGuard

    if (!user) {
      // Anonymous Guest: Check session generation count
      const guestUsed = Number(request.cookies?.['prc_guest_render_count'] || 0);
      if (guestUsed >= 1) {
        throw new ForbiddenException({
          code: 'ENTITLEMENT_EXCEEDED',
          message:
            'Guest trial generation used. Create an account to unlock your 2 free renders.',
        });
      }
      request.entitlement = { tier: 'FREE_TIER', isGuest: true };
      return true;
    }

    // 1. Check active Move-In Pass ($14.99)
    const activePass = await db.query.movePasses.findFirst({
      where: and(
        eq(movePasses.userId, user.id),
        eq(movePasses.isActive, true),
      ),
    });

    if (activePass) {
      if (activePass.generationsExecuted >= 60) {
        // BR-01 Fair Use Cap
        throw new ForbiddenException({
          code: 'FAIR_USE_EXCEEDED',
          message: '30-Day Move-In Pass fair use ceiling (60 renders) reached.',
        });
      }
      request.entitlement = { tier: 'MOVE_IN_PASS', passId: activePass.id };
      return true;
    }

    // 2. Check Free Tier Allowance (Max 2 renders)
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    if (!dbUser || dbUser.freeRendersUsed >= 2) {
      throw new ForbiddenException({
        code: 'ENTITLEMENT_EXCEEDED',
        message:
          'You have used your 2 free redesigns. Unlock 30 days of 4K renders with a Move-In Pass.',
      });
    }

    request.entitlement = {
      tier: 'FREE_TIER',
      rendersUsed: dbUser.freeRendersUsed,
    };
    return true;
  }
}
