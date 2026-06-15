import { useEffect, useState } from 'react';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';

export interface InstituteMe {
  instituteUserImageUrl?: string;
  instituteTier?: string;
  [key: string]: any;
}

/**
 * Shared module-level in-flight map for `/institute-users/institute/:id/me`.
 *
 * Header and Sidebar are both always mounted in the app shell and each used to
 * fetch this endpoint independently in their own effect. Because the cache read
 * is async, both effects could pass the cache-miss check before either populated
 * the client's pendingRequests map — firing two identical requests on first paint.
 *
 * This hook collapses concurrent callers (across components) onto a single
 * promise per institute id, so the endpoint is fetched once. The underlying
 * enhancedCachedClient still persists the result (ttl 300) for later mounts.
 */
const inFlight = new Map<string, Promise<InstituteMe | null>>();

function fetchInstituteMe(instituteId: string): Promise<InstituteMe | null> {
  const existing = inFlight.get(instituteId);
  if (existing) return existing;

  const p = enhancedCachedClient
    .get<InstituteMe>(
      `/institute-users/institute/${instituteId}/me`,
      {},
      { ttl: 300, forceRefresh: false, userId: instituteId },
    )
    .catch(() => null)
    .finally(() => {
      inFlight.delete(instituteId);
    });

  inFlight.set(instituteId, p);
  return p;
}

/** Returns the current institute's "me" record, fetched once per institute id. */
export function useInstituteMe(instituteId?: string | null): {
  data: InstituteMe | null;
  loading: boolean;
} {
  const [data, setData] = useState<InstituteMe | null>(null);
  const [loading, setLoading] = useState<boolean>(!!instituteId);

  useEffect(() => {
    if (!instituteId) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchInstituteMe(instituteId).then((resp) => {
      if (!cancelled) {
        setData(resp);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [instituteId]);

  return { data, loading };
}
