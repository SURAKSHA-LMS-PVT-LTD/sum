
import { apiCache } from '@/utils/apiCache';
import {
  getBaseUrl,
  getBaseUrl2,
  getApiHeadersAsync,
  refreshAccessToken,
  getCredentialsMode,
  getOrgAccessTokenAsync,
  removeOrgAccessTokenAsync,
  isNativePlatform,
  tokenStorageService,
} from '@/contexts/utils/auth.api';
import { parseApiError, ApiError } from '@/api/apiError';

export interface CachedRequestOptions {
  ttl?: number;
  forceRefresh?: boolean;
  useStaleWhileRevalidate?: boolean;
  userId?: string;
  role?: string;
  instituteId?: string;
  classId?: string;
  subjectId?: string;
}

class CachedApiClient {
  private useBaseUrl2: boolean = false;
  private pendingRequests = new Map<string, Promise<any>>();
  private readonly PENDING_REQUEST_TTL = 30000;
  private requestCooldown = new Map<string, number>();
  private readonly COOLDOWN_PERIOD = 1000;
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  private rateLimitedEndpoints = new Map<string, number>();
  private rateLimitedUntil: number = 0;

  private _globalForceRefresh: boolean = false;
  private _globalForceRefreshTimeout: ReturnType<typeof setTimeout> | null = null;

  private getCurrentBaseUrl(): string {
    return this.useBaseUrl2 ? getBaseUrl2() : getBaseUrl();
  }

  private throwApiError(status: number, errorText: string, url?: string): never {
    throw parseApiError(status, errorText, url);
  }

  private isRateLimited(endpoint?: string): boolean {
    const now = Date.now();
    if (endpoint) {
      const endpointLimit = this.rateLimitedEndpoints.get(endpoint);
      if (endpointLimit) {
        if (now < endpointLimit) return true;
        this.rateLimitedEndpoints.delete(endpoint);
      }
      return false;
    }
    if (now < this.rateLimitedUntil) return true;
    if (this.rateLimitedUntil > 0) this.rateLimitedUntil = 0;
    return false;
  }

  private setRateLimited(retryAfterSeconds?: number, endpoint?: string): void {
    const backoffMs = Math.min((retryAfterSeconds || 30) * 1000, 60000);
    if (endpoint) {
      this.rateLimitedEndpoints.set(endpoint, Date.now() + backoffMs);
    } else {
      this.rateLimitedUntil = Date.now() + backoffMs;
    }
  }

  public clearRateLimit(): void {
    this.rateLimitedUntil = 0;
    this.rateLimitedEndpoints.clear();
  }

  /**
   * Handle 401 by refreshing the token.
   * On failure dispatches auth:refresh-failed so AuthContext handles full logout.
   * Never hard-redirects — keeps React Router in control.
   */
  private async handle401Error(): Promise<boolean> {
    if (this.isRefreshing && this.refreshPromise) {
      try {
        await this.refreshPromise;
        return true;
      } catch {
        return false;
      }
    }

    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        await refreshAccessToken();
      } catch (error) {
        // Clear platform-aware storage
        await tokenStorageService.clearAll();
        if (!isNativePlatform()) {
          try { localStorage.removeItem('token'); } catch {}
          try { localStorage.removeItem('authToken'); } catch {}
        }
        if (this.useBaseUrl2) {
          await removeOrgAccessTokenAsync();
        }
        // Signal AuthContext — it owns the logout lifecycle
        window.dispatchEvent(new CustomEvent('auth:refresh-failed'));
        throw error;
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    })();

    try {
      await this.refreshPromise;
      return true;
    } catch {
      return false;
    }
  }

  private generateRequestKey(
    endpoint: string,
    params?: Record<string, any>,
    options?: CachedRequestOptions,
  ): string {
    const contextKey = {
      userId: options?.userId,
      role: options?.role,
      instituteId: options?.instituteId,
      classId: options?.classId,
      subjectId: options?.subjectId,
    };
    return `${endpoint}_${JSON.stringify(params || {})}_${JSON.stringify(contextKey)}`;
  }

  private isInCooldown(requestKey: string): boolean {
    const lastRequestTime = this.requestCooldown.get(requestKey);
    if (!lastRequestTime) return false;
    return Date.now() - lastRequestTime < this.COOLDOWN_PERIOD;
  }

  private setCooldown(requestKey: string): void {
    this.requestCooldown.set(requestKey, Date.now());
  }

  setUseBaseUrl2(use: boolean): void {
    this.useBaseUrl2 = use;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const headers = await getApiHeadersAsync();
    if (this.useBaseUrl2) {
      const orgToken = await getOrgAccessTokenAsync();
      if (orgToken) headers['Authorization'] = `Bearer ${orgToken}`;
    }
    return headers;
  }

  async get<T = any>(
    endpoint: string,
    params?: Record<string, any>,
    options: CachedRequestOptions = {},
  ): Promise<T> {
    const {
      forceRefresh: optionForceRefresh = false,
      ttl = 30,
      useStaleWhileRevalidate = true,
    } = options;

    const forceRefresh = optionForceRefresh || this._globalForceRefresh;
    const requestKey = this.generateRequestKey(endpoint, params, options);

    // Respect per-endpoint rate limit — return stale cache if available
    if (this.isRateLimited(endpoint)) {
      try {
        const cachedData = await apiCache.getCache<T>(endpoint, params, {
          ttl: ttl * 10,
          forceRefresh: false,
          ...options,
        });
        if (cachedData !== null) return cachedData;
      } catch {}
      throw parseApiError(429, JSON.stringify({ message: 'Too many requests. Please wait before trying again.' }), endpoint);
    }

    // Cache-first (unless force-refresh)
    if (!forceRefresh) {
      try {
        const cachedData = await apiCache.getCache<T>(endpoint, params, { ttl, forceRefresh, ...options });
        if (cachedData !== null) return cachedData;
      } catch {}
    }

    // Reuse in-flight request for the same key
    if (this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey)!;
    }

    // During cooldown try stale cache, then proceed (never throw)
    if (this.isInCooldown(requestKey) && !forceRefresh) {
      try {
        const staleCachedData = await apiCache.getCache<T>(endpoint, params, {
          ttl: 999999,
          forceRefresh: false,
          ...options,
        });
        if (staleCachedData !== null) return staleCachedData;
      } catch {}
    }

    const requestPromise = this.executeRequest<T>(endpoint, params, ttl, options);
    this.pendingRequests.set(requestKey, requestPromise);
    this.setCooldown(requestKey);

    requestPromise.finally(() => {
      this.pendingRequests.delete(requestKey);
      setTimeout(() => this.requestCooldown.delete(requestKey), this.PENDING_REQUEST_TTL);
    });

    return requestPromise;
  }

  private async executeRequest<T>(
    endpoint: string,
    params?: Record<string, any>,
    ttl: number = 30,
    options?: CachedRequestOptions,
  ): Promise<T> {
    const baseUrl = this.getCurrentBaseUrl();
    if (!baseUrl) {
      throw new ApiError({
        success: false,
        statusCode: 0,
        message: 'Backend URL not configured.',
        error: 'ConfigError',
        requestId: 'unknown',
        timestamp: new Date().toISOString(),
      });
    }

    const url = new URL(`${baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const credentials = getCredentialsMode();

    try {
      const headers = await this.getHeaders();
      const response = await fetch(url.toString(), { method: 'GET', headers, credentials });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');

        if (response.status === 429) {
          let retryAfter = 60;
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.details?.retryAfter) {
              const match = errorJson.details.retryAfter.match(/(\d+)/);
              if (match) retryAfter = parseInt(match[1], 10);
            }
          } catch {}
          this.setRateLimited(retryAfter, endpoint);
          throw parseApiError(429, errorText, url.toString());
        }

        if (response.status === 401) {
          const refreshed = await this.handle401Error();
          if (refreshed) {
            const retryHeaders = await this.getHeaders();
            const retryResponse = await fetch(url.toString(), {
              method: 'GET',
              headers: retryHeaders,
              credentials,
            });
            if (!retryResponse.ok) {
              const retryErrorText = await retryResponse.text().catch(() => '');
              throw parseApiError(retryResponse.status, retryErrorText, url.toString());
            }
            const retryContentType = retryResponse.headers.get('Content-Type');
            const retryData: T = retryContentType?.includes('application/json')
              ? await retryResponse.json()
              : ({} as T);
            await apiCache.setCache(endpoint, retryData, params, ttl, options);
            return retryData;
          }
          throw parseApiError(401, errorText, url.toString());
        }

        throw parseApiError(response.status, errorText, url.toString());
      }

      const contentType = response.headers.get('Content-Type');
      const data: T = contentType?.includes('application/json')
        ? await response.json()
        : ({} as T);

      try {
        await apiCache.setCache(endpoint, data, params, ttl, options);
      } catch {}

      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (
        error instanceof TypeError ||
        (error as any)?.message?.match(/^(Failed to fetch|NetworkError|Load failed|fetch failed)/i)
      ) {
        throw new ApiError({
          success: false,
          statusCode: 0,
          message: 'Unable to connect to the server. Please check your internet connection.',
          error: 'NetworkError',
          requestId: 'unknown',
          timestamp: new Date().toISOString(),
        });
      }
      throw error;
    }
  }

  async getCachedOnly<T = any>(endpoint: string, params?: Record<string, any>): Promise<T | null> {
    try {
      return await apiCache.getCache<T>(endpoint, params, { forceRefresh: false });
    } catch {
      return null;
    }
  }

  async hasCache(endpoint: string, params?: Record<string, any>): Promise<boolean> {
    try {
      const cached = await apiCache.getCache(endpoint, params, { forceRefresh: false });
      return cached !== null;
    } catch {
      return false;
    }
  }

  async preload<T = any>(endpoint: string, params?: Record<string, any>, ttl?: number): Promise<void> {
    try {
      await this.get<T>(endpoint, params, { ttl, forceRefresh: false });
    } catch {}
  }

  clearPendingRequests(): void {
    this.pendingRequests.clear();
    this.requestCooldown.clear();
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    const baseUrl = this.getCurrentBaseUrl();
    if (!baseUrl) this.throwApiError(0, 'Backend URL not configured.');
    const url = `${baseUrl}${endpoint}`;
    const credentials = getCredentialsMode();

    const headers = await this.getHeaders();
    let body: BodyInit | undefined;
    if (data instanceof FormData) {
      body = data;
      delete headers['Content-Type'];
    } else {
      body = data ? JSON.stringify(data) : undefined;
    }

    const response = await fetch(url, { method: 'POST', headers, body, credentials });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      if (response.status === 401) {
        const refreshed = await this.handle401Error();
        if (refreshed) {
          const retryHeaders = await this.getHeaders();
          let retryBody: BodyInit | undefined;
          if (data instanceof FormData) {
            retryBody = data;
            delete retryHeaders['Content-Type'];
          } else {
            retryBody = data ? JSON.stringify(data) : undefined;
          }
          const retryResponse = await fetch(url, {
            method: 'POST',
            headers: retryHeaders,
            body: retryBody,
            credentials,
          });
          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text().catch(() => '');
            throw parseApiError(retryResponse.status, retryErrorText, url);
          }
          const retryContentType = retryResponse.headers.get('Content-Type');
          return retryContentType?.includes('application/json')
            ? await retryResponse.json()
            : ({} as T);
        }
        throw parseApiError(401, errorText, url);
      }
      this.throwApiError(response.status, errorText, url);
    }

    const contentType = response.headers.get('Content-Type');
    return contentType?.includes('application/json') ? await response.json() : ({} as T);
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    const baseUrl = this.getCurrentBaseUrl();
    if (!baseUrl) this.throwApiError(0, 'Backend URL not configured.');
    const url = `${baseUrl}${endpoint}`;
    const credentials = getCredentialsMode();
    const headers = await this.getHeaders();
    const body = data ? JSON.stringify(data) : undefined;

    const response = await fetch(url, { method: 'PUT', headers, body, credentials });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      if (response.status === 401) {
        const refreshed = await this.handle401Error();
        if (refreshed) {
          const retryHeaders = await this.getHeaders();
          const retryResponse = await fetch(url, {
            method: 'PUT',
            headers: retryHeaders,
            body,
            credentials,
          });
          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text().catch(() => '');
            throw parseApiError(retryResponse.status, retryErrorText, url);
          }
          const retryContentType = retryResponse.headers.get('Content-Type');
          return retryContentType?.includes('application/json')
            ? await retryResponse.json()
            : ({} as T);
        }
        throw parseApiError(401, errorText, url);
      }
      this.throwApiError(response.status, errorText, url);
    }

    const contentType = response.headers.get('Content-Type');
    return contentType?.includes('application/json') ? await response.json() : ({} as T);
  }

  async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    const baseUrl = this.getCurrentBaseUrl();
    if (!baseUrl) this.throwApiError(0, 'Backend URL not configured.');
    const url = `${baseUrl}${endpoint}`;
    const credentials = getCredentialsMode();
    const headers = await this.getHeaders();
    const body = data ? JSON.stringify(data) : undefined;

    const response = await fetch(url, { method: 'PATCH', headers, body, credentials });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      if (response.status === 401) {
        const refreshed = await this.handle401Error();
        if (refreshed) {
          const retryHeaders = await this.getHeaders();
          const retryResponse = await fetch(url, {
            method: 'PATCH',
            headers: retryHeaders,
            body,
            credentials,
          });
          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text().catch(() => '');
            throw parseApiError(retryResponse.status, retryErrorText, url);
          }
          const retryContentType = retryResponse.headers.get('Content-Type');
          return retryContentType?.includes('application/json')
            ? await retryResponse.json()
            : ({} as T);
        }
        throw parseApiError(401, errorText, url);
      }
      this.throwApiError(response.status, errorText, url);
    }

    const contentType = response.headers.get('Content-Type');
    return contentType?.includes('application/json') ? await response.json() : ({} as T);
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    const baseUrl = this.getCurrentBaseUrl();
    if (!baseUrl) this.throwApiError(0, 'Backend URL not configured.');
    const url = `${baseUrl}${endpoint}`;
    const credentials = getCredentialsMode();
    const headers = await this.getHeaders();

    const response = await fetch(url, { method: 'DELETE', headers, credentials });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      if (response.status === 401) {
        const refreshed = await this.handle401Error();
        if (refreshed) {
          const retryHeaders = await this.getHeaders();
          const retryResponse = await fetch(url, {
            method: 'DELETE',
            headers: retryHeaders,
            credentials,
          });
          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text().catch(() => '');
            throw parseApiError(retryResponse.status, retryErrorText, url);
          }
          const retryContentType = retryResponse.headers.get('Content-Type');
          return retryContentType?.includes('application/json')
            ? await retryResponse.json()
            : ({} as T);
        }
        throw parseApiError(401, errorText, url);
      }
      this.throwApiError(response.status, errorText, url);
    }

    const contentType = response.headers.get('Content-Type');
    return contentType?.includes('application/json') ? await response.json() : ({} as T);
  }

  enableGlobalForceRefresh(durationMs: number = 10000): void {
    this._globalForceRefresh = true;
    if (this._globalForceRefreshTimeout) clearTimeout(this._globalForceRefreshTimeout);
    this._globalForceRefreshTimeout = setTimeout(() => {
      this._globalForceRefresh = false;
      this._globalForceRefreshTimeout = null;
    }, durationMs);
  }

  disableGlobalForceRefresh(): void {
    this._globalForceRefresh = false;
    if (this._globalForceRefreshTimeout) {
      clearTimeout(this._globalForceRefreshTimeout);
      this._globalForceRefreshTimeout = null;
    }
  }
}

export const cachedApiClient = new CachedApiClient();
