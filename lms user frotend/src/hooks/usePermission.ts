import { useMyRbacContext } from './useMyRbacContext';

const usePermission = (featureKey: string) => {
  const { can, loading } = useMyRbacContext();

  return {
    loading,
    canView: can(featureKey, 'view'),
    canCreate: can(featureKey, 'create'),
    canUpdate: can(featureKey, 'update'),
    canDelete: can(featureKey, 'delete'),
    canReport: can(featureKey, 'report'),
  };
};

export { usePermission };
