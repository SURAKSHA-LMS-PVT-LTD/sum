import { getBaseUrl, getAccessTokenAsync } from '@/contexts/utils/auth.api';

export interface SignedUrlResponse {
  success: boolean;
  message: string;
  uploadUrl: string;
  publicUrl: string;
  relativePath: string;
  fields: Record<string, string>;
  instructions?: {
    step1: string;
    step2: string;
    step3: string;
    step4: string;
  };
}

export const getSignedUrl = async (
  folder: string,
  fileName: string,
  contentType: string,
  fileSize: number
): Promise<SignedUrlResponse> => {
  const token = await getAccessTokenAsync();

  if (!token) {
    throw new Error('Authentication required to upload files');
  }

  const params = new URLSearchParams({
    folder,
    fileName,
    contentType,
    fileSize: fileSize.toString()
  });

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
  };

  const response = await fetch(`${getBaseUrl()}/upload/get-signed-url?${params}`, {
    method: 'GET',
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (import.meta.env.DEV) console.error('Signed URL error:', response.status, errorText);
    throw new Error('Upload failed. Please try again.');
  }

  const result = await response.json();
  return result;
};

export const uploadToSignedUrl = async (
  uploadUrl: string,
  file: Blob,
  fields?: Record<string, string>
): Promise<void> => {
  try {
    if (fields && Object.keys(fields).length > 0) {
      // AWS S3 POST with FormData
      const formData = new FormData();
      
      // IMPORTANT: Add all fields from backend BEFORE the file
      Object.keys(fields).forEach(key => {
        formData.append(key, fields[key]);
      });
      
      // Add file LAST
      formData.append('file', file);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
        // DO NOT set Content-Type header - browser sets it automatically
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('❌ S3 upload error:', {
          status: response.status,
          error: errorText
        });
        throw new Error(`S3 upload failed (${response.status}): ${errorText || response.statusText}`);
      }
      
      console.log('✅ File uploaded successfully to S3');
    } else {
      // PUT upload (GCS or S3 presigned PUT URL)
      const isGCS = uploadUrl.includes('storage.googleapis.com') || uploadUrl.includes('storage.cloud.google.com');
      const headers: Record<string, string> = {
        'Content-Type': file.type || 'application/octet-stream',
      };
      // GCS-specific header: only add for GCS, never for S3 (causes CORS preflight failure on S3)
      if (isGCS) {
        headers['x-goog-content-length-range'] = `0,${5 * 1024 * 1024}`;
      }
      console.log(`📤 Using ${isGCS ? 'GCS' : 'S3'} PUT method`);
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers,
        body: file
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('❌ GCS upload error:', {
          status: response.status,
          error: errorText
        });
        throw new Error(`GCS upload failed (${response.status}): ${errorText || response.statusText}`);
      }
      
      console.log('✅ File uploaded successfully to GCS');
    }
  } catch (error: any) {
    console.error('❌ Upload failed:', error);
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('Network error: Unable to upload file. Check your internet connection.');
    }
    throw error;
  }
};

export const verifyAndPublish = async (relativePath: string): Promise<void> => {
  const token = await getAccessTokenAsync();
  
  if (!token) {
    throw new Error('Authentication required to verify upload');
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
  
  console.log('📤 Verifying and publishing:', { relativePath, authMethod: token ? 'JWT' : 'API Key' });
  
  const response = await fetch(`${getBaseUrl()}/upload/verify-and-publish`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ relativePath }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Verify/publish error:', {
      status: response.status,
      error: errorText
    });
    throw new Error(`Failed to verify and publish: ${response.status}`);
  }
  
  console.log('✅ File verified and published');
};

export const deleteUploadedFile = async (relativePath: string): Promise<void> => {
  // Only delete paths that are actual storage relative paths (not external URLs, not empty)
  if (!relativePath || relativePath.startsWith('http://') || relativePath.startsWith('https://')) return;
  try {
    const token = await getAccessTokenAsync();
    if (!token) return;
    await fetch(`${getBaseUrl()}/upload/file`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ relativePath }),
    });
  } catch {
    // Fire-and-forget: storage cleanup should never break the UI
  }
};

// Auto-detect folder based on file type and context
export const detectFolder = (file: File, context?: 'homework' | 'payment' | 'correction' | 'profile' | 'institute' | 'subject' | 'student' | 'id-document' | 'institute-user'): string => {
  const mimeType = file.type;
  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';
  
  if (context === 'homework') return 'homework-files';
  if (context === 'correction') return 'correction-files';
  if (context === 'payment') return 'institute-payment-receipts';
  if (context === 'id-document') return 'id-documents';
  if (context === 'profile') return 'profile-images';
  if (context === 'institute') return 'institute-images';
  if (context === 'subject') return 'subject-images';
  if (context === 'student') return 'student-images';
  if (context === 'institute-user') return 'institute-user-images';
  
  // Default fallback based on file type
  if (isImage) return 'profile-images';
  if (isPdf) return 'homework-files';
  return 'homework-files';
};

// Complete upload workflow: get signed URL → upload → verify → return relativePath
export const uploadFileSimple = async (
  file: File,
  folder: string,
  onProgress?: (message: string, progress: number) => void
): Promise<string> => {
  try {
    // Step 1: Get signed URL
    onProgress?.('Getting upload URL...', 10);
    const contentType = file.type || 'application/octet-stream';
    const signedUrlData = await getSignedUrl(folder, file.name, contentType, file.size);
    
    // Step 2: Upload to S3 with FormData
    onProgress?.('Uploading file...', 50);
    await uploadToSignedUrl(signedUrlData.uploadUrl, file, signedUrlData.fields);
    
    // Step 3: Verify and publish
    onProgress?.('Verifying upload...', 80);
    await verifyAndPublish(signedUrlData.relativePath);
    
    // Step 4: Return relativePath
    onProgress?.('Upload complete!', 100);
    return signedUrlData.relativePath;
  } catch (error: any) {
    console.error('Upload failed:', error);
    throw error;
  }
};
