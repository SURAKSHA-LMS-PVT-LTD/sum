import { enhancedCachedClient } from './enhancedCachedClient';
import { ApiResponse } from './client';

export interface Lecture {
  id: string;
  instituteId: string;
  classId?: string;
  subjectId?: string;
  instructorId: string;
  title: string;
  description: string;
  lectureType: 'online' | 'physical';
  venue?: string;
  subject?: string;
  startTime?: string;
  endTime?: string;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled' | 'postponed';
  meetingLink?: string;
  meetingId?: string;
  meetingPassword?: string;
  recordingUrl?: string;
  isRecorded: boolean;
  maxParticipants: number;
  isActive: boolean;
  thumbnailUrl?: string;
  materials?: Array<{
    documentName: string;
    documentUrl: string;
    driveFileId?: string;
    driveWebViewLink?: string;
    source: 'S3' | 'GOOGLE_DRIVE' | 'GOOGLE_DRIVE_INSTITUTE' | 'EXTERNAL_LINK';
  }>;
  // Tracking
  liveAttendanceEnabled?: boolean;
  liveUrlId?: string;
  liveAccessLevel?: 'ANYONE' | 'SURAKSHA_USERS' | 'ENROLLED_ONLY' | 'PAID_ONLY';
  livePaymentId?: string;
  livePaymentStatuses?: string[];
  liveEntryBgUrl?: string;
  
  recAttendanceEnabled?: boolean;
  recUrlId?: string;
  recPlatform?: 'SYSTEM' | 'YOUTUBE' | 'GOOGLE_DRIVE';
  recAccessLevel?: 'ANYONE' | 'SURAKSHA_USERS' | 'ENROLLED_ONLY' | 'PAID_ONLY';
  recPaymentId?: string;
  recPaymentStatuses?: string[];
  welcomeMessageEnabled?: boolean;
  welcomeMessageText?: string;
  welcomeMessageVoiceEnabled?: boolean;
}

export interface LectureCreateData {
  instituteId: string;
  classId?: string;
  subjectId?: string;
  instructorId: string;
  title: string;
  description: string;
  lectureType: 'online' | 'physical';
  venue?: string | null;
  subject?: string;
  startTime?: string | null;
  endTime?: string | null;
  status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled' | 'postponed';
  meetingLink?: string | null;
  meetingId?: string | null;
  meetingPassword?: string | null;
  recordingUrl?: string | null;
  isRecorded: boolean;
  maxParticipants: number;
  isActive: boolean;
  thumbnailUrl?: string | null;
  materials?: Array<{
    documentName: string;
    documentUrl: string;
    driveFileId?: string;
    driveWebViewLink?: string;
    source: 'S3' | 'GOOGLE_DRIVE' | 'GOOGLE_DRIVE_INSTITUTE' | 'EXTERNAL_LINK';
  }> | null;
  // Tracking
  liveAttendanceEnabled?: boolean;
  liveAccessLevel?: 'ANYONE' | 'SURAKSHA_USERS' | 'ENROLLED_ONLY' | 'PAID_ONLY';
  livePaymentId?: string;
  livePaymentStatuses?: string[];
  liveEntryBgUrl?: string;
  
  recAttendanceEnabled?: boolean;
  recPlatform?: 'SYSTEM' | 'YOUTUBE' | 'GOOGLE_DRIVE';
  recAccessLevel?: 'ANYONE' | 'SURAKSHA_USERS' | 'ENROLLED_ONLY' | 'PAID_ONLY';
  recPaymentId?: string;
  recPaymentStatuses?: string[];
  welcomeMessageEnabled?: boolean;
  welcomeMessageText?: string | null;
  welcomeMessageVoiceEnabled?: boolean;
}

export interface LectureQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  search?: string;
  status?: string;
  instituteId?: string;
  classId?: string;
  subjectId?: string;
  isActive?: boolean;
  userId?: string;
  role?: string;
}

class LectureApi {
  async getLectures(params?: LectureQueryParams, forceRefresh = false): Promise<ApiResponse<Lecture[]>> {
    // Separate cache context fields from actual API query params
    const { userId, role, ...apiParams } = params ?? {};
    return enhancedCachedClient.get<ApiResponse<Lecture[]>>('/institute-class-subject-lectures', Object.keys(apiParams).length > 0 ? apiParams : undefined, {
      forceRefresh,
      ttl: 10, // Cache lectures for 10 minutes (they change frequently)
      useStaleWhileRevalidate: true,
      userId,
      instituteId: apiParams?.instituteId,
      classId: apiParams?.classId,
      subjectId: apiParams?.subjectId,
      role
    });
  }

  async getInstituteLectures(params?: LectureQueryParams, forceRefresh = false): Promise<ApiResponse<Lecture[]>> {
    // Separate cache context fields from actual API query params
    const { userId, role, ...apiParams } = params ?? {};
    return enhancedCachedClient.get<ApiResponse<Lecture[]>>('/institute-lectures', Object.keys(apiParams).length > 0 ? apiParams : undefined, {
      forceRefresh,
      ttl: 10,
      useStaleWhileRevalidate: true,
      userId,
      instituteId: apiParams?.instituteId,
      role
    });
  }

  async getLectureById(id: string, forceRefresh = false, context?: { instituteId?: string; classId?: string; subjectId?: string; userId?: string }): Promise<Lecture> {
    return enhancedCachedClient.get<Lecture>(`/institute-class-subject-lectures/${id}`, undefined, {
      forceRefresh,
      ttl: 10,
      useStaleWhileRevalidate: true,
      ...context
    });
  }

  async createLecture(data: LectureCreateData, isInstituteLecture: boolean = false): Promise<Lecture> {
    const endpoint = isInstituteLecture ? '/institute-lectures' : '/institute-class-subject-lectures';
    return enhancedCachedClient.post<Lecture>(endpoint, data, {
      instituteId: data.instituteId,
      classId: data.classId,
      subjectId: data.subjectId
    });
  }

  async createInstituteLecture(data: LectureCreateData): Promise<Lecture> {
    return enhancedCachedClient.post<Lecture>('/institute-lectures', data, {
      instituteId: data.instituteId
    });
  }

  async updateInstituteLecture(id: string, data: Partial<LectureCreateData>, context?: { instituteId?: string }): Promise<Lecture> {
    return enhancedCachedClient.patch<Lecture>(`/institute-lectures/${id}`, data, context);
  }

  async updateLecture(id: string, data: Partial<LectureCreateData>, context?: { instituteId?: string; classId?: string; subjectId?: string }): Promise<Lecture> {
    return enhancedCachedClient.patch<Lecture>(`/institute-class-subject-lectures/${id}`, data, context);
  }

  async deleteLecture(id: string, context?: { instituteId?: string; classId?: string; subjectId?: string }): Promise<void> {
    // Backend DELETE /:id is SUPERADMIN-only. Use PATCH to deactivate instead.
    await enhancedCachedClient.patch<any>(`/institute-class-subject-lectures/${id}`, { isActive: false }, context);
  }

  async deleteInstituteLecturePermanent(id: string, context?: { instituteId?: string }): Promise<any> {
    return enhancedCachedClient.delete<any>(`/institute-lectures/${id}/permanent`, context);
  }

  // ── Class-level lectures (all class members, no subject filter) ──

  async getClassLectures(params?: LectureQueryParams, forceRefresh = false): Promise<ApiResponse<Lecture[]>> {
    const { userId, role, ...apiParams } = params ?? {};
    return enhancedCachedClient.get<ApiResponse<Lecture[]>>('/institute-class-lectures', Object.keys(apiParams).length > 0 ? apiParams : undefined, {
      forceRefresh,
      ttl: 10,
      useStaleWhileRevalidate: true,
      userId,
      instituteId: apiParams?.instituteId,
      classId: apiParams?.classId,
      role
    });
  }

  async getClassLecturesByClass(classId: string, instituteId?: string, forceRefresh = false): Promise<Lecture[]> {
    const params: any = {};
    if (instituteId) params.instituteId = instituteId;
    return enhancedCachedClient.get<Lecture[]>(`/institute-class-lectures/class/${classId}`, Object.keys(params).length > 0 ? params : undefined, {
      forceRefresh,
      ttl: 10,
      useStaleWhileRevalidate: true,
      instituteId,
      classId
    });
  }

  async createClassLecture(data: LectureCreateData): Promise<Lecture> {
    return enhancedCachedClient.post<Lecture>('/institute-class-lectures', data, {
      instituteId: data.instituteId,
      classId: data.classId
    });
  }

  async updateClassLecture(id: string, data: Partial<LectureCreateData>, context?: { instituteId?: string; classId?: string }): Promise<Lecture> {
    return enhancedCachedClient.patch<Lecture>(`/institute-class-lectures/${id}`, data, context);
  }

  async updateClassLectureStatus(id: string, status: 'scheduled' | 'ongoing' | 'completed' | 'cancelled', context?: { instituteId?: string; classId?: string }): Promise<Lecture> {
    return enhancedCachedClient.patch<Lecture>(`/institute-class-lectures/${id}/status`, { status }, context);
  }

  async rescheduleClassLecture(id: string, startTime: string, endTime: string, context?: { instituteId?: string; classId?: string }): Promise<Lecture> {
    return enhancedCachedClient.patch<Lecture>(`/institute-class-lectures/${id}/reschedule`, { startTime, endTime }, context);
  }

  async deleteClassLecture(id: string, context?: { instituteId?: string; classId?: string }): Promise<void> {
    await enhancedCachedClient.patch<any>(`/institute-class-lectures/${id}`, { isActive: false }, context);
  }

  async deleteClassLecturePermanent(id: string, context?: { instituteId?: string; classId?: string }): Promise<any> {
    return enhancedCachedClient.delete<any>(`/institute-class-lectures/${id}/permanent`, context);
  }

  async hasLecturesCached(params?: LectureQueryParams): Promise<boolean> {
    const { userId, role, ...apiParams } = params ?? {};
    return enhancedCachedClient.hasCache('/institute-class-subject-lectures', Object.keys(apiParams).length > 0 ? apiParams : undefined, {
      userId,
      instituteId: apiParams?.instituteId,
      classId: apiParams?.classId,
      subjectId: apiParams?.subjectId,
      role
    });
  }

  async getCachedLectures(params?: LectureQueryParams): Promise<ApiResponse<Lecture[]> | null> {
    const { userId, role, ...apiParams } = params ?? {};
    return enhancedCachedClient.getCachedOnly<ApiResponse<Lecture[]>>('/institute-class-subject-lectures', Object.keys(apiParams).length > 0 ? apiParams : undefined, {
      userId,
      instituteId: apiParams?.instituteId,
      classId: apiParams?.classId,
      subjectId: apiParams?.subjectId,
      role
    });
  }

  async preloadLectures(params?: LectureQueryParams): Promise<void> {
    const { userId, role, ...apiParams } = params ?? {};
    await enhancedCachedClient.preload<ApiResponse<Lecture[]>>('/institute-class-subject-lectures', Object.keys(apiParams).length > 0 ? apiParams : undefined, {
      ttl: 10,
      userId,
      instituteId: apiParams?.instituteId,
      classId: apiParams?.classId,
      subjectId: apiParams?.subjectId,
      role
    });
  }

  async getStudentLectureActivities(studentId: string, instituteId: string, classId: string, subjectId?: string, forceRefresh = false): Promise<any[]> {
    const params: any = { instituteId, classId };
    if (subjectId) params.subjectId = subjectId;
    return enhancedCachedClient.get<any[]>(`/lecture-tracking/student/${studentId}/activities`, params, {
      forceRefresh,
      ttl: 5,
    });
  }

  async fetchLecturesWithCache(params?: LectureQueryParams): Promise<ApiResponse<Lecture[]>> {
    const cachedData = await this.getCachedLectures(params);
    if (cachedData) {
      return cachedData;
    }
    return this.getLectures(params, true);
  }
}

export const lectureApi = new LectureApi();
