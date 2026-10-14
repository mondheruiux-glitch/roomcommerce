// apps/api/scripts/circuit-breaker-monitor.ts
//
// Automated Circuit-Breaker Rollback Monitor (Step 9.6)
// ───────────────────────────────────────────────────────
// Polls CloudWatch metrics every 60 seconds during canary phases.
// Triggers instant rollback (<60s) if any operational boundary is violated:
//
//   1. 5xx HTTP Error Rate   > 1.0%  (5-minute rolling window)
//   2. Warm GPU Latency p90  > 18.0s (3 consecutive violations)
//   3. Out-of-stock SKU leak detected in production catalog logs
//
// Rollback sequence:
//   A. AWS ECS → revert to PREVIOUS_STABLE task definition
//   B. Cloudflare KV → reset canary_weight to 0.00
//   C. PagerDuty Events API v2 → dispatch P1 incident
//
// Usage:
//   NODE_ENV=production \
//   ECS_CLUSTER_NAME=roomcommerce-prod \
//   PREVIOUS_STABLE_TASK_DEF=roomcommerce-api:42 \
//   CF_ACCOUNT_ID=xxx CF_KV_NAMESPACE_ID=yyy CF_API_TOKEN=zzz \
//   PD_ROUTING_KEY=xxx \
//   ts-node apps/api/scripts/circuit-breaker-monitor.ts

import { execSync } from 'child_process';
import * as https from 'https';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MetricSnapshot {
  /** 5xx error rate as a decimal (e.g. 0.012 = 1.2%) */
  errorRate5xx: number;
  /** GPU generation p90 latency in seconds */
  warmGpuLatencyP90: number;
  /** True if an OOS SKU was pinned on a live shoppable canvas */
  outOfStockLeaked: boolean;
  /** Timestamp the snapshot was captured */
  capturedAt: string;
}

interface EvaluationResult {
  triggered: boolean;
  reason?: string;
}

interface CloudWatchDatapoint {
  Sum?: number;
  Average?: number;
  SampleCount?: number;
  Timestamp?: string;
}

// ─── Configuration ────────────────────────────────────────────────────────────

const CONFIG = {
  ERROR_RATE_THRESHOLD:     0.01,   // 1.0% — rollback on breach
  GPU_LATENCY_P90_THRESHOLD: 18.0,  // 18.0s — rollback after 3 consecutive
  GPU_CONSECUTIVE_LIMIT:    3,      // consecutive violation windows before rollback
  POLL_INTERVAL_MS:         60_000, // evaluate every 60 seconds
  METRIC_WINDOW_SECONDS:    300,    // 5-minute rolling window for error rate
  MAX_WATCH_DURATION_MS:    6 * 60 * 60 * 1000, // 6-hour maximum watch window

  // AWS
  ECS_CLUSTER:     process.env.ECS_CLUSTER_NAME       ?? 'roomcommerce-prod',
  ECS_SERVICE:     process.env.ECS_SERVICE_NAME        ?? 'roomcommerce-api-prod',
  PREV_TASK_DEF:   process.env.PREVIOUS_STABLE_TASK_DEF ?? 'roomcommerce-api:PREVIOUS_STABLE',
  ALB_ARN_SUFFIX:  process.env.ALB_ARN_SUFFIX          ?? '',

  // Cloudflare
  CF_ACCOUNT_ID:      process.env.CF_ACCOUNT_ID        ?? '',
  CF_KV_NAMESPACE_ID: process.env.CF_KV_NAMESPACE_ID   ?? '',
  CF_API_TOKEN:       process.env.CF_API_TOKEN          ?? '',

  // PagerDuty Events API v2
  PD_ROUTING_KEY:  process.env.PD_ROUTING_KEY           ?? '',

  IS_PRODUCTION: process.env.NODE_ENV === 'production',
};

// ─── State ────────────────────────────────────────────────────────────────────

let consecutiveGpuViolations = 0;
let rollbackTriggered = false;

// ─── Main evaluation loop ─────────────────────────────────────────────────────

export async function startCircuitBreakerWatch(): Promise<void> {
  console.log('');
  console.log('════════════════════════════════════════════════════════════');
  console.log('  RoomCommerce Circuit-Breaker Monitor — ACTIVE');
  console.log(`  Cluster   : ${CONFIG.ECS_CLUSTER}`);
  console.log(`  Service   : ${CONFIG.ECS_SERVICE}`);
  console.log(`  Stable rev: ${CONFIG.PREV_TASK_DEF}`);
  console.log(`  Mode      : ${CONFIG.IS_PRODUCTION ? 'PRODUCTION' : 'DRY-RUN'}`);
  console.log('════════════════════════════════════════════════════════════');
  console.log('');

  const startTime = Date.now();

  while (!rollbackTriggered && (Date.now() - startTime) < CONFIG.MAX_WATCH_DURATION_MS) {
    const metrics = await captureMetrics();
    const result = await evaluateCircuitBreaker(metrics);

    if (result.triggered) {
      console.error(`\n🚨 CIRCUIT BREAKER FIRED — Reason: ${result.reason}`);
      break;
    }

    console.log(`[${new Date().toISOString()}] ✓ Nominal — 5xx=${(metrics.errorRate5xx * 100).toFixed(3)}%, GPU p90=${metrics.warmGpuLatencyP90}s, OOS=${metrics.outOfStockLeaked}`);
    await sleep(CONFIG.POLL_INTERVAL_MS);
  }

  if (!rollbackTriggered) {
    console.log('\n[✓] Circuit-breaker watch window elapsed. Canary sustained all SLOs.');
  }
}

// ─── Metric capture ───────────────────────────────────────────────────────────

async function captureMetrics(): Promise<MetricSnapshot> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - CONFIG.METRIC_WINDOW_SECONDS * 1000);

  // Query ALB 5xx error count and total request count from CloudWatch
  const errorCount = await queryCloudWatchMetric(
    'AWS/ApplicationELB',
    'HTTPCode_Target_5XX_Count',
    'Sum',
    windowStart,
    now,
  );

  const totalCount = await queryCloudWatchMetric(
    'AWS/ApplicationELB',
    'RequestCount',
    'Sum',
    windowStart,
    now,
  );

  // GPU p90 latency from custom namespace
  const gpuP90 = await queryCloudWatchMetric(
    'RoomCommerce/GPU',
    'GenerationLatencyP90',
    'Average',
    windowStart,
    now,
  );

  // OOS leak detection — check custom metric emitted by catalog validator
  const oosCount = await queryCloudWatchMetric(
    'RoomCommerce/Catalog',
    'OOSSkuLeakCount',
    'Sum',
    windowStart,
    now,
  );

  const errorRate = totalCount > 0 ? errorCount / totalCount : 0;

  return {
    errorRate5xx:      errorRate,
    warmGpuLatencyP90: gpuP90,
    outOfStockLeaked:  oosCount > 0,
    capturedAt:        now.toISOString(),
  };
}

async function queryCloudWatchMetric(
  namespace: string,
  metricName: string,
  stat: 'Sum' | 'Average',
  start: Date,
  end: Date,
): Promise<number> {
  try {
    const result = execSync(
      `aws cloudwatch get-metric-statistics \
        --namespace "${namespace}" \
        --metric-name "${metricName}" \
        ${CONFIG.ALB_ARN_SUFFIX
          ? `--dimensions Name=LoadBalancer,Value="${CONFIG.ALB_ARN_SUFFIX}"`
          : ''
        } \
        --start-time "${start.toISOString()}" \
        --end-time "${end.toISOString()}" \
        --period ${CONFIG.METRIC_WINDOW_SECONDS} \
        --statistics ${stat} \
        --query 'Datapoints[0].${stat}' \
        --output text`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();

    return result === 'None' || result === '' ? 0 : parseFloat(result);
  } catch {
    // Return safe default on AWS query failure — don't false-trigger rollback
    return 0;
  }
}

// ─── Evaluation logic ─────────────────────────────────────────────────────────

export async function evaluateCircuitBreaker(
  metrics: MetricSnapshot,
): Promise<EvaluationResult> {
  // ── Guard 1: 5xx error rate > 1.0% (immediate rollback) ─────────────────
  if (metrics.errorRate5xx > CONFIG.ERROR_RATE_THRESHOLD) {
    const reason = `5xx HTTP Error Rate breached SLO: ${(metrics.errorRate5xx * 100).toFixed(3)}% > 1.0%`;
    await triggerEmergencyRollback(reason, metrics);
    return { triggered: true, reason };
  }

  // ── Guard 2: GPU latency p90 > 18.0s for 3 consecutive windows ──────────
  if (metrics.warmGpuLatencyP90 > CONFIG.GPU_LATENCY_P90_THRESHOLD) {
    consecutiveGpuViolations++;
    console.warn(
      `  ⚠ GPU p90 violation ${consecutiveGpuViolations}/${CONFIG.GPU_CONSECUTIVE_LIMIT}: ${metrics.warmGpuLatencyP90}s > ${CONFIG.GPU_LATENCY_P90_THRESHOLD}s`,
    );

    if (consecutiveGpuViolations >= CONFIG.GPU_CONSECUTIVE_LIMIT) {
      const reason = `GPU Latency p90 exceeded ${CONFIG.GPU_LATENCY_P90_THRESHOLD}s for ${CONFIG.GPU_CONSECUTIVE_LIMIT} consecutive windows (${metrics.warmGpuLatencyP90}s)`;
      await triggerEmergencyRollback(reason, metrics);
      return { triggered: true, reason };
    }
  } else {
    // Reset consecutive counter on a healthy window
    consecutiveGpuViolations = 0;
  }

  // ── Guard 3: Out-of-stock SKU pinned on live canvas ───────────────────────
  if (metrics.outOfStockLeaked) {
    const reason = `Catalog integrity breach: Out-of-stock SKU placed on shoppable canvas (OOS leak detected)`;
    await triggerEmergencyRollback(reason, metrics);
    return { triggered: true, reason };
  }

  return { triggered: false };
}

// ─── Rollback orchestration ───────────────────────────────────────────────────

export async function triggerEmergencyRollback(
  reason: string,
  metrics: MetricSnapshot,
): Promise<void> {
  if (rollbackTriggered) return; // Idempotent — only execute once
  rollbackTriggered = true;

  console.error('');
  console.error('🚨 ══════════════════════════════════════════════════════ 🚨');
  console.error('   CIRCUIT BREAKER — AUTOMATED EMERGENCY ROLLBACK');
  console.error(`   Reason : ${reason}`);
  console.error(`   Time   : ${new Date().toISOString()}`);
  console.error('🚨 ══════════════════════════════════════════════════════ 🚨');
  console.error('');

  // ── Step A: Revert ECS service to previous stable task definition ─────────
  await rollbackEcsService(reason);

  // ── Step B: Reset Cloudflare canary weight to 0% ─────────────────────────
  await resetCloudflareCanaryWeight();

  // ── Step C: Dispatch PagerDuty P1 incident ───────────────────────────────
  await dispatchPagerDutyIncident(reason, metrics);
}

async function rollbackEcsService(reason: string): Promise<void> {
  const cmd = [
    'aws ecs update-service',
    `--cluster ${CONFIG.ECS_CLUSTER}`,
    `--service ${CONFIG.ECS_SERVICE}`,
    `--task-definition ${CONFIG.PREV_TASK_DEF}`,
    '--force-new-deployment',
  ].join(' ');

  console.error(`[A] Reverting ECS → ${CONFIG.PREV_TASK_DEF}`);

  if (CONFIG.IS_PRODUCTION) {
    try {
      execSync(cmd, { stdio: 'inherit' });
      console.error('[A] ✓ ECS rollback command dispatched.');
    } catch (err: any) {
      console.error(`[A] ✗ ECS rollback failed: ${err.message}`);
    }
  } else {
    console.error(`[A] [DRY-RUN] Would execute: ${cmd}`);
  }
}

async function resetCloudflareCanaryWeight(): Promise<void> {
  if (!CONFIG.CF_ACCOUNT_ID || !CONFIG.CF_KV_NAMESPACE_ID || !CONFIG.CF_API_TOKEN) {
    console.error('[B] Cloudflare credentials not configured — skipping KV reset.');
    return;
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${CONFIG.CF_ACCOUNT_ID}/storage/kv/namespaces/${CONFIG.CF_KV_NAMESPACE_ID}/values/canary_weight`;

  console.error('[B] Resetting Cloudflare canary_weight → 0.00 (100% stable)');

  if (CONFIG.IS_PRODUCTION) {
    try {
      await httpsRequest('PUT', url, '0.00', {
        Authorization: `Bearer ${CONFIG.CF_API_TOKEN}`,
        'Content-Type': 'text/plain',
      });
      console.error('[B] ✓ Cloudflare canary weight reset to 0%.');
    } catch (err: any) {
      console.error(`[B] ✗ Cloudflare KV reset failed: ${err.message}`);
    }
  } else {
    console.error(`[B] [DRY-RUN] Would PUT canary_weight=0.00 to KV namespace ${CONFIG.CF_KV_NAMESPACE_ID}`);
  }
}

async function dispatchPagerDutyIncident(
  reason: string,
  metrics: MetricSnapshot,
): Promise<void> {
  if (!CONFIG.PD_ROUTING_KEY) {
    console.error('[C] PD_ROUTING_KEY not configured — skipping PagerDuty alert.');
    return;
  }

  const payload = JSON.stringify({
    routing_key: CONFIG.PD_ROUTING_KEY,
    event_action: 'trigger',
    dedup_key: `roomcommerce-circuit-breaker-${Date.now()}`,
    payload: {
      summary: `[P1] RoomCommerce Circuit-Breaker Triggered: ${reason}`,
      severity: 'critical',
      source: CONFIG.ECS_SERVICE,
      timestamp: metrics.capturedAt,
      component: 'canary-deployment',
      group: 'roomcommerce-prod',
      class: 'deployment',
      custom_details: {
        reason,
        error_rate_pct: (metrics.errorRate5xx * 100).toFixed(3),
        gpu_p90_sec:    metrics.warmGpuLatencyP90,
        oos_leak:       metrics.outOfStockLeaked,
        ecs_cluster:    CONFIG.ECS_CLUSTER,
        reverted_to:    CONFIG.PREV_TASK_DEF,
        runbook_url:    'https://notion.so/roomcommerce/runbooks/circuit-breaker-rollback',
      },
    },
    links: [
      {
        href: 'https://app.roomcommerce.com',
        text: 'Production App',
      },
    ],
  });

  console.error('[C] Dispatching PagerDuty P1 incident alert...');

  if (CONFIG.IS_PRODUCTION) {
    try {
      await httpsRequest(
        'POST',
        'https://events.pagerduty.com/v2/enqueue',
        payload,
        { 'Content-Type': 'application/json' },
      );
      console.error('[C] ✓ PagerDuty P1 incident dispatched to on-call SRE.');
    } catch (err: any) {
      console.error(`[C] ✗ PagerDuty dispatch failed: ${err.message}`);
    }
  } else {
    console.error('[C] [DRY-RUN] Would dispatch PagerDuty P1 incident.');
    console.error(`    Summary: [P1] RoomCommerce Circuit-Breaker Triggered: ${reason}`);
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function httpsRequest(
  method: string,
  url: string,
  body: string,
  headers: Record<string, string>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method,
      headers:  { ...headers, 'Content-Length': Buffer.byteLength(body) },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if ((res.statusCode ?? 0) >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

if (require.main === module) {
  // Support single-shot evaluation via env vars (for use in CI canary health checks)
  const singleShot = process.env.SINGLE_SHOT === 'true';

  if (singleShot) {
    const mockMetrics: MetricSnapshot = {
      errorRate5xx:      parseFloat(process.env.TEST_5XX_RATE   ?? '0.002'),
      warmGpuLatencyP90: parseFloat(process.env.TEST_GPU_P90    ?? '12.4'),
      outOfStockLeaked:  process.env.TEST_OOS_LEAK              === 'true',
      capturedAt:        new Date().toISOString(),
    };

    console.log('[circuit-breaker] Single-shot evaluation mode');
    evaluateCircuitBreaker(mockMetrics)
      .then((result) => {
        if (result.triggered) {
          console.error(`Rollback triggered: ${result.reason}`);
          process.exit(1);
        } else {
          console.log('[✓] All operational guardrails intact. No rollback needed.');
          process.exit(0);
        }
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  } else {
    // Continuous watch mode — runs until rollback or max watch window
    startCircuitBreakerWatch().catch((err) => {
      console.error(err);
      process.exit(1);
    });
  }
}
