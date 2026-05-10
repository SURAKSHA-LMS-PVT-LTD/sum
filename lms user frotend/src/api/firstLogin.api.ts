/**
 * Multi-Identifier First Login API Service (v2)
 *
 * Supports phone, email, and system ID identifiers.
 * Flow:
 *   1. Initiate (any identifier) → OTP sent via best channel
 *   2. Verify OTP → JWT + annotated profile + remaining verifications
 *   3. Additional verification (phone/email) if needed
 *   4. Complete profile + set password → real login tokens
 */

import { getBaseUrl } from '@/contexts/utils/auth.api';
import { tokenStorageService, isNativePlatform } from '@/services/tokenStorageService';
import { parseApiError } from '@/api/apiError';

// ============= TYPES =============

export interface AnnotatedField {
  value: any;
  editable: boolean;
  required: boolean;
  options?: string[];
  needsVerification?: boolean;
  isVerified?: boolean;
}

export interface InitiateResponse {
  success: boolean;
  message: string;
  otpSentVia: 'phone' | 'email' | null;
  maskedDestination: string | null;
  expiresInMinutes: number;
  verificationsRequired: { phone: boolean; email: boolean };
  userHasPhone: boolean;
  userHasEmail: boolean;
  userId: string;
  accessToken?: string;
  requiresContactInfo?: boolean;
  parentOtpUsed?: boolean;
  parentRelationship?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  access_token: string;
  userId: string;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  hasPassword: boolean;
  verificationsStillRequired: { phone: boolean; email: boolean };
  userHasPhone: boolean;
  userHasEmail: boolean;
  profile: Record<string, AnnotatedField>;
  studentFields?: Record<string, AnnotatedField>;
  parentFields?: Record<string, AnnotatedField>;
}

export interface CompleteProfileResponse {
  success: boolean;
  message: string;
  access_token: string;
  refresh_token: string;
  expires_in: string;
  refresh_expires_in: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    userType: string;
    role: string;
    phoneNumber: string;
    imageUrl?: string | null;
    nameWithInitials?: string;
    isPhoneVerified?: boolean;
    isEmailVerified?: boolean;
    firstLoginCompleted?: boolean;
    profileCompletionStatus?: string;
    profileCompletionPercentage?: number;
    institutes?: any[];
  };
}

// ============= HELPERS =============

const getApiBase = () => getBaseUrl();

async function apiFetch<T>(
  url: string,
  body: Record<string, any>,
  token?: string
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw parseApiError(res.status, JSON.stringify(data), url);
  return data as T;
}

// ============= STEP 1: INITIATE =============

/**
 * Step 1 — Send any identifier (phone / email / system ID).
 * Backend auto-detects type and sends OTP via best channel.
 */
export const initiateFirstLogin = async (
  identifier: string
): Promise<InitiateResponse> => {
  return apiFetch<InitiateResponse>(
    `${getApiBase()}/auth/first-login/initiate`,
    { identifier }
  );
};

// ============= STEP 2: VERIFY OTP =============

/**
 * Step 2 — Verify OTP received in step 1.
 * Returns JWT + annotated profile + remaining verifications.
 */
export const verifyFirstLoginOtp = async (
  identifier: string,
  otp: string,
  channel: 'phone' | 'email'
): Promise<VerifyOtpResponse> => {
  return apiFetch<VerifyOtpResponse>(
    `${getApiBase()}/auth/first-login/verify-otp`,
    { identifier, otp, channel }
  );
};

// ============= STEP 3: ADDITIONAL VERIFICATION =============

/** 3A — Request phone OTP (in-flow, requires JWT) */
export const requestPhoneOtp = async (
  phoneNumber: string,
  token: string
): Promise<{ success: boolean; message: string; expiresInMinutes: number }> => {
  return apiFetch(
    `${getApiBase()}/auth/first-login/phone/request-otp`,
    { phoneNumber },
    token
  );
};

/** 3A — Verify phone OTP (in-flow, requires JWT) */
export const verifyPhoneInFlow = async (
  phoneNumber: string,
  otp: string,
  token: string
): Promise<{ success: boolean; message: string; phoneNumber: string }> => {
  return apiFetch(
    `${getApiBase()}/auth/first-login/phone/verify-in-flow`,
    { phoneNumber, otp },
    token
  );
};

/** 3B — Request email OTP (requires JWT) */
export const requestEmailOtp = async (
  email: string,
  token: string
): Promise<{ success: boolean; message: string; expiresInMinutes: number }> => {
  return apiFetch(
    `${getApiBase()}/auth/first-login/email/request-otp`,
    { email },
    token
  );
};

/** 3B — Verify email OTP (requires JWT) */
export const verifyEmailOtp = async (
  email: string,
  otpCode: string,
  token: string
): Promise<{ success: boolean; message: string; email: string }> => {
  return apiFetch(
    `${getApiBase()}/auth/first-login/email/verify`,
    { email, otpCode },
    token
  );
};

// ============= STEP 4: COMPLETE PROFILE =============

/**
 * Step 4 — Submit profile + password.
 * Returns real login tokens (access + refresh).
 */
export const completeFirstLogin = async (
  formData: Record<string, any>,
  token: string
): Promise<CompleteProfileResponse> => {
  return apiFetch<CompleteProfileResponse>(
    `${getApiBase()}/auth/first-login/complete`,
    formData,
    token
  );
};

// ============= TOKEN STORAGE =============

/**
 * Persist the real login tokens received from step 4.
 * Uses secure storage on mobile, memory + localStorage on web.
 */
export const storeFirstLoginTokens = async (
  accessToken: string,
  refreshToken: string,
  expiresIn: string
): Promise<void> => {
  const expiryMs = parseExpiry(expiresIn);
  const expiryTimestamp = Date.now() + expiryMs;

  await tokenStorageService.setAccessToken(accessToken);
  await tokenStorageService.setRefreshToken(refreshToken);
  await tokenStorageService.setTokenExpiry(expiryTimestamp);

  if (isNativePlatform()) {
    await tokenStorageService.setRememberMe(true);
  }
};

function parseExpiry(expiresIn: string | number): number {
  if (typeof expiresIn === 'number') {
    return expiresIn > 100_000 ? expiresIn : expiresIn * 1000;
  }
  const match = expiresIn.match(/^(\d+)([hdms])$/);
  if (!match) return 24 * 60 * 60 * 1000;
  const val = parseInt(match[1]);
  switch (match[2]) {
    case 'h': return val * 60 * 60 * 1000;
    case 'd': return val * 24 * 60 * 60 * 1000;
    case 'm': return val * 60 * 1000;
    case 's': return val * 1000;
    default: return 24 * 60 * 60 * 1000;
  }
}
