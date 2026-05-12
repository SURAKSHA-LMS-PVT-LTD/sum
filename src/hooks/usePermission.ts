import { useMyRbacContext } from './useMyRbacContext';

type Action = 'view' | 'create' | 'update' | 'delete' | 'report';

interface PermissionResult {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canReport: boolean;
  loading: boolean;
}

export const usePermission = (featureKey: string): PermissionResult => {
  const { context, loading, can } = useMyRbacContext();

  if (loading || !context) {
    // While loading — show everything (avoids flicker of "no access")
    return { canView: true, canCreate: true, canUpdate: true, canDelete: true, canReport: true, loading: true };
  }

  return {
    canView:   can(featureKey, 'view'),
    canCreate: can(featureKey, 'create'),
    canUpdate: can(featureKey, 'update'),
    canDelete: can(featureKey, 'delete'),
    canReport: can(featureKey, 'report'),
    loading: false,
  };
};
