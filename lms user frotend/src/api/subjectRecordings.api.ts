import { apiClient } from './client';
import { enhancedCachedClient } from './enhancedCachedClient';

export type RecordingPlatform = 'SYSTEM' | 'YOUTUBE' | 'GOOGLE_DRIVE' | 'EXTERNAL';
export type RecordingStatus = 'draft' | 'published' | 'archived';
export type RecordingAccessLevel = 'ANYONE' | 'SURAKSHA_USERS' | 'ENROLLED_ONLY' | 'PAID_ONLY';

export interface SubjectRecording {
  id: string;
  instituteId: string;
  classId?: string;
  subjectId?: string;
  uploadedById?: string;
  title: string;
  description?: string;
  platform: RecordingPlatform;
  recordingUrl?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  materials?: Array<{ documentName: string; documentUrl: string; driveFileId?: string; driveWebViewLink?: string; source?: string }>;
  status: RecordingStatus;
  isActive: boolean;
  recAttendanceEnabled: boolean;
  recUrlId?: string;
  recAccessLevel: RecordingAccessLevel;
  recPaymentId?: string;
  recPaymentStatuses?: string[];
  recEntryBgUrl?: string;
  recCardImageUrl?: string;
  recCardImageTtl?: string;
  recBgImageTtl?: string;
  recUrlExpiresAt?: string;
  welcomeMessageEnabled: boolean;
  welcomeMessageText?: string;
  welcomeMessageVoiceEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubjectRecordingCreateData {
  instituteId: string;
  classId?: string;
  subjectId?: string;
  uploadedById?: string;
  title: string;
  description?: string;
  platform?: RecordingPlatform;
  recordingUrl?: string;
  durationSeconds?: number;
  thumbnailUrl?: string;
  materials?: SubjectRecording['materials'];
  status?: RecordingStatus;
  isActive?: boolean;
  recAttendanceEnabled?: boolean;
  recAccessLevel?: RecordingAccessLevel;
  recPaymentId?: string;
  recPaymentStatuses?: string[];
  recEntryBgUrl?: string;
  recCardImageUrl?: string;
  recCardImageTtl?: string;
  recBgImageTtl?: string;
  recUrlExpiresAt?: string;
  welcomeMessageEnabled?: boolean;
  welcomeMessageText?: string;
  welcomeMessageVoiceEnabled?: boolean;
}

export interface SubjectRecordingQuery {
  instituteId?: string;
  classId?: string;
  subjectId?: string;
  uploadedById?: string;
  status?: RecordingStatus;
  platform?: RecordingPlatform;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedSubjectRecordings {
  data: SubjectRecording[];
  total: number;
  page: number;
  limit: number;
}

class SubjectRecordingsApi {
  async list(params: SubjectRecordingQuery, forceRefresh = false): Promise<PaginatedSubjectRecordings> {
    return enhancedCachedClient.get<PaginatedSubjectRecordings>('/subject-recordings', params, {
      ttl: 60000,
      forceRefresh,
    });
  }

  async get(id: string, forceRefresh = false): Promise<SubjectRecording> {
    return enhancedCachedClient.get<SubjectRecording>(`/subject-recordings/${id}`, {}, { ttl: 60000, forceRefresh });
  }

  async create(data: SubjectRecordingCreateData): Promise<SubjectRecording> {
    const res = await apiClient.post<SubjectRecording>('/subject-recordings', data);
    enhancedCachedClient.invalidate('/subject-recordings');
    return res;
  }

  async update(id: string, data: Partial<SubjectRecordingCreateData>): Promise<SubjectRecording> {
    const res = await apiClient.patch<SubjectRecording>(`/subject-recordings/${id}`, data);
    enhancedCachedClient.invalidate('/subject-recordings');
    enhancedCachedClient.invalidate(`/subject-recordings/${id}`);
    return res;
  }

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/subject-recordings/${id}`);
    enhancedCachedClient.invalidate('/subject-recordings');
    enhancedCachedClient.invalidate(`/subject-recordings/${id}`);
  }

  // ─── Tracking ────────────────────────────────────────────────────────────

  // BUG-17: type return as unknown[] instead of any[] to avoid implicit any spread
  async getStudentActivities(
    studentId: string,
    instituteId: string,
    classId: string,
    subjectId?: string,
    forceRefresh = false,
  ): Promise<unknown[]> {
    const params: Record<string, string> = { instituteId, classId };
    if (subjectId) params.subjectId = subjectId;
    return enhancedCachedClient.get<unknown[]>(
      `/subject-recording-tracking/student/${studentId}/activities`,
      params,
      { ttl: 30000, forceRefresh },
    );
  }

  // BUG-10: validateAccess must use the unauthenticated request helper (OptionalJwtAuthGuard on backend).
  // Using apiClient (which always sends auth headers and throws on 401) breaks access for guests/public.
  // Use lectureTrackingApi.validateSubjectRecordingAccess instead — it correctly handles optional auth.
  // This method is kept for backwards compatibility but delegates to the correct implementation.
  async validateAccess(urlId: string): Promise<unknown> {
    // Do NOT use apiClient here — the endpoint uses OptionalJwtAuthGuard and must work without auth.
    // Callers in ViewRecordingPage already use lectureTrackingApi.validateSubjectRecordingAccess directly.
    const { lectureTrackingApi: trackingApi } = await import('./lectureTracking.api');
    return trackingApi.validateSubjectRecordingAccess(urlId);
  }
}

export const subjectRecordingsApi = new SubjectRecordingsApi();
