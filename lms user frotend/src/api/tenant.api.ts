import { apiClient } from './client';
import { enhancedCachedClient } from './enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';

// ─── Types ───────────────────────────────────────────────────────

export interface SubdomainCheckResponse {
  available: boolean;
  message?: string;
}

export interface SetSubdomainResponse {
  subdomain: string;
  url: string;
  message: string;
}

export interface SetCustomDomainResponse {
  customDomain: string;
  message: string;
}

export interface VerifyDomainResponse {
  verified: boolean;
  message: string;
}

export interface LoginBrandingData {
  loginLogoUrl?: string | null;
  loginBackgroundType?: 'COLOR' | 'GRADIENT' | 'IMAGE' | 'VIDEO';
  loginBackgroundUrl?: string | null;
  loginVideoPosterUrl?: string | null;
  loginIllustrationUrl?: string | null;
  loginWelcomeTitle?: string | null;
  loginWelcomeSubtitle?: string | null;
  loginFooterText?: string | null;
  faviconUrl?: string | null;
  customAppName?: string | null;
  poweredByVisible?: boolean;
}

export interface TenantSettingsResponse {
  tier?: string;
  subdomain?: string | null;
  customDomain?: string | null;
  customDomainVerified?: boolean;
  customLoginEnabled?: boolean;
  isVisibleInApp?: boolean;
  isVisibleInWebSelector?: boolean;
  loginLogoUrl?: string | null;
  loginBackgroundType?: string;
  loginBackgroundUrl?: string | null;
  loginVideoPosterUrl?: string | null;
  loginIllustrationUrl?: string | null;
  loginWelcomeTitle?: string | null;
  loginWelcomeSubtitle?: string | null;
  loginFooterText?: string | null;
  faviconUrl?: string | null;
  customAppName?: string | null;
  poweredByVisible?: boolean;
}

export interface LoginStatsResponse {
  totalLogins: number;
  subdomainLogins: number;
  customDomainLogins: number;
  uniqueSubdomainUsers: number;
  uniqueCustomDomainUsers: number;
}

export interface SmsSettingsResponse {
  smsSenderName: string | null;
  emailSenderAddress: string | null;
  emailSenderName: string | null;
  effectiveSmsSender: string;
  activeMasks: { maskId: string; displayName: string; isDefault: boolean; status: string }[];
  tier: string;
}

export interface UpdateSmsSettingsData {
  smsSenderName?: string | null;
  emailSenderAddress?: string | null;
  emailSenderName?: string | null;
}

export interface PlanInfoResponse {
  tier: string;
  subdomain?: string | null;
  customDomain?: string | null;
  customDomainVerified?: boolean;
  features: {
    subdomain: boolean;
    customDomain: boolean;
    loginBranding: boolean;
    videoBackground: boolean;
    hidePoweredBy: boolean;
    smsMasking: boolean;
    whiteLabel: boolean;
    smsEnabled?: boolean;
    pushNotifications?: boolean;
  };
  billing: {
    baseMonthlyFee: number;
    perUserMonthlyFee: number;
    perSubdomainLoginFee: number;
    smsMaskingMonthlyFee: number;
    maxFreeSubdomainLogins: number;
  } | null;
}

export interface BillingConfigResponse {
  id: string;
  instituteId: string;
  tier: string;
  baseMonthlyFee: number;
  perUserMonthlyFee: number;
  perSubdomainLoginFee: number;
  smsMaskingMonthlyFee: number;
  maxFreeSubdomainLogins: number;
  billingCycleStartDay: number;
  currency: string;
  isActive: boolean;
}

export interface BillingSummaryResponse {
  id?: string;
  instituteId?: string;
  billingMonth?: string;
  totalLogins: number;
  subdomainLogins: number;
  customDomainLogins: number;
  uniqueSubdomainUsers?: number;
  uniqueCustomDomainUsers?: number;
  totalActiveUsers: number;
  baseFee: number;
  userFee: number;
  loginFee: number;
  smsMaskingFee: number;
  totalFee: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  invoiceUrl?: string | null;
  paidAt: string | null;
  isEmpty?: boolean;
}

// ─── API ─────────────────────────────────────────────────────────

class TenantApi {
  // ── Subdomain ──────────────────────────────────────────────────

  async checkSubdomainAvailability(subdomain: string): Promise<SubdomainCheckResponse> {
    return enhancedCachedClient.get<SubdomainCheckResponse>(
      `/v2/tenant/subdomain/check/${encodeURIComponent(subdomain)}`,
      undefined,
      { ttl: 0, forceRefresh: true }
    );
  }

  async setSubdomain(instituteId: string, subdomain: string): Promise<SetSubdomainResponse> {
    return apiClient.patch<SetSubdomainResponse>(
      `/v2/tenant/institutes/${instituteId}/subdomain`,
      { subdomain }
    );
  }

  async removeSubdomain(instituteId: string): Promise<void> {
    return apiClient.delete(`/v2/tenant/institutes/${instituteId}/subdomain`);
  }

  // ── Custom Domain ──────────────────────────────────────────────

  async setCustomDomain(instituteId: string, domain: string): Promise<SetCustomDomainResponse> {
    return apiClient.patch<SetCustomDomainResponse>(
      `/v2/tenant/institutes/${instituteId}/custom-domain`,
      { domain }
    );
  }

  async verifyCustomDomain(instituteId: string): Promise<VerifyDomainResponse> {
    return apiClient.post<VerifyDomainResponse>(
      `/v2/tenant/institutes/${instituteId}/verify-domain`,
      {}
    );
  }

  // ── Login Branding ─────────────────────────────────────────────

  async getLoginBranding(instituteId: string): Promise<LoginBrandingData> {
    return apiClient.get(`/v2/tenant/institutes/${instituteId}/login-branding`);
  }

  async updateLoginBranding(instituteId: string, data: LoginBrandingData): Promise<any> {
    return apiClient.patch(
      `/v2/tenant/institutes/${instituteId}/login-branding`,
      data
    );
  }

  // ── Visibility ─────────────────────────────────────────────────

  async updateVisibility(instituteId: string, data: { isVisibleInApp?: boolean; isVisibleInWebSelector?: boolean }): Promise<any> {
    return apiClient.patch(
      `/v2/tenant/institutes/${instituteId}/visibility`,
      data
    );
  }

  // ── Stats ──────────────────────────────────────────────────────

  async getLoginStats(instituteId: string, year: number, month: number): Promise<LoginStatsResponse> {
    return enhancedCachedClient.get<LoginStatsResponse>(
      `/v2/tenant/institutes/${instituteId}/login-stats?year=${year}&month=${month}`,
      undefined,
      { ttl: CACHE_TTL.SETTINGS, instituteId }
    );
  }

  // ── SMS Settings ───────────────────────────────────────────────

  async getSmsSettings(instituteId: string): Promise<SmsSettingsResponse> {
    return enhancedCachedClient.get<SmsSettingsResponse>(
      `/v2/tenant/institutes/${instituteId}/sms-settings`,
      undefined,
      { ttl: CACHE_TTL.SETTINGS, forceRefresh: true, instituteId }
    );
  }

  async updateSmsSettings(instituteId: string, data: UpdateSmsSettingsData): Promise<SmsSettingsResponse> {
    return apiClient.patch<SmsSettingsResponse>(
      `/v2/tenant/institutes/${instituteId}/sms-settings`,
      data
    );
  }

  // ── Plan Info ──────────────────────────────────────────────────

  async getPlanInfo(instituteId: string, forceRefresh = false): Promise<PlanInfoResponse> {
    return enhancedCachedClient.get<PlanInfoResponse>(
      `/v2/tenant/institutes/${instituteId}/plan-info`,
      undefined,
      { ttl: 2, forceRefresh, instituteId }
    );
  }

  // ── Billing ────────────────────────────────────────────────────

  async getBillingConfig(instituteId: string, forceRefresh = false): Promise<BillingConfigResponse> {
    return enhancedCachedClient.get<BillingConfigResponse>(
      `/v2/tenant/institutes/${instituteId}/billing-config`,
      undefined,
      { ttl: 2, forceRefresh, instituteId }
    );
  }

  async getBillingSummary(instituteId: string, year: number, month: number): Promise<BillingSummaryResponse> {
    return enhancedCachedClient.get<BillingSummaryResponse>(
      `/v2/tenant/institutes/${instituteId}/billing-summary?year=${year}&month=${month}`,
      undefined,
      { ttl: CACHE_TTL.SETTINGS, instituteId }
    );
  }
}

export const tenantApi = new TenantApi();
