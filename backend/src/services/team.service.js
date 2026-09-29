import { userRepository } from '../repositories/user.repository.js';
import { canManageRole, ROLES, VALID_ROLES } from '../config/permissions.js';

export class TeamService {
  /**
   * Lists all team members within the agency
   * @param {string} agencyId
   */
  async listTeamMembers(agencyId) {
    if (!agencyId) throw new Error('agency_id is required');
    return userRepository.listTeamMembers(agencyId);
  }

  /**
   * Invites/creates a new team member with role-escalation checks
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string }} actor - Authenticated requesting user
   * @param {{ name: string, email: string, role: string, password?: string }} data
   */
  async inviteTeamMember(agencyId, actor, { name, email, role = 'viewer', password }) {
    if (!name || !email) {
      const error = new Error('Name and email are required to invite a team member.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    const targetRole = role.toLowerCase().trim();
    if (!VALID_ROLES.includes(targetRole)) {
      const error = new Error(`Invalid role "${role}". Valid roles: ${VALID_ROLES.join(', ')}`);
      error.code = 'INVALID_ROLE';
      error.status = 400;
      throw error;
    }

    // Role escalation check
    if (!canManageRole(actor.role, null, targetRole)) {
      const error = new Error(
        `Role escalation forbidden: An "${actor.role}" cannot assign the "${targetRole}" role.`
      );
      error.code = 'ROLE_ESCALATION_FORBIDDEN';
      error.status = 403;
      throw error;
    }

    // Check if email already exists within this agency
    const existing = await userRepository.findByEmail(agencyId, email);
    if (existing) {
      const error = new Error('A team member with this email address already exists in your agency.');
      error.code = 'USER_ALREADY_EXISTS';
      error.status = 409;
      throw error;
    }

    // Generate or use provided password
    const memberPassword = password || `Temp#${Math.random().toString(36).slice(-8)}A1!`;

    const user = await userRepository.create(agencyId, {
      name,
      email,
      password: memberPassword,
      role: targetRole,
      status: 'active',
    });

    return user;
  }

  /**
   * Updates a team member's role with escalation & final owner safeguards
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string }} actor
   * @param {string} targetUserId
   * @param {string} newRole
   */
  async updateMemberRole(agencyId, actor, targetUserId, newRole) {
    if (!newRole) {
      const error = new Error('New role is required.');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    const targetRole = newRole.toLowerCase().trim();
    if (!VALID_ROLES.includes(targetRole)) {
      const error = new Error(`Invalid role "${newRole}". Valid roles: ${VALID_ROLES.join(', ')}`);
      error.code = 'INVALID_ROLE';
      error.status = 400;
      throw error;
    }

    const targetUser = await userRepository.findById(agencyId, targetUserId);
    if (!targetUser) {
      const error = new Error('Team member not found.');
      error.code = 'USER_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    // Role escalation check
    if (!canManageRole(actor.role, targetUser.role, targetRole)) {
      const error = new Error(
        `Role escalation forbidden: An "${actor.role}" cannot change an "${targetUser.role}" to "${targetRole}".`
      );
      error.code = 'ROLE_ESCALATION_FORBIDDEN';
      error.status = 403;
      throw error;
    }

    // Final active owner protection
    if (targetUser.role === ROLES.OWNER && targetRole !== ROLES.OWNER) {
      const activeOwners = await userRepository.countActiveOwners(agencyId);
      if (activeOwners <= 1) {
        const error = new Error(
          'Cannot demote the final active owner. The agency must have at least one active owner.'
        );
        error.code = 'FINAL_OWNER_PROTECTION';
        error.status = 400;
        throw error;
      }
    }

    return userRepository.updateRole(agencyId, targetUserId, targetRole);
  }

  /**
   * Updates a team member's status (active/inactive) with final owner safeguards
   *
   * @param {string} agencyId
   * @param {{ id: string, role: string }} actor
   * @param {string} targetUserId
   * @param {string} newStatus ('active' | 'inactive')
   */
  async updateMemberStatus(agencyId, actor, targetUserId, newStatus) {
    const status = newStatus?.toLowerCase().trim();
    if (!['active', 'inactive'].includes(status)) {
      const error = new Error('Status must be either "active" or "inactive".');
      error.code = 'VALIDATION_ERROR';
      error.status = 400;
      throw error;
    }

    const targetUser = await userRepository.findById(agencyId, targetUserId);
    if (!targetUser) {
      const error = new Error('Team member not found.');
      error.code = 'USER_NOT_FOUND';
      error.status = 404;
      throw error;
    }

    // Prevent non-owners from modifying owner status
    if (!canManageRole(actor.role, targetUser.role)) {
      const error = new Error(
        `Forbidden: An "${actor.role}" cannot modify the status of an "${targetUser.role}".`
      );
      error.code = 'ROLE_ESCALATION_FORBIDDEN';
      error.status = 403;
      throw error;
    }

    // Final active owner protection: prevent deactivating the last active owner
    if (targetUser.role === ROLES.OWNER && status === 'inactive') {
      const activeOwners = await userRepository.countActiveOwners(agencyId);
      if (activeOwners <= 1) {
        const error = new Error(
          'Cannot deactivate the final active owner. The agency must maintain at least one active owner.'
        );
        error.code = 'FINAL_OWNER_PROTECTION';
        error.status = 400;
        throw error;
      }
    }

    return userRepository.updateStatus(agencyId, targetUserId, status);
  }
}

export const teamService = new TeamService();
