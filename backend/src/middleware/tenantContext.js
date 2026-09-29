/**
 * Multi-Tenant Context Middleware
 *
 * Ensures every incoming request that operates on tenant-scoped data
 * has a validated agency context. In future phases, this will extract
 * the agency_id from verified JWT claims or an API key.
 *
 * For Phase 0 / public health routes, this middleware can be bypassed or
 * provides an explicit tenant resolution contract.
 */

export function requireTenantContext(req, res, next) {
  // Read tenant indicator from header (or auth token in Phase 2)
  const agencyId = req.headers['x-agency-id'] || req.user?.agency_id;

  if (!agencyId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'TENANT_CONTEXT_REQUIRED',
        message: 'A valid agency context (x-agency-id) is required to access this resource.',
      },
    });
  }

  // UUID format validation regex (prevent SQL injection / malformed tenant IDs)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
  };

  next();
}

/**
 * Optional Tenant Context Middleware (for routes where agency context is optional)
 */
export function optionalTenantContext(req, res, next) {
  const agencyId = req.headers['x-agency-id'] || req.user?.agency_id;
  if (agencyId) {
    req.tenant = { agencyId, resolvedAt: new Date().toISOString() };
  }
  next();
}
