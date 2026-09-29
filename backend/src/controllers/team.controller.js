import { teamService } from '../services/team.service.js';

/**
 * Lists all team members within the tenant agency
 * GET /api/v1/team
 */
export async function getTeamMembers(req, res, next) {
  try {
    const members = await teamService.listTeamMembers(req.tenant.agencyId);
    res.status(200).json({
      success: true,
      data: members,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Invites a new team member
 * POST /api/v1/team/invite
 */
export async function inviteTeamMember(req, res, next) {
  try {
    const { name, email, role, password } = req.body;
    const user = await teamService.inviteTeamMember(req.tenant.agencyId, req.user, {
      name,
      email,
      role,
      password,
    });

    res.status(201).json({
      success: true,
      data: user,
      message: `Team member ${user.name} invited successfully with role ${user.role}.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates a team member's role
 * PATCH /api/v1/team/:userId/role
 */
export async function updateMemberRole(req, res, next) {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const updated = await teamService.updateMemberRole(
      req.tenant.agencyId,
      req.user,
      userId,
      role
    );

    res.status(200).json({
      success: true,
      data: updated,
      message: `Role updated to ${updated.role} successfully.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates a team member's active/inactive status
 * PATCH /api/v1/team/:userId/status
 */
export async function updateMemberStatus(req, res, next) {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    const updated = await teamService.updateMemberStatus(
      req.tenant.agencyId,
      req.user,
      userId,
      status
    );

    res.status(200).json({
      success: true,
      data: updated,
      message: `Member status updated to ${updated.status} successfully.`,
    });
  } catch (error) {
    next(error);
  }
}
