import { getBaseUrl, getBaseUrl2, getApiHeadersAsync, refreshAccessToken, getCredentialsMode, getOrgAccessTokenAsync, isNativePlatform } from '@/contexts/utils/auth.api';
import { ApiError, parseApiError } from '@/api/apiError';
import { UserType } from './userTypes.api'; // Import UserType

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
  userType?: UserType;
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

    if (this.useBaseUrl2) {
      const orgToken = await getOrgAccessTokenAsync();
      if (orgToken) {
        headers['Authorization'] = `Bearer ${orgToken}`;
      }
    }

    return headers;
  }

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
      } catch (error: any) {
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

      if (response.status === 401 && retryFn) {
        const refreshed = await this.handle401Error();
        if (refreshed) {
          const retryResponse = await retryFn();
          return this.handleResponse<T>(retryResponse);
        }
        throw apiError;
      }

      if (this.isRetryableError(response.status) && retryCount < 3 && retryFn) {
        const delay = this.getRetryDelay(retryCount);
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

  private isRetryableError(status: number): boolean {
    return [503, 504, 502, 0].includes(status);
  }

  private getRetryDelay(retryCount: number): number {
    return Math.min(1000 * Math.pow(2, retryCount), 10000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${this.getCurrentBaseUrl()}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const makeRequest = async () => fetch(url.toString(), { method: 'GET', headers: await this.getHeaders(), credentials: getCredentialsMode() });
    const response = await makeRequest();
    return this.handleResponse<T>(response, makeRequest);
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    const makeRequest = async () => {
      const headers = await this.getHeaders();
      let body: any = data ? JSON.stringify(data) : undefined;
      if (data instanceof FormData) {
        body = data;
        delete headers['Content-Type'];
      }
      return fetch(`${this.getCurrentBaseUrl()}${endpoint}`, { method: 'POST', headers, body, credentials: getCredentialsMode() });
    };
    const response = await makeRequest();
    return this.handleResponse<T>(response, makeRequest);
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    const makeRequest = async () => fetch(`${this.getCurrentBaseUrl()}${endpoint}`, { method: 'PUT', headers: await this.getHeaders(), body: data ? JSON.stringify(data) : undefined, credentials: getCredentialsMode() });
    const response = await makeRequest();
    return this.handleResponse<T>(response, makeRequest);
  }

  async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    const makeRequest = async () => fetch(`${this.getCurrentBaseUrl()}${endpoint}`, { method: 'PATCH', headers: await this.getHeaders(), body: data ? JSON.stringify(data) : undefined, credentials: getCredentialsMode() });
    const response = await makeRequest();
    return this.handleResponse<T>(response, makeRequest);
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    const makeRequest = async () => fetch(`${this.getCurrentBaseUrl()}${endpoint}`, { method: 'DELETE', headers: await this.getHeaders(), credentials: getCredentialsMode() });
    const response = await makeRequest();
    return this.handleResponse<T>(response, makeRequest);
  }
}

export const apiClient = new ApiClient();
