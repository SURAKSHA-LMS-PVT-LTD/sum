import { instituteDriveApi, InstituteDriveTokenResponse } from '@/api/instituteDriveAccess.api';

// Per-institute token cache
const cachedTokens = new Map<string, { token: InstituteDriveTokenResponse; fetchedAt: number }>();
const tokenPromises = new Map<string, Promise<InstituteDriveTokenResponse>>();

const BUFFER_MS = 5 * 60 * 1000; // 5-minute expiry buffer
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 3000]; // ms between retries

/** Fetch token with automatic retry for network failures */
async function fetchTokenWithRetry(instituteId: string): Promise<InstituteDriveTokenResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await instituteDriveApi.getToken(instituteId);
    } catch (err: any) {
      lastError = err;
      const isNetworkError =
        !err?.response && // no HTTP response = network-level failure
        (err?.message?.includes('Network Error') ||
         err?.message?.includes('ERR_CONNECTION') ||
         err?.code === 'ERR_NETWORK' ||
         err?.code === 'ECONNABORTED');
      // Only retry on network errors, not on 4xx/5xx
      if (!isNetworkError || attempt >= MAX_RETRIES) break;
      await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
    }
  }
  throw lastError;
}

/**
 * Get a valid institute Drive access token.
 * Caches per-institute and auto-refreshes before expiry.
 * Retries on network failures (ERR_CONNECTION_CLOSED etc.).
 */
export async function getValidInstituteToken(
  instituteId: string,
): Promise<InstituteDriveTokenResponse> {
  const cached = cachedTokens.get(instituteId);
  if (cached) {
    const expiresAt = new Date(cached.token.expiresAt).getTime();
    if (expiresAt - Date.now() > BUFFER_MS) {
      return cached.token;
    }
  }

  // Coalesce concurrent requests for the same institute
  const existing = tokenPromises.get(instituteId);
  if (existing) return existing;

  const promise = fetchTokenWithRetry(instituteId)
    .then((token) => {
      cachedTokens.set(instituteId, { token, fetchedAt: Date.now() });
      tokenPromises.delete(instituteId);
      return token;
    })
    .catch((err) => {
      tokenPromises.delete(instituteId);
      cachedTokens.delete(instituteId);
      throw err;
    });

  tokenPromises.set(instituteId, promise);
  return promise;
}

export function clearInstituteTokenCache(instituteId?: string) {
  if (instituteId) {
    cachedTokens.delete(instituteId);
    tokenPromises.delete(instituteId);
  } else {
    cachedTokens.clear();
    tokenPromises.clear();
  }
}
