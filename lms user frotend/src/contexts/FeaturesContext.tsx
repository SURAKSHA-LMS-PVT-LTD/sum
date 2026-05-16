
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { cachedApiClient } from '@/api/cachedClient';
import { useAuth } from './AuthContext';

interface Feature {
  enabled: boolean;
  scope: string; // may be 'institute'|'class'|'subject' (lowercase) or 'INSTITUTE'|'CLASS'|'SUBJECT' (uppercase from API)
  pricing: string;
  billingCycle?: string;
}

export type FeatureScope = 'institute' | 'class' | 'subject';

export interface FeaturesContextValue {
  features: Record<string, Feature>;
  loading: boolean;
  /** Basic check — feature is enabled regardless of scope context */
  isFeatureEnabled: (key: string) => boolean;
  /**
   * Scope-aware check for the sidebar.
   * Each feature's scope controls at which nav level the toggle takes effect:
   * - 'institute' scope: toggle hides item only at institute level
   * - 'class' scope: toggle hides item only when inside a class
   * - 'subject' scope: toggle hides item only when inside a subject
   * Pass the current navigation context (which level the user is at).
   */
  isFeatureEnabledForScope: (key: string, navScope: FeatureScope) => boolean;
  refetchFeatures: () => Promise<void>;
}

const FeaturesContext = createContext<FeaturesContextValue | undefined>(undefined);

export const FeaturesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { selectedInstitute } = useAuth();
  const instituteId = selectedInstitute?.id;

  const [features, setFeatures] = useState<Record<string, Feature>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchFeatures = useCallback(async (forceRefresh = false) => {
    if (!instituteId) {
      setFeatures({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await cachedApiClient.get<{ features: Record<string, Feature> }>(
        `/institutes/${instituteId}/features`,
        {},
        { ttl: 300, forceRefresh, useStaleWhileRevalidate: !forceRefresh }
      );
      setFeatures(response.features || {});
    } catch (err: any) {
      setError(err);
      console.error('Failed to fetch institute features:', err);
      setFeatures({});
    } finally {
      setLoading(false);
    }
  }, [instituteId]);

  useEffect(() => {
    fetchFeatures(false);
  }, [fetchFeatures]);

  const refetchFeatures = useCallback((): Promise<void> => {
    return fetchFeatures(true); // force bypass cache, returns promise
  }, [fetchFeatures]);

  const isFeatureEnabled = useCallback((key: string): boolean => {
    if (loading) return true;
    const feature = features[key];
    if (feature === undefined) return true;
    return !!feature.enabled;
  }, [features, loading]);

  /**
   * Scope-aware check: each feature's `scope` field defines at which navigation
   * level the toggle takes effect.
   *
   * - 'institute' scope → toggle only hides the item when user is at institute level (no class/subject selected)
   * - 'class' scope     → toggle only hides the item when user is navigating inside a class
   * - 'subject' scope   → toggle only hides the item when user is navigating inside a subject
   *
   * This means disabling an institute-scope feature does NOT affect class/subject-level nav,
   * and disabling a class-scope feature does NOT affect institute or subject-level nav.
   *
   * navScope: the current navigation context ('institute' | 'class' | 'subject')
   */
  const isFeatureEnabledForScope = useCallback((key: string, navScope: FeatureScope): boolean => {
    if (loading) return true;
    const feature = features[key];
    if (feature === undefined) return true;
    if (feature.enabled) return true;

    // Feature is disabled — only hide it if the feature's scope matches the current nav context.
    // Normalize to lowercase to handle API returning uppercase ('CLASS', 'SUBJECT', 'INSTITUTE').
    const featureScope = feature.scope.toLowerCase();
    return featureScope !== navScope;
  }, [features, loading]);

  const value = useMemo(() => ({
    features,
    loading,
    isFeatureEnabled,
    isFeatureEnabledForScope,
    refetchFeatures,
  }), [features, loading, isFeatureEnabled, isFeatureEnabledForScope, refetchFeatures]);

  return (
    <FeaturesContext.Provider value={value}>
      {children}
    </FeaturesContext.Provider>
  );
};

export const useFeatures = (): FeaturesContextValue => {
  const context = useContext(FeaturesContext);
  if (!context) {
    throw new Error('useFeatures must be used within a FeaturesProvider');
  }
  return context;
};
