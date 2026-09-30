import { Router } from 'express';
import {
  generateAiSuggestion,
  saveDraft,
  submitForApproval,
  approveReply,
  rejectReply,
  publishReply,
  deletePublishedReply,
} from '../controllers/reviewReply.controller.js';
import {
  authenticate,
  authorizePermissions,
  enforceViewerReadOnly,
} from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router({ mergeParams: true });

// All reply workflow routes require authentication
router.use(authenticate);

// Enforce viewer role cannot perform modification actions
router.use(enforceViewerReadOnly);

// POST /api/v1/reviews/:reviewId/reply/ai-suggestion - Generate AI reply suggestion
router.post(
  '/ai-suggestion',
  authorizePermissions(PERMISSIONS.REPLY_GENERATE_AI),
  generateAiSuggestion
);

// PUT /api/v1/reviews/:reviewId/reply/draft - Save/edit draft reply
router.put(
  '/draft',
  authorizePermissions(PERMISSIONS.REPLY_EDIT_DRAFT),
  saveDraft
);

// POST /api/v1/reviews/:reviewId/reply/submit-approval - Submit draft for approval
router.post(
  '/submit-approval',
  authorizePermissions(PERMISSIONS.REPLY_SUBMIT_APPROVAL),
  submitForApproval
);

// POST /api/v1/reviews/:reviewId/reply/approve - Approve reply draft
router.post(
  '/approve',
  authorizePermissions(PERMISSIONS.REPLY_APPROVE),
  approveReply
);

// POST /api/v1/reviews/:reviewId/reply/reject - Reject reply draft
router.post(
  '/reject',
  authorizePermissions(PERMISSIONS.REPLY_APPROVE),
  rejectReply
);

// POST /api/v1/reviews/:reviewId/reply/publish - Publish approved reply to Google
router.post(
  '/publish',
  authorizePermissions(PERMISSIONS.REPLY_PUBLISH),
  publishReply
);

// DELETE /api/v1/reviews/:reviewId/reply - Delete published reply from Google
router.delete(
  '/',
  authorizePermissions(PERMISSIONS.REPLY_DELETE),
  deletePublishedReply
);

export default router;
