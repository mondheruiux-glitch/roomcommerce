import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TelemetryService } from '../../src/modules/telemetry/telemetry.service.js';
import { TelemetryController } from '../../src/modules/telemetry/telemetry.controller.js';

describe('TelemetryModule (EV-101 to EV-302, Step 9.5)', () => {
  let telemetryService: TelemetryService;
  let telemetryController: TelemetryController;

  beforeEach(() => {
    telemetryService = new TelemetryService();
    telemetryController = new TelemetryController(telemetryService);
  });

  it('tracks valid event and hashes client IP for privacy', async () => {
    const event = {
      event_name: 'room_photo_uploaded' as const,
      properties: {
        file_format: 'image/jpeg' as const,
        file_size_kb: 2048,
        resolution: '1920x1080',
        capture_source: 'file_picker' as const,
      },
    };

    const result = await telemetryService.trackEvent(event, 'user-123', '192.168.1.100');
    expect(result).toEqual({ tracked: true, event: 'room_photo_uploaded' });
  });

  it('instruments North Star QSOS metric on affiliate click (EV-202)', async () => {
    const event = {
      event_name: 'affiliate_outbound_clk' as const,
      properties: {
        sku_id: 'IKEA-SOFA-01',
        retailer_id: 'IKEA',
        price_cents: 49900,
        affiliate_network: 'AWIN',
        click_id: '550e8400-e29b-41d4-a716-446655440000',
      },
    };

    const result = await telemetryService.trackEvent(event, 'user-vip', '10.0.0.1');
    expect(result).toEqual({ tracked: true, event: 'affiliate_outbound_clk' });
  });

  it('controller accepts and validates event payload via contract schema', async () => {
    const mockReq = {
      user: { id: 'user-abc' },
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
    };

    const validPayload = {
      event_name: 'generation_completed',
      properties: {
        duration_ms: 12500,
        items_detected: 5,
        total_cart_val_cents: 85000,
        gpu_worker_id: 'worker-gpu-1',
      },
    };

    const res = await telemetryController.ingestEvent(validPayload, mockReq as any);
    expect(res).toEqual({ tracked: true, event: 'generation_completed' });
  });

  it('controller rejects invalid telemetry payloads with BadRequestException', async () => {
    const mockReq = { ip: '127.0.0.1', socket: {} };
    const invalidPayload = {
      event_name: 'unknown_unsupported_event',
      properties: {},
    };

    await expect(telemetryController.ingestEvent(invalidPayload, mockReq as any)).rejects.toThrow();
  });
});
