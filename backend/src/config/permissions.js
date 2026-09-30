/**
 * Centralized Role-Based Access Control (RBAC) & Permission System
 *
 * Roles:
 * - owner: Full agency access, ownership management, and team governance.
 * - admin: Agency, client, and location management; team management without owner promotion.
 * - manager: Manage assigned clients, locations, and operational data.
 * - specialist: Operational GBP work for assigned clients and locations.
 * - viewer: Read-only access to agency portfolio and performance metrics.
 */

export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MANAGER: 'manager',
  SPECIALIST: 'specialist',
  VIEWER: 'viewer',
};

export const VALID_ROLES = Object.values(ROLES);

export const ROLE_HIERARCHY = {
  [ROLES.OWNER]: 100,
  [ROLES.ADMIN]: 80,
  [ROLES.MANAGER]: 60,
  [ROLES.SPECIALIST]: 40,
  [ROLES.VIEWER]: 20,
};

export const PERMISSIONS = {
  // Team Management
  TEAM_VIEW: 'team:view',
  TEAM_INVITE: 'team:invite',
  TEAM_UPDATE_ROLE: 'team:update_role',
  TEAM_DEACTIVATE: 'team:deactivate',

  // Agency Administration
  AGENCY_VIEW: 'agency:view',
  AGENCY_UPDATE: 'agency:update',
  AGENCY_DELETE: 'agency:delete',

  // Client Portfolio
  CLIENT_CREATE: 'client:create',
  CLIENT_VIEW: 'client:view',
  CLIENT_UPDATE: 'client:update',
  CLIENT_DELETE: 'client:delete',

  // Locations
  LOCATION_CREATE: 'location:create',
  LOCATION_VIEW: 'location:view',
  LOCATION_UPDATE: 'location:update',
  LOCATION_DELETE: 'location:delete',

  // Google Business Profile Operations
  GBP_MANAGE: 'gbp:manage',
  GBP_VIEW: 'gbp:view',

  // Customer Reviews & Feedback
  REVIEW_VIEW: 'review:view',
  REVIEW_UPDATE_STATUS: 'review:update_status',
  REVIEW_SYNC: 'review:sync',

  // Review Reply Management & AI
  REPLY_GENERATE_AI: 'reply:generate_ai',
  REPLY_EDIT_DRAFT: 'reply:edit_draft',
  REPLY_SUBMIT_APPROVAL: 'reply:submit_approval',
  REPLY_APPROVE: 'reply:approve',
  REPLY_PUBLISH: 'reply:publish',
  REPLY_DELETE: 'reply:delete',
};

export const ROLE_PERMISSIONS = {
  [ROLES.OWNER]: Object.values(PERMISSIONS),
  [ROLES.ADMIN]: [
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.TEAM_INVITE,
    PERMISSIONS.TEAM_UPDATE_ROLE,
    PERMISSIONS.TEAM_DEACTIVATE,
    PERMISSIONS.AGENCY_VIEW,
    PERMISSIONS.AGENCY_UPDATE,
    PERMISSIONS.CLIENT_CREATE,
    PERMISSIONS.CLIENT_VIEW,
    PERMISSIONS.CLIENT_UPDATE,
    PERMISSIONS.CLIENT_DELETE,
    PERMISSIONS.LOCATION_CREATE,
    PERMISSIONS.LOCATION_VIEW,
    PERMISSIONS.LOCATION_UPDATE,
    PERMISSIONS.LOCATION_DELETE,
    PERMISSIONS.GBP_MANAGE,
    PERMISSIONS.GBP_VIEW,
    PERMISSIONS.REVIEW_VIEW,
    PERMISSIONS.REVIEW_UPDATE_STATUS,
    PERMISSIONS.REVIEW_SYNC,
    PERMISSIONS.REPLY_GENERATE_AI,
    PERMISSIONS.REPLY_EDIT_DRAFT,
    PERMISSIONS.REPLY_SUBMIT_APPROVAL,
    PERMISSIONS.REPLY_APPROVE,
    PERMISSIONS.REPLY_PUBLISH,
    PERMISSIONS.REPLY_DELETE,
  ],
  [ROLES.MANAGER]: [
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.AGENCY_VIEW,
    PERMISSIONS.CLIENT_VIEW,
    PERMISSIONS.CLIENT_UPDATE,
    PERMISSIONS.LOCATION_CREATE,
    PERMISSIONS.LOCATION_VIEW,
    PERMISSIONS.LOCATION_UPDATE,
    PERMISSIONS.GBP_MANAGE,
    PERMISSIONS.GBP_VIEW,
    PERMISSIONS.REVIEW_VIEW,
    PERMISSIONS.REVIEW_UPDATE_STATUS,
    PERMISSIONS.REVIEW_SYNC,
    PERMISSIONS.REPLY_GENERATE_AI,
    PERMISSIONS.REPLY_EDIT_DRAFT,
    PERMISSIONS.REPLY_SUBMIT_APPROVAL,
    PERMISSIONS.REPLY_APPROVE,
    PERMISSIONS.REPLY_PUBLISH,
    PERMISSIONS.REPLY_DELETE,
  ],
  [ROLES.SPECIALIST]: [
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.AGENCY_VIEW,
    PERMISSIONS.CLIENT_VIEW,
    PERMISSIONS.LOCATION_VIEW,
    PERMISSIONS.LOCATION_UPDATE,
    PERMISSIONS.GBP_MANAGE,
    PERMISSIONS.GBP_VIEW,
    PERMISSIONS.REVIEW_VIEW,
    PERMISSIONS.REVIEW_UPDATE_STATUS,
    PERMISSIONS.REVIEW_SYNC,
    PERMISSIONS.REPLY_GENERATE_AI,
    PERMISSIONS.REPLY_EDIT_DRAFT,
    PERMISSIONS.REPLY_SUBMIT_APPROVAL,
    PERMISSIONS.REPLY_PUBLISH,
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.TEAM_VIEW,
    PERMISSIONS.AGENCY_VIEW,
    PERMISSIONS.CLIENT_VIEW,
    PERMISSIONS.LOCATION_VIEW,
    PERMISSIONS.GBP_VIEW,
    PERMISSIONS.REVIEW_VIEW,
  ],
};

/**
 * Checks if a given role has a specific permission
 * @param {string} role
 * @param {string} permission
 * @returns {boolean}
 */
export function hasPermission(role, permission) {
  if (!role || !permission) return false;
  const permissions = ROLE_PERMISSIONS[role.toLowerCase()] || [];
  return permissions.includes(permission);
}

/**
 * Checks if actor can manage target role without unauthorized privilege escalation
 *
 * Rules:
 * - Only an active owner can assign or modify the 'owner' role.
 * - An admin cannot create, modify, or deactivate an owner.
 * - An admin cannot promote anyone to owner.
 * - Managers, specialists, and viewers have no role management privileges.
 *
 * @param {string} actorRole - Role of the requesting user
 * @param {string} targetCurrentRole - Current role of target user (null if new user)
 * @param {string} [targetNewRole] - Target role being assigned
 * @returns {boolean}
 */
export function canManageRole(actorRole, targetCurrentRole, targetNewRole = null) {
  const actorWeight = ROLE_HIERARCHY[actorRole?.toLowerCase()] || 0;
  const targetCurrentWeight = targetCurrentRole
    ? ROLE_HIERARCHY[targetCurrentRole.toLowerCase()] || 0
    : 0;
  const targetNewWeight = targetNewRole
    ? ROLE_HIERARCHY[targetNewRole.toLowerCase()] || 0
    : 0;

  // Non-owner and non-admin cannot perform any team management
  if (actorWeight < ROLE_HIERARCHY[ROLES.ADMIN]) {
    return false;
  }

  // If actor is owner, they can manage all roles
  if (actorRole === ROLES.OWNER) {
    return true;
  }

  // If actor is admin:
  if (actorRole === ROLES.ADMIN) {
    // Admin cannot modify or deactivate an owner
    if (targetCurrentRole === ROLES.OWNER) {
      return false;
    }
    // Admin cannot promote someone to owner
    if (targetNewRole === ROLES.OWNER) {
      return false;
    }
    // Admin can manage roles up to admin
    return (
      targetCurrentWeight <= ROLE_HIERARCHY[ROLES.ADMIN] &&
      targetNewWeight <= ROLE_HIERARCHY[ROLES.ADMIN]
    );
  }

  return false;
}
