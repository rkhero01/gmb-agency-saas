import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to migrations directory in repository
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../database/migrations');

/**
 * Initializes the schema_migrations tracking table
 */
export async function initMigrationTable(client) {
  try {
    // If table already exists, no-op
    await client.query('SELECT 1 FROM schema_migrations LIMIT 1;');
  } catch {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }
}

/**
 * Retrieves list of already applied migration names
 */
export async function getAppliedMigrations(client) {
  await initMigrationTable(client);
  const result = await client.query(
    'SELECT name, applied_at FROM schema_migrations ORDER BY id ASC;'
  );
  return result.rows;
}

/**
 * Reads and sorts all migration SQL files from the migrations directory
 */
export function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

/**
 * Runs all pending migrations in sequential transactions
 * @param {import('pg').Pool} dbPool
 * @returns {Promise<{ applied: string[], total: number }>}
 */
export async function migrateUp(dbPool = pool) {
  const client = await dbPool.connect();
  const applied = [];

  try {
    const appliedRows = await getAppliedMigrations(client);
    const appliedSet = new Set(appliedRows.map((r) => r.name));
    const allFiles = getMigrationFiles();
    const pendingFiles = allFiles.filter((file) => !appliedSet.has(file));

    if (pendingFiles.length === 0) {
      console.log('✓ Database is up to date. No pending migrations.');
      return { applied: [], total: allFiles.length };
    }

    console.log(`Found ${pendingFiles.length} pending migration(s)...`);

    for (const file of pendingFiles) {
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`Applying migration: ${file}...`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (name) VALUES ($1);',
          [file]
        );
        await client.query('COMMIT');
        applied.push(file);
        console.log(`✓ Applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`✗ Migration failed on ${file}:`, err.message);
        throw err;
      }
    }

    console.log(`Successfully applied ${applied.length} migration(s).`);
    return { applied, total: allFiles.length };
  } finally {
    client.release();
  }
}

/**
 * Checks and reports the status of all migrations
 * @param {import('pg').Pool} dbPool
 */
export async function getMigrationStatus(dbPool = pool) {
  const client = await dbPool.connect();
  try {
    const appliedRows = await getAppliedMigrations(client);
    const appliedMap = new Map(appliedRows.map((r) => [r.name, r.applied_at]));
    const allFiles = getMigrationFiles();

    return allFiles.map((file) => ({
      name: file,
      applied: appliedMap.has(file),
      appliedAt: appliedMap.get(file) || null,
    }));
  } finally {
    client.release();
  }
}

// CLI Execution Support
if (process.argv[1] && process.argv[1].endsWith('migrator.js')) {
  const command = process.argv[2] || 'up';

  (async () => {
    try {
      if (command === 'up') {
        await migrateUp(pool);
      } else if (command === 'status') {
        const statuses = await getMigrationStatus(pool);
        console.log('\n--- Migration Status ---');
        statuses.forEach((s) => {
          console.log(
            `[${s.applied ? 'APPLIED' : 'PENDING'}] ${s.name} ${
              s.appliedAt ? `(${new Date(s.appliedAt).toISOString()})` : ''
            }`
          );
        });
        console.log('------------------------\n');
      } else {
        console.log(`Unknown command "${command}". Available commands: up, status`);
      }
      await pool.end();
      process.exit(0);
    } catch (err) {
      console.error('Migration error:', err.message);
      await pool.end();
      process.exit(1);
    }
  })();
}
