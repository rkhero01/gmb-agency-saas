import { pool } from '../config/database.js';

const ALLOWED_REPLY_STATUSES = new Set([
  'suggested',
  'draft',
  'pending_approval',
  'approved',
  'published',
  'rejected',
]);

const ALLOWED_APPROVAL_STATUSES = new Set(['approved', 'rejected', 'pending_approval']);

export class ReviewReplyRepository {
  constructor(db = pool) {
    this.db = db;
  }

  /**
   * Upserts a reply record for a review.
   * Scoped strictly to agency_id and review_id.
   *
   * @param {string} agencyId
   * @param {{
   *   reviewId?: string,
   *   review_id?: string,
   *   locationId?: string,
   *   location_id?: string,
   *   suggestedReply?: string,
   *   suggested_reply?: string,
   *   aiModel?: string,
   *   ai_model?: string,
   *   aiTone?: string,
   *   ai_tone?: string,
   *   draftReply?: string,
   *   draft_reply?: string,
   *   finalPublishedReply?: string,
   *   final_published_reply?: string,
   *   status?: string,
   *   createdByUserId?: string,
   *   created_by_user_id?: string
   * }} replyData
   * @param {import('pg').PoolClient} [executor]
   */
  async upsertReply(agencyId, replyData, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');

    const reviewId = replyData.review_id || replyData.reviewId;
    if (!reviewId) throw new Error('review_id is required');

    // Always resolve location_id directly from the parent review using review_id + agency_id.
    // Never trust caller-provided location_id to prevent mismatched location_id persistence.
    const parentCheckQuery = `
      SELECT location_id
      FROM reviews
      WHERE id = $1 AND agency_id = $2;
    `;
    const { rows: parentRows } = await executor.query(parentCheckQuery, [reviewId, agencyId]);
    if (!parentRows[0]) {
      throw new Error('Review not found or does not belong to this agency');
    }
    const locationId = parentRows[0].location_id;

    const suggestedReply = replyData.suggested_reply !== undefined
      ? replyData.suggested_reply
      : (replyData.suggestedReply !== undefined ? replyData.suggestedReply : null);

    const aiModel = replyData.ai_model || replyData.aiModel || null;
    const aiTone = replyData.ai_tone || replyData.aiTone || null;

    const draftReply = replyData.draft_reply !== undefined
      ? replyData.draft_reply
      : (replyData.draftReply !== undefined ? replyData.draftReply : null);

    const finalPublishedReply = replyData.final_published_reply || replyData.finalPublishedReply || null;

    let status = replyData.status;
    if (!status) {
      if (draftReply) {
        status = 'draft';
      } else if (suggestedReply) {
        status = 'suggested';
      } else {
        status = 'suggested';
      }
    }

    if (!ALLOWED_REPLY_STATUSES.has(status)) {
      throw new Error(`Invalid reply status: "${status}". Must be one of: ${Array.from(ALLOWED_REPLY_STATUSES).join(', ')}`);
    }

    const createdByUserId = replyData.created_by_user_id || replyData.createdByUserId || null;

    const query = `
      INSERT INTO review_replies (
        agency_id,
        review_id,
        location_id,
        suggested_reply,
        ai_model,
        ai_tone,
        draft_reply,
        final_published_reply,
        status,
        created_by_user_id,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (review_id) DO UPDATE SET
        suggested_reply = COALESCE(EXCLUDED.suggested_reply, review_replies.suggested_reply),
        ai_model = COALESCE(EXCLUDED.ai_model, review_replies.ai_model),
        ai_tone = COALESCE(EXCLUDED.ai_tone, review_replies.ai_tone),
        draft_reply = COALESCE(EXCLUDED.draft_reply, review_replies.draft_reply),
        final_published_reply = COALESCE(EXCLUDED.final_published_reply, review_replies.final_published_reply),
        status = COALESCE(EXCLUDED.status, review_replies.status),
        created_by_user_id = COALESCE(EXCLUDED.created_by_user_id, review_replies.created_by_user_id),
        updated_at = NOW()
      WHERE review_replies.agency_id = $1
      RETURNING
        id,
        agency_id,
        review_id,
        location_id,
        suggested_reply,
        ai_model,
        ai_tone,
        draft_reply,
        final_published_reply,
        status,
        created_by_user_id,
        approved_by_user_id,
        approved_at,
        published_by_user_id,
        published_at,
        publish_error,
        created_at,
        updated_at;
    `;

    const values = [
      agencyId,
      reviewId,
      locationId,
      suggestedReply,
      aiModel,
      aiTone,
      draftReply,
      finalPublishedReply,
      status,
      createdByUserId,
    ];

    const { rows } = await executor.query(query, values);
    const reply = rows[0];

    // Synchronize review reply_status
    if (reply) {
      const syncQuery = `
        UPDATE reviews
        SET
          reply_status = CASE
            WHEN $3::text = 'draft' THEN 'draft'
            WHEN $3::text = 'pending_approval' THEN 'pending_approval'
            WHEN $3::text = 'approved' THEN 'approved'
            WHEN $3::text = 'published' THEN 'published'
            WHEN $3::text = 'suggested' AND reply_status = 'unreplied' THEN 'ai_suggested'
            ELSE reply_status
          END,
          updated_at = NOW()
        WHERE id = $2 AND agency_id = $1;
      `;
      await executor.query(syncQuery, [agencyId, reviewId, status]);
    }

    return reply;
  }

  /**
   * Finds a reply by review ID, strictly scoped to an agency tenant.
   * Safely returns user attribution (name/email) without leaking credentials or tokens.
   *
   * @param {string} agencyId
   * @param {string} reviewId
   * @param {import('pg').PoolClient} [executor]
   */
  async findByReviewId(agencyId, reviewId, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');
    if (!reviewId) throw new Error('reviewId is required');

    const query = `
      SELECT
        rr.id,
        rr.agency_id,
        rr.review_id,
        rr.location_id,
        rr.suggested_reply,
        rr.ai_model,
        rr.ai_tone,
        rr.draft_reply,
        rr.final_published_reply,
        rr.status,
        rr.created_by_user_id,
        u_created.name AS created_by_user_name,
        u_created.email AS created_by_user_email,
        rr.approved_by_user_id,
        u_approved.name AS approved_by_user_name,
        u_approved.email AS approved_by_user_email,
        rr.approved_at,
        rr.published_by_user_id,
        u_published.name AS published_by_user_name,
        u_published.email AS published_by_user_email,
        rr.published_at,
        rr.publish_error,
        rr.created_at,
        rr.updated_at
      FROM review_replies rr
      LEFT JOIN users u_created ON rr.created_by_user_id = u_created.id
      LEFT JOIN users u_approved ON rr.approved_by_user_id = u_approved.id
      LEFT JOIN users u_published ON rr.published_by_user_id = u_published.id
      WHERE rr.review_id = $1 AND rr.agency_id = $2;
    `;

    const { rows } = await executor.query(query, [reviewId, agencyId]);
    return rows[0] || null;
  }

  /**
   * Finds a reply by reply ID, strictly scoped to an agency tenant.
   *
   * @param {string} agencyId
   * @param {string} replyId
   * @param {import('pg').PoolClient} [executor]
   */
  async findById(agencyId, replyId, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');
    if (!replyId) throw new Error('replyId is required');

    const query = `
      SELECT
        rr.id,
        rr.agency_id,
        rr.review_id,
        rr.location_id,
        rr.suggested_reply,
        rr.ai_model,
        rr.ai_tone,
        rr.draft_reply,
        rr.final_published_reply,
        rr.status,
        rr.created_by_user_id,
        u_created.name AS created_by_user_name,
        rr.approved_by_user_id,
        u_approved.name AS approved_by_user_name,
        rr.approved_at,
        rr.published_by_user_id,
        u_published.name AS published_by_user_name,
        rr.published_at,
        rr.publish_error,
        rr.created_at,
        rr.updated_at
      FROM review_replies rr
      LEFT JOIN users u_created ON rr.created_by_user_id = u_created.id
      LEFT JOIN users u_approved ON rr.approved_by_user_id = u_approved.id
      LEFT JOIN users u_published ON rr.published_by_user_id = u_published.id
      WHERE rr.id = $1 AND rr.agency_id = $2;
    `;

    const { rows } = await executor.query(query, [replyId, agencyId]);
    return rows[0] || null;
  }

  /**
   * Sets the approval status and records the approving user audit trail.
   * Scoped strictly to agency_id and review_id.
   *
   * @param {string} agencyId
   * @param {string} reviewId
   * @param {string} approvedByUserId
   * @param {string} [status='approved']
   * @param {import('pg').PoolClient} [executor]
   */
  async setApproval(agencyId, reviewId, approvedByUserId, status = 'approved', executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');
    if (!reviewId) throw new Error('reviewId is required');

    if (!ALLOWED_APPROVAL_STATUSES.has(status)) {
      throw new Error(`Invalid approval status: "${status}". Must be one of: ${Array.from(ALLOWED_APPROVAL_STATUSES).join(', ')}`);
    }

    const query = `
      UPDATE review_replies
      SET
        status = $3::varchar,
        approved_by_user_id = $4,
        approved_at = CASE WHEN $3::text = 'approved' THEN NOW() ELSE approved_at END,
        updated_at = NOW()
      WHERE review_id = $2 AND agency_id = $1
      RETURNING
        id,
        agency_id,
        review_id,
        location_id,
        suggested_reply,
        ai_model,
        ai_tone,
        draft_reply,
        final_published_reply,
        status,
        created_by_user_id,
        approved_by_user_id,
        approved_at,
        published_by_user_id,
        published_at,
        publish_error,
        created_at,
        updated_at;
    `;

    const { rows } = await executor.query(query, [agencyId, reviewId, status, approvedByUserId || null]);
    const updated = rows[0] || null;

    if (updated) {
      const syncQuery = `
        UPDATE reviews
        SET
          reply_status = CASE
            WHEN $3::text = 'approved' THEN 'approved'
            WHEN $3::text = 'pending_approval' THEN 'pending_approval'
            WHEN $3::text = 'rejected' THEN 'draft'
            ELSE reply_status
          END,
          updated_at = NOW()
        WHERE id = $2 AND agency_id = $1;
      `;
      await executor.query(syncQuery, [agencyId, reviewId, status]);
    }

    return updated;
  }

  /**
   * Marks a reply as published, saving the final text and publishing user audit trail.
   * Scoped strictly to agency_id and review_id.
   *
   * @param {string} agencyId
   * @param {string} reviewId
   * @param {string} publishedByUserId
   * @param {string} publishedText
   * @param {import('pg').PoolClient} [executor]
   */
  async markPublished(agencyId, reviewId, publishedByUserId, publishedText, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');
    if (!reviewId) throw new Error('reviewId is required');
    if (!publishedText || typeof publishedText !== 'string' || !publishedText.trim()) {
      throw new Error('publishedText is required');
    }

    const cleanText = publishedText.trim();

    const query = `
      UPDATE review_replies
      SET
        status = 'published',
        published_by_user_id = $3,
        final_published_reply = $4,
        published_at = NOW(),
        publish_error = NULL,
        updated_at = NOW()
      WHERE review_id = $2 AND agency_id = $1
      RETURNING
        id,
        agency_id,
        review_id,
        location_id,
        suggested_reply,
        ai_model,
        ai_tone,
        draft_reply,
        final_published_reply,
        status,
        created_by_user_id,
        approved_by_user_id,
        approved_at,
        published_by_user_id,
        published_at,
        publish_error,
        created_at,
        updated_at;
    `;

    const { rows } = await executor.query(query, [agencyId, reviewId, publishedByUserId || null, cleanText]);
    const updated = rows[0] || null;

    if (updated) {
      const syncQuery = `
        UPDATE reviews
        SET
          reply_status = 'published',
          external_reply_comment = $3,
          external_reply_update_time = NOW(),
          updated_at = NOW()
        WHERE id = $2 AND agency_id = $1;
      `;
      await executor.query(syncQuery, [agencyId, reviewId, cleanText]);
    }

    return updated;
  }

  /**
   * Records a publishing error without breaking the reply state
   *
   * @param {string} agencyId
   * @param {string} reviewId
   * @param {string} errorMessage
   * @param {import('pg').PoolClient} [executor]
   */
  async recordPublishError(agencyId, reviewId, errorMessage, executor = this.db) {
    if (!agencyId) throw new Error('agency_id is required');
    if (!reviewId) throw new Error('reviewId is required');

    const query = `
      UPDATE review_replies
      SET
        publish_error = $3,
        updated_at = NOW()
      WHERE review_id = $2 AND agency_id = $1
      RETURNING *;
    `;

    const { rows } = await executor.query(query, [agencyId, reviewId, errorMessage]);
    return rows[0] || null;
  }
}
