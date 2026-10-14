/**
 * ProjectOwnershipGuard — BOLA / IDOR Defense (SEC-01, Information Disclosure)
 *
 * Prevents resource enumeration by returning HTTP 404 for both:
 *   1. Projects that do not exist.
 *   2. Projects the caller does not own.
 *
 * This deliberately avoids HTTP 403 (Forbidden) to avoid leaking the existence
 * of project UUIDs belonging to other users (STRIDE: Information Disclosure).
 *
 * Ownership proof: either a verified JWT `user.id` or a `prc_guest_session` cookie
 * must match the project's `userId` or `guestSessionId` column respectively.
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
} from '@nestjs/common';
import { db } from '../../../database/index.js';
import { projects } from '../../../database/schema/index.js';
import { eq } from 'drizzle-orm';

@Injectable()
export class ProjectOwnershipGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const projectId: string | undefined = request.params?.id;
    const user = request.user;
    const guestSessionId: string | undefined =
      request.cookies?.['prc_guest_session'];

    // Guard is a no-op when no project ID param is present (e.g. POST /projects)
    if (!projectId) {
      return true;
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    // 1. Prevent resource enumeration — 404 for non-existent projects
    if (!project) {
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message:
          'This project does not exist or has passed the 7-day retention period.',
      });
    }

    // 2. Assert ownership: JWT user or guest cookie must match project owner
    const isOwner =
      (user?.id && project.userId === user.id) ||
      (guestSessionId &&
        project.guestSessionId &&
        project.guestSessionId === guestSessionId);

    if (!isOwner) {
      // Return 404 — never leak existence of a project UUID to unauthorized callers
      throw new NotFoundException({
        code: 'PROJECT_NOT_FOUND',
        message:
          'This project does not exist or has passed the 7-day retention period.',
      });
    }

    // Attach project to request to avoid duplicate DB lookups in controller
    request.project = project;
    return true;
  }
}
