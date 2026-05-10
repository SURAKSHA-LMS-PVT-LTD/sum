import { useState, useCallback, useRef } from 'react';
import { uploadAndRegisterFile } from '@/lib/driveUpload';
import {
  checkDriveConnection,
  DriveConnectionStatus,
  DriveFileResponse,
  DriveUploadPurpose,
} from '@/services/driveService';
import { clearDriveTokenCache } from '@/lib/driveTokenCache';

export type UploadStatus = 'idle' | 'checking' | 'uploading' | 'registering' | 'success' | 'error';

export interface DriveUploadState {
  status: UploadStatus;
  progress: number;
  error: string | null;
  uploadedFile: DriveFileResponse | null;
  connectionStatus: DriveConnectionStatus | null;
}

export function useDriveUpload() {
  const [state, setState] = useState<DriveUploadState>({
    status: 'idle',
    progress: 0,
    error: null,
    uploadedFile: null,
    connectionStatus: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const checkConnection = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'checking', error: null }));
    try {
      const status = await checkDriveConnection();
      setState((prev) => ({ ...prev, connectionStatus: status, status: 'idle' }));
      return status;
    } catch (err: any) {
      setState((prev) => ({ ...prev, status: 'error', error: err.message }));
      return null;
    }
  }, []);

  const upload = useCallback(
    async (
      file: File,
      options: {
        purpose: DriveUploadPurpose;
        referenceType?: string;
        referenceId?: string;
        shareWithEmails?: string[];
      },
    ): Promise<DriveFileResponse | null> => {
      setState((prev) => ({
        ...prev,
        status: 'uploading',
        progress: 0,
        error: null,
        uploadedFile: null,
      }));

      abortControllerRef.current = new AbortController();

      try {
        const result = await uploadAndRegisterFile({
          file,
          ...options,
          onProgress: (percent) => {
            setState((prev) => ({
              ...prev,
              progress: percent,
              status: percent < 85 ? 'uploading' : 'registering',
            }));
          },
          abortSignal: abortControllerRef.current.signal,
        });

        setState((prev) => ({ ...prev, status: 'success', progress: 100, uploadedFile: result }));
        return result;
      } catch (err: any) {
        if (err.name === 'AbortError' || err.message === 'Upload cancelled') {
          setState((prev) => ({ ...prev, status: 'idle', progress: 0, error: null }));
          return null;
        }
        if (err.status === 401) clearDriveTokenCache();
        setState((prev) => ({ ...prev, status: 'error', error: err.message || 'Upload failed' }));
        return null;
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    setState((prev) => ({ ...prev, status: 'idle', progress: 0, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle', progress: 0, error: null, uploadedFile: null, connectionStatus: null });
  }, []);

  return { ...state, checkConnection, upload, cancel, reset };
}
