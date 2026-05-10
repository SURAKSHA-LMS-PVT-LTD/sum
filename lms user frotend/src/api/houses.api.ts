import { apiClient } from './client';
import { enhancedCachedClient } from './enhancedCachedClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InstituteHouse {
  id: string;
  instituteId: string;
  name: string;
  color?: string;
  description?: string;
  imageUrl?: string;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  /** True only on the house the requesting user belongs to */
  isEnrolled?: boolean;
  /** ID of the house the user is enrolled in (same on every item in the list) */
  enrolledHouseId?: string | null;
}

export type HouseEnrollmentMethod = 'manual' | 'auto' | 'self';

export interface HouseMember {
  id: string;
  houseId: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  nameWithInitials?: string;
  email?: string;
  phoneNumber?: string;
  nic?: string;
  userIdByInstitute?: string;
  profileImageUrl?: string;
  instituteUserType?: string;
  enrollmentMethod: HouseEnrollmentMethod;
  isActive: boolean;
  enrolledAt?: string;
  createdAt: string;
}

export interface HouseActionResponse {
  success: boolean;
  message: string;
}

export interface CreateInstituteHousePayload {
  name: string;
  color?: string;
  description?: string;
  imageUrl?: string;
}

export interface UpdateInstituteHousePayload {
  name?: string;
  color?: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateInstituteHouseImagePayload {
  imageUrl: string;
}

export interface AssignUserToHousePayload {
  userId: string;
}

export interface BulkAssignUsersToHousePayload {
  userIds: string[];
}

export interface BulkAssignResult {
  userId: string;
  status: string;
}

export interface BulkAssignResponse {
  success: boolean;
  results: BulkAssignResult[];
}

export interface GetHouseMembersParams {
  isActive?: boolean;
  enrollmentMethod?: HouseEnrollmentMethod;
  page?: number;
  limit?: number;
}

export interface HouseMembersPagedResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  data: HouseMember[];
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const housesApi = {
  list: (instituteId: string, forceRefresh = false): Promise<InstituteHouse[]> =>
    enhancedCachedClient.get(
      `/institutes/${instituteId}/houses`,
      {},
      { ttl: 5, forceRefresh, useStaleWhileRevalidate: true, instituteId },
    ),

  getById: (instituteId: string, houseId: string, forceRefresh = false): Promise<InstituteHouse> =>
    enhancedCachedClient.get(
      `/institutes/${instituteId}/houses/${houseId}`,
      {},
      { ttl: 5, forceRefresh, useStaleWhileRevalidate: true, instituteId },
    ),

  create: (instituteId: string, data: CreateInstituteHousePayload): Promise<InstituteHouse> =>
    apiClient.post(`/institutes/${instituteId}/houses`, data),

  update: (
    instituteId: string,
    houseId: string,
    data: UpdateInstituteHousePayload,
  ): Promise<InstituteHouse> =>
    apiClient.patch(`/institutes/${instituteId}/houses/${houseId}`, data),

  delete: (instituteId: string, houseId: string): Promise<HouseActionResponse> =>
    apiClient.delete(`/institutes/${instituteId}/houses/${houseId}`),

  updateImage: (
    instituteId: string,
    houseId: string,
    data: UpdateInstituteHouseImagePayload,
  ): Promise<InstituteHouse> =>
    apiClient.put(`/institutes/${instituteId}/houses/${houseId}/image`, data),

  getMembers: (
    instituteId: string,
    houseId: string,
    params?: GetHouseMembersParams,
    forceRefresh = false,
  ): Promise<HouseMembersPagedResponse> =>
    enhancedCachedClient.get(
      `/institutes/${instituteId}/houses/${houseId}/members`,
      params ?? {},
      { ttl: 2, forceRefresh, useStaleWhileRevalidate: true, instituteId },
    ),

  assignMember: (
    instituteId: string,
    houseId: string,
    data: AssignUserToHousePayload,
  ): Promise<HouseActionResponse> =>
    apiClient.post(`/institutes/${instituteId}/houses/${houseId}/members`, data),

  bulkAssignMembers: (
    instituteId: string,
    houseId: string,
    data: BulkAssignUsersToHousePayload,
  ): Promise<BulkAssignResponse> =>
    apiClient.post(`/institutes/${instituteId}/houses/${houseId}/members/bulk`, data),

  removeMember: (
    instituteId: string,
    houseId: string,
    userId: string,
  ): Promise<HouseActionResponse> =>
    apiClient.delete(`/institutes/${instituteId}/houses/${houseId}/members/${userId}`),

  selfEnroll: (instituteId: string, houseId: string): Promise<HouseActionResponse> =>
    apiClient.post(`/institutes/${instituteId}/houses/${houseId}/enroll`, {}),
};
