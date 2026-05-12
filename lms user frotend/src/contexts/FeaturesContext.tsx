
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { cachedApiClient } from '@/api/cachedClient';
import { useAuth } from './AuthContext';

interface Feature {
  enabled: boolean;
  scope: 'institute' | 'class' | 'subject';
  pricing: 'free' | 'paid';
  billingCycle?: 'monthly' | 'yearly';
}

export interface FeaturesContextValue {
  features: Record<string, Feature>;
  loading: boolean;
  isFeatureEnabled: (key: string) => boolean;
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
    if (loading) return true; // show while loading
    const feature = features[key];
    if (feature === undefined) return true; // no toggle = enabled by default
    return !!feature.enabled;
  }, [features, loading]);

  const value = useMemo(() => ({
    features,
    loading,
    isFeatureEnabled,
    refetchFeatures,
  }), [features, loading, isFeatureEnabled, refetchFeatures]);

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
