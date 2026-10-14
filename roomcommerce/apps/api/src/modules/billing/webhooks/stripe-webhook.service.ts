import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { env } from '../../../config/env.js';
import { db } from '../../../database/index.js';
import { movePasses, users } from '../../../database/schema/index.js';
import { eq } from 'drizzle-orm';

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);
  private readonly stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia' as any,
    });
  }

  async handleStripeEvent(rawBody: Buffer | string, signature: string) {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err: any) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    this.logger.log(`Received Stripe event: ${event.type} [${event.id}]`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      await this.activateMoveInPass(session);
    }

    return { received: true };
  }

  async activateMoveInPass(session: Stripe.Checkout.Session) {
    const userId = session.metadata?.userId;
    if (!userId) {
      this.logger.warn(`Checkout session ${session.id} missing userId metadata.`);
      return;
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Exactly 30 days (BR-01)

    // Idempotent transaction: insert pass + update user.hasActivePass atomically
    const inserted = await db.transaction(async (tx) => {
      const result = await tx
        .insert(movePasses)
        .values({
          userId,
          stripeSessionId: session.id,
          amountCents: session.amount_total || 1499,
          currency: (session.currency || 'USD').toUpperCase(),
          activatedAt: new Date(),
          expiresAt,
          generationsExecuted: 0,
        })
        .onConflictDoNothing()
        .returning();

      // Only update user flag if pass was newly inserted (idempotency guard)
      if (result.length > 0) {
        await tx
          .update(users)
          .set({ hasActivePass: true })
          .where(eq(users.id, userId));
      }

      return result;
    });

    this.logger.log(
      `Processed 30-Day Move-In Pass for user: ${userId}. Inserted: ${inserted.length > 0}`,
    );
  }
}
