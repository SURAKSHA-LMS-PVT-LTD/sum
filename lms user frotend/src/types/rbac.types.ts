export type PermissionAction = 'view' | 'create' | 'update' | 'delete' | 'report';

// featureKey → array of granted actions
export type PermissionMatrix = Record<string, PermissionAction[]>;

export interface UserRbacContext {
  userTypeId: string;
  userTypeName: string;
  userTypeSlug: string;
  userTypeColor: string | null;
  permissions: PermissionMatrix;
  isSystemAdmin: boolean;
}

// Shape of a single feature-permission row (as returned by the permissions endpoint)
export interface FeaturePermission {
  featureKey: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canReport: boolean;
}
