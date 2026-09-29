import { pool } from '../config/database.js';

export class GoogleBusinessProfileRepository {
  constructor(db = pool) {
    this.db = db;
  }

  /**
   * Inserts foundational Google Business Profile linkage record
   * (Phase 1 foundational model - no external Google API calls)
   *
   * @param {string} agencyId
   * @param {{
   *   client_id: string,
   *   location_id: string,
   *   google_account_id?: string,
   *   google_location_id?: string,
   *   profile_name?: string,
   *   status?: string,
   *   connection_status?: string
   * }} profileData
   * @param {import('pg').PoolClient} [executor]
   */
  async create(agencyId, profileData, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');
    if (!profileData.client_id) throw new Error('client_id is required');
    if (!profileData.location_id) throw new Error('location_id is required');

    const query = `
      INSERT INTO google_business_profiles (
        agency_id,
        client_id,
        location_id,
        google_account_id,
        google_location_id,
        profile_name,
        status,
        connection_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        agency_id,
        client_id,
        location_id,
        google_account_id,
        google_location_id,
        profile_name,
        status,
        connection_status,
        created_at,
        updated_at;
    `;

    const values = [
      agencyId,
      profileData.client_id,
      profileData.location_id,
      profileData.google_account_id || null,
      profileData.google_location_id || null,
      profileData.profile_name || null,
      profileData.status || 'active',
      profileData.connection_status || 'disconnected',
    ];

    const { rows } = await executor.query(query, values);
    return rows[0];
  }

  /**
   * Finds a GBP profile by location, strictly scoped to agency
   * @param {string} agencyId
   * @param {string} locationId
   * @param {import('pg').PoolClient} [executor]
   */
  async findByLocationId(agencyId, locationId, executor = this.db) {
    const query = `
      SELECT
        id,
        agency_id,
        client_id,
        location_id,
        google_account_id,
        google_location_id,
        profile_name,
        status,
        connection_status,
        created_at,
        updated_at
      FROM google_business_profiles
      WHERE location_id = $1 AND agency_id = $2;
    `;
    const { rows } = await executor.query(query, [locationId, agencyId]);
    return rows[0] || null;
  }
}

export const googleBusinessProfileRepository = new GoogleBusinessProfileRepository();
