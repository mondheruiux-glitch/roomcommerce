#!/usr/bin/env tsx
/**
 * preflight-verify.ts — Production Readiness Gate Verifier (Wave 6, TASK-004 to TASK-007)
 *
 * Probes 7 production readiness gates with 3,000 ms timeouts each and
 * renders a clean ASCII scorecard.
 *
 * Usage:
 *   pnpm preflight                    # Diagnostic mode -- always exits 0
 *   pnpm preflight -- --strict-prod   # Strict mode -- exits 1 on any mock/offline gate
 *   pnpm preflight -- --json          # Machine-readable JSON output
 *   pnpm preflight -- --help          # Print usage
 *
 * Gates:
 *   1. Environment & Secrets Audit
 *   2. PostgreSQL 16 Connectivity
 *   3. Redis 7 (BullMQ) Connectivity
 *   4. Qdrant Vector Cluster (retail_catalog_v1)
 *   5. Cloudflare R2 Storage Configuration
 *   6. Modal Serverless GPU Endpoint
 *   7. Stripe Billing Configuration
 */

import { Pool } from 'pg';
import Redis from 'ioredis';
import { config as dotenvConfig } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Auto-load .env if present, otherwise fallback to .env.example defaults
const cwdEnv = path.resolve(process.cwd(), '.env');
const rootEnv = path.resolve(__dirname, '../../../.env');
const cwdEnvExample = path.resolve(process.cwd(), '.env.example');
const rootEnvExample = path.resolve(__dirname, '../../../.env.example');

if (fs.existsSync(cwdEnv)) {
  dotenvConfig({ path: cwdEnv });
} else if (fs.existsSync(rootEnv)) {
  dotenvConfig({ path: rootEnv });
}

if (fs.existsSync(cwdEnvExample)) {
  dotenvConfig({ path: cwdEnvExample, override: false });
} else if (fs.existsSync(rootEnvExample)) {
  dotenvConfig({ path: rootEnvExample, override: false });
}

// --- CLI flag parsing --------------------------------------------------------
const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log(`
  preflight-verify -- RoomCommerce Production Readiness Gate Verifier

  USAGE
    pnpm preflight                    Diagnostic mode (always exits 0)
    pnpm preflight -- --strict-prod   Strict mode (exits 1 on any mock/offline gate)
    pnpm preflight -- --json          JSON output for CI integrations
    pnpm preflight -- --help          Show this help text

  GATES PROBED
    1. Environment & Secrets Audit    Inspects required env vars for live vs mock values
    2. PostgreSQL 16 Connectivity     SELECT 1 via pg pool (3s timeout)
    3. Redis 7 (BullMQ) Connectivity  PING via ioredis (2s connect timeout)
    4. Qdrant Vector Cluster          HTTP probe of retail_catalog_v1 collection
    5. Cloudflare R2 Configuration    Checks live vs mock R2 credentials
    6. Modal GPU Endpoint             Checks live .modal.run URL vs MODAL_MOCK_MODE
    7. Stripe Billing                 Identifies LIVE vs TEST mode key + webhook secret

  EXIT CODES
    0   All gates passed (or diagnostic mode -- never strict)
    1   One or more gates failed in --strict-prod mode
  `);
  process.exit(0);
}

const IS_STRICT = args.includes('--strict-prod');
const IS_JSON   = args.includes('--json');
const TIMEOUT   = 3_000;

// --- Env snapshot ------------------------------------------------------------
const ENV = {
  DATABASE_URL:                    process.env['DATABASE_URL']                    ?? '',
  REDIS_URL:                       process.env['REDIS_URL']                       ?? '',
  QDRANT_URL:                      process.env['QDRANT_URL']                      ?? '',
  QDRANT_API_KEY:                  process.env['QDRANT_API_KEY']                  ?? '',
  CLOUDFLARE_R2_ACCOUNT_ID:        process.env['CLOUDFLARE_R2_ACCOUNT_ID']        ?? '',
  CLOUDFLARE_R2_ACCESS_KEY_ID:     process.env['CLOUDFLARE_R2_ACCESS_KEY_ID']     ?? '',
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: process.env['CLOUDFLARE_R2_SECRET_ACCESS_KEY'] ?? '',
  STRIPE_SECRET_KEY:               process.env['STRIPE_SECRET_KEY']               ?? '',
  STRIPE_WEBHOOK_SECRET:           process.env['STRIPE_WEBHOOK_SECRET']           ?? '',
  MODAL_API_ENDPOINT:              process.env['MODAL_API_ENDPOINT']              ?? '',
  MODAL_MOCK_MODE:                 process.env['MODAL_MOCK_MODE']                 ?? '',
};

// --- Gate result type --------------------------------------------------------
type GateStatus = 'READY' | 'WARN' | 'MOCK' | 'OFFLINE';

interface GateResult {
  id:      number;
  name:    string;
  status:  GateStatus;
  detail:  string;
  action?: string;
}

// Helper: Promise.race with a timeout rejection
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

// Helper: detect mock/local placeholder values
function isMock(val: string): boolean {
  return (
    val.startsWith('mock_') ||
    val.startsWith('sk_test_') ||
    val.startsWith('whsec_mock_') ||
    val.includes('localhost') ||
    val.includes('127.0.0.1') ||
    val.includes('<') ||
    val.includes('>') ||
    val.startsWith('your_') ||
    val === ''
  );
}

// --- Gate 1: Environment & Secrets Audit ------------------------------------
async function checkEnvSecrets(): Promise<GateResult> {
  const required: Record<string, string> = {
    DATABASE_URL:             ENV.DATABASE_URL,
    REDIS_URL:                ENV.REDIS_URL,
    QDRANT_URL:               ENV.QDRANT_URL,
    CLOUDFLARE_R2_ACCOUNT_ID: ENV.CLOUDFLARE_R2_ACCOUNT_ID,
    STRIPE_SECRET_KEY:        ENV.STRIPE_SECRET_KEY,
    MODAL_API_ENDPOINT:       ENV.MODAL_API_ENDPOINT,
  };

  const missing = Object.entries(required).filter(([, v]) => v === '').map(([k]) => k);
  const mocked  = Object.entries(required).filter(([, v]) => v !== '' && isMock(v)).map(([k]) => k);
  const live    = Object.keys(required).length - missing.length - mocked.length;

  if (missing.length > 0) {
    return {
      id: 1, name: 'Environment & Secrets Audit', status: 'OFFLINE',
      detail: `${missing.length} required env vars MISSING: ${missing.join(', ')}`,
    };
  }
  if (mocked.length > 0) {
    return {
      id: 1, name: 'Environment & Secrets Audit', status: 'MOCK',
      detail: `${live}/${Object.keys(required).length} live  |  Mock: ${mocked.join(', ')}`,
    };
  }
  return {
    id: 1, name: 'Environment & Secrets Audit', status: 'READY',
    detail: `All ${Object.keys(required).length} required env vars configured with live credentials`,
  };
}

// --- Gate 2: PostgreSQL 16 Connectivity -------------------------------------
async function checkPostgres(): Promise<GateResult> {
  if (!ENV.DATABASE_URL || isMock(ENV.DATABASE_URL)) {
    return {
      id: 2, name: 'PostgreSQL 16 Connectivity', status: 'MOCK',
      detail: 'DATABASE_URL is local/mock -- skipping live connectivity probe',
    };
  }

  const pool = new Pool({ connectionString: ENV.DATABASE_URL, connectionTimeoutMillis: TIMEOUT, max: 1 });
  try {
    await withTimeout(pool.query('SELECT 1 AS ok'), TIMEOUT, 'PostgreSQL');
    await pool.end();
    return {
      id: 2, name: 'PostgreSQL 16 Connectivity', status: 'READY',
      detail: `SELECT 1 succeeded  |  ${ENV.DATABASE_URL.split('@')[1] ?? '(URL masked)'}`,
    };
  } catch (err) {
    await pool.end().catch(() => undefined);
    return {
      id: 2, name: 'PostgreSQL 16 Connectivity', status: 'OFFLINE',
      detail: `Connection failed: ${(err as Error).message}`,
    };
  }
}

// --- Gate 3: Redis 7 (BullMQ) Connectivity ----------------------------------
async function checkRedis(): Promise<GateResult> {
  if (!ENV.REDIS_URL || isMock(ENV.REDIS_URL)) {
    return {
      id: 3, name: 'Redis 7 (BullMQ) Connectivity', status: 'MOCK',
      detail: 'REDIS_URL is local/mock -- skipping live connectivity probe',
    };
  }

  const redis = new Redis(ENV.REDIS_URL, {
    connectTimeout: 2_000,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    lazyConnect: true,
  });

  try {
    await withTimeout(redis.connect().then(() => redis.ping()), TIMEOUT, 'Redis');
    await redis.quit();
    return {
      id: 3, name: 'Redis 7 (BullMQ) Connectivity', status: 'READY',
      detail: `PONG received  |  ${ENV.REDIS_URL.split('@').pop() ?? '(URL masked)'}`,
    };
  } catch (err) {
    redis.disconnect();
    return {
      id: 3, name: 'Redis 7 (BullMQ) Connectivity', status: 'OFFLINE',
      detail: `Connection failed: ${(err as Error).message}`,
    };
  }
}

// --- Gate 4: Qdrant Vector Cluster ------------------------------------------
async function checkQdrant(): Promise<GateResult> {
  const url = ENV.QDRANT_URL;

  if (!url || isMock(url)) {
    return {
      id: 4, name: 'Qdrant Vector Cluster (retail_catalog_v1)', status: 'MOCK',
      detail: 'QDRANT_URL is local/mock -- provision managed cluster on cloud.qdrant.io',
      action: 'pnpm api:embed',
    };
  }

  const collectionUrl = `${url.replace(/\/$/, '')}/collections/retail_catalog_v1`;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (ENV.QDRANT_API_KEY && !isMock(ENV.QDRANT_API_KEY)) headers['api-key'] = ENV.QDRANT_API_KEY;

    const res = await withTimeout(fetch(collectionUrl, { headers }), TIMEOUT, 'Qdrant');
    if (res.ok) {
      const body = await res.json() as { result?: { status?: string; vectors_count?: number } };
      const collStatus = body?.result?.status ?? 'unknown';
      const vectors    = body?.result?.vectors_count ?? '?';
      return {
        id: 4, name: 'Qdrant Vector Cluster (retail_catalog_v1)', status: 'READY',
        detail: `Collection status: ${collStatus}  |  ${vectors} vectors indexed`,
      };
    }
    if (res.status === 404) {
      return {
        id: 4, name: 'Qdrant Vector Cluster (retail_catalog_v1)', status: 'OFFLINE',
        detail: 'Collection retail_catalog_v1 not found',
        action: 'pnpm api:embed',
      };
    }
    return {
      id: 4, name: 'Qdrant Vector Cluster (retail_catalog_v1)', status: 'OFFLINE',
      detail: `HTTP ${res.status} from ${collectionUrl}`,
    };
  } catch (err) {
    return {
      id: 4, name: 'Qdrant Vector Cluster (retail_catalog_v1)', status: 'OFFLINE',
      detail: `Probe failed: ${(err as Error).message}`,
    };
  }
}

// --- Gate 5: Cloudflare R2 Storage Configuration ----------------------------
async function checkR2(): Promise<GateResult> {
  const accountId = ENV.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKey = ENV.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretKey = ENV.CLOUDFLARE_R2_SECRET_ACCESS_KEY;

  const mockFields: string[] = [];
  if (isMock(accountId)) mockFields.push('CLOUDFLARE_R2_ACCOUNT_ID');
  if (isMock(accessKey)) mockFields.push('CLOUDFLARE_R2_ACCESS_KEY_ID');
  if (isMock(secretKey)) mockFields.push('CLOUDFLARE_R2_SECRET_ACCESS_KEY');

  if (mockFields.length > 0) {
    return {
      id: 5, name: 'Cloudflare R2 Storage Configuration', status: 'MOCK',
      detail: `Mock credentials: ${mockFields.join(', ')}  |  7-day lifecycle NOT enforced`,
      action: 'pnpm api:r2-lifecycle',
    };
  }
  return {
    id: 5, name: 'Cloudflare R2 Storage Configuration', status: 'READY',
    detail: 'Live credentials configured  |  Apply 7-day purge rule once (SEC-01)',
    action: 'pnpm api:r2-lifecycle',
  };
}

// --- Gate 6: Modal Serverless GPU Endpoint -----------------------------------
async function checkModal(): Promise<GateResult> {
  const endpoint = ENV.MODAL_API_ENDPOINT;
  const mockMode = ENV.MODAL_MOCK_MODE === 'true';

  if (mockMode || isMock(endpoint)) {
    return {
      id: 6, name: 'Modal Serverless GPU Endpoint', status: 'MOCK',
      detail: mockMode
        ? 'MODAL_MOCK_MODE=true -- GPU calls disabled; local inference stub active'
        : 'MODAL_API_ENDPOINT is a placeholder URL -- deploy via Modal CLI before cutover',
      action: 'pnpm gpu:deploy',
    };
  }

  if (!endpoint || !endpoint.includes('.modal.run')) {
    return {
      id: 6, name: 'Modal Serverless GPU Endpoint', status: 'WARN',
      detail: `MODAL_API_ENDPOINT is not a live .modal.run URL: "${endpoint}"`,
      action: 'pnpm gpu:deploy',
    };
  }

  try {
    const res = await withTimeout(fetch(endpoint, { method: 'HEAD' }), TIMEOUT, 'Modal');
    const gateStatus: GateStatus = res.status < 500 ? 'READY' : 'OFFLINE';
    return {
      id: 6, name: 'Modal Serverless GPU Endpoint', status: gateStatus,
      detail: `HEAD ${endpoint} -> HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      id: 6, name: 'Modal Serverless GPU Endpoint', status: 'OFFLINE',
      detail: `Probe failed: ${(err as Error).message}`,
      action: 'pnpm gpu:deploy',
    };
  }
}

// --- Gate 7: Stripe Billing Configuration ------------------------------------
async function checkStripe(): Promise<GateResult> {
  const key     = ENV.STRIPE_SECRET_KEY;
  const webhook = ENV.STRIPE_WEBHOOK_SECRET;

  const mode: 'LIVE' | 'TEST' | 'MOCK' =
    key.startsWith('sk_live_') ? 'LIVE' :
    key.startsWith('sk_test_') ? 'TEST' : 'MOCK';

  const webhookOk   = Boolean(webhook && !isMock(webhook));
  const webhookNote = webhookOk ? 'Webhook secret configured' : 'Webhook secret MISSING or mocked';

  if (mode === 'MOCK') {
    return { id: 7, name: 'Stripe Billing Configuration', status: 'MOCK',
      detail: `Key mode: MOCK  |  ${webhookNote}` };
  }
  if (mode === 'TEST') {
    return { id: 7, name: 'Stripe Billing Configuration', status: 'WARN',
      detail: `Key mode: TEST (sk_test_*)  |  ${webhookNote}  |  Switch to live key before cutover` };
  }
  return { id: 7, name: 'Stripe Billing Configuration', status: 'READY',
    detail: `Key mode: LIVE (sk_live_*)  |  ${webhookNote}` };
}

// --- Status helpers -----------------------------------------------------------
const STATUS_ICON: Record<GateStatus, string> = {
  READY:   '  READY  ',
  WARN:    '  WARN   ',
  MOCK:    '  MOCK   ',
  OFFLINE: '  OFFLINE',
};

const STATUS_LABEL: Record<GateStatus, string> = {
  READY:   '[OK]',
  WARN:    '[WARN]',
  MOCK:    '[MOCK]',
  OFFLINE: '[FAIL]',
};

const STATUS_STRICT_FAIL: GateStatus[] = ['MOCK', 'OFFLINE'];

// --- Render ASCII scorecard --------------------------------------------------
function renderTable(results: GateResult[], elapsed: number): void {
  const border = '='.repeat(96);
  const divider = '-'.repeat(96);

  console.log('');
  console.log(border);
  console.log('  ROOMCOMMERCE -- PRODUCTION READINESS SCORECARD');
  console.log(border);
  console.log('');

  for (const r of results) {
    const label = STATUS_LABEL[r.status].padEnd(8);
    console.log(`  [${r.id}] ${label}  ${r.name}`);
    console.log(`         ${r.detail}`);
    if (r.action) {
      console.log(`         Run: ${r.action}`);
    }
    console.log('');
  }

  console.log(divider);

  const failCount = results.filter(r => STATUS_STRICT_FAIL.includes(r.status)).length;
  const warnCount = results.filter(r => r.status === 'WARN').length;
  const okCount   = results.filter(r => r.status === 'READY').length;

  console.log(`  Gates: ${okCount} READY  |  ${warnCount} WARN  |  ${failCount} MOCK/OFFLINE   (${elapsed}ms)`);
  console.log('');

  if (IS_STRICT && failCount > 0) {
    console.log('  STRICT-PROD FAIL: one or more gates are MOCK or OFFLINE. Refusing to proceed.');
  } else if (IS_STRICT) {
    console.log('  STRICT-PROD PASS: all gates passed. Safe to deploy.');
  } else {
    console.log('  Diagnostic mode. Re-run with --strict-prod before production cutover.');
  }
  console.log('');
}

// --- Main --------------------------------------------------------------------
async function main(): Promise<void> {
  const start = Date.now();

  if (!IS_JSON) {
    console.log('\n  Running preflight checks...');
  }

  const results = await Promise.all([
    checkEnvSecrets(),
    checkPostgres(),
    checkRedis(),
    checkQdrant(),
    checkR2(),
    checkModal(),
    checkStripe(),
  ]);

  const elapsed = Date.now() - start;

  if (IS_JSON) {
    console.log(JSON.stringify({ elapsed, gates: results }, null, 2));
  } else {
    renderTable(results, elapsed);
  }

  const strictFails = results.filter(r => STATUS_STRICT_FAIL.includes(r.status));
  if (IS_STRICT && strictFails.length > 0) {
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('preflight-verify: fatal error:', err);
  process.exit(1);
});
