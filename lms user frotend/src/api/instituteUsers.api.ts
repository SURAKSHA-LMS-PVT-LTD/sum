import { getAttendanceUrl, getApiHeadersAsync, getBaseUrl } from '@/contexts/utils/auth.api';
import { apiClient } from './client';

// (existing interfaces)

class InstituteUsersApi {
  // (existing methods)

  async getUsersByInstituteAndType(
    instituteId: string,
    userTypeId: string,
    params: { page?: number; limit?: number; parent?: boolean } = {}
  ): Promise<UserListResponse> {
    const queryParams = new URLSearchParams({
      page: String(params.page || 1),
      limit: String(params.limit || 50),
      ...(params.parent !== undefined && { parent: String(params.parent) }),
    });

    const endpoint = `/institute-users/institute/${instituteId}/users/${userTypeId}?${queryParams}`;
    return apiClient.get(endpoint);
  }

  async updateInstituteUserExtraData(
    instituteId: string,
    userId: string,
    extraData: Record<string, any> | null,
  ): Promise<any> {
    const endpoint = `/institute-users/institute/${instituteId}/users/${userId}/extra-data`;
    return apiClient.patch(endpoint, { extraData });
  }
}

export const instituteUsersApi = new InstituteUsersApi();
