import { SetMetadata } from '@nestjs/common';

export type PermissionAction = 'view' | 'create' | 'update' | 'delete' | 'report';

export interface PermissionRequirement {
  feature: string;
  action: PermissionAction;
}

export const PERMISSION_KEY = 'required_permission';

export const RequirePermission = (feature: string, action: PermissionAction) =>
  SetMetadata(PERMISSION_KEY, { feature, action } as PermissionRequirement);
