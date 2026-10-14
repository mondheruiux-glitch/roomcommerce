import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrivacyController } from './privacy.controller.js';
import { PrivacyService } from './privacy.service.js';
import { StoragePurgeCron } from './cron/storage-purge.cron.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [ScheduleModule.forRoot(), ProjectsModule, AuthModule],
  controllers: [PrivacyController],
  providers: [PrivacyService, StoragePurgeCron],
  exports: [PrivacyService, StoragePurgeCron],
})
export class PrivacyModule {}
