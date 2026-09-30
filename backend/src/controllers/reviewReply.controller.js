import { reviewReplyWorkflowService } from '../services/review/reviewReplyWorkflow.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id) {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

/**
 * Generates an advisory AI suggestion for a review
 * POST /api/v1/reviews/:reviewId/reply/ai-suggestion
 */
export async function generateAiSuggestion(req, res, next) {
  try {
    const { reviewId } = req.params;
    const { tone, customInstructions } = req.body || {};

    if (!isValidUuid(reviewId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID_FORMAT', message: 'reviewId must be a valid UUID.' },
      });
    }

    if (tone && (typeof tone !== 'string' || tone.length > 50)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'tone must be a string up to 50 characters.' },
      });
    }

    if (customInstructions && (typeof customInstructions !== 'string' || customInstructions.length > 500)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'customInstructions must be a string up to 500 characters.',
        },
      });
    }

    const agencyId = req.user.agency_id || req.tenant?.agencyId;
    const result = await reviewReplyWorkflowService.generateAiSuggestion(
      agencyId,
      req.user,
      reviewId,
      { tone, customInstructions }
    );

    res.status(200).json({
      success: true,
      data: result,
      message: 'AI reply suggestion generated successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Saves or updates a draft reply
 * PUT /api/v1/reviews/:reviewId/reply/draft
 */
export async function saveDraft(req, res, next) {
  try {
    const { reviewId } = req.params;
    const { draftReply } = req.body || {};

    if (!isValidUuid(reviewId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID_FORMAT', message: 'reviewId must be a valid UUID.' },
      });
    }

    if (!draftReply || typeof draftReply !== 'string' || !draftReply.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'draftReply is required and must be a non-empty string.',
        },
      });
    }

    if (draftReply.length > 5000) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'draftReply must not exceed 5000 characters.',
        },
      });
    }

    const agencyId = req.user.agency_id || req.tenant?.agencyId;
    const result = await reviewReplyWorkflowService.saveDraft(
      agencyId,
      req.user,
      reviewId,
      draftReply
    );

    res.status(200).json({
      success: true,
      data: result,
      message: 'Reply draft saved successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Submits draft reply for management approval
 * POST /api/v1/reviews/:reviewId/reply/submit-approval
 */
export async function submitForApproval(req, res, next) {
  try {
    const { reviewId } = req.params;

    if (!isValidUuid(reviewId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID_FORMAT', message: 'reviewId must be a valid UUID.' },
      });
    }

    const agencyId = req.user.agency_id || req.tenant?.agencyId;
    const result = await reviewReplyWorkflowService.submitForApproval(
      agencyId,
      req.user,
      reviewId
    );

    res.status(200).json({
      success: true,
      data: result,
      message: 'Reply submitted for management approval.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Approves a pending reply draft
 * POST /api/v1/reviews/:reviewId/reply/approve
 */
export async function approveReply(req, res, next) {
  try {
    const { reviewId } = req.params;

    if (!isValidUuid(reviewId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID_FORMAT', message: 'reviewId must be a valid UUID.' },
      });
    }

    const agencyId = req.user.agency_id || req.tenant?.agencyId;
    const result = await reviewReplyWorkflowService.approveReply(agencyId, req.user, reviewId);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Reply approved successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Rejects a pending reply draft
 * POST /api/v1/reviews/:reviewId/reply/reject
 */
export async function rejectReply(req, res, next) {
  try {
    const { reviewId } = req.params;
    const { reason } = req.body || {};

    if (!isValidUuid(reviewId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID_FORMAT', message: 'reviewId must be a valid UUID.' },
      });
    }

    if (reason && (typeof reason !== 'string' || reason.length > 500)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'reason must be a string up to 500 characters.' },
      });
    }

    const agencyId = req.user.agency_id || req.tenant?.agencyId;
    const result = await reviewReplyWorkflowService.rejectReply(
      agencyId,
      req.user,
      reviewId,
      reason
    );

    res.status(200).json({
      success: true,
      data: result,
      message: 'Reply draft rejected.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Publishes an approved reply to Google Business Profile
 * POST /api/v1/reviews/:reviewId/reply/publish
 */
export async function publishReply(req, res, next) {
  try {
    const { reviewId } = req.params;

    if (!isValidUuid(reviewId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID_FORMAT', message: 'reviewId must be a valid UUID.' },
      });
    }

    const agencyId = req.user.agency_id || req.tenant?.agencyId;
    const result = await reviewReplyWorkflowService.publishReply(agencyId, req.user, reviewId);

    res.status(200).json({
      success: true,
      data: result,
      message: 'Reply published to Google Business Profile successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Deletes a published business reply from Google Business Profile
 * DELETE /api/v1/reviews/:reviewId/reply
 */
export async function deletePublishedReply(req, res, next) {
  try {
    const { reviewId } = req.params;

    if (!isValidUuid(reviewId)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ID_FORMAT', message: 'reviewId must be a valid UUID.' },
      });
    }

    const agencyId = req.user.agency_id || req.tenant?.agencyId;
    const result = await reviewReplyWorkflowService.deletePublishedReply(
      agencyId,
      req.user,
      reviewId
    );

    res.status(200).json({
      success: true,
      data: result,
      message: 'Published reply deleted from Google Business Profile.',
    });
  } catch (error) {
    next(error);
  }
}
