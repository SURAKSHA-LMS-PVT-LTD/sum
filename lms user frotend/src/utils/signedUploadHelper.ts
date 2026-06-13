import { getBaseUrl, getAccessTokenAsync } from '@/contexts/utils/auth.api';

export type UploadFolder = 
  | 'profile-images'
  | 'student-images'
  | 'institute-images'
  | 'institute-user-images'
  | 'subject-images'
  | 'institute-payment-receipts'
  | 'subject-payment-receipts'
  | 'enrollment-payment-receipts'
  | 'class-payment-receipts'
  | 'id-documents'
  | 'bookhire-vehicle-images'
  | 'bookhire-owner-images'
  | 'lecture-thumbnails';

const UPLOAD_MAX_FILE_SIZES: Record<UploadFolder, number> = {
  'profile-images': 5 * 1024 * 1024,        // 5MB
  'student-images': 5 * 1024 * 1024,        // 5MB
  'institute-images': 5 * 1024 * 1024,      // 5MB
  'institute-user-images': 5 * 1024 * 1024, // 5MB
  'subject-images': 5 * 1024 * 1024,        // 5MB
  'institute-payment-receipts': 5 * 1024 * 1024,      // 5MB
  'subject-payment-receipts': 5 * 1024 * 1024,        // 5MB
  'enrollment-payment-receipts': 5 * 1024 * 1024,     // 5MB
  'class-payment-receipts': 5 * 1024 * 1024,          // 5MB
  'id-documents': 5 * 1024 * 1024,           // 5MB
  'bookhire-vehicle-images': 5 * 1024 * 1024,         // 5MB
  'bookhire-owner-images': 5 * 1024 * 1024,           // 5MB
  'lecture-thumbnails': 5 * 1024 * 1024,              // 5MB
};

interface SignedUrlResponse {
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

/**
 * Auto-detect folder based on file type
 */
export function detectFolder(file: File): UploadFolder {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  
  // Images
  if (type.startsWith('image/')) {
    if (name.includes('profile')) return 'profile-images';
    if (name.includes('student')) return 'student-images';
    if (name.includes('institute')) return 'institute-images';
    if (name.includes('subject')) return 'subject-images';
    return 'profile-images'; // default for images
  }
  
  // Documents and PDFs - default to payment receipts for remaining S3 uploads
  if (type === 'application/pdf' || type.includes('document')) {
    if (name.includes('payment') || name.includes('receipt') || name.includes('slip')) return 'institute-payment-receipts';
    if (name.includes('id') || name.includes('identity') || name.includes('card')) return 'id-documents';
    return 'institute-payment-receipts'; // default for documents
  }
  
  return 'institute-payment-receipts'; // fallback
}

/**
 * Validate file before upload
 */
function validateFile(file: File, folder: UploadFolder): void {
  // Check file size
  const maxSize = UPLOAD_MAX_FILE_SIZES[folder];
  if (file.size > maxSize) {
    throw new Error(`File too large. Maximum size: ${maxSize / 1024 / 1024}MB`);
  }

  // Check for suspicious extensions
  const suspiciousExtensions = ['.exe', '.php', '.sh', '.bat', '.cmd', '.scr', '.vbs'];
  const fileName = file.name.toLowerCase();
  if (suspiciousExtensions.some(ext => fileName.endsWith(ext))) {
    throw new Error('File type not allowed for security reasons');
  }

  // Validate content type based on folder
  const allowedTypes: Record<UploadFolder, string[]> = {
    'profile-images': ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    'student-images': ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    'institute-images': ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/gif'],
    'institute-user-images': ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
    'subject-images': ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp'],
    'institute-payment-receipts': ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    'subject-payment-receipts': ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    'enrollment-payment-receipts': ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    'class-payment-receipts': ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    'id-documents': ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    'bookhire-vehicle-images': ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    'bookhire-owner-images': ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    'lecture-thumbnails': ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  };

  const allowed = allowedTypes[folder];
  if (allowed && !allowed.includes(file.type)) {
    throw new Error(`Invalid file type for ${folder}. Allowed: ${allowed.join(', ')}`);
  }
}

/**
 * Upload file using AWS S3 signed URL flow
 * Returns relativePath to send to backend
 */
export async function uploadWithSignedUrl(
  file: File,
  folder: UploadFolder,
  onProgress?: (message: string, progress: number) => void
): Promise<string> {
  const baseUrl = getBaseUrl();
  const token = await getAccessTokenAsync();

  if (!token) {
    throw new Error('Authentication required to upload files');
  }

  // Validate file before upload
  validateFile(file, folder);

  try {
    // Step 1: Get signed URL from backend
    onProgress?.('Getting upload URL...', 10);

    const contentType = file.type || 'application/octet-stream';
    const params = new URLSearchParams({
      folder,
      fileName: file.name,
      contentType,
      fileSize: file.size.toString()
    });

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    };

    const signedUrlResponse = await fetch(`${baseUrl}/upload/get-signed-url?${params}`, {
      method: 'GET',
      headers
    });

    if (!signedUrlResponse.ok) {
      const error = await signedUrlResponse.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to get signed URL');
    }

    const signedUrlData: SignedUrlResponse = await signedUrlResponse.json();
    const { uploadUrl, relativePath, fields } = signedUrlData;

    // Step 2: Upload file — support both presigned PUT (S3/GCS) and presigned POST (S3 multipart)
    onProgress?.('Uploading file...', 50);

    const hasFields = fields && typeof fields === 'object' && Object.keys(fields).length > 0;

    let uploadResponse: Response;
    if (hasFields) {
      // S3 presigned POST with FormData fields
      if (import.meta.env.DEV) console.log('Uploading via S3 presigned POST');
      const formData = new FormData();
      // CRITICAL: fields must come before file for S3 signature validation
      Object.keys(fields).forEach(key => formData.append(key, fields[key]));
      formData.append('file', file);
      uploadResponse = await fetch(uploadUrl, { method: 'POST', body: formData });
    } else {
      // S3/GCS presigned PUT — detect provider to avoid sending GCS-specific headers to S3
      const isGCS = uploadUrl.includes('storage.googleapis.com') || uploadUrl.includes('storage.cloud.google.com');
      if (import.meta.env.DEV) console.log(`Uploading via ${isGCS ? 'GCS' : 'S3'} presigned PUT`);
      const headers: Record<string, string> = { 'Content-Type': file.type || 'application/octet-stream' };
      if (isGCS) headers['x-goog-content-length-range'] = `0,${5 * 1024 * 1024}`;
      try {
        uploadResponse = await fetch(uploadUrl, { method: 'PUT', headers, body: file });
      } catch (uploadErr: any) {
        const uploadErrMsg = String(uploadErr?.message || uploadErr || '');
        const isCorsLike = uploadErr instanceof TypeError || /failed to fetch/i.test(uploadErrMsg);
        if (isCorsLike) {
          throw new Error('Signed upload failed due to S3 CORS policy. Allow PUT/POST/OPTIONS from this frontend origin on the bucket.');
        }
        throw uploadErr;
      }
    }

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => 'Unknown error');
      if (import.meta.env.DEV) console.error('S3 upload error:', errorText);
      throw new Error('Upload failed. Please try again.');
    }
    
    // Step 3: Verify and make file public
    onProgress?.('Verifying upload...', 80);

    const verifyHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    const verifyResponse = await fetch(`${baseUrl}/upload/verify-and-publish`, {
      method: 'POST',
      headers: verifyHeaders,
      body: JSON.stringify({ relativePath })
    });

    if (!verifyResponse.ok) {
      const verifyError = await verifyResponse.json().catch(() => ({}));
      throw new Error(verifyError.message || 'Failed to verify upload');
    }

    await verifyResponse.json();

    onProgress?.('Upload complete!', 100);

    // Return relativePath to be sent to backend
    return relativePath;
  } catch (error: any) {
    console.error('Upload failed:', error);
    const err = new Error(error.message || 'Failed to upload file');
    throw err;
  }
}

/**
 * Upload with automatic folder detection
 */
export async function uploadFileAuto(
  file: File,
  onProgress?: (message: string, progress: number) => void
): Promise<string> {
  const folder = detectFolder(file);
  return uploadWithSignedUrl(file, folder, onProgress);
}
