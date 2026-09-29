import { Router } from 'express';
import {
  getTeamMembers,
  inviteTeamMember,
  updateMemberRole,
  updateMemberStatus,
} from '../controllers/team.controller.js';
import {
  authenticate,
  authorizePermissions,
  enforceViewerReadOnly,
} from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = Router();

// All team routes require an authenticated user
router.use(authenticate);

// Enforce viewer cannot perform mutation operations
router.use(enforceViewerReadOnly);

// GET /api/v1/team - List team members
router.get('/', authorizePermissions(PERMISSIONS.TEAM_VIEW), getTeamMembers);

// POST /api/v1/team/invite - Invite a team member
router.post('/invite', authorizePermissions(PERMISSIONS.TEAM_INVITE), inviteTeamMember);

// PATCH /api/v1/team/:userId/role - Change member role
router.patch('/:userId/role', authorizePermissions(PERMISSIONS.TEAM_UPDATE_ROLE), updateMemberRole);

// PATCH /api/v1/team/:userId/status - Change member status
router.patch('/:userId/status', authorizePermissions(PERMISSIONS.TEAM_DEACTIVATE), updateMemberStatus);

export default router;
