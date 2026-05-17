import { apiClient } from './client';
import { enhancedCachedClient } from './enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';

// ─── Extra Column Schema ──────────────────────────────────────────────────────
export interface ExtraDataColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'email' | 'phone';
  /** Empty / undefined = applies to all user types */
  applicableTo?: string[];
}

// ─── Types ───────────────────────────────────────────────────────

export interface InstituteSettingsResponse {
  id: string;
  name: string;
  shortName?: string;
  code: string;
  email: string;
  phone?: string;
  systemContactEmail?: string;
  systemContactPhoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  district?: string;
  province?: string;
  pinCode?: string;
  type?: string;
  logoUrl?: string | null;
  loadingGifUrl?: string | null;
  primaryColorCode?: string | null;
  secondaryColorCode?: string | null;
  imageUrls?: string[];
  imageUrl?: string | null;
  reportHeaderUrl?: string | null;
  reportFooterUrl?: string | null;
  receiptHeaderUrl?: string | null;
  receiptFooterUrl?: string | null;
  vision?: string;
  mission?: string;
  websiteUrl?: string;
  facebookPageUrl?: string;
  youtubeChannelUrl?: string;
  isActive: boolean;
  updatedAt: string;
  isSessionLimitEnabled?: boolean;
  defaultSessionsPerUserCount?: number;
  isStrictSessionLimit?: boolean;
  printerSettings?: PrinterSettings | null;
  allowUserPhotoUpload?: boolean;
}

export interface InstituteProfileResponse {
  id: string;
  name: string;
  shortName?: string;
  logoUrl?: string | null;
  loadingGifUrl?: string | null;
  primaryColorCode?: string | null;
  secondaryColorCode?: string | null;
  imageUrls?: string[];
  imageUrl?: string | null;
  phone?: string;
  email: string;
  city?: string;
  type?: string;
  websiteUrl?: string;
  facebookPageUrl?: string;
  youtubeChannelUrl?: string;
  vision?: string;
  mission?: string;
}

// ─── Printer Settings ────────────────────────────────────────────────────────

export type PrintSize = '2inch' | '3inch' | '4inch' | 'a4';
export type PrintLanguage = 'en' | 'si';

export interface PrinterSettings {
  defaultSize?: PrintSize;
  language?: PrintLanguage;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
}

/** Combined response from GET /institutes/:id/print-settings */
export interface InstitutePrintSettings {
  defaultSize: PrintSize;
  language: PrintLanguage;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  /** Base64 data URL for the receipt header banner (from reportHeaderUrl) */
  headerImageDataUrl?: string | null;
  /** Base64 data URL for the receipt footer banner (from reportFooterUrl) */
  footerImageDataUrl?: string | null;
}

export interface UpdateInstituteSettingsDto {
  name?: string;
  shortName?: string;
  printerSettings?: PrinterSettings;
  email?: string;
  phone?: string;
  systemContactEmail?: string;
  systemContactPhoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  district?: string;
  province?: string;
  pinCode?: string;
  type?: string;
  logoUrl?: string | null;
  loadingGifUrl?: string | null;
  primaryColorCode?: string | null;
  secondaryColorCode?: string | null;
  imageUrls?: string[] | null;
  imageUrl?: string | null;
  reportHeaderUrl?: string | null;
  reportFooterUrl?: string | null;
  receiptHeaderUrl?: string | null;
  receiptFooterUrl?: string | null;
  vision?: string;
  mission?: string;
  websiteUrl?: string;
  facebookPageUrl?: string;
  youtubeChannelUrl?: string;
  allowUserPhotoUpload?: boolean;
  isStrictSessionLimit?: boolean;
}

// ─── API ─────────────────────────────────────────────────────────

class InstituteSettingsApi {
  /** Full settings for admin page */
  async getSettings(instituteId: string): Promise<InstituteSettingsResponse> {
    return enhancedCachedClient.get<InstituteSettingsResponse>(`/institutes/${instituteId}/settings`, undefined, { ttl: CACHE_TTL.SETTINGS });
  }

  /** Partial update */
  async updateSettings(instituteId: string, data: UpdateInstituteSettingsDto): Promise<InstituteSettingsResponse> {
    return apiClient.patch<InstituteSettingsResponse>(`/institutes/${instituteId}/settings`, data);
  }

  /** Lightweight profile for all members */
  async getProfile(instituteId: string): Promise<InstituteProfileResponse> {
    return enhancedCachedClient.get<InstituteProfileResponse>(`/institutes/${instituteId}/profile`, undefined, { ttl: CACHE_TTL.SETTINGS });
  }

  // ── Image management ───────────────────────────────────────────

  async deleteLogo(instituteId: string): Promise<InstituteSettingsResponse> {
    return apiClient.delete<InstituteSettingsResponse>(`/institutes/${instituteId}/logo`);
  }

  async deleteLoadingGif(instituteId: string): Promise<InstituteSettingsResponse> {
    return apiClient.delete<InstituteSettingsResponse>(`/institutes/${instituteId}/loading-gif`);
  }

  async deleteCoverImage(instituteId: string): Promise<InstituteSettingsResponse> {
    return apiClient.delete<InstituteSettingsResponse>(`/institutes/${instituteId}/cover-image`);
  }

  async addGalleryImage(instituteId: string, relativePath: string): Promise<InstituteSettingsResponse> {
    return apiClient.post<InstituteSettingsResponse>(`/institutes/${instituteId}/gallery`, { relativePath });
  }

  async removeGalleryImage(instituteId: string, imageIndex: number): Promise<InstituteSettingsResponse> {
    return apiClient.delete<InstituteSettingsResponse>(`/institutes/${instituteId}/gallery/${imageIndex}`);
  }

  // ── Printer Settings ──────────────────────────────────────────

  /**
   * Single call that returns printer config + header/footer images as base64.
   * Call once on page load for any receipt printing page.
   */
  async getPrintSettings(instituteId: string, forceRefresh = false): Promise<InstitutePrintSettings> {
    return enhancedCachedClient.get<InstitutePrintSettings>(
      `/institutes/${instituteId}/print-settings`,
      undefined,
      { ttl: 5 * 60 * 1000, forceRefresh },
    );
  }

  /** Save printer settings (institute admin only). */
  async updatePrinterSettings(instituteId: string, settings: PrinterSettings): Promise<InstituteSettingsResponse> {
    return apiClient.patch<InstituteSettingsResponse>(`/institutes/${instituteId}/settings`, { printerSettings: settings });
  }

  // ── User Extra Data Schema ─────────────────────────────────────

  /** Fetch the current custom column schema for institute users. */
  async getUserExtraDataSchema(instituteId: string): Promise<ExtraDataColumn[]> {
    const result = await enhancedCachedClient.get<ExtraDataColumn[] | null>(
      `/institutes/${instituteId}/user-extra-data-schema`,
      undefined,
      { ttl: CACHE_TTL.DEFAULT },
    );
    return Array.isArray(result) ? result : [];
  }

  /** Save the full schema (replaces previous). */
  async updateUserExtraDataSchema(instituteId: string, schema: ExtraDataColumn[]): Promise<ExtraDataColumn[]> {
    return apiClient.patch<ExtraDataColumn[]>(
      `/institutes/${instituteId}/user-extra-data-schema`,
      { schema },
    );
  }
}

export const instituteSettingsApi = new InstituteSettingsApi();
