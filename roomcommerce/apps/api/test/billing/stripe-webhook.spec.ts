import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StripeWebhookService } from '../../src/modules/billing/webhooks/stripe-webhook.service.js';
import { BillingService } from '../../src/modules/billing/billing.service.js';
import { BadRequestException } from '@nestjs/common';

// ── Mock DB ──────────────────────────────────────────────────────────────────
const mockInsertPass = vi.fn();
const mockUpdateUser = vi.fn();
const mockFindFirstUser = vi.fn();
const mockFindFirstPass = vi.fn();

vi.mock('../../src/database/index.js', () => ({
  db: {
    transaction: async (fn: any) => {
      const tx = {
        insert: () => ({
          values: () => ({
            onConflictDoNothing: () => ({
              returning: mockInsertPass,
            }),
          }),
        }),
        update: () => ({
          set: () => ({
            where: mockUpdateUser,
          }),
        }),
      };
      return fn(tx);
    },
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: mockInsertPass,
        }),
      }),
    }),
    query: {
      users: {
        findFirst: (...args: any[]) => mockFindFirstUser(...args),
      },
      movePasses: {
        findFirst: (...args: any[]) => mockFindFirstPass(...args),
      },
    },
  },
}));

// ── Mock Stripe ──────────────────────────────────────────────────────────────
const mockConstructEvent = vi.fn();
const mockCreateSession = vi.fn();

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      webhooks = {
        constructEvent: (...args: any[]) => mockConstructEvent(...args),
      };
      checkout = {
        sessions: {
          create: (...args: any[]) => mockCreateSession(...args),
        },
      };
    },
  };
});

describe('BillingModule — Stripe Checkout & Idempotent Webhook (FR-501, BR-01)', () => {
  let webhookService: StripeWebhookService;
  let billingService: BillingService;

  beforeEach(() => {
    vi.clearAllMocks();
    webhookService = new StripeWebhookService();
    billingService = new BillingService();
  });

  it('creates Stripe checkout session with $14.99 Move-In Pass line item', async () => {
    mockCreateSession.mockResolvedValueOnce({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/pay/cs_test_123',
    });

    const result = await billingService.createCheckoutSession(
      'user-1',
      'user@example.com',
      'http://localhost:3000',
    );

    expect(result.session_id).toBe('cs_test_123');
    expect(result.checkout_url).toContain('checkout.stripe.com');
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        customer_email: 'user@example.com',
        metadata: { userId: 'user-1' },
      }),
    );
  });

  it('rejects webhooks with invalid signatures', async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error('Invalid signature');
    });

    await expect(
      webhookService.handleStripeEvent(Buffer.from('{}'), 'bad-sig'),
    ).rejects.toThrow(BadRequestException);
  });

  it('idempotently activates 30-Day Move-In Pass on checkout.session.completed', async () => {
    const mockSession = {
      id: 'cs_test_success_123',
      metadata: { userId: 'user-1' },
      amount_total: 1499,
      currency: 'usd',
    };

    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: mockSession },
    });

    mockInsertPass.mockResolvedValueOnce([
      {
        id: 'pass-uuid-1',
        userId: 'user-1',
        stripeSessionId: 'cs_test_success_123',
        amountCents: 1499,
      },
    ]);

    const res = await webhookService.handleStripeEvent(
      Buffer.from('{}'),
      'valid-sig',
    );
    expect(res.received).toBe(true);
    expect(mockInsertPass).toHaveBeenCalled();
  });

  it('handles duplicate webhook replays without error (idempotency)', async () => {
    const mockSession = {
      id: 'cs_test_success_123',
      metadata: { userId: 'user-1' },
      amount_total: 1499,
      currency: 'usd',
    };

    mockConstructEvent.mockReturnValueOnce({
      id: 'evt_1_replayed',
      type: 'checkout.session.completed',
      data: { object: mockSession },
    });

    // onConflictDoNothing returns empty array on replay
    mockInsertPass.mockResolvedValueOnce([]);

    const res = await webhookService.handleStripeEvent(
      Buffer.from('{}'),
      'valid-sig',
    );
    expect(res.received).toBe(true);
  });
});
