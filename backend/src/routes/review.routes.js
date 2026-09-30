import { Router } from 'express';
import {
  listReviews,
  getReviewStats,
  getReviewById,
  updateReviewStatus,
} from '../controllers/review.controller.js';
import reviewReplyRoutes from './reviewReply.routes.js';
import {
  authenticate,
  authorizePermissions,
  enforceViewerReadOnly,
} from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

// All review routes require authentication
router.use(authenticate);

// Enforce viewer role cannot perform modification actions
router.use(enforceViewerReadOnly);

// GET /api/v1/reviews - List customer reviews with filtering & pagination
router.get('/', authorizePermissions(PERMISSIONS.REVIEW_VIEW), listReviews);

// GET /api/v1/reviews/stats - Review analytics and star rating distribution
// Must be registered before /:reviewId to prevent route parameter collision
router.get('/stats', authorizePermissions(PERMISSIONS.REVIEW_VIEW), getReviewStats);

// GET /api/v1/reviews/:reviewId - Single review details
router.get('/:reviewId', authorizePermissions(PERMISSIONS.REVIEW_VIEW), getReviewById);

// PATCH /api/v1/reviews/:reviewId/status - Update review workflow status ('unread', 'read', 'archived', 'flagged')
router.patch(
  '/:reviewId/status',
  authorizePermissions(PERMISSIONS.REVIEW_UPDATE_STATUS),
  updateReviewStatus
);

// Mount reply workflow routes: /api/v1/reviews/:reviewId/reply/*
router.use('/:reviewId/reply', reviewReplyRoutes);

export default router;
