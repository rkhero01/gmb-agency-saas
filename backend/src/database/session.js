import { pool } from '../config/database.js';

/**
 * Executes a callback within a strictly scoped tenant database session.
 *
 * In production with PostgreSQL Row-Level Security (RLS) enabled:
 * - Begins a transaction.
 * - Sets `SET LOCAL app.current_agency_id = $1` which is active only for this transaction.
 * - Executes the provided callback with the scoped database client.
 * - Commits the transaction and releases the client back to the pool.
 *
 * @param {string} agencyId - Verified UUID of the agency tenant
 * @param {Function} callback - Async function receiving (client)
 * @param {import('pg').Pool} [dbPool] - Optional database pool (defaults to main pool)
 * @returns {Promise<any>}
 */
export async function withTenantContext(agencyId, callback, dbPool = pool) {
  if (!agencyId) {
    throw new Error('Tenant context requires a valid agencyId');
  }

  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    // Set transaction-local session setting for PostgreSQL RLS policies
    await client.query('SELECT set_config($1, $2, true)', [
      'app.current_agency_id',
      agencyId,
    ]);

    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
