import { useState, useEffect, useCallback } from 'react';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { useAuth } from '@/contexts/AuthContext';
import { UserRbacContext, PermissionMatrix } from '@/types/rbac.types';

interface UseMyRbacContextResult {
  context: UserRbacContext | null;
  loading: boolean;
  refetch: () => Promise<void>;
  can: (featureKey: string, action: 'view' | 'create' | 'update' | 'delete' | 'report') => boolean;
}

const ACTION_MAP = {
  view:   'canView',
  create: 'canCreate',
  update: 'canUpdate',
  delete: 'canDelete',
  report: 'canReport',
} as const;

export const useMyRbacContext = (): UseMyRbacContextResult => {
  const { selectedInstitute } = useAuth();
  const instituteId = selectedInstitute?.id;

  const [context, setContext] = useState<UserRbacContext | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (force = false) => {
    if (!instituteId) { setContext(null); return; }
    setLoading(true);
    try {
      const res = await enhancedCachedClient.get<UserRbacContext>(
        `/institutes/${instituteId}/my-context`,
        {},
        { ttl: 300, forceRefresh: force },
      );
      setContext(res);
    } catch {
      setContext(null);
    } finally {
      setLoading(false);
    }
  }, [instituteId]);

  useEffect(() => { fetch(); }, [fetch]);

  const can = useCallback(
    (featureKey: string, action: keyof typeof ACTION_MAP): boolean => {
      if (!context || loading) return true; // permissive while loading
      const row = context.permissions[featureKey];
      if (!row) return false;               // no explicit permission = deny
      return !!row[ACTION_MAP[action]];
    },
    [context, loading],
  );

  return {
    context,
    loading,
    refetch: () => fetch(true),
    can,
  };
};
