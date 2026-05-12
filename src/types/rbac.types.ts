export interface UserType {
  id: string;
  instituteId: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  icon?: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionRow {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canReport: boolean;
}

export interface PermissionMatrix {
  [featureKey: string]: PermissionRow;
}

export interface UserRbacContext {
  userTypeId: string | null;
  userTypeName: string | null;
  userTypeSlug: string | null;
  userTypeColor: string | null;
  userTypeIcon: string | null;
  permissions: PermissionMatrix;
  legacyUserType: string | null;   // old enum value — read only for backward compat
}
