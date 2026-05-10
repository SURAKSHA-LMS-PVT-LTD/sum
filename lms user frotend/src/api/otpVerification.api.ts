/**
 * Public OTP Verification API (Registration flow)
 * Uses Authorization Bearer header (VITE_SPECIAL_API_KEY)
 * No JWT required
 */

import { getBaseUrl } from '@/contexts/utils/auth.api';

const getHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${import.meta.env.VITE_SPECIAL_API_KEY || ''}`,
});

export interface OtpRequestResponse {
  success: boolean;
  message: string;
  expiresAt?: string;
  remainingAttempts?: number;
}

export interface OtpVerifyResponse {
  success: boolean;
  message: string;
}

async function otpFetch<T>(path: string, body: Record<string, any>): Promise<T> {
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = typeof data.message === 'string' ? data.message : Array.isArray(data.message) ? data.message.join('. ') : 'Request failed';
    throw new Error(msg);
  }
  return data as T;
}

// ========== EMAIL OTP ==========

export const requestEmailOtp = (email: string) =>
  otpFetch<OtpRequestResponse>('/users/create-email-otp/request', { email });

export const verifyEmailOtp = (email: string, otpCode: string) =>
  otpFetch<OtpVerifyResponse>('/users/create-email-otp/verify', { email, otpCode });

export const reRequestEmailOtp = (email: string) =>
  otpFetch<OtpRequestResponse>('/users/create-email-otp/re-request', { email });

// ========== PHONE OTP ==========

export const requestPhoneOtp = (phoneNumber: string) =>
  otpFetch<OtpRequestResponse>('/users/create-phone-number-otp/request', { phoneNumber });

export const verifyPhoneOtp = (phoneNumber: string, otpCode: string) =>
  otpFetch<OtpVerifyResponse>('/users/create-phone-number-otp/verify', { phoneNumber, otpCode });

export const reRequestPhoneOtp = (phoneNumber: string) =>
  otpFetch<OtpRequestResponse>('/users/create-phone-number-otp/re-request', { phoneNumber });
