import { env } from '../config/env.js';

/**
 * Multi-Tenant Context Middleware
 *
 * CRITICAL SECURITY INVARIANT:
 * In production, the tenant identity (`agencyId`) MUST NEVER be trusted from a
 * raw, client-supplied header (`x-agency-id`).
 *
 * In production:
 * 1. User authenticates via JWT / session cookie.
 * 2. Auth middleware verifies cryptographic signature and extracts `req.user.agency_id`.
 * 3. `req.tenant` is populated exclusively from verified server-side claims.
 *
 * In development / automated testing:
 * A header override (`x-agency-id`) is accepted ONLY when not in production,
 * facilitating test runner execution and API prototyping without full OAuth/JWT flow.
 */
export function requireTenantContext(req, res, next) {
  let agencyId = null;

  // 1. Primary & Secure Source: Verified user session from authenticated token
  if (req.user && req.user.agency_id) {
    agencyId = req.user.agency_id;
  }
  // 2. Development / Testing Only: Controlled header override
  else if (!env.IS_PRODUCTION && req.headers['x-agency-id']) {
    agencyId = req.headers['x-agency-id'];
  }

  // If no verified tenant context could be resolved, deny access
  if (!agencyId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'TENANT_CONTEXT_REQUIRED',
        message:
          'Access denied: A verified tenant agency context is required to access this resource.',
      },
    });
  }

  // UUID format validation regex (strictly reject malformed or SQL-injection payloads)
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(agencyId)) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_TENANT_ID',
        message: 'Invalid agency ID format. Must be a valid UUID.',
      },
    });
  }

  // Attach verified tenant context to request
  req.tenant = {
    agencyId,
    resolvedAt: new Date().toISOString(),
    isProductionVerified: Boolean(req.user?.agency_id),
  };

  next();
}

/**
 * Optional Tenant Context Middleware (for public or health routes)
 */
export function optionalTenantContext(req, res, next) {
  let agencyId = req.user?.agency_id;
  if (!agencyId && !env.IS_PRODUCTION && req.headers['x-agency-id']) {
    agencyId = req.headers['x-agency-id'];
  }

  if (agencyId) {
    req.tenant = {
      agencyId,
      resolvedAt: new Date().toISOString(),
      isProductionVerified: Boolean(req.user?.agency_id),
    };
  }

  next();
}
