import { ReviewRepository } from '../../repositories/review.repository.js';
import { locationRepository } from '../../repositories/location.repository.js';
import { googleBusinessProfileRepository } from '../../repositories/googleBusinessProfile.repository.js';
import { googleReviewClient } from '../google/googleReview.client.js';
import { PERMISSIONS, hasPermission } from '../../config/permissions.js';

const ALLOWED_STATUSES = new Set(['unread', 'read', 'archived', 'flagged']);

const GOOGLE_RATING_MAP = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

const REVERSE_RATING_MAP = {
  1: 'ONE',
  2: 'TWO',
  3: 'THREE',
  4: 'FOUR',
  5: 'FIVE',
};

/**
 * ReviewService
 * Orchestrates customer review retrieval, filtering, status management,
 * and external Google Business Profile synchronization.
 *
 * Guarantees:
 * - Scoped strictly to verified agency tenant.
 * - Zero OAuth token leakage.
 * - Non-leaking plain pagination responses.
 * - Decoupled network and database operations.
 */
export class ReviewService {
  constructor(
    reviewRepo = new ReviewRepository(),
    locationRepo = locationRepository,
    gbpRepo = googleBusinessProfileRepository,
    reviewClient = googleReviewClient
  ) {
    this.reviewRepository = reviewRepo;
    this.locationRepository = locationRepo;
    this.googleBusinessProfileRepository = gbpRepo;
    this.googleReviewClient = reviewClient;
  }

  /**
   * Resolves verified agencyId and actor context
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

    // Security invariant: Actor tenant must strictly match target tenant
    const actorAgencyId = resolvedActor.agency_id || resolvedActor.agencyId;
    if (actorAgencyId && actorAgencyId !== resolvedAgencyId) {
      const error = new Error('Cross-agency access forbidden: Actor agency does not match target tenant.');
      error.code = 'FORBIDDEN';
      error.status = 403;
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
   * Maps Google Review API raw payload into internal review record schema.
   * Enforces strict rating enum parsing (ONE..FIVE).
   * @private
   */
  _mapGoogleReview(agencyId, clientId, locationId, gr) {
    const googleReviewId = gr.reviewId || (gr.name ? gr.name.split('/').pop() : null);
    if (!googleReviewId) {
      const error = new Error('Google review is missing a review identifier.');
      error.code = 'GOOGLE_RESOURCE_NOT_FOUND';
      error.status = 400;
      throw error;
    }

    let starRating;
    let originalRatingEnum;

    if (typeof gr.starRating === 'string') {
      const upper = gr.starRating.toUpperCase().trim();
      if (!GOOGLE_RATING_MAP[upper]) {
        const err = new Error(`Invalid star rating enum received from Google: "${gr.starRating}"`);
        err.code = 'INVALID_RATING';
        err.status = 400;
        throw err;
      }
      starRating = GOOGLE_RATING_MAP[upper];
      originalRatingEnum = upper;
    } else if (typeof gr.starRating === 'number' && gr.starRating >= 1 && gr.starRating <= 5) {
      starRating = gr.starRating;
      originalRatingEnum = REVERSE_RATING_MAP[starRating];
    } else {
      const err = new Error(`Invalid star rating received from Google: "${gr.starRating}"`);
      err.code = 'INVALID_RATING';
      err.status = 400;
      throw err;
    }

    const reviewerName = gr.reviewer?.displayName || (gr.reviewer?.isAnonymous ? 'Anonymous' : 'Google User');
    const reviewerPhotoUrl = gr.reviewer?.profilePhotoUrl || null;
    const isAnonymous = Boolean(gr.reviewer?.isAnonymous);
    const comment = gr.comment !== undefined && gr.comment !== null ? String(gr.comment) : null;

    const reviewCreateTime = gr.createTime ? new Date(gr.createTime) : new Date();
    const reviewUpdateTime = gr.updateTime ? new Date(gr.updateTime) : null;

    const externalReplyComment = gr.reviewReply?.comment || null;
    const externalReplyUpdateTime = gr.reviewReply?.updateTime ? new Date(gr.reviewReply.updateTime) : null;

    return {
      agency_id: agencyId,
      client_id: clientId,
      location_id: locationId,
      google_review_id: googleReviewId,
      reviewer_name: reviewerName,
      reviewer_photo_url: reviewerPhotoUrl,
      is_anonymous: isAnonymous,
      star_rating: starRating,
      original_rating_enum: originalRatingEnum,
      comment,
      review_create_time: reviewCreateTime,
      review_update_time: reviewUpdateTime,
      external_reply_comment: externalReplyComment,
      external_reply_update_time: externalReplyUpdateTime,
    };
  }

  /**
   * Lists customer reviews for an agency with tenant isolation, filtering, and pagination.
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string, agency_id: string }} actor
   * @param {object} [filters={}]
   * @param {object} [pagination={}]
   */
  async listReviews(agencyId, actor, filters = {}, pagination = {}) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.REVIEW_VIEW);

    return this.reviewRepository.listReviews(ctx.agencyId, filters, pagination);
  }

  /**
   * Calculates review statistics (counts, averages, star distribution) for an agency.
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string, agency_id: string }} actor
   * @param {object} [filters={}]
   */
  async getReviewStats(agencyId, actor, filters = {}) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.REVIEW_VIEW);

    return this.reviewRepository.getReviewStats(ctx.agencyId, filters);
  }

  /**
   * Retrieves single review details by ID scoped to agency tenant.
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string, agency_id: string }} actor
   * @param {string} reviewId
   */
  async getReviewById(agencyId, actor, reviewId) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.REVIEW_VIEW);

    if (!reviewId) {
      const error = new Error('reviewId is required.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    const review = await this.reviewRepository.findById(ctx.agencyId, reviewId);
    if (!review) {
      const error = new Error('Review not found.');
      error.code = 'REVIEW_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    return review;
  }

  /**
   * Updates review processing/workflow status ('unread', 'read', 'archived', 'flagged').
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string, agency_id: string }} actor
   * @param {string} reviewId
   * @param {string} status
   */
  async updateReviewStatus(agencyId, actor, reviewId, status) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.REVIEW_UPDATE_STATUS);

    if (!reviewId) {
      const error = new Error('reviewId is required.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    if (!status || !ALLOWED_STATUSES.has(status)) {
      const error = new Error(
        `Invalid review status: "${status}". Must be one of: ${Array.from(ALLOWED_STATUSES).join(', ')}`
      );
      error.code = 'INVALID_STATUS';
      error.status = 400;
      throw error;
    }

    const existing = await this.reviewRepository.findById(ctx.agencyId, reviewId);
    if (!existing) {
      const error = new Error('Review not found.');
      error.code = 'REVIEW_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    return this.reviewRepository.updateStatus(ctx.agencyId, reviewId, status);
  }

  /**
   * Synchronizes customer reviews from Google Business Profile into local storage.
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string, agency_id: string }} actor
   * @param {string} locationId
   * @param {{
   *   pageToken?: string,
   *   pageSize?: number,
   *   maxPages?: number
   * }} [options={}]
   */
  async syncLocationReviews(agencyId, actor, locationId, options = {}) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.REVIEW_SYNC);

    if (!locationId) {
      const error = new Error('locationId is required for syncing reviews.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    // 1. Verify location belongs to agency
    const location = await this.locationRepository.findById(ctx.agencyId, locationId);
    if (!location) {
      const error = new Error('Location not found or does not belong to agency.');
      error.code = 'LOCATION_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    // 2. Verify Google Business Profile linkage
    const gbpProfile = await this.googleBusinessProfileRepository.findByLocationId(
      ctx.agencyId,
      locationId
    );
    if (!gbpProfile || !gbpProfile.google_account_id || !gbpProfile.google_location_id) {
      const error = new Error('Location is not linked to an active Google Business Profile.');
      error.code = 'LOCATION_NOT_LINKED';
      error.status = 400;
      throw error;
    }

    if (gbpProfile.connection_status === 'disconnected') {
      const error = new Error('Google Business Profile is disconnected. Reconnection required.');
      error.code = 'GOOGLE_NOT_CONNECTED';
      error.status = 400;
      throw error;
    }

    const googleAccountId = gbpProfile.google_account_id;
    const googleLocationId = gbpProfile.google_location_id;

    // 3. Paginated review ingestion loop
    const maxPages = options.maxPages !== undefined ? Math.max(1, parseInt(options.maxPages, 10)) : 10;
    const pageSize = options.pageSize ? Math.max(1, Math.min(50, parseInt(options.pageSize, 10))) : 50;
    let pageToken = options.pageToken || null;
    let synced = 0;
    let pages = 0;
    let nextPageToken = null;

    while (pages < maxPages) {
      pages++;
      const response = await this.googleReviewClient.listLocationReviews(
        ctx.agencyId,
        googleAccountId,
        googleLocationId,
        pageToken,
        pageSize
      );

      const googleReviews = response.reviews || [];
      for (const rawReview of googleReviews) {
        const mapped = this._mapGoogleReview(ctx.agencyId, location.client_id, locationId, rawReview);
        await this.reviewRepository.upsertSyncedReview(ctx.agencyId, mapped);
        synced++;
      }

      nextPageToken = response.nextPageToken || null;
      if (!nextPageToken) {
        break;
      }
      pageToken = nextPageToken;
    }

    return {
      locationId,
      synced,
      pages,
      nextPageToken,
    };
  }
}

export const reviewService = new ReviewService();
