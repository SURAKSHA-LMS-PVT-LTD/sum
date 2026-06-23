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
  /** Present when the lecture has a tracked recording */
  recUrlId?: string;
  recAttendanceEnabled?: boolean;
}

export interface RecordingAccessInfo {
  lectureId: string;
  recordingId?: string; // subject recordings use recordingId instead of lectureId
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
  lectureId?: string;
  recordingId?: string;
  userType?: string;
  lastPosition?: number;
  totalWatchedSeconds?: number;
  timesViewed?: number;
  watchedRanges?: Array<{ from: number; to: number; speed: number }>;
}

export interface HeartbeatActivity {
  type: 'PLAY' | 'PAUSE' | 'SEEK' | 'HEARTBEAT' | 'WATCH_RANGE' | 'TAB_HIDDEN' | 'TAB_VISIBLE' | 'SPEED_CHANGE';
  videoTimestamp: number;
  wallTime?: number;
  /** For WATCH_RANGE: start and end video positions in seconds */
  rangeFrom?: number;
  rangeTo?: number;
  /** For WATCH_RANGE: actual wall-clock seconds the range lasted */
  watchedSeconds?: number;
  /** Current playback speed when the activity was recorded */
  speed?: number;
  /** Screen dimensions at time of activity */
  screenWidth?: number;
  screenHeight?: number;
  /** Browser tab/window dimensions at time of activity */
  tabWidth?: number;
  tabHeight?: number;
  /** Whether the browser tab was visible when this was recorded */
  tabVisible?: boolean;
}

export interface AttendanceVisit {
  joinTime?: string;
  leaveTime?: string;
  durationMinutes?: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface AttendanceGridCell {
  attended: boolean;
  loginCount?: number;
  joinTime?: string;
  leaveTime?: string;
  durationMinutes?: number;
  visits?: AttendanceVisit[];
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
  loginCount?: number;
  joinTime?: string;
  leaveTime?: string;
  durationMinutes?: number | null;
  ipAddress?: string;
  visits?: AttendanceVisit[];
}

export interface RecordingActivityRow {
  type: string;
  videoTimestamp: number;
  wallTime: number | null;
  at: string;
  speed: number | null;
  rangeFrom: number | null;
  rangeTo: number | null;
  watchedSeconds: number | null;
  tabWidth: number | null;
  tabHeight: number | null;
  screenWidth: number | null;
  screenHeight: number | null;
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
  activities: RecordingActivityRow[];
}

// ─── API helpers ───────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  withAuth = false,
): Promise<T> {
  const base = (getBaseUrl() ?? '').replace(/\/$/, '');
  const url = `${base}${path}`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (withAuth) {
    const authHeaders = await getApiHeadersAsync();
    Object.assign(headers, authHeaders);
  } else {
    // Still send the token if available (OptionalJwtAuthGuard on backend)
    try {
      const authHeaders = await getApiHeadersAsync();
      if (authHeaders['Authorization']) {
        headers['Authorization'] = authHeaders['Authorization'];
      }
    } catch {
      // No token — fine, backend allows unauthenticated
    }
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

  validateSubjectRecordingAccess(urlId: string): Promise<RecordingAccessInfo> {
    return request<RecordingAccessInfo>(`/subject-recording-tracking/recording/access/${urlId}`);
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

  startSubjectRecordingSession(payload: {
    recordingId: string;
    guestName?: string;
    guestEmail?: string;
    guestPhone?: string;
    guestSchool?: string;
  }): Promise<RecordingSessionResult> {
    return request<RecordingSessionResult>('/subject-recording-tracking/session/start', {
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

  endSubjectRecordingSession(sessionId: string, lastPositionSeconds?: number): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/subject-recording-tracking/session/end', {
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

  sendSubjectRecordingHeartbeats(sessionId: string, activities: HeartbeatActivity[]): Promise<{ success: boolean }> {
    return request<{ success: boolean }>('/subject-recording-tracking/heartbeat', {
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
  }): Promise<AttendanceGridResult> {
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

  getStudentRecordingSessions(lectureId: string, studentId: string): Promise<RecordingSessionRow[]> {
    return request<RecordingSessionRow[]>(
      `/lecture-tracking/reports/${lectureId}/recording?studentId=${encodeURIComponent(studentId)}`,
      {},
      true,
    );
  }
}

export const lectureTrackingApi = new LectureTrackingApi();
