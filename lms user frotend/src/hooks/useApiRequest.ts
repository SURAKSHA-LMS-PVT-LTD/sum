
import { useState, useCallback, useRef } from 'react';

interface UseApiRequestOptions {
  preventDuplicates?: boolean;
  showLoading?: boolean;
}

export const useApiRequest = <T extends any[], R>(
  apiFunction: (...args: T) => Promise<R>,
  options: UseApiRequestOptions = {}
) => {
  const { preventDuplicates = true, showLoading = true } = options;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const pendingRequestRef = useRef<Promise<R> | null>(null);
  const requestKeyRef = useRef<string | null>(null);

  const execute = useCallback(
    async (...args: T): Promise<R> => {
      // Generate request key for duplicate prevention
      const requestKey = JSON.stringify(args);
      
      // Prevent duplicate requests
      if (preventDuplicates && pendingRequestRef.current && requestKeyRef.current === requestKey) {
        console.log('Preventing duplicate API request');
        return pendingRequestRef.current;
      }

      try {
        if (showLoading) setLoading(true);
        setError(null);
        requestKeyRef.current = requestKey;

        // Create and store the promise
        const requestPromise = apiFunction(...args);
        pendingRequestRef.current = requestPromise;

        const result = await requestPromise;
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('API request failed');
        setError(error);
        throw error;
      } finally {
        if (showLoading) setLoading(false);
        pendingRequestRef.current = null;
        requestKeyRef.current = null;
      }
    },
    [apiFunction, preventDuplicates, showLoading]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    pendingRequestRef.current = null;
    requestKeyRef.current = null;
  }, []);

  return { execute, loading, error, reset };
};
