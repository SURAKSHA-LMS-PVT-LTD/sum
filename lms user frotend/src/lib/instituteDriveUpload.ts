import { getValidInstituteToken } from './instituteTokenCache';
import {
  instituteDriveApi,
  InstituteDrivePurpose,
  GetInstituteFolderParams,
  InstituteDriveRegisteredFile,
} from '@/api/instituteDriveAccess.api';

export interface InstituteDriveUploadResult {
  driveFileId: string;
  fileName: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
}

const SIMPLE_UPLOAD_LIMIT = 5 * 1024 * 1024; // 5 MB

async function uploadSimple(
  file: File,
  folderId: string,
  accessToken: string,
  onProgress?: (percent: number) => void,
): Promise<InstituteDriveUploadResult> {
  const metadata = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    parents: [folderId],
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', file);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink',
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

  return {
    driveFileId: result.id,
    fileName: result.name,
    mimeType: result.mimeType,
    webViewLink: result.webViewLink,
    webContentLink: result.webContentLink,
  };
}

async function uploadResumable(
  file: File,
  folderId: string,
  accessToken: string,
  onProgress?: (percent: number) => void,
  abortSignal?: AbortSignal,
): Promise<InstituteDriveUploadResult> {
  const metadata = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    parents: [folderId],
  };

  const initResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink,webContentLink',
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
        resolve({
          driveFileId: result.id,
          fileName: result.name,
          mimeType: result.mimeType,
          webViewLink: result.webViewLink,
          webContentLink: result.webContentLink,
        });
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
 * Full flow: Get institute token → Get structured folder → Upload → Register with backend
 */
export async function uploadToInstituteDrive(options: {
  file: File;
  instituteId: string;
  purpose: InstituteDrivePurpose;
  folderParams?: Omit<GetInstituteFolderParams, 'purpose'>;
  referenceType?: string;
  referenceId?: string;
  onProgress?: (percent: number) => void;
  abortSignal?: AbortSignal;
}): Promise<InstituteDriveRegisteredFile> {
  const {
    file,
    instituteId,
    purpose,
    folderParams,
    referenceType,
    referenceId,
    onProgress,
    abortSignal,
  } = options;

  // 1. Get access token (0–5%)
  const token = await getValidInstituteToken(instituteId);
  onProgress?.(5);

  // 2. Get target folder (5–10%)
  const folder = await instituteDriveApi.getFolder(instituteId, {
    purpose,
    ...folderParams,
  });
  onProgress?.(10);

  // 3. Upload to Drive (10–80%)
  const uploadFn = file.size <= SIMPLE_UPLOAD_LIMIT ? uploadSimple : uploadResumable;
  const uploadResult = await uploadFn(
    file,
    folder.folderId,
    token.accessToken,
    (p) => onProgress?.(10 + Math.round(p * 0.7)),
    file.size > SIMPLE_UPLOAD_LIMIT ? abortSignal : undefined,
  );

  onProgress?.(85);

  // 4. Register with backend (85–100%)
  const registered = await instituteDriveApi.registerFile(instituteId, {
    driveFileId: uploadResult.driveFileId,
    purpose,
    referenceType,
    referenceId,
    fileName: uploadResult.fileName,
    mimeType: uploadResult.mimeType,
    fileSize: file.size,
    driveWebViewLink: uploadResult.webViewLink,
    driveWebContentLink: uploadResult.webContentLink,
    driveFolderId: folder.folderId,
    driveFolderPath: folder.folderPath,
    ...folderParams,
  });

  onProgress?.(100);
  return registered;
}
