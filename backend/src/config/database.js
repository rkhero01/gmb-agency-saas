import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

// Database configuration supporting both individual fields and connection string
const poolConfig = env.DB.URL
  ? { connectionString: env.DB.URL, ssl: env.DB.SSL ? { rejectUnauthorized: false } : false }
  : {
      host: env.DB.HOST,
      port: env.DB.PORT,
      database: env.DB.NAME,
      user: env.DB.USER,
      password: env.DB.PASSWORD,
      ssl: env.DB.SSL ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
    };

export const pool = new Pool(poolConfig);

// Keep pool error from crashing the process when idle clients error
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

/**
 * Checks connection health with PostgreSQL
 * @returns {Promise<{ connected: boolean, message: string }>}
 */
export async function checkDatabaseHealth() {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return { connected: true, message: 'Database connected successfully' };
    } finally {
      client.release();
    }
  } catch (error) {
    return {
      connected: false,
      message: `Database connection unavailable: ${error.message}`,
    };
  }
}
