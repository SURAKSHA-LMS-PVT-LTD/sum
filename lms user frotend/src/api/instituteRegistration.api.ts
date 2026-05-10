/**
 * Institute Registration API
 * Complete flow: eligibility check, file uploads, institute creation, auto-admin assignment
 */

import { getBaseUrl, getAccessTokenAsync } from '@/contexts/utils/auth.api';
import { jwtDecode } from 'jwt-decode';
import { parseApiError } from '@/api/apiError';

// ============= TYPES =============

interface GlobalJwtPayload {
  s: string;   // userId
  e: string;   // email
  fn: string;  // firstName
  ln: string;  // lastName
  ut: string;  // userType
  iat: number;
  exp: number;
}

export interface CreateInstituteRequest {
  name: string;
  code: string;
  email: string;
  shortName?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  district?: string;
  province?: string;
  pinCode?: string;
  description?: string;
  websiteUrl?: string;
  logoUrl?: string;
  loadingGifUrl?: string;
  imageUrl?: string;
  imageUrls?: string[];
  primaryColorCode?: string;
  secondaryColorCode?: string;
  systemContactPhoneNumber?: string;
  systemContactEmail?: string;
}

export interface CreateInstituteResponse {
  id: string;
  name: string;
  shortName: string | null;
  code: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  province: string | null;
  country: string | null;
  pinCode: string | null;
  logoUrl: string | null;
  loadingGifUrl: string | null;
  imageUrl: string | null;
  imageUrls: string[] | null;
  description: string | null;
  websiteUrl: string | null;
  primaryColorCode: string | null;
  secondaryColorCode: string | null;
  isActive?: boolean;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface SignedUrlResponse {
  success: boolean;
  uploadUrl: string;
  publicUrl: string;
  relativePath: string;
  expiresAt: string;
  fields?: Record<string, string>;
}

interface VerifyPublishResponse {
  success: boolean;
  publicUrl: string;
  relativePath: string;
}

// ============= ELIGIBILITY =============

const BLOCKED_USER_TYPES = ['USER_WITHOUT_PARENT'];

export function canCreateInstitute(userType?: string): boolean {
  if (!userType) return false;
  return !BLOCKED_USER_TYPES.includes(userType.toUpperCase());
}

export function canCreateInstituteFromJwt(jwt: string): boolean {
  try {
    const payload = jwtDecode<GlobalJwtPayload>(jwt);
    return !BLOCKED_USER_TYPES.includes(payload.ut);
  } catch {
    return false;
  }
}

// ============= FILE VALIDATION =============

const ALLOWED_INSTITUTE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_INSTITUTE_SIZE = 10 * 1024 * 1024; // 10 MB

export function validateInstituteImage(file: File): string | null {
  if (!ALLOWED_INSTITUTE_TYPES.includes(file.type)) {
    return 'Invalid file type. Allowed: JPEG, PNG, WebP, SVG';
  }
  if (file.size > MAX_INSTITUTE_SIZE) {
    return `File too large. Maximum: 10 MB (file is ${(file.size / 1024 / 1024).toFixed(1)} MB)`;
  }
  // Check for double extensions
  const parts = file.name.split('.');
  if (parts.length > 2) {
    return 'Double extensions are not allowed';
  }
  return null;
}

// ============= AUTH HELPERS =============

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessTokenAsync();
  if (!token) throw new Error('Your session has expired. Please log in again.');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function getAuthToken(): Promise<string> {
  const token = await getAccessTokenAsync();
  if (!token) throw new Error('Your session has expired. Please log in again.');
  return token;
}

// ============= FILE UPLOAD (3-step signed URL flow) =============

export async function uploadInstituteFile(file: File): Promise<string> {
  const error = validateInstituteImage(file);
  if (error) throw new Error(error);

  const baseUrl = getBaseUrl();
  const token = await getAuthToken();

  // Step 1: Get signed URL
  const params = new URLSearchParams({
    folder: 'institute-images',
    fileName: file.name,
    contentType: file.type,
    fileSize: String(file.size),
  });

  const signedRes = await fetch(`${baseUrl}/upload/get-signed-url?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!signedRes.ok) {
    const errorText = await signedRes.text().catch(() => '');
    throw parseApiError(signedRes.status, errorText);
  }

  const { uploadUrl, relativePath, fields }: SignedUrlResponse = await signedRes.json();

  // Step 2: Upload to cloud storage
  if (fields) {
    // AWS S3 multipart POST
    const formData = new FormData();
    Object.entries(fields).forEach(([k, v]) => formData.append(k, v));
    formData.append('file', file);
    const upRes = await fetch(uploadUrl, { method: 'POST', body: formData });
    if (!upRes.ok) throw new Error('Failed to upload file. Please try again.');
  } else {
    // GCS PUT
    const upRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!upRes.ok) throw new Error('Failed to upload file. Please try again.');
  }

  // Step 3: Verify & Publish
  const verifyRes = await fetch(`${baseUrl}/upload/verify-and-publish`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ relativePath }),
  });

  if (!verifyRes.ok) {
    const errorText = await verifyRes.text().catch(() => '');
    throw parseApiError(verifyRes.status, errorText);
  }

  const { relativePath: finalPath }: VerifyPublishResponse = await verifyRes.json();
  return finalPath;
}

// ============= CREATE INSTITUTE =============

export async function registerInstitute(data: CreateInstituteRequest): Promise<CreateInstituteResponse> {
  const baseUrl = getBaseUrl();
  const headers = await getAuthHeaders();

  const response = await fetch(`${baseUrl}/institutes`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw parseApiError(response.status, errorText);
  }

  return response.json();
}

// ============= AUTO-ADMIN ASSIGNMENT =============

export async function assignUserAsAdmin(
  instituteId: string,
  method: 'phone' | 'email' | 'id',
  identifier: string,
): Promise<void> {
  const baseUrl = getBaseUrl();
  const headers = await getAuthHeaders();

  const endpoints: Record<string, string> = {
    phone: `${baseUrl}/institute-users/institute/${instituteId}/assign-user-by-phone`,
    email: `${baseUrl}/institute-users/institute/${instituteId}/assign-user-by-email`,
    id: `${baseUrl}/institute-users/institute/${instituteId}/assign-user-by-id`,
  };

  const bodies: Record<string, object> = {
    phone: { phoneNumber: identifier, instituteUserType: 'INSTITUTE_ADMIN' },
    email: { email: identifier, instituteUserType: 'INSTITUTE_ADMIN' },
    id: { userId: identifier, instituteUserType: 'INSTITUTE_ADMIN' },
  };

  const res = await fetch(endpoints[method], {
    method: 'POST',
    headers,
    body: JSON.stringify(bodies[method]),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    // Don't throw if user is already assigned
    if (res.status === 400 && err.message?.includes('already assigned')) return;
    const errorText = JSON.stringify(err);
    throw parseApiError(res.status, errorText);
  }
}

// ============= SELECT INSTITUTE (get scoped token) =============

export async function selectInstituteToken(instituteId: string): Promise<string> {
  const baseUrl = getBaseUrl();
  const headers = await getAuthHeaders();

  const res = await fetch(`${baseUrl}/auth/institutes/${instituteId}/select`, {
    method: 'POST',
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw parseApiError(res.status, errorText);
  }

  const data = await res.json();
  return data.access_token;
}

// ============= COMPLETE FLOW =============

export interface InstituteCreationResult {
  instituteId: string;
  instituteName: string;
  instituteCode: string;
}

export async function fullInstituteCreationFlow(
  formData: {
    name: string;
    code: string;
    email: string;
    shortName?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    district?: string;
    province?: string;
    pinCode?: string;
    description?: string;
    websiteUrl?: string;
    primaryColorCode?: string;
    secondaryColorCode?: string;
    systemContactPhoneNumber?: string;
    systemContactEmail?: string;
    logoFile?: File;
    loadingGifFile?: File;
    coverImageFile?: File;
    galleryFiles?: File[];
  },
  assignMethod?: { type: 'phone' | 'email' | 'id'; value: string },
): Promise<InstituteCreationResult> {
  const {
    logoFile, loadingGifFile, coverImageFile, galleryFiles = [],
    ...textFields
  } = formData;

  // Upload all files in parallel
  const uploadPromises = [
    logoFile ? uploadInstituteFile(logoFile) : Promise.resolve(undefined),
    loadingGifFile ? uploadInstituteFile(loadingGifFile) : Promise.resolve(undefined),
    coverImageFile ? uploadInstituteFile(coverImageFile) : Promise.resolve(undefined),
    ...galleryFiles.map(f => uploadInstituteFile(f)),
  ];

  const [logoUrl, loadingGifUrl, imageUrl, ...galleryUrls] = await Promise.all(uploadPromises);

  const payload: CreateInstituteRequest = {
    ...textFields,
    country: textFields.state ? undefined : 'SRI_LANKA',
    ...(logoUrl && { logoUrl }),
    ...(loadingGifUrl && { loadingGifUrl }),
    ...(imageUrl && { imageUrl }),
    ...(galleryUrls.filter(Boolean).length > 0 && { imageUrls: galleryUrls.filter(Boolean) as string[] }),
  };

  // Create institute
  const institute = await registerInstitute(payload);

  // Auto-assign as admin if method provided
  if (assignMethod) {
    try {
      await assignUserAsAdmin(institute.id, assignMethod.type, assignMethod.value);
    } catch (err) {
      console.warn('Auto-admin assignment failed (institute created):', err);
    }
  }

  return {
    instituteId: institute.id,
    instituteName: institute.name,
    instituteCode: institute.code,
  };
}

// ============= VALIDATORS =============

export const isValidInstituteCode = (code: string): boolean => /^[A-Z0-9_-]+$/.test(code);
export const isValidSriLankanPhone = (phone: string): boolean => /^\+947[0-9]{8}$/.test(phone);
export const isValidHexColor = (color: string): boolean => /^#[0-9A-Fa-f]{6}$/.test(color);
