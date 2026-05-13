import { enhancedCachedClient } from './enhancedCachedClient';
import { apiClient } from './client';

export interface UserType {
  id: string;
  instituteId?: string;
  name: string;
  namePlural: string;
  slug: string;
  description?: string;
  color?: string;
  isSystemType: boolean;
  isPublic: boolean;
  isActive?: boolean;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export const userTypesApi = {
  async list(instituteId: string): Promise<UserType[]> {
    const result = await enhancedCachedClient.get<UserType[]>(
      `/user-types/institute/${instituteId}`,
    );
    return Array.isArray(result) ? result : [];
  },

  async listFresh(instituteId: string): Promise<UserType[]> {
    const result = await enhancedCachedClient.get<UserType[]>(
      `/user-types/institute/${instituteId}`,
      {},
      { forceRefresh: true },
    );
    return Array.isArray(result) ? result : [];
  },

  async getById(id: string): Promise<UserType> {
    return apiClient.get<UserType>(`/user-types/${id}`);
  },

  async create(instituteId: string, data: Omit<UserType, 'id' | 'slug' | 'isSystemType' | 'createdAt' | 'updatedAt'>): Promise<UserType> {
    return apiClient.post<UserType>(`/user-types/institute/${instituteId}`, data);
  },

  async update(id: string, data: Partial<Omit<UserType, 'id' | 'isSystemType' | 'createdAt' | 'updatedAt'>>): Promise<UserType> {
    return apiClient.patch<UserType>(`/user-types/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/user-types/${id}`);
  },
};
