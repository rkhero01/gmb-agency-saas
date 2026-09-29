import { pool } from '../config/database.js';

export class ClientRepository {
  constructor(db = pool) {
    this.db = db;
  }

  /**
   * Creates a client scoped strictly to an agency
   * @param {string} agencyId
   * @param {{ name: string, business_name?: string, email?: string, phone?: string, website?: string, status?: string }} clientData
   * @param {import('pg').PoolClient} [executor]
   */
  async create(
    agencyId,
    { name, business_name = null, email = null, phone = null, website = null, status = 'active' },
    executor = this.db
  ) {
    if (!agencyId) throw new Error('agency_id is required to create a client');

    const query = `
      INSERT INTO clients (agency_id, name, business_name, email, phone, website, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, agency_id, name, business_name, email, phone, website, status, created_at, updated_at;
    `;
    const values = [
      agencyId,
      name.trim(),
      business_name ? business_name.trim() : null,
      email ? email.toLowerCase().trim() : null,
      phone ? phone.trim() : null,
      website ? website.trim() : null,
      status,
    ];
    const { rows } = await executor.query(query, values);
    return rows[0];
  }

  /**
   * Finds a client by ID, strictly scoped to the agency boundary
   * @param {string} agencyId
   * @param {string} clientId
   * @param {import('pg').PoolClient} [executor]
   */
  async findById(agencyId, clientId, executor = this.db) {
    const query = `
      SELECT id, agency_id, name, business_name, email, phone, website, status, created_at, updated_at
      FROM clients
      WHERE id = $1 AND agency_id = $2;
    `;
    const { rows } = await executor.query(query, [clientId, agencyId]);
    return rows[0] || null;
  }

  /**
   * Lists all clients belonging to a specific agency
   * @param {string} agencyId
   * @param {import('pg').PoolClient} [executor]
   */
  async listByAgency(agencyId, executor = this.db) {
    const query = `
      SELECT id, agency_id, name, business_name, email, phone, website, status, created_at, updated_at
      FROM clients
      WHERE agency_id = $1
      ORDER BY created_at DESC;
    `;
    const { rows } = await executor.query(query, [agencyId]);
    return rows;
  }
}

export const clientRepository = new ClientRepository();
