import { locationService } from '../services/location.service.js';

/**
 * Lists all locations for a specific client within the tenant agency
 * GET /api/v1/clients/:clientId/locations
 */
export async function listLocationsByClient(req, res, next) {
  try {
    const { clientId } = req.params;
    const locations = await locationService.listLocationsByClient(
      req.tenant.agencyId,
      req.user,
      clientId
    );

    res.status(200).json({
      success: true,
      data: locations,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves a single location by ID within the tenant agency
 * GET /api/v1/locations/:locationId
 */
export async function getLocationById(req, res, next) {
  try {
    const { locationId } = req.params;
    const location = await locationService.getLocationById(
      req.tenant.agencyId,
      req.user,
      locationId
    );

    res.status(200).json({
      success: true,
      data: location,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Creates a new location under a client within the tenant agency
 * POST /api/v1/clients/:clientId/locations or POST /api/v1/locations
 */
export async function createLocation(req, res, next) {
  try {
    const clientId = req.params.clientId || req.body.client_id;
    const {
      name,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      timezone,
      phone,
      website,
      status,
    } = req.body;

    const location = await locationService.createLocation(req.tenant.agencyId, req.user, {
      client_id: clientId,
      name,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      timezone,
      phone,
      website,
      status,
    });

    res.status(201).json({
      success: true,
      data: location,
      message: `Location "${location.name}" created successfully.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates a location within the tenant agency (supports partial updates)
 * PATCH /api/v1/locations/:locationId
 */
export async function updateLocation(req, res, next) {
  try {
    const { locationId } = req.params;
    const {
      client_id,
      name,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      timezone,
      phone,
      website,
      status,
    } = req.body;

    const location = await locationService.updateLocation(
      req.tenant.agencyId,
      req.user,
      locationId,
      {
        client_id,
        name,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
        timezone,
        phone,
        website,
        status,
      }
    );

    res.status(200).json({
      success: true,
      data: location,
      message: `Location "${location.name}" updated successfully.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Deletes a location within the tenant agency
 * DELETE /api/v1/locations/:locationId
 */
export async function deleteLocation(req, res, next) {
  try {
    const { locationId } = req.params;
    const location = await locationService.deleteLocation(
      req.tenant.agencyId,
      req.user,
      locationId
    );

    res.status(200).json({
      success: true,
      data: location,
      message: `Location "${location.name}" deleted successfully.`,
    });
  } catch (error) {
    next(error);
  }
}

// Named alias
export const getLocationsByClient = listLocationsByClient;
