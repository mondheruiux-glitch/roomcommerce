import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { InferenceController } from './inference.controller.js';
import { InferenceService } from './inference.service.js';
import { InferenceProcessor } from './queues/inference.processor.js';
import { PipelineSseService } from './sse/pipeline-sse.service.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'inference-jobs',
    }),
    CatalogModule,
    AuthModule,
  ],
  controllers: [InferenceController],
  providers: [InferenceService, InferenceProcessor, PipelineSseService],
  exports: [InferenceService, PipelineSseService],
})
export class InferenceModule {}
