import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import { env } from '../../config/env.js';
import { googleOAuthRepository } from '../../repositories/googleOAuth.repository.js';
import { googleBusinessProfileRepository } from '../../repositories/googleBusinessProfile.repository.js';
import { locationRepository } from '../../repositories/location.repository.js';
import { PERMISSIONS, hasPermission } from '../../config/permissions.js';

export class GoogleService {
  constructor(
    oauthRepo = googleOAuthRepository,
    gbpRepo = googleBusinessProfileRepository,
    locationRepo = locationRepository
  ) {
    this.oauthRepo = oauthRepo;
    this.gbpRepo = gbpRepo;
    this.locationRepo = locationRepo;
  }

  /**
   * Instantiates a fresh Google OAuth2 client with configured environment credentials
   * @private
   */
  _createOAuthClient() {
    if (!env.GOOGLE.CLIENT_ID || !env.GOOGLE.CLIENT_SECRET) {
      const error = new Error(
        'Google OAuth 2.0 credentials are not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.'
      );
      error.code = 'GOOGLE_OAUTH_NOT_CONFIGURED';
      error.status = 503;
      throw error;
    }

    return new google.auth.OAuth2(
      env.GOOGLE.CLIENT_ID,
      env.GOOGLE.CLIENT_SECRET,
      env.GOOGLE.REDIRECT_URI
    );
  }

  /**
   * Asserts that actor possesses the required permission
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
   * Generates Google OAuth 2.0 authorization URL with cryptographically signed state
   *
   * @param {string} agencyId - Authenticated tenant agency ID
   * @param {{ id: string, role: string }} actor - Authenticated user
   */
  async getAuthorizationUrl(agencyId, actor) {
    if (!agencyId) throw new Error('agency_id is required');
    this._assertPermission(actor, PERMISSIONS.GBP_MANAGE);

    // Cryptographically signed state token embedding tenant claims & unique nonce
    const state = jwt.sign(
      {
        agencyId,
        userId: actor.id,
        nonce: crypto.randomBytes(16).toString('hex'),
        action: 'google_oauth_connect',
      },
      env.JWT.SECRET,
      { expiresIn: '15m' }
    );

    const oauth2Client = this._createOAuthClient();
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: env.GOOGLE.SCOPES,
      state,
    });

    return { url, state };
  }

  /**
   * Handles Google OAuth callback: verifies state token, exchanges code for tokens,
   * retrieves Google profile metadata, and saves connection credentials.
   *
   * @param {string} code - Google authorization code
   * @param {string} state - Cryptographic state token
   */
  async handleCallback(code, state) {
    if (!code) {
      const error = new Error('Authorization code is missing from Google callback.');
      error.code = 'GOOGLE_OAUTH_FAILED';
      error.status = 400;
      throw error;
    }

    if (!state) {
      const error = new Error('State token is missing from Google callback.');
      error.code = 'GOOGLE_OAUTH_STATE_INVALID';
      error.status = 400;
      throw error;
    }

    let decoded;
    try {
      decoded = jwt.verify(state, env.JWT.SECRET);
    } catch {
      const error = new Error('Invalid or expired OAuth state token. Possible CSRF attempt.');
      error.code = 'GOOGLE_OAUTH_STATE_INVALID';
      error.status = 400;
      throw error;
    }

    if (decoded.action !== 'google_oauth_connect' || !decoded.agencyId) {
      const error = new Error('Mismatched or forged OAuth state payload.');
      error.code = 'GOOGLE_OAUTH_STATE_INVALID';
      error.status = 400;
      throw error;
    }

    const agencyId = decoded.agencyId;
    const oauth2Client = this._createOAuthClient();

    let tokens;
    try {
      const tokenResponse = await oauth2Client.getToken(code);
      tokens = tokenResponse.tokens;
    } catch (err) {
      const error = new Error(`Failed to exchange code with Google: ${err.message}`);
      error.code = 'GOOGLE_OAUTH_FAILED';
      error.status = 400;
      throw error;
    }

    if (!tokens.access_token) {
      const error = new Error('Google did not return an access token.');
      error.code = 'GOOGLE_OAUTH_FAILED';
      error.status = 502;
      throw error;
    }

    // Set credentials to fetch user info
    oauth2Client.setCredentials(tokens);
    let userInfo = null;
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userRes = await oauth2.userinfo.get();
      userInfo = userRes.data;
    } catch (err) {
      console.warn('Could not fetch Google user info profile:', err.message);
    }

    // Persist connection in database
    const saved = await this.oauthRepo.upsertConnection(agencyId, {
      googleAccountId: userInfo?.id || null,
      googleEmail: userInfo?.email || null,
      googleName: userInfo?.name || null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: tokens.scope ? tokens.scope.split(' ') : env.GOOGLE.SCOPES,
      connectionStatus: 'connected',
    });

    return {
      agencyId,
      connected: true,
      account: {
        id: saved.id,
        google_account_id: saved.google_account_id,
        google_email: saved.google_email,
        google_name: saved.google_name,
        connection_status: saved.connection_status,
      },
    };
  }

  /**
   * Retrieves an authenticated OAuth2Client for an agency, refreshing tokens if expired
   * @private
   */
  async _getAuthenticatedOAuthClient(agencyId) {
    const connection = await this.oauthRepo.findByAgency(agencyId);
    if (!connection || connection.connection_status !== 'connected' || !connection.access_token) {
      const error = new Error('Google account is not connected for this agency.');
      error.code = 'GOOGLE_NOT_CONNECTED';
      error.status = 404;
      throw error;
    }

    const oauth2Client = this._createOAuthClient();
    oauth2Client.setCredentials({
      access_token: connection.access_token,
      refresh_token: connection.refresh_token,
      expiry_date: connection.token_expiry ? new Date(connection.token_expiry).getTime() : null,
    });

    // Automatically capture refreshed tokens and persist them
    oauth2Client.on('tokens', async (newTokens) => {
      try {
        await this.oauthRepo.upsertConnection(agencyId, {
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token || connection.refresh_token,
          tokenExpiry: newTokens.expiry_date ? new Date(newTokens.expiry_date) : null,
          connectionStatus: 'connected',
        });
      } catch (err) {
        console.error('Failed to persist refreshed Google tokens:', err.message);
      }
    });

    return { oauth2Client, connection };
  }

  /**
   * Retrieves safe connection status for frontend display (tokens strictly omitted)
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string }} actor
   */
  async getConnectionStatus(agencyId, actor) {
    if (!agencyId) throw new Error('agency_id is required');
    this._assertPermission(actor, PERMISSIONS.GBP_VIEW);

    const connection = await this.oauthRepo.getSanitizedConnection(agencyId);
    if (!connection || connection.connection_status === 'disconnected') {
      return {
        connected: false,
        account: null,
      };
    }

    return {
      connected: connection.connection_status === 'connected',
      account: connection,
    };
  }

  /**
   * Retrieves list of accessible Google Business Profile accounts
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string }} actor
   */
  async getAccessibleAccounts(agencyId, actor) {
    if (!agencyId) throw new Error('agency_id is required');
    this._assertPermission(actor, PERMISSIONS.GBP_VIEW);

    const { oauth2Client } = await this._getAuthenticatedOAuthClient(agencyId);

    try {
      const res = await oauth2Client.request({
        url: 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      });

      const accounts = res.data?.accounts || [];
      return accounts.map((acc) => ({
        id: acc.name?.replace('accounts/', '') || acc.name,
        name: acc.name,
        accountName: acc.accountName || acc.name,
        type: acc.type || 'ORGANIZATION',
        role: acc.role || 'OWNER',
        verificationState: acc.verificationState || 'VERIFIED',
      }));
    } catch (err) {
      if (err.status === 401 || err.code === 401) {
        const error = new Error('Google authentication has expired. Please reconnect.');
        error.code = 'GOOGLE_TOKEN_REFRESH_FAILED';
        error.status = 401;
        throw error;
      }
      if (err.status === 403 || err.code === 403) {
        const error = new Error(`Google API access forbidden: ${err.message}`);
        error.code = 'GOOGLE_FORBIDDEN';
        error.status = 403;
        throw error;
      }
      const error = new Error(`Google API error fetching accounts: ${err.message}`);
      error.code = 'GOOGLE_API_ERROR';
      error.status = err.status || 502;
      throw error;
    }
  }

  /**
   * Retrieves list of accessible locations under a Google Business Profile account
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string }} actor
   * @param {string} [accountId]
   */
  async getAccessibleLocations(agencyId, actor, accountId = null) {
    if (!agencyId) throw new Error('agency_id is required');
    this._assertPermission(actor, PERMISSIONS.GBP_VIEW);

    const { oauth2Client } = await this._getAuthenticatedOAuthClient(agencyId);

    let targetAccountId = accountId;
    if (!targetAccountId) {
      const accounts = await this.getAccessibleAccounts(agencyId, actor);
      if (accounts.length === 0) return [];
      targetAccountId = accounts[0].id;
    }

    try {
      const formattedAccount = targetAccountId.startsWith('accounts/')
        ? targetAccountId
        : `accounts/${targetAccountId}`;

      const res = await oauth2Client.request({
        url: `https://mybusinessbusinessinformation.googleapis.com/v1/${formattedAccount}/locations`,
        params: {
          readMask:
            'name,title,storefrontAddress,phoneNumbers,websiteUri,categories,regularHours',
        },
      });

      const locations = res.data?.locations || [];
      return locations.map((loc) => ({
        googleLocationId: loc.name?.split('/').pop() || loc.name,
        googleAccountId: targetAccountId,
        name: loc.name,
        title: loc.title || 'Untitled Location',
        storefrontAddress: loc.storefrontAddress || null,
        phone: loc.phoneNumbers?.primaryPhone || null,
        websiteUri: loc.websiteUri || null,
      }));
    } catch (err) {
      if (err.status === 401 || err.code === 401) {
        const error = new Error('Google authentication has expired. Please reconnect.');
        error.code = 'GOOGLE_TOKEN_REFRESH_FAILED';
        error.status = 401;
        throw error;
      }
      if (err.status === 403 || err.code === 403) {
        const error = new Error(`Google API access forbidden: ${err.message}`);
        error.code = 'GOOGLE_FORBIDDEN';
        error.status = 403;
        throw error;
      }
      if (err.status === 404 || err.code === 404) {
        const error = new Error(`Google location not found: ${err.message}`);
        error.code = 'GOOGLE_LOCATION_NOT_FOUND';
        error.status = 404;
        throw error;
      }
      const error = new Error(`Google API error fetching locations: ${err.message}`);
      error.code = 'GOOGLE_API_ERROR';
      error.status = err.status || 502;
      throw error;
    }
  }

  /**
   * Links an internal Location to a Google Business Profile location
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string }} actor
   * @param {string} locationId
   * @param {{
   *   googleAccountId?: string,
   *   googleLocationId: string,
   *   profileName?: string,
   *   metadata?: object
   * }} linkData
   */
  async linkLocation(agencyId, actor, locationId, linkData) {
    if (!agencyId) throw new Error('agency_id is required');
    if (!locationId) throw new Error('location_id is required');
    this._assertPermission(actor, PERMISSIONS.GBP_MANAGE);

    if (!linkData?.googleLocationId) {
      const error = new Error('googleLocationId is required to link a location.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    // 1. Verify internal location belongs to authenticated agency
    const internalLoc = await this.locationRepo.findById(agencyId, locationId);
    if (!internalLoc) {
      const error = new Error('Location not found.');
      error.code = 'LOCATION_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    // 2. Verify Google connection is active for agency
    const connection = await this.oauthRepo.getSanitizedConnection(agencyId);
    if (!connection || connection.connection_status !== 'connected') {
      const error = new Error('Cannot link location: Google account is not connected.');
      error.code = 'GOOGLE_NOT_CONNECTED';
      error.status = 400;
      throw error;
    }

    // 3. Upsert GBP linkage record
    const linked = await this.gbpRepo.upsertLink(agencyId, {
      clientId: internalLoc.client_id,
      locationId: internalLoc.id,
      googleAccountId: linkData.googleAccountId || connection.google_account_id,
      googleLocationId: linkData.googleLocationId,
      profileName: linkData.profileName || internalLoc.name,
      status: 'active',
      connectionStatus: 'connected',
      metadata: linkData.metadata || {},
    });

    return linked;
  }

  /**
   * Disconnects Google account for the agency and updates all associated GBP profiles
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string }} actor
   */
  async disconnect(agencyId, actor) {
    if (!agencyId) throw new Error('agency_id is required');
    this._assertPermission(actor, PERMISSIONS.GBP_MANAGE);

    // Revoke or clear stored tokens
    const disconnected = await this.oauthRepo.disconnect(agencyId);

    return {
      success: true,
      message: 'Google account disconnected successfully.',
      connection: disconnected,
    };
  }

  /**
   * Retrieves all linked GBP profiles for the agency
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string }} actor
   */
  async getLinkedProfiles(agencyId, actor) {
    if (!agencyId) throw new Error('agency_id is required');
    this._assertPermission(actor, PERMISSIONS.GBP_VIEW);
    return this.gbpRepo.listByAgency(agencyId);
  }

  /**
   * Unlinks an internal Location from its Google Business Profile
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string }} actor
   * @param {string} locationId
   */
  async unlinkLocation(agencyId, actor, locationId) {
    if (!agencyId) throw new Error('agency_id is required');
    if (!locationId) throw new Error('location_id is required');
    this._assertPermission(actor, PERMISSIONS.GBP_MANAGE);

    const deleted = await this.gbpRepo.deleteLink(agencyId, locationId);
    if (!deleted) {
      const error = new Error('No Google Business Profile linkage found for this location.');
      error.code = 'NOT_FOUND';
      error.status = 404;
      throw error;
    }
    return deleted;
  }
}

export const googleService = new GoogleService();
