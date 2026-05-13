export type PermissionAction = 'view' | 'create' | 'update' | 'delete' | 'report';

export type PermissionMatrix = {
  [featureKey: string]: PermissionAction[];
};
