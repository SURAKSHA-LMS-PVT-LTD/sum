import { LoginCredentials, ApiResponse, ApiUserResponse } from '../types/auth.types';
import { tokenStorageService, isNativePlatform, getAuthHeadersSync } from '@/services/tokenStorageService';

// ============= BASE URL CONFIGURATION =============

export const getBaseUrl = (): string => {
  return import.meta.env.VITE_LMS_BASE_URL || 'https://lmsapi.suraksha.lk';
};

export const getBaseUrl2 = (): string => {
  // NEVER read the base URL from localStorage — an attacker who achieves XSS could
  // redirect all credentialed requests to an attacker-controlled server.
  const envUrl = import.meta.env.VITE_API_BASE_URL_2;
  if (envUrl) return envUrl;
  return '';
};

export const getAttendanceUrl = (): string => {
  return import.meta.env.VITE_ATTENDANCE_BASE_URL || 'https://lmsapi.suraksha.lk';
};

// ============= API HEADERS =============

/** @deprecated Use getApiHeadersAsync() */
export const getApiHeaders = (): Record<string, string> => {
  return getAuthHeadersSync();
};

/** Returns true only if token is a structurally valid JWT (header.payload.signature) */
function isValidJwtFormat(token: string): boolean {
  const parts = token.split('.');
  return parts.length === 3 && parts.every(p => p.length > 0);
}

export const getApiHeadersAsync = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const token = await tokenStorageService.getAccessToken();
  if (token) {
    if (isValidJwtFormat(token)) {
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      // Don't send a malformed token — the server will return 401,
      // which triggers the normal handle401Error → refreshAccessToken flow.
      // No side effects here; clearing storage from a headers function is too risky.
      console.warn('[auth] Skipping malformed access token — 401 refresh flow will handle recovery');
    }
  }
  return headers;
};

export const getCredentialsMode = (): RequestCredentials => {
  return isNativePlatform() ? 'omit' : 'include';
};

// ============= ORG TOKEN HELPERS =============

// In-memory store for org token on web — avoids XSS exposure via sessionStorage.
// Does not survive page refresh, which is acceptable: a fresh org token is requested on login.
let _orgAccessTokenMemory: string | null = null;

export const getOrgAccessTokenAsync = async (): Promise<string | null> => {
  if (isNativePlatform()) {
    try {
      const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
      const result = await SecureStoragePlugin.get({ key: 'org_access_token' });
      return result.value;
    } catch {
      return null;
    }
  }
  return _orgAccessTokenMemory;
};

export const setOrgAccessTokenAsync = async (token: string): Promise<void> => {
  if (isNativePlatform()) {
    const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
    await SecureStoragePlugin.set({ key: 'org_access_token', value: token });
  } else {
    _orgAccessTokenMemory = token;
  }
};

export const removeOrgAccessTokenAsync = async (): Promise<void> => {
  if (isNativePlatform()) {
    try {
      const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
      await SecureStoragePlugin.remove({ key: 'org_access_token' });
    } catch {
      // Key didn't exist
    }
  } else {
    _orgAccessTokenMemory = null;
  }
};

// ============= TOKEN REFRESH STATE (Singleton) =============

let isRefreshing = false;
let refreshPromise: Promise<ApiUserResponse> | null = null;

// ============= LOGIN =============

export const loginUser = async (credentials: LoginCredentials): Promise<ApiResponse> => {
  const baseUrl = getBaseUrl();
  const isMobile = isNativePlatform();

  const loginEndpoint = isMobile ? '/v2/auth/login/mobile' : '/v2/auth/login';

  // Store rememberMe preference BEFORE the request (so it's available for token storage)
  await tokenStorageService.setRememberMe(!!credentials.rememberMe);

  const response = await fetch(`${baseUrl}${loginEndpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: isMobile ? 'omit' : 'include',
    body: JSON.stringify({
      identifier: credentials.identifier,
      password: credentials.password,
      rememberMe: !!credentials.rememberMe,
      remember_me: !!credentials.rememberMe,
      ...(isMobile && { deviceId: await tokenStorageService.getDeviceId() }),
      ...(credentials.subdomain && { subdomain: credentials.subdomain }),
      ...(credentials.customDomain && { customDomain: credentials.customDomain }),
      ...(credentials.loginMethod && { loginMethod: credentials.loginMethod }),
    })
  });

  if (!response.ok) {
    // Use a generic message to prevent user/credential enumeration.
    // The server's specific error is only logged in dev mode.
    if (import.meta.env.DEV) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Login failed (dev only):', errorData);
    }
    throw new Error('Invalid credentials. Please check your username and password.');
  }

  const data = await response.json();

  // Store access token in memory (web) or native storage (mobile)
  if (data.access_token) {
    await tokenStorageService.setAccessToken(data.access_token);
  }

  // Store refresh token (mobile always; web when rememberMe for cookie fallback)
  if (data.refresh_token) {
    await tokenStorageService.setRefreshToken(data.refresh_token);
  }

  // Store token expiry
  if (data.expires_in) {
    const expiryMs = parseExpiresIn(data.expires_in);
    const expiryTimestamp = Date.now() + expiryMs;
    await tokenStorageService.setTokenExpiry(expiryTimestamp);
  }

  // Store minimal user data
  if (data.user) {
    await tokenStorageService.setUserData({
      id: data.user.id,
      email: data.user.email,
      nameWithInitials: data.user.nameWithInitials,
      userType: data.user.userType,
      imageUrl: data.user.imageUrl
    });
  }

  // 🏢 Multi-tenant: Store preSelectedInstituteId so InstituteSelector can auto-skip
  // This is set when the user logs in via a subdomain or custom domain login page.
  // Cleared by InstituteSelector after use.
  if (data.preSelectedInstituteId && !isNativePlatform()) {
    sessionStorage.setItem('tenant_preSelectedInstituteId', data.preSelectedInstituteId);
    if (data.preSelectedInstituteName) {
      sessionStorage.setItem('tenant_preSelectedInstituteName', data.preSelectedInstituteName);
    }
  }

  return data;
};

// ============= TOKEN REFRESH (Singleton Pattern) =============

/**
 * Refresh access token
 * - Web: POST /v2/auth/refresh with httpOnly cookie (credentials: 'include')
 * - Mobile: POST /auth/refresh/mobile with refresh_token in body
 * Singleton pattern prevents concurrent refresh requests.
 */
export const refreshAccessToken = async (): Promise<ApiUserResponse> => {
  const baseUrl = getBaseUrl();
  const isMobile = isNativePlatform();

  // Reuse in-flight refresh
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;

  refreshPromise = (async () => {
    try {
      let response: Response;

      if (isMobile) {
        // Mobile: always use stored refresh token
        const refreshToken = await tokenStorageService.getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }
        response = await fetch(`${baseUrl}/auth/refresh/mobile`, {
          method: 'POST',
          credentials: 'omit',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            refresh_token: refreshToken,
            deviceId: await tokenStorageService.getDeviceId()
          })
        });
      } else {
        // Web: Send stored refresh_token in body when available.
        // Also use credentials: 'include' so the httpOnly cookie is sent as a
        // fallback (e.g. new browser window where sessionStorage is empty but
        // the cookie is still valid). The backend accepts the token from either
        // cookie or body, so this covers both scenarios.
        const storedRefreshToken = await tokenStorageService.getRefreshToken();

        response = await fetch(`${baseUrl}/v2/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(storedRefreshToken ? { refresh_token: storedRefreshToken } : {})
        });

        // If the body token was revoked (e.g. rotated by another tab before BroadcastChannel
        // synced), retry with cookie only. The browser keeps the latest httpOnly cookie
        // set by the server, so the cookie is always more up-to-date than localStorage.
        if (!response.ok && response.status === 401 && storedRefreshToken) {
          if (import.meta.env.DEV) console.warn('[auth] Body refresh_token rejected (possibly rotated by another tab) — retrying with cookie only');
          // Clear stale body token so a future cold-start also falls through to cookie
          await tokenStorageService.removeRefreshToken();
          response = await fetch(`${baseUrl}/v2/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
          });
        }
      }

      if (!response.ok) {
        if (import.meta.env.DEV) console.error('Token refresh failed:', response.status);
        await clearAuthData();
        window.dispatchEvent(new CustomEvent('auth:refresh-failed'));
        throw new Error('Token refresh failed');
      }

      const data = await response.json();

      // Store new access token
      if (data.access_token) {
        await tokenStorageService.setAccessToken(data.access_token);
      }

      // Store new refresh token (token rotation — both web and mobile)
      if (data.refresh_token) {
        await tokenStorageService.setRefreshToken(data.refresh_token);
      }

      // Update token expiry
      if (data.expires_in) {
        const expiryMs = parseExpiresIn(data.expires_in);
        const expiryTimestamp = Date.now() + expiryMs;
        await tokenStorageService.setTokenExpiry(expiryTimestamp);
      }

      // Update user data
      if (data.user) {
        await tokenStorageService.setUserData({
          id: data.user.id,
          email: data.user.email,
          nameWithInitials: data.user.nameWithInitials,
          userType: data.user.userType,
          imageUrl: data.user.imageUrl
        });
      }

      // Notify AuthContext
      window.dispatchEvent(new CustomEvent('auth:refresh-success', {
        detail: { user: data.user }
      }));

      return data.user;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

// ============= TOKEN VALIDATION =============

export const validateToken = async (): Promise<ApiUserResponse> => {
  const baseUrl = getBaseUrl();
  const isMobile = isNativePlatform();

  const token = await tokenStorageService.getAccessToken();
  const cachedUserData = await tokenStorageService.getUserData();

  // If token is expired or near-expiry, refresh first
  const expiry = await tokenStorageService.getTokenExpiry();
  const bufferMs = isMobile ? 2 * 60 * 1000 : 60_000;
  if (token && expiry && Date.now() >= (expiry - bufferMs)) {
    return await refreshAccessToken();
  }

  // If no access token in memory, try refresh
  // On mobile cold-start: memory is empty but refresh token is in secure storage
  if (!token) {
    try {
      return await refreshAccessToken();
    } catch {
      throw new Error('No authentication token found');
    }
  }

  // If user data cached, return it
  if (cachedUserData) {
    return cachedUserData;
  }

  // Fetch from /auth/me
  try {
    const headers = await getApiHeadersAsync();
    const response = await fetch(`${baseUrl}/auth/me`, {
      method: 'GET',
      headers,
      credentials: isMobile ? 'omit' : 'include'
    });

    if (response.status === 401) {
      return await refreshAccessToken();
    }

    if (!response.ok) {
      await clearAuthData();
      throw new Error(`Token validation failed: ${response.status}`);
    }

    const responseData = await response.json();
    const userData = responseData.data || responseData;

    await tokenStorageService.setUserData({
      id: userData.id,
      email: userData.email,
      nameWithInitials: userData.nameWithInitials,
      userType: userData.userType,
      imageUrl: userData.imageUrl
    });

    return userData;
  } catch (error: any) {
    await clearAuthData();
    throw error;
  }
};

// ============= LOGOUT =============

export const logoutUser = async (): Promise<void> => {
  const baseUrl = getBaseUrl();
  const isMobile = isNativePlatform();

  try {
    if (isMobile) {
      const refreshToken = await tokenStorageService.getRefreshToken();
      if (refreshToken) {
        await fetch(`${baseUrl}/auth/logout/mobile`, {
          method: 'POST',
          credentials: 'omit',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            refresh_token: refreshToken,
            deviceId: await tokenStorageService.getDeviceId()
          })
        });
      }
    } else {
      // Use v2 endpoint which accepts refresh_token from both cookie and body
      const storedRefreshToken = await tokenStorageService.getRefreshToken();
      await fetch(`${baseUrl}/v2/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storedRefreshToken ? { refresh_token: storedRefreshToken } : {})
      });
    }
  } catch {
    // Ignore — token will expire
  }

  await clearAuthData();
};

// ============= SESSION MANAGEMENT =============

export const getActiveSessions = async (params?: { page?: number; limit?: number; platform?: string; sortBy?: string; sortOrder?: string }): Promise<{ sessions: any[]; pagination?: any; summary?: any }> => {
  const baseUrl = getBaseUrl();
  const headers = await getApiHeadersAsync();
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.platform) query.set('platform', params.platform);
  if (params?.sortBy) query.set('sortBy', params.sortBy);
  if (params?.sortOrder) query.set('sortOrder', params.sortOrder);
  const qs = query.toString();
  const response = await fetch(`${baseUrl}/auth/sessions${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    headers,
    credentials: getCredentialsMode()
  });
  if (!response.ok) throw new Error('Failed to load sessions');
  const data = await response.json();
  return {
    sessions: data.sessions || data.data || (Array.isArray(data) ? data : []),
    pagination: data.pagination,
    summary: data.summary
  };
};

export const revokeSession = async (sessionId: string): Promise<void> => {
  // Validate format before interpolating into URL to prevent path traversal
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(sessionId)) throw new Error('Invalid session ID format');

  const baseUrl = getBaseUrl();
  const headers = await getApiHeadersAsync();
  const response = await fetch(`${baseUrl}/auth/sessions/revoke/${sessionId}`, {
    method: 'POST',
    headers,
    credentials: getCredentialsMode()
  });
  if (!response.ok) throw new Error('Failed to revoke session');
};

export const revokeAllSessions = async (): Promise<void> => {
  const baseUrl = getBaseUrl();
  const headers = await getApiHeadersAsync();
  const response = await fetch(`${baseUrl}/auth/sessions/revoke-all`, {
    method: 'POST',
    headers,
    credentials: getCredentialsMode()
  });
  if (!response.ok) throw new Error('Failed to revoke all sessions');
};

// ============= HELPERS =============

const clearAuthData = async (): Promise<void> => {
  await tokenStorageService.clearAll();
  if (!isNativePlatform()) {
    localStorage.removeItem('selectedInstitute');
    localStorage.removeItem('selectedClass');
    localStorage.removeItem('selectedSubject');
    localStorage.removeItem('selectedChild');
    localStorage.removeItem('selectedOrganization');
  }
};

export const isAuthenticatedAsync = async (): Promise<boolean> => {
  return await tokenStorageService.isAuthenticated();
};

/** @deprecated Use isAuthenticatedAsync() */
export const isAuthenticated = (): boolean => {
  return !!tokenStorageService.getAccessTokenSync();
};

export const getAccessTokenAsync = async (): Promise<string | null> => {
  return await tokenStorageService.getAccessToken();
};

/** @deprecated */
export const getAccessToken = (): string | null => {
  return tokenStorageService.getAccessTokenSync();
};

// Re-export
export { isNativePlatform, tokenStorageService };

// ============= HELPERS: PARSE EXPIRES_IN =============

/**
 * Parse expires_in from the server.
 * Supports:
 *  - number (seconds): 3600 → 3600000ms
 *  - string with unit: '24h', '7d', '30m', '60s'
 *  - numeric string: '3600' → 3600000ms
 * Falls back to 1 hour if unparseable.
 */
function parseExpiresIn(value: any): number {
  if (typeof value === 'number' && value > 0) {
    return value * 1000; // seconds → ms
  }
  if (typeof value === 'string') {
    const match = value.match(/^(\d+)([hdms]?)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      const unit = match[2];
      switch (unit) {
        case 'h': return num * 60 * 60 * 1000;
        case 'd': return num * 24 * 60 * 60 * 1000;
        case 'm': return num * 60 * 1000;
        case 's': return num * 1000;
        default: return num * 1000; // assume seconds if no unit
      }
    }
  }
  return 60 * 60 * 1000; // fallback: 1 hour
}

// ============= INSTITUTE-LEVEL LOGIN =============

export interface InstituteLoginCredentials {
  instituteId: string;
  userIdByInstitute: string;
  password: string;
  rememberMe?: boolean;
}

export interface InstituteLoginResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  deviceLimitReached?: boolean;
  activeSessions?: {
    id: string;
    deviceLabel: string | null;
    ipAddress: string | null;
    scopeHost: string | null;
    loginMethod: string;
    createdAt: string;
    lastActiveAt: string;
  }[];
  maxDevices?: number;
  user: {
    userId: string;
    instituteId: string;
    userIdByInstitute: string;
    instituteUserType: string;
    instituteName: string;
    firstName?: string;
    lastName?: string;
    imageUrl?: string | null;
  };
}

export const instituteLogin = async (credentials: InstituteLoginCredentials): Promise<InstituteLoginResponse> => {
  const baseUrl = getBaseUrl();
  const isMobile = isNativePlatform();

  await tokenStorageService.setRememberMe(!!credentials.rememberMe);

  const response = await fetch(`${baseUrl}/v2/auth/institute/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: isMobile ? 'omit' : 'include',
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const msg = errorData?.message || 'Invalid credentials. Please check your institute user ID and password.';
    const err = new Error(msg);
    (err as any).errorCode = errorData?.errorCode ?? null;
    throw err;
  }

  const data: InstituteLoginResponse = await response.json();

  if (data.access_token) {
    await tokenStorageService.setAccessToken(data.access_token);
  }
  if (data.refresh_token) {
    await tokenStorageService.setRefreshToken(data.refresh_token);
  }
  if (data.expires_in) {
    const expiryMs = parseExpiresIn(data.expires_in);
    await tokenStorageService.setTokenExpiry(Date.now() + expiryMs);
  }
  if (data.user) {
    await tokenStorageService.setUserData({
      id: data.user.userId,
      email: '',
      nameWithInitials: `${data.user.firstName || ''} ${data.user.lastName || ''}`.trim(),
      userType: data.user.instituteUserType,
      imageUrl: data.user.imageUrl || null,
    });
  }

  // 🏢 Multi-tenant: Store preSelectedInstituteId so InstituteSelector auto-skips
  // The institute login endpoint already authenticates against one specific institute,
  // so we can immediately tell InstituteSelector which institute was selected.
  if (data.user?.instituteId && !isNativePlatform()) {
    sessionStorage.setItem('tenant_preSelectedInstituteId', data.user.instituteId);
    if (data.user.instituteName) {
      sessionStorage.setItem('tenant_preSelectedInstituteName', data.user.instituteName);
    }
  }

  return data;
};

export const instituteLoginForce = async (credentials: InstituteLoginCredentials): Promise<InstituteLoginResponse> => {
  const baseUrl = getBaseUrl();
  const isMobile = isNativePlatform();

  await tokenStorageService.setRememberMe(!!credentials.rememberMe);

  const response = await fetch(`${baseUrl}/v2/auth/institute/login/force`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: isMobile ? 'omit' : 'include',
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const msg = errorData?.message || 'Invalid credentials. Please check your institute user ID and password.';
    const err = new Error(msg);
    (err as any).errorCode = errorData?.errorCode ?? null;
    throw err;
  }

  const data: InstituteLoginResponse = await response.json();

  if (data.access_token) {
    await tokenStorageService.setAccessToken(data.access_token);
  }
  if (data.refresh_token) {
    await tokenStorageService.setRefreshToken(data.refresh_token);
  }
  if (data.expires_in) {
    const expiryMs = parseExpiresIn(data.expires_in);
    await tokenStorageService.setTokenExpiry(Date.now() + expiryMs);
  }
  if (data.user && data.access_token) {
    await tokenStorageService.setUserData({
      id: data.user.userId,
      email: '',
      nameWithInitials: `${data.user.firstName || ''} ${data.user.lastName || ''}`.trim(),
      userType: data.user.instituteUserType,
      imageUrl: data.user.imageUrl || null,
    });
  }

  // 🏢 Multi-tenant: Store preSelectedInstituteId so InstituteSelector auto-skips
  if (data.user?.instituteId && !isNativePlatform() && data.access_token) {
    sessionStorage.setItem('tenant_preSelectedInstituteId', data.user.instituteId);
    if (data.user.instituteName) {
      sessionStorage.setItem('tenant_preSelectedInstituteName', data.user.instituteName);
    }
  }

  return data;
};

// ============= INSTITUTE PASSWORD RESET =============

export interface InstituteAvailableContact {
  id: string;       // 'own_email' | 'own_phone' | 'father_phone' | 'mother_phone' | 'guardian_phone'
  label: string;    // Human-readable label
  masked: string;   // Masked value e.g. '****28' or 'j***@gmail.com'
  type: 'EMAIL' | 'PHONE';
}

export const getInstituteAvailableContacts = async (params: {
  instituteId: string;
  userIdByInstitute: string;
}): Promise<{ contacts: InstituteAvailableContact[] }> => {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/v2/auth/institute/available-contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Failed to load contacts' }));
    throw new Error(err.message || 'Failed to load contacts');
  }
  return response.json();
};

export const initiateInstitutePasswordReset = async (params: {
  instituteId: string;
  userIdByInstitute: string;
  selectedContactId: string;
}): Promise<{ message: string; sentTo: string; channel: string; isParentContact: boolean }> => {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/v2/auth/institute/password-reset/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to send OTP' }));
    throw new Error(errorData.message || 'Failed to send OTP');
  }

  return response.json();
};

export const verifyInstitutePasswordReset = async (params: {
  instituteId: string;
  userIdByInstitute: string;
  otpCode: string;
  newPassword: string;
}): Promise<{ message: string }> => {
  const baseUrl = getBaseUrl();
  const response = await fetch(`${baseUrl}/v2/auth/institute/password-reset/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Password reset failed' }));
    throw new Error(errorData.message || 'Password reset failed');
  }

  return response.json();
};

export const changeInstitutePassword = async (params: {
  instituteId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ message: string }> => {
  const baseUrl = getBaseUrl();
  const headers = await getApiHeadersAsync();
  const response = await fetch(`${baseUrl}/v2/auth/institute/change-password`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    credentials: getCredentialsMode(),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Password change failed' }));
    throw new Error(errorData.message || 'Password change failed');
  }

  return response.json();
};

export const setInstituteUserPassword = async (params: {
  instituteId: string;
  targetUserId: string;
  newPassword: string;
}): Promise<{ message: string }> => {
  const baseUrl = getBaseUrl();
  const headers = await getApiHeadersAsync();
  const response = await fetch(`${baseUrl}/v2/auth/institute/set-password`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    credentials: getCredentialsMode(),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to set password' }));
    throw new Error(errorData.message || 'Failed to set password');
  }

  return response.json();
};

// ============= SELF-ACTIVATE INSTITUTE PROFILE (in-app, main JWT) =============

export const getSelfActivateProfile = async (instituteId: string): Promise<{
  hasPassword: boolean;
  extraData: Record<string, any> | null;
  instituteUserType: string;
  status: string;
  userIdByInstitute: string | null;
  institutePasswordSetAt: string | null;
}> => {
  const baseUrl = getBaseUrl();
  const headers = await getApiHeadersAsync();
  const response = await fetch(
    `${baseUrl}/v2/auth/institute/self-activate/profile?instituteId=${encodeURIComponent(instituteId)}`,
    { headers, credentials: getCredentialsMode() },
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Failed to load profile' }));
    throw new Error(err.message || 'Failed to load profile');
  }
  return response.json();
};

export const getSelfActivateContacts = async (instituteId: string): Promise<{
  contacts: InstituteAvailableContact[];
}> => {
  const baseUrl = getBaseUrl();
  const headers = await getApiHeadersAsync();
  const response = await fetch(
    `${baseUrl}/v2/auth/institute/self-activate/contacts?instituteId=${encodeURIComponent(instituteId)}`,
    { headers, credentials: getCredentialsMode() },
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Failed to load contacts' }));
    throw new Error(err.message || 'Failed to load contacts');
  }
  return response.json();
};

export const selfActivateRequestOtp = async (params: {
  instituteId: string;
  selectedContactId: string;
}): Promise<{ message: string; sentTo: string; type: 'EMAIL' | 'PHONE' }> => {
  const baseUrl = getBaseUrl();
  const headers = await getApiHeadersAsync();
  const response = await fetch(`${baseUrl}/v2/auth/institute/self-activate/request-otp`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    credentials: getCredentialsMode(),
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Failed to send OTP' }));
    throw new Error(err.message || 'Failed to send OTP');
  }
  return response.json();
};

export const selfActivateVerify = async (params: {
  instituteId: string;
  otpCode: string;
  newPassword: string;
  extraData?: Record<string, any>;
}): Promise<{ message: string }> => {
  const baseUrl = getBaseUrl();
  const headers = await getApiHeadersAsync();
  const response = await fetch(`${baseUrl}/v2/auth/institute/self-activate/verify`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    credentials: getCredentialsMode(),
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: 'Activation failed' }));
    throw new Error(err.message || 'Activation failed');
  }
  return response.json();
};
