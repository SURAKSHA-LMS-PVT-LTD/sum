import { apiCache } from '@/utils/apiCache';
import {
  getAttendanceUrl,
  getApiHeadersAsync,
  getCredentialsMode,
  refreshAccessToken,
} from '@/contexts/utils/auth.api';
import { parseApiError, ApiError } from '@/api/apiError';

export interface CachedRequestOptions {
  ttl?: number;
  forceRefresh?: boolean;
  useStaleWhileRevalidate?: boolean;
}

class AttendanceApiClient {
  private pendingRequests = new Map<string, Promise<any>>();
  private readonly PENDING_REQUEST_TTL = 30000;
  private requestCooldown = new Map<string, number>();
  private readonly COOLDOWN_PERIOD = 1000;
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  /**
   * Handle 401 by refreshing the token.
   * Dispatches auth:refresh-failed on failure — AuthContext handles full logout.
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
    return `attendance_${endpoint}_${JSON.stringify(params || {})}`;
  }

  private isInCooldown(requestKey: string): boolean {
    const lastRequestTime = this.requestCooldown.get(requestKey);
    if (!lastRequestTime) return false;
    return Date.now() - lastRequestTime < this.COOLDOWN_PERIOD;
  }

  private setCooldown(requestKey: string): void {
    this.requestCooldown.set(requestKey, Date.now());
  }

  private async getHeaders(): Promise<Record<string, string>> {
    return getApiHeadersAsync();
  }

  async get<T = any>(
    endpoint: string,
    params?: Record<string, any>,
    options: CachedRequestOptions = {},
  ): Promise<T> {
    const { forceRefresh = false, ttl = 30 } = options;
    const requestKey = this.generateRequestKey(endpoint, params);

    // During cooldown try stale cache first, then proceed (never throw immediately)
    if (this.isInCooldown(requestKey) && !forceRefresh) {
      try {
        const staleCached = await apiCache.getCache<T>(requestKey, params, {
          ttl: 999999,
          forceRefresh: false,
        });
        if (staleCached !== null) return staleCached;
      } catch {}
      // No cache — fall through and make the request anyway
    }

    if (!forceRefresh) {
      try {
        const cachedData = await apiCache.getCache<T>(requestKey, params, { ttl, forceRefresh });
        if (cachedData !== null) return cachedData;
      } catch {}
    }

    if (this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey)!;
    }

    const requestPromise = this.executeRequest<T>(endpoint, params, ttl);
    this.pendingRequests.set(requestKey, requestPromise);
    this.setCooldown(requestKey);

    requestPromise
      .finally(() => {
        this.pendingRequests.delete(requestKey);
        setTimeout(() => this.requestCooldown.delete(requestKey), this.PENDING_REQUEST_TTL);
      })
      .catch(() => {});

    return requestPromise;
  }

  private async executeRequest<T>(
    endpoint: string,
    params?: Record<string, any>,
    ttl: number = 30,
  ): Promise<T> {
    const baseUrl = getAttendanceUrl();
    if (!baseUrl) {
      throw new ApiError({
        success: false,
        statusCode: 0,
        message: 'Attendance service is not configured.',
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

    // Platform-aware credentials — 'include' on web, 'omit' on mobile (Capacitor)
    const credentials = getCredentialsMode();

    try {
      const headers = await this.getHeaders();
      const response = await fetch(url.toString(), { method: 'GET', headers, credentials });

      // Reject ngrok warning pages
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('text/html')) {
        const htmlContent = await response.text();
        if (htmlContent.includes('ngrok') && htmlContent.includes('You are about to visit')) {
          throw new ApiError({
            success: false,
            statusCode: 0,
            message: 'The attendance server is not reachable. Please try again.',
            error: 'NetworkError',
            requestId: 'unknown',
            timestamp: new Date().toISOString(),
          });
        }
        throw new ApiError({
          success: false,
          statusCode: response.status || 0,
          message: 'Unexpected response from the server. Please try again later.',
          error: 'UnexpectedResponse',
          requestId: 'unknown',
          timestamp: new Date().toISOString(),
        });
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');

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
            const retryContentType = retryResponse.headers.get('Content-Type') || '';
            const retryData: T = retryContentType.includes('application/json')
              ? await retryResponse.json()
              : ({} as T);
            const requestKey = this.generateRequestKey(endpoint, params);
            await apiCache.setCache(requestKey, retryData, params, ttl);
            return retryData;
          }
          throw parseApiError(401, errorText, url.toString());
        }

        throw parseApiError(response.status, errorText, url.toString());
      }

      let data: T;
      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (jsonError) {
          throw new ApiError({
            success: false,
            statusCode: 0,
            message: 'Unexpected response from the server. Please try again later.',
            error: 'ParseError',
            requestId: 'unknown',
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        try {
          data = await response.json();
        } catch {
          data = {} as T;
        }
      }

      try {
        const requestKey = this.generateRequestKey(endpoint, params);
        await apiCache.setCache(requestKey, data, params, ttl);
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
          message: 'Unable to connect to the attendance server. Please check your connection.',
          error: 'NetworkError',
          requestId: 'unknown',
          timestamp: new Date().toISOString(),
        });
      }
      throw error;
    }
  }

  clearPendingRequests(): void {
    this.pendingRequests.clear();
    this.requestCooldown.clear();
  }

  async patch<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.mutate<T>('PATCH', endpoint, body);
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.mutate<T>('DELETE', endpoint);
  }

  async post<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.mutate<T>('POST', endpoint, body);
  }

  private async mutate<T = any>(
    method: 'POST' | 'PATCH' | 'DELETE',
    endpoint: string,
    body?: any,
  ): Promise<T> {
    const baseUrl = getAttendanceUrl();
    if (!baseUrl) {
      throw new ApiError({
        success: false,
        statusCode: 0,
        message: 'Attendance service is not configured.',
        error: 'ConfigError',
        requestId: 'unknown',
        timestamp: new Date().toISOString(),
      });
    }

    const url = `${baseUrl}${endpoint}`;
    const credentials = getCredentialsMode();

    try {
      const headers = await this.getHeaders();
      const response = await fetch(url, {
        method,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        credentials,
      });

      const contentType = response.headers.get('Content-Type') || '';

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');

        if (response.status === 401) {
          const refreshed = await this.handle401Error();
          if (refreshed) {
            const retryHeaders = await this.getHeaders();
            const retryResponse = await fetch(url, {
              method,
              headers: { ...retryHeaders, 'Content-Type': 'application/json' },
              body: body ? JSON.stringify(body) : undefined,
              credentials,
            });
            if (!retryResponse.ok) {
              const retryErrorText = await retryResponse.text().catch(() => '');
              throw parseApiError(retryResponse.status, retryErrorText, url);
            }
            const retryContentType = retryResponse.headers.get('Content-Type') || '';
            return retryContentType.includes('application/json')
              ? await retryResponse.json()
              : ({} as T);
          }
          throw parseApiError(401, errorText, url);
        }

        throw parseApiError(response.status, errorText, url);
      }

      let data: T;
      if (contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch {
          throw new ApiError({
            success: false,
            statusCode: 0,
            message: 'Unexpected response from the server.',
            error: 'ParseError',
            requestId: 'unknown',
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        data = {} as T;
      }

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
          message: 'Unable to connect to the attendance server. Please check your connection.',
          error: 'NetworkError',
          requestId: 'unknown',
          timestamp: new Date().toISOString(),
        });
      }
      throw error;
    }
  }
}

export const attendanceApiClient = new AttendanceApiClient();
