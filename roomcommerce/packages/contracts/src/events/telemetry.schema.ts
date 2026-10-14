import { z } from 'zod';

export const TelemetryEventSchema = z.discriminatedUnion('event_name', [
  z.object({
    event_name: z.literal('room_photo_uploaded'), // EV-101
    properties: z.object({
      file_format: z.enum(['image/jpeg', 'image/png', 'image/heic']),
      file_size_kb: z.number().positive(),
      resolution: z.string(),
      capture_source: z.enum(['camera', 'file_picker', 'drag_drop']),
    }),
  }),
  z.object({
    event_name: z.literal('generation_initiated'), // EV-102
    properties: z.object({
      style_preset: z.string(),
      budget_ceiling_cents: z.number().int(),
      anchor_items_count: z.number().int().default(0),
      pass_tier: z.enum(['anonymous', 'free', 'move_in_pass']),
    }),
  }),
  z.object({
    event_name: z.literal('generation_completed'), // EV-103
    properties: z.object({
      duration_ms: z.number().positive(),
      items_detected: z.number().int(),
      total_cart_val_cents: z.number().int(),
      gpu_worker_id: z.string(),
    }),
  }),
  z.object({
    event_name: z.literal('product_pin_tapped'), // EV-201
    properties: z.object({
      sku_id: z.string(),
      retailer_id: z.string(),
      price_cents: z.number().int(),
      similarity_score: z.number(),
      category: z.string(),
    }),
  }),
  z.object({
    event_name: z.literal('affiliate_outbound_clk'), // EV-202
    properties: z.object({
      sku_id: z.string(),
      retailer_id: z.string(),
      price_cents: z.number().int(),
      affiliate_network: z.string(),
      click_id: z.string().uuid(),
    }),
  }),
  z.object({
    event_name: z.literal('pass_paywall_viewed'), // EV-301
    properties: z.object({
      trigger_source: z.string(),
      renders_used_count: z.number().int(),
    }),
  }),
  z.object({
    event_name: z.literal('pass_purchased'), // EV-302
    properties: z.object({
      transaction_id: z.string(),
      revenue_cents: z.literal(1499),
      pass_type: z.literal('30_day_pass'),
    }),
  }),
]);

export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
