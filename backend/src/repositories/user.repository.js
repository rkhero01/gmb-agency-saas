import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';

export const VALID_ROLES = ['owner', 'admin', 'manager', 'specialist', 'viewer'];

export class UserRepository {
  constructor(db = pool) {
    this.db = db;
  }

  /**
   * Hashes a plaintext password using bcrypt
   * @param {string} password
   */
  async hashPassword(password) {
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * Verifies a plaintext password against the stored hash
   * @param {string} plaintext
   * @param {string} hash
   */
  async verifyPassword(plaintext, hash) {
    return bcrypt.compare(plaintext, hash);
  }

  /**
   * Creates a user scoped to an agency
   * @param {string} agencyId
   * @param {{ name: string, email: string, password: string, role?: string, status?: string }} userData
   * @param {import('pg').PoolClient} [executor]
   */
  async create(agencyId, { name, email, password, role = 'viewer', status = 'active' }, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required to create a user');
    if (!VALID_ROLES.includes(role)) {
      throw new Error(`Invalid role "${role}". Allowed roles: ${VALID_ROLES.join(', ')}`);
    }

    const passwordHash = await this.hashPassword(password);
    const normalizedEmail = email.toLowerCase().trim();

    const query = `
      INSERT INTO users (agency_id, name, email, password_hash, role, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, agency_id, name, email, role, status, created_at, updated_at;
    `;
    const values = [agencyId, name.trim(), normalizedEmail, passwordHash, role, status];
    const { rows } = await executor.query(query, values);
    return rows[0];
  }

  /**
   * Finds a user by ID within an agency boundary
   * @param {string} agencyId
   * @param {string} userId
   * @param {import('pg').PoolClient} [executor]
   */
  async findById(agencyId, userId, executor = this.db) {
    const query = `
      SELECT id, agency_id, name, email, role, status, created_at, updated_at
      FROM users
      WHERE id = $1 AND agency_id = $2;
    `;
    const { rows } = await executor.query(query, [userId, agencyId]);
    return rows[0] || null;
  }

  /**
   * Finds a user by email within an agency boundary
   * @param {string} agencyId
   * @param {string} email
   * @param {import('pg').PoolClient} [executor]
   */
  async findByEmail(agencyId, email, executor = this.db) {
    const query = `
      SELECT id, agency_id, name, email, role, status, password_hash, created_at, updated_at
      FROM users
      WHERE email = $1 AND agency_id = $2;
    `;
    const { rows } = await executor.query(query, [email.toLowerCase().trim(), agencyId]);
    return rows[0] || null;
  }
}

export const userRepository = new UserRepository();
