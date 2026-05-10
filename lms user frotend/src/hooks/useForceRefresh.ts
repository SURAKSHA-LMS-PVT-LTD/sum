import { useCallback } from 'react';

/**
 * Hook for force refresh - now a no-op since individual API calls
 * handle forceRefresh=true directly without needing global cache bypass.
 * Kept for backward compatibility.
 */
export const useForceRefresh = () => {
  const triggerForceRefresh = useCallback((_durationMs: number = 10000) => {
    // No-op: individual API calls pass forceRefresh=true directly
    console.log('🔄 Force refresh requested - individual API calls will bypass cache');
  }, []);

  return { triggerForceRefresh };
};
