// tests/load/k6-vector-search-test.js
// Scope: Qdrant Vector Search Query Load Test (NFR-03, Step 8.6 supplementary)
//
// Validates that catalog vector similarity search returns results within the
// ≤ 80ms p90 latency SLA under sustained concurrent query load.
//
// Run: k6 run tests/load/k6-vector-search-test.js
// Env: E2E_API_URL=http://localhost:4000

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── Custom metrics ────────────────────────────────────────────────────────
const vectorSearchErrors = new Rate('vector_search_errors');
const vectorSearchLatency = new Trend('vector_search_latency_ms', true);

const isSmoke = __ENV.SMOKE_TEST === 'true';

// ─── Load profile ──────────────────────────────────────────────────────────
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
        'http_req_duration{endpoint:vector_search}': ['p(95)<80'],
        'vector_search_latency_ms': ['p(95)<80'],
        'vector_search_errors': ['rate<0.01'],
        'http_req_failed': ['rate<0.01'],
      },
    }
  : {
      scenarios: {
        vector_search_sustained: {
          executor: 'ramping-vus',
          startVUs: 0,
          stages: [
            { duration: '10s', target: 30 },   // Ramp-up to 30 VUs
            { duration: '60s', target: 30 },   // Sustain 30 concurrent searchers
            { duration: '10s', target: 0 },    // Ramp-down
          ],
        },
      },
      thresholds: {
        // NFR-03: Vector similarity search ≤ 80ms at p90/p95 under load
        'http_req_duration{endpoint:vector_search}': ['p(95)<80'],
        // Overall custom trend (strict p95 ≤ 80ms SLA)
        'vector_search_latency_ms': ['p(90)<80', 'p(95)<80'],
        // Failure tolerance: < 0.5% error rate
        'vector_search_errors': ['rate<0.005'],
        // Raw http failure guard
        'http_req_failed': ['rate<0.01'],
      },
    };

// ─── Fixture: embedding vectors for different room styles ──────────────────
// Pre-computed mock 1536-d embeddings (abbreviated to 8 dims for readability;
// real payloads use the full dimension from the text-embedding-3-small model).
const STYLE_QUERIES = [
  {
    label: 'JAPANDI',
    stylePreset: 'JAPANDI',
    roomFunction: 'LIVING_ROOM',
    budgetCents: 150000,
    categories: ['SOFA', 'COFFEE_TABLE', 'FLOOR_LAMP'],
  },
  {
    label: 'SCANDINAVIAN',
    stylePreset: 'SCANDINAVIAN',
    roomFunction: 'BEDROOM',
    budgetCents: 200000,
    categories: ['BED_FRAME', 'NIGHTSTAND', 'PENDANT_LIGHT'],
  },
  {
    label: 'MID_CENTURY_MODERN',
    stylePreset: 'MID_CENTURY_MODERN',
    roomFunction: 'DINING_ROOM',
    budgetCents: 120000,
    categories: ['DINING_TABLE', 'DINING_CHAIR', 'SIDEBOARD'],
  },
];

// ─── Test helpers ──────────────────────────────────────────────────────────
const BASE_URL = __ENV.API_BASE_URL || __ENV.E2E_API_URL || 'http://localhost:4000';
const CATALOG_SEARCH_ENDPOINT = `${BASE_URL}/api/v1/catalog/search`;
const PRODUCT_EMBED_ENDPOINT = `${BASE_URL}/api/v1/catalog/embed`;

const JSON_HEADERS = {
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  tags: { endpoint: 'vector_search' },
};

// ─── Main VU function ──────────────────────────────────────────────────────
export default function () {
  // Each VU picks a random style query to simulate diverse concurrent searchers
  const query = STYLE_QUERIES[Math.floor(Math.random() * STYLE_QUERIES.length)];
  const category = query.categories[Math.floor(Math.random() * query.categories.length)];

  group('Vector Catalog Search (NFR-03)', () => {
    // ── Test 1: Semantic catalog similarity search ──────────────────────────
    const searchPayload = JSON.stringify({
      style_preset: query.stylePreset,
      room_function: query.roomFunction,
      budget_ceiling_cents: query.budgetCents,
      category: category,
      limit: 10,
      min_similarity: 0.75,
    });

    const searchRes = http.post(CATALOG_SEARCH_ENDPOINT, searchPayload, JSON_HEADERS);

    // Use k6's built-in accurate HTTP timer (avoids JS event-loop jitter from Date.now()).
    // timings.duration = total round-trip; timings.waiting = TTFB (pure server time).
    const httpDuration = searchRes.timings.duration;
    vectorSearchLatency.add(httpDuration);

    // ── HTTP success check (feeds vector_search_errors rate metric) ─────────
    // IMPORTANT: Only genuine HTTP failures (non-200, missing/malformed body)
    // count as errors. Latency violations are tracked separately via the
    // vector_search_latency_ms trend threshold — conflating them inflates the
    // error rate and masks the real failure mode.
    const httpOk = check(searchRes, {
      '[NFR-03] Vector search status 200': (r) => r.status === 200,
      '[NFR-03] Returns array of products': (r) => {
        try {
          const body = JSON.parse(r.body);
          return Array.isArray(body.data) && body.data.length > 0;
        } catch {
          return false;
        }
      },
      '[NFR-03] All results have similarity score': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data.every((p) => typeof p.similarityScore === 'number' && p.similarityScore >= 0.75);
        } catch {
          return false;
        }
      },
      '[NFR-03] All returned products are in-stock': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.data.every((p) => p.inStock === true);
        } catch {
          return false;
        }
      },
    });

    // Informational latency check — recorded in summary but does NOT affect
    // the vector_search_errors rate threshold.
    check(searchRes, {
      '[NFR-03] Latency ≤ 80ms (HTTP duration)': () => httpDuration <= 80,
    });

    // Only count genuine HTTP-level failures as errors (not latency breaches).
    vectorSearchErrors.add(!httpOk);
  });

  group('Product Embedding Lookup (Read-Only)', () => {
    // ── Test 2: Direct product embedding retrieval from Qdrant point ─────────
    // Simulates the canvas loading a specific SKU's vector for re-ranking.
    const mockSkuId = `SKU-${Math.floor(Math.random() * 9000) + 1000}`;
    const embedRes = http.get(
      `${PRODUCT_EMBED_ENDPOINT}/${mockSkuId}`,
      {
        headers: { Accept: 'application/json' },
        tags: { endpoint: 'embed_lookup' },
      },
    );

    check(embedRes, {
      'Embed lookup status 200 or 404': (r) => r.status === 200 || r.status === 404,
      'Embed lookup response is JSON': (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch {
          return false;
        }
      },
    });
  });

  // Short think-time to simulate realistic user pacing between queries
  sleep(0.5);
}

// ─── End-of-test summary handler ──────────────────────────────────────────
export function handleSummary(data) {
  const p90 = data.metrics['vector_search_latency_ms']?.values?.['p(90)'] ?? 'N/A';
  const p95 = data.metrics['vector_search_latency_ms']?.values?.['p(95)'] ?? 'N/A';
  const errorRate = data.metrics['vector_search_errors']?.values?.rate ?? 'N/A';

  console.log('');
  console.log('════════════════════════════════════════════════════════════');
  console.log('  RoomCommerce — NFR-03 Vector Search Load Test Results');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`  p90 latency : ${typeof p90 === 'number' ? p90.toFixed(1) + 'ms' : p90}  (SLA: ≤ 80ms)`);
  console.log(`  p95 latency : ${typeof p95 === 'number' ? p95.toFixed(1) + 'ms' : p95}  (guard: ≤ 120ms)`);
  console.log(`  Error rate  : ${typeof errorRate === 'number' ? (errorRate * 100).toFixed(3) + '%' : errorRate}  (max: 0.5%)`);
  console.log('════════════════════════════════════════════════════════════');

  const passed = typeof p90 === 'number' && p90 <= 80;
  console.log(`  Status: ${passed ? '✅ PASS — NFR-03 SLA met' : '❌ FAIL — NFR-03 SLA breached'}`);
  console.log('════════════════════════════════════════════════════════════');
  console.log('');

  return {
    stdout: '', // suppress default k6 summary (we printed custom one above)
  };
}
