import { api } from "./api";
import { validateFile } from "./uploadConfig";

export interface UploadResult {
  relativePath: string;
  publicUrl?: string;
  success: boolean;
}

export const uploadFile = async (
  file: File,
  folder: string
): Promise<UploadResult> => {
  try {
    // Validate file based on folder config
    const validation = validateFile(file, folder);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const contentType = file.type;

    // Step 1: Get signed URL (GET request)
    const signedUrlResponse = await api.getSignedUrl(
      folder,
      safeFileName,
      contentType,
      file.size
    );

    if (!signedUrlResponse.success) {
      throw new Error("Failed to get signed URL");
    }

    // Response shape: { success, data: { uploadUrl, relativePath, contentType } }
    const { uploadUrl, relativePath } = signedUrlResponse.data || signedUrlResponse;

    // Step 2: Upload file using PUT with raw body (S3 PutObject presigned URL)
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: file,
    });

    if (!uploadResponse.ok && uploadResponse.status !== 204) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    // Step 3: Verify and publish
    const verifyResponse = await api.verifyAndPublish(relativePath);
    
    if (!verifyResponse.success) {
      throw new Error("Failed to verify and publish file");
    }

    return {
      relativePath,
      publicUrl: verifyResponse.publicUrl,
      success: true,
    };
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
};
