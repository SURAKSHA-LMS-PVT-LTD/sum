export interface FolderConfig {
  maxSizeMB: number;
  acceptedTypes: string[];
  mimeTypes: string[];
}

export const UPLOAD_FOLDER_CONFIG: Record<string, FolderConfig> = {
  'profile-images': {
    maxSizeMB: 5,
    acceptedTypes: ['JPEG', 'PNG', 'GIF', 'WebP'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  },
  'student-images': {
    maxSizeMB: 5,
    acceptedTypes: ['JPEG', 'PNG', 'GIF', 'WebP'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  },
  'institute-images': {
    maxSizeMB: 5,
    acceptedTypes: ['JPEG', 'PNG', 'SVG', 'WebP'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'],
  },
  'institute-user-images': {
    maxSizeMB: 5,
    acceptedTypes: ['JPEG', 'PNG', 'GIF', 'WebP'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  },
  'subject-images': {
    maxSizeMB: 5,
    acceptedTypes: ['JPEG', 'PNG', 'SVG', 'WebP'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'],
  },
  'homework-files': {
    maxSizeMB: 5,
    acceptedTypes: ['PDF', 'JPEG', 'PNG'],
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  'correction-files': {
    maxSizeMB: 5,
    acceptedTypes: ['PDF', 'JPEG', 'PNG'],
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  'institute-payment-receipts': {
    maxSizeMB: 5,
    acceptedTypes: ['PDF', 'JPEG', 'PNG'],
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  'subject-payment-receipts': {
    maxSizeMB: 5,
    acceptedTypes: ['PDF', 'JPEG', 'PNG'],
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  'enrollment-payment-receipts': {
    maxSizeMB: 5,
    acceptedTypes: ['PDF', 'JPEG', 'PNG'],
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  'id-documents': {
    maxSizeMB: 5,
    acceptedTypes: ['PDF', 'JPEG', 'PNG'],
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  'bookhire-vehicle-images': {
    maxSizeMB: 5,
    acceptedTypes: ['JPEG', 'PNG', 'WebP'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  'bookhire-owner-images': {
    maxSizeMB: 5,
    acceptedTypes: ['JPEG', 'PNG', 'WebP'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  'structured-lecture-covers': {
    maxSizeMB: 5,
    acceptedTypes: ['JPEG', 'PNG', 'WebP'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
  'structured-lecture-documents': {
    maxSizeMB: 5,
    acceptedTypes: ['PDF', 'JPEG', 'PNG'],
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  'service-payment-receipts': {
    maxSizeMB: 5,
    acceptedTypes: ['PDF', 'JPEG', 'PNG'],
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  },
  'institute-branding': {
    maxSizeMB: 5,
    acceptedTypes: ['JPEG', 'PNG', 'SVG', 'WebP', 'GIF'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp', 'image/gif'],
  },
};

export const getFolderConfig = (folder: string): FolderConfig => {
  return UPLOAD_FOLDER_CONFIG[folder] || {
    maxSizeMB: 5,
    acceptedTypes: ['JPEG', 'PNG'],
    mimeTypes: ['image/jpeg', 'image/png'],
  };
};

export const validateFile = (file: File, folder: string): { valid: boolean; error?: string } => {
  const config = getFolderConfig(folder);
  const maxSizeBytes = config.maxSizeMB * 1024 * 1024;

  if (file.size > maxSizeBytes) {
    return { valid: false, error: `File size exceeds ${config.maxSizeMB}MB limit` };
  }

  if (!config.mimeTypes.includes(file.type)) {
    return { valid: false, error: `Invalid file type. Accepted: ${config.acceptedTypes.join(', ')}` };
  }

  return { valid: true };
};

export const getAcceptString = (folder: string): string => {
  const config = getFolderConfig(folder);
  return config.mimeTypes.join(',');
};
