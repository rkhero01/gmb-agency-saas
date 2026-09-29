import { locationRepository } from '../repositories/location.repository.js';
import { clientRepository } from '../repositories/client.repository.js';
import { PERMISSIONS, hasPermission } from '../config/permissions.js';

export class LocationService {
  constructor(locationRepo = locationRepository, clientRepo = clientRepository) {
    this.locationRepository = locationRepo;
    this.clientRepository = clientRepo;
  }

  /**
   * Resolves verified agencyId and actor context
   * Supports both (agencyId, actor) and (actor) where actor contains agency_id
   * Guarantees tenant context strictly originates from verified auth claims
   * @private
   */
  _resolveContext(agencyId, actor) {
    let resolvedAgencyId = agencyId;
    let resolvedActor = actor;

    if (typeof agencyId === 'object' && agencyId !== null && !actor) {
      resolvedActor = agencyId;
      resolvedAgencyId = resolvedActor.agency_id || resolvedActor.agencyId;
    } else if (typeof agencyId === 'string') {
      resolvedAgencyId = agencyId;
    } else if (actor && (actor.agency_id || actor.agencyId)) {
      resolvedAgencyId = actor.agency_id || actor.agencyId;
    }

    if (!resolvedAgencyId) {
      const error = new Error('Tenant agency context is required.');
      error.code = 'TENANT_REQUIRED';
      error.status = 400;
      throw error;
    }

    if (!resolvedActor || !resolvedActor.role) {
      const error = new Error('Authenticated user context with role is required.');
      error.code = 'AUTH_REQUIRED';
      error.status = 401;
      throw error;
    }

    return { agencyId: resolvedAgencyId, actor: resolvedActor };
  }

  /**
   * Asserts that the actor possesses the required permission
   * @private
   */
  _assertPermission(actor, permission) {
    if (!hasPermission(actor.role, permission)) {
      const error = new Error(
        `Access denied: Role "${actor.role}" lacks the required "${permission}" permission.`
      );
      error.code = 'FORBIDDEN';
      error.status = 403;
      throw error;
    }
  }

  /**
   * Creates a new location scoped to the tenant agency and client
   *
   * @param {string} agencyId - Tenant agency ID (verified)
   * @param {{ id: string, role: string, agency_id: string }} actor - Authenticated user
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
   * }} locationData - Location payload (agency_id in payload is stripped/ignored)
   */
  async createLocation(agencyId, actor, locationData = {}) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.LOCATION_CREATE);

    // Strip any user-supplied agency_id to prevent tenant spoofing
    const { agency_id: _ignored, ...data } = locationData || {};

    if (!data.client_id) {
      const error = new Error('client_id is required.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      const error = new Error('Location name is required.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    if (data.status) {
      const status = data.status.toLowerCase().trim();
      if (!['active', 'pending', 'suspended', 'archived'].includes(status)) {
        const error = new Error('Status must be one of: active, pending, suspended, archived.');
        error.code = 'VALIDATION_ERROR';
        error.status = 400;
        throw error;
      }
      data.status = status;
    }

    // Verify that the referenced client belongs to the authenticated agency
    const client = await this.clientRepository.findById(ctx.agencyId, data.client_id);
    if (!client) {
      const error = new Error('Client not found.');
      error.code = 'CLIENT_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    return this.locationRepository.create(ctx.agencyId, data);
  }

  /**
   * Retrieves a location by ID within the tenant agency boundary
   *
   * @param {string} agencyId - Tenant agency ID (verified)
   * @param {{ id: string, role: string, agency_id: string }} actor - Authenticated user
   * @param {string} locationId - Location ID
   */
  async getLocationById(agencyId, actor, locationId) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.LOCATION_VIEW);

    if (!locationId) {
      const error = new Error('Location ID is required.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    const location = await this.locationRepository.findById(ctx.agencyId, locationId);
    if (!location) {
      const error = new Error('Location not found.');
      error.code = 'LOCATION_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    return location;
  }

  /**
   * Lists all locations for a specific client within the tenant agency boundary
   *
   * @param {string} agencyId - Tenant agency ID (verified)
   * @param {{ id: string, role: string, agency_id: string }} actor - Authenticated user
   * @param {string} clientId - Client ID
   */
  async listLocationsByClient(agencyId, actor, clientId) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.LOCATION_VIEW);

    if (!clientId) {
      const error = new Error('Client ID is required.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    // Verify that the client belongs to this agency
    const client = await this.clientRepository.findById(ctx.agencyId, clientId);
    if (!client) {
      const error = new Error('Client not found.');
      error.code = 'CLIENT_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    return this.locationRepository.listByClient(ctx.agencyId, clientId);
  }

  /**
   * Alias for listLocationsByClient
   */
  async listLocations(agencyId, actor, clientId) {
    return this.listLocationsByClient(agencyId, actor, clientId);
  }

  /**
   * Updates an existing location with partial payload support
   *
   * @param {string} agencyId - Tenant agency ID (verified)
   * @param {{ id: string, role: string, agency_id: string }} actor - Authenticated user
   * @param {string} locationId - Location ID
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
   * }} locationData - Partial update payload
   */
  async updateLocation(agencyId, actor, locationId, locationData = {}) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.LOCATION_UPDATE);

    if (!locationId) {
      const error = new Error('Location ID is required.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    // Strip any user-supplied agency_id
    const { agency_id: _ignored, ...data } = locationData || {};

    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || !data.name.trim()) {
        const error = new Error('Location name cannot be empty.');
        error.code = 'VALIDATION_ERROR';
        error.status = 400;
        throw error;
      }
      data.name = data.name.trim();
    }

    if (data.status !== undefined) {
      const status = typeof data.status === 'string' ? data.status.toLowerCase().trim() : '';
      if (!['active', 'pending', 'suspended', 'archived'].includes(status)) {
        const error = new Error('Status must be one of: active, pending, suspended, archived.');
        error.code = 'VALIDATION_ERROR';
        error.status = 400;
        throw error;
      }
      data.status = status;
    }

    // If client_id is changing, verify that the target client belongs to the tenant agency
    if (data.client_id !== undefined) {
      if (!data.client_id) {
        const error = new Error('Client ID cannot be empty.');
        error.code = 'VALIDATION_ERROR';
        error.status = 400;
        throw error;
      }

      const client = await this.clientRepository.findById(ctx.agencyId, data.client_id);
      if (!client) {
        const error = new Error('Client not found.');
        error.code = 'CLIENT_NOT_FOUND';
        error.status = 404;
        throw error;
      }
    }

    const updated = await this.locationRepository.update(ctx.agencyId, locationId, data);
    if (!updated) {
      const error = new Error('Location not found.');
      error.code = 'LOCATION_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    return updated;
  }

  /**
   * Deletes a location within the tenant agency boundary
   *
   * @param {string} agencyId - Tenant agency ID (verified)
   * @param {{ id: string, role: string, agency_id: string }} actor - Authenticated user
   * @param {string} locationId - Location ID
   */
  async deleteLocation(agencyId, actor, locationId) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.LOCATION_DELETE);

    if (!locationId) {
      const error = new Error('Location ID is required.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    const deleted = await this.locationRepository.delete(ctx.agencyId, locationId);
    if (!deleted) {
      const error = new Error('Location not found.');
      error.code = 'LOCATION_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    return deleted;
  }
}

export const locationService = new LocationService();
