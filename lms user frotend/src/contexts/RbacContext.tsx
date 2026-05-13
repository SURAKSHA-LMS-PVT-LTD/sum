import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { instituteApi } from '@/api/institute.api';
import { PermissionMatrix, PermissionAction } from '@/types/rbac.types';

interface RbacContextValue {
  userTypeId: string;
  userTypeName: string;
  userTypeSlug: string;
  userTypeColor: string | null;
  permissions: PermissionMatrix;
  isSystemAdmin: boolean;
}

interface RbacProviderValue {
  context: RbacContextValue | null;
  loading: boolean;
  error: string | null;
  can: (featureKey: string, action: PermissionAction) => boolean;
  refetch: () => void;
}

const EMPTY_CONTEXT: RbacContextValue = {
  userTypeId: '',
  userTypeName: '',
  userTypeSlug: '',
  userTypeColor: null,
  permissions: {},
  isSystemAdmin: false,
};

const RbacCtx = createContext<RbacProviderValue | undefined>(undefined);

export const RbacProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { selectedInstitute, isLoading: authLoading } = useAuth();
  const instituteId = selectedInstitute?.id;

  const [context, setContext] = useState<RbacContextValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);
  const cachedInstituteRef = useRef<string | undefined>(undefined);

  const fetchContext = useCallback(async (force = false) => {
    if (!instituteId) {
      setContext(null);
      setLoading(false);
      return;
    }

    // Skip if same institute and not forced
    if (!force && cachedInstituteRef.current === instituteId && context !== null) {
      setLoading(false);
      return;
    }

    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const data = await instituteApi.getMyContext(instituteId);

      // Normalize permissions: backend may return string[] or {canView,canCreate,...}
      const normalized: PermissionMatrix = {};
      if (data?.permissions) {
        for (const [key, val] of Object.entries(data.permissions as Record<string, any>)) {
          if (Array.isArray(val)) {
            normalized[key] = val as PermissionAction[];
          } else if (val && typeof val === 'object') {
            const actions: PermissionAction[] = [];
            if (val.canView)   actions.push('view');
            if (val.canCreate) actions.push('create');
            if (val.canUpdate) actions.push('update');
            if (val.canDelete) actions.push('delete');
            if (val.canReport) actions.push('report');
            if (val.canSubmit) actions.push('submit');
            normalized[key] = actions;
          }
        }
      }

      const ctx: RbacContextValue = { ...EMPTY_CONTEXT, ...data, permissions: normalized };
      cachedInstituteRef.current = instituteId;
      setContext(ctx);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load permissions');
      setContext(EMPTY_CONTEXT);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [instituteId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authLoading) {
      fetchContext();
    }
  }, [authLoading, fetchContext]);

  const refetch = useCallback(() => {
    cachedInstituteRef.current = undefined;
    fetchContext(true);
  }, [fetchContext]);

  const can = useCallback((featureKey: string, action: PermissionAction): boolean => {
    if (context?.isSystemAdmin) return true;
    if (!context?.permissions) return false;
    const allowed = context.permissions[featureKey];
    if (!allowed) return false;
    return allowed.includes(action);
  }, [context]);

  return (
    <RbacCtx.Provider value={{ context, loading, error, can, refetch }}>
      {children}
    </RbacCtx.Provider>
  );
};

export const useRbac = (): RbacProviderValue => {
  const ctx = useContext(RbacCtx);
  if (!ctx) throw new Error('useRbac must be used within RbacProvider');
  return ctx;
};
