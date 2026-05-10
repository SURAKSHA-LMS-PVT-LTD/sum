import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

type UserRole =
  | 'SuperAdmin'
  | 'InstituteAdmin'
  | 'Teacher'
  | 'Student'
  | 'Parent'
  | 'Driver'
  | 'Staff';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireInstitute?: boolean;
  requireClass?: boolean;
  requireSubject?: boolean;
  requireChild?: boolean;
  requireOrganization?: boolean;
  requireTransport?: boolean;
  customValidation?: () => boolean;
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  requireInstitute = false,
  requireClass = false,
  requireSubject = false,
  requireChild = false,
  requireOrganization = false,
  requireTransport = false,
  customValidation,
  redirectTo = '/',
}) => {
  const {
    user,
    selectedInstitute,
    selectedClass,
    selectedSubject,
    selectedChild,
    selectedOrganization,
    selectedTransport,
    isLoading,
    isInitialized,
  } = useAuth();

  const location = useLocation();
  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    const validateAccess = () => {
      if (!isInitialized) {
        setIsValidating(true);
        return;
      }

      // Check 1: User authentication
      if (!user) {
        setValidationError('User not authenticated');
        setIsValidating(false);
        return;
      }

      // Check 2: Role-based access control
      if (allowedRoles && allowedRoles.length > 0) {
        const userRole = user.role as UserRole;
        if (!allowedRoles.includes(userRole)) {
          setValidationError(`Insufficient permissions. Required: ${allowedRoles.join(', ')}`);
          setIsValidating(false);
          return;
        }
      }

      // Check 3: Institute requirement
      if (requireInstitute && !selectedInstitute) {
        setValidationError('Institute selection required');
        setIsValidating(false);
        return;
      }

      // Check 4: Class requirement
      if (requireClass && !selectedClass) {
        setValidationError('Class selection required');
        setIsValidating(false);
        return;
      }

      // Check 5: Subject requirement
      if (requireSubject && !selectedSubject) {
        setValidationError('Subject selection required');
        setIsValidating(false);
        return;
      }

      // Check 6: Child requirement (for parent routes)
      if (requireChild && !selectedChild) {
        setValidationError('Child selection required');
        setIsValidating(false);
        return;
      }

      // Check 7: Organization requirement
      if (requireOrganization && !selectedOrganization) {
        setValidationError('Organization selection required');
        setIsValidating(false);
        return;
      }

      // Check 8: Transport requirement
      if (requireTransport && !selectedTransport) {
        setValidationError('Transport selection required');
        setIsValidating(false);
        return;
      }

      // Check 9: Custom validation
      if (customValidation && !customValidation()) {
        setValidationError('Custom validation failed');
        setIsValidating(false);
        return;
      }

      setValidationError(null);
      setIsValidating(false);
    };

    validateAccess();
  }, [
    isInitialized,
    user,
    selectedInstitute,
    selectedClass,
    selectedSubject,
    selectedChild,
    selectedOrganization,
    selectedTransport,
    location.pathname,
    allowedRoles,
    requireInstitute,
    requireClass,
    requireSubject,
    requireChild,
    requireOrganization,
    requireTransport,
    customValidation,
  ]);

  // Fast-path: auth initialized, no user → redirect immediately
  if (isInitialized && !isLoading && !user) {
    const fullPath = location.pathname + location.search + location.hash;
    return (
      <Navigate
        to={redirectTo}
        state={{ from: fullPath, error: 'User not authenticated' }}
        replace
      />
    );
  }

  if (isLoading || isValidating) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Validating access...</p>
        </div>
      </div>
    );
  }

  if (validationError) {
    const fullPath = location.pathname + location.search + location.hash;
    return (
      <Navigate
        to={redirectTo}
        state={{ from: fullPath, error: validationError }}
        replace
      />
    );
  }

  return <>{children}</>;
};

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute allowedRoles={['SuperAdmin', 'InstituteAdmin']} requireInstitute={true}>
    {children}
  </ProtectedRoute>
);

export const TeacherRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute
    allowedRoles={['Teacher', 'InstituteAdmin', 'SuperAdmin']}
    requireInstitute={true}
    requireClass={true}
  >
    {children}
  </ProtectedRoute>
);

export const StudentRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute allowedRoles={['Student']} requireInstitute={true} requireClass={true}>
    {children}
  </ProtectedRoute>
);

export const ParentRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute allowedRoles={['Parent']} requireChild={true}>
    {children}
  </ProtectedRoute>
);

export const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute allowedRoles={['SuperAdmin']}>{children}</ProtectedRoute>
);

export const InstituteRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requireInstitute={true}>{children}</ProtectedRoute>
);

export const ClassRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requireInstitute={true} requireClass={true}>
    {children}
  </ProtectedRoute>
);

export const SubjectRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute requireInstitute={true} requireClass={true} requireSubject={true}>
    {children}
  </ProtectedRoute>
);

export default ProtectedRoute;
