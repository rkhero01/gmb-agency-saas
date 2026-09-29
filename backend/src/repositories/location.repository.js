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

  /**
   * Updates a location scoped strictly to an agency (supports partial updates)
   * @param {string} agencyId
   * @param {string} locationId
   * @param {{
   *   client_id?: string,
   *   name?: string,
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
  async update(agencyId, locationId, locationData = {}, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required to update a location');
    if (!locationId) throw new Error('location_id is required to update a location');

    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (locationData.client_id !== undefined) {
      fields.push(`client_id = $${paramIndex++}`);
      values.push(locationData.client_id);
    }

    if (locationData.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(typeof locationData.name === 'string' ? locationData.name.trim() : locationData.name);
    }

    if (locationData.address_line1 !== undefined) {
      fields.push(`address_line1 = $${paramIndex++}`);
      values.push(
        locationData.address_line1 && typeof locationData.address_line1 === 'string'
          ? locationData.address_line1.trim()
          : (locationData.address_line1 || null)
      );
    }

    if (locationData.address_line2 !== undefined) {
      fields.push(`address_line2 = $${paramIndex++}`);
      values.push(
        locationData.address_line2 && typeof locationData.address_line2 === 'string'
          ? locationData.address_line2.trim()
          : (locationData.address_line2 || null)
      );
    }

    if (locationData.city !== undefined) {
      fields.push(`city = $${paramIndex++}`);
      values.push(
        locationData.city && typeof locationData.city === 'string'
          ? locationData.city.trim()
          : (locationData.city || null)
      );
    }

    if (locationData.state !== undefined) {
      fields.push(`state = $${paramIndex++}`);
      values.push(
        locationData.state && typeof locationData.state === 'string'
          ? locationData.state.trim()
          : (locationData.state || null)
      );
    }

    if (locationData.postal_code !== undefined) {
      fields.push(`postal_code = $${paramIndex++}`);
      values.push(
        locationData.postal_code && typeof locationData.postal_code === 'string'
          ? locationData.postal_code.trim()
          : (locationData.postal_code || null)
      );
    }

    if (locationData.country !== undefined) {
      fields.push(`country = $${paramIndex++}`);
      values.push(
        locationData.country && typeof locationData.country === 'string'
          ? locationData.country.trim()
          : (locationData.country || null)
      );
    }

    if (locationData.timezone !== undefined) {
      fields.push(`timezone = $${paramIndex++}`);
      values.push(
        locationData.timezone && typeof locationData.timezone === 'string'
          ? locationData.timezone.trim()
          : (locationData.timezone || null)
      );
    }

    if (locationData.phone !== undefined) {
      fields.push(`phone = $${paramIndex++}`);
      values.push(
        locationData.phone && typeof locationData.phone === 'string'
          ? locationData.phone.trim()
          : (locationData.phone || null)
      );
    }

    if (locationData.website !== undefined) {
      fields.push(`website = $${paramIndex++}`);
      values.push(
        locationData.website && typeof locationData.website === 'string'
          ? locationData.website.trim()
          : (locationData.website || null)
      );
    }

    if (locationData.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(locationData.status);
    }

    fields.push('updated_at = NOW()');

    values.push(locationId);
    const locationIdParam = paramIndex++;
    values.push(agencyId);
    const agencyIdParam = paramIndex++;

    const query = `
      UPDATE locations
      SET ${fields.join(', ')}
      WHERE id = $${locationIdParam} AND agency_id = $${agencyIdParam}
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
    const { rows } = await executor.query(query, values);
    return rows[0] || null;
  }

  /**
   * Deletes a location scoped strictly to an agency
   * @param {string} agencyId
   * @param {string} locationId
   * @param {import('pg').PoolClient} [executor]
   */
  async delete(agencyId, locationId, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required to delete a location');
    if (!locationId) throw new Error('location_id is required to delete a location');

    const query = `
      DELETE FROM locations
      WHERE id = $1 AND agency_id = $2
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
    const { rows } = await executor.query(query, [locationId, agencyId]);
    return rows[0] || null;
  }
}

export const locationRepository = new LocationRepository();
