import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Request } from 'express';
import { CreateProjectSchema, type CreateProjectDto } from '@roomcommerce/contracts';
import { ProjectsService } from './projects.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { EntitlementGuard } from '../auth/guards/entitlement.guard.js';
import { ProjectOwnershipGuard } from './guards/project-ownership.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';

@Controller('api/v1/projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, EntitlementGuard)
  @UsePipes(new ZodValidationPipe(CreateProjectSchema))
  async createProject(@Body() dto: CreateProjectDto, @Req() req: Request) {
    const user = req.user;
    const guestSessionId = req.cookies?.['prc_guest_session'] || undefined;

    const { project, uploadUrl, key } = await this.projectsService.createProject(
      dto,
      user?.id,
      guestSessionId,
    );

    return {
      project_id: project.id,
      upload_url: uploadUrl,
      upload_method: 'PUT',
      expires_in_seconds: 300,
      max_size_bytes: 20971520, // 20MB limit (FR-101)
      key,
    };
  }

  /**
   * GET /api/v1/projects/:id
   * Protected by ProjectOwnershipGuard (BOLA/IDOR defense — SEC-01).
   * Returns 404 for both non-existent and unauthorized projects.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, ProjectOwnershipGuard)
  async getProject(@Param('id') projectId: string) {
    return this.projectsService.getProject(projectId);
  }

  /**
   * GET /api/v1/projects/:id/hotspots
   * Protected by ProjectOwnershipGuard to prevent unauthorized canvas data exposure.
   */
  @Get(':id/hotspots')
  @UseGuards(JwtAuthGuard, ProjectOwnershipGuard)
  async getProjectHotspots(@Param('id') projectId: string) {
    return this.projectsService.getProjectHotspots(projectId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserProjects(@Req() req: Request) {
    if (!req.user) {
      return [];
    }
    return this.projectsService.getUserProjects(req.user.id);
  }
}
