import { pool } from '../config/database.js';

export class LocationRepository {
  constructor(db = pool) {
    this.db = db;
  }

  /**
   * Creates a location belonging to an agency and a client.
   * Database compound foreign key ensures client belongs to the same agency.
   *
   * @param {string} agencyId
   * @param {{
   *   client_id: string,
   *   name: string,
   *   address_line1?: string,
   *   address_line2?: string,
   *   city?: string,
   *   state?: string,
   *   postal_code?: string,
   *   country?: string,
   *   timezone?: string,
   *   phone?: string,
   *   website?: string,
   *   status?: string
   * }} locationData
   * @param {import('pg').PoolClient} [executor]
   */
  async create(agencyId, locationData, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required to create a location');
    if (!locationData.client_id) throw new Error('client_id is required to create a location');
    if (!locationData.name) throw new Error('name is required to create a location');

    const query = `
      INSERT INTO locations (
        agency_id,
        client_id,
        name,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
        timezone,
        phone,
        website,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING
        id,
        agency_id,
        client_id,
        name,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
        timezone,
        phone,
        website,
        status,
        created_at,
        updated_at;
    `;

    const values = [
      agencyId,
      locationData.client_id,
      locationData.name.trim(),
      locationData.address_line1 || null,
      locationData.address_line2 || null,
      locationData.city || null,
      locationData.state || null,
      locationData.postal_code || null,
      locationData.country || null,
      locationData.timezone || null,
      locationData.phone || null,
      locationData.website || null,
      locationData.status || 'active',
    ];

    const { rows } = await executor.query(query, values);
    return rows[0];
  }

  /**
   * Finds a location by ID, strictly scoped to the agency boundary
   * @param {string} agencyId
   * @param {string} locationId
   * @param {import('pg').PoolClient} [executor]
   */
  async findById(agencyId, locationId, executor = this.db) {
    const query = `
      SELECT
        id,
        agency_id,
        client_id,
        name,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
        timezone,
        phone,
        website,
        status,
        created_at,
        updated_at
      FROM locations
      WHERE id = $1 AND agency_id = $2;
    `;
    const { rows } = await executor.query(query, [locationId, agencyId]);
    return rows[0] || null;
  }

  /**
   * Lists all locations for a client within an agency boundary
   * @param {string} agencyId
   * @param {string} clientId
   * @param {import('pg').PoolClient} [executor]
   */
  async listByClient(agencyId, clientId, executor = this.db) {
    const query = `
      SELECT
        id,
        agency_id,
        client_id,
        name,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
        timezone,
        phone,
        website,
        status,
        created_at,
        updated_at
      FROM locations
      WHERE agency_id = $1 AND client_id = $2
      ORDER BY created_at DESC;
    `;
    const { rows } = await executor.query(query, [agencyId, clientId]);
    return rows;
  }
}

export const locationRepository = new LocationRepository();
