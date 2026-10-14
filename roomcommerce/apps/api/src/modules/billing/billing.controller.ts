import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Req,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { BillingService } from './billing.service.js';
import { StripeWebhookService } from './webhooks/stripe-webhook.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@Controller('api/v1/billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly webhookService: StripeWebhookService,
  ) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async createCheckout(
    @Body('return_url') returnUrl: string,
    @Req() req: Request,
  ) {
    if (!req.user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Must be authenticated to purchase a Move-In Pass.',
      });
    }

    return this.billingService.createCheckoutSession(
      req.user.id,
      req.user.email,
      returnUrl,
    );
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req: Request) {
    if (!req.user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Must be authenticated to check billing status.',
      });
    }

    return this.billingService.getBillingStatus(req.user.id);
  }

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: Request,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    const rawBody = (req as any).rawBody || req.body;
    return this.webhookService.handleStripeEvent(rawBody, signature);
  }
}
