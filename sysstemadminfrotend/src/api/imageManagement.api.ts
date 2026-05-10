import { apiRequest } from '@/lib/api';

// ========================================
// TYPES
// ========================================

export interface PendingUser {
  imageId: string | null;
  userId: string;
  nameWithInitials: string;
  email: string;
  phoneNumber: string | null;
  imageUrl: string;
  imageVerificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  scope: string | null;
  instituteId: string | null;
  imageUploadedAt: string;
  userType: string;
  isLegacy: boolean;
}

export interface PendingListResponse {
  users: PendingUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApproveImageResponse {
  success: boolean;
  message: string;
  userId: string;
  status: string;
  approvedBy: string;
  approvedAt: string;
  cardGenerated?: boolean;
  cardId?: string;
}

export interface RejectImageResponse {
  success: boolean;
  message: string;
  userId: string;
  rejectionReason: string;
  uploadUrl: string;
  expiresAt: string;
  emailSent: boolean;
  uploadToken: string;
}

export interface InstituteUserImage {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  imageUrl: string | null;
  instituteUserImageUrl: string | null;
  instituteCardId: string | null;
  imageVerificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | null;
  imageVerifiedBy: string | null;
  userIdByInstitute: string | null;
  status: string;
}

export interface InstitutePaginatedResponse {
  data: InstituteUserImage[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface UserLookupResponse {
  userId: string;
  name: string;
  email: string;
  userType: string;
  imageUrl: string | null;
  imageStatus: string;
}

// ========================================
// SYSTEM ADMIN API
// ========================================

export const imageManagementApi = {
  // --- System Admin: Global Image Queue ---
  getUnverifiedUsers: (params?: {
    status?: 'PENDING' | 'VERIFIED' | 'REJECTED';
    page?: number;
    limit?: number;
  }): Promise<PendingListResponse> => {
    const queryParams = new URLSearchParams();
    queryParams.append('status', params?.status || 'PENDING');
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.limit) queryParams.append('limit', String(params.limit));
    return apiRequest(`/admin/users/unverified?${queryParams.toString()}`);
  },

  approveImage: (userId: string, imageId?: string | null): Promise<ApproveImageResponse> => {
    const body: Record<string, unknown> = {};
    if (imageId != null) body.imageId = Number(imageId);
    return apiRequest(`/admin/users/${userId}/approve-image`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  rejectImage: (
    userId: string,
    rejectionReason: string,
    imageId?: string | null,
    options?: { urlValidityDays?: number }
  ): Promise<RejectImageResponse> => {
    const body: Record<string, unknown> = {
      rejectionReason,
      urlValidityDays: options?.urlValidityDays || 7,
    };
    if (imageId != null) body.imageId = Number(imageId);
    return apiRequest(`/admin/users/${userId}/reject-image`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  lookupUser: (userId: string): Promise<UserLookupResponse> =>
    apiRequest(`/admin/users/lookup/${userId}`),

  lookupStudent: (studentId: string): Promise<UserLookupResponse> =>
    apiRequest(`/admin/users/student/lookup/${studentId}`),

  // Admin upload for user
  generateProfileImageUrl: (data: {
    userId: string;
    fileName: string;
    contentType: string;
  }): Promise<{ uploadUrl: string; relativePath: string }> =>
    apiRequest('/admin/users/profile-image/generate-url', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  assignProfileImage: (data: {
    userId: string;
    imageUrl: string;
  }): Promise<{ success: boolean }> =>
    apiRequest('/admin/users/profile-image/assign', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Quick path: generate + assign for user
  quickUploadForUser: (
    userId: string,
    data: { fileName: string; contentType: string }
  ): Promise<{ uploadUrl: string; relativePath: string }> =>
    apiRequest(`/admin/users/${userId}/profile-image`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // --- Institute Admin: Institute-Level Images ---
  getInstituteImageVerification: (
    instituteId: string,
    params?: { page?: number; limit?: number; isVerified?: boolean }
  ): Promise<InstitutePaginatedResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.limit) queryParams.append('limit', String(params.limit));
    if (params?.isVerified !== undefined) queryParams.append('isVerified', String(params.isVerified));
    return apiRequest(
      `/institute-users/institute/${instituteId}/users/image-verification?${queryParams.toString()}`
    );
  },

  getInstitutePendingImages: (
    instituteId: string,
    params?: { page?: number; limit?: number; search?: string }
  ): Promise<InstitutePaginatedResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.limit) queryParams.append('limit', String(params.limit));
    if (params?.search) queryParams.append('search', params.search);
    return apiRequest(
      `/institute-users/institute/${instituteId}/users/unverified-with-images?${queryParams.toString()}`
    );
  },

  getInstitutePendingCount: (instituteId: string): Promise<{ count: number }> =>
    apiRequest(
      `/institute-users/institute/${instituteId}/users/unverified-with-images/count`
    ),

  verifyInstituteImage: (
    instituteId: string,
    userId: string,
    data: { status: 'VERIFIED' | 'REJECTED'; rejectionReason?: string }
  ): Promise<{ success: boolean; message: string; status: string }> =>
    apiRequest(
      `/institute-users/institute/${instituteId}/users/${userId}/verify-image`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  uploadInstituteUserImage: (
    instituteId: string,
    userId: string,
    imageUrl: string
  ): Promise<{ success: boolean }> =>
    apiRequest(
      `/institute-users/institute/${instituteId}/users/${userId}/upload-image`,
      {
        method: 'POST',
        body: JSON.stringify({ imageUrl }),
      }
    ),

  assignInstituteCardId: (
    instituteId: string,
    userId: string,
    cardId: string
  ): Promise<{ success: boolean; message: string; cardId: string }> =>
    apiRequest(
      `/institute-users/institute/${instituteId}/users/${userId}/assign-card-id`,
      {
        method: 'POST',
        body: JSON.stringify({ cardId }),
      }
    ),
};
