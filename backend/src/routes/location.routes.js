import { Router } from 'express';
import {
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation,
} from '../controllers/location.controller.js';
import { syncLocationReviews } from '../controllers/review.controller.js';
import {
  authenticate,
  authorizePermissions,
  enforceViewerReadOnly,
} from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

// All location routes require an authenticated user
router.use(authenticate);

// Enforce viewer cannot perform mutation operations
router.use(enforceViewerReadOnly);

// POST /api/v1/locations - Create a location (client_id in body)
router.post('/', authorizePermissions(PERMISSIONS.LOCATION_CREATE), createLocation);

// GET /api/v1/locations/:locationId - Get single location by ID
router.get('/:locationId', authorizePermissions(PERMISSIONS.LOCATION_VIEW), getLocationById);

// PATCH /api/v1/locations/:locationId - Update location
router.patch('/:locationId', authorizePermissions(PERMISSIONS.LOCATION_UPDATE), updateLocation);

// DELETE /api/v1/locations/:locationId - Delete location
router.delete('/:locationId', authorizePermissions(PERMISSIONS.LOCATION_DELETE), deleteLocation);

// POST /api/v1/locations/:locationId/reviews/sync - Synchronize reviews from Google Business Profile
router.post(
  '/:locationId/reviews/sync',
  authorizePermissions(PERMISSIONS.REVIEW_SYNC),
  syncLocationReviews
);

export default router;
