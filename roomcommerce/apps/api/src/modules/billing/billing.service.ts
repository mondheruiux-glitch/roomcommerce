import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import Stripe from 'stripe';
import { env } from '../../config/env.js';
import { db } from '../../database/index.js';
import { movePasses, users } from '../../database/schema/index.js';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia' as any,
    });
  }

  async createCheckoutSession(userId: string, email: string, returnUrl?: string) {
    this.logger.log(`Initiating checkout session for user ${userId} (${email})`);
    const successUrl = `${returnUrl || env.WEB_BASE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${returnUrl || env.WEB_BASE_URL}/billing/cancel`;

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      metadata: {
        userId,
      },
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: 1499, // $14.99 (BR-01)
            product_data: {
              name: 'RoomCommerce Move-In Pass (30 Days)',
              description:
                'Unlimited 4K photorealistic spatial room redesigns (up to 60 renders within 30 days) and high-priority GPU rendering queue.',
            },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return {
      session_id: session.id,
      checkout_url: session.url,
    };
  }

  async getBillingStatus(userId: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    const activePass = await db.query.movePasses.findFirst({
      where: and(
        eq(movePasses.userId, userId),
        eq(movePasses.isActive, true),
      ),
    });

    return {
      has_active_pass: !!activePass,
      active_pass: activePass
        ? {
            id: activePass.id,
            activated_at: activePass.activatedAt,
            expires_at: activePass.expiresAt,
            generations_executed: activePass.generationsExecuted,
            generations_remaining: Math.max(0, 60 - activePass.generationsExecuted),
          }
        : null,
      free_renders_used: user.freeRendersUsed,
      free_renders_remaining: Math.max(0, 2 - user.freeRendersUsed),
    };
  }
}
