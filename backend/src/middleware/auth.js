import { authService } from '../services/auth.service.js';
import { hasPermission } from '../config/permissions.js';

/**
 * Authentication Middleware
 * Validates JWT token, verifies claims, and attaches user and tenant context.
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.headers['x-access-token']) {
    token = req.headers['x-access-token'];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required. Please provide a valid Bearer token.',
      },
    });
  }

  try {
    const decoded = authService.verifyToken(token);

    // Attach verified user claims
    req.user = {
      id: decoded.userId,
      agency_id: decoded.agencyId,
      role: decoded.role,
    };

    // Attach strictly verified tenant context (ZERO TRUST on client headers)
    req.tenant = {
      agencyId: decoded.agencyId,
      userId: decoded.userId,
      role: decoded.role,
      isProductionVerified: true,
      resolvedAt: new Date().toISOString(),
    };

    next();
  } catch (err) {
    return res.status(err.status || 401).json({
      success: false,
      error: {
        code: err.code || 'INVALID_TOKEN',
        message: err.message || 'Invalid or expired authentication token.',
      },
    });
  }
}

/**
 * Centralized RBAC Permission Authorization Middleware
 * Verifies that the authenticated user possesses the required permission(s).
 * @param  {...string} requiredPermissions
 */
export function authorizePermissions(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'User authentication required.',
        },
      });
    }

    const userRole = req.user.role;

    // Check if user has all required permissions
    const hasAll = requiredPermissions.every((perm) => hasPermission(userRole, perm));

    if (!hasAll) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied: Role "${userRole}" lacks the required permission(s).`,
          requiredPermissions,
        },
      });
    }

    next();
  };
}

/**
 * Role-Based Authorization Middleware
 * Verifies that the user role matches at least one of the allowed roles.
 * @param  {...string} allowedRoles
 */
export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'User authentication required.',
        },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied: Role "${req.user.role}" is not authorized for this resource.`,
          allowedRoles,
        },
      });
    }

    next();
  };
}

/**
 * Read-Only Safeguard Middleware for 'viewer' role
 * Prevents viewers from performing non-idempotent modification requests.
 */
export function enforceViewerReadOnly(req, res, next) {
  if (req.user && req.user.role === 'viewer') {
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());
    if (isMutation) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'VIEWER_READ_ONLY',
          message: 'Viewer role has read-only access. Modification actions are prohibited.',
        },
      });
    }
  }
  next();
}
