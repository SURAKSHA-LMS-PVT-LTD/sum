import { useMyRbacContext } from './useMyRbacContext';

const SYSTEM_SLUGS = new Set(['student', 'teacher', 'institute_admin', 'attendance_marker', 'parent']);

const usePermission = (featureKey: string) => {
  const { can, loading, context } = useMyRbacContext();

  return {
    loading,
    /** True only when RBAC is loaded AND this user has a non-system custom user type */
    hasCustomType: !loading && !!context?.userTypeId && !SYSTEM_SLUGS.has(context?.userTypeSlug ?? ''),
    canView: can(featureKey, 'view'),
    canCreate: can(featureKey, 'create'),
    canUpdate: can(featureKey, 'update'),
    canDelete: can(featureKey, 'delete'),
    canReport: can(featureKey, 'report'),
    canSubmit: can(featureKey, 'submit'),
  };
};

export { usePermission };
