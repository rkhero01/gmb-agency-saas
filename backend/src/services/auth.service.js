import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { userRepository } from '../repositories/user.repository.js';
import { agencyRepository } from '../repositories/agency.repository.js';

export class AuthService {
  /**
   * Generates a signed JWT with user and agency claims
   * @param {{ id: string, agency_id: string, role: string }} user
   * @returns {string}
   */
  generateToken(user) {
    if (!user || !user.id || !user.agency_id) {
      throw new Error('User ID and Agency ID are required to generate token');
    }

    const payload = {
      userId: user.id,
      agencyId: user.agency_id,
      role: user.role,
    };

    return jwt.sign(payload, env.JWT.SECRET, {
      expiresIn: env.JWT.EXPIRES_IN || '7d',
    });
  }

  /**
   * Cryptographically verifies a JWT and returns decoded claims
   * @param {string} token
   * @returns {{ userId: string, agencyId: string, role: string }}
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, env.JWT.SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        const error = new Error('Authentication token has expired. Please log in again.');
        error.code = 'TOKEN_EXPIRED';
        error.status = 401;
        throw error;
      }
      const error = new Error('Invalid authentication token.');
      error.code = 'INVALID_TOKEN';
      error.status = 401;
      throw error;
    }
  }

  /**
   * Authenticates a user with email and password
   * @param {{ email: string, password: string }} credentials
   */
  async login({ email, password }) {
    if (!email || !password) {
      const error = new Error('Email and password are required.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    const user = await userRepository.findByEmailForAuth(email);
    if (!user) {
      const error = new Error('Invalid email or password.');
      error.code = 'INVALID_CREDENTIALS';
      error.status = 401;
      throw error;
    }

    // Check brute-force lock
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil(
        (new Date(user.locked_until).getTime() - Date.now()) / 60000
      );
      const error = new Error(
        `Account temporarily locked due to repeated failed login attempts. Please try again in ${remainingMinutes} minute(s).`
      );
      error.code = 'ACCOUNT_LOCKED';
      error.status = 423;
      throw error;
    }

    // Check account active status
    if (user.status === 'inactive' || user.status === 'suspended') {
      const error = new Error(
        'This account is currently deactivated. Please contact your agency administrator.'
      );
      error.code = 'ACCOUNT_DEACTIVATED';
      error.status = 403;
      throw error;
    }

    // Verify password hash
    const isValid = await userRepository.verifyPassword(password, user.password_hash);
    if (!isValid) {
      await userRepository.recordFailedLogin(user.id);
      const error = new Error('Invalid email or password.');
      error.code = 'INVALID_CREDENTIALS';
      error.status = 401;
      throw error;
    }

    // Successful login: reset failed attempts & update last_login_at
    await userRepository.recordSuccessfulLogin(user.id);

    // Issue JWT token
    const token = this.generateToken(user);

    return {
      token,
      user: {
        id: user.id,
        agency_id: user.agency_id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      agency: {
        id: user.agency_id,
        name: user.agency_name,
        slug: user.agency_slug,
        status: user.agency_status,
      },
    };
  }

  /**
   * Retrieves profile of current authenticated user
   * @param {string} userId
   * @param {string} agencyId
   */
  async getCurrentUser(userId, agencyId) {
    const user = await userRepository.findById(agencyId, userId);
    if (!user) {
      const error = new Error('User not found.');
      error.code = 'USER_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    const agency = await agencyRepository.findById(agencyId);

    return {
      user: {
        id: user.id,
        agency_id: user.agency_id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        last_login_at: user.last_login_at,
        created_at: user.created_at,
      },
      agency: agency
        ? {
            id: agency.id,
            name: agency.name,
            slug: agency.slug,
            status: agency.status,
          }
        : null,
    };
  }
}

export const authService = new AuthService();
