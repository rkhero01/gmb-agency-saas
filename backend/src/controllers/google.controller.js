import { googleService } from '../services/google/google.service.js';
import { env } from '../config/env.js';

/**
 * Initiates Google OAuth 2.0 authorization
 * GET /api/v1/google/connect
 */
export async function connectGoogle(req, res, next) {
  try {
    const result = await googleService.getAuthorizationUrl(
      req.tenant.agencyId,
      req.user
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Handles Google OAuth 2.0 callback
 * GET /api/v1/google/callback
 */
export async function googleCallback(req, res, next) {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      const redirectUrl = `${env.CORS_ORIGIN}/?view=gbp&error=${encodeURIComponent(
        oauthError
      )}`;
      return res.redirect(redirectUrl);
    }

    const result = await googleService.handleCallback(code, state);

    // If request accepts HTML or browser redirect, redirect back to frontend
    if (req.accepts('html') && !req.xhr && !req.headers['x-test-suite']) {
      const redirectUrl = `${env.CORS_ORIGIN}/?view=gbp&status=connected`;
      return res.redirect(redirectUrl);
    }

    res.status(200).json({
      success: true,
      data: result,
      message: 'Google account connected successfully.',
    });
  } catch (error) {
    if (req.accepts('html') && !req.xhr && !req.headers['x-test-suite']) {
      const redirectUrl = `${env.CORS_ORIGIN}/?view=gbp&error=${encodeURIComponent(
        error.message || 'OAuth authentication failed'
      )}`;
      return res.redirect(redirectUrl);
    }
    next(error);
  }
}

/**
 * Checks current Google connection status for the agency
 * GET /api/v1/google/status
 */
export async function getConnectionStatus(req, res, next) {
  try {
    const status = await googleService.getConnectionStatus(
      req.tenant.agencyId,
      req.user
    );

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves accessible Google Business Profile accounts
 * GET /api/v1/google/accounts
 */
export async function getGoogleAccounts(req, res, next) {
  try {
    const accounts = await googleService.getAccessibleAccounts(
      req.tenant.agencyId,
      req.user
    );

    res.status(200).json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves accessible Google Business Profile locations under an account
 * GET /api/v1/google/locations
 */
export async function getGoogleLocations(req, res, next) {
  try {
    const { accountId } = req.query;
    const locations = await googleService.getAccessibleLocations(
      req.tenant.agencyId,
      req.user,
      accountId
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
 * Links an internal Location to a Google Business Profile location
 * POST /api/v1/google/locations/:locationId/link
 */
export async function linkLocation(req, res, next) {
  try {
    const { locationId } = req.params;
    const { googleAccountId, googleLocationId, profileName, metadata } = req.body;

    const profile = await googleService.linkLocation(
      req.tenant.agencyId,
      req.user,
      locationId,
      {
        googleAccountId,
        googleLocationId,
        profileName,
        metadata,
      }
    );

    res.status(200).json({
      success: true,
      data: profile,
      message: 'Google Business Profile location linked successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Disconnects Google account for the agency
 * POST /api/v1/google/disconnect
 */
export async function disconnectGoogle(req, res, next) {
  try {
    const result = await googleService.disconnect(
      req.tenant.agencyId,
      req.user
    );

    res.status(200).json({
      success: true,
      data: result,
      message: 'Google account disconnected successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves all linked GBP profiles for the agency
 * GET /api/v1/google/profiles
 */
export async function getLinkedProfiles(req, res, next) {
  try {
    const profiles = await googleService.getLinkedProfiles(
      req.tenant.agencyId,
      req.user
    );

    res.status(200).json({
      success: true,
      data: profiles,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Unlinks an internal Location from GBP
 * DELETE /api/v1/google/locations/:locationId/link
 */
export async function unlinkLocation(req, res, next) {
  try {
    const { locationId } = req.params;
    const result = await googleService.unlinkLocation(
      req.tenant.agencyId,
      req.user,
      locationId
    );

    res.status(200).json({
      success: true,
      data: result,
      message: 'Google Business Profile unlinked successfully.',
    });
  } catch (error) {
    next(error);
  }
}

