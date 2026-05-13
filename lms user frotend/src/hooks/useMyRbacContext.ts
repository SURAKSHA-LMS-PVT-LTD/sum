import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { instituteApi } from '@/api/institute.api';
import { PermissionMatrix, PermissionAction } from '@/types/rbac.types';

interface RbacContext {
  userTypeId: string;
  userTypeName: string;
  userTypeSlug: string;
  userTypeColor: string | null;
  permissions: PermissionMatrix;
  isSystemAdmin: boolean;
}

// Module-level cache so data survives re-renders and component unmounts.
// Key = instituteId, value = { context, fetchedAt }
const contextCache = new Map<string, { context: RbacContext; fetchedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const EMPTY_CONTEXT: RbacContext = {
  userTypeId: '',
  userTypeName: '',
  userTypeSlug: '',
  userTypeColor: null,
  permissions: {},
  isSystemAdmin: false,
};

const useMyRbacContext = () => {
  const { selectedInstitute, isLoading: authLoading } = useAuth();
  const instituteId = selectedInstitute?.id;

  const [context, setContext] = useState<RbacContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const fetchContext = useCallback(async (force = false) => {
    if (!instituteId) {
      setContext(null);
      setLoading(false);
      return;
    }

    // Return from cache if still fresh and not forced
    const cached = contextCache.get(instituteId);
    if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      setContext(cached.context);
      setLoading(false);
      return;
    }

    // Deduplicate concurrent fetches
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const data: RbacContext = await instituteApi.getMyContext(instituteId);

      // Normalise: backend may return permissions as Record<key, string[]>
      // or Record<key, {canView, canCreate, ...}>
      const normalized: PermissionMatrix = {};
      if (data?.permissions) {
        for (const [key, val] of Object.entries(data.permissions)) {
          if (Array.isArray(val)) {
            normalized[key] = val as PermissionAction[];
          } else if (val && typeof val === 'object') {
            const actions: PermissionAction[] = [];
            if ((val as any).canView)   actions.push('view');
            if ((val as any).canCreate) actions.push('create');
            if ((val as any).canUpdate) actions.push('update');
            if ((val as any).canDelete) actions.push('delete');
            if ((val as any).canReport) actions.push('report');
            normalized[key] = actions;
          }
        }
      }

      const ctx: RbacContext = { ...EMPTY_CONTEXT, ...data, permissions: normalized };
      contextCache.set(instituteId, { context: ctx, fetchedAt: Date.now() });
      setContext(ctx);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load permissions');
      // On error fall back to empty context so UI still renders
      setContext(EMPTY_CONTEXT);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [instituteId]);

  useEffect(() => {
    if (!authLoading) {
      fetchContext();
    }
  }, [authLoading, fetchContext]);

  // Invalidate cache on explicit refetch
  const refetch = useCallback(() => {
    if (instituteId) contextCache.delete(instituteId);
    fetchContext(true);
  }, [instituteId, fetchContext]);

  const can = useCallback((featureKey: string, action: PermissionAction): boolean => {
    if (context?.isSystemAdmin) return true;
    if (!context?.permissions) return false;
    const allowed = context.permissions[featureKey];
    if (!allowed) return false;
    return allowed.includes(action);
  }, [context]);

  return { context, loading, error, can, refetch };
};

export { useMyRbacContext };
