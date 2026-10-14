/**
 * infra/cloudflare/canary-router.worker.js
 *
 * Cloudflare Worker — Canary Traffic Router (TASK-014)
 * ───────────────────────────────────────────────────
 * Implements weight-based traffic splitting between stable and canary
 * origin pools for Project RoomCommerce with sticky sessions and automated
 * 5xx fallback to stable.
 *
 * Staged Rollout Phases:
 *   - Phase 1 (10% for 2h):  canary_weight = 0.10
 *   - Phase 2 (50% for 4h):  canary_weight = 0.50
 *   - Phase 3 (100% cutover): canary_weight = 1.00
 *
 * Configuration is stored in Cloudflare KV (CANARY_CONFIG namespace):
 *   - canary_weight  : float [0.0–1.0]  (e.g. 0.10 = 10% canary)
 *   - canary_tag     : string            (e.g. "v1.4.2")
 *   - stable_origin  : string            (e.g. "https://stable.roomcommerce.internal")
 *   - canary_origin  : string            (e.g. "https://canary.roomcommerce.internal")
 *
 * Bindings required (wrangler.toml):
 *   [[kv_namespaces]]
 *   binding = "CANARY_CONFIG"
 *   id      = "<kv_namespace_id>"
 */

export default {
  /**
   * @param {Request} request
   * @param {{ CANARY_CONFIG: KVNamespace }} env
   * @param {ExecutionContext} ctx
   * @returns {Promise<Response>}
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── 1. Read canary config from KV (with safe defaults) ──────────────────
    let canaryWeightRaw = '0';
    let stableOrigin = 'https://stable.roomcommerce.internal';
    let canaryOrigin = 'https://canary.roomcommerce.internal';
    let canaryTag = 'v0.0.0';

    if (env && env.CANARY_CONFIG) {
      try {
        const [w, s, c, t] = await Promise.all([
          env.CANARY_CONFIG.get('canary_weight'),
          env.CANARY_CONFIG.get('stable_origin'),
          env.CANARY_CONFIG.get('canary_origin'),
          env.CANARY_CONFIG.get('canary_tag'),
        ]);
        if (w !== null) canaryWeightRaw = w;
        if (s !== null) stableOrigin = s;
        if (c !== null) canaryOrigin = c;
        if (t !== null) canaryTag = t;
      } catch (err) {
        console.warn(`[canary-router] KV lookup failed, using defaults: ${err}`);
      }
    }

    const canaryWeight = Math.min(Math.max(parseFloat(canaryWeightRaw || '0') || 0, 0), 1);
    const stable = stableOrigin || 'https://stable.roomcommerce.internal';
    const canary = canaryOrigin || 'https://canary.roomcommerce.internal';

    // ── 2. Sticky session — check prc_canary_cohort (or legacy rc_canary_bucket) ──
    const cookieHeader = request.headers.get('Cookie') ?? '';
    const existingCohort =
      parseCookie(cookieHeader, 'prc_canary_cohort') ||
      parseCookie(cookieHeader, 'rc_canary_bucket');

    let isCanary = false;

    if (existingCohort === 'canary') {
      isCanary = true;
    } else if (existingCohort === 'stable') {
      isCanary = false;
    } else {
      // Probabilistic cohort assignment based on configured weight
      isCanary = Math.random() < canaryWeight;
    }

    // ── 3. Upstream Dispatch with 5xx Automatic Fallback to Stable ──────────
    let response;
    let effectiveCohort = isCanary ? 'canary' : 'stable';
    let fallbackTriggered = false;

    if (isCanary) {
      try {
        const canaryTargetUrl = new URL(url.pathname + url.search, canary);
        const canaryReq = new Request(canaryTargetUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.body,
          redirect: 'follow',
        });

        response = await fetch(canaryReq);

        // Circuit-breaker: automatic fallback to stable origin on 5xx errors
        if (response.status >= 500) {
          console.warn(
            `[canary-router] Canary origin returned ${response.status} for ${url.pathname}. Falling back to stable origin.`,
          );
          fallbackTriggered = true;
          const stableTargetUrl = new URL(url.pathname + url.search, stable);
          const fallbackReq = new Request(stableTargetUrl.toString(), {
            method: request.method,
            headers: request.headers,
            body: request.body,
            redirect: 'follow',
          });
          response = await fetch(fallbackReq);
          effectiveCohort = 'stable';
        }
      } catch (err) {
        console.warn(
          `[canary-router] Canary fetch error for ${url.pathname}: ${err}. Falling back to stable origin.`,
        );
        fallbackTriggered = true;
        const stableTargetUrl = new URL(url.pathname + url.search, stable);
        const fallbackReq = new Request(stableTargetUrl.toString(), {
          method: request.method,
          headers: request.headers,
          body: request.body,
          redirect: 'follow',
        });
        response = await fetch(fallbackReq);
        effectiveCohort = 'stable';
      }
    } else {
      const stableTargetUrl = new URL(url.pathname + url.search, stable);
      const stableReq = new Request(stableTargetUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'follow',
      });
      response = await fetch(stableReq);
    }

    // ── 4. Inject sticky cookie & observability telemetry headers ───────────
    response = new Response(response.body, response);

    // Set sticky cookie (6-hour TTL, Secure, SameSite=Lax)
    if (!existingCohort) {
      response.headers.append(
        'Set-Cookie',
        `prc_canary_cohort=${effectiveCohort}; Path=/; Max-Age=21600; SameSite=Lax; Secure`,
      );
      response.headers.append(
        'Set-Cookie',
        `rc_canary_bucket=${effectiveCohort}; Path=/; Max-Age=21600; SameSite=Lax; Secure`,
      );
    }

    // Observability telemetry headers for CloudWatch / Datadog
    response.headers.set('X-RC-Canary-Bucket', effectiveCohort);
    response.headers.set('X-RC-Canary-Weight', String(canaryWeight));
    if (fallbackTriggered) {
      response.headers.set('X-RC-Canary-Fallback', 'true');
    }
    if (canaryTag) {
      response.headers.set('X-RC-Release-Tag', canaryTag);
    }

    // ── 5. Record telemetry in background (non-blocking) ────────────────────
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(
        recordCanaryMetric(env, {
          bucket: effectiveCohort,
          path: url.pathname,
          status: response.status,
          canaryTag: canaryTag || 'unknown',
          fallback: fallbackTriggered,
        }),
      );
    }

    return response;
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Parse a specific cookie value from the Cookie header string.
 * @param {string} cookieHeader
 * @param {string} name
 * @returns {string | null}
 */
function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

/**
 * Write canary hit metric to KV for lightweight traffic accounting.
 *
 * @param {{ CANARY_CONFIG?: KVNamespace }} env
 * @param {{ bucket: string, path: string, status: number, canaryTag: string, fallback: boolean }} data
 */
async function recordCanaryMetric(env, { bucket, status, canaryTag, fallback }) {
  if (!env || !env.CANARY_CONFIG) return;
  try {
    const hour = new Date().toISOString().slice(0, 13);
    const key = `metrics:${canaryTag}:${bucket}:${hour}h`;
    const existing = parseInt((await env.CANARY_CONFIG.get(key)) ?? '0', 10);
    await env.CANARY_CONFIG.put(key, String(existing + 1), {
      expirationTtl: 86400, // 24-hour retention
    });

    if (fallback) {
      const fallbackKey = `metrics:${canaryTag}:fallbacks:${hour}h`;
      const fallbackCount = parseInt((await env.CANARY_CONFIG.get(fallbackKey)) ?? '0', 10);
      await env.CANARY_CONFIG.put(fallbackKey, String(fallbackCount + 1), {
        expirationTtl: 86400,
      });
    }
  } catch {
    // Best-effort — never throw on background metric tracking
  }
}
