import { Router } from 'express';
import {
  connectGoogle,
  googleCallback,
  getConnectionStatus,
  getGoogleAccounts,
  getGoogleLocations,
  linkLocation,
  disconnectGoogle,
  getLinkedProfiles,
  unlinkLocation,
} from '../controllers/google.controller.js';
import {
  authenticate,
  authorizePermissions,
  enforceViewerReadOnly,
} from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

// OAuth callback is initiated by Google's redirect (state is cryptographically validated)
router.get('/callback', googleCallback);

// All subsequent Google endpoints require JWT authentication
router.use(authenticate);

// Enforce viewer cannot perform mutation operations
router.use(enforceViewerReadOnly);

// GET /api/v1/google/connect - Initiate OAuth flow
router.get('/connect', authorizePermissions(PERMISSIONS.GBP_MANAGE), connectGoogle);

// GET /api/v1/google/status - Check connection status
router.get('/status', authorizePermissions(PERMISSIONS.GBP_VIEW), getConnectionStatus);

// GET /api/v1/google/profiles - Retrieve all linked GBP profiles for current agency
router.get('/profiles', authorizePermissions(PERMISSIONS.GBP_VIEW), getLinkedProfiles);

// GET /api/v1/google/accounts - Retrieve accessible Google Business accounts
router.get('/accounts', authorizePermissions(PERMISSIONS.GBP_VIEW), getGoogleAccounts);

// GET /api/v1/google/locations - Retrieve accessible Google Business locations
router.get('/locations', authorizePermissions(PERMISSIONS.GBP_VIEW), getGoogleLocations);

// POST /api/v1/google/locations/:locationId/link - Link internal location to GBP
router.post(
  '/locations/:locationId/link',
  authorizePermissions(PERMISSIONS.GBP_MANAGE),
  linkLocation
);

// DELETE /api/v1/google/locations/:locationId/link - Unlink internal location from GBP
router.delete(
  '/locations/:locationId/link',
  authorizePermissions(PERMISSIONS.GBP_MANAGE),
  unlinkLocation
);

// POST /api/v1/google/disconnect - Disconnect Google account
router.post('/disconnect', authorizePermissions(PERMISSIONS.GBP_MANAGE), disconnectGoogle);

export default router;
