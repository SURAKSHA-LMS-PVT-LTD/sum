import { getBaseUrl, getBaseUrl2, getApiHeadersAsync, refreshAccessToken, getCredentialsMode, getOrgAccessTokenAsync, isNativePlatform } from '@/contexts/utils/auth.api';
import { ApiError, parseApiError } from '@/api/apiError';

export type { ApiError };

export interface ApiResponse<T = any> {
  data?: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
    previousPage: number | null;
    nextPage: number | null;
  };
  success?: boolean;
  message?: string;
  error?: string;
}

class ApiClient {
  private useBaseUrl2 = false;
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;

  setUseBaseUrl2(use: boolean) {
    this.useBaseUrl2 = use;
  }

  private getCurrentBaseUrl(): string {
    return this.useBaseUrl2 ? getBaseUrl2() : getBaseUrl();
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const headers = await getApiHeadersAsync();

    // Add organization-specific token if using baseUrl2
    if (this.useBaseUrl2) {
      const orgToken = await getOrgAccessTokenAsync();
      if (orgToken) {
        headers['Authorization'] = `Bearer ${orgToken}`;
      }
    }

    return headers;
  }

  /**
   * Handle 401 errors by refreshing token and retrying.
   * Never hard-redirects — dispatches auth:refresh-failed so AuthContext handles logout.
   */
  private async handle401Error(): Promise<boolean> {
    // If already refreshing, wait for the refresh to complete
    if (this.isRefreshing && this.refreshPromise) {
      try {
        await this.refreshPromise;
        return true;
      } catch {
        return false;
      }
    }

    // Start token refresh
    this.isRefreshing = true;
    this.refreshPromise = (async () => {
      try {
        if (import.meta.env.DEV) console.log('🔄 401 Error - Attempting token refresh...');
        await refreshAccessToken();
        if (import.meta.env.DEV) console.log('✅ Token refreshed successfully');
      } catch (error: any) {
        if (import.meta.env.DEV) console.error('❌ Token refresh failed:', error);
        // Do NOT hard-redirect. auth.api's refreshAccessToken already
        // dispatches auth:refresh-failed which AuthContext listens to.
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

  private async handleResponse<T>(
    response: Response,
    retryFn?: () => Promise<Response>,
    retryCount = 0
  ): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const apiError = parseApiError(response.status, errorText, response.url);

      if (import.meta.env.DEV) {
        console.error('API Error:', {
          status: response.status,
          url: response.url,
          error: apiError.errorType,
          message: apiError.message,
          requestId: apiError.requestId,
        });
      }

      // Handle 401 - Try to refresh token then retry with FRESH headers
      if (response.status === 401 && retryFn) {
        const refreshed = await this.handle401Error();

        if (refreshed) {
          if (import.meta.env.DEV) console.log('🔁 Retrying request with new token...');
          const retryResponse = await retryFn();
          return this.handleResponse<T>(retryResponse); // No retry to avoid infinite loop
        }

        throw apiError;
      }

      // Handle network errors with retry (503, 504, network timeout)
      if (this.isRetryableError(response.status) && retryCount < 3 && retryFn) {
        const delay = this.getRetryDelay(retryCount);
        console.log(`⏳ Retrying request in ${delay}ms (attempt ${retryCount + 1}/3)...`);

        await this.sleep(delay);
        const retryResponse = await retryFn();
        return this.handleResponse<T>(retryResponse, retryFn, retryCount + 1);
      }

      throw apiError;
    }

    const contentType = response.headers.get('Content-Type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }

    return {} as T;
  }


  /**
   * Check if error is retryable (network errors, server errors)
   */
  private isRetryableError(status: number): boolean {
    return status === 503 || status === 504 || status === 502 || status === 0;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private getRetryDelay(retryCount: number): number {
    return Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10 seconds
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const baseUrl = this.getCurrentBaseUrl();
    const url = new URL(`${baseUrl}${endpoint}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const credentials = getCredentialsMode();

    // Re-fetch headers on every call so retries use fresh tokens
    const makeRequest = async () => {
      const headers = await this.getHeaders();
      return fetch(url.toString(), {
        method: 'GET',
        headers,
        credentials
      });
    };

    const response = await makeRequest();
    return this.handleResponse<T>(response, makeRequest);
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    const baseUrl = this.getCurrentBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    const credentials = getCredentialsMode();

    const makeRequest = async () => {
      const headers = await this.getHeaders();
      let body: any;

      if (data instanceof FormData) {
        body = data;
        delete headers['Content-Type'];
      } else {
        body = data ? JSON.stringify(data) : undefined;
      }

      return fetch(url, {
        method: 'POST',
        headers,
        body,
        credentials
      });
    };

    const response = await makeRequest();
    return this.handleResponse<T>(response, makeRequest);
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    const baseUrl = this.getCurrentBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    const credentials = getCredentialsMode();

    const makeRequest = async () => {
      const headers = await this.getHeaders();
      return fetch(url, {
        method: 'PUT',
        headers,
        body: data ? JSON.stringify(data) : undefined,
        credentials
      });
    };

    const response = await makeRequest();
    return this.handleResponse<T>(response, makeRequest);
  }

  async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    const baseUrl = this.getCurrentBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    const credentials = getCredentialsMode();

    const makeRequest = async () => {
      const headers = await this.getHeaders();
      return fetch(url, {
        method: 'PATCH',
        headers,
        body: data ? JSON.stringify(data) : undefined,
        credentials
      });
    };

    const response = await makeRequest();
    return this.handleResponse<T>(response, makeRequest);
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    const baseUrl = this.getCurrentBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    const credentials = getCredentialsMode();

    const makeRequest = async () => {
      const headers = await this.getHeaders();
      return fetch(url, {
        method: 'DELETE',
        headers,
        credentials
      });
    };

    const response = await makeRequest();
    return this.handleResponse<T>(response, makeRequest);
  }
}

export const apiClient = new ApiClient();
