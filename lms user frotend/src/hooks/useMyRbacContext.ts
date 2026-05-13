import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { institutesApi } from '@/api/institutes.api';
import { PermissionMatrix, PermissionAction } from '@/types/rbac.types';

interface RbacContext {
  userTypeId: string;
  userTypeName: string;
  userTypeSlug: string;
  userTypeColor: string | null;
  permissions: PermissionMatrix;
  isSystemAdmin: boolean;
}

const useMyRbacContext = () => {
  const { selectedInstitute, isLoading: authLoading } = useAuth();
  const [context, setContext] = useState<RbacContext | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchContext = useCallback(async () => {
    if (!selectedInstitute?.id) return;
    setLoading(true);
    try {
      const data = await institutesApi.getMyContext(selectedInstitute.id);
      setContext(data);
    } catch (error) {
      console.error("Failed to fetch RBAC context:", error);
      setContext(null);
    } finally {
      setLoading(false);
    }
  }, [selectedInstitute?.id]);

  useEffect(() => {
    if (!authLoading) {
      fetchContext();
    }
  }, [authLoading, fetchContext]);

  const can = useCallback((featureKey: string, action: PermissionAction): boolean => {
    if (context?.isSystemAdmin) return true;
    if (!context || !context.permissions) return false;
    const featurePermissions = context.permissions[featureKey];
    if (!featurePermissions) return false;
    return featurePermissions.includes(action);
  }, [context]);

  return { context, loading, can, refetch: fetchContext };
};

export { useMyRbacContext };
