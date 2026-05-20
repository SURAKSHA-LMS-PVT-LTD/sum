import { apiClient } from './client';

export type ApiKeyScope = 'ATTENDANCE_MARK';

export interface InstituteApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyDto {
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: string;
}

export interface CreateApiKeyResponse {
  id: number;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
  key: string; // raw key — shown only once
  warning: string;
}

class InstituteApiKeysApi {
  async list(instituteId: string): Promise<InstituteApiKey[]> {
    return apiClient.get(`/institutes/${instituteId}/api-keys`);
  }

  async create(instituteId: string, dto: CreateApiKeyDto): Promise<CreateApiKeyResponse> {
    return apiClient.post(`/institutes/${instituteId}/api-keys`, dto);
  }

  async revoke(instituteId: string, keyId: number): Promise<void> {
    return apiClient.delete(`/institutes/${instituteId}/api-keys/${keyId}`);
  }
}

export const instituteApiKeysApi = new InstituteApiKeysApi();
