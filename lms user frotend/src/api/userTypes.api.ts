import { apiClient } from './client';
import { apiCache } from '@/utils/apiCache';
import { CACHE_TTL } from '@/config/cacheTTL';

export interface UserType {
  id: string;
  name: string;
  namePlural: string;
  slug: string;
  description?: string;
  color?: string;
  isSystemType: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

const API_BASE_PATH = '/user-types';

// Function to get the cache key
const getCacheKey = (instituteId: string) => `user_types_${instituteId}`;

export const userTypesApi = {
  /**
   * List all user types for an institute, with caching.
   * @param instituteId - The ID of the institute.
   * @returns A promise that resolves to an array of UserType objects.
   */
  async list(instituteId: string): Promise<UserType[]> {
    const cacheKey = getCacheKey(instituteId);
    const cachedData = apiCache.get<UserType[]>(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    const response = await apiClient.get<UserType[]>(`${API_BASE_PATH}/institute/${instituteId}`);
    
    if (response) { // apiClient might return null or throw on error
      // Use CACHE_TTL.USER_TYPES as medium cache duration for user types
      apiCache.set(cacheKey, response, undefined, CACHE_TTL.USER_TYPES); // Cache for configured minutes
      return response;
    }

    return [];
  },

  /**
   * Get a single user type by its ID.
   * @param id - The ID of the user type.
   * @returns A promise that resolves to a UserType object.
   */
  async getById(id: string): Promise<UserType> {
    // No caching for single GETs unless required, to ensure fresh data.
    return apiClient.get<UserType>(`${API_BASE_PATH}/${id}`);
  },

  /**
   * Create a new user type for an institute.
   * @param instituteId - The ID of the institute.
   * @param data - The data for the new user type.
   * @returns A promise that resolves to the created UserType object.
   */
  async create(instituteId: string, data: Omit<UserType, 'id' | 'isSystemType' | 'createdAt' | 'updatedAt'>): Promise<UserType> {
    const response = await apiClient.post<UserType>(`${API_BASE_PATH}/institute/${instituteId}`, data);
    
    // Invalidate cache on creation
    apiCache.invalidate(getCacheKey(instituteId));
    
    return response;
  },

  /**
   * Update an existing user type.
   * @param id - The ID of the user type to update.
   * @param data - The partial data to update.
   * @param instituteId - The institute ID to invalidate the cache for.
   * @returns A promise that resolves to the updated UserType object.
   */
  async update(id: string, data: Partial<Omit<UserType, 'id' | 'isSystemType' | 'createdAt' | 'updatedAt'>>, instituteId: string): Promise<UserType> {
    const response = await apiClient.patch<UserType>(`${API_BASE_PATH}/${id}`, data);

    // Invalidate cache on update
    apiCache.invalidate(getCacheKey(instituteId));
    
    return response;
  },

  /**
   * Delete a user type.
   * @param id - The ID of the user type to delete.
   * @param instituteId - The institute ID to invalidate the cache for.
   * @returns A promise that resolves when the deletion is complete.
   */
  async delete(id: string, instituteId: string): Promise<void> {
    await apiClient.delete(`${API_BASE_PATH}/${id}`);
    
    // Invalidate cache on deletion
    apiCache.invalidate(getCacheKey(instituteId));
  },
};
