import { apiClient } from '@/api/client';

// ============================================
// Types
// ============================================

export interface DriveConnectionStatus {
  isConnected: boolean;
  googleEmail?: string;
  googleDisplayName?: string;
  googleProfilePicture?: string;
  grantedScopes?: string;
  lastUsedAt?: string;
  connectedAt?: string;
  needsReauthorization?: boolean;
}

export interface DriveAuthUrl {
  authUrl: string;
  state: string;
}

export interface DriveAccessToken {
  accessToken: string;
  expiresIn: number;
  expiresAt: string;
  googleEmail: string;
  clientId: string;
}

export type DriveUploadPurpose =
  | 'HOMEWORK_SUBMISSION'
  | 'HOMEWORK_REFERENCE'
  | 'HOMEWORK_CORRECTION'
  | 'EXAM_SUBMISSION'
  | 'PROFILE_DOCUMENT'
  | 'ID_CARD_PAYMENT'
  | 'GENERAL';

export interface DriveFolder {
  folderId: string;
  folderPath: string;
}

export interface DriveFileResponse {
  id: string;
  driveFileId: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  purpose: string;
  referenceType?: string;
  referenceId?: string;
  viewUrl: string;
  downloadUrl: string;
  embedUrl?: string;
  createdAt: string;
}

export interface RegisterFileRequest {
  driveFileId: string;
  purpose: DriveUploadPurpose;
  referenceType?: string;
  referenceId?: string;
  shareWithEmails?: string;
}

export interface DriveDisconnectResult {
  success: boolean;
  message: string;
}

// ============================================
// API Calls
// ============================================

export async function checkDriveConnection(): Promise<DriveConnectionStatus> {
  return apiClient.get<DriveConnectionStatus>('/drive-access/status');
}

export async function getDriveConnectUrl(
  returnUrl?: string,
  platform: 'web' | 'mobile' = 'web',
): Promise<DriveAuthUrl> {
  const qs = new URLSearchParams({ platform });
  if (returnUrl) qs.set('returnUrl', returnUrl);
  return apiClient.get<DriveAuthUrl>(`/drive-access/connect?${qs.toString()}`);
}

export async function getDriveAccessToken(): Promise<DriveAccessToken> {
  return apiClient.get<DriveAccessToken>('/drive-access/token');
}

export async function getDriveFolder(purpose: DriveUploadPurpose): Promise<DriveFolder> {
  return apiClient.get<DriveFolder>(`/drive-access/folder?purpose=${purpose}`);
}

export async function registerDriveFile(data: RegisterFileRequest): Promise<DriveFileResponse> {
  return apiClient.post<DriveFileResponse>('/drive-access/files/register', data);
}

export async function disconnectDrive(): Promise<DriveDisconnectResult> {
  return apiClient.post<DriveDisconnectResult>('/drive-access/disconnect');
}

export async function deleteDriveFile(fileId: string): Promise<{ success: boolean; message: string }> {
  return apiClient.delete(`/drive-access/files/${fileId}`);
}
