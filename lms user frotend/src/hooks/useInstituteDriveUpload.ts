import { useState, useCallback, useRef } from 'react';
import { uploadToInstituteDrive } from '@/lib/instituteDriveUpload';
import {
  instituteDriveApi,
  InstituteDriveStatus,
  InstituteDriveRegisteredFile,
  InstituteDrivePurpose,
  GetInstituteFolderParams,
} from '@/api/instituteDriveAccess.api';
import { clearInstituteTokenCache } from '@/lib/instituteTokenCache';

export type UploadStatus = 'idle' | 'checking' | 'uploading' | 'registering' | 'success' | 'error';

export interface InstituteDriveUploadState {
  status: UploadStatus;
  progress: number;
  error: string | null;
  uploadedFile: InstituteDriveRegisteredFile | null;
  driveStatus: InstituteDriveStatus | null;
}

export function useInstituteDriveUpload(instituteId: string) {
  const [state, setState] = useState<InstituteDriveUploadState>({
    status: 'idle',
    progress: 0,
    error: null,
    uploadedFile: null,
    driveStatus: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const checkConnection = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'checking', error: null }));
    try {
      const status = await instituteDriveApi.getStatus(instituteId);
      setState((prev) => ({ ...prev, driveStatus: status, status: 'idle' }));
      return status;
    } catch (err: any) {
      setState((prev) => ({ ...prev, status: 'error', error: err.message }));
      return null;
    }
  }, [instituteId]);

  const upload = useCallback(
    async (
      file: File,
      options: {
        purpose: InstituteDrivePurpose;
        folderParams?: Omit<GetInstituteFolderParams, 'purpose'>;
        referenceType?: string;
        referenceId?: string;
      },
    ): Promise<InstituteDriveRegisteredFile | null> => {
      setState((prev) => ({
        ...prev,
        status: 'uploading',
        progress: 0,
        error: null,
        uploadedFile: null,
      }));

      abortControllerRef.current = new AbortController();

      try {
        const result = await uploadToInstituteDrive({
          file,
          instituteId,
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

        setState((prev) => ({
          ...prev,
          status: 'success',
          progress: 100,
          uploadedFile: result,
        }));

        return result;
      } catch (err: any) {
        if (err.message === 'Upload cancelled') {
          setState((prev) => ({ ...prev, status: 'idle', progress: 0, error: null }));
          return null;
        }

        if (err.message?.includes('token') || err.message?.includes('401')) {
          clearInstituteTokenCache(instituteId);
        }

        setState((prev) => ({
          ...prev,
          status: 'error',
          error: err.message || 'Upload failed',
        }));

        return null;
      }
    },
    [instituteId],
  );

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setState({ status: 'idle', progress: 0, error: null, uploadedFile: null, driveStatus: null });
  }, []);

  return { state, checkConnection, upload, cancel, reset };
}
