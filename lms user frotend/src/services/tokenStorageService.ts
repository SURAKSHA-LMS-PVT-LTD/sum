/**
 * Platform-Aware Token Storage Service (SSO v2)
 * 
 * WEB:
 * - Access token: IN-MEMORY ONLY (never localStorage — XSS protection)
 * - Refresh token: sessionStorage + localStorage (survives reload, new tabs, browser restart)
 * - User data & token expiry: sessionStorage + localStorage
 * - Multi-tab sync via BroadcastChannel
 * - Session restored on page load via /v2/auth/refresh with stored refresh token
 * 
 * MOBILE (Capacitor):
 * - All tokens: Secure Storage (Keychain on iOS, EncryptedSharedPreferences on Android)
 * - 256-bit AES encryption at rest
 * - Refresh token stored locally (no cookie support in WebView)
 */

import { Capacitor } from '@capacitor/core';

// ============= PLATFORM DETECTION =============

export const isNativePlatform = (): boolean => {
  return Capacitor.isNativePlatform();
};

export const getPlatform = (): 'web' | 'android' | 'ios' => {
  if (!Capacitor.isNativePlatform()) return 'web';
  const platform = Capacitor.getPlatform();
  return platform === 'ios' ? 'ios' : 'android';
};

// ============= SECURE STORAGE HELPERS =============

/**
 * Wraps SecureStoragePlugin calls. On native, uses encrypted Keychain/EncryptedSharedPreferences.
 * get() throws when key doesn't exist, so we catch and return null.
 */
const secureStorage = {
  async set(key: string, value: string): Promise<void> {
    const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
    await SecureStoragePlugin.set({ key, value });
  },

  async get(key: string): Promise<string | null> {
    try {
      const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
      const result = await SecureStoragePlugin.get({ key });
      return result.value;
    } catch {
      // Key doesn't exist
      return null;
    }
  },

  async remove(key: string): Promise<void> {
    try {
      const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
      await SecureStoragePlugin.remove({ key });
    } catch {
      // Key didn't exist — no-op
    }
  },

  async clear(): Promise<void> {
    const { SecureStoragePlugin } = await import('capacitor-secure-storage-plugin');
    await SecureStoragePlugin.clear();
  },
};

// ============= STORAGE KEYS =============

const KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token', // Mobile always; Web only when rememberMe
  USER_DATA: 'user_data',
  DEVICE_ID: 'device_id',
  TOKEN_EXPIRY: 'token_expiry',
  REMEMBER_ME: 'remember_me',
} as const;

// ============= IN-MEMORY TOKEN STORE =============

let memoryStore: {
  accessToken: string | null;
  refreshToken: string | null; // mobile only
  expiresAt: number | null;
} = { accessToken: null, refreshToken: null, expiresAt: null };

// ============= MULTI-TAB SYNC (Web Only) =============

let broadcastChannel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (isNativePlatform()) return null;
  if (!broadcastChannel && typeof BroadcastChannel !== 'undefined') {
    broadcastChannel = new BroadcastChannel('auth_sync');
    broadcastChannel.onmessage = (event) => {
      const { type, accessToken, expiresAt, refreshToken } = event.data;
      if (type === 'TOKEN_UPDATE') {
        memoryStore.accessToken = accessToken;
        memoryStore.expiresAt = expiresAt;
        // Sync the NEW refresh token so other tabs don't send the revoked old one
        if (refreshToken) {
          memoryStore.refreshToken = refreshToken;
          try { sessionStorage.setItem(KEYS.REFRESH_TOKEN, refreshToken); } catch {}
          try { localStorage.setItem(KEYS.REFRESH_TOKEN, refreshToken); } catch {}
        }
      } else if (type === 'LOGOUT') {
        memoryStore = { accessToken: null, refreshToken: null, expiresAt: null };
        window.dispatchEvent(new CustomEvent('auth:logged-out-other-tab'));
      }
    };
  }
  return broadcastChannel;
}

// Initialize broadcast channel on web
if (typeof window !== 'undefined' && !isNativePlatform()) {
  getBroadcastChannel();
}

function broadcastTokenUpdate() {
  const ch = getBroadcastChannel();
  if (ch) {
    ch.postMessage({
      type: 'TOKEN_UPDATE',
      accessToken: memoryStore.accessToken,
      expiresAt: memoryStore.expiresAt,
      // Include the latest refresh token so other tabs stay in sync after rotation
      refreshToken: memoryStore.refreshToken,
    });
  }
}

function broadcastLogout() {
  const ch = getBroadcastChannel();
  if (ch) {
    ch.postMessage({ type: 'LOGOUT' });
  }
}

// ============= TOKEN STORAGE SERVICE =============

export const tokenStorageService = {
  // ============= ACCESS TOKEN =============

  /**
   * Store access token
   * - Web: IN-MEMORY ONLY (+ broadcast to other tabs)
   * - Mobile: Secure Storage (encrypted) + memory
   */
  async setAccessToken(token: string): Promise<void> {
    memoryStore.accessToken = token;

    if (isNativePlatform()) {
      await secureStorage.set(KEYS.ACCESS_TOKEN, token);
    }
    // Web: in-memory only — no localStorage to protect against XSS token theft

    broadcastTokenUpdate();
  },

  /**
   * Get access token from memory.
   * Returns the token even if expired — the server will 401 and the API client
   * will trigger a refresh + retry.
   */
  async getAccessToken(): Promise<string | null> {
    if (memoryStore.accessToken) {
      return memoryStore.accessToken;
    }

    // On mobile, fall back to secure storage if memory is empty (cold start)
    if (isNativePlatform()) {
      const value = await secureStorage.get(KEYS.ACCESS_TOKEN);
      if (value) {
        memoryStore.accessToken = value;
        if (!memoryStore.expiresAt) {
          memoryStore.expiresAt = await this.getTokenExpiry();
        }
        return value;
      }
    }

    // Web: in-memory only; a missing token after page reload will trigger /v2/auth/refresh
    // which restores the session via the HttpOnly cookie.

    return null;
  },

  async removeAccessToken(): Promise<void> {
    memoryStore.accessToken = null;
    if (isNativePlatform()) {
      await secureStorage.remove(KEYS.ACCESS_TOKEN);
    }
    // Web: only in-memory; nothing to remove from storage
  },

  // ============= REFRESH TOKEN =============

  async setRefreshToken(token: string): Promise<void> {
    memoryStore.refreshToken = token;
    if (isNativePlatform()) {
      await secureStorage.set(KEYS.REFRESH_TOKEN, token);
    } else {
      // Always write to sessionStorage (tab-scoped, survives page reload within the tab).
      try { sessionStorage.setItem(KEYS.REFRESH_TOKEN, token); } catch {}
      // Only persist to localStorage when the user opted in with rememberMe.
      // localStorage survives browser restarts — only appropriate when the user
      // explicitly chose to stay logged in.
      const rememberMe = localStorage.getItem(KEYS.REMEMBER_ME) === 'true';
      if (rememberMe) {
        try { localStorage.setItem(KEYS.REFRESH_TOKEN, token); } catch {}
      } else {
        // Actively remove any previously stored token to avoid stale persistence.
        try { localStorage.removeItem(KEYS.REFRESH_TOKEN); } catch {}
      }
    }
    broadcastTokenUpdate();
  },

  async getRefreshToken(): Promise<string | null> {
    if (memoryStore.refreshToken) return memoryStore.refreshToken;
    if (isNativePlatform()) {
      const value = await secureStorage.get(KEYS.REFRESH_TOKEN);
      memoryStore.refreshToken = value;
      return value;
    }
    // Web: try sessionStorage first (same tab), then localStorage (rememberMe)
    try {
      const value = sessionStorage.getItem(KEYS.REFRESH_TOKEN)
        || localStorage.getItem(KEYS.REFRESH_TOKEN);
      if (value) memoryStore.refreshToken = value;
      return value;
    } catch {
      return null;
    }
  },

  async removeRefreshToken(): Promise<void> {
    memoryStore.refreshToken = null;
    if (isNativePlatform()) {
      await secureStorage.remove(KEYS.REFRESH_TOKEN);
    } else {
      try { sessionStorage.removeItem(KEYS.REFRESH_TOKEN); } catch {}
      try { localStorage.removeItem(KEYS.REFRESH_TOKEN); } catch {}
    }
  },

  // ============= USER DATA =============

  async setUserData(userData: object): Promise<void> {
    const dataString = JSON.stringify(userData);
    if (isNativePlatform()) {
      await secureStorage.set(KEYS.USER_DATA, dataString);
    } else {
      // Persist to both storages so session restoration works after reload and new tabs
      try { sessionStorage.setItem(KEYS.USER_DATA, dataString); } catch {}
      try { localStorage.setItem(KEYS.USER_DATA, dataString); } catch {}
    }
  },

  async getUserData<T = any>(): Promise<T | null> {
    let dataString: string | null = null;
    if (isNativePlatform()) {
      dataString = await secureStorage.get(KEYS.USER_DATA);
    } else {
      try {
        dataString = sessionStorage.getItem(KEYS.USER_DATA)
          || localStorage.getItem(KEYS.USER_DATA);
      } catch {}
    }
    if (!dataString) return null;
    try {
      return JSON.parse(dataString) as T;
    } catch {
      return null;
    }
  },

  async removeUserData(): Promise<void> {
    if (isNativePlatform()) {
      await secureStorage.remove(KEYS.USER_DATA);
    } else {
      try { sessionStorage.removeItem(KEYS.USER_DATA); } catch {}
      try { localStorage.removeItem(KEYS.USER_DATA); } catch {}
    }
  },

  // ============= TOKEN EXPIRY =============

  async setTokenExpiry(expiryTimestamp: number): Promise<void> {
    memoryStore.expiresAt = expiryTimestamp;
    const value = expiryTimestamp.toString();
    if (isNativePlatform()) {
      await secureStorage.set(KEYS.TOKEN_EXPIRY, value);
    } else {
      // Persist to both storages so auto-refresh can schedule accurately after page reload
      try { sessionStorage.setItem(KEYS.TOKEN_EXPIRY, value); } catch {}
      try { localStorage.setItem(KEYS.TOKEN_EXPIRY, value); } catch {}
    }
    broadcastTokenUpdate();
  },

  async getTokenExpiry(): Promise<number | null> {
    if (memoryStore.expiresAt) return memoryStore.expiresAt;
    if (isNativePlatform()) {
      const value = await secureStorage.get(KEYS.TOKEN_EXPIRY);
      if (value) {
        memoryStore.expiresAt = parseInt(value, 10);
        return memoryStore.expiresAt;
      }
    } else {
      try {
        const value = sessionStorage.getItem(KEYS.TOKEN_EXPIRY)
          || localStorage.getItem(KEYS.TOKEN_EXPIRY);
        if (value) {
          memoryStore.expiresAt = parseInt(value, 10);
          return memoryStore.expiresAt;
        }
      } catch {}
    }
    return null;
  },

  async isTokenExpired(): Promise<boolean> {
    const expiry = await this.getTokenExpiry();
    if (!expiry) return true;
    return Date.now() >= expiry;
  },

  // ============= DEVICE ID (Mobile Only) =============

  async getDeviceId(): Promise<string | null> {
    if (!isNativePlatform()) return null;
    const value = await secureStorage.get(KEYS.DEVICE_ID);
    if (value) return value;
    const randomBytes = crypto.getRandomValues(new Uint8Array(8));
    const randomPart = Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('');
    const deviceId = `${getPlatform()}_${Date.now()}_${randomPart}`;
    await secureStorage.set(KEYS.DEVICE_ID, deviceId);
    return deviceId;
  },

  // ============= REMEMBER ME =============

  async setRememberMe(value: boolean): Promise<void> {
    if (isNativePlatform()) {
      await secureStorage.set(KEYS.REMEMBER_ME, value.toString());
    } else {
      localStorage.setItem(KEYS.REMEMBER_ME, value.toString());
    }
  },

  async getRememberMe(): Promise<boolean> {
    if (isNativePlatform()) {
      const value = await secureStorage.get(KEYS.REMEMBER_ME);
      return value === 'true';
    }
    return localStorage.getItem(KEYS.REMEMBER_ME) === 'true';
  },

  // ============= CLEAR ALL =============

  async clearAll(): Promise<void> {
    memoryStore = { accessToken: null, refreshToken: null, expiresAt: null };

    if (isNativePlatform()) {
      await Promise.all([
        secureStorage.remove(KEYS.ACCESS_TOKEN),
        secureStorage.remove(KEYS.REFRESH_TOKEN),
        secureStorage.remove(KEYS.USER_DATA),
        secureStorage.remove(KEYS.TOKEN_EXPIRY),
        secureStorage.remove(KEYS.REMEMBER_ME),
      ]);
    } else {
      // sessionStorage (tab-scoped)
      try {
        sessionStorage.removeItem(KEYS.USER_DATA);
        sessionStorage.removeItem(KEYS.REFRESH_TOKEN);
        sessionStorage.removeItem(KEYS.TOKEN_EXPIRY);
        sessionStorage.removeItem('org_access_token');
      } catch {}
      // localStorage (legacy keys — clean up in case old data exists)
      try {
        localStorage.removeItem(KEYS.REMEMBER_ME);
        localStorage.removeItem('token');
        localStorage.removeItem('authToken');
        localStorage.removeItem('org_access_token');
        localStorage.removeItem(KEYS.ACCESS_TOKEN);
        localStorage.removeItem(KEYS.TOKEN_EXPIRY);
        localStorage.removeItem(KEYS.USER_DATA);
        localStorage.removeItem(KEYS.REFRESH_TOKEN);
      } catch {}
    }

    broadcastLogout();
  },

  // ============= AUTH CHECK =============

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  },

  hasAnyAuthHint(): boolean {
    if (memoryStore.accessToken) return true;
    if (!isNativePlatform()) {
      // Check sessionStorage (same tab) and localStorage (rememberMe / new window)
      try {
        return !!sessionStorage.getItem(KEYS.USER_DATA)
          || !!sessionStorage.getItem(KEYS.REFRESH_TOKEN)
          || !!localStorage.getItem(KEYS.REFRESH_TOKEN);
      } catch {
        return false;
      }
    }
    return false;
  },

  // ============= SYNC ACCESS TOKEN (for API headers) =============

  getAccessTokenSync(): string | null {
    return memoryStore.accessToken || null;
  },
};

// ============= AUTH API HELPER =============

export const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = await tokenStorageService.getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const getAuthHeadersSync = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = tokenStorageService.getAccessTokenSync();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export default tokenStorageService;