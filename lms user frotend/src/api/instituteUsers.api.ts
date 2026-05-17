import { getAttendanceUrl, getApiHeadersAsync, getBaseUrl } from '@/contexts/utils/auth.api';
import { apiClient } from './client';

// (existing interfaces)

class InstituteUsersApi {
  // (existing methods)

  async getDesignTemplates(instituteId: string): Promise<any[]> {
    return apiClient.get(`/institutes/${instituteId}/design-templates`);
  }

  async saveDesignTemplates(instituteId: string, templates: any[]): Promise<any[]> {
    return apiClient.post(`/institutes/${instituteId}/design-templates`, { templates });
  }

  async getUsersByInstituteAndType(
    instituteId: string,
    userTypeId: string,
    params: { page?: number; limit?: number; parent?: boolean } = {}
  ): Promise<any> {
    const queryParams = new URLSearchParams({
      page: String(params.page || 1),
      limit: String(params.limit || 50),
      ...(params.parent !== undefined && { parent: String(params.parent) }),
    });

    const endpoint = `/institute-users/institute/${instituteId}/users-by-type/${userTypeId}?${queryParams}`;
    return apiClient.get(endpoint);
  }

  async updateInstituteUserExtraData(
    instituteId: string,
    userId: string,
    extraData: Record<string, any> | null,
  ): Promise<any> {
    const endpoint = `/institute-users/institute/${instituteId}/user/${userId}/extra-data`;
    return apiClient.patch(endpoint, { extraData });
  }
}

export const instituteUsersApi = new InstituteUsersApi();
