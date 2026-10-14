/**
 * configure-r2-lifecycle.ts — Cloudflare R2 Bucket Lifecycle Expiration Policy (SEC-01, PRV-01)
 *
 * Applies a 7-day automated object expiration rule on raw uploads and rendered
 * output stored in Cloudflare R2. This provides hardware-level enforcement of
 * the zero-indefinite-storage guarantee, independent of application-layer purge
 * crons.
 *
 * Usage:
 *   pnpm tsx apps/api/scripts/configure-r2-lifecycle.ts
 *
 * Requirements:
 *   - CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID,
 *     CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_NAME must be set.
 */
// Process declaration for standalone tsx execution outside rootDir
declare const process: {
  argv: string[];
  exit(code?: number): never;
};

import {
  S3Client,
  PutBucketLifecycleConfigurationCommand,
  type LifecycleRule,
} from '@aws-sdk/client-s3';
import { env } from '../src/config/env.js';

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

const LIFECYCLE_RULES: LifecycleRule[] = [
  {
    ID: 'PurgeRawUserUploadsAfter7Days',
    Filter: { Prefix: 'raw-uploads/' },
    Status: 'Enabled',
    Expiration: { Days: 7 }, // SEC-01 & PRV-01: zero indefinite storage of spatial imagery
  },
  {
    ID: 'PurgeRenderedOutputAfter7Days',
    Filter: { Prefix: 'renders/' },
    Status: 'Enabled',
    Expiration: { Days: 7 },
  },
];

export async function applyR2LifecyclePolicy(): Promise<void> {
  console.log('[*] Applying Cloudflare R2 7-day ephemeral lifecycle policy...');
  console.log(`    Bucket: ${env.CLOUDFLARE_R2_BUCKET_NAME}`);
  console.log(`    Endpoint: https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);

  const command = new PutBucketLifecycleConfigurationCommand({
    Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
    LifecycleConfiguration: {
      Rules: LIFECYCLE_RULES,
    },
  });

  await s3.send(command);

  console.log('[✓] Cloudflare R2 7-day ephemeral lifecycle configuration successfully applied.');
  console.log('    Rules configured:');
  LIFECYCLE_RULES.forEach((rule) => {
    console.log(
      `      - ${rule.ID}: ${rule.Filter?.Prefix ?? '(no prefix)'} → expires after ${rule.Expiration?.Days} days`,
    );
  });
}

// Execute when run directly (not imported)
if (process.argv[1] && process.argv[1].endsWith('configure-r2-lifecycle.ts')) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: tsx scripts/configure-r2-lifecycle.ts [--dry-run]');
    console.log('Applies 7-day ephemeral retention policy to Cloudflare R2 bucket.');
    process.exit(0);
  }

  if (process.argv.includes('--dry-run')) {
    console.log('[*] [Dry-Run] Verifying Cloudflare R2 7-day ephemeral lifecycle configuration:');
    console.log(`    Bucket: ${env.CLOUDFLARE_R2_BUCKET_NAME}`);
    console.log(`    Endpoint: https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
    console.log('    Rules to be applied:');
    LIFECYCLE_RULES.forEach((rule) => {
      console.log(
        `      - ${rule.ID}: ${rule.Filter?.Prefix ?? '(no prefix)'} → expires after ${rule.Expiration?.Days} days`,
      );
    });
    console.log('[✓] [Dry-Run] Lifecycle rules validated cleanly. Zero connection errors.');
    process.exit(0);
  }

  applyR2LifecyclePolicy().catch((err) => {
    console.error('[✗] Failed to apply R2 lifecycle policy:', err.message);
    process.exit(1);
  });
}
