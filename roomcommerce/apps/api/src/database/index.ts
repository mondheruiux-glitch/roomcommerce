import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';
import { env } from '../config/env.js';

// Connection pool — sizes tuned for Aurora Serverless v2 auto-scaling
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  min: Number(process.env['DATABASE_POOL_MIN'] ?? 2),
  max: Number(process.env['DATABASE_POOL_MAX'] ?? 20),
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err);
});

/**
 * Drizzle ORM instance bound to the connection pool.
 * Import `db` wherever you need to execute queries.
 */
export const db = drizzle(pool, { schema });

export type Db = typeof db;

export { schema };
