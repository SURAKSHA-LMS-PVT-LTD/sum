import { apiRequest } from '@/lib/api';
import { 
  CreateFamilyUnitRequest, 
  CreateFamilyUnitResponse,
  IncompleteProfile,
  BulkCreateResult
} from '@/types/user.types';

export const systemAdminUserApi = {
  /**
   * Create a single family unit with optional institute enrollment
   * Supports nested structure: Institute > Class > Subject
   */
  createFamilyUnit: (data: CreateFamilyUnitRequest): Promise<CreateFamilyUnitResponse> =>
    apiRequest('/admin/users/family-unit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Bulk create family units
   */
  bulkCreateFamilyUnits: (
    families: CreateFamilyUnitRequest[],
    options?: {
      continueOnError?: boolean;
      sendWelcomeNotifications?: boolean;
      autoActivateEnrollments?: boolean;
    }
  ): Promise<BulkCreateResult> =>
    apiRequest('/admin/users/family-units/bulk', {
      method: 'POST',
      body: JSON.stringify({
        families,
        continueOnError: options?.continueOnError ?? true,
        sendWelcomeNotifications: options?.sendWelcomeNotifications ?? true,
        autoActivateEnrollments: options?.autoActivateEnrollments ?? true,
      }),
    }),

  /**
   * Get incomplete profiles
   */
  getIncompleteProfiles: (params?: {
    page?: number;
    limit?: number;
    profileStatus?: string[];
    createdByAdminId?: string;
  }): Promise<{
    data: IncompleteProfile[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.limit) queryParams.append('limit', String(params.limit));
    if (params?.profileStatus) queryParams.append('profileStatus', params.profileStatus.join(','));
    if (params?.createdByAdminId) queryParams.append('createdByAdminId', params.createdByAdminId);
    return apiRequest(`/admin/users/incomplete-profiles?${queryParams.toString()}`);
  },

  /**
   * Complete first login for a user
   */
  completeFirstLogin: (
    userId: string,
    data: {
      password: string;
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      gender?: string;
    }
  ) =>
    apiRequest(`/admin/users/first-login/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /**
   * Resend welcome notification
   */
  resendWelcomeNotification: (userId: string) =>
    apiRequest(`/admin/users/${userId}/resend-welcome`, {
      method: 'POST',
    }),
};
