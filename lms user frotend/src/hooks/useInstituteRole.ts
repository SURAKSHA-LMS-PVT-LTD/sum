import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/utils/permissions';

/**
 * CRITICAL: Hook that ALWAYS returns the institute-specific role
 * This ensures all components use instituteUserType, not login userType
 * 
 * Usage: Replace all instances of user?.role with this hook
 */
export const useInstituteRole = (): UserRole => {
  const { user, selectedInstitute, selectedOrganization, isViewingAsParent } = useAuth();

  return useMemo(() => {
    if (isViewingAsParent) {
      return 'Student';
    }

    const instituteUserType = selectedInstitute?.instituteUserType || selectedInstitute?.userRole;
    if (instituteUserType) {
      return mapInstituteUserType(instituteUserType);
    }

    if (selectedOrganization?.userRole) {
      return 'OrganizationManager';
    }

    return (user?.role || 'Student') as UserRole;
  }, [isViewingAsParent, selectedInstitute?.instituteUserType, selectedInstitute?.userRole, selectedOrganization?.userRole, user?.role]);
};

/**
 * Map instituteUserType from API to application UserRole
 */
function mapInstituteUserType(instituteUserType: string): UserRole {
  switch (instituteUserType) {
    case 'INSTITUTE_ADMIN':
      return 'InstituteAdmin';
    case 'STUDENT':
      return 'Student';
    case 'TEACHER':
      return 'Teacher';
    case 'ATTENDANCE_MARKER':
      return 'AttendanceMarker';
    case 'PARENT':
      return 'Parent';
    case 'ORGANIZATION_MANAGER':
      return 'OrganizationManager';
    case 'SYSTEM_ADMIN':
      return 'InstituteAdmin'; // SystemAdmin gets full admin access at institute level
    default:
      console.warn('⚠️ Unknown instituteUserType:', instituteUserType);
      return 'Student';
  }
}
