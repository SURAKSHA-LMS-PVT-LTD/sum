export type PermAction = 'view' | 'create' | 'update' | 'delete' | 'report';

export interface ResolvedPermission {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canReport: boolean;
  enabled: boolean;
}

export function resolvePermission(
  permissions: Record<string, ResolvedPermission> | undefined,
  featureKey: string,
): ResolvedPermission {
  if (!permissions) {
    return { canView: true, canCreate: true, canUpdate: true, canDelete: true, canReport: true, enabled: true };
  }
  return permissions[featureKey] ?? {
    canView: true, canCreate: false, canUpdate: false, canDelete: false, canReport: false, enabled: true
  };
}

export class AccessControl {
  static hasPermission(
    userRole: string | { toString(): string },
    permission: string,
    dynamicPerms?: Record<string, ResolvedPermission>
  ): boolean {
    return true;
  }
}
