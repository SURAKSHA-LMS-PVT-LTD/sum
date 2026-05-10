// ═══════════════════════════════════════════════════════════════════════════
// instituteReportBranding.ts
//
// Fetches per-institute report header and footer images and converts them
// to base64 data URLs.  Results are module-level cached so that batches of
// 30+ students only hit the network once per session per institute.
//
// USAGE:
//   import { fetchInstituteReportBranding } from '@/utils/instituteReportBranding';
//   const branding = await fetchInstituteReportBranding('109');
//   // branding = { instituteHeaderDataUrl, instituteFooterDataUrl }
//   await generateStudentClassReport(payload, options, { ...branding });
//
// BACKEND CONTRACT:
//   GET /institutes/:id/report-branding
//   Response fields: instituteHeaderDataUrl / instituteFooterDataUrl
//   The backend fetches the stored images server-side and returns base64 data URLs
//   so the browser does not need direct CORS access to storage.suraksha.lk.
//
// DESIGNER TODO:
//   [ ] The header image should be a wide banner (e.g. 1400×175 px, ~8:1 ratio)
//   [ ] The footer image should be a wide banner (e.g. 1400×100 px, ~14:1 ratio)
//   [ ] Upload UI is in InstituteSettingsPage.tsx → "Report Branding" tab/section
// ═══════════════════════════════════════════════════════════════════════════

import { apiClient } from '@/api/client';

export interface InstituteReportBranding {
  instituteHeaderDataUrl: string | null;
  instituteFooterDataUrl: string | null;
}

// Module-level cache: key = instituteId, value = resolved branding
const brandingCache = new Map<string, InstituteReportBranding>();

/**
 * Fetches and caches report branding images for the given institute.
 * Call once before a batch and spread the result into generateStudentClassReport's PrintOptions.
 *
 * @param instituteId — numeric institute ID as string
 * @param forceRefresh — bypass cache and re-fetch (use after settings update)
 */
export async function fetchInstituteReportBranding(
  instituteId: string,
  forceRefresh = false,
): Promise<InstituteReportBranding> {
  if (!forceRefresh && brandingCache.has(instituteId)) {
    return brandingCache.get(instituteId)!;
  }

  let headerDataUrl: string | null = null;
  let footerDataUrl: string | null = null;

  try {
    const branding: any = await apiClient.get(`/institutes/${instituteId}/report-branding`);
    headerDataUrl = branding?.instituteHeaderDataUrl ?? null;
    footerDataUrl = branding?.instituteFooterDataUrl ?? null;
  } catch {
    // Network error or institute has no report branding — use Suraksha defaults
    headerDataUrl = null;
    footerDataUrl = null;
  }

  const result: InstituteReportBranding = { instituteHeaderDataUrl: headerDataUrl, instituteFooterDataUrl: footerDataUrl };
  brandingCache.set(instituteId, result);
  return result;
}

/** Clear cached branding (call after admin uploads new images) */
export function clearInstituteReportBrandingCache(instituteId?: string): void {
  if (instituteId) {
    brandingCache.delete(instituteId);
  } else {
    brandingCache.clear();
  }
}
