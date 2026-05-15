import { attendanceApiClient } from './attendanceClient';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type CloseUnmarkAction = 'KEEP_NOT_MARKED' | 'MARK_ABSENT';

export interface SessionGroup {
  id: string;
  name: string;
  color?: string;
  displayOrder: number;
  isActive: boolean;
}

export interface Session {
  id: string;
  name: string;
  date: string;
  startTime: string;
  endTime?: string;
  lateAfterMinutes?: number;
  leftEarlyBeforeMinutes?: number;
  isClosed: boolean;
  closedAt?: string;
  closeUnmarkAction: CloseUnmarkAction;
  totalStudents: number;
  sessionGroupId?: string;
  group?: SessionGroup;
  sendNotifications: boolean;
  linkedPaymentId?: string;
  paymentMode?: 'OPTIONAL' | 'REQUIRED';
  createdAt: string;
}

export interface SessionStudentRecord {
  studentId: string;
  studentName: string;
  nameWithInitials?: string | null;
  imageUrl: string | null;
  userIdInstitute: string | null;
  cardId: string | null;
  statusCode: number | null;
  statusLabel: string;
  markedAt: string | null;
  remarks: string | null;
  isFromOtherSource: boolean;
  paymentStatus?: 'PAID' | 'PENDING' | 'UNPAID' | null;
}

export interface SessionDetail extends Session {
  students: SessionStudentRecord[];
  presentCount: number;
  absentCount: number;
  lateCount: number;
  notMarkedCount: number;
}

export interface GridStudentRow {
  studentId: string;
  studentName: string;
  nameWithInitials?: string | null;
  imageUrl: string | null;
  userIdInstitute: string | null;
  cardId: string | null;
  sessions: Record<string, {
    statusCode: number | null;
    statusLabel: string;
    markedAt: string | null;
  }>;
}

export interface SessionGridResponse {
  sessions: Session[];
  students: GridStudentRow[];
}

// ─────────────────────────────────────────────────────────────────
// Request payloads
// ─────────────────────────────────────────────────────────────────

export interface CreateSessionGroupPayload {
  name: string;
  color?: string;
  displayOrder?: number;
}

export interface UpdateSessionGroupPayload {
  name?: string;
  color?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface UpdateSessionPayload {
  name?: string;
  startTime?: string;
  endTime?: string;
  lateAfterMinutes?: number;
  leftEarlyBeforeMinutes?: number;
  sessionGroupId?: string | null;
  linkedPaymentId?: string | null;
  paymentMode?: 'OPTIONAL' | 'REQUIRED' | null;
  sendNotifications?: boolean;
}

export interface CreateSessionPayload {
  name: string;
  date?: string;
  startTime: string;
  endTime?: string;
  lateAfterMinutes?: number;
  leftEarlyBeforeMinutes?: number;
  sessionGroupId?: string;
  sendNotifications?: boolean;
  linkedPaymentId?: string;
  paymentMode?: 'OPTIONAL' | 'REQUIRED';
}

export interface MarkAttendancePayload {
  studentId: string;
  status?: number;
  remarks?: string;
}

export interface BulkMarkAttendancePayload {
  records: MarkAttendancePayload[];
}

export interface CloseSessionPayload {
  closeUnmarkAction: CloseUnmarkAction;
}

// ─────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────

function base(instituteId: string, classId: string) {
  return `/api/attendance/institute/${instituteId}/class/${classId}/sessions`;
}

const classAttendanceSessionsApi = {

  // Groups
  createGroup: (instituteId: string, classId: string, payload: CreateSessionGroupPayload) =>
    attendanceApiClient.post<SessionGroup>(`${base(instituteId, classId)}/groups`, payload),

  getGroups: (instituteId: string, classId: string) =>
    attendanceApiClient.get<SessionGroup[]>(`${base(instituteId, classId)}/groups`),

  updateGroup: (instituteId: string, classId: string, groupId: string, payload: UpdateSessionGroupPayload) =>
    attendanceApiClient.patch<SessionGroup>(`${base(instituteId, classId)}/groups/${groupId}`, payload),

  deleteGroup: (instituteId: string, classId: string, groupId: string) =>
    attendanceApiClient.delete<void>(`${base(instituteId, classId)}/groups/${groupId}`),

  // Sessions
  createSession: (instituteId: string, classId: string, payload: CreateSessionPayload) =>
    attendanceApiClient.post<Session>(base(instituteId, classId), payload),

  updateSession: (instituteId: string, classId: string, sessionId: string, payload: UpdateSessionPayload) =>
    attendanceApiClient.patch<Session>(`${base(instituteId, classId)}/${sessionId}`, payload),

  getSessions: (
    instituteId: string,
    classId: string,
    params?: { date?: string; startDate?: string; endDate?: string; sessionGroupId?: string; includeClosed?: boolean },
  ) => {
    const qs = new URLSearchParams();
    if (params?.date) qs.set('date', params.date);
    if (params?.startDate) qs.set('startDate', params.startDate);
    if (params?.endDate) qs.set('endDate', params.endDate);
    if (params?.sessionGroupId) qs.set('sessionGroupId', params.sessionGroupId);
    if (params?.includeClosed === false) qs.set('includeClosed', 'false');
    const query = qs.toString() ? `?${qs}` : '';
    return attendanceApiClient.get<Session[]>(`${base(instituteId, classId)}${query}`);
  },

  getSessionDetail: (instituteId: string, classId: string, sessionId: string) =>
    attendanceApiClient.get<SessionDetail>(`${base(instituteId, classId)}/${sessionId}`),

  getSessionGrid: (instituteId: string, classId: string, sessionIds: string[]) => {
    const qs = new URLSearchParams({ sessionIds: sessionIds.join(',') });
    return attendanceApiClient.get<SessionGridResponse>(`${base(instituteId, classId)}/grid?${qs}`);
  },

  // Marking
  markAttendance: (
    instituteId: string, classId: string, sessionId: string,
    payload: MarkAttendancePayload,
  ) =>
    attendanceApiClient.post<{ success: boolean; record: any }>(
      `${base(instituteId, classId)}/${sessionId}/mark`, payload,
    ),

  bulkMarkAttendance: (
    instituteId: string, classId: string, sessionId: string,
    payload: BulkMarkAttendancePayload,
  ) =>
    attendanceApiClient.post<{ marked: number; updated: number; errors: string[] }>(
      `${base(instituteId, classId)}/${sessionId}/mark-bulk`, payload,
    ),

  // Close
  closeSession: (
    instituteId: string, classId: string, sessionId: string,
    payload: CloseSessionPayload,
  ) =>
    attendanceApiClient.post<Session>(
      `${base(instituteId, classId)}/${sessionId}/close`, payload,
    ),
};

export default classAttendanceSessionsApi;
