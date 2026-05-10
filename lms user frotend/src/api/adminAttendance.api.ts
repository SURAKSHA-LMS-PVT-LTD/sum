import { attendanceApiClient } from './attendanceClient';
import type { CachedRequestOptions } from './attendanceClient';
import type {
  AttendanceStatus,
  AttendanceUserType as AttUserType,
  AttendanceQueryResponse,
  CardUserResponse,
  BulkAttendancePayload,
  BulkCardAttendancePayload,
  BulkAttendanceResponse,
  MarkAttendancePayload,
  MarkAttendanceResponse,
  MarkByCardPayload,
  MarkByCardResponse as MarkCardResp,
  MarkByInstituteCardPayload,
  MarkByInstituteCardResponse,
  AttendanceSummary,
} from '@/types/attendance.types';
import { normalizeAttendanceSummary } from '@/types/attendance.types';

// Re-export for backward compatibility
export type AdminAttendanceRecord = import('@/types/attendance.types').AttendanceRecord;
export type AdminAttendanceResponse = AttendanceQueryResponse;
export type AdminUserType = AttUserType;

export { type CardUserResponse } from '@/types/attendance.types';

// ── Result types ──────────────────────────────────────────────

export interface DailySummaryResult {
  date: string;
  summary: AttendanceSummary;
  records: AdminAttendanceRecord[];
}

export interface MultiWindowResult {
  records: AdminAttendanceRecord[];
  summary: AttendanceSummary;
}

export interface DailyAttendanceDayCount {
  date: string;
  day: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leftCount: number;
  leftEarlyCount: number;
  leftLatelyCount: number;
  totalRecords: number;
}

export interface DailyAttendanceCount {
  success: boolean;
  message: string;
  instituteId: string;
  classId?: string;
  subjectId?: string;
  year: number;
  month: number;
  days: DailyAttendanceDayCount[];
}

export interface MonthlyAttendanceCount {
  success: boolean;
  message: string;
  instituteId: string;
  classId?: string;
  subjectId?: string;
  year: number;
  month: number;
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leftCount: number;
  leftEarlyCount: number;
  leftLatelyCount: number;
  attendanceRate: number;
}

// ── Helpers ────────────────────────────────────────────────────

/** Fetch attendance in ≤5-day windows (backend constraint for institute/class/subject queries) */
export async function fetchMultiWindow(
  endpoint: string,
  startDate: string,
  endDate: string,
  extraParams: Record<string, any> = {},
  options?: CachedRequestOptions
): Promise<AdminAttendanceRecord[]> {
  const result = await fetchMultiWindowWithSummary(endpoint, startDate, endDate, extraParams, options);
  return result.records;
}

/** Like fetchMultiWindow but also returns accumulated summary data */
export async function fetchMultiWindowWithSummary(
  endpoint: string,
  startDate: string,
  endDate: string,
  extraParams: Record<string, any> = {},
  options?: CachedRequestOptions
): Promise<MultiWindowResult> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const allRecords: AdminAttendanceRecord[] = [];
  const accSummary: AttendanceSummary = {
    totalPresent: 0, totalAbsent: 0, totalLate: 0,
    totalLeft: 0, totalLeftEarly: 0, totalLeftLately: 0,
    attendanceRate: 0,
  };
  let windowCount = 0;
  let windowStart = new Date(start);

  while (windowStart <= end) {
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + 4); // 5-day window
    if (windowEnd > end) windowEnd.setTime(end.getTime());

    const fmt = (d: Date) => d.toISOString().split('T')[0];
    try {
      const res = await attendanceApiClient.get<AdminAttendanceResponse>(endpoint, {
        startDate: fmt(windowStart),
        endDate: fmt(windowEnd),
        limit: 100,
        page: 1,
        ...extraParams,
      }, options);
      if (res?.data) allRecords.push(...res.data);
      if (res?.summary) {
        const s = normalizeAttendanceSummary(res.summary);
        accSummary.totalPresent += s.totalPresent;
        accSummary.totalAbsent += s.totalAbsent;
        accSummary.totalLate += s.totalLate;
        accSummary.totalLeft += s.totalLeft;
        accSummary.totalLeftEarly += s.totalLeftEarly;
        accSummary.totalLeftLately += s.totalLeftLately;
        accSummary.attendanceRate += s.attendanceRate;
        windowCount++;
      }
    } catch (e) {
      console.warn('Window fetch failed:', fmt(windowStart), '-', fmt(windowEnd), e);
    }

    windowStart.setDate(windowStart.getDate() + 5);
  }

  // Average the rate across windows
  if (windowCount > 0) {
    accSummary.attendanceRate = Math.round((accSummary.attendanceRate / windowCount) * 10) / 10;
  }

  return { records: allRecords, summary: accSummary };
}

/** Fetch per-day summaries for a date range (parallel per-day API calls) */
export async function fetchDailySummaries(
  endpoint: string,
  startDate: string,
  endDate: string,
  extraParams: Record<string, any> = {},
  options?: CachedRequestOptions
): Promise<DailySummaryResult[]> {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dates: string[] = [];
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  const results = await Promise.allSettled(
    dates.map(dateStr =>
      attendanceApiClient.get<AdminAttendanceResponse>(endpoint, {
        startDate: dateStr,
        endDate: dateStr,
        limit: 100,
        page: 1,
        ...extraParams,
      }, options)
    )
  );

  return dates.map((date, i) => {
    const res = results[i].status === 'fulfilled' ? results[i].value : null;
    return {
      date,
      summary: normalizeAttendanceSummary(res?.summary),
      records: res?.data || [],
    };
  });
}

// ── API ────────────────────────────────────────────────────────

const adminAttendanceApi = {

  // ══════════════════════════════════════════════════════════════
  // MARK APIs (Section 2)
  // ══════════════════════════════════════════════════════════════

  /** 2.1 — Mark single attendance */
  markAttendance(payload: MarkAttendancePayload) {
    return attendanceApiClient.post<MarkAttendanceResponse>(
      `/api/attendance/mark`,
      payload
    );
  },

  /** 2.2 — Mark bulk attendance (max 100) */
  markBulkAttendance(payload: BulkAttendancePayload) {
    return attendanceApiClient.post<BulkAttendanceResponse>(
      `/api/attendance/mark-bulk`,
      payload
    );
  },

  /** 2.3 — Mark by RFID card */
  markByCard(payload: MarkByCardPayload) {
    return attendanceApiClient.post<MarkCardResp>(
      `/api/attendance/mark-by-card`,
      payload
    );
  },

  /** 2.4 — Mark bulk by RFID cards (max 100) */
  markBulkByCard(payload: BulkCardAttendancePayload) {
    return attendanceApiClient.post<BulkAttendanceResponse>(
      `/api/attendance/mark-bulk-by-card`,
      payload
    );
  },

  /** 2.5 — Mark by institute card */
  markByInstituteCard(payload: MarkByInstituteCardPayload) {
    return attendanceApiClient.post<MarkByInstituteCardResponse>(
      `/api/attendance/mark-by-institute-card`,
      payload
    );
  },

  // ══════════════════════════════════════════════════════════════
  // QUERY APIs (Section 3)
  // ══════════════════════════════════════════════════════════════

  /** 3.1 — Get student attendance */
  getStudentAttendance(
    studentId: string,
    params: { instituteId: string; startDate: string; endDate: string; page?: number; limit?: number; status?: AttendanceStatus },
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<AttendanceQueryResponse>(
      `/api/attendance/student/${studentId}`,
      params,
      options
    );
  },

  /** 3.2 — Get student attendance by card ID */
  getAttendanceByCardId(
    cardId: string,
    params?: { startDate?: string; endDate?: string; page?: number; limit?: number },
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<AttendanceQueryResponse>(
      `/api/attendance/by-cardId/${cardId}`,
      params,
      options
    );
  },

  /** 3.3 — Get institute attendance (max 5-day range, or 30 with studentId) */
  getInstituteAttendance(
    instituteId: string,
    params: { startDate: string; endDate: string; page?: number; limit?: number; status?: AttendanceStatus; studentId?: string },
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<AttendanceQueryResponse>(
      `/api/attendance/institute/${instituteId}`,
      params,
      options
    );
  },

  /** Multi-window institute attendance for ranges > 5 days */
  getInstituteAttendanceRange(
    instituteId: string,
    startDate: string,
    endDate: string,
    options?: CachedRequestOptions
  ) {
    return fetchMultiWindow(`/api/attendance/institute/${instituteId}`, startDate, endDate, {}, options);
  },

  /** Multi-window institute attendance with accumulated summary */
  getInstituteAttendanceRangeWithSummary(
    instituteId: string,
    startDate: string,
    endDate: string,
    options?: CachedRequestOptions
  ) {
    return fetchMultiWindowWithSummary(`/api/attendance/institute/${instituteId}`, startDate, endDate, {}, options);
  },

  /** Get per-day summaries for a date range */
  getInstituteDailySummaries(
    instituteId: string,
    startDate: string,
    endDate: string,
    options?: CachedRequestOptions
  ): Promise<DailySummaryResult[]> {
    return fetchDailySummaries(`/api/attendance/institute/${instituteId}`, startDate, endDate, {}, options);
  },

  /** 3.4 — Get class attendance */
  getClassAttendance(
    instituteId: string,
    classId: string,
    params: { startDate: string; endDate: string; page?: number; limit?: number; status?: AttendanceStatus; studentId?: string },
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<AttendanceQueryResponse>(
      `/api/attendance/institute/${instituteId}/class/${classId}`,
      params,
      options
    );
  },

  /** 3.5 — Get subject attendance */
  getSubjectAttendance(
    instituteId: string,
    classId: string,
    subjectId: string,
    params: { startDate: string; endDate: string; page?: number; limit?: number; status?: AttendanceStatus; studentId?: string },
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<AttendanceQueryResponse>(
      `/api/attendance/institute/${instituteId}/class/${classId}/subject/${subjectId}`,
      params,
      options
    );
  },

  /** 3.6 — Get class student attendance (max 365 days) */
  getClassStudentAttendance(
    instituteId: string,
    classId: string,
    studentId: string,
    params: { startDate: string; endDate: string; page?: number; limit?: number; status?: AttendanceStatus },
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<AttendanceQueryResponse>(
      `/api/attendance/institute/${instituteId}/class/${classId}/student/${studentId}`,
      params,
      options
    );
  },

  /** 3.7 — Get subject student attendance (max 365 days) */
  getSubjectStudentAttendance(
    instituteId: string,
    classId: string,
    subjectId: string,
    studentId: string,
    params: { startDate: string; endDate: string; page?: number; limit?: number; status?: AttendanceStatus },
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<AttendanceQueryResponse>(
      `/api/attendance/institute/${instituteId}/class/${classId}/subject/${subjectId}/student/${studentId}`,
      params,
      options
    );
  },

  // ══════════════════════════════════════════════════════════════
  // CARD USER LOOKUP (Section 4)
  // ══════════════════════════════════════════════════════════════

  /** 4.1 — Get institute user by card ID */
  getCardUser(
    instituteCardId: string,
    instituteId: string,
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<CardUserResponse>(
      `/api/attendance/institute-card-user`,
      { instituteCardId, instituteId },
      options
    );
  },

  /** 4.2 — Class-scoped card user lookup */
  getClassCardUser(
    instituteId: string,
    classId: string,
    instituteCardId: string,
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<CardUserResponse>(
      `/api/attendance/institute/${instituteId}/class/${classId}/card-user`,
      { instituteCardId },
      options
    );
  },

  /** 4.3 — Subject-scoped card user lookup */
  getSubjectCardUser(
    instituteId: string,
    classId: string,
    subjectId: string,
    instituteCardId: string,
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<CardUserResponse>(
      `/api/attendance/institute/${instituteId}/class/${classId}/subject/${subjectId}/card-user`,
      { instituteCardId },
      options
    );
  },

  // ══════════════════════════════════════════════════════════════
  // CALENDAR-LINKED QUERIES (Section 5)
  // ══════════════════════════════════════════════════════════════

  /** 5.1 — Get attendance by event */
  getEventAttendance(
    instituteId: string,
    eventId: string,
    params?: { date?: string; classId?: string; subjectId?: string; page?: number; limit?: number },
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<AttendanceQueryResponse>(
      `/api/attendance/calendar/institute/${instituteId}/event/${eventId}`,
      params,
      options
    );
  },

  /** 5.2 — Get attendance by calendar day */
  getCalendarDayAttendance(
    instituteId: string,
    calendarDayId: string,
    params?: { userType?: string; classId?: string; subjectId?: string; page?: number; limit?: number },
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<AttendanceQueryResponse>(
      `/api/attendance/calendar/institute/${instituteId}/calendar-day/${calendarDayId}`,
      params,
      options
    );
  },

  /** 5.3 — Get attendance by user type (institute scope) */
  getAttendanceByUserType(
    instituteId: string,
    userType: AttUserType,
    params?: { date?: string; eventId?: string; page?: number; limit?: number },
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<AttendanceQueryResponse>(
      `/api/attendance/calendar/institute/${instituteId}/user-type/${userType}`,
      params,
      options
    );
  },

  /** 5.4 — Get attendance by user type (class scope) */
  getClassAttendanceByUserType(
    instituteId: string,
    classId: string,
    userType: AttUserType,
    params?: { date?: string; eventId?: string; page?: number; limit?: number },
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<AttendanceQueryResponse>(
      `/api/attendance/calendar/institute/${instituteId}/class/${classId}/user-type/${userType}`,
      params,
      options
    );
  },

  /** 5.5 — Get attendance by user type (subject scope) */
  getSubjectAttendanceByUserType(
    instituteId: string,
    classId: string,
    subjectId: string,
    userType: AttUserType,
    params?: { date?: string; eventId?: string; page?: number; limit?: number },
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<AttendanceQueryResponse>(
      `/api/attendance/calendar/institute/${instituteId}/class/${classId}/subject/${subjectId}/user-type/${userType}`,
      params,
      options
    );
  },

  /** 5.6 — Get student attendance at event */
  getStudentEventAttendance(
    instituteId: string,
    studentId: string,
    eventId: string,
    params?: { startDate?: string; endDate?: string; classId?: string; subjectId?: string },
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<AttendanceQueryResponse>(
      `/api/attendance/calendar/institute/${instituteId}/student/${studentId}/event/${eventId}`,
      params,
      options
    );
  },

  // ── Daily Attendance Count (day-by-day per month) ────────────

  /** Get day-by-day attendance count for entire institute */
  getInstituteDailyCount(
    instituteId: string,
    params: { year: number; month: number },
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<DailyAttendanceCount>(
      `/api/attendance/institute/${instituteId}/daily-count`,
      params,
      options
    );
  },

  /** Get day-by-day attendance count for a class */
  getClassDailyCount(
    instituteId: string,
    classId: string,
    params: { year: number; month: number },
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<DailyAttendanceCount>(
      `/api/attendance/institute/${instituteId}/class/${classId}/daily-count`,
      params,
      options
    );
  },

  /** Get day-by-day attendance count for a class + subject */
  getSubjectDailyCount(
    instituteId: string,
    classId: string,
    subjectId: string,
    params: { year: number; month: number },
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<DailyAttendanceCount>(
      `/api/attendance/institute/${instituteId}/class/${classId}/subject/${subjectId}/daily-count`,
      params,
      options
    );
  },

  // ── Monthly Attendance Count ─────────────────────────────────

  /** Get monthly attendance count for entire institute */
  getInstituteMonthlyCount(
    instituteId: string,
    params: { year: number; month: number },
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<MonthlyAttendanceCount>(
      `/api/attendance/institute/${instituteId}/monthly-count`,
      params,
      options
    );
  },

  /** Get monthly attendance count for a class */
  getClassMonthlyCount(
    instituteId: string,
    classId: string,
    params: { year: number; month: number },
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<MonthlyAttendanceCount>(
      `/api/attendance/institute/${instituteId}/class/${classId}/monthly-count`,
      params,
      options
    );
  },

  /** Get monthly attendance count for a class + subject */
  getSubjectMonthlyCount(
    instituteId: string,
    classId: string,
    subjectId: string,
    params: { year: number; month: number },
    options?: CachedRequestOptions
  ) {
    return attendanceApiClient.get<MonthlyAttendanceCount>(
      `/api/attendance/institute/${instituteId}/class/${classId}/subject/${subjectId}/monthly-count`,
      params,
      options
    );
  },
};

export default adminAttendanceApi;
