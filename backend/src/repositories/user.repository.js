import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { VALID_ROLES } from '../config/permissions.js';

export { VALID_ROLES };

export class UserRepository {
  constructor(db = pool) {
    this.db = db;
  }

  /**
   * Hashes a plaintext password using bcrypt with salt rounds = 10
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
   * Verifies a plaintext password against the stored bcrypt hash
   * @param {string} plaintext
   * @param {string} hash
   */
  async verifyPassword(plaintext, hash) {
    if (!plaintext || !hash) return false;
    return bcrypt.compare(plaintext, hash);
  }

  /**
   * Creates a user scoped to an agency
   * @param {string} agencyId
   * @param {{ name: string, email: string, password: string, role?: string, status?: string }} userData
   * @param {import('pg').PoolClient} [executor]
   */
  async create(
    agencyId,
    { name, email, password, role = 'viewer', status = 'active' },
    executor = this.db
  ) {
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
   * Finds a user by ID within an agency boundary (excludes password_hash)
   * @param {string} agencyId
   * @param {string} userId
   * @param {import('pg').PoolClient} [executor]
   */
  async findById(agencyId, userId, executor = this.db) {
    const query = `
      SELECT id, agency_id, name, email, role, status, last_login_at, created_at, updated_at
      FROM users
      WHERE id = $1 AND agency_id = $2;
    `;
    const { rows } = await executor.query(query, [userId, agencyId]);
    return rows[0] || null;
  }

  /**
   * Finds a user by email within an agency boundary (includes password_hash for internal verify)
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

  /**
   * Finds user for authentication by email across agencies
   * Joins agency to return tenant metadata
   * @param {string} email
   * @param {import('pg').PoolClient} [executor]
   */
  async findByEmailForAuth(email, executor = this.db) {
    const query = `
      SELECT 
        u.id,
        u.agency_id,
        u.name,
        u.email,
        u.password_hash,
        u.role,
        u.status,
        u.failed_login_attempts,
        u.locked_until,
        u.last_login_at,
        u.created_at,
        u.updated_at,
        a.name as agency_name,
        a.slug as agency_slug,
        a.status as agency_status
      FROM users u
      JOIN agencies a ON u.agency_id = a.id
      WHERE u.email = $1;
    `;
    const { rows } = await executor.query(query, [email.toLowerCase().trim()]);
    return rows[0] || null;
  }

  /**
   * Records a failed login attempt; locks account if threshold exceeded
   * @param {string} userId
   * @param {import('pg').PoolClient} [executor]
   */
  async recordFailedLogin(userId, executor = this.db) {
    const query = `
      UPDATE users
      SET 
        failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE 
          WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
          ELSE locked_until 
        END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, failed_login_attempts, locked_until;
    `;
    const { rows } = await executor.query(query, [userId]);
    return rows[0];
  }

  /**
   * Resets failed login attempts and updates last_login_at upon successful authentication
   * @param {string} userId
   * @param {import('pg').PoolClient} [executor]
   */
  async recordSuccessfulLogin(userId, executor = this.db) {
    const query = `
      UPDATE users
      SET 
        failed_login_attempts = 0,
        locked_until = NULL,
        last_login_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, last_login_at;
    `;
    const { rows } = await executor.query(query, [userId]);
    return rows[0];
  }

  /**
   * Lists all team members within a specific agency
   * @param {string} agencyId
   * @param {import('pg').PoolClient} [executor]
   */
  async listTeamMembers(agencyId, executor = this.db) {
    const query = `
      SELECT 
        id,
        agency_id,
        name,
        email,
        role,
        status,
        last_login_at,
        created_at,
        updated_at
      FROM users
      WHERE agency_id = $1
      ORDER BY 
        CASE role
          WHEN 'owner' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'manager' THEN 3
          WHEN 'specialist' THEN 4
          WHEN 'viewer' THEN 5
          ELSE 6
        END,
        created_at ASC;
    `;
    const { rows } = await executor.query(query, [agencyId]);
    return rows;
  }

  /**
   * Updates a team member's role within an agency
   * @param {string} agencyId
   * @param {string} userId
   * @param {string} newRole
   * @param {import('pg').PoolClient} [executor]
   */
  async updateRole(agencyId, userId, newRole, executor = this.db) {
    if (!VALID_ROLES.includes(newRole)) {
      throw new Error(`Invalid role "${newRole}"`);
    }

    const query = `
      UPDATE users
      SET role = $1, updated_at = NOW()
      WHERE id = $2 AND agency_id = $3
      RETURNING id, agency_id, name, email, role, status, updated_at;
    `;
    const { rows } = await executor.query(query, [newRole, userId, agencyId]);
    return rows[0] || null;
  }

  /**
   * Updates a team member's status (active/inactive) within an agency
   * @param {string} agencyId
   * @param {string} userId
   * @param {string} newStatus
   * @param {import('pg').PoolClient} [executor]
   */
  async updateStatus(agencyId, userId, newStatus, executor = this.db) {
    const allowed = ['active', 'inactive', 'invited', 'suspended'];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid status "${newStatus}"`);
    }

    const query = `
      UPDATE users
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND agency_id = $3
      RETURNING id, agency_id, name, email, role, status, updated_at;
    `;
    const { rows } = await executor.query(query, [newStatus, userId, agencyId]);
    return rows[0] || null;
  }

  /**
   * Counts the number of active owners in an agency (used for final owner protection)
   * @param {string} agencyId
   * @param {import('pg').PoolClient} [executor]
   * @returns {Promise<number>}
   */
  async countActiveOwners(agencyId, executor = this.db) {
    const query = `
      SELECT COUNT(*)::int as count
      FROM users
      WHERE agency_id = $1 AND role = 'owner' AND status = 'active';
    `;
    const { rows } = await executor.query(query, [agencyId]);
    return rows[0]?.count || 0;
  }
}

export const userRepository = new UserRepository();
