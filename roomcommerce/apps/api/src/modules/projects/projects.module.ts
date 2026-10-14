import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
import { R2StorageService } from './storage/r2-storage.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, R2StorageService],
  exports: [ProjectsService, R2StorageService],
})
export class ProjectsModule {}
