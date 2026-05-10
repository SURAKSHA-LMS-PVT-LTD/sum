import { apiClient } from './client';
import { enhancedCachedClient } from './enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriveStatus {
  isConnected: boolean;
  googleEmail?: string;
  googleDisplayName?: string;
  connectedAt?: string;
}

export interface DriveConnectResponse {
  authUrl: string;
  state: string;
}

export interface DriveTokenResponse {
  accessToken: string;
  expiresAt: string;
  tokenType: string;
}

export interface DriveFolderResponse {
  folderId: string;
  folderPath: string;
}

export interface DriveFileRegistration {
  driveFileId: string;
  purpose: string;
  referenceType?: string;
  referenceId?: string;
}

export interface DriveRegisteredFile {
  id: string;
  driveFileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  viewUrl: string;
  embedUrl: string;
  purpose: string;
}

export interface DriveFile {
  id: string;
  driveFileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  viewUrl: string;
  embedUrl?: string;
  purpose: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const driveAccessApi = {
  getStatus: (): Promise<DriveStatus> =>
    enhancedCachedClient.get('/drive-access/status', undefined, { ttl: CACHE_TTL.DEFAULT }),

  getConnectUrl: (returnUrl: string, platform: 'web' | 'mobile' = 'web'): Promise<DriveConnectResponse> =>
    apiClient.get('/drive-access/connect', { returnUrl, platform }),

  disconnect: (): Promise<void> =>
    apiClient.post('/drive-access/disconnect', {}),

  getToken: async (): Promise<DriveTokenResponse> => {
    // Retry on network failures (ERR_CONNECTION_CLOSED etc.)
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await apiClient.get('/drive-access/token');
      } catch (err: any) {
        lastError = err;
        const isNetworkError = !err?.response && (err?.message?.includes('Network Error') || err?.code === 'ERR_NETWORK' || err?.code === 'ECONNABORTED');
        if (!isNetworkError || attempt >= 2) break;
        await new Promise(r => setTimeout(r, (attempt + 1) * 1000));
      }
    }
    throw lastError;
  },

  getFolder: (purpose: string): Promise<DriveFolderResponse> =>
    enhancedCachedClient.get('/drive-access/folder', { purpose }, { ttl: CACHE_TTL.DEFAULT }),

  registerFile: (data: DriveFileRegistration): Promise<DriveRegisteredFile> =>
    apiClient.post('/drive-access/files/register', data),

  listFiles: (purpose?: string): Promise<{ files: DriveFile[] }> =>
    enhancedCachedClient.get('/drive-access/files', purpose ? { purpose } : undefined, { ttl: CACHE_TTL.DEFAULT }),

  deleteFile: (id: string): Promise<void> =>
    apiClient.delete(`/drive-access/files/${id}`),
};

// ─── Direct Google Drive upload helper ───────────────────────────────────────

export async function uploadToGoogleDrive(
  file: File,
  accessToken: string,
  folderId: string,
): Promise<{ driveFileId: string; fileName: string; mimeType: string }> {
  const mimeType = file.type || 'application/octet-stream';

  // Step 1: Initiate resumable upload — receive upload URI from Google
  const metadataRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(file.size),
      },
      body: JSON.stringify({ name: file.name, parents: [folderId], mimeType }),
    },
  );

  if (!metadataRes.ok) {
    const text = await metadataRes.text().catch(() => '');
    throw new Error(`Failed to initiate Google Drive upload: ${metadataRes.status} ${text}`);
  }

  const uploadUrl = metadataRes.headers.get('Location');
  if (!uploadUrl) throw new Error('No upload URL returned from Google Drive');

  // Step 2: Upload file bytes to the resumable URI
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: file,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => '');
    throw new Error(`Google Drive upload failed: ${uploadRes.status} ${text}`);
  }

  const fileData = await uploadRes.json();
  return {
    driveFileId: fileData.id as string,
    fileName: fileData.name as string,
    mimeType: fileData.mimeType as string,
  };
}
