import { Router } from 'express';
import {
  listClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
} from '../controllers/client.controller.js';
import {
  listLocationsByClient,
  createLocation,
} from '../controllers/location.controller.js';
import {
  authenticate,
  authorizePermissions,
  enforceViewerReadOnly,
} from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

// All client routes require an authenticated user
router.use(authenticate);

// Enforce viewer cannot perform mutation operations
router.use(enforceViewerReadOnly);

// GET /api/v1/clients - List all clients for tenant
router.get('/', authorizePermissions(PERMISSIONS.CLIENT_VIEW), listClients);

// POST /api/v1/clients - Create a new client
router.post('/', authorizePermissions(PERMISSIONS.CLIENT_CREATE), createClient);

// GET /api/v1/clients/:clientId - Get single client by ID
router.get('/:clientId', authorizePermissions(PERMISSIONS.CLIENT_VIEW), getClientById);

// PATCH /api/v1/clients/:clientId - Update client
router.patch('/:clientId', authorizePermissions(PERMISSIONS.CLIENT_UPDATE), updateClient);

// DELETE /api/v1/clients/:clientId - Delete client
router.delete('/:clientId', authorizePermissions(PERMISSIONS.CLIENT_DELETE), deleteClient);

// --- Nested Location Endpoints for a Client ---

// GET /api/v1/clients/:clientId/locations - List locations for a client
router.get(
  '/:clientId/locations',
  authorizePermissions(PERMISSIONS.LOCATION_VIEW),
  listLocationsByClient
);

// POST /api/v1/clients/:clientId/locations - Create location for a client
router.post(
  '/:clientId/locations',
  authorizePermissions(PERMISSIONS.LOCATION_CREATE),
  createLocation
);

export default router;
