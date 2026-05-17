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

  async getStudentActivities(
    studentId: string,
    instituteId: string,
    classId: string,
    subjectId?: string,
    forceRefresh = false,
  ): Promise<any[]> {
    const params: any = { instituteId, classId };
    if (subjectId) params.subjectId = subjectId;
    return enhancedCachedClient.get<any[]>(
      `/subject-recording-tracking/student/${studentId}/activities`,
      params,
      { ttl: 30000, forceRefresh },
    );
  }

  async validateAccess(urlId: string): Promise<any> {
    return apiClient.get(`/subject-recording-tracking/recording/access/${urlId}`);
  }
}

export const subjectRecordingsApi = new SubjectRecordingsApi();
