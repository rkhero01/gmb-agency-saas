import { pool } from '../config/database.js';

export class AgencyRepository {
  constructor(db = pool) {
    this.db = db;
  }

  /**
   * Creates a new agency tenant
   * @param {{ name: string, slug: string, status?: string }} data
   * @param {import('pg').PoolClient} [executor]
   */
  async create({ name, slug, status = 'active' }, executor = this.db) {
    const query = `
      INSERT INTO agencies (name, slug, status)
      VALUES ($1, $2, $3)
      RETURNING id, name, slug, status, created_at, updated_at;
    `;
    const values = [name, slug.toLowerCase().trim(), status];
    const { rows } = await executor.query(query, values);
    return rows[0];
  }

  /**
   * Finds an agency by UUID
   * @param {string} id
   * @param {import('pg').PoolClient} [executor]
   */
  async findById(id, executor = this.db) {
    const query = `
      SELECT id, name, slug, status, created_at, updated_at
      FROM agencies
      WHERE id = $1;
    `;
    const { rows } = await executor.query(query, [id]);
    return rows[0] || null;
  }

  /**
   * Finds an agency by slug
   * @param {string} slug
   * @param {import('pg').PoolClient} [executor]
   */
  async findBySlug(slug, executor = this.db) {
    const query = `
      SELECT id, name, slug, status, created_at, updated_at
      FROM agencies
      WHERE slug = $1;
    `;
    const { rows } = await executor.query(query, [slug.toLowerCase().trim()]);
    return rows[0] || null;
  }
}

export const agencyRepository = new AgencyRepository();
