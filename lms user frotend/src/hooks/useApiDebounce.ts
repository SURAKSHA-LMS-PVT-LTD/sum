
import { useCallback, useRef } from 'react';

interface UseApiDebounceOptions {
  delay?: number;
  preventDuplicates?: boolean;
}

export const useApiDebounce = (options: UseApiDebounceOptions = {}) => {
  const { delay = 300, preventDuplicates = true } = options;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingRequestsRef = useRef<Set<string>>(new Set());

  const debouncedCall = useCallback(
    <T extends any[], R>(
      fn: (...args: T) => Promise<R>,
      requestKey?: string
    ) => {
      return (...args: T): Promise<R> => {
        return new Promise((resolve, reject) => {
          // Clear previous timeout
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }

          // Check for duplicate requests
          if (preventDuplicates && requestKey) {
            if (pendingRequestsRef.current.has(requestKey)) {
              console.log(`Preventing duplicate request: ${requestKey}`);
              return reject(new Error('Duplicate request prevented'));
            }
          }

          timeoutRef.current = setTimeout(async () => {
            try {
              // Mark request as pending
              if (requestKey) {
                pendingRequestsRef.current.add(requestKey);
              }

              const result = await fn(...args);
              resolve(result);
            } catch (error: any) {
              reject(error);
            } finally {
              // Remove from pending requests
              if (requestKey) {
                pendingRequestsRef.current.delete(requestKey);
              }
            }
          }, delay);
        });
      };
    },
    [delay, preventDuplicates]
  );

  const clearPendingRequests = useCallback(() => {
    pendingRequestsRef.current.clear();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return { debouncedCall, clearPendingRequests };
};
