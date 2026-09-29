import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { newDb } from 'pg-mem';
import {
  initMigrationTable,
  getAppliedMigrations,
  getMigrationFiles,
} from '../database/migrator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testMigrator() {
  console.log('--- Testing Migration Runner System ---');

  const db = newDb();
  db.public.registerFunction({
    name: 'gen_random_uuid',
    impure: true,
    implementation: () => crypto.randomUUID(),
  });

  const pg = db.adapters.createPg();
  const pool = new pg.Pool();
  const client = await pool.connect();

  try {
    // 1. Verify table initialization
    console.log('[1/4] Initializing schema_migrations tracking table...');
    await initMigrationTable(client);
    const applied = await client.query('SELECT name, applied_at FROM schema_migrations ORDER BY id ASC;');
    if (!Array.isArray(applied.rows) || applied.rows.length !== 0) {
      throw new Error('Expected empty applied migrations initially');
    }
    console.log('✓ schema_migrations table verified');

    // 2. Verify migration file discovery
    console.log('[2/4] Verifying migration file discovery...');
    const files = getMigrationFiles();
    console.log(`✓ Discovered ${files.length} migration files:`, files.join(', '));
    if (!files.includes('001_core_schema.sql')) {
      throw new Error('001_core_schema.sql not found in migrations!');
    }

    // 3. Verify execution tracking
    console.log('[3/4] Recording synthetic migration entry...');
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1);', [
      '000_bootstrap.sql',
    ]);
    const updatedApplied = await getAppliedMigrations(client);
    if (updatedApplied.length !== 1 || updatedApplied[0].name !== '000_bootstrap.sql') {
      throw new Error('Failed to record applied migration tracking entry');
    }
    console.log('✓ Migration tracking records saved and queried accurately');

    // 4. Verify uniqueness constraint on schema_migrations name
    console.log('[4/4] Verifying migration uniqueness constraint...');
    let caughtDuplicate = false;
    try {
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1);', [
        '000_bootstrap.sql',
      ]);
    } catch {
      caughtDuplicate = true;
    }
    if (!caughtDuplicate) {
      throw new Error('Expected duplicate migration insertion to be rejected');
    }
    console.log('✓ Migration uniqueness constraint enforced');

    console.log('✅ ALL MIGRATION SYSTEM CHECKS PASSED!\n');
    return true;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrator.test.js')) {
  testMigrator()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migrator test failed:', err);
      process.exit(1);
    });
}

export { testMigrator };
