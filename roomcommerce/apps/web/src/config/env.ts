/**
 * RoomCommerce Web App — Environment Configuration
 * Validates all required client-side environment variables at startup.
 */
const requiredPublicVars = ['NEXT_PUBLIC_API_BASE_URL'] as const;

type PublicEnvKey = (typeof requiredPublicVars)[number];

function getPublicEnv(key: PublicEnvKey): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const webEnv = {
  apiBaseUrl: process.env['NEXT_PUBLIC_API_BASE_URL'] ?? 'http://localhost:4000',
} as const;

// Export type for IDE completion
export type WebEnv = typeof webEnv;

// Validate at module load time in production
if (process.env['NODE_ENV'] === 'production') {
  requiredPublicVars.forEach(getPublicEnv);
}
