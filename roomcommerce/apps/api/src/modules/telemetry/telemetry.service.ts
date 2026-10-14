// apps/api/src/modules/telemetry/telemetry.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import type { TelemetryEvent } from '@roomcommerce/contracts';

/**
 * PostHog HTTP sink configuration.
 *
 * Set these env vars to activate the real sink:
 *   POSTHOG_API_KEY   — your project write key (phc_…)
 *   POSTHOG_HOST      — defaults to https://app.posthog.com
 *
 * When credentials are absent, events are emitted as structured logs only
 * (suitable for local dev and CI — no external calls made).
 */
const POSTHOG_HOST = process.env['POSTHOG_HOST'] ?? 'https://app.posthog.com';
const POSTHOG_API_KEY = process.env['POSTHOG_API_KEY'] ?? '';
const POSTHOG_ENDPOINT = `${POSTHOG_HOST}/capture/`;

/** How long to wait for PostHog before giving up (non-blocking, fire-and-forget) */
const POSTHOG_TIMEOUT_MS = 3_000;

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  async trackEvent(event: TelemetryEvent, userId?: string, ip?: string) {
    const ipHash = ip ? this.hashIp(ip) : undefined;

    const payload = {
      ...event,
      userId,
      ipHash,
      timestamp: new Date().toISOString(),
    };

    // ── 1. Structured JSON log (always) ───────────────────────────────────────
    // Ingested by Datadog / CloudWatch log agent via JSON parsing.
    this.logger.log(`[TELEMETRY] ${JSON.stringify(payload)}`);

    // ── 2. North Star Metric: Qualified Spatial Outbound Session (QSOS) ───────
    if (event.event_name === 'affiliate_outbound_clk') {
      const skuId = (event.properties as any)?.sku_id ?? 'unknown';
      this.logger.log(
        `[NORTH_STAR_QSOS] User ${userId ?? 'guest'} engaged outbound conversion on SKU ${skuId}`,
      );
    }

    // ── 3. PostHog HTTP sink (fire-and-forget, non-blocking) ──────────────────
    if (POSTHOG_API_KEY) {
      this.flushToPostHog(event, userId, ipHash).catch((err) => {
        // Best-effort — telemetry must never block or throw on the request path
        this.logger.warn(`[TELEMETRY] PostHog flush failed: ${err.message}`);
      });
    }

    return { tracked: true, event: event.event_name };
  }

  // ---------------------------------------------------------------------------
  // PostHog HTTP capture
  // ---------------------------------------------------------------------------

  private async flushToPostHog(
    event: TelemetryEvent,
    userId?: string,
    ipHash?: string,
  ): Promise<void> {
    const distinctId = userId ?? `anon_${ipHash ?? 'unknown'}`;

    const body = JSON.stringify({
      api_key: POSTHOG_API_KEY,
      event: event.event_name,
      distinct_id: distinctId,
      properties: {
        ...(event.properties ?? {}),
        $ip: undefined, // never forward raw IP to PostHog
        ip_hash: ipHash,
        source: 'roomcommerce-api',
        env: process.env['NODE_ENV'] ?? 'development',
      },
      timestamp: new Date().toISOString(),
    });

    const response = await fetch(POSTHOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(POSTHOG_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`PostHog returned HTTP ${response.status}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private hashIp(ip: string): string {
    return createHash('sha256').update(ip).digest('hex').substring(0, 16);
  }
}
