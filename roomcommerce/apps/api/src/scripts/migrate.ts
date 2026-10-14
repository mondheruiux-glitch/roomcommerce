// apps/api/src/scripts/migrate.ts
//
// Drizzle database migration runner.
// Called as a one-shot ECS Fargate task BEFORE the service fleet launches
// to prevent migration lock contention across multiple simultaneously starting
// container instances. See: infra/ecs/task-definition-api.json (migrate task variant)
//
// Usage:
//   NODE_ENV=production DATABASE_URL=<url> node dist/scripts/migrate.js
//   Or during local development: ts-node apps/api/src/scripts/migrate.ts

import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'path';

const MIGRATIONS_FOLDER = join(__dirname, '..', '..', 'drizzle');

async function runMigrations(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];

  if (!databaseUrl) {
    console.error('[migrate] ✗ DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  console.log('[migrate] Connecting to database...');
  console.log(`[migrate] Migrations folder: ${MIGRATIONS_FOLDER}`);

  const pool = new Pool({
    connectionString: databaseUrl,
    // Single connection is sufficient for one-shot migration task
    min: 1,
    max: 1,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 5_000,
  });

  pool.on('error', (err) => {
    console.error('[migrate] Pool error:', err.message);
  });

  const db = drizzle(pool);

  try {
    console.log('[migrate] Running Drizzle ORM migrations...');
    const start = Date.now();

    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

    const elapsed = Date.now() - start;
    console.log(`[migrate] ✓ All migrations applied successfully in ${elapsed}ms.`);
  } catch (err: any) {
    console.error(`[migrate] ✗ Migration failed: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('[migrate] Database connection pool closed.');
  }

  process.exit(0);
}

// Guard against accidental import — only execute when run directly
if (require.main === module) {
  runMigrations();
}
