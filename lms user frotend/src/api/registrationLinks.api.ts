/**
 * Registration Links API
 *
 *  - Admin endpoints (authenticated) → manage /forms/:token links for an institute.
 *  - Public endpoints (unauthenticated) → drive the public /forms/:token page:
 *    config, reverse-WhatsApp phone verification, emailed-code email verification,
 *    existing-account lookup, and register/claim.
 *
 * Phone verification is reverse-WhatsApp only (the user sends a code from their own
 * WhatsApp; we poll status). No OTP is ever sent to the phone.
 */
import { apiClient } from './client';
import { getBaseUrl, getCredentialsMode } from '@/contexts/utils/auth.api';

export type CardScope = 'INSTITUTE' | 'GLOBAL' | 'BOTH';
export type CardEmptyPoolBehavior = 'skip' | 'error';
/** Per-link mode for an institute custom column. */
export type CustomColumnMode = 'off' | 'optional' | 'required';

/** An institute custom column resolved for the public form (with its required flag). */
export interface PublicCustomColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'email' | 'phone' | 'boolean' | 'select' | string;
  options?: string[];
  required: boolean;
}

export interface RegistrationLink {
  id: string;
  token: string;
  instituteId: string;
  label?: string | null;
  allowedUserTypes: string[];
  autoAssignCard: boolean;
  cardScope: CardScope;
  cardEmptyPoolBehavior: CardEmptyPoolBehavior;
  allowClassEnrollment: boolean;
  allowSubjectEnrollment: boolean;
  requirePhoneVerification: boolean;
  requireEmailVerification: boolean;
  extraDataFields?: Record<string, CustomColumnMode> | null;
  isActive: boolean;
  expiresAt?: string | null;
  registrationCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRegistrationLinkDto {
  label?: string;
  allowedUserTypes: string[];
  autoAssignCard?: boolean;
  cardScope?: CardScope;
  cardEmptyPoolBehavior?: CardEmptyPoolBehavior;
  allowClassEnrollment?: boolean;
  allowSubjectEnrollment?: boolean;
  requirePhoneVerification?: boolean;
  requireEmailVerification?: boolean;
  extraDataFields?: Record<string, CustomColumnMode>;
  expiresAt?: string | null;
}

export interface PublicFormConfig {
  token: string;
  institute: {
    id: string;
    name: string;
    logoUrl: string | null;
    backgroundUrl: string | null;
    primaryColorCode: string | null;
    welcomeTitle: string | null;
    welcomeSubtitle: string | null;
  };
  config: {
    allowedUserTypes: string[];
    autoAssignCard: boolean;
    cardScope: CardScope;
    smartCardsEnabled: boolean;
    allowClassEnrollment: boolean;
    allowSubjectEnrollment: boolean;
    requirePhoneVerification: boolean;
    requireEmailVerification: boolean;
    customColumns: PublicCustomColumn[];
  };
  classes: Array<{
    classId: string;
    name: string;
    grade: number | null;
    subjects: Array<{ subjectId: string; name: string }>;
  }>;
}

// ── Unauthenticated fetch helper for public endpoints ─────────────────────────
async function publicRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = (getBaseUrl() ?? '').replace(/\/$/, '');
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> ?? {}) },
    credentials: getCredentialsMode(),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      msg = body?.message ?? msg;
      if (Array.isArray(msg)) msg = msg.join(', ');
    } catch { /* ignore */ }
    throw new Error(`${res.status}: ${msg}`);
  }
  return res.json() as Promise<T>;
}

class RegistrationLinksApi {
  // ── Admin (authenticated) ──────────────────────────────────────────────────
  createLink(instituteId: string, dto: CreateRegistrationLinkDto): Promise<RegistrationLink> {
    return apiClient.post<RegistrationLink>(`/institutes/${instituteId}/registration-links`, dto);
  }

  listLinks(instituteId: string): Promise<RegistrationLink[]> {
    return apiClient.get<RegistrationLink[]>(`/institutes/${instituteId}/registration-links`);
  }

  updateLink(instituteId: string, linkId: string, patch: Partial<CreateRegistrationLinkDto> & { isActive?: boolean }): Promise<RegistrationLink> {
    return apiClient.patch<RegistrationLink>(`/institutes/${instituteId}/registration-links/${linkId}`, patch);
  }

  deleteLink(instituteId: string, linkId: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(`/institutes/${instituteId}/registration-links/${linkId}`);
  }

  // ── Public (unauthenticated) ───────────────────────────────────────────────
  getPublicConfig(token: string): Promise<PublicFormConfig> {
    return publicRequest<PublicFormConfig>(`/public/forms/${token}`);
  }

  requestPhone(token: string, phoneNumber: string): Promise<{ success: boolean; waLink: string; existingUserId: string | null; expiresAt: string }> {
    return publicRequest(`/public/forms/${token}/verify/phone/request`, {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    });
  }

  phoneStatus(token: string, phoneNumber: string): Promise<{ verified: boolean; expired: boolean }> {
    return publicRequest(`/public/forms/${token}/verify/phone/status?phoneNumber=${encodeURIComponent(phoneNumber)}`);
  }

  requestEmail(token: string, email: string): Promise<{ success: boolean; existingUserId: string | null; expiresAt: string }> {
    return publicRequest(`/public/forms/${token}/verify/email/request`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  confirmEmail(token: string, email: string, code: string): Promise<{ success: boolean; message: string }> {
    return publicRequest(`/public/forms/${token}/verify/email/confirm`, {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  }

  lookupExisting(token: string, params: { phoneNumber?: string; email?: string }): Promise<{
    existingUserId: string;
    filled: Record<string, any>;
    missing: string[];
    hasFather?: boolean;
    hasMother?: boolean;
    hasGuardian?: boolean;
  }> {
    return publicRequest(`/public/forms/${token}/existing/lookup`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  lookupParent(token: string, params: { phoneNumber?: string; email?: string }): Promise<{
    found: boolean;
    existingUserId?: string;
    filled?: Record<string, any>;
    missing?: string[];
  }> {
    return publicRequest(`/public/forms/${token}/parent/lookup`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  register(token: string, payload: any): Promise<{ success: boolean; mode: 'created' | 'claimed'; message: string; userId: string; cardPendingScopes?: string[] }> {
    return publicRequest(`/public/forms/${token}/register`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export const registrationLinksApi = new RegistrationLinksApi();
