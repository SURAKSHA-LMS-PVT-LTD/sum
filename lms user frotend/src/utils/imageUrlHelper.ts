/**
 * Safely open a URL in a new tab, rejecting dangerous schemes (javascript:, data:, vbscript:).
 * Use this wherever the URL comes from the database or user input rather than being constructed in code.
 */
export const safeOpenUrl = (url: string | null | undefined, target = '_blank'): void => {
  if (!url) return;
  const lower = url.trim().toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    console.warn('[safeOpenUrl] Blocked unsafe URL scheme:', url.slice(0, 40));
    return;
  }
  window.open(url, target, 'noopener,noreferrer');
};

/**
 * Transform image URLs to use the storage.suraksha.lk base URL
 * Handles AWS S3, GCS, or relative paths and converts them to the correct format
 */
export const getImageUrl = (imageUrl: string | null | undefined): string => {
  if (!imageUrl) return '';
  
  const STORAGE_BASE_URL = 'https://storage.suraksha.lk';
  
  // If already using storage.suraksha.lk, return as is
  if (imageUrl.startsWith(STORAGE_BASE_URL)) {
    return imageUrl;
  }
  
  // If it's a full URL, be very careful about rewriting
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    // DO NOT rewrite local development URLs
    if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
      return imageUrl;
    }

    // Extract relative path from AWS S3 URLs
    const s3Match = imageUrl.match(/https?:\/\/[^\/]+\.s3[^\/]*\.amazonaws\.com\/(.+)$/);
    if (s3Match) {
      const path = s3Match[1].split('?')[0];
      return `${STORAGE_BASE_URL}/${path}`;
    }
    
    // Extract relative path from GCS URLs
    const gcsMatch = imageUrl.match(/https?:\/\/storage\.googleapis\.com\/[^\/]+\/(.+)$/);
    if (gcsMatch) {
      const path = gcsMatch[1].split('?')[0];
      return `${STORAGE_BASE_URL}/${path}`;
    }
    
    // Extract relative path from direct GCS bucket URLs
    const gcsBucketMatch = imageUrl.match(/https?:\/\/[^\/]+\.storage\.googleapis\.com\/(.+)$/);
    if (gcsBucketMatch) {
      const path = gcsBucketMatch[1].split('?')[0];
      return `${STORAGE_BASE_URL}/${path}`;
    }

    // If it's some other full URL, return it as-is instead of blindly prepending STORAGE_BASE_URL
    return imageUrl;
  }
  
  // If it's a relative path (no protocol), prepend base URL
  // Remove leading slash if present
  const relativePath = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
  return `${STORAGE_BASE_URL}/${relativePath}`;
};
