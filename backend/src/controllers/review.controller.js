import { reviewService } from '../services/review/review.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id) {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

const ALLOWED_STATUSES = new Set(['unread', 'read', 'archived', 'flagged']);

const ALLOWED_SORT_COLUMNS = new Set([
  'review_create_time',
  'create_time',
  'rating',
  'star_rating',
  'created_at',
  'updated_at',
]);

/**
 * Lists reviews with filtering, sorting, and pagination
 * GET /api/v1/reviews
 */
export async function listReviews(req, res, next) {
  try {
    const {
      clientId,
      locationId,
      starRating,
      replyStatus,
      status,
      dateFrom,
      dateTo,
      search,
      sortBy,
      sortOrder,
      limit,
      offset,
      page,
    } = req.query;

    // Validate ID formats if provided
    if (clientId && !isValidUuid(clientId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID_FORMAT',
          message: 'clientId query parameter must be a valid UUID.',
        },
      });
    }
    if (locationId && !isValidUuid(locationId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ID_FORMAT',
          message: 'locationId query parameter must be a valid UUID.',
        },
      });
    }

    // Validate starRating if provided
    let parsedStarRating = undefined;
    if (starRating !== undefined && starRating !== '') {
      parsedStarRating = Number(starRating);
      if (
        isNaN(parsedStarRating) ||
        parsedStarRating < 1 ||
        parsedStarRating > 5 ||
        !Number.isInteger(parsedStarRating)
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_RATING',
            message: 'starRating must be an integer between 1 and 5.',
          },
        });
      }
    }

    // Validate limit if provided
    let parsedLimit = undefined;
    if (limit !== undefined && limit !== '') {
      parsedLimit = Number(limit);
      if (
        isNaN(parsedLimit) ||
        parsedLimit < 1 ||
        parsedLimit > 100 ||
        !Number.isInteger(parsedLimit)
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PAGINATION',
            message: 'limit must be an integer between 1 and 100.',
          },
        });
      }
    }

    // Validate offset if provided
    let parsedOffset = undefined;
    if (offset !== undefined && offset !== '') {
      parsedOffset = Number(offset);
      if (isNaN(parsedOffset) || parsedOffset < 0 || !Number.isInteger(parsedOffset)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PAGINATION',
            message: 'offset must be a non-negative integer.',
          },
        });
      }
    }

    // Validate page if provided
    let parsedPage = undefined;
    if (page !== undefined && page !== '') {
      parsedPage = Number(page);
      if (isNaN(parsedPage) || parsedPage < 1 || !Number.isInteger(parsedPage)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PAGINATION',
            message: 'page must be an integer greater than or equal to 1.',
          },
        });
      }
    }

    // Validate sortBy
    if (sortBy && !ALLOWED_SORT_COLUMNS.has(String(sortBy).toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SORT_FIELD',
          message: `Invalid sortBy field "${sortBy}". Allowed fields: review_create_time, create_time, rating, star_rating, created_at, updated_at.`,
        },
      });
    }

    // Validate sortOrder
    if (sortOrder && !['asc', 'desc'].includes(String(sortOrder).toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SORT_ORDER',
          message: 'sortOrder must be either "asc" or "desc".',
        },
      });
    }

    // Validate search string length
    if (search && typeof search === 'string' && search.length > 200) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SEARCH',
          message: 'search parameter must not exceed 200 characters.',
        },
      });
    }

    const filters = {
      clientId,
      locationId,
      starRating: parsedStarRating,
      replyStatus,
      status,
      dateFrom,
      dateTo,
      search,
    };

    const pagination = {
      limit: parsedLimit,
      offset: parsedOffset,
      page: parsedPage,
      sortBy,
      sortOrder,
    };

    const agencyId = req.user.agency_id || req.tenant?.agencyId;
    const result = await reviewService.listReviews(agencyId, req.user, filters, pagination);

    res.status(200).json({
      success: true,
      data: result.reviews,
      reviews: result.reviews,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        page: result.page,
        totalPages: result.totalPages,
      },
      total: result.total,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Calculates review summary statistics for tenant
 * GET /api/v1/reviews/stats
 */
export async function getReviewStats(req, res, next) {
  try {
    const { clientId, locationId, starRating, replyStatus, status, dateFrom, dateTo, search } =
      req.query;

    if (clientId && !isValidUuid(clientId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID_FORMAT', message: 'clientId must be a valid UUID.' },
      });
    }
    if (locationId && !isValidUuid(locationId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID_FORMAT', message: 'locationId must be a valid UUID.' },
      });
    }

    const filters = {
      clientId,
      locationId,
      starRating,
      replyStatus,
      status,
      dateFrom,
      dateTo,
      search,
    };

    const agencyId = req.user.agency_id || req.tenant?.agencyId;
    const stats = await reviewService.getReviewStats(agencyId, req.user, filters);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieves a single review by ID
 * GET /api/v1/reviews/:reviewId
 */
export async function getReviewById(req, res, next) {
  try {
    const { reviewId } = req.params;

    if (!isValidUuid(reviewId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID_FORMAT', message: 'reviewId must be a valid UUID.' },
      });
    }

    const agencyId = req.user.agency_id || req.tenant?.agencyId;
    const review = await reviewService.getReviewById(agencyId, req.user, reviewId);

    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates review processing status ('unread', 'read', 'archived', 'flagged')
 * PATCH /api/v1/reviews/:reviewId/status
 */
export async function updateReviewStatus(req, res, next) {
  try {
    const { reviewId } = req.params;
    const { status } = req.body || {};

    if (!isValidUuid(reviewId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID_FORMAT', message: 'reviewId must be a valid UUID.' },
      });
    }

    if (!status || !ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Invalid review status. Must be one of: ${Array.from(ALLOWED_STATUSES).join(', ')}.`,
        },
      });
    }

    const agencyId = req.user.agency_id || req.tenant?.agencyId;
    const updated = await reviewService.updateReviewStatus(agencyId, req.user, reviewId, status);

    res.status(200).json({
      success: true,
      data: updated,
      message: `Review status updated to "${status}".`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Synchronizes customer reviews from Google Business Profile
 * POST /api/v1/locations/:locationId/reviews/sync
 */
export async function syncLocationReviews(req, res, next) {
  try {
    const { locationId } = req.params;

    if (!isValidUuid(locationId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID_FORMAT', message: 'locationId must be a valid UUID.' },
      });
    }

    const options = {
      pageToken: req.body?.pageToken || req.query?.pageToken,
      pageSize: req.body?.pageSize || req.query?.pageSize,
      maxPages: req.body?.maxPages || req.query?.maxPages,
    };

    const agencyId = req.user.agency_id || req.tenant?.agencyId;
    const result = await reviewService.syncLocationReviews(agencyId, req.user, locationId, options);

    res.status(200).json({
      success: true,
      data: result,
      message: `Successfully synchronized ${result.synced} reviews across ${result.pages} page(s).`,
    });
  } catch (error) {
    next(error);
  }
}
