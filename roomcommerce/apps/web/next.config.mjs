/** @type {import('next').NextConfig} */

// ── Content Security Policy ────────────────────────────────────────────────────
// Strict CSP mitigating XSS, clickjacking (Step 7.6, SEC-03).
// Allows scripts only from 'self', Stripe payment SDK, and Cloudflare Turnstile.
// Retailers' product images are permitted via *.r2.cloudflarestorage.com.
const cspDirectives = [
  "default-src 'self'",
  // Next.js App Router streaming/flight scripts require 'unsafe-inline'; Stripe Elements requires 'unsafe-eval'
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  // Allow: same-origin blobs/data URIs, CDN, R2, and external retailer product images
  "img-src 'self' data: blob: https://cdn.roomcommerce.internal https://*.r2.cloudflarestorage.com https://*.cloudflare.com",
  // API calls + Stripe API + Cloudflare R2 direct PUT uploads (FR-101)
  "connect-src 'self' http://localhost:4000 https://api.roomcommerce.com https://api.stripe.com https://*.r2.cloudflarestorage.com https://*.cloudflarestorage.com",
  // Stripe Elements mounts in an iframe from js.stripe.com
  "frame-src https://js.stripe.com https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ');

const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@roomcommerce/tokens', '@roomcommerce/contracts', '@roomcommerce/ui'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.roomcommerce.internal',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Prevent MIME sniffing (SEC-03)
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Clickjacking defense (SEC-03)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Prefetch control
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // Referrer privacy — only origin is sent cross-origin
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // HSTS — 2 years, all subdomains, eligible for browser preload list (SEC-03)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Restrict sensor and device APIs — camera disabled (domestic privacy)
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // Content Security Policy (SEC-03, Step 7.6)
          {
            key: 'Content-Security-Policy',
            value: cspDirectives,
          },
        ],
      },
    ];
  },
};

export default nextConfig;

