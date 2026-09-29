import { authService } from '../services/auth.service.js';
import { tenantService } from '../services/tenant.service.js';

/**
 * Handles user login
 * POST /api/v1/auth/login
 */
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });

    res.status(200).json({
      success: true,
      data: result,
      message: 'Login successful.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handles user logout
 * POST /api/v1/auth/logout
 */
export async function logout(req, res) {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
}

/**
 * Returns current authenticated user and agency context
 * GET /api/v1/auth/me
 */
export async function getMe(req, res, next) {
  try {
    const result = await authService.getCurrentUser(req.user.id, req.tenant.agencyId);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Registers a new agency along with initial owner
 * POST /api/v1/auth/register
 */
export async function register(req, res, next) {
  try {
    const { agencyName, agencySlug, name, email, password } = req.body;

    if (!agencyName || !agencySlug || !name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'All fields (agencyName, agencySlug, name, email, password) are required.',
        },
      });
    }

    const { agency, owner } = await tenantService.provisionAgencyWithOwner({
      agencyName,
      agencySlug,
      ownerName: name,
      ownerEmail: email,
      ownerPassword: password,
    });

    const token = authService.generateToken({
      id: owner.id,
      agency_id: agency.id,
      role: owner.role,
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: owner.id,
          agency_id: agency.id,
          name: owner.name,
          email: owner.email,
          role: owner.role,
          status: owner.status,
        },
        agency: {
          id: agency.id,
          name: agency.name,
          slug: agency.slug,
        },
      },
      message: 'Agency registered successfully.',
    });
  } catch (error) {
    next(error);
  }
}
