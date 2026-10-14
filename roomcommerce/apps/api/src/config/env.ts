import { z } from 'zod';

const isTest = process.env['NODE_ENV'] === 'test';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_BASE_URL: z.string().default('http://localhost:4000'),
  WEB_BASE_URL: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().default('super_secret_jwt_signing_key_at_least_32_chars'),
  COOKIE_SECRET: z.string().default('super_secret_cookie_parser_secret'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/roomcommerce_dev?schema=public'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  CLOUDFLARE_R2_ACCOUNT_ID: z.string().default('mock_account_id'),
  CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().default('mock_access_key'),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().default('mock_secret_key'),
  CLOUDFLARE_R2_BUCKET_NAME: z.string().default('roomcommerce-uploads'),
  CLOUDFLARE_R2_PUBLIC_DOMAIN: z.string().default('https://cdn.roomcommerce.internal'),
  QDRANT_URL: z.string().default('http://localhost:6333'),
  QDRANT_API_KEY: z.string().default('mock_qdrant_key'),
  STRIPE_SECRET_KEY: z.string().default('sk_test_mock_stripe_key'),
  STRIPE_WEBHOOK_SECRET: z.string().default('whsec_mock_stripe_webhook_secret'),
  MODAL_API_ENDPOINT: z.string().default('https://api.modal.run/v1/roomcommerce/render'),
  MODAL_API_TOKEN: z.string().default('mock_modal_token'),
  // Set to 'true' in CI / local dev to skip real Modal GPU calls (no credits spent)
  MODAL_MOCK_MODE: z.string().optional(),
  // Unit-cost warning threshold in USD — log a structured warning above this
  MODAL_COST_WARN_USD: z.coerce.number().default(0.040),
  // Injected by ECS task definition or CI at build time
  APP_VERSION: z.string().default('1.0.0'),
});

type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    if (isTest) {
      return envSchema.parse({});
    }
    console.error('❌ Invalid environment variables:\n');
    result.error.issues.forEach((issue) => {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }
  return result.data;
}

export const env = validateEnv();
