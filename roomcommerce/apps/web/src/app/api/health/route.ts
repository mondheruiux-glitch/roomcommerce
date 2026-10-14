// apps/web/src/app/api/health/route.ts
//
// Next.js 15 Route Handler — Web Container Health Check
// ─────────────────────────────────────────────────────
// Called by the ECS Fargate ALB health check:
//   CMD-SHELL: wget -qO- http://localhost:3000/api/health || exit 1
//
// Returns 200 when the Next.js server is live and able to serve requests.
// This is intentionally lightweight — it only validates the web process
// itself, not upstream services (those are checked by the API health endpoint).

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Never cache health responses

interface HealthResponse {
  status: 'HEALTHY' | 'UNHEALTHY';
  service: 'roomcommerce-web';
  timestamp: string;
  version: string;
  uptime: number;
}

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const response: HealthResponse = {
    status: 'HEALTHY',
    service: 'roomcommerce-web',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION ?? '1.0.0',
    uptime: Math.floor(process.uptime()),
  };

  return NextResponse.json(response, {
    status: 200,
    headers: {
      // Prevent any CDN or reverse proxy from caching health responses
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'X-Health-Check': 'roomcommerce-web',
    },
  });
}
