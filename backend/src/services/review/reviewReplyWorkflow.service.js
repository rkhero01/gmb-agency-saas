import { ReviewRepository } from '../../repositories/review.repository.js';
import { ReviewReplyRepository } from '../../repositories/reviewReply.repository.js';
import { googleBusinessProfileRepository } from '../../repositories/googleBusinessProfile.repository.js';
import { aiService } from '../ai/ai.service.js';
import { googleReviewClient } from '../google/googleReview.client.js';
import { withTenantContext } from '../../database/session.js';
import { ROLES, PERMISSIONS, hasPermission } from '../../config/permissions.js';

const ALLOWED_PUBLISH_STATES = new Set(['approved', 'draft', 'pending_approval']);

/**
 * ReviewReplyWorkflowService
 * Orchestrates AI reply generation, draft authoring, human review & approval gates,
 * and reliable external publishing to Google Business Profile.
 *
 * Core Guarantees:
 * - Human-in-the-loop: AI suggestions are strictly advisory and never published autonomously.
 * - Specialist Approval Gate: Specialists cannot publish unless reply status is 'approved'.
 * - Non-blocking Network Boundaries: Google API calls are NEVER executed inside DB transactions.
 * - Atomic Local State Transitions: Local mutations are transactional via withTenantContext.
 * - Reconciliation Safety: Unreconciled Google-success/local-failure states are recorded and surfaced.
 */
export class ReviewReplyWorkflowService {
  constructor(
    reviewRepo = new ReviewRepository(),
    replyRepo = new ReviewReplyRepository(),
    aiServiceInstance = aiService,
    gbpRepo = googleBusinessProfileRepository,
    googleClient = googleReviewClient,
    txHelper = withTenantContext
  ) {
    this.reviewRepository = reviewRepo;
    this.reviewReplyRepository = replyRepo;
    this.aiService = aiServiceInstance;
    this.googleBusinessProfileRepository = gbpRepo;
    this.googleReviewClient = googleClient;
    this.withTenantContext = txHelper;
  }

  /**
   * Resolves verified agencyId and actor context.
   * Guarantees tenant context strictly originates from verified auth claims.
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
   * Asserts that the actor possesses the required permission.
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
   * Generates an advisory AI suggestion for a customer review.
   * AI output is persisted as an advisory suggestion and does NOT alter publish status.
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string, agency_id: string }} actor
   * @param {string} reviewId
   * @param {{ tone?: string, customInstructions?: string }} [options={}]
   */
  async generateAiSuggestion(agencyId, actor, reviewId, options = {}) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.REPLY_GENERATE_AI);

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

    if (review.reply_status === 'published') {
      const error = new Error('Cannot generate AI suggestion for an already published review.');
      error.code = 'INVALID_TRANSITION';
      error.status = 400;
      throw error;
    }

    const aiContext = {
      starRating: review.star_rating,
      reviewText: review.comment,
      reviewerName: review.reviewer_name,
      businessName: review.client_business_name || review.client_name || review.location_name,
      tone: options.tone,
      customInstructions: options.customInstructions || options.custom_instructions,
    };

    let aiResult;
    try {
      aiResult = await this.aiService.generateReplySuggestion(aiContext);
    } catch (aiErr) {
      const error = new Error(`AI service failure: ${aiErr.message}`);
      error.code = 'AI_SERVICE_UNAVAILABLE';
      error.status = 503;
      throw error;
    }

    if (!aiResult || !aiResult.suggestedReply) {
      const error = new Error('AI service failed to generate a reply suggestion.');
      error.code = 'AI_SERVICE_UNAVAILABLE';
      error.status = 503;
      throw error;
    }

    const reply = await this.reviewReplyRepository.upsertReply(ctx.agencyId, {
      review_id: reviewId,
      suggested_reply: aiResult.suggestedReply,
      ai_model: aiResult.model,
      ai_tone: aiResult.tone,
      status: 'suggested',
      created_by_user_id: ctx.actor.id,
    });

    return {
      reviewId,
      suggestedReply: aiResult.suggestedReply,
      aiModel: aiResult.model,
      aiTone: aiResult.tone,
      isFallback: Boolean(aiResult.isFallback),
      status: reply.status,
    };
  }

  /**
   * Saves or updates a draft reply for a customer review.
   * Transitions review status to 'draft'.
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string, agency_id: string }} actor
   * @param {string} reviewId
   * @param {string} draftReply
   */
  async saveDraft(agencyId, actor, reviewId, draftReply) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.REPLY_EDIT_DRAFT);

    if (!reviewId) {
      const error = new Error('reviewId is required.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    if (!draftReply || typeof draftReply !== 'string' || !draftReply.trim()) {
      const error = new Error('Draft reply text is required.');
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

    if (review.reply_status === 'published') {
      const error = new Error('Cannot edit draft: Review reply has already been published.');
      error.code = 'INVALID_TRANSITION';
      error.status = 400;
      throw error;
    }

    return this.withTenantContext(ctx.agencyId, async (client) => {
      return this.reviewReplyRepository.upsertReply(
        ctx.agencyId,
        {
          review_id: reviewId,
          draft_reply: draftReply.trim(),
          status: 'draft',
          created_by_user_id: ctx.actor.id,
        },
        client
      );
    });
  }

  /**
   * Submits an existing draft reply for human management approval.
   * Allowed source states: 'draft', 'rejected'.
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string, agency_id: string }} actor
   * @param {string} reviewId
   */
  async submitForApproval(agencyId, actor, reviewId) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.REPLY_SUBMIT_APPROVAL);

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

    const reply = await this.reviewReplyRepository.findByReviewId(ctx.agencyId, reviewId);
    if (!reply) {
      const error = new Error('Cannot submit for approval: No draft reply exists for this review.');
      error.code = 'REPLY_NOT_FOUND';
      error.status = 400;
      throw error;
    }

    if (!reply.draft_reply || !reply.draft_reply.trim()) {
      const error = new Error('Cannot submit for approval: Reply draft is empty.');
      error.code = 'INVALID_TRANSITION';
      error.status = 400;
      throw error;
    }

    if (reply.status === 'published') {
      const error = new Error('Cannot submit approval for an already published reply.');
      error.code = 'INVALID_TRANSITION';
      error.status = 400;
      throw error;
    }

    if (reply.status === 'approved') {
      const error = new Error('Reply has already been approved.');
      error.code = 'INVALID_TRANSITION';
      error.status = 400;
      throw error;
    }

    if (reply.status !== 'draft' && reply.status !== 'rejected') {
      const error = new Error(
        `Cannot submit for approval from status "${reply.status}". Reply must be in draft or rejected status.`
      );
      error.code = 'INVALID_TRANSITION';
      error.status = 400;
      throw error;
    }

    return this.withTenantContext(ctx.agencyId, async (client) => {
      return this.reviewReplyRepository.setApproval(
        ctx.agencyId,
        reviewId,
        null,
        'pending_approval',
        client
      );
    });
  }

  /**
   * Approves a reply draft for publishing.
   * Scoped to roles with REPLY_APPROVE permission (owner, admin, manager).
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string, agency_id: string }} actor
   * @param {string} reviewId
   */
  async approveReply(agencyId, actor, reviewId) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.REPLY_APPROVE);

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

    const reply = await this.reviewReplyRepository.findByReviewId(ctx.agencyId, reviewId);
    if (!reply) {
      const error = new Error('No reply draft found for this review.');
      error.code = 'REPLY_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    if (reply.status === 'published') {
      const error = new Error('Reply is already published.');
      error.code = 'INVALID_TRANSITION';
      error.status = 400;
      throw error;
    }

    if (reply.status !== 'pending_approval' && reply.status !== 'draft') {
      const error = new Error(
        `Cannot approve reply in "${reply.status}" status. Reply must be pending approval or in draft.`
      );
      error.code = 'INVALID_TRANSITION';
      error.status = 400;
      throw error;
    }

    return this.withTenantContext(ctx.agencyId, async (client) => {
      return this.reviewReplyRepository.setApproval(
        ctx.agencyId,
        reviewId,
        ctx.actor.id,
        'approved',
        client
      );
    });
  }

  /**
   * Rejects a reply draft submitted for approval.
   * Transitions reply status to 'rejected' and review reply_status to 'draft'.
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string, agency_id: string }} actor
   * @param {string} reviewId
   * @param {string} [reason=null]
   */
  async rejectReply(agencyId, actor, reviewId, reason = null) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.REPLY_APPROVE);

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

    const reply = await this.reviewReplyRepository.findByReviewId(ctx.agencyId, reviewId);
    if (!reply) {
      const error = new Error('No reply draft found for this review.');
      error.code = 'REPLY_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    if (reply.status !== 'pending_approval') {
      const error = new Error(
        `Cannot reject reply in "${reply.status}" status. Reply must be in pending_approval status.`
      );
      error.code = 'INVALID_TRANSITION';
      error.status = 400;
      throw error;
    }

    return this.withTenantContext(ctx.agencyId, async (client) => {
      return this.reviewReplyRepository.setApproval(
        ctx.agencyId,
        reviewId,
        ctx.actor.id,
        'rejected',
        client
      );
    });
  }

  /**
   * Publishes an approved reply to Google Business Profile.
   *
   * Security & Network Boundaries:
   * 1. Specialist Approval Gate: Specialists MUST have reply.status === 'approved'.
   * 2. Non-blocking Network Call: Google API is invoked OUTSIDE any DB transaction.
   * 3. Atomic Local Commit: Local DB commit executes in withTenantContext only AFTER Google succeeds.
   * 4. Reconciliation Safety: Catches DB failure after Google success and surfaces RECONCILIATION_REQUIRED.
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string, agency_id: string }} actor
   * @param {string} reviewId
   */
  async publishReply(agencyId, actor, reviewId) {
    // -------------------------------------------------------------------------
    // PHASE A: LOCAL VALIDATION / READ (OUTSIDE DB TRANSACTION)
    // -------------------------------------------------------------------------
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.REPLY_PUBLISH);

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

    const reply = await this.reviewReplyRepository.findByReviewId(ctx.agencyId, reviewId);
    if (!reply) {
      const error = new Error('No reply draft or suggestion found for this review.');
      error.code = 'REPLY_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    if (reply.status === 'published' || review.reply_status === 'published') {
      const error = new Error('Reply is already published.');
      error.code = 'INVALID_TRANSITION';
      error.status = 400;
      throw error;
    }

    // CRITICAL: SPECIALIST APPROVAL GATE
    // Specialists have reply:publish permission, but may ONLY publish replies
    // that have already been reviewed and approved by an authorized manager/admin/owner.
    if (ctx.actor.role === ROLES.SPECIALIST && reply.status !== 'approved') {
      const error = new Error(
        'Approval required: Specialists may only publish replies that have been approved by a Manager, Admin, or Owner.'
      );
      error.code = 'APPROVAL_REQUIRED';
      error.status = 403;
      throw error;
    }

    // Manager / Admin / Owner may publish from approved, draft, or pending_approval
    if (!ALLOWED_PUBLISH_STATES.has(reply.status)) {
      const error = new Error(`Cannot publish reply in "${reply.status}" status.`);
      error.code = 'INVALID_TRANSITION';
      error.status = 400;
      throw error;
    }

    const replyText = (reply.draft_reply || reply.suggested_reply || '').trim();
    if (!replyText) {
      const error = new Error('Cannot publish empty reply text.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    // Verify location has valid GBP linkage
    const gbpProfile = await this.googleBusinessProfileRepository.findByLocationId(
      ctx.agencyId,
      review.location_id
    );
    if (!gbpProfile || !gbpProfile.google_account_id || !gbpProfile.google_location_id) {
      const error = new Error('Location is not linked to an active Google Business Profile.');
      error.code = 'LOCATION_NOT_LINKED';
      error.status = 400;
      throw error;
    }

    if (!review.google_review_id) {
      const error = new Error('Review is missing a valid Google review identifier.');
      error.code = 'GOOGLE_RESOURCE_NOT_FOUND';
      error.status = 400;
      throw error;
    }

    // -------------------------------------------------------------------------
    // PHASE B: GOOGLE API CALL (OUTSIDE DB TRANSACTION)
    // -------------------------------------------------------------------------
    try {
      await this.googleReviewClient.publishReply(
        ctx.agencyId,
        gbpProfile.google_account_id,
        gbpProfile.google_location_id,
        review.google_review_id,
        replyText
      );
    } catch (googleErr) {
      try {
        await this.reviewReplyRepository.recordPublishError(
          ctx.agencyId,
          reviewId,
          googleErr.message || 'Google publish failed'
        );
      } catch (_recErr) {
        // Non-fatal logging to ensure original Google error is surfaced
      }
      throw googleErr;
    }

    // -------------------------------------------------------------------------
    // PHASE C: LOCAL COMMIT (ATOMIC via withTenantContext)
    // -------------------------------------------------------------------------
    let updatedReply;
    try {
      updatedReply = await this.withTenantContext(ctx.agencyId, async (client) => {
        return this.reviewReplyRepository.markPublished(
          ctx.agencyId,
          reviewId,
          ctx.actor.id,
          replyText,
          client
        );
      });
    } catch (dbErr) {
      // Reconciliation hazard: Google succeeded, but local database write failed
      console.error(
        `CRITICAL RECONCILIATION RISK: Google reply published for review ${reviewId}, but local DB commit failed:`,
        dbErr
      );
      try {
        await this.reviewReplyRepository.recordPublishError(
          ctx.agencyId,
          reviewId,
          `RECONCILIATION REQUIRED: Published to Google successfully, but local database update failed: ${dbErr.message}`
        );
      } catch (_recErr) {
        // Non-fatal
      }

      const recError = new Error(
        `Reconciliation required: Reply was published to Google, but updating the local database failed (${dbErr.message}). Review status must be reconciled.`
      );
      recError.code = 'RECONCILIATION_REQUIRED';
      recError.status = 500;
      recError.cause = dbErr;
      throw recError;
    }

    return updatedReply;
  }

  /**
   * Deletes an official business reply published on Google Business Profile.
   * Scoped strictly to roles with REPLY_DELETE (owner, admin, manager).
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string, agency_id: string }} actor
   * @param {string} reviewId
   */
  async deletePublishedReply(agencyId, actor, reviewId) {
    const ctx = this._resolveContext(agencyId, actor);
    this._assertPermission(ctx.actor, PERMISSIONS.REPLY_DELETE);

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

    if (review.reply_status !== 'published') {
      const error = new Error('Cannot delete reply: Only published replies can be deleted.');
      error.code = 'INVALID_TRANSITION';
      error.status = 400;
      throw error;
    }

    const gbpProfile = await this.googleBusinessProfileRepository.findByLocationId(
      ctx.agencyId,
      review.location_id
    );
    if (!gbpProfile || !gbpProfile.google_account_id || !gbpProfile.google_location_id) {
      const error = new Error('Location is not linked to an active Google Business Profile.');
      error.code = 'LOCATION_NOT_LINKED';
      error.status = 400;
      throw error;
    }

    if (!review.google_review_id) {
      const error = new Error('Review is missing a valid Google review identifier.');
      error.code = 'GOOGLE_RESOURCE_NOT_FOUND';
      error.status = 400;
      throw error;
    }

    // Call Google Delete OUTSIDE DB transaction
    try {
      await this.googleReviewClient.deleteReply(
        ctx.agencyId,
        gbpProfile.google_account_id,
        gbpProfile.google_location_id,
        review.google_review_id
      );
    } catch (googleErr) {
      try {
        await this.reviewReplyRepository.recordPublishError(
          ctx.agencyId,
          reviewId,
          `Delete failed: ${googleErr.message}`
        );
      } catch (_recErr) {
        // Non-fatal
      }
      throw googleErr;
    }

    // On Google delete success: atomically reset local review & reply state
    await this.withTenantContext(ctx.agencyId, async (client) => {
      // 1. Reset review reply status and external reply comments
      await client.query(
        `
        UPDATE reviews
        SET
          reply_status = 'unreplied',
          external_reply_comment = NULL,
          external_reply_update_time = NOW(),
          updated_at = NOW()
        WHERE id = $2 AND agency_id = $1;
      `,
        [ctx.agencyId, reviewId]
      );

      // 2. Remove reply record so a fresh draft or AI suggestion can be created
      await client.query(
        `
        DELETE FROM review_replies
        WHERE review_id = $2 AND agency_id = $1;
      `,
        [ctx.agencyId, reviewId]
      );
    });

    return {
      success: true,
      reviewId,
      deleted: true,
    };
  }
}

export const reviewReplyWorkflowService = new ReviewReplyWorkflowService();
