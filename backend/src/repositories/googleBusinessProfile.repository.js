import { pool } from '../config/database.js';

export class GoogleBusinessProfileRepository {
  constructor(db = pool) {
    this.db = db;
  }

  /**
   * Inserts foundational Google Business Profile linkage record
   *
   * @param {string} agencyId
   * @param {{
   *   client_id: string,
   *   location_id: string,
   *   google_account_id?: string,
   *   google_location_id?: string,
   *   profile_name?: string,
   *   status?: string,
   *   connection_status?: string,
   *   metadata?: object
   * }} profileData
   * @param {import('pg').PoolClient} [executor]
   */
  async create(agencyId, profileData, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');
    const clientId = profileData.client_id || profileData.clientId;
    const locationId = profileData.location_id || profileData.locationId;
    const googleAccountId = profileData.google_account_id || profileData.googleAccountId || null;
    const googleLocationId = profileData.google_location_id || profileData.googleLocationId || null;
    const profileName = profileData.profile_name || profileData.profileName || null;
    const status = profileData.status || 'active';
    const connectionStatus = profileData.connection_status || profileData.connectionStatus || 'connected';
    const metadata = profileData.metadata || {};

    if (!clientId) throw new Error('client_id is required');
    if (!locationId) throw new Error('location_id is required');

    const query = `
      INSERT INTO google_business_profiles (
        agency_id,
        client_id,
        location_id,
        google_account_id,
        google_location_id,
        profile_name,
        status,
        connection_status,
        metadata,
        last_synced_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
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
        metadata,
        last_synced_at,
        created_at,
        updated_at;
    `;

    const values = [
      agencyId,
      clientId,
      locationId,
      googleAccountId,
      googleLocationId,
      profileName,
      status,
      connectionStatus,
      JSON.stringify(metadata),
    ];

    const { rows } = await executor.query(query, values);
    return rows[0];
  }

  /**
   * Links or updates a location to a Google Business Profile location
   * Uses ON CONFLICT (location_id) to update existing profile linkage
   *
   * @param {string} agencyId
   * @param {{
   *   client_id: string,
   *   location_id: string,
   *   google_account_id: string,
   *   google_location_id: string,
   *   profile_name: string,
   *   status?: string,
   *   connection_status?: string,
   *   metadata?: object
   * }} profileData
   * @param {import('pg').PoolClient} [executor]
   */
  async upsertLink(agencyId, profileData, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');
    const clientId = profileData.client_id || profileData.clientId;
    const locationId = profileData.location_id || profileData.locationId;
    const googleAccountId = profileData.google_account_id || profileData.googleAccountId || null;
    const googleLocationId = profileData.google_location_id || profileData.googleLocationId;
    const profileName = profileData.profile_name || profileData.profileName || 'Google Business Profile';
    const status = profileData.status || 'active';
    const connectionStatus = profileData.connection_status || profileData.connectionStatus || 'connected';
    const metadata = profileData.metadata || {};

    if (!clientId) throw new Error('client_id is required');
    if (!locationId) throw new Error('location_id is required');
    if (!googleLocationId) throw new Error('google_location_id is required');

    const query = `
      INSERT INTO google_business_profiles (
        agency_id,
        client_id,
        location_id,
        google_account_id,
        google_location_id,
        profile_name,
        status,
        connection_status,
        metadata,
        last_synced_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (location_id) DO UPDATE SET
        google_account_id = EXCLUDED.google_account_id,
        google_location_id = EXCLUDED.google_location_id,
        profile_name = EXCLUDED.profile_name,
        status = EXCLUDED.status,
        connection_status = EXCLUDED.connection_status,
        metadata = EXCLUDED.metadata,
        last_synced_at = NOW(),
        updated_at = NOW()
      WHERE google_business_profiles.agency_id = $1
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
        metadata,
        last_synced_at,
        created_at,
        updated_at;
    `;

    const values = [
      agencyId,
      clientId,
      locationId,
      googleAccountId,
      googleLocationId,
      profileName,
      status,
      connectionStatus,
      JSON.stringify(metadata),
    ];

    const { rows } = await executor.query(query, values);
    return rows[0] || null;
  }

  /**
   * Finds a GBP profile by location ID, strictly scoped to agency
   *
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
        metadata,
        last_synced_at,
        created_at,
        updated_at
      FROM google_business_profiles
      WHERE location_id = $1 AND agency_id = $2;
    `;
    const { rows } = await executor.query(query, [locationId, agencyId]);
    return rows[0] || null;
  }

  /**
   * Lists all GBP profile linkages for an agency
   *
   * @param {string} agencyId
   * @param {import('pg').PoolClient} [executor]
   */
  async listByAgency(agencyId, executor = this.db) {
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
        metadata,
        last_synced_at,
        created_at,
        updated_at
      FROM google_business_profiles
      WHERE agency_id = $1
      ORDER BY created_at DESC;
    `;
    const { rows } = await executor.query(query, [agencyId]);
    return rows;
  }

  /**
   * Deletes a GBP linkage record by location ID within agency boundary
   *
   * @param {string} agencyId
   * @param {string} locationId
   * @param {import('pg').PoolClient} [executor]
   */
  async deleteLink(agencyId, locationId, executor = this.db) {
    const query = `
      DELETE FROM google_business_profiles
      WHERE location_id = $1 AND agency_id = $2
      RETURNING id, agency_id, location_id, google_location_id;
    `;
    const { rows } = await executor.query(query, [locationId, agencyId]);
    return rows[0] || null;
  }
}

export const googleBusinessProfileRepository = new GoogleBusinessProfileRepository();
