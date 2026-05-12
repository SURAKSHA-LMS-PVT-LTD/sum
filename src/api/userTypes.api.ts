import { enhancedCachedClient } from './enhancedCachedClient';

export interface UserType {
  id: string;
  instituteId: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  icon?: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionMatrix {
  [featureKey: string]: {
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canReport: boolean;
  };
}

export interface CreateUserTypePayload {
  name: string;
  slug: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

export interface UpdateUserTypePayload {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
  sortOrder?: number;
}

const TTL = 120; // 2 min cache for user types list

export const userTypesApi = {
  list: (instituteId: string): Promise<UserType[]> =>
    enhancedCachedClient.get<UserType[]>(
      `/institutes/${instituteId}/user-types`,
      {},
      { ttl: TTL, forceRefresh: false },
    ),

  get: (instituteId: string, typeId: string): Promise<UserType> =>
    enhancedCachedClient.get<UserType>(
      `/institutes/${instituteId}/user-types/${typeId}`,
      {},
      { ttl: TTL, forceRefresh: false },
    ),

  create: (instituteId: string, payload: CreateUserTypePayload): Promise<UserType> =>
    enhancedCachedClient.post<UserType>(
      `/institutes/${instituteId}/user-types`,
      payload,
      { instituteId },
    ),

  update: (instituteId: string, typeId: string, payload: UpdateUserTypePayload): Promise<UserType> =>
    enhancedCachedClient.patch<UserType>(
      `/institutes/${instituteId}/user-types/${typeId}`,
      payload,
      { instituteId },
    ),

  remove: (instituteId: string, typeId: string): Promise<void> =>
    enhancedCachedClient.delete(
      `/institutes/${instituteId}/user-types/${typeId}`,
      { instituteId },
    ),

  getPermissions: (instituteId: string, typeId: string): Promise<{ userTypeId: string; permissions: PermissionMatrix }> =>
    enhancedCachedClient.get(
      `/institutes/${instituteId}/user-types/${typeId}/permissions`,
      {},
      { ttl: TTL, forceRefresh: false },
    ),

  savePermissions: (
    instituteId: string,
    typeId: string,
    permissions: PermissionMatrix,
  ): Promise<{ success: boolean }> =>
    enhancedCachedClient.put(
      `/institutes/${instituteId}/user-types/${typeId}/permissions`,
      { permissions },
      { instituteId },
    ),

  assignUserType: (
    instituteId: string,
    userId: string,
    userTypeId: string,
  ): Promise<{ success: boolean }> =>
    enhancedCachedClient.patch(
      `/institutes/${instituteId}/users/${userId}/user-type`,
      { userTypeId },
      { instituteId },
    ),
};
