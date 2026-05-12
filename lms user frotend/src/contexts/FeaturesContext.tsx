
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
  refetchFeatures: () => void;
}

const FeaturesContext = createContext<FeaturesContextValue | undefined>(undefined);

export const FeaturesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { selectedInstitute } = useAuth();
  const instituteId = selectedInstitute?.id;

  const [features, setFeatures] = useState<Record<string, Feature>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchFeatures = useCallback(async () => {
    if (!instituteId) {
      setFeatures({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // The backend plan specifies this endpoint
      const response = await cachedApiClient.get<{ features: Record<string, Feature> }>(
        `/institutes/${instituteId}/features`,
        {},
        { 
          ttl: 300, // 5 minutes as per plan
          cacheKey: `institute-features-${instituteId}`,
          useStaleWhileRevalidate: true 
        }
      );
      setFeatures(response.features || {});
    } catch (err: any) {
      setError(err);
      console.error('Failed to fetch institute features:', err);
      setFeatures({}); // Fallback to no features on error
    } finally {
      setLoading(false);
    }
  }, [instituteId]);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const refetchFeatures = useCallback(() => {
    if (instituteId) {
        // Assuming invalidateCache exists on cachedApiClient.
        // If not, this will need to be implemented.
        // cachedApiClient.invalidateCache(`institute-features-${instituteId}`);
    }
    fetchFeatures();
  }, [instituteId, fetchFeatures]);

  const isFeatureEnabled = useCallback((key: string): boolean => {
    const feature = features[key];
    return !!feature?.enabled;
  }, [features]);

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
