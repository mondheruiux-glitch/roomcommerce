// tests/load/k6-burst-test.js
// Scope: k6 Concurrency & Load Stress Harness (NFR-05, Step 8.6, TASK-012)
import http from 'k6/http';
import { check, sleep } from 'k6';

const isSmoke = __ENV.SMOKE_TEST === 'true';

export const options = isSmoke
  ? {
      scenarios: {
        smoke: {
          executor: 'constant-vus',
          vus: 2,
          duration: '5s',
        },
      },
      thresholds: {
        http_req_duration: ['p(90)<15000'], // p90 latency <= 15.0s SLA
        http_req_failed: ['rate<0.01'],      // Failure rate < 1%
      },
    }
  : {
      scenarios: {
        gpu_burst: {
          executor: 'per-vu-iterations',
          vus: 50,              // 50 concurrent users (NFR-05)
          iterations: 1,
          maxDuration: '45s',
        },
      },
      thresholds: {
        http_req_duration: ['p(90)<15000'], // p90 latency <= 15.0s SLA
        http_req_failed: ['rate<0.01'],      // Failure rate < 1%
      },
    };

const BASE_URL = __ENV.API_BASE_URL || __ENV.E2E_API_URL || 'http://localhost:4000';

export default function () {
  const url = `${BASE_URL}/api/v1/projects`;
  const payload = JSON.stringify({
    style_preset: 'JAPANDI',
    room_function: 'LIVING_ROOM',
    budget_ceiling_cents: 150000,
    currency: 'USD',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-request-id': `k6-burst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
  };

  const res = http.post(url, payload, params);
  check(res, {
    'status is 201': (r) => r.status === 201,
    'has upload_url': (r) => {
      try {
        const body = JSON.parse(r.body);
        const data = body.data || body;
        return data && (data.upload_url !== undefined || data.uploadUrl !== undefined);
      } catch {
        return false;
      }
    },
    'has project_id': (r) => {
      try {
        const body = JSON.parse(r.body);
        const data = body.data || body;
        return data && (data.project_id !== undefined || data.projectId !== undefined);
      } catch {
        return false;
      }
    },
  });

  sleep(1);
}
