import { apiClient } from './client';
import { getBaseUrl, getAccessTokenAsync } from '@/contexts/utils/auth.api';
import { parseApiError } from '@/api/apiError';

// =================== TYPES ===================

export type ImageVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface SignedUploadUrlRequest {
  folder: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

export interface SignedUploadUrlResponse {
  uploadUrl: string;
  relativePath: string;
  expiresAt: string;
  maxFileSize: number;
  contentType?: string;
  fields?: Record<string, string>; // AWS S3 POST fields
}

export interface SubmitProfileImageResponse {
  success: boolean;
  message: string;
  data: {
    userId: string;
    imageUrl: string;
    previousImagePreserved?: boolean;
    changesRemaining?: number;
  };
}

/** Status from GET /users/profile/image-status */
export interface ProfileImageStatus {
  userId: string;
  imageUrl: string | null;           // currently active (approved) image
  pendingImageUrl: string | null;    // image currently under admin review (null if not PENDING)
  pendingImageId: string | null;     // user_images record ID for the pending entry
  imageVerificationStatus: ImageVerificationStatus | null;
}

/** @deprecated Use ProfileImageStatus */
export type ImageStatusResponse = ProfileImageStatus;

/** Entry from GET /users/profile/image-history */
export interface ImageHistoryEntry {
  imageId: string;
  imageUrl: string;                  // WARNING: may be a dead URL if status === REJECTED
  scope: 'GLOBAL' | 'INSTITUTE';
  instituteId: string | null;
  status: ImageVerificationStatus;
  rejectionReason: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
  uploadedAt: string;
}

/** Entry from GET /users/:id/profile-image/institute/:instituteId/history */
export interface InstituteImageHistoryEntry {
  imageId: string;
  imageUrl: string;
  status: ImageVerificationStatus;
  rejectionReason: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  submittedAt: string;
}

/** Full response from GET /users/:id/profile-image/institute/:instituteId/history */
export interface InstituteImageHistoryResponse {
  success: boolean;
  currentInstituteImageUrl: string | null;
  currentInstituteImageStatus: ImageVerificationStatus | null;
  data: InstituteImageHistoryEntry[];
}

/** @deprecated history is now ImageHistoryEntry[] directly */
export interface ImageHistoryResponse {
  history: ImageHistoryEntry[];
}

/** Full response from GET /users/profile/image-history */
export interface ProfileImageHistoryResponse {
  success: boolean;
  currentImageUrl: string | null;
  currentStatus: ImageVerificationStatus | null;
  data: ImageHistoryEntry[];
}

// =================== INSTITUTE ADMIN TYPES ===================

/** Item from GET /institute-users/institute/:id/users/unverified-with-images */
export interface InstituteUnverifiedImageItem {
  userId: string;
  nameWithInitials: string | null;
  email: string | null;
  phoneNumber: string | null;
  instituteUserImageUrl: string;
  imageVerificationStatus: ImageVerificationStatus;
  instituteUserType: string | null;
  userIdByInstitute: string | null;
}

export interface InstituteUnverifiedImagesResponse {
  data: InstituteUnverifiedImageItem[];
  total: number;
  page: number;
  limit: number;
}

/** POST /institute-users/institute/:id/users/:userId/verify-image */
export interface VerifyInstituteUserImageDto {
  status: 'VERIFIED' | 'REJECTED';
  rejectionReason?: string | null;
}

// =================== ADMIN TYPES ===================

/** Item from GET /admin/users/unverified-images */
export interface AdminImageListItem {
  imageId: string;
  userId: string;
  nameWithInitials: string | null;
  email: string | null;
  phoneNumber: string | null;
  imageUrl: string;
  imageVerificationStatus: ImageVerificationStatus;
  scope: 'GLOBAL' | 'INSTITUTE';
  instituteId: string | null;
  imageUploadedAt: string;
  userType: string | null;
}

export interface AdminImageListResponse {
  users: AdminImageListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** PATCH /admin/users/:userId/approve-image */
export interface ApproveImageDto {
  imageId?: number;
  note?: string;
}

export interface ApproveImageResponse {
  success: boolean;
  message: string;
  userId: string;
  imageId: string;
  status: 'VERIFIED';
  approvedBy: string;
  approvedAt: string;
  cardGenerated?: boolean;
  cardId?: string;
}

/** PATCH /admin/users/:userId/reject-image */
export interface RejectImageDto {
  imageId?: number;
  rejectionReason: string;
  userEmail?: string;
  urlValidityDays?: number;
}

export interface RejectImageResponse {
  success: boolean;
  message: string;
  userId: string;
  imageId: string;
  rejectionReason: string;
  uploadUrl?: string;
  expiresAt?: string;
  emailSent?: boolean;
}

export interface ReuploadGenerateUrlRequest {
  token: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

export interface ReuploadSubmitRequest {
  token: string;
  imageUrl: string;
}

export interface ReuploadResponse {
  success: boolean;
  message: string;
  data: {
    userId: string;
    imageUrl: string;
    status: ImageVerificationStatus;
  };
}

// =================== CONSTANTS ===================

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const PROFILE_IMAGES_FOLDER = 'profile-images';

// =================== VALIDATION ===================

export function validateProfileImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Invalid file type. Only JPEG, PNG, and WebP are allowed.';
  }
  if (file.size > MAX_FILE_SIZE) {
    return 'File size exceeds the maximum limit of 5MB.';
  }
  return null;
}

// =================== API ===================

export const profileImageApi = {
  // ─── SIGNED UPLOAD URL ────────────────────────
  /** Step 1: Get a signed URL for uploading to cloud storage */
  generateSignedUrl: async (
    fileName: string,
    contentType: string,
    fileSize: number
  ): Promise<SignedUploadUrlResponse> => {
    // POST returns { success, data: { uploadUrl, relativePath, fields, ... } }
    const result = await apiClient.post<{ success: boolean; data: SignedUploadUrlResponse }>('/upload/generate-signed-url', {
      folder: PROFILE_IMAGES_FOLDER,
      fileName,
      contentType,
      fileSize,
    });
    // Unwrap data wrapper; fall back gracefully if server returns flat response
    return (result as any).data ?? result;
  },

  // ─── UPLOAD TO CLOUD STORAGE ──────────────────
  /** Step 2: Upload the file directly to the signed URL (S3 POST or GCS PUT) */
  uploadToStorage: async (uploadUrl: string, file: File, fields?: Record<string, string>): Promise<void> => {
    if (fields && Object.keys(fields).length > 0) {
      // AWS S3 — multipart POST, fields first then file last
      const formData = new FormData();
      Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
      formData.append('file', file);
      const response = await fetch(uploadUrl, { method: 'POST', body: formData });
      if (!response.ok && response.status !== 204) {
        throw new Error('Failed to upload file. Please try again.');
      }
    } else {
      // Legacy GCS PUT
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!response.ok) {
      throw new Error('Failed to upload file to cloud storage. Please try again.');
      }
    }
  },

  // ─── VERIFY AND PUBLISH ───────────────────────
  /** Step 3: Verify the S3 upload and get a permanent public URL */
  verifyAndPublish: async (relativePath: string): Promise<string> => {
    const token = await getAccessTokenAsync();
    const response = await fetch(`${getBaseUrl()}/upload/verify-and-publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ relativePath }),
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw parseApiError(response.status, errorText);
    }
    const data = await response.json();
    return data.publicUrl;
  },

  // ─── SUBMIT PROFILE IMAGE ────────────────────
  /** Submit the uploaded image URL to backend for admin review */
  submitProfileImage: async (
    userId: string,
    imageUrl: string,
    scope: 'GLOBAL' | 'INSTITUTE' = 'GLOBAL',
    instituteId?: string
  ): Promise<SubmitProfileImageResponse> => {
    return apiClient.post<SubmitProfileImageResponse>(
      `/users/${userId}/profile-image`,
      { imageUrl, scope, ...(instituteId ? { instituteId } : {}) }
    );
  },

  // ─── GET IMAGE STATUS ─────────────────────────
  /** Get current image verification status. imageUrl = last approved image (or null). */
  getImageStatus: async (): Promise<ProfileImageStatus> => {
    const result = await apiClient.get<{ success: boolean; data: ProfileImageStatus } | ProfileImageStatus>('/users/profile/image-status');
    return (result as any).data ?? result;
  },

  // ─── GET IMAGE HISTORY ────────────────────────
  /** Get all past image submissions, newest first, plus currentImageUrl/currentStatus */
  getImageHistory: async (): Promise<ProfileImageHistoryResponse> => {
    const result = await apiClient.get<ProfileImageHistoryResponse>('/users/profile/image-history');
    // Normalise: some older builds return { data: [] } without top-level fields
    return {
      success: (result as any).success ?? true,
      currentImageUrl: (result as any).currentImageUrl ?? null,
      currentStatus: (result as any).currentStatus ?? null,
      data: (result as any).data ?? (Array.isArray(result) ? result : []),
    };
  },

  // ─── UPLOAD ID DOCUMENT ───────────────────────
  /** POST /users/:userId/upload-id-document */
  uploadIdDocument: async (
    userId: string,
    idUrl: string
  ): Promise<{ success: boolean; message: string; data: { userId: string; idUrl: string } }> => {
    return apiClient.post(`/users/${userId}/upload-id-document`, { idUrl });
  },

  // ─── INSTITUTE IMAGE HISTORY ─────────────────
  /** GET /users/:id/profile-image/institute/:instituteId/history */
  getInstituteImageHistory: async (
    userId: string,
    instituteId: string
  ): Promise<InstituteImageHistoryResponse> => {
    const result = await apiClient.get<InstituteImageHistoryResponse>(
      `/users/${userId}/profile-image/institute/${instituteId}/history`
    );
    return {
      success: (result as any).success ?? true,
      currentInstituteImageUrl: (result as any).currentInstituteImageUrl ?? null,
      currentInstituteImageStatus: (result as any).currentInstituteImageStatus ?? null,
      data: (result as any).data ?? [],
    };
  },

  // ─── DELETE PENDING INSTITUTE IMAGE ──────────
  /** DELETE /users/:id/profile-image/institute/:instituteId — only works when status is PENDING */
  deleteInstituteImage: async (
    userId: string,
    instituteId: string
  ): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/users/${userId}/profile-image/institute/${instituteId}`);
  },

  /** GET /admin/users/unverified-images */
  getAdminUnverifiedImages: async (
    params: { status?: 'PENDING' | 'VERIFIED' | 'REJECTED'; page?: number; limit?: number } = {}
  ): Promise<AdminImageListResponse> => {
    const query = new URLSearchParams({
      status: params.status ?? 'PENDING',
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 20),
    });
    const result = await apiClient.get<AdminImageListResponse>(`/admin/users/unverified-images?${query}`);
    return result;
  },

  // ─── ADMIN: APPROVE IMAGE ─────────────────────
  /** PATCH /admin/users/:userId/approve-image */
  approveImage: async (userId: string, dto: ApproveImageDto): Promise<ApproveImageResponse> => {
    return apiClient.patch<ApproveImageResponse>(`/admin/users/${userId}/approve-image`, dto);
  },

  // ─── ADMIN: REJECT IMAGE ──────────────────────
  /** PATCH /admin/users/:userId/reject-image */
  rejectImage: async (userId: string, dto: RejectImageDto): Promise<RejectImageResponse> => {
    return apiClient.patch<RejectImageResponse>(`/admin/users/${userId}/reject-image`, dto);
  },

  // ─── RE-UPLOAD (PUBLIC, TOKEN-BASED) ──────────
  /** Generate upload URL for re-upload after rejection (token-based) */
  generateReuploadUrl: async (
    data: ReuploadGenerateUrlRequest
  ): Promise<SignedUploadUrlResponse> => {
    const result = await apiClient.post<{ success: boolean; data: SignedUploadUrlResponse }>(
      '/users/profile/image/reupload/generate-url',
      data
    );
    return (result as any).data ?? result;
  },

  /** Submit re-uploaded image after rejection (no JWT needed) */
  submitReupload: async (
    data: ReuploadSubmitRequest
  ): Promise<ReuploadResponse> => {
    return apiClient.post<ReuploadResponse>(
      '/users/profile/image/reupload',
      data
    );
  },

  // ─── FULL UPLOAD WORKFLOW ─────────────────────
  /**
   * Complete profile image upload workflow:
   * 1. Validate file
   * 2. Get signed URL
   * 3. Upload to cloud storage
   * 4. Submit to backend
   */
  uploadProfileImage: async (
    userId: string,
    file: File,
    onProgress?: (step: 'validating' | 'signing' | 'uploading' | 'submitting' | 'done', percent: number) => void
  ): Promise<SubmitProfileImageResponse> => {
    // Validate
    onProgress?.('validating', 0);
    const validationError = validateProfileImageFile(file);
    if (validationError) {
      throw new Error(validationError);
    }

    // Get signed URL
    onProgress?.('signing', 20);
    const { uploadUrl, relativePath, fields } = await profileImageApi.generateSignedUrl(
      file.name,
      file.type,
      file.size
    );

    // Upload to cloud storage (S3 POST with fields, or GCS PUT)
    onProgress?.('uploading', 40);
    await profileImageApi.uploadToStorage(uploadUrl, file, fields);

    // Verify and publish — get the permanent public URL
    onProgress?.('submitting', 70);
    const publicUrl = await profileImageApi.verifyAndPublish(relativePath);

    // Register on user profile
    const result = await profileImageApi.submitProfileImage(userId, publicUrl);

    onProgress?.('done', 100);
    return result;
  },

  // ─── FULL RE-UPLOAD WORKFLOW ──────────────────
  /**
   * Complete re-upload workflow (public, token-based):
   * 1. Validate file
   * 2. Get signed URL via token
   * 3. Upload to cloud storage
   * 4. Submit re-upload via token
   */
  reuploadProfileImage: async (
    token: string,
    file: File,
    onProgress?: (step: 'validating' | 'signing' | 'uploading' | 'submitting' | 'done', percent: number) => void
  ): Promise<ReuploadResponse> => {
    // Validate
    onProgress?.('validating', 0);
    const validationError = validateProfileImageFile(file);
    if (validationError) {
      throw new Error(validationError);
    }

    // Get signed URL
    onProgress?.('signing', 20);
    const { uploadUrl, relativePath, fields } = await profileImageApi.generateReuploadUrl({
      token,
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
    });

    // Upload to cloud storage (S3 POST with fields, or GCS PUT)
    onProgress?.('uploading', 40);
    await profileImageApi.uploadToStorage(uploadUrl, file, fields);

    // Get permanent public URL — use verify-and-publish if possible, else fall back
    onProgress?.('submitting', 70);
    let imageUrl: string;
    try {
      imageUrl = await profileImageApi.verifyAndPublish(relativePath);
    } catch {
      imageUrl = relativePath.startsWith('http')
        ? relativePath
        : `${getBaseUrl().replace('/api', '')}/uploads/${relativePath}`;
    }

    const result = await profileImageApi.submitReupload({
      token,
      imageUrl,
    });

    onProgress?.('done', 100);
    return result;
  },

  // ─── INSTITUTE ADMIN: LIST UNVERIFIED ────────
  /** GET /institute-users/institute/:instituteId/users/unverified-with-images */
  getInstituteUnverifiedImages: async (
    instituteId: string,
    params: { page?: number; limit?: number } = {}
  ): Promise<InstituteUnverifiedImagesResponse> => {
    const query = new URLSearchParams({
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 20),
    });
    return apiClient.get<InstituteUnverifiedImagesResponse>(
      `/institute-users/institute/${instituteId}/users/unverified-with-images?${query}`
    );
  },

  // ─── INSTITUTE ADMIN: COUNT UNVERIFIED ───────
  /** GET /institute-users/institute/:instituteId/users/unverified-with-images/count */
  getInstituteUnverifiedImagesCount: async (instituteId: string): Promise<number> => {
    const result = await apiClient.get<{ count: number }>(
      `/institute-users/institute/${instituteId}/users/unverified-with-images/count`
    );
    return result.count;
  },

  // ─── INSTITUTE ADMIN: VERIFY USER IMAGE ──────
  /** POST /institute-users/institute/:instituteId/users/:userId/verify-image */
  verifyInstituteUserImage: async (
    instituteId: string,
    userId: string,
    dto: VerifyInstituteUserImageDto
  ): Promise<{ success: boolean; message: string; status: ImageVerificationStatus }> => {
    return apiClient.post(
      `/institute-users/institute/${instituteId}/users/${userId}/verify-image`,
      dto
    );
  },

  // ─── FULL INSTITUTE IMAGE UPLOAD WORKFLOW ─────
  /**
   * Upload an institute-scoped profile image:
   * 1. Validate → signed URL → upload → verify/publish → submit with scope=INSTITUTE
   */
  uploadInstituteProfileImage: async (
    userId: string,
    instituteId: string,
    file: File,
    onProgress?: (step: 'validating' | 'signing' | 'uploading' | 'submitting' | 'done', percent: number) => void
  ): Promise<SubmitProfileImageResponse> => {
    onProgress?.('validating', 0);
    const validationError = validateProfileImageFile(file);
    if (validationError) throw new Error(validationError);

    onProgress?.('signing', 20);
    const { uploadUrl, relativePath, fields } = await profileImageApi.generateSignedUrl(
      file.name, file.type, file.size
    );

    onProgress?.('uploading', 40);
    await profileImageApi.uploadToStorage(uploadUrl, file, fields);

    onProgress?.('submitting', 70);
    const publicUrl = await profileImageApi.verifyAndPublish(relativePath);

    const result = await profileImageApi.submitProfileImage(userId, publicUrl, 'INSTITUTE', instituteId);
    onProgress?.('done', 100);
    return result;
  },
};
