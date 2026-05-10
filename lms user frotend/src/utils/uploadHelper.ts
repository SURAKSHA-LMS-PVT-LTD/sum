import { getBaseUrl, getApiHeaders, getAccessTokenAsync } from '@/contexts/utils/auth.api';

export interface SignedUrlResponse {
  success: boolean;
  message: string;
  uploadUrl: string;
  publicUrl: string;
  relativePath: string;
  fields: Record<string, string>;
  instructions: {
    step1: string;
    step2: string;
    step3: string;
    step4: string;
    important: string;
  };
}

export interface VerifyPublishResponse {
  success: boolean;
  message: string;
  publicUrl: string;
  relativePath: string;
  instructions: {
    nextStep: string;
    note: string;
  };
}

export interface UploadProgress {
  stage: 'idle' | 'getting-url' | 'uploading' | 'verifying' | 'complete' | 'error';
  message: string;
  progress: number;
  error?: Error;
}

export type UploadFolder =
  | 'profile-images'
  | 'student-images'
  | 'institute-images'
  | 'institute-user-images'
  | 'subject-images'
  | 'homework-files'
  | 'correction-files'
  | 'institute-payment-receipts'
  | 'subject-payment-receipts'
  | 'enrollment-payment-receipts'
  | 'class-payment-receipts'
  | 'id-documents'
  | 'bookhire-vehicle-images'
  | 'bookhire-owner-images'
  | 'service-payment-receipts';

const MAX_FILE_SIZES: Record<UploadFolder, number> = {
  'profile-images': 5 * 1024 * 1024,        // 5MB
  'student-images': 5 * 1024 * 1024,        // 5MB
  'institute-images': 5 * 1024 * 1024,      // 5MB
  'institute-user-images': 5 * 1024 * 1024, // 5MB
  'subject-images': 5 * 1024 * 1024,        // 5MB
  'homework-files': 5 * 1024 * 1024,        // 5MB
  'correction-files': 5 * 1024 * 1024,      // 5MB
  'institute-payment-receipts': 5 * 1024 * 1024,      // 5MB
  'subject-payment-receipts': 5 * 1024 * 1024,        // 5MB
  'enrollment-payment-receipts': 5 * 1024 * 1024,     // 5MB
  'class-payment-receipts': 5 * 1024 * 1024,          // 5MB
  'id-documents': 5 * 1024 * 1024,           // 5MB
  'bookhire-vehicle-images': 5 * 1024 * 1024,         // 5MB
  'bookhire-owner-images': 5 * 1024 * 1024,            // 5MB
  'service-payment-receipts': 5 * 1024 * 1024           // 5MB
};

export class FileUploader {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getBaseUrl();
  }
  
  /**
   * Get current access token (platform-aware)
   */
  private async getToken(): Promise<string | null> {
    return await getAccessTokenAsync();
  }

  /**
   * Validate file before upload
   */
  validateFile(file: File, folder: UploadFolder): void {
    // Check file size
    const maxSize = MAX_FILE_SIZES[folder] || 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / 1024 / 1024).toFixed(2);
      throw new Error(`File size must not exceed ${maxSizeMB} MB`);
    }

    // Check file extension
    const fileName = file.name.toLowerCase();
    const extension = fileName.split('.').pop();
    const suspiciousExtensions = ['exe', 'bat', 'cmd', 'sh', 'php', 'asp', 'jsp'];
    
    if (suspiciousExtensions.includes(extension || '')) {
      throw new Error('Suspicious file extension detected');
    }

    // Check for double extensions
    const parts = fileName.split('.');
    if (parts.length > 2) {
      throw new Error('Files with double extensions are not allowed');
    }
  }

  /**
   * Get signed URL from backend
   */
  private async getSignedUrl(file: File, folder: UploadFolder): Promise<SignedUrlResponse> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    // Ensure content type is never empty - default to application/octet-stream
    const contentType = file.type || 'application/octet-stream';

    const params = new URLSearchParams({
      folder: folder,
      fileName: file.name,
      contentType: contentType,
      fileSize: file.size.toString(),
      expiresIn: '600' // 10 minutes
    });

    const response = await fetch(`${this.baseUrl}/upload/get-signed-url?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to get signed URL');
    }

    return await response.json();
  }

  /**
   * Upload file to cloud storage using signed URL (supports both AWS S3 and GCS)
   */
  private async uploadToCloud(
    file: File, 
    uploadUrl: string,
    folder: UploadFolder,
    fields?: Record<string, string>
  ): Promise<void> {
    if (fields && Object.keys(fields).length > 0) {
      // AWS S3 POST with FormData
      console.log('📤 Using AWS S3 POST method');
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
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`S3 upload failed (${response.status}): ${errorText || response.statusText}`);
      }
      console.log('✅ Uploaded to S3');
    } else {
      // GCS PUT with direct file upload (legacy - backend not migrated yet)
      console.log('📤 Using GCS PUT method (legacy)');
      const maxSize = MAX_FILE_SIZES[folder] || (5 * 1024 * 1024);
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'x-goog-content-length-range': `0,${maxSize}` // MUST match backend signature
        },
        body: file
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`GCS upload failed (${response.status}): ${errorText || response.statusText}`);
      }
      console.log('✅ Uploaded to GCS');
    }
  }

  /**
   * Upload file to cloud storage with progress tracking (AWS S3 POST)
   */
  private uploadToCloudWithProgress(
    file: File,
    uploadUrl: string,
    folder: UploadFolder,
    fields?: Record<string, string>,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress?.({
            stage: 'uploading',
            message: 'Uploading to cloud storage...',
            progress: 33 + (percentComplete * 0.47) // 33% to 80%
          });
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      if (fields && Object.keys(fields).length > 0) {
        // AWS S3 POST with FormData
        console.log('📤 XHR: Using AWS S3 POST method');
        const formData = new FormData();
        
        // Add all fields first
        Object.keys(fields).forEach(key => {
          formData.append(key, fields[key]);
        });
        
        // Add file last
        formData.append('file', file);

        xhr.open('POST', uploadUrl);
        xhr.send(formData);
      } else {
        // GCS PUT with direct file upload (legacy)
        console.log('📤 XHR: Using GCS PUT method (legacy)');
        const contentType = file.type || 'application/octet-stream';
        const maxSize = MAX_FILE_SIZES[folder] || (5 * 1024 * 1024);
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', contentType);
        xhr.setRequestHeader('x-goog-content-length-range', `0,${maxSize}`); // MUST match backend signature
        xhr.send(file);
      }
    });
  }

  /**
   * Verify and publish the uploaded file
   */
  private async verifyAndPublish(relativePath: string): Promise<VerifyPublishResponse> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`${this.baseUrl}/upload/verify-and-publish`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ relativePath })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to verify upload');
    }

    return await response.json();
  }

  /**
   * Complete upload flow: get signed URL, upload file, verify and publish
   */
  async uploadFile(
    file: File,
    folder: UploadFolder,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    try {
      // Validate file
      this.validateFile(file, folder);

      // Step 1: Get signed URL
      onProgress?.({
        stage: 'getting-url',
        message: 'Getting upload URL from server...',
        progress: 0
      });

      const signedUrlData = await this.getSignedUrl(file, folder);

      // Step 2: Upload to cloud storage
      onProgress?.({
        stage: 'uploading',
        message: 'Uploading file to cloud storage...',
        progress: 33
      });

      if (onProgress) {
        await this.uploadToCloudWithProgress(
          file,
          signedUrlData.uploadUrl,
          folder,
          signedUrlData.fields,
          onProgress
        );
      } else {
        await this.uploadToCloud(file, signedUrlData.uploadUrl, folder, signedUrlData.fields);
      }

      // Step 3: Verify and publish
      onProgress?.({
        stage: 'verifying',
        message: 'Verifying upload...',
        progress: 80
      });

      const publishData = await this.verifyAndPublish(signedUrlData.relativePath);

      // Step 4: Complete
      onProgress?.({
        stage: 'complete',
        message: 'Upload successful!',
        progress: 100
      });

      return publishData.publicUrl;
    } catch (error: any) {
      onProgress?.({
        stage: 'error',
        message: error instanceof Error ? error.message : 'Upload failed',
        progress: 0,
        error: error instanceof Error ? error : new Error('Unknown error')
      });
      throw error;
    }
  }

  /**
   * Upload multiple files in parallel
   */
  async uploadMultipleFiles(
    files: File[],
    folder: UploadFolder,
    onProgress?: (fileIndex: number, progress: UploadProgress) => void
  ): Promise<{ successful: string[]; failed: Array<{ file: File; error: Error }> }> {
    const uploadPromises = files.map((file, index) =>
      this.uploadFile(file, folder, (progress) => {
        onProgress?.(index, progress);
      }).then(url => ({ success: true, url, file }))
        .catch(error => ({ success: false, error, file }))
    );

    const results = await Promise.all(uploadPromises);

    const successful = results
      .filter((r): r is { success: true; url: string; file: File } => r.success)
      .map(r => r.url);

    const failed = results
      .filter((r): r is { success: false; error: Error; file: File } => !r.success)
      .map(r => ({ file: r.file, error: r.error }));

    return { successful, failed };
  }

  /**
   * Upload file with retry logic
   */
  async uploadFileWithRetry(
    file: File,
    folder: UploadFolder,
    maxRetries: number = 3,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Upload attempt ${attempt}/${maxRetries}`);
        return await this.uploadFile(file, folder, onProgress);
      } catch (error: any) {
        console.error(`Attempt ${attempt} failed:`, error);
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Don't retry for certain errors
        if (
          lastError.message.includes('File size') ||
          lastError.message.includes('Invalid file extension') ||
          lastError.message.includes('401') ||
          lastError.message.includes('403') ||
          lastError.message.includes('Suspicious file extension')
        ) {
          throw lastError;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Upload failed after multiple attempts');
  }
}

/**
 * Compress image before upload (useful for profile images)
 */
export async function compressImage(file: File, maxSizeMB: number = 1): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        const maxDimension = 1920;
        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now()
              }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.8 // 80% quality
        );
      };
    };
  });
}

// Export singleton instance
export const fileUploader = new FileUploader();
