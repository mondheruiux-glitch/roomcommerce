import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { StripeWebhookService } from './webhooks/stripe-webhook.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [BillingController],
  providers: [BillingService, StripeWebhookService],
  exports: [BillingService, StripeWebhookService],
})
export class BillingModule {}
