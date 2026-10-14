import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthService } from '../../src/modules/health/health.service.js';
import { HealthController } from '../../src/modules/health/health.controller.js';

describe('HealthModule (NFR-04, Step 9.3)', () => {
  let healthService: HealthService;
  let healthController: HealthController;

  beforeEach(() => {
    healthService = new HealthService();
    healthController = new HealthController(healthService);
  });

  it('returns valid health structure with all subsystem checks', async () => {
    const health = await healthService.getHealth();

    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('timestamp');
    expect(health).toHaveProperty('version');
    expect(health.checks).toHaveProperty('api', true);
    expect(health.checks).toHaveProperty('database');
    expect(health.checks).toHaveProperty('redis');
    expect(health.checks).toHaveProperty('qdrant');
  });

  it('controller delegates to service and returns 200 or 503 HTTP status', async () => {
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await healthController.checkOverallHealth(mockRes as any);

    expect(mockRes.status).toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalled();
    const responsePayload = mockRes.json.mock.calls[0][0];
    expect(responsePayload).toHaveProperty('checks');
  });

  it('provides dedicated subsystem check for database', async () => {
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    await healthController.checkDb(mockRes as any);
    expect(mockRes.status).toHaveBeenCalled();
    expect(mockRes.json).toHaveBeenCalled();
  });
});
