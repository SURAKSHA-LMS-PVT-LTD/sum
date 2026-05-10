import { getValidDriveToken } from './driveTokenCache';
import {
  getDriveFolder,
  registerDriveFile,
  DriveUploadPurpose,
  DriveFileResponse,
} from '@/services/driveService';

export interface DriveUploadResult {
  driveFileId: string;
  fileName: string;
  mimeType: string;
}

const SIMPLE_UPLOAD_LIMIT = 5 * 1024 * 1024; // 5MB

/**
 * Simple upload for files < 5MB
 */
async function uploadSimple(
  file: File,
  folderId: string,
  accessToken: string,
  onProgress?: (percent: number) => void,
): Promise<DriveUploadResult> {
  const metadata = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    parents: [folderId],
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', file);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: formData,
    },
  );

  onProgress?.(90);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error?.error?.message || `Google Drive upload failed: ${response.status}`);
  }

  const result = await response.json();
  onProgress?.(100);

  return { driveFileId: result.id, fileName: result.name, mimeType: result.mimeType };
}

/**
 * Resumable upload for files > 5MB with progress tracking
 */
async function uploadResumable(
  file: File,
  folderId: string,
  accessToken: string,
  onProgress?: (percent: number) => void,
  abortSignal?: AbortSignal,
): Promise<DriveUploadResult> {
  const metadata = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    parents: [folderId],
  };

  const initResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': file.type || 'application/octet-stream',
        'X-Upload-Content-Length': file.size.toString(),
      },
      body: JSON.stringify(metadata),
      signal: abortSignal,
    },
  );

  if (!initResponse.ok) {
    const error = await initResponse.json().catch(() => ({}));
    throw new Error(error?.error?.message || `Failed to initiate upload: ${initResponse.status}`);
  }

  const uploadUrl = initResponse.headers.get('Location');
  if (!uploadUrl) throw new Error('No upload URL returned by Google Drive');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percent = 5 + Math.round((event.loaded / event.total) * 90);
        onProgress?.(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const result = JSON.parse(xhr.responseText);
        onProgress?.(100);
        resolve({ driveFileId: result.id, fileName: result.name, mimeType: result.mimeType });
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Upload network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => xhr.abort());
    }

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

/**
 * Complete flow: Get token → Get folder → Upload → Register with backend
 */
export async function uploadAndRegisterFile(options: {
  file: File;
  purpose: DriveUploadPurpose;
  referenceType?: string;
  referenceId?: string;
  shareWithEmails?: string[];
  onProgress?: (percent: number) => void;
  abortSignal?: AbortSignal;
}): Promise<DriveFileResponse> {
  const { file, purpose, referenceType, referenceId, shareWithEmails, onProgress, abortSignal } = options;

  // 1. Get access token (0-5%)
  const token = await getValidDriveToken();
  onProgress?.(5);

  // 2. Get folder (5-10%)
  const folder = await getDriveFolder(purpose);
  onProgress?.(10);

  // 3. Upload to Drive (10-80%)
  const uploadFn = file.size <= SIMPLE_UPLOAD_LIMIT ? uploadSimple : uploadResumable;
  const uploadResult = await uploadFn(
    file,
    folder.folderId,
    token.accessToken,
    (p) => onProgress?.(10 + Math.round(p * 0.7)),
    file.size > SIMPLE_UPLOAD_LIMIT ? abortSignal : undefined,
  );

  onProgress?.(85);

  // 4. Register with backend (85-100%)
  const registered = await registerDriveFile({
    driveFileId: uploadResult.driveFileId,
    purpose,
    referenceType,
    referenceId,
    shareWithEmails: shareWithEmails?.join(','),
  });

  onProgress?.(100);
  return registered;
}
