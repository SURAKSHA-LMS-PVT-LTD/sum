/**
 * lectureTracking.api.ts
 *
 * Client for the /lecture-tracking/* endpoints.
 * Public endpoints (join, leave, heartbeat, access) work without authentication
 * — the backend uses OptionalJwtAuthGuard for those.
 * Admin report endpoints (grid, reports) require a valid JWT.
 */

import { getBaseUrl, getApiHeadersAsync, getCredentialsMode } from '@/contexts/utils/auth.api';

// ─── Response types ────────────────────────────────────────────────────────

export interface LiveAccessInfo {
  lectureId: string;
  title: string;
  description?: string;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  startTime?: string;
  endTime?: string;
  instituteId: string;
  instituteName?: string;
  instituteLogoUrl?: string;
  subdomain?: string;
  customDomain?: string;
  accessLevel: 'ANYONE' | 'SURAKSHA_USERS' | 'ENROLLED_ONLY' | 'PAID_ONLY';
  bgUrl?: string;
  cardImageUrl?: string;
  liveJoinUrl?: string;
  hasAccess: boolean;
  requirePayment: boolean;
  notPaidPaymentId?: string;
  paymentId?: string;
  paymentStatuses?: string[];
  welcomeMessageEnabled?: boolean;
  welcomeMessageText?: string;
  welcomeMessageVoiceEnabled?: boolean;
  /** Only present when hasAccess === true */
  meetingLink?: string;
}

export interface RecordingAccessInfo {
  lectureId: string;
  title: string;
  description?: string;
  instituteId: string;
  instituteName?: string;
  instituteLogoUrl?: string;
  subdomain?: string;
  customDomain?: string;
  accessLevel: 'ANYONE' | 'SURAKSHA_USERS' | 'ENROLLED_ONLY' | 'PAID_ONLY';
  platform: 'SYSTEM' | 'YOUTUBE' | 'GOOGLE_DRIVE';
  durationSeconds?: number;
  bgUrl?: string;
  cardImageUrl?: string;
  hasAccess: boolean;
  requirePayment: boolean;
  notPaidPaymentId?: string;
  paymentId?: string;
  paymentStatuses?: string[];
  welcomeMessageEnabled?: boolean;
  welcomeMessageText?: string;
  welcomeMessageVoiceEnabled?: boolean;
  materials?: Array<{
    documentName: string;
    documentUrl: string;
    driveFileId?: string;
    driveWebViewLink?: string;
    source?: string;
  }>;
  /** Only present when hasAccess === true */
  recordingUrl?: string;
}

export interface LiveJoinResult {
  attendanceId: string;
  lectureId: string;
  joinTime: string;
}

export interface RecordingSessionResult {
  sessionId: string;
  lectureId: string;
}

export interface HeartbeatActivity {
  type: 'PLAY' | 'PAUSE' | 'SEEK' | 'HEARTBEAT';
  videoTimestamp: number;
  wallTime?: number;
}

export interface AttendanceSession {
  joinTime?: string;
  leaveTime?: string;
  durationMinutes?: number;
  ipAddress?: string;
}

export interface AttendanceGridCell {
  attended: boolean;
  joinTime?: string;
  leaveTime?: string;
  durationMinutes?: number;
  joinCount?: number;
  sessions?: AttendanceSession[];
}

export interface AttendanceGridResult {
  lectures: Array<{
    id: string;
    title: string;
    startTime?: string;
    subjectId?: string | null;
    status: string;
  }>;
  students: Array<{
    id: string;
    name: string;
    imageUrl?: string | null;
  }>;
  grid: Record<string, Record<string, AttendanceGridCell>>;
}

export interface LiveAttendanceRow {
  id: string;
  userId?: string;
  name: string;
  isGuest: boolean;
  guestEmail?: string;
  guestPhone?: string;
  joinTime?: string;
  leaveTime?: string;
  durationMinutes?: number | null;
  ipAddress?: string;
}

export interface RecordingSessionRow {
  sessionId: string;
  userId?: string;
  name: string;
  isGuest: boolean;
  startTime: string;
  endTime?: string;
  totalWatchedSeconds: number;
  lastPositionSeconds: number;
  activities: Array<{ type: string; videoTimestamp: number; at: string }>;
}

// ─── API helpers ───────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  withAuth = false,
  forceRefresh = false
): Promise<T> {
  const base = (getBaseUrl() ?? '').replace(/\/$/, '');
  const url = `${base}${path}`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (withAuth) {
    const authHeaders = await getApiHeadersAsync();
    Object.assign(headers, authHeaders);
  }

  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string> ?? {}) },
    credentials: getCredentialsMode(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ─── Public API ────────────────────────────────────────────────────────────

class LectureTrackingApi {
  // ── Access validation ───────────────────────────────────────────────────

  validateLiveAccess(urlId: string): Promise<LiveAccessInfo> {
    return request<LiveAccessInfo>(`/lecture-tracking/live/access/${urlId}`);
  }

  validateRecordingAccess(urlId: string): Promise<RecordingAccessInfo> {
    return request<RecordingAccessInfo>(`/lecture-tracking/recording/access/${urlId}`);
  }

  // ── Live session lifecycle ──────────────────────────────────────────────

  joinLive(payload: {
    lectureId: string;
    guestName?: string;
    guestEmail?: string;
    guestPhone?: string;
  }): Promise<LiveJoinResult> {
    return request<LiveJoinResult>('/lecture-tracking/live/join', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  leaveLive(attendanceId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/lecture-tracking/live/leave', {
      method: 'POST',
      body: JSON.stringify({ attendanceId }),
    });
  }

  // ── Recording session lifecycle ─────────────────────────────────────────

  startRecordingSession(payload: {
    lectureId: string;
    guestName?: string;
    guestEmail?: string;
    guestPhone?: string;
  }): Promise<RecordingSessionResult> {
    return request<RecordingSessionResult>('/lecture-tracking/recording/session/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  endRecordingSession(sessionId: string, lastPositionSeconds?: number): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/lecture-tracking/recording/session/end', {
      method: 'POST',
      body: JSON.stringify({ sessionId, lastPositionSeconds }),
    });
  }

  sendHeartbeats(sessionId: string, activities: HeartbeatActivity[]): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/lecture-tracking/recording/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ sessionId, activities }),
    });
  }

  // ── Admin reports (require auth) ────────────────────────────────────────

  getAttendanceGrid(params: {
    lectureIds: string[];
    classId: string;
    instituteId: string;
    includeSubjectLectures?: boolean;
  }, forceRefresh = false): Promise<AttendanceGridResult> {
    // ✅ Validate inputs — return empty grid instead of firing a bad request
    const validIds = (params.lectureIds ?? [])
      .map(id => String(id).trim())
      .filter(id => id && id !== 'undefined' && id !== 'null');

    if (validIds.length === 0 || !params.classId || !params.instituteId) {
      return Promise.resolve({ lectures: [], students: [], grid: {} });
    }

    const qs = new URLSearchParams({
      lectureIds: validIds.join(','),
      classId: params.classId,
      instituteId: params.instituteId,
      ...(params.includeSubjectLectures ? { includeSubjectLectures: 'true' } : {}),
    });
    return request<AttendanceGridResult>(
      `/lecture-tracking/attendance-grid?${qs}`,
      {},
      true,
      forceRefresh
    );
  }

  getLiveAttendanceReport(lectureId: string): Promise<LiveAttendanceRow[]> {
    return request<LiveAttendanceRow[]>(
      `/lecture-tracking/reports/${lectureId}/live`,
      {},
      true,
    );
  }

  getRecordingActivityReport(lectureId: string): Promise<RecordingSessionRow[]> {
    return request<RecordingSessionRow[]>(
      `/lecture-tracking/reports/${lectureId}/recording`,
      {},
      true,
    );
  }
}

export const lectureTrackingApi = new LectureTrackingApi();
