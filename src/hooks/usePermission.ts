import { useAuth } from '../contexts/AuthContext';
import { resolvePermission, type ResolvedPermission } from '../utils/permissions';

interface PermissionContext {
  classId?: string;
  subjectId?: string;
}

export function usePermission(
  featureKey: string,
  _context?: PermissionContext
): ResolvedPermission {
  const { selectedInstitute } = useAuth();
  return resolvePermission(selectedInstitute?.permissions, featureKey);
}

export function usePermissions(featureKeys: string[]): Record<string, ResolvedPermission> {
  const { selectedInstitute } = useAuth();
  return Object.fromEntries(
    featureKeys.map(key => [key, resolvePermission(selectedInstitute?.permissions, key)])
  );
}

export function useIsAdmin(): boolean {
  const { selectedInstitute } = useAuth();
  return selectedInstitute?.userType?.baseRole === 'INSTITUTE_ADMIN';
}

export function useBaseRole(): string {
  const { selectedInstitute, isViewingAsParent } = useAuth();
  if (isViewingAsParent) return 'STUDENT';
  return selectedInstitute?.userType?.baseRole
    ?? selectedInstitute?.instituteUserType
    ?? '';
}
