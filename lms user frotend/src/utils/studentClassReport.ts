// ═══════════════════════════════════════════════════════════════════════════
// studentClassReport.ts  —  PDF report generator for student class profiles
//
// USAGE:
//   import { generateStudentClassReport } from '@/utils/studentClassReport';
//   import { fetchInstituteReportBranding } from '@/utils/instituteReportBranding';
//
//   // Pre-fetch branding once (cached) then reuse across all students in batch:
//   const branding = await fetchInstituteReportBranding(instituteId);
//   await generateStudentClassReport(payload, options, { ...branding });
//
// SECTIONS (controlled by ClassReportOptions):
//   physical  — Physical / General attendance table
//   live      — Live lecture attendance table
//   recording — Recording activity table
//   payments  — Payments table
//
// PRINT OPTIONS (PrintOptions):
//   evenPages        — Pad each PDF to even page count (duplex / booklet printing)
//   bindingMarginMm  — Extra left margin in mm for binding (0–30)
//   pageNumberOffset — Add N to displayed page numbers (for manual merge continuity)
//   instituteHeaderDataUrl — base64 data URL for institute report header image
//   instituteFooterDataUrl — base64 data URL for institute report footer image
//
// DESIGNER TODO:
//   [ ] Replace static banner imports with institute-customised images
//   [ ] Choose whether to overlay logo on institute header or keep side-by-side
//   [ ] Add student photo (top-right of cover) — payload.student.imageUrl
//   [ ] Colour theme from institute.primaryColorCode
// ═══════════════════════════════════════════════════════════════════════════

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Static Vite imports — correct hashed URLs in both dev and prod
import mainLogoUrl from '@/assets/surakshalms-main-logo.png';
import attBannerUrl from '@/assets/banners/pycycleattendancebanner.png';
import liveBannerUrl from '@/assets/banners/liveclassbanner.png';
import recBannerUrl from '@/assets/banners/recordinghistorybanner.png';
import payBannerUrl from '@/assets/banners/paymentbanner.png';
import footerBannerUrl from '@/assets/banners/footer.png';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClassReportStudent {
  name: string;
  fullName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  /** Institute-assigned student ID. */
  userIdByInstitute?: string | null;
  /** Global Suraksha system user ID (the user's DB id or formatted system code). */
  surakshaUserId?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  address?: string | null;
  /** Institute-specific profile image. Full CDN URL. */
  imageUrl?: string | null;
  /** Fallback global Suraksha profile image URL. Used when imageUrl is null and useFallbackGlobalImage=true. */
  globalImageUrl?: string | null;
}

export interface ClassReportOptions {
  physical: boolean;
  live: boolean;
  recording: boolean;
  payments: boolean;
  paymentMode?: 'SUMMARY' | 'FULL';
  /** How the total attendance is calculated for the summary. */
  physicalTotalMode?: 'AUTO' | 'GROUP' | 'SESSION' | 'DAY' | 'CUSTOM';
  /** The manually entered total count if mode is CUSTOM. */
  physicalTotalValue?: number;
}

/**
 * Controls which student detail fields appear in the report cover block.
 * Passed via PrintOptions.studentFields.  All fields default to shown when not provided.
 */
export interface StudentFieldOptions {
  /** Render the student photo (22×22 mm) in the top-right of the cover block. */
  showImage: boolean;
  /**
   * Only relevant when showImage=true.
   * If the student has no institute-specific image, fall back to their global Suraksha profile image.
   * When false and no institute image exists, an empty circle placeholder is drawn.
   */
  useFallbackGlobalImage: boolean;
  showNameWithInitials: boolean;
  showFullName: boolean;
  showDateOfBirth: boolean;
  showInstituteUserId: boolean;
  showSurakshaUserId: boolean;
  showAddress: boolean;
}

/** Controls physical layout for printing / binding. All fields are optional. */
export interface PrintOptions {
  /**
   * Pad each student PDF to an even number of pages.
   * Useful for duplex printing: every student starts on a fresh recto page.
   * When zipping multiple PDFs for bulk printing, this ensures no bleed-over.
   */
  evenPages?: boolean;

  /**
   * Extra left-side margin in mm added on top of the default 14 mm.
   * Use 10–20 mm for ring binding, 5–10 mm for staple binding.
   */
  bindingMarginMm?: number;

  /**
   * Offset added to all displayed page numbers.
   * Set this to the accumulated page count when generating a batch so that
   * page N of student A becomes page (N + offset) in the merged printout.
   * NOTE: auto-increment between students is NOT handled here — caller
   * must track and pass the offset for each student in the batch loop.
   */
  pageNumberOffset?: number;

  /**
   * Extra offset from the top edge in mm for the report header/body.
   * Use this to push the page content lower when the header needs more breathing room.
   */
  topMarginMm?: number;

  /**
   * Controls whether the report header is rendered as a wide top banner or a left-aligned block.
   */
  headerPosition?: 'top' | 'left';

  /**
   * Pre-fetched base64 data URL for the institute report header image.
   * When provided, this replaces the default Suraksha logo row at the top
   * of every page.  Fetch once per batch via fetchInstituteReportBranding().
   * Expected aspect ratio: roughly 8:1 (wide banner).
   */
  instituteHeaderDataUrl?: string | null;

  /**
   * Pre-fetched base64 data URL for the institute report footer image.
   * Replaces the default footer.png banner on every page.
   */
  instituteFooterDataUrl?: string | null;

  /**
   * Which student detail fields to render in the cover block.
   * When omitted: all text fields shown, image hidden (backward compat).
   */
  studentFields?: StudentFieldOptions;

  /**
   * Internal cache for static banners (Attendance, Live, etc.) to avoid
   * re-converting them to DataURLs for every student in a batch.
   */
  assetCache?: Record<string, string | null>;

  /**
   * If true, the function will return the PDF as a Uint8Array instead of
   * triggering a browser download. Useful for batching into a ZIP file.
   */
  returnUint8Array?: boolean;
}

export interface ClassReportPayload {
  student: ClassReportStudent;
  instituteName: string;
  className: string;
  dateRange: { start: string; end: string };
  physicalAttendance: Array<{
    date: string; session: string; group: string;
    groupColor?: string; sessionStart?: string; sessionEnd?: string;
    checkIn?: string; status: string;
  }>;
  liveAttendance: Array<{
    title: string; date: string; subjectName?: string;
    totalDurationMinutes: number;
    sessions: Array<{ joinTime: string; leaveTime?: string; durationMinutes: number }>;
  }>;
  recordingAttendance: Array<{
    title: string; date: string; subjectName?: string;
    totalWatchedSeconds: number; sessionCount: number;
  }>;
  payments: Array<{
    title: string; amount: number;
    status: string; submissionStatus?: string | null;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(val?: string | null): string {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-GB', { timeZone: 'Asia/Colombo', day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return val; }
}

function fmtTime(val?: string | null): string {
  if (!val) return '—';
  try {
    // MySQL TIME columns return "HH:MM:SS" — must prefix a date to parse correctly
    const v = /^\d{2}:\d{2}(:\d{2})?$/.test(val) ? `2000-01-01T${val}` : val;
    return new Date(v).toLocaleTimeString('en-LK', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit' });
  } catch { return val; }
}

function fmtSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function statusColor(status: string): [number, number, number] {
  const s = (status ?? '').toLowerCase();
  if (s === 'present') return [16, 185, 129]; // Emerald 600
  if (s === 'absent') return [239, 68, 68];  // Red 500
  if (s === 'late') return [245, 158, 11];    // Amber 500
  if (s === 'left' || s === 'left_early' || s === 'left_lately') return [249, 115, 22]; // Orange 500
  return [107, 114, 128]; // Gray 500
}

/** Mixes a base color with white to create a subtle background tint (approx 12% opacity) */
function mixWithWhite(rgb: [number, number, number]): [number, number, number] {
  return rgb.map(c => Math.round(c + (255 - c) * 0.88)) as [number, number, number];
}

export async function urlToDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  // If already a data URL, return as is
  if (url.startsWith('data:')) return url;

  return new Promise((resolve) => {
    const img = new Image();
    // Cache busting helps bypass some CORS/cache issues where the image was cached without CORS headers
    const cacheBuster = url.includes('?') ? `&_t=${Date.now()}` : `?_t=${Date.now()}`;
    
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        console.warn('Canvas toDataURL failed (likely CORS):', url);
        resolve(null);
      }
    };
    img.onerror = () => {
      console.warn('Image load failed (check URL or CORS):', url);
      // Fallback: try without crossOrigin if it's just for display (though for PDF we NEED crossOrigin)
      resolve(null);
    };
    img.src = url + cacheBuster;
  });
}

export async function getImageDims(url: string): Promise<{ w: number; h: number } | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateStudentClassReport(
  payload: ClassReportPayload,
  options: ClassReportOptions,
  printOptions: PrintOptions = {},
): Promise<Uint8Array | void> {
  const {
    evenPages = false,
    bindingMarginMm = 0,
    topMarginMm = 0,
    pageNumberOffset = 0,
    headerPosition = 'top',
    instituteHeaderDataUrl = null,
    instituteFooterDataUrl = null,
    studentFields: rawStudentFields = null,
  } = printOptions;

  // Normalize student fields — defaults: show all text fields, image hidden (backward compat)
  const sf: StudentFieldOptions = rawStudentFields ?? {
    showImage: false,
    useFallbackGlobalImage: true,
    showNameWithInitials: true,
    showFullName: true,
    showDateOfBirth: true,
    showInstituteUserId: true,
    showSurakshaUserId: true,
    showAddress: true,
  };

  const PAGE_W = 210;
  const PAGE_H = 297;
  // Binding margin adds to the left side only
  const LEFT_MARGIN = 14 + Math.max(0, Math.min(30, bindingMarginMm));
  const RIGHT_MARGIN = 14;
  const CONTENT_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN;
  const BANNER_H = 18;

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

  type RGB = [number, number, number];
  const C = {
    white: [255, 255, 255] as RGB,
    cardBdr: [226, 232, 240] as RGB,
    rowAlt: [249, 250, 251] as RGB,
    hdrBlue: [30, 58, 138] as RGB,
    textDark: [15, 23, 42] as RGB,
    textMuted: [100, 116, 139] as RGB,
    emerald: [22, 163, 74] as RGB,
    rose: [220, 38, 38] as RGB,
    amber: [202, 138, 4] as RGB,
    sky: [14, 165, 233] as RGB,
    slate: [71, 85, 105] as RGB,
  };

  // Load all assets in parallel, including institute overrides if they are URLs
  // Use assetCache if available to avoid redundant conversions in batch mode
  const cache = printOptions.assetCache || {};

  const [logoData, attBanner, liveBanner, recBanner, payBanner, headerBanner, footerBanner, studentImgData] = await Promise.all([
    cache.logoData !== undefined ? Promise.resolve(cache.logoData) : urlToDataUrl(mainLogoUrl),
    cache.attBanner !== undefined ? Promise.resolve(cache.attBanner) : urlToDataUrl(attBannerUrl),
    cache.liveBanner !== undefined ? Promise.resolve(cache.liveBanner) : urlToDataUrl(liveBannerUrl),
    cache.recBanner !== undefined ? Promise.resolve(cache.recBanner) : urlToDataUrl(recBannerUrl),
    cache.payBanner !== undefined ? Promise.resolve(cache.payBanner) : urlToDataUrl(payBannerUrl),
    // Header: process through urlToDataUrl to handle CORS if it's a regular URL
    instituteHeaderDataUrl ? urlToDataUrl(instituteHeaderDataUrl) : Promise.resolve(null),
    // Footer: use institute override if provided, else default
    instituteFooterDataUrl ? urlToDataUrl(instituteFooterDataUrl) : urlToDataUrl(footerBannerUrl),
    // Student photo: load only when showImage enabled and URL available
    (() => {
      if (!sf.showImage) return Promise.resolve(null);
      const url = sf.useFallbackGlobalImage
        ? (payload.student.imageUrl || payload.student.globalImageUrl || null)
        : (payload.student.imageUrl || null);
      return url ? urlToDataUrl(url) : Promise.resolve(null);
    })(),
  ]);

  // Fetch banner dimensions for aspect-ratio scaling
  const [headerDims, footerDims] = await Promise.all([
    headerBanner ? getImageDims(headerBanner) : Promise.resolve(null),
    footerBanner ? getImageDims(footerBanner) : Promise.resolve(null),
  ]);

  // Populate cache if this is the first run in a batch
  if (printOptions.assetCache) {
    if (cache.logoData === undefined) cache.logoData = logoData;
    if (cache.attBanner === undefined) cache.attBanner = attBanner;
    if (cache.liveBanner === undefined) cache.liveBanner = liveBanner;
    if (cache.recBanner === undefined) cache.recBanner = recBanner;
    if (cache.payBanner === undefined) cache.payBanner = payBanner;
  }

  let y = topMarginMm;

  // ── Cover header ─────────────────────────────────────────────────────────────
  if (headerPosition === 'left') {
    const blockH = headerBanner ? 20 : 16;
    if (logoData) {
      doc.addImage(logoData, 'PNG', LEFT_MARGIN, y, 36, 12);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...C.hdrBlue);
    doc.text('Student Class Profile Report', LEFT_MARGIN + 40, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.textMuted);
    doc.text(payload.instituteName, LEFT_MARGIN + 40, y + 12);
    doc.text(`Class: ${payload.className}`, LEFT_MARGIN + 40, y + 16);
    y += blockH + 4;
  } else if (headerBanner) {
    const HEADER_W = PAGE_W;
    const HEADER_H = headerDims ? Math.min(45, Math.max(15, HEADER_W * (headerDims.h / headerDims.w))) : 28;
    doc.addImage(headerBanner, 'PNG', 0, y, HEADER_W, HEADER_H);
    if (logoData) doc.addImage(logoData, 'PNG', PAGE_W - RIGHT_MARGIN - 22, y + 2, 20, 7);
    y += HEADER_H + 5;
  } else {
    if (logoData) doc.addImage(logoData, 'PNG', LEFT_MARGIN, y, 40, 13);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(...C.hdrBlue);
    doc.text('Student Class Profile Report', LEFT_MARGIN, y + 20);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.textMuted);
    doc.text(payload.instituteName, LEFT_MARGIN, y + 25);
    doc.text(`Class: ${payload.className}`, LEFT_MARGIN, y + 30);
    y += 36;
  }

  doc.setDrawColor(219, 234, 254);
  doc.setLineWidth(0.4);
  doc.line(LEFT_MARGIN, y, PAGE_W - RIGHT_MARGIN, y);
  y += 5;

  // ── Student Info Card (Enhanced) ───────────────────────────────────────────
  const CARD_H = 46;
  const PHOTO_S = 34;
  const photoX = PAGE_W - RIGHT_MARGIN - PHOTO_S - 2;
  const photoY = y + 2;
  
  // Card background (subtle light blue tint)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(LEFT_MARGIN, y, CONTENT_W, CARD_H, 2, 2, 'FD');

  // Accent bar
  doc.setFillColor(30, 58, 138);
  doc.rect(LEFT_MARGIN, y, 4, CARD_H, 'F');

  // Render photo
  if (sf.showImage) {
    if (studentImgData) {
      doc.addImage(studentImgData, 'PNG', photoX, photoY, PHOTO_S, PHOTO_S);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.5);
      doc.rect(photoX, photoY, PHOTO_S, PHOTO_S, 'S');
    } else {
      doc.setFillColor(241, 245, 249);
      doc.rect(photoX, photoY, PHOTO_S, PHOTO_S, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(148, 163, 184);
      doc.text('PHOTO', photoX + PHOTO_S/2, photoY + PHOTO_S/2 + 2, { align: 'center' });
    }
  }

  // Name & Primary Info
  const infoX = LEFT_MARGIN + 10;
  const textW = CONTENT_W - PHOTO_S - 22;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  const primaryName = sf.showNameWithInitials ? (payload.student.name || payload.student.fullName || 'Student') : (payload.student.fullName || payload.student.name || 'Student');
  doc.text(primaryName, infoX, y + 10, { maxWidth: textW });
  if (sf.showFullName && payload.student.fullName && payload.student.fullName !== primaryName) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(payload.student.fullName, infoX, y + 15, { maxWidth: textW });
  }
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('STUDENT CLASS PROGRESS REPORT', infoX, y + 20);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(infoX, y + 23, infoX + textW, y + 23);

  // Dynamic Grid Info
  const details: string[] = [];
  if (sf.showInstituteUserId && payload.student.userIdByInstitute) details.push(`ID: ${payload.student.userIdByInstitute}`);
  if (sf.showSurakshaUserId && payload.student.surakshaUserId) details.push(`System ID: ${payload.student.surakshaUserId}`);
  if (payload.student.phoneNumber) details.push(`Phone: ${payload.student.phoneNumber}`);
  if (payload.student.email) details.push(`Email: ${payload.student.email}`);
  if (sf.showDateOfBirth && payload.student.dateOfBirth) details.push(`DOB: ${fmtDate(payload.student.dateOfBirth)}`);
  if (payload.student.gender) details.push(`Gender: ${payload.student.gender}`);
  if (sf.showAddress && payload.student.address) details.push(`Address: ${payload.student.address}`);

  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  const row1 = details.slice(0, 3);
  const row2 = details.slice(3, 6);
  const row3 = details.slice(6, 9);

  row1.forEach((t, i) => doc.text(t, infoX + (i * 42), y + 29));
  row2.forEach((t, i) => doc.text(t, infoX + (i * 42), y + 34));
  row3.forEach((t, i) => doc.text(t, infoX + (i * 42), y + 39));

  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Period: ${fmtDate(payload.dateRange.start)} - ${fmtDate(payload.dateRange.end)}   ·   Generated: ${new Date().toLocaleDateString('en-LK')}`, infoX, y + 44);

  y += CARD_H + 8;

  // ── Helper: add section banner ────────────────────────────────────────────────
  const addBanner = (bannerData: string | null, fallbackTitle: string, colorRgb: [number, number, number] = [30, 58, 138]) => {
    if (y > 245) { doc.addPage(); y = 14; }
    const BANNER_HEIGHT = 22;
    if (bannerData) {
      doc.addImage(bannerData, 'PNG', LEFT_MARGIN, y, CONTENT_W, BANNER_HEIGHT);
      y += BANNER_HEIGHT + 4;
    } else {
      // Fallback text banner — designer can replace with styled block
      doc.setFillColor(...colorRgb);
      doc.roundedRect(LEFT_MARGIN, y, CONTENT_W, 10, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(fallbackTitle, LEFT_MARGIN + 5, y + 6.5);
      y += 14;
    }
  };

  // ── Physical Attendance ───────────────────────────────────────────────────────
  if (options.physical) {
    addBanner(attBanner, 'Physical / General Attendance', [30, 58, 138]);

    if (payload.physicalAttendance.length === 0) {
      // Section enabled but no records in date range — show placeholder
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('No attendance records in the selected date range.', LEFT_MARGIN, y + 4);
      y += 12;
    } else {
      // Logic to exclude 'Left' status and handle different total count modes
      const validRecords = payload.physicalAttendance.filter(r => r.status.toLowerCase() !== 'left');
      const present = validRecords.filter(r => r.status.toLowerCase() === 'present').length;
      const late = validRecords.filter(r => r.status.toLowerCase() === 'late').length;
      
      let total = validRecords.length;
      if (options.physicalTotalMode === 'GROUP') {
        total = new Set(validRecords.map(r => r.group)).size;
      } else if (options.physicalTotalMode === 'SESSION') {
        total = new Set(validRecords.map(r => r.session)).size;
      } else if (options.physicalTotalMode === 'DAY') {
        total = new Set(validRecords.map(r => r.date)).size;
      } else if (options.physicalTotalMode === 'CUSTOM') {
        total = options.physicalTotalValue || total;
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Total Sessions: ${total}   Present: ${present}   Absent: ${validRecords.filter(r => r.status.toLowerCase() === 'absent').length}   Late: ${late}   Rate: ${total > 0 ? Math.round((present + late) / total * 100) : 0}%`,
        LEFT_MARGIN, y,
      );
      y += 5;

      autoTable(doc, {
        startY: y,
        margin: { left: LEFT_MARGIN, right: RIGHT_MARGIN },
        head: [['Date', 'Group', 'Session', 'Start', 'End', 'Check-in', 'Status']],
        body: payload.physicalAttendance.map(r => [
          fmtDate(r.date),
          r.group || '—',
          r.session || '—',
          r.sessionStart ? fmtTime(r.sessionStart) : '—',
          r.sessionEnd ? fmtTime(r.sessionEnd) : '—',
          r.checkIn ? fmtTime(r.checkIn) : '—',
          r.status.toUpperCase(),
        ]),
        styles: { fontSize: 8.5, cellPadding: 3.5, textColor: [30, 41, 59] },
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', fontSize: 8.5, cellPadding: 4 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        didDrawCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 6) {
            const status = payload.physicalAttendance[data.row.index]?.status ?? '';
            const rgb = statusColor(status);
            const lightRgb = mixWithWhite(rgb);
            const cell = data.cell;
            // ENHANCED: Subtle modern status badge (computed light bg + bold text)
            doc.setFillColor(...lightRgb);
            doc.roundedRect(cell.x + 1.2, cell.y + 0.8, cell.width - 2.4, cell.height - 1.6, 1, 1, 'F');
            doc.setTextColor(...rgb);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.text(status.toUpperCase(), cell.x + cell.width / 2, cell.y + cell.height / 2 + 0.5, { align: 'center' });
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // ── Live Lecture Attendance ───────────────────────────────────────────────────
  if (options.live) {
    if (y > 230) { doc.addPage(); y = 14; }
    addBanner(liveBanner, 'Live Lecture Attendance', [5, 150, 105]);

    if (payload.liveAttendance.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('No live lecture records in the selected date range.', LEFT_MARGIN, y + 4);
      y += 12;
    } else {
      const attended = payload.liveAttendance.filter(a => a.totalDurationMinutes > 0).length;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Lectures: ${payload.liveAttendance.length}   Attended: ${attended}   Absent: ${payload.liveAttendance.length - attended}`,
        LEFT_MARGIN, y,
      );
      y += 5;

      autoTable(doc, {
        startY: y,
        margin: { left: LEFT_MARGIN, right: RIGHT_MARGIN },
        head: [['Lecture Title', 'Subject', 'Date', 'Duration', 'Status']],
        body: payload.liveAttendance.map(a => [
          a.title,
          a.subjectName ?? '—',
          fmtDate(a.date),
          a.totalDurationMinutes > 0 ? `${a.totalDurationMinutes}m` : '—',
          a.totalDurationMinutes > 0 ? 'PRESENT' : 'ABSENT',
        ]),
        styles: { fontSize: 8.5, cellPadding: 3.5, textColor: [30, 41, 59] },
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', fontSize: 8.5, cellPadding: 4 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        didDrawCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 4) {
            const isPresent = payload.liveAttendance[data.row.index]?.totalDurationMinutes > 0;
            const rgb = isPresent ? [22, 163, 74] : [220, 38, 38] as [number, number, number];
            const lightRgb = mixWithWhite(rgb);
            const cell = data.cell;
            doc.setFillColor(...lightRgb);
            doc.roundedRect(cell.x + 1.2, cell.y + 0.8, cell.width - 2.4, cell.height - 1.6, 1, 1, 'F');
            doc.setTextColor(...rgb);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.text(isPresent ? 'PRESENT' : 'ABSENT', cell.x + cell.width / 2, cell.y + cell.height / 2 + 0.5, { align: 'center' });
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // ── Recording Attendance ──────────────────────────────────────────────────────
  if (options.recording) {
    if (y > 230) { doc.addPage(); y = 14; }
    addBanner(recBanner, 'Recording Attendance', [124, 58, 237]);

    if (payload.recordingAttendance.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('No recording activity records in the selected date range.', LEFT_MARGIN, y + 4);
      y += 12;
    } else {
      const watched = payload.recordingAttendance.filter(r => r.totalWatchedSeconds > 0).length;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Recordings: ${payload.recordingAttendance.length}   Watched: ${watched}   Not watched: ${payload.recordingAttendance.length - watched}`,
        LEFT_MARGIN, y,
      );
      y += 5;

      autoTable(doc, {
        startY: y,
        margin: { left: LEFT_MARGIN, right: RIGHT_MARGIN },
        head: [['Lecture Title', 'Subject', 'Date', 'Sessions', 'Time Watched', 'Status']],
        body: payload.recordingAttendance.map(r => [
          r.title,
          r.subjectName ?? '—',
          fmtDate(r.date),
          r.sessionCount > 0 ? String(r.sessionCount) : '—',
          r.totalWatchedSeconds > 0 ? fmtSeconds(r.totalWatchedSeconds) : '—',
          r.totalWatchedSeconds > 0 ? 'WATCHED' : 'NOT WATCHED',
        ]),
        styles: { fontSize: 8.5, cellPadding: 3.5, textColor: [30, 41, 59] },
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', fontSize: 8.5, cellPadding: 4 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        didDrawCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 5) {
            const isWatched = payload.recordingAttendance[data.row.index]?.totalWatchedSeconds > 0;
            const rgb = isWatched ? [124, 58, 237] : [107, 114, 128] as [number, number, number];
            const lightRgb = mixWithWhite(rgb);
            const cell = data.cell;
            doc.setFillColor(...lightRgb);
            doc.roundedRect(cell.x + 1.2, cell.y + 0.8, cell.width - 2.4, cell.height - 1.6, 1, 1, 'F');
            doc.setTextColor(...rgb);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.text(isWatched ? 'WATCHED' : 'NOT WATCHED', cell.x + cell.width / 2, cell.y + cell.height / 2 + 0.5, { align: 'center' });
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // ── Payments ──────────────────────────────────────────────────────────────────
  if (options.payments) {
    if (y > 230) { doc.addPage(); y = 14; }
    addBanner(payBanner, 'Payments', [217, 119, 6]);

    if (payload.payments.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('No payment records in the selected date range.', LEFT_MARGIN, y + 4);
      y += 12;
    } else {
      const paid = payload.payments.filter(
        p => p.submissionStatus === 'VERIFIED' || p.submissionStatus === 'HALF_VERIFIED' || p.submissionStatus === 'QUARTER_VERIFIED',
      ).length;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Total: ${payload.payments.length}   Verified/paid: ${paid}`, LEFT_MARGIN, y);
      y += 5;

      autoTable(doc, {
        startY: y,
        margin: { left: LEFT_MARGIN, right: RIGHT_MARGIN },
        head: [['Payment Title', 'Amount (Rs)', 'Submission Status']],
        body: payload.payments.map(p => [
          p.title,
          Number(p.amount).toLocaleString(),
          p.submissionStatus ?? 'NOT PAID',
        ]),
        styles: { fontSize: 8.5, cellPadding: 3.5, textColor: [30, 41, 59] },
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', fontSize: 8.5, cellPadding: 4 },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        didDrawCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 2) {
            const sub = payload.payments[data.row.index]?.submissionStatus;
            const cell = data.cell;
            let rgb: [number, number, number] = [107, 114, 128]; // gray = not paid
            if (sub === 'VERIFIED') rgb = [22, 163, 74];
            else if (sub === 'HALF_VERIFIED') rgb = [22, 163, 74];
            else if (sub === 'QUARTER_VERIFIED') rgb = [22, 163, 74];
            else if (sub === 'PENDING') rgb = [202, 138, 4];
            else if (sub === 'REJECTED') rgb = [220, 38, 38];
            
            const lightRgb = mixWithWhite(rgb);
            doc.setFillColor(...lightRgb);
            doc.roundedRect(cell.x + 1.2, cell.y + 0.8, cell.width - 2.4, cell.height - 1.6, 1, 1, 'F');
            doc.setTextColor(...rgb);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.text((sub ?? 'NOT PAID').replace(/_/g, ' '), cell.x + cell.width / 2, cell.y + cell.height / 2 + 0.5, { align: 'center' });
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // ── Even-pages padding ────────────────────────────────────────────────────────
  // When evenPages=true: if the total page count is odd, add a blank page so that
  // the next student's PDF starts on the correct side for duplex/booklet printing.
  if (evenPages) {
    const pagesBeforeBlank = (doc as any).internal.getNumberOfPages();
    if (pagesBeforeBlank % 2 !== 0) {
      doc.addPage();
      // Blank page marker — designer can add "This page intentionally left blank"
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(200, 200, 200);
      doc.text('[ intentionally blank ]', PAGE_W / 2, PAGE_H / 2, { align: 'center' });
    }
  }

  // ── Footer on every page ──────────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const displayPage = i + pageNumberOffset;
    if (footerBanner) {
      const FOOTER_W = PAGE_W;
      const FOOTER_H = footerDims ? Math.min(30, Math.max(8, FOOTER_W * (footerDims.h / footerDims.w))) : 11;
      doc.addImage(footerBanner, 'PNG', 0, PAGE_H - FOOTER_H, FOOTER_W, FOOTER_H);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${displayPage}`, PAGE_W - RIGHT_MARGIN, PAGE_H - 5, { align: 'right' });
    doc.text('Suraksha LMS — Confidential', LEFT_MARGIN, PAGE_H - 5);
  }

  if (printOptions.returnUint8Array) {
    return doc.output('uint8array');
  }

  const safe = (payload.student.name ?? 'student').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`${safe}_class_report_${payload.dateRange.start}_to_${payload.dateRange.end}.pdf`);
}
