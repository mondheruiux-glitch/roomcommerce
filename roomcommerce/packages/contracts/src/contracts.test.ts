import { describe, it, expect } from 'vitest';
import {
  StylePresetEnum,
  RoomFunctionEnum,
  RetailerEnum,
  JobStatusEnum,
  CreateProjectSchema,
  PresignedUploadResponseSchema,
  CatalogSkuSchema,
  TelemetryEventSchema,
  ApiSuccessEnvelopeSchema,
  ApiErrorEnvelopeSchema,
  CanvasHotspotSchema,
  AffiliateRedirectSchema,
} from './index.js';
import { z } from 'zod';

// ──────────────────────────────────────────────────────────
// 1. Enum completeness
// ──────────────────────────────────────────────────────────
describe('Enums', () => {
  it('StylePresetEnum has exactly 8 members', () => {
    expect(Object.keys(StylePresetEnum)).toHaveLength(8);
  });

  it('RoomFunctionEnum has exactly 5 members', () => {
    expect(Object.keys(RoomFunctionEnum)).toHaveLength(5);
  });

  it('RetailerEnum has exactly 4 members', () => {
    expect(Object.keys(RetailerEnum)).toHaveLength(4);
  });

  it('JobStatusEnum has exactly 5 members', () => {
    expect(Object.keys(JobStatusEnum)).toHaveLength(5);
  });

  it('StylePresetEnum includes JAPANDI', () => {
    expect(StylePresetEnum.JAPANDI).toBe('JAPANDI');
  });

  it('JobStatusEnum includes TIMED_OUT', () => {
    expect(JobStatusEnum.TIMED_OUT).toBe('TIMED_OUT');
  });
});

// ──────────────────────────────────────────────────────────
// 2. CreateProjectSchema validation
// ──────────────────────────────────────────────────────────
describe('CreateProjectSchema', () => {
  it('parses valid input', () => {
    const result = CreateProjectSchema.parse({
      style_preset: StylePresetEnum.JAPANDI,
      room_function: RoomFunctionEnum.LIVING_ROOM,
      budget_ceiling_cents: 50000,
      currency: 'USD',
    });
    expect(result.style_preset).toBe('JAPANDI');
    expect(result.budget_ceiling_cents).toBe(50000);
  });

  it('applies defaults for room_function and currency', () => {
    const result = CreateProjectSchema.parse({
      style_preset: StylePresetEnum.SCANDINAVIAN,
      budget_ceiling_cents: 30000,
    });
    expect(result.room_function).toBe('LIVING_ROOM');
    expect(result.currency).toBe('USD');
  });

  it('rejects budget below $300 (30000 cents)', () => {
    const result = CreateProjectSchema.safeParse({
      style_preset: StylePresetEnum.MINIMALIST,
      budget_ceiling_cents: 29999,
    });
    expect(result.success).toBe(false);
  });

  it('rejects budget above $10,000 (1000000 cents)', () => {
    const result = CreateProjectSchema.safeParse({
      style_preset: StylePresetEnum.MINIMALIST,
      budget_ceiling_cents: 1000001,
    });
    expect(result.success).toBe(false);
  });

  it('accepts boundary value $300 (30000 cents)', () => {
    const result = CreateProjectSchema.safeParse({
      style_preset: StylePresetEnum.INDUSTRIAL,
      budget_ceiling_cents: 30000,
    });
    expect(result.success).toBe(true);
  });

  it('accepts boundary value $10,000 (1000000 cents)', () => {
    const result = CreateProjectSchema.safeParse({
      style_preset: StylePresetEnum.CONTEMPORARY,
      budget_ceiling_cents: 1000000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid style_preset', () => {
    const result = CreateProjectSchema.safeParse({
      style_preset: 'INVALID_STYLE',
      budget_ceiling_cents: 50000,
    });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────
// 3. PresignedUploadResponseSchema validation
// ──────────────────────────────────────────────────────────
describe('PresignedUploadResponseSchema', () => {
  it('parses valid presigned upload response', () => {
    const result = PresignedUploadResponseSchema.parse({
      project_id: '550e8400-e29b-41d4-a716-446655440000',
      upload_url: 'https://r2.cloudflare.com/presigned-url',
      upload_method: 'PUT',
      expires_in_seconds: 300,
      max_size_bytes: 20971520,
      key: 'raw-uploads/550e8400/original.jpg',
    });
    expect(result.upload_method).toBe('PUT');
    expect(result.max_size_bytes).toBe(20971520); // 20MB
  });

  it('rejects non-PUT upload method', () => {
    const result = PresignedUploadResponseSchema.safeParse({
      project_id: '550e8400-e29b-41d4-a716-446655440000',
      upload_url: 'https://r2.cloudflare.com/presigned-url',
      upload_method: 'POST',
      key: 'test-key',
    });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────
// 4. CatalogSkuSchema validation
// ──────────────────────────────────────────────────────────
describe('CatalogSkuSchema', () => {
  const validSku = {
    sku_id: 'IKEA-KALLAX-001',
    retailer_id: RetailerEnum.IKEA,
    title: 'KALLAX Shelf unit, white, 77x147 cm',
    category: 'storage',
    price_cents: 8999,
    currency: 'USD' as const,
    dimensions_cm: { width: 77, depth: 39, height: 147 },
    in_stock: true,
    canonical_url: 'https://www.ikea.com/us/en/p/kallax-shelf-unit-white-80275887/',
    affiliate_url: 'https://affiliate.roomcommerce.com/redirect?sku=IKEA-KALLAX-001',
    primary_image_url: 'https://www.ikea.com/us/en/images/products/kallax.jpg',
    last_verified_at: '2024-10-01T12:00:00Z',
  };

  it('parses valid SKU', () => {
    const result = CatalogSkuSchema.parse(validSku);
    expect(result.sku_id).toBe('IKEA-KALLAX-001');
    expect(result.dimensions_cm.width).toBe(77);
  });

  it('rejects negative price_cents', () => {
    const result = CatalogSkuSchema.safeParse({ ...validSku, price_cents: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects zero-width dimensions', () => {
    const result = CatalogSkuSchema.safeParse({
      ...validSku,
      dimensions_cm: { width: 0, depth: 39, height: 147 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty title', () => {
    const result = CatalogSkuSchema.safeParse({ ...validSku, title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects title exceeding 512 characters', () => {
    const result = CatalogSkuSchema.safeParse({ ...validSku, title: 'A'.repeat(513) });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────
// 5. TelemetryEventSchema validation
// ──────────────────────────────────────────────────────────
describe('TelemetryEventSchema', () => {
  it('parses EV-101 room_photo_uploaded', () => {
    const result = TelemetryEventSchema.parse({
      event_name: 'room_photo_uploaded',
      properties: {
        file_format: 'image/jpeg',
        file_size_kb: 2048,
        resolution: '3024x4032',
        capture_source: 'camera',
      },
    });
    expect(result.event_name).toBe('room_photo_uploaded');
  });

  it('parses EV-102 generation_initiated', () => {
    const result = TelemetryEventSchema.parse({
      event_name: 'generation_initiated',
      properties: {
        style_preset: 'JAPANDI',
        budget_ceiling_cents: 50000,
        anchor_items_count: 2,
        pass_tier: 'free',
      },
    });
    expect(result.event_name).toBe('generation_initiated');
  });

  it('parses EV-103 generation_completed', () => {
    const result = TelemetryEventSchema.parse({
      event_name: 'generation_completed',
      properties: {
        duration_ms: 12500,
        items_detected: 8,
        total_cart_val_cents: 245000,
        gpu_worker_id: 'modal-gpu-001',
      },
    });
    expect(result.properties.duration_ms).toBe(12500);
  });

  it('parses EV-201 product_pin_tapped', () => {
    const result = TelemetryEventSchema.parse({
      event_name: 'product_pin_tapped',
      properties: {
        sku_id: 'IKEA-KALLAX-001',
        retailer_id: 'IKEA',
        price_cents: 8999,
        similarity_score: 0.92,
        category: 'storage',
      },
    });
    expect(result.event_name).toBe('product_pin_tapped');
  });

  it('parses EV-202 affiliate_outbound_clk', () => {
    const result = TelemetryEventSchema.parse({
      event_name: 'affiliate_outbound_clk',
      properties: {
        sku_id: 'TGT-LAMP-003',
        retailer_id: 'TARGET',
        price_cents: 4999,
        affiliate_network: 'impact',
        click_id: '550e8400-e29b-41d4-a716-446655440000',
      },
    });
    expect(result.event_name).toBe('affiliate_outbound_clk');
  });

  it('parses EV-301 pass_paywall_viewed', () => {
    const result = TelemetryEventSchema.parse({
      event_name: 'pass_paywall_viewed',
      properties: {
        trigger_source: 'render_limit_reached',
        renders_used_count: 3,
      },
    });
    expect(result.event_name).toBe('pass_paywall_viewed');
  });

  it('parses EV-302 pass_purchased with exact $14.99 revenue', () => {
    const result = TelemetryEventSchema.parse({
      event_name: 'pass_purchased',
      properties: {
        transaction_id: 'pi_3Ox4vK2eZvKYlo2C',
        revenue_cents: 1499,
        pass_type: '30_day_pass',
      },
    });
    expect(result.properties.revenue_cents).toBe(1499);
  });

  it('rejects pass_purchased with wrong revenue amount', () => {
    const result = TelemetryEventSchema.safeParse({
      event_name: 'pass_purchased',
      properties: {
        transaction_id: 'pi_test',
        revenue_cents: 999,
        pass_type: '30_day_pass',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown event_name', () => {
    const result = TelemetryEventSchema.safeParse({
      event_name: 'unknown_event',
      properties: {},
    });
    expect(result.success).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────
// 6. API Envelope Schemas
// ──────────────────────────────────────────────────────────
describe('ApiSuccessEnvelopeSchema', () => {
  it('wraps arbitrary data with success envelope', () => {
    const schema = ApiSuccessEnvelopeSchema(z.object({ id: z.string() }));
    const result = schema.parse({
      success: true,
      data: { id: 'proj-123' },
      meta: { timestamp: '2024-10-01T12:00:00Z' },
    });
    expect(result.success).toBe(true);
    expect(result.data.id).toBe('proj-123');
  });
});

describe('ApiErrorEnvelopeSchema', () => {
  it('parses error envelope with details', () => {
    const result = ApiErrorEnvelopeSchema.parse({
      success: false,
      error: {
        code: 'INVALID_IMAGE_FORMAT',
        message: 'Please upload a valid JPG, PNG, or HEIC file.',
        details: [{ field: 'file', message: 'Unsupported format: .bmp' }],
      },
    });
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('INVALID_IMAGE_FORMAT');
  });

  it('parses error envelope without details', () => {
    const result = ApiErrorEnvelopeSchema.parse({
      success: false,
      error: {
        code: 'GPU_INFERENCE_TIMEOUT',
        message: 'High server demand. Credits restored.',
      },
    });
    expect(result.error.details).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────
// 7. Canvas Hotspot & Affiliate Redirect Schemas
// ──────────────────────────────────────────────────────────
describe('CanvasHotspotSchema', () => {
  it('parses valid hotspot with percentage coordinates', () => {
    const result = CanvasHotspotSchema.parse({
      hotspot_id: '550e8400-e29b-41d4-a716-446655440000',
      project_id: '660e8400-e29b-41d4-a716-446655440001',
      sku_id: 'IKEA-KALLAX-001',
      x_pct: 45.5,
      y_pct: 30.2,
      width_pct: 15.0,
      height_pct: 20.0,
      confidence: 0.95,
      label: 'KALLAX Shelf',
    });
    expect(result.x_pct).toBe(45.5);
    expect(result.confidence).toBe(0.95);
  });

  it('rejects x_pct > 100', () => {
    const result = CanvasHotspotSchema.safeParse({
      hotspot_id: '550e8400-e29b-41d4-a716-446655440000',
      project_id: '660e8400-e29b-41d4-a716-446655440001',
      sku_id: 'SKU-001',
      x_pct: 101,
      y_pct: 50,
      width_pct: 10,
      height_pct: 10,
      confidence: 0.5,
      label: 'Test',
    });
    expect(result.success).toBe(false);
  });
});

describe('AffiliateRedirectSchema', () => {
  it('parses valid affiliate redirect', () => {
    const result = AffiliateRedirectSchema.parse({
      click_id: '550e8400-e29b-41d4-a716-446655440000',
      sku_id: 'TGT-LAMP-003',
      retailer_id: 'TARGET',
      affiliate_url: 'https://www.target.com/p/lamp/-/A-12345678',
      timestamp: '2024-10-01T12:00:00Z',
    });
    expect(result.click_id).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
});
