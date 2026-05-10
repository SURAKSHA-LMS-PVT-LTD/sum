import { getDriveAccessToken, DriveAccessToken } from '@/services/driveService';

let cachedToken: DriveAccessToken | null = null;
let tokenPromise: Promise<DriveAccessToken> | null = null;

/**
 * Get a valid access token, using cache when possible.
 * Automatically refreshes when token is expired or about to expire (5 min buffer).
 */
export async function getValidDriveToken(): Promise<DriveAccessToken> {
  if (cachedToken) {
    const expiresAt = new Date(cachedToken.expiresAt).getTime();
    const bufferMs = 5 * 60 * 1000;
    if (expiresAt - Date.now() > bufferMs) {
      return cachedToken;
    }
  }

  // Prevent multiple concurrent token requests
  if (tokenPromise) return tokenPromise;

  tokenPromise = getDriveAccessToken()
    .then((token) => {
      cachedToken = token;
      tokenPromise = null;
      return token;
    })
    .catch((err) => {
      tokenPromise = null;
      cachedToken = null;
      throw err;
    });

  return tokenPromise;
}

export function clearDriveTokenCache() {
  cachedToken = null;
  tokenPromise = null;
}
