/**
 * Enhanced Cached API Client
 * Provides automatic caching with context awareness and cache invalidation.
 */

import { secureCache } from '@/utils/secureCache';
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

export interface EnhancedCacheOptions {
  ttl?: number;
  forceRefresh?: boolean;
  useStaleWhileRevalidate?: boolean;
  userId?: string;
  instituteId?: string;
  classId?: string;
  subjectId?: string;
  role?: string;
}

class EnhancedCachedApiClient {
  private useBaseUrl2: boolean = false;
  private pendingRequests = new Map<string, Promise<any>>();
  private readonly PENDING_REQUEST_TTL = 30000;
  private requestCooldown = new Map<string, number>();
  private readonly COOLDOWN_PERIOD = 1000;
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  private rateLimitedEndpoints = new Map<string, number>();
  private rateLimitedUntil: number = 0;
  private backgroundRevalidationPaused: boolean = false;

  private _globalForceRefresh: boolean = false;
  private _globalForceRefreshTimeout: ReturnType<typeof setTimeout> | null = null;

  private getCurrentBaseUrl(): string {
    return this.useBaseUrl2 ? getBaseUrl2() : getBaseUrl();
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
    if (this.rateLimitedUntil > 0) {
      this.rateLimitedUntil = 0;
      this.backgroundRevalidationPaused = false;
    }
    return false;
  }

  private setRateLimited(retryAfterSeconds?: number, endpoint?: string): void {
    const backoffMs = Math.min((retryAfterSeconds || 30) * 1000, 60000);
    if (endpoint) {
      this.rateLimitedEndpoints.set(endpoint, Date.now() + backoffMs);
    } else {
      this.rateLimitedUntil = Date.now() + backoffMs;
      this.backgroundRevalidationPaused = true;
    }
  }

  /**
   * Handle 401 by refreshing the token.
   * On failure dispatches auth:refresh-failed so AuthContext handles full logout.
   * Never hard-redirects — keeps React Router in control.
   */
  private async handle401Error(options?: EnhancedCacheOptions): Promise<boolean> {
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
        if (options?.userId) {
          await secureCache.clearUserCache(options.userId);
        }
      } catch (error) {
        await tokenStorageService.clearAll();
        if (!isNativePlatform()) {
          try { localStorage.removeItem('token'); } catch {}
          try { localStorage.removeItem('authToken'); } catch {}
        }
        if (this.useBaseUrl2) {
          await removeOrgAccessTokenAsync();
        }
        if (options?.userId) {
          await secureCache.clearUserCache(options.userId);
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

  private generateRequestKey(endpoint: string, params?: Record<string, any>): string {
    return `${endpoint}_${JSON.stringify(params || {})}`;
  }

  private isInCooldown(requestKey: string): boolean {
    const lastRequestTime = this.requestCooldown.get(requestKey);
    if (!lastRequestTime) return false;
    return Date.now() - lastRequestTime < this.COOLDOWN_PERIOD;
  }

  private setCooldown(requestKey: string): void {
    // Cap map size: if it somehow balloons (e.g. rapid unique-endpoint traffic),
    // clear all expired entries rather than letting it grow unbounded.
    if (this.requestCooldown.size > 2000) {
      const cutoff = Date.now() - this.COOLDOWN_PERIOD - 1000;
      for (const [k, t] of this.requestCooldown.entries()) {
        if (t < cutoff) this.requestCooldown.delete(k);
      }
    }
    this.requestCooldown.set(requestKey, Date.now());
    setTimeout(() => this.requestCooldown.delete(requestKey), this.COOLDOWN_PERIOD + 1000);
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

  private extractContext(options: EnhancedCacheOptions) {
    return {
      userId: options.userId,
      instituteId: options.instituteId,
      classId: options.classId,
      subjectId: options.subjectId,
      role: options.role,
    };
  }

  async get<T = any>(
    endpoint: string,
    params?: Record<string, any>,
    options: EnhancedCacheOptions = {},
  ): Promise<T> {
    const { forceRefresh: optionForceRefresh = false, ttl = 150, useStaleWhileRevalidate = false } = options;
    const forceRefresh = optionForceRefresh || this._globalForceRefresh;
    const requestKey = this.generateRequestKey(endpoint, params);

    // Per-endpoint rate limit — serve stale cache if available
    if (this.isRateLimited(endpoint)) {
      try {
        const cachedData = await secureCache.getCache<T>(endpoint, params, {
          context: this.extractContext(options),
          ttl: ttl * 10,
          forceRefresh: false,
        });
        if (cachedData !== null) return cachedData;
      } catch {}
      throw parseApiError(429, JSON.stringify({ message: 'Too many requests. Please wait a moment and try again.' }), endpoint);
    }

    if (!forceRefresh) {
      try {
        const cachedData = await secureCache.getCache<T>(endpoint, params, {
          context: this.extractContext(options),
          ttl,
          forceRefresh,
        });
        if (cachedData !== null) {
          if (useStaleWhileRevalidate) {
            this.revalidateInBackground(endpoint, params, options, ttl);
          }
          return cachedData;
        }
      } catch {}
    }

    if (this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey)!;
    }

    if (!forceRefresh && this.isInCooldown(requestKey)) {
      try {
        const staleCached = await secureCache.getCache<T>(endpoint, params, {
          context: this.extractContext(options),
          ttl: ttl * 2,
          forceRefresh: false,
        });
        if (staleCached !== null) return staleCached;
      } catch {}
    }

    const requestPromise = this.executeRequest<T>(endpoint, params, options, ttl);
    this.pendingRequests.set(requestKey, requestPromise);
    this.setCooldown(requestKey);
    requestPromise.finally(() => this.pendingRequests.delete(requestKey));

    return requestPromise;
  }

  private activeRevalidations = new Set<string>();

  private async revalidateInBackground<T>(
    endpoint: string,
    params: Record<string, any> | undefined,
    options: EnhancedCacheOptions,
    ttl: number,
  ): Promise<void> {
    const revalKey = this.generateRequestKey(endpoint, params);
    if (this.activeRevalidations.has(revalKey) || this.backgroundRevalidationPaused || this.isRateLimited()) {
      return;
    }
    this.activeRevalidations.add(revalKey);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      if (this.backgroundRevalidationPaused || this.isRateLimited()) return;
      await this.executeRequest<T>(endpoint, params, options, ttl);
    } catch {
      // Background revalidation failures are non-fatal
    } finally {
      this.activeRevalidations.delete(revalKey);
    }
  }

  private async executeRequest<T>(
    endpoint: string,
    params?: Record<string, any>,
    options: EnhancedCacheOptions = {},
    ttl: number = 30,
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
          const refreshed = await this.handle401Error(options);
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
            await secureCache.setCache(endpoint, retryData, params, {
              ttl,
              context: this.extractContext(options),
            });
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
        await secureCache.setCache(endpoint, data, params, {
          ttl,
          context: this.extractContext(options),
        });
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

  async post<T = any>(endpoint: string, data?: any, options: EnhancedCacheOptions = {}): Promise<T> {
    const baseUrl = this.getCurrentBaseUrl();
    if (!baseUrl) throw new ApiError({ success: false, statusCode: 0, message: 'Backend URL not configured.', error: 'ConfigError', requestId: 'unknown', timestamp: new Date().toISOString() });

    const url = `${baseUrl}${endpoint}`;
    const headers = await this.getHeaders();
    const credentials = getCredentialsMode();

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
        const refreshed = await this.handle401Error(options);
        if (refreshed) {
          const retryHeaders = await this.getHeaders();
          let retryBody: BodyInit | undefined;
          if (data instanceof FormData) {
            retryBody = data;
            delete retryHeaders['Content-Type'];
          } else {
            retryBody = data ? JSON.stringify(data) : undefined;
          }
          const retryResponse = await fetch(url, { method: 'POST', headers: retryHeaders, body: retryBody, credentials });
          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text().catch(() => '');
            throw parseApiError(retryResponse.status, retryErrorText, url);
          }
          const retryContentType = retryResponse.headers.get('Content-Type');
          const retryResult = retryContentType?.includes('application/json') ? await retryResponse.json() : ({} as T);
          await secureCache.invalidateOnMutation('POST', endpoint, this.extractContext(options));
          return retryResult;
        }
        throw parseApiError(401, errorText, url);
      }
      throw parseApiError(response.status, errorText, url);
    }

    const contentType = response.headers.get('Content-Type');
    const result = contentType?.includes('application/json') ? await response.json() : ({} as T);
    await secureCache.invalidateOnMutation('POST', endpoint, this.extractContext(options));
    return result;
  }

  async put<T = any>(endpoint: string, data?: any, options: EnhancedCacheOptions = {}): Promise<T> {
    const baseUrl = this.getCurrentBaseUrl();
    if (!baseUrl) throw new ApiError({ success: false, statusCode: 0, message: 'Backend URL not configured.', error: 'ConfigError', requestId: 'unknown', timestamp: new Date().toISOString() });

    const url = `${baseUrl}${endpoint}`;
    const headers = await this.getHeaders();
    const credentials = getCredentialsMode();
    const body = data ? JSON.stringify(data) : undefined;

    const response = await fetch(url, { method: 'PUT', headers, body, credentials });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      if (response.status === 401) {
        const refreshed = await this.handle401Error(options);
        if (refreshed) {
          const retryHeaders = await this.getHeaders();
          const retryResponse = await fetch(url, { method: 'PUT', headers: retryHeaders, body, credentials });
          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text().catch(() => '');
            throw parseApiError(retryResponse.status, retryErrorText, url);
          }
          const retryContentType = retryResponse.headers.get('Content-Type');
          const retryResult = retryContentType?.includes('application/json') ? await retryResponse.json() : ({} as T);
          await secureCache.invalidateOnMutation('PUT', endpoint, this.extractContext(options));
          return retryResult;
        }
        throw parseApiError(401, errorText, url);
      }
      throw parseApiError(response.status, errorText, url);
    }

    const contentType = response.headers.get('Content-Type');
    const result = contentType?.includes('application/json') ? await response.json() : ({} as T);
    await secureCache.invalidateOnMutation('PUT', endpoint, this.extractContext(options));
    return result;
  }

  async patch<T = any>(endpoint: string, data?: any, options: EnhancedCacheOptions = {}): Promise<T> {
    const baseUrl = this.getCurrentBaseUrl();
    if (!baseUrl) throw new ApiError({ success: false, statusCode: 0, message: 'Backend URL not configured.', error: 'ConfigError', requestId: 'unknown', timestamp: new Date().toISOString() });

    const url = `${baseUrl}${endpoint}`;
    const headers = await this.getHeaders();
    const credentials = getCredentialsMode();
    const body = data ? JSON.stringify(data) : undefined;

    const response = await fetch(url, { method: 'PATCH', headers, body, credentials });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      if (response.status === 401) {
        const refreshed = await this.handle401Error(options);
        if (refreshed) {
          const retryHeaders = await this.getHeaders();
          const retryResponse = await fetch(url, { method: 'PATCH', headers: retryHeaders, body, credentials });
          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text().catch(() => '');
            throw parseApiError(retryResponse.status, retryErrorText, url);
          }
          const retryContentType = retryResponse.headers.get('Content-Type');
          const retryResult = retryContentType?.includes('application/json') ? await retryResponse.json() : ({} as T);
          await secureCache.invalidateOnMutation('PATCH', endpoint, this.extractContext(options));
          return retryResult;
        }
        throw parseApiError(401, errorText, url);
      }
      throw parseApiError(response.status, errorText, url);
    }

    const contentType = response.headers.get('Content-Type');
    const result = contentType?.includes('application/json') ? await response.json() : ({} as T);
    await secureCache.invalidateOnMutation('PATCH', endpoint, this.extractContext(options));
    return result;
  }

  async delete<T = any>(endpoint: string, options: EnhancedCacheOptions = {}): Promise<T> {
    const baseUrl = this.getCurrentBaseUrl();
    if (!baseUrl) throw new ApiError({ success: false, statusCode: 0, message: 'Backend URL not configured.', error: 'ConfigError', requestId: 'unknown', timestamp: new Date().toISOString() });

    const url = `${baseUrl}${endpoint}`;
    const headers = await this.getHeaders();
    const credentials = getCredentialsMode();

    const response = await fetch(url, { method: 'DELETE', headers, credentials });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      if (response.status === 401) {
        const refreshed = await this.handle401Error(options);
        if (refreshed) {
          const retryHeaders = await this.getHeaders();
          const retryResponse = await fetch(url, { method: 'DELETE', headers: retryHeaders, credentials });
          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text().catch(() => '');
            throw parseApiError(retryResponse.status, retryErrorText, url);
          }
          const retryContentType = retryResponse.headers.get('Content-Type');
          const retryResult = retryContentType?.includes('application/json') ? await retryResponse.json() : ({} as T);
          await secureCache.invalidateOnMutation('DELETE', endpoint, this.extractContext(options));
          return retryResult;
        }
        throw parseApiError(401, errorText, url);
      }
      throw parseApiError(response.status, errorText, url);
    }

    const contentType = response.headers.get('Content-Type');
    const result = contentType?.includes('application/json') ? await response.json() : ({} as T);
    await secureCache.invalidateOnMutation('DELETE', endpoint, this.extractContext(options));
    return result;
  }

  async hasCache(endpoint: string, params?: Record<string, any>, context?: any): Promise<boolean> {
    try {
      const cached = await secureCache.getCache(endpoint, params, { context, forceRefresh: false });
      return cached !== null;
    } catch {
      return false;
    }
  }

  async getCachedOnly<T = any>(endpoint: string, params?: Record<string, any>, context?: any): Promise<T | null> {
    try {
      return await secureCache.getCache<T>(endpoint, params, { context, forceRefresh: false });
    } catch {
      return null;
    }
  }

  async preload<T = any>(endpoint: string, params?: Record<string, any>, options: EnhancedCacheOptions = {}): Promise<void> {
    try {
      await this.get<T>(endpoint, params, { ...options, forceRefresh: false });
    } catch {}
  }

  clearPendingRequests(): void {
    this.pendingRequests.clear();
    this.requestCooldown.clear();
  }

  async getCacheStats() {
    return await secureCache.getCacheStats();
  }

  async clearAllCache(): Promise<void> {
    await secureCache.clearAllCache();
  }

  async clearUserCache(userId: string): Promise<void> {
    await secureCache.clearUserCache(userId);
  }

  async clearInstituteCache(instituteId: string): Promise<void> {
    await secureCache.clearInstituteCache(instituteId);
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

  invalidate(_prefix?: string): void {
    // Clear all cache so mutated resources are re-fetched on next request.
    // secureCache's prefix-clearing is internal; a full clear is safe here
    // because this is only called after explicit create/update/delete mutations.
    secureCache.clearAllCache().catch(() => {});
  }
}

export const enhancedCachedClient = new EnhancedCachedApiClient();
