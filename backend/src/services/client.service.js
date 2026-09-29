import { clientRepository } from '../repositories/client.repository.js';
import { PERMISSIONS, hasPermission } from '../config/permissions.js';

export class ClientService {
  constructor(repository = clientRepository) {
    this.clientRepository = repository;
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
   * Creates a new client within the tenant agency boundary
   *
   * @param {string} agencyId - Tenant agency ID (verified)
   * @param {{ id: string, role: string, agency_id: string }} actor - Authenticated user
   * @param {{
   *   name: string,
   *   business_name?: string,
   *   email?: string,
   *   phone?: string,
   *   website?: string,
   *   status?: string
   * }} clientData - Client payload (agency_id in payload is stripped/ignored)
   */
  async createClient(agencyId, actor, clientData = {}) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.CLIENT_CREATE);

    // Strip any user-supplied agency_id to prevent tenant spoofing
    const { agency_id: _ignored, ...data } = clientData || {};

    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      const error = new Error('Client name is required.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    if (data.status) {
      const status = data.status.toLowerCase().trim();
      if (!['active', 'inactive', 'archived'].includes(status)) {
        const error = new Error('Status must be one of: active, inactive, archived.');
        error.code = 'VALIDATION_ERROR';
        error.status = 400;
        throw error;
      }
      data.status = status;
    }

    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email.trim())) {
        const error = new Error('Invalid email format.');
        error.code = 'VALIDATION_ERROR';
        error.status = 400;
        throw error;
      }
    }

    return this.clientRepository.create(ctx.agencyId, data);
  }

  /**
   * Retrieves a client by ID within the tenant agency boundary
   *
   * @param {string} agencyId - Tenant agency ID (verified)
   * @param {{ id: string, role: string, agency_id: string }} actor - Authenticated user
   * @param {string} clientId - Client ID
   */
  async getClientById(agencyId, actor, clientId) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.CLIENT_VIEW);

    if (!clientId) {
      const error = new Error('Client ID is required.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    const client = await this.clientRepository.findById(ctx.agencyId, clientId);
    if (!client) {
      const error = new Error('Client not found.');
      error.code = 'CLIENT_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    return client;
  }

  /**
   * Lists all clients belonging to the tenant agency
   *
   * @param {string} agencyId - Tenant agency ID (verified)
   * @param {{ id: string, role: string, agency_id: string }} actor - Authenticated user
   */
  async listClients(agencyId, actor) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.CLIENT_VIEW);

    return this.clientRepository.listByAgency(ctx.agencyId);
  }

  /**
   * Updates an existing client with partial payload support
   *
   * @param {string} agencyId - Tenant agency ID (verified)
   * @param {{ id: string, role: string, agency_id: string }} actor - Authenticated user
   * @param {string} clientId - Client ID
   * @param {{
   *   name?: string,
   *   business_name?: string,
   *   email?: string,
   *   phone?: string,
   *   website?: string,
   *   status?: string
   * }} clientData - Partial update payload
   */
  async updateClient(agencyId, actor, clientId, clientData = {}) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.CLIENT_UPDATE);

    if (!clientId) {
      const error = new Error('Client ID is required.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    // Strip any user-supplied agency_id
    const { agency_id: _ignored, ...data } = clientData || {};

    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || !data.name.trim()) {
        const error = new Error('Client name cannot be empty.');
        error.code = 'VALIDATION_ERROR';
        error.status = 400;
        throw error;
      }
      data.name = data.name.trim();
    }

    if (data.status !== undefined) {
      const status = typeof data.status === 'string' ? data.status.toLowerCase().trim() : '';
      if (!['active', 'inactive', 'archived'].includes(status)) {
        const error = new Error('Status must be one of: active, inactive, archived.');
        error.code = 'VALIDATION_ERROR';
        error.status = 400;
        throw error;
      }
      data.status = status;
    }

    if (data.email !== undefined && data.email !== null && data.email !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email.trim())) {
        const error = new Error('Invalid email format.');
        error.code = 'VALIDATION_ERROR';
        error.status = 400;
        throw error;
      }
    }

    const updated = await this.clientRepository.update(ctx.agencyId, clientId, data);
    if (!updated) {
      const error = new Error('Client not found.');
      error.code = 'CLIENT_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    return updated;
  }

  /**
   * Deletes a client within the tenant agency boundary
   *
   * @param {string} agencyId - Tenant agency ID (verified)
   * @param {{ id: string, role: string, agency_id: string }} actor - Authenticated user
   * @param {string} clientId - Client ID
   */
  async deleteClient(agencyId, actor, clientId) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.CLIENT_DELETE);

    if (!clientId) {
      const error = new Error('Client ID is required.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    const deleted = await this.clientRepository.delete(ctx.agencyId, clientId);
    if (!deleted) {
      const error = new Error('Client not found.');
      error.code = 'CLIENT_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    return deleted;
  }
}

export const clientService = new ClientService();
