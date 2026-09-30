import { pool } from '../config/database.js';

export class GoogleOAuthRepository {
  constructor(db = pool) {
    this.db = db;
  }

  /**
   * Upserts Google OAuth connection credentials strictly scoped to an agency tenant
   *
   * @param {string} agencyId
   * @param {{
   *   googleAccountId?: string,
   *   googleEmail?: string,
   *   googleName?: string,
   *   accessToken: string,
   *   refreshToken?: string,
   *   tokenExpiry?: Date | string,
   *   scopes?: string[],
   *   connectionStatus?: string
   * }} data
   * @param {import('pg').PoolClient} [executor]
   */
  async upsertConnection(agencyId, data, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');
    if (!data.accessToken) throw new Error('accessToken is required');

    const query = `
      INSERT INTO google_oauth_accounts (
        agency_id,
        google_account_id,
        google_email,
        google_name,
        access_token,
        refresh_token,
        token_expiry,
        scopes,
        connection_status,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (agency_id) DO UPDATE SET
        google_account_id = COALESCE(EXCLUDED.google_account_id, google_oauth_accounts.google_account_id),
        google_email = COALESCE(EXCLUDED.google_email, google_oauth_accounts.google_email),
        google_name = COALESCE(EXCLUDED.google_name, google_oauth_accounts.google_name),
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, google_oauth_accounts.refresh_token),
        token_expiry = EXCLUDED.token_expiry,
        scopes = COALESCE(EXCLUDED.scopes, google_oauth_accounts.scopes),
        connection_status = EXCLUDED.connection_status,
        updated_at = NOW()
      RETURNING
        id,
        agency_id,
        google_account_id,
        google_email,
        google_name,
        token_expiry,
        scopes,
        connection_status,
        created_at,
        updated_at;
    `;

    const values = [
      agencyId,
      data.googleAccountId || null,
      data.googleEmail || null,
      data.googleName || null,
      data.accessToken,
      data.refreshToken || null,
      data.tokenExpiry ? new Date(data.tokenExpiry) : null,
      data.scopes || [],
      data.connectionStatus || 'connected',
    ];

    const { rows } = await executor.query(query, values);
    return rows[0];
  }

  /**
   * Retrieves full Google connection credentials (INTERNAL ONLY - contains tokens)
   * Must never be returned directly in client-facing HTTP responses.
   *
   * @param {string} agencyId
   * @param {import('pg').PoolClient} [executor]
   */
  async findByAgency(agencyId, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');

    const query = `
      SELECT
        id,
        agency_id,
        google_account_id,
        google_email,
        google_name,
        access_token,
        refresh_token,
        token_expiry,
        scopes,
        connection_status,
        created_at,
        updated_at
      FROM google_oauth_accounts
      WHERE agency_id = $1;
    `;
    const { rows } = await executor.query(query, [agencyId]);
    return rows[0] || null;
  }

  /**
   * Retrieves safe/sanitized connection status for frontend display
   * STRICT GUARANTEE: Never selects or exposes access_token or refresh_token.
   *
   * @param {string} agencyId
   * @param {import('pg').PoolClient} [executor]
   */
  async getSanitizedConnection(agencyId, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');

    const query = `
      SELECT
        id,
        agency_id,
        google_account_id,
        google_email,
        google_name,
        token_expiry,
        scopes,
        connection_status,
        created_at,
        updated_at
      FROM google_oauth_accounts
      WHERE agency_id = $1;
    `;
    const { rows } = await executor.query(query, [agencyId]);
    return rows[0] || null;
  }

  /**
   * Safely disconnects Google account by clearing stored tokens and setting status
   *
   * @param {string} agencyId
   * @param {import('pg').PoolClient} [executor]
   */
  async disconnect(agencyId, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');

    const query = `
      UPDATE google_oauth_accounts
      SET
        access_token = NULL,
        refresh_token = NULL,
        connection_status = 'disconnected',
        updated_at = NOW()
      WHERE agency_id = $1
      RETURNING
        id,
        agency_id,
        google_account_id,
        google_email,
        google_name,
        connection_status,
        updated_at;
    `;
    const { rows } = await executor.query(query, [agencyId]);
    return rows[0] || null;
  }

  /**
   * Deletes connection record entirely from database
   *
   * @param {string} agencyId
   * @param {import('pg').PoolClient} [executor]
   */
  async deleteByAgency(agencyId, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');

    const query = `
      DELETE FROM google_oauth_accounts
      WHERE agency_id = $1
      RETURNING id, agency_id, connection_status;
    `;
    const { rows } = await executor.query(query, [agencyId]);
    return rows[0] || null;
  }
}

export const googleOAuthRepository = new GoogleOAuthRepository();
