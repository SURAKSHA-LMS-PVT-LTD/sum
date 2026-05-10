import { apiClient } from './client';
import { enhancedCachedClient } from './enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InstituteDriveStatus {
  isConnected: boolean;
  googleEmail?: string;
  googleDisplayName?: string;
  googleProfilePicture?: string;
  connectedAt?: string;
  lastUsedAt?: string;
  needsReauthorization?: boolean;
  instituteName?: string;
}

export interface InstituteDriveConnectResponse {
  authUrl: string;
  state: string;
}

export interface InstituteDriveTokenResponse {
  accessToken: string;
  expiresAt: string;
  expiresIn: number;
  googleEmail: string;
  clientId: string;
}

export interface InstituteDriveFolderResponse {
  folderId: string;
  folderPath: string;
}

export type InstituteDrivePurpose =
  | 'LECTURE_DOCUMENT'
  | 'LECTURE_RECORDING'
  | 'HOMEWORK_REFERENCE'
  | 'HOMEWORK_SUBMISSION'
  | 'HOMEWORK_CORRECTION'
  | 'EXAM_DOCUMENT'
  | 'GENERAL';

export interface InstituteDriveFileRegistration {
  driveFileId: string;
  purpose: InstituteDrivePurpose;
  referenceType?: string;
  referenceId?: string;
  subjectName?: string;
  className?: string;
  grade?: number;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  driveWebViewLink?: string;
  driveWebContentLink?: string;
  driveFolderId?: string;
  driveFolderPath?: string;
}

export interface InstituteDriveRegisteredFile {
  id: string;
  driveFileId: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  purpose: string;
  referenceType?: string;
  referenceId?: string;
  subjectName?: string;
  className?: string;
  grade?: number;
  driveWebViewLink?: string;
  driveWebContentLink?: string;
  viewUrl: string;
  downloadUrl?: string;
  uploadedAt: string;
  uploadedByUserId?: string;
}

export interface InstituteDriveFileListResponse {
  files: InstituteDriveRegisteredFile[];
  total: number;
}

export interface GetInstituteFolderParams {
  purpose: InstituteDrivePurpose;
  grade?: number;
  className?: string;
  subjectName?: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const instituteDriveApi = {
  getStatus: (instituteId: string): Promise<InstituteDriveStatus> =>
    enhancedCachedClient.get(
      `/institute-drive/${instituteId}/status`,
      undefined,
      { ttl: CACHE_TTL.DEFAULT },
    ),

  getConnectUrl: (
    instituteId: string,
    returnUrl: string,
    platform: 'web' | 'mobile' = 'web',
  ): Promise<InstituteDriveConnectResponse> =>
    apiClient.get(`/institute-drive/${instituteId}/connect`, { returnUrl, platform }),

  disconnect: (instituteId: string): Promise<{ success: boolean; message: string }> =>
    apiClient.post(`/institute-drive/${instituteId}/disconnect`, {}),

  getToken: (instituteId: string): Promise<InstituteDriveTokenResponse> =>
    apiClient.get(`/institute-drive/${instituteId}/token`),

  getFolder: (
    instituteId: string,
    params: GetInstituteFolderParams,
  ): Promise<InstituteDriveFolderResponse> =>
    enhancedCachedClient.get(
      `/institute-drive/${instituteId}/folder`,
      params as unknown as Record<string, string | number | undefined>,
      { ttl: CACHE_TTL.DEFAULT },
    ),

  registerFile: (
    instituteId: string,
    data: InstituteDriveFileRegistration,
  ): Promise<InstituteDriveRegisteredFile> =>
    apiClient.post(`/institute-drive/${instituteId}/files/register`, data),

  listFiles: (
    instituteId: string,
    params?: Partial<GetInstituteFolderParams> & { referenceType?: string; referenceId?: string },
  ): Promise<InstituteDriveFileListResponse> =>
    enhancedCachedClient.get(
      `/institute-drive/${instituteId}/files`,
      params as unknown as Record<string, string | number | undefined> | undefined,
      { ttl: CACHE_TTL.DEFAULT },
    ),

  deleteFile: (
    instituteId: string,
    fileId: string,
  ): Promise<{ success: boolean; message: string }> =>
    apiClient.delete(`/institute-drive/${instituteId}/files/${fileId}`),

  getStorage: (
    instituteId: string,
  ): Promise<{ limit: number | null; usage: number; usageInDrive: number; usageInDriveTrash: number }> =>
    apiClient.get(`/institute-drive/${instituteId}/storage`),

  listFolders: (
    instituteId: string,
    instituteName: string,
  ): Promise<Array<{ id: string; name: string; createdTime: string; modifiedTime: string; webViewLink: string }>> =>
    apiClient.get(`/institute-drive/${instituteId}/folders`, { instituteName }),

  deleteFolder: (
    instituteId: string,
    folderId: string,
  ): Promise<{ success: boolean }> =>
    apiClient.delete(`/institute-drive/${instituteId}/folders/${folderId}`),
};
