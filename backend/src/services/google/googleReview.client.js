import { googleService } from './google.service.js';

/**
 * Sanitizes resource segments (strips leading prefixes like 'accounts/', 'locations/', 'reviews/')
 * @param {string} val
 * @param {string} [prefix]
 * @returns {string}
 */
function cleanResourceSegment(val, prefix) {
  if (!val) return '';
  const str = String(val).trim();
  if (prefix && str.startsWith(`${prefix}/`)) {
    return str.slice(prefix.length + 1);
  }
  return str;
}

/**
 * Normalizes Google API errors into standardized application domain errors
 * Ensures tokens and credentials are never leaked in error messages.
 *
 * @param {any} err
 * @param {string} [actionContext='Google Review API']
 * @returns {Error}
 */
export function normalizeGoogleReviewError(err, actionContext = 'Google Review API') {
  const status = err.status || err.code || (err.response && err.response.status) || 502;
  const rawMessage =
    err.response?.data?.error?.message ||
    err.response?.data?.message ||
    err.message ||
    'Unknown Google API error';

  // Strict masking: redact any potential OAuth tokens or authorization headers
  const sanitizedMessage = String(rawMessage)
    .replace(/ya29\.[a-zA-Z0-9_-]+/g, '[REDACTED_TOKEN]')
    .replace(/Bearer\s+[a-zA-Z0-9_\.-]+/gi, 'Bearer [REDACTED_TOKEN]');

  let errorCode = 'GOOGLE_API_ERROR';
  let friendlyMessage = `${actionContext} failed: ${sanitizedMessage}`;

  if (status === 400) {
    errorCode = 'GOOGLE_INVALID_ARGUMENT';
    friendlyMessage = `Invalid request sent to Google: ${sanitizedMessage}`;
  } else if (status === 401) {
    errorCode = 'GOOGLE_TOKEN_REFRESH_FAILED';
    friendlyMessage = 'Google authentication has expired or is invalid. Please reconnect Google account.';
  } else if (status === 403) {
    errorCode = 'GOOGLE_FORBIDDEN';
    friendlyMessage = `Google API access forbidden. Ensure your Google account has manage permissions for this location: ${sanitizedMessage}`;
  } else if (status === 404) {
    errorCode = 'GOOGLE_RESOURCE_NOT_FOUND';
    friendlyMessage = `Google Business Profile location or review was not found: ${sanitizedMessage}`;
  } else if (status === 429) {
    errorCode = 'GOOGLE_RATE_LIMITED';
    friendlyMessage = 'Google API rate limit exceeded. Please try again shortly.';
  } else if (status >= 500) {
    errorCode = 'GOOGLE_API_ERROR';
    friendlyMessage = `Google service temporarily unavailable (${status}). Please try again later.`;
  }

  const error = new Error(friendlyMessage);
  error.code = errorCode;
  error.status = typeof status === 'number' && status >= 400 && status < 600 ? status : 502;
  error.originalStatus = status;
  return error;
}

/**
 * Google Review API Client
 *
 * Interacts with the official Google Business Profile v4 Review endpoints:
 * - List location customer reviews
 * - Publish review replies
 * - Delete review replies
 *
 * Requirements:
 * - Completely database-independent.
 * - Reuses existing GoogleService OAuth connection & token infrastructure.
 * - Zero token leakage in errors or telemetry.
 * - Standardized error codes (400, 401, 403, 404, 429, 5xx).
 */
export class GoogleReviewClient {
  constructor(googleServiceInstance = googleService) {
    this.googleService = googleServiceInstance;
  }

  /**
   * Retrieves the authenticated OAuth2 client from GoogleService
   * @private
   */
  async _getOAuthClient(agencyId) {
    if (typeof this.googleService.getAuthenticatedOAuthClient === 'function') {
      return this.googleService.getAuthenticatedOAuthClient(agencyId);
    }
    if (typeof this.googleService._getAuthenticatedOAuthClient === 'function') {
      return this.googleService._getAuthenticatedOAuthClient(agencyId);
    }
    throw new Error('GoogleService does not provide an authenticated OAuth client retriever');
  }

  /**
   * Lists customer reviews for a Google Business Profile location
   * GET https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews
   *
   * @param {string} agencyId - Tenant agency ID
   * @param {string} googleAccountId - Google account identifier
   * @param {string} googleLocationId - Google location identifier
   * @param {string} [pageToken=null] - Google page token for pagination
   * @param {number} [pageSize=50] - Number of reviews to fetch per page (max 50)
   */
  async listLocationReviews(agencyId, googleAccountId, googleLocationId, pageToken = null, pageSize = 50) {
    if (!agencyId) throw new Error('agency_id is required');
    if (!googleAccountId) throw new Error('googleAccountId is required');
    if (!googleLocationId) throw new Error('googleLocationId is required');

    const cleanAccount = cleanResourceSegment(googleAccountId, 'accounts');
    const cleanLocation = cleanResourceSegment(googleLocationId, 'locations');

    const url = `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(cleanAccount)}/locations/${encodeURIComponent(cleanLocation)}/reviews`;

    const params = {
      pageSize: Math.max(1, Math.min(50, parseInt(pageSize, 10) || 50)),
    };
    if (pageToken && typeof pageToken === 'string' && pageToken.trim()) {
      params.pageToken = pageToken.trim();
    }

    try {
      const { oauth2Client } = await this._getOAuthClient(agencyId);
      const res = await oauth2Client.request({
        url,
        method: 'GET',
        params,
      });

      const data = res.data || {};
      return {
        reviews: data.reviews || [],
        nextPageToken: data.nextPageToken || null,
        totalReviewCount: data.totalReviewCount !== undefined ? data.totalReviewCount : null,
        averageRating: data.averageRating !== undefined ? data.averageRating : null,
      };
    } catch (err) {
      throw normalizeGoogleReviewError(err, 'Fetching Google reviews');
    }
  }

  /**
   * Publishes or updates an official business reply to a Google customer review
   * PUT https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews/{reviewId}/reply
   *
   * @param {string} agencyId - Tenant agency ID
   * @param {string} googleAccountId - Google account identifier
   * @param {string} googleLocationId - Google location identifier
   * @param {string} googleReviewId - Google review identifier
   * @param {string} comment - Final published text of the reply
   */
  async publishReply(agencyId, googleAccountId, googleLocationId, googleReviewId, comment) {
    if (!agencyId) throw new Error('agency_id is required');
    if (!googleAccountId) throw new Error('googleAccountId is required');
    if (!googleLocationId) throw new Error('googleLocationId is required');
    if (!googleReviewId) throw new Error('googleReviewId is required');

    if (!comment || typeof comment !== 'string' || !comment.trim()) {
      const error = new Error('Reply comment text is required');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    const cleanAccount = cleanResourceSegment(googleAccountId, 'accounts');
    const cleanLocation = cleanResourceSegment(googleLocationId, 'locations');
    const cleanReview = cleanResourceSegment(googleReviewId, 'reviews');

    const url = `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(cleanAccount)}/locations/${encodeURIComponent(cleanLocation)}/reviews/${encodeURIComponent(cleanReview)}/reply`;

    try {
      const { oauth2Client } = await this._getOAuthClient(agencyId);
      const res = await oauth2Client.request({
        url,
        method: 'PUT',
        data: {
          comment: comment.trim(),
        },
      });

      return res.data || { comment: comment.trim(), updateTime: new Date().toISOString() };
    } catch (err) {
      throw normalizeGoogleReviewError(err, 'Publishing Google review reply');
    }
  }

  /**
   * Deletes an official business reply from a Google customer review
   * DELETE https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews/{reviewId}/reply
   *
   * @param {string} agencyId - Tenant agency ID
   * @param {string} googleAccountId - Google account identifier
   * @param {string} googleLocationId - Google location identifier
   * @param {string} googleReviewId - Google review identifier
   */
  async deleteReply(agencyId, googleAccountId, googleLocationId, googleReviewId) {
    if (!agencyId) throw new Error('agency_id is required');
    if (!googleAccountId) throw new Error('googleAccountId is required');
    if (!googleLocationId) throw new Error('googleLocationId is required');
    if (!googleReviewId) throw new Error('googleReviewId is required');

    const cleanAccount = cleanResourceSegment(googleAccountId, 'accounts');
    const cleanLocation = cleanResourceSegment(googleLocationId, 'locations');
    const cleanReview = cleanResourceSegment(googleReviewId, 'reviews');

    const url = `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(cleanAccount)}/locations/${encodeURIComponent(cleanLocation)}/reviews/${encodeURIComponent(cleanReview)}/reply`;

    try {
      const { oauth2Client } = await this._getOAuthClient(agencyId);
      await oauth2Client.request({
        url,
        method: 'DELETE',
      });

      return { success: true, deleted: true };
    } catch (err) {
      throw normalizeGoogleReviewError(err, 'Deleting Google review reply');
    }
  }
}

export const googleReviewClient = new GoogleReviewClient();
