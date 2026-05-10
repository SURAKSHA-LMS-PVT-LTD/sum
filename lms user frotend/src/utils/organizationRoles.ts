export type OrganizationRole = 'PRESIDENT' | 'ADMIN' | 'MODERATOR' | 'MEMBER';

// Role hierarchy (higher number = higher authority)
const ROLE_HIERARCHY: Record<OrganizationRole, number> = {
  PRESIDENT: 4,
  ADMIN: 3,
  MODERATOR: 2,
  MEMBER: 1,
};

export class OrganizationRoleManager {
  /**
   * Check if user can manage (assign/remove roles) for a target member
   * PRESIDENT and ADMIN can manage Organization Manager
   * Organization Manager can manage PRESIDENT, ADMIN, MODERATOR, MEMBER
   */
  static canManageUser(
    currentUserRole: OrganizationRole | string,
    currentUserSystemRole: string,
    targetMemberRole: OrganizationRole
  ): boolean {
    // Organization Manager can manage all organization roles
    if (currentUserSystemRole === 'OrganizationManager') {
      return true;
    }

    // Convert string to OrganizationRole if needed
    const userOrgRole = currentUserRole as OrganizationRole;
    
    // Check if user has higher or equal authority
    const userLevel = ROLE_HIERARCHY[userOrgRole] || 0;
    const targetLevel = ROLE_HIERARCHY[targetMemberRole] || 0;
    
    return userLevel >= targetLevel;
  }

  /**
   * Check if user can remove a member
   * PRESIDENT and ADMIN can remove Organization Manager
   * Organization Manager can remove PRESIDENT, ADMIN, MODERATOR, MEMBER
   */
  static canRemoveUser(
    currentUserRole: OrganizationRole | string,
    currentUserSystemRole: string,
    targetMemberRole: OrganizationRole,
    currentUserId: string,
    targetUserId: string
  ): boolean {
    // Can't remove yourself
    if (currentUserId === targetUserId) {
      return false;
    }

    // Can't remove the current PRESIDENT (presidency must be transferred first)
    if (targetMemberRole === 'PRESIDENT') {
      return false;
    }

    return this.canManageUser(currentUserRole, currentUserSystemRole, targetMemberRole);
  }

  /**
   * Get available roles that a user can assign
   */
  static getAssignableRoles(
    currentUserRole: OrganizationRole | string,
    currentUserSystemRole: string
  ): OrganizationRole[] {
    // Organization Manager can assign all roles
    if (currentUserSystemRole === 'OrganizationManager') {
      return ['PRESIDENT', 'ADMIN', 'MODERATOR', 'MEMBER'];
    }

    const userOrgRole = currentUserRole as OrganizationRole;
    const userLevel = ROLE_HIERARCHY[userOrgRole] || 0;
    
    // Can assign roles at or below their level
    return Object.entries(ROLE_HIERARCHY)
      .filter(([_, level]) => level <= userLevel)
      .map(([role, _]) => role as OrganizationRole);
  }

  /**
   * Check if user can assign a specific role
   */
  static canAssignRole(
    currentUserRole: OrganizationRole | string,
    currentUserSystemRole: string,
    targetRole: OrganizationRole
  ): boolean {
    const assignableRoles = this.getAssignableRoles(currentUserRole, currentUserSystemRole);
    return assignableRoles.includes(targetRole);
  }
}