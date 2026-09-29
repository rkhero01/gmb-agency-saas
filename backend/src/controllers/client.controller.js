import { clientService } from '../services/client.service.js';

/**
 * Lists all clients within the tenant agency
 * GET /api/v1/clients
 */
export async function listClients(req, res, next) {
  try {
    const clients = await clientService.listClients(req.tenant.agencyId, req.user);
    res.status(200).json({
      success: true,
      data: clients,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves a single client by ID within the tenant agency
 * GET /api/v1/clients/:clientId
 */
export async function getClientById(req, res, next) {
  try {
    const { clientId } = req.params;
    const client = await clientService.getClientById(req.tenant.agencyId, req.user, clientId);

    res.status(200).json({
      success: true,
      data: client,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Creates a new client within the tenant agency
 * POST /api/v1/clients
 */
export async function createClient(req, res, next) {
  try {
    const { name, business_name, email, phone, website, status } = req.body;
    const client = await clientService.createClient(req.tenant.agencyId, req.user, {
      name,
      business_name,
      email,
      phone,
      website,
      status,
    });

    res.status(201).json({
      success: true,
      data: client,
      message: `Client "${client.name}" created successfully.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates a client within the tenant agency (supports partial updates)
 * PATCH /api/v1/clients/:clientId
 */
export async function updateClient(req, res, next) {
  try {
    const { clientId } = req.params;
    const { name, business_name, email, phone, website, status } = req.body;

    const client = await clientService.updateClient(
      req.tenant.agencyId,
      req.user,
      clientId,
      {
        name,
        business_name,
        email,
        phone,
        website,
        status,
      }
    );

    res.status(200).json({
      success: true,
      data: client,
      message: `Client "${client.name}" updated successfully.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Deletes a client within the tenant agency
 * DELETE /api/v1/clients/:clientId
 */
export async function deleteClient(req, res, next) {
  try {
    const { clientId } = req.params;
    const client = await clientService.deleteClient(req.tenant.agencyId, req.user, clientId);

    res.status(200).json({
      success: true,
      data: client,
      message: `Client "${client.name}" deleted successfully.`,
    });
  } catch (error) {
    next(error);
  }
}

// Named alias
export const getClients = listClients;
