import { pool } from '../config/database.js';

const ALLOWED_STATUSES = new Set(['unread', 'read', 'archived', 'flagged']);
const ALLOWED_REPLY_STATUSES = new Set([
  'unreplied',
  'ai_suggested',
  'draft',
  'pending_approval',
  'approved',
  'published',
]);

const RATING_NUM_TO_ENUM = {
  1: 'ONE',
  2: 'TWO',
  3: 'THREE',
  4: 'FOUR',
  5: 'FIVE',
};

const RATING_ENUM_TO_NUM = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

const ALLOWED_SORT_COLUMNS = {
  review_create_time: 'r.review_create_time',
  create_time: 'r.review_create_time',
  rating: 'r.star_rating',
  star_rating: 'r.star_rating',
  created_at: 'r.created_at',
  updated_at: 'r.updated_at',
};

export class ReviewRepository {
  constructor(db = pool) {
    this.db = db;
  }

  /**
   * Upserts a review synchronized from Google Business Profile.
   * Scoped strictly to the agency tenant and location compound foreign key.
   *
   * @param {string} agencyId
   * @param {{
   *   clientId?: string,
   *   client_id?: string,
   *   locationId?: string,
   *   location_id?: string,
   *   googleReviewId?: string,
   *   google_review_id?: string,
   *   reviewerName?: string,
   *   reviewer_name?: string,
   *   reviewerPhotoUrl?: string,
   *   reviewer_photo_url?: string,
   *   isAnonymous?: boolean,
   *   is_anonymous?: boolean,
   *   starRating?: number,
   *   star_rating?: number,
   *   originalRatingEnum?: string,
   *   original_rating_enum?: string,
   *   comment?: string,
   *   reviewCreateTime?: Date | string,
   *   review_create_time?: Date | string,
   *   reviewUpdateTime?: Date | string,
   *   review_update_time?: Date | string,
   *   status?: string,
   *   replyStatus?: string,
   *   reply_status?: string,
   *   externalReplyComment?: string,
   *   external_reply_comment?: string,
   *   externalReplyUpdateTime?: Date | string,
   *   external_reply_update_time?: Date | string
   * }} reviewData
   * @param {import('pg').PoolClient} [executor]
   */
  async upsertSyncedReview(agencyId, reviewData, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');

    const clientId = reviewData.client_id || reviewData.clientId;
    const locationId = reviewData.location_id || reviewData.locationId;
    const googleReviewId = reviewData.google_review_id || reviewData.googleReviewId;

    if (!clientId) throw new Error('client_id is required');
    if (!locationId) throw new Error('location_id is required');
    if (!googleReviewId) throw new Error('google_review_id is required');

    let starRating = reviewData.star_rating ?? reviewData.starRating;
    let originalRatingEnum = reviewData.original_rating_enum || reviewData.originalRatingEnum;

    if (starRating !== undefined && starRating !== null && !originalRatingEnum) {
      originalRatingEnum = RATING_NUM_TO_ENUM[Number(starRating)];
    } else if (originalRatingEnum && (starRating === undefined || starRating === null)) {
      starRating = RATING_ENUM_TO_NUM[String(originalRatingEnum).toUpperCase()];
    }

    starRating = parseInt(starRating, 10);
    if (isNaN(starRating) || starRating < 1 || starRating > 5) {
      throw new Error('star_rating must be an integer between 1 and 5');
    }
    if (!originalRatingEnum || !RATING_ENUM_TO_NUM[originalRatingEnum]) {
      throw new Error(`Invalid original_rating_enum: ${originalRatingEnum}`);
    }

    const reviewerName = reviewData.reviewer_name || reviewData.reviewerName || null;
    const reviewerPhotoUrl = reviewData.reviewer_photo_url || reviewData.reviewerPhotoUrl || null;
    const isAnonymous = Boolean(reviewData.is_anonymous ?? reviewData.isAnonymous ?? false);
    const comment = reviewData.comment !== undefined ? reviewData.comment : null;

    const reviewCreateTime = reviewData.review_create_time || reviewData.reviewCreateTime
      ? new Date(reviewData.review_create_time || reviewData.reviewCreateTime)
      : new Date();

    const reviewUpdateTime = reviewData.review_update_time || reviewData.reviewUpdateTime
      ? new Date(reviewData.review_update_time || reviewData.reviewUpdateTime)
      : null;

    const status = reviewData.status && ALLOWED_STATUSES.has(reviewData.status)
      ? reviewData.status
      : 'unread';

    const externalReplyComment = reviewData.external_reply_comment || reviewData.externalReplyComment || null;
    const externalReplyUpdateTime = reviewData.external_reply_update_time || reviewData.externalReplyUpdateTime
      ? new Date(reviewData.external_reply_update_time || reviewData.externalReplyUpdateTime)
      : null;

    let replyStatus = reviewData.reply_status || reviewData.replyStatus;
    if (!replyStatus || !ALLOWED_REPLY_STATUSES.has(replyStatus)) {
      replyStatus = externalReplyComment ? 'published' : 'unreplied';
    }

    const query = `
      INSERT INTO reviews (
        agency_id,
        client_id,
        location_id,
        google_review_id,
        reviewer_name,
        reviewer_photo_url,
        is_anonymous,
        star_rating,
        original_rating_enum,
        comment,
        review_create_time,
        review_update_time,
        status,
        reply_status,
        external_reply_comment,
        external_reply_update_time,
        last_synced_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW(), NOW())
      ON CONFLICT (location_id, google_review_id) DO UPDATE SET
        reviewer_name = EXCLUDED.reviewer_name,
        reviewer_photo_url = EXCLUDED.reviewer_photo_url,
        is_anonymous = EXCLUDED.is_anonymous,
        star_rating = EXCLUDED.star_rating,
        original_rating_enum = EXCLUDED.original_rating_enum,
        comment = EXCLUDED.comment,
        review_create_time = EXCLUDED.review_create_time,
        review_update_time = EXCLUDED.review_update_time,
        external_reply_comment = COALESCE(EXCLUDED.external_reply_comment, reviews.external_reply_comment),
        external_reply_update_time = COALESCE(EXCLUDED.external_reply_update_time, reviews.external_reply_update_time),
        reply_status = CASE
          WHEN EXCLUDED.external_reply_comment IS NOT NULL
               AND reviews.reply_status IN ('unreplied', 'ai_suggested', 'draft')
            THEN 'published'
          ELSE reviews.reply_status
        END,
        last_synced_at = NOW(),
        updated_at = NOW()
      WHERE reviews.agency_id = $1
      RETURNING *;
    `;

    const values = [
      agencyId,
      clientId,
      locationId,
      googleReviewId,
      reviewerName,
      reviewerPhotoUrl,
      isAnonymous,
      starRating,
      originalRatingEnum,
      comment,
      reviewCreateTime,
      reviewUpdateTime,
      status,
      replyStatus,
      externalReplyComment,
      externalReplyUpdateTime,
    ];

    const { rows } = await executor.query(query, values);
    return rows[0];
  }

  /**
   * Builds SQL WHERE conditions and parameters for filtering reviews
   * @private
   */
  _buildWhereClause(agencyId, filters = {}) {
    const conditions = ['r.agency_id = $1'];
    const values = [agencyId];
    let paramIndex = 2;

    const clientId = filters.client_id || filters.clientId || filters.client;
    if (clientId) {
      conditions.push(`r.client_id = $${paramIndex++}`);
      values.push(clientId);
    }

    const locationId = filters.location_id || filters.locationId || filters.location;
    if (locationId) {
      conditions.push(`r.location_id = $${paramIndex++}`);
      values.push(locationId);
    }

    const starRating = filters.star_rating ?? filters.starRating ?? filters.rating;
    if (starRating !== undefined && starRating !== null && starRating !== '') {
      if (Array.isArray(starRating)) {
        const ratings = starRating.map((r) => parseInt(r, 10)).filter((r) => !isNaN(r));
        if (ratings.length > 0) {
          conditions.push(`r.star_rating = ANY($${paramIndex++})`);
          values.push(ratings);
        }
      } else {
        const rating = parseInt(starRating, 10);
        if (!isNaN(rating)) {
          conditions.push(`r.star_rating = $${paramIndex++}`);
          values.push(rating);
        }
      }
    }

    const replyStatus = filters.reply_status || filters.replyStatus;
    if (replyStatus) {
      if (Array.isArray(replyStatus)) {
        conditions.push(`r.reply_status = ANY($${paramIndex++})`);
        values.push(replyStatus);
      } else {
        conditions.push(`r.reply_status = $${paramIndex++}`);
        values.push(replyStatus);
      }
    }

    const status = filters.status || filters.reviewStatus;
    if (status) {
      if (Array.isArray(status)) {
        conditions.push(`r.status = ANY($${paramIndex++})`);
        values.push(status);
      } else {
        conditions.push(`r.status = $${paramIndex++}`);
        values.push(status);
      }
    }

    const startDate = filters.start_date || filters.startDate || filters.dateFrom || filters.fromDate;
    if (startDate) {
      conditions.push(`r.review_create_time >= $${paramIndex++}`);
      values.push(new Date(startDate));
    }

    const endDate = filters.end_date || filters.endDate || filters.dateTo || filters.toDate;
    if (endDate) {
      conditions.push(`r.review_create_time <= $${paramIndex++}`);
      values.push(new Date(endDate));
    }

    const search = filters.search || filters.q || filters.text;
    if (search && typeof search === 'string' && search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      conditions.push(`(r.reviewer_name ILIKE $${paramIndex} OR r.comment ILIKE $${paramIndex})`);
      values.push(searchPattern);
      paramIndex++;
    }

    return {
      whereSql: conditions.join(' AND '),
      values,
      nextParamIndex: paramIndex,
    };
  }

  /**
   * Lists reviews for an agency with support for filtering, pagination, and relation joins
   *
   * @param {string} agencyId
   * @param {object} [filters]
   * @param {object} [pagination]
   * @param {import('pg').PoolClient} [executor]
   */
  async listReviews(agencyId, filters = {}, pagination = {}, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');

    const { whereSql, values, nextParamIndex } = this._buildWhereClause(agencyId, filters);

    // 1. Get total count matching filters
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM reviews r
      WHERE ${whereSql};
    `;
    const countResult = await executor.query(countQuery, values);
    const total = countResult.rows[0] ? parseInt(countResult.rows[0].total, 10) : 0;

    // 2. Parse pagination
    const limit = Math.max(1, Math.min(100, parseInt(pagination.limit, 10) || 20));
    let offset = 0;
    if (pagination.page !== undefined && pagination.page !== null) {
      const page = Math.max(1, parseInt(pagination.page, 10) || 1);
      offset = (page - 1) * limit;
    } else if (pagination.offset !== undefined && pagination.offset !== null) {
      offset = Math.max(0, parseInt(pagination.offset, 10) || 0);
    }

    // 3. Parse safe sorting
    const sortBy = ALLOWED_SORT_COLUMNS[pagination.sortBy] || 'r.review_create_time';
    const sortOrder = String(pagination.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // 4. Query reviews with client, location, and reply info
    const queryValues = [...values, limit, offset];
    const dataQuery = `
      SELECT
        r.id,
        r.agency_id,
        r.client_id,
        r.location_id,
        r.google_review_id,
        r.reviewer_name,
        r.reviewer_photo_url,
        r.is_anonymous,
        r.star_rating,
        r.original_rating_enum,
        r.comment,
        r.review_create_time,
        r.review_update_time,
        r.status,
        r.reply_status,
        r.external_reply_comment,
        r.external_reply_update_time,
        r.last_synced_at,
        r.created_at,
        r.updated_at,
        c.name AS client_name,
        c.business_name AS client_business_name,
        l.name AS location_name,
        l.city AS location_city,
        l.state AS location_state,
        rr.id AS reply_id,
        rr.suggested_reply,
        rr.ai_model,
        rr.ai_tone,
        rr.draft_reply,
        rr.final_published_reply,
        rr.status AS reply_workflow_status,
        rr.approved_by_user_id,
        rr.approved_at,
        rr.published_by_user_id,
        rr.published_at,
        rr.publish_error
      FROM reviews r
      LEFT JOIN clients c ON r.client_id = c.id AND c.agency_id = r.agency_id
      LEFT JOIN locations l ON r.location_id = l.id AND l.agency_id = r.agency_id
      LEFT JOIN review_replies rr ON rr.review_id = r.id AND rr.agency_id = r.agency_id
      WHERE ${whereSql}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1};
    `;

    const { rows } = await executor.query(dataQuery, queryValues);

    const formattedReviews = rows.map((row) => {
      const review = { ...row };
      if (row.reply_id) {
        review.reply = {
          id: row.reply_id,
          agency_id: row.agency_id,
          review_id: row.id,
          location_id: row.location_id,
          suggested_reply: row.suggested_reply,
          ai_model: row.ai_model,
          ai_tone: row.ai_tone,
          draft_reply: row.draft_reply,
          final_published_reply: row.final_published_reply,
          status: row.reply_workflow_status,
          approved_by_user_id: row.approved_by_user_id,
          approved_at: row.approved_at,
          published_by_user_id: row.published_by_user_id,
          published_at: row.published_at,
          publish_error: row.publish_error,
        };
      } else {
        review.reply = null;
      }
      return review;
    });

    return {
      reviews: formattedReviews,
      total,
      limit,
      offset,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Calculates review statistics: totals, average rating, star distribution, and unreplied count
   *
   * @param {string} agencyId
   * @param {object} [filters]
   * @param {import('pg').PoolClient} [executor]
   */
  async getReviewStats(agencyId, filters = {}, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');

    const { whereSql, values } = this._buildWhereClause(agencyId, filters);

    const query = `
      SELECT
        COUNT(*)::int AS total_reviews,
        COALESCE(ROUND(AVG(r.star_rating)::numeric, 2), 0.00)::float AS average_rating,
        COUNT(CASE WHEN r.reply_status = 'unreplied' THEN 1 END)::int AS unreplied_count,
        COUNT(CASE WHEN r.reply_status = 'published' THEN 1 END)::int AS published_count,
        COUNT(CASE WHEN r.reply_status IN ('ai_suggested', 'draft', 'pending_approval') THEN 1 END)::int AS pending_reply_count,
        COUNT(CASE WHEN r.star_rating = 1 THEN 1 END)::int AS count_1_star,
        COUNT(CASE WHEN r.star_rating = 2 THEN 1 END)::int AS count_2_star,
        COUNT(CASE WHEN r.star_rating = 3 THEN 1 END)::int AS count_3_star,
        COUNT(CASE WHEN r.star_rating = 4 THEN 1 END)::int AS count_4_star,
        COUNT(CASE WHEN r.star_rating = 5 THEN 1 END)::int AS count_5_star
      FROM reviews r
      WHERE ${whereSql};
    `;

    const { rows } = await executor.query(query, values);
    const stats = rows[0] || {};

    return {
      total_reviews: stats.total_reviews || 0,
      average_rating: Number(stats.average_rating) || 0,
      unreplied_count: stats.unreplied_count || 0,
      published_count: stats.published_count || 0,
      pending_reply_count: stats.pending_reply_count || 0,
      rating_breakdown: {
        1: stats.count_1_star || 0,
        2: stats.count_2_star || 0,
        3: stats.count_3_star || 0,
        4: stats.count_4_star || 0,
        5: stats.count_5_star || 0,
      },
      count_1_star: stats.count_1_star || 0,
      count_2_star: stats.count_2_star || 0,
      count_3_star: stats.count_3_star || 0,
      count_4_star: stats.count_4_star || 0,
      count_5_star: stats.count_5_star || 0,
    };
  }

  /**
   * Finds a review by ID scoped strictly to an agency tenant.
   * Includes Client, Location, and ReviewReply metadata.
   *
   * @param {string} agencyId
   * @param {string} reviewId
   * @param {import('pg').PoolClient} [executor]
   */
  async findById(agencyId, reviewId, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');
    if (!reviewId) throw new Error('reviewId is required');

    const query = `
      SELECT
        r.id,
        r.agency_id,
        r.client_id,
        r.location_id,
        r.google_review_id,
        r.reviewer_name,
        r.reviewer_photo_url,
        r.is_anonymous,
        r.star_rating,
        r.original_rating_enum,
        r.comment,
        r.review_create_time,
        r.review_update_time,
        r.status,
        r.reply_status,
        r.external_reply_comment,
        r.external_reply_update_time,
        r.last_synced_at,
        r.created_at,
        r.updated_at,
        c.name AS client_name,
        c.business_name AS client_business_name,
        c.email AS client_email,
        c.phone AS client_phone,
        l.name AS location_name,
        l.address_line1 AS location_address,
        l.city AS location_city,
        l.state AS location_state,
        l.postal_code AS location_postal_code,
        rr.id AS reply_id,
        rr.suggested_reply,
        rr.ai_model,
        rr.ai_tone,
        rr.draft_reply,
        rr.final_published_reply,
        rr.status AS reply_workflow_status,
        rr.created_by_user_id,
        rr.approved_by_user_id,
        rr.approved_at,
        rr.published_by_user_id,
        rr.published_at,
        rr.publish_error,
        rr.created_at AS reply_created_at,
        rr.updated_at AS reply_updated_at
      FROM reviews r
      LEFT JOIN clients c ON r.client_id = c.id AND c.agency_id = r.agency_id
      LEFT JOIN locations l ON r.location_id = l.id AND l.agency_id = r.agency_id
      LEFT JOIN review_replies rr ON rr.review_id = r.id AND rr.agency_id = r.agency_id
      WHERE r.id = $1 AND r.agency_id = $2;
    `;

    const { rows } = await executor.query(query, [reviewId, agencyId]);
    if (!rows[0]) return null;

    const row = rows[0];
    if (row.reply_id) {
      row.reply = {
        id: row.reply_id,
        agency_id: row.agency_id,
        review_id: row.id,
        location_id: row.location_id,
        suggested_reply: row.suggested_reply,
        ai_model: row.ai_model,
        ai_tone: row.ai_tone,
        draft_reply: row.draft_reply,
        final_published_reply: row.final_published_reply,
        status: row.reply_workflow_status,
        created_by_user_id: row.created_by_user_id,
        approved_by_user_id: row.approved_by_user_id,
        approved_at: row.approved_at,
        published_by_user_id: row.published_by_user_id,
        published_at: row.published_at,
        publish_error: row.publish_error,
        created_at: row.reply_created_at,
        updated_at: row.reply_updated_at,
      };
    } else {
      row.reply = null;
    }

    return row;
  }

  /**
   * Updates review processing/workflow status ('unread', 'read', 'archived', 'flagged')
   *
   * @param {string} agencyId
   * @param {string} reviewId
   * @param {string} status
   * @param {import('pg').PoolClient} [executor]
   */
  async updateStatus(agencyId, reviewId, status, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');
    if (!reviewId) throw new Error('reviewId is required');
    if (!ALLOWED_STATUSES.has(status)) {
      throw new Error(`Invalid status: "${status}". Must be one of: ${Array.from(ALLOWED_STATUSES).join(', ')}`);
    }

    const query = `
      UPDATE reviews
      SET status = $3, updated_at = NOW()
      WHERE id = $2 AND agency_id = $1
      RETURNING *;
    `;

    const { rows } = await executor.query(query, [agencyId, reviewId, status]);
    return rows[0] || null;
  }

  /**
   * Finds a review by location and Google review ID
   *
   * @param {string} agencyId
   * @param {string} locationId
   * @param {string} googleReviewId
   * @param {import('pg').PoolClient} [executor]
   */
  async findByGoogleReviewId(agencyId, locationId, googleReviewId, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');
    if (!locationId) throw new Error('locationId is required');
    if (!googleReviewId) throw new Error('googleReviewId is required');

    const query = `
      SELECT *
      FROM reviews
      WHERE agency_id = $1 AND location_id = $2 AND google_review_id = $3;
    `;
    const { rows } = await executor.query(query, [agencyId, locationId, googleReviewId]);
    return rows[0] || null;
  }
}
