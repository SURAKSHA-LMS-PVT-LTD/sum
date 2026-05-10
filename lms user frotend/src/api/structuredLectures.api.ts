import { apiClient } from './client';
import { enhancedCachedClient } from './enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';

// ─── Document shapes ────────────────────────────────────────────────────────

/** Document entry as returned by the API */
export interface LectureDocument {
  documentName: string;
  documentUrl: string;
  documentDescription?: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  source?: 'GOOGLE_DRIVE' | 'MANUAL' | string;
  // backward-compat aliases
  name: string;
  url: string;
}

/** Document entry for create/update payloads */
export interface LectureDocumentInput {
  documentName: string;
  documentUrl: string;
  driveFileId?: string;
  driveWebViewLink?: string;
  source?: 'GOOGLE_DRIVE' | 'MANUAL' | string;
}

// ─── Core lecture DTO (matches API response shape) ──────────────────────────

export interface StructuredLecture {
  _id: string;
  instituteId: string;
  subjectId: string;
  grade: number;
  title: string;
  description: string;
  lessonNumber: number;
  lectureNumber: number;
  provider?: string;
  /** Recording / playback URL (YouTube, stored video, etc.) */
  lectureVideoUrl?: string;
  /** Live meeting or external class link (Zoom, Google Meet, etc.) */
  lectureLink?: string;
  coverImageUrl?: string;
  documents: LectureDocument[];
  isActive: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Lesson group (used by subject+grade endpoint) ──────────────────────────

export interface LessonGroup {
  lessonNumber: number;
  lectures: StructuredLecture[];
}

// ─── Request DTOs ────────────────────────────────────────────────────────────

export interface CreateStructuredLectureDto {
  instituteId: string;
  classId: string;
  subjectId: string;
  grade: number;
  title: string;
  description?: string;
  lessonNumber?: number;
  lectureNumber?: number;
  provider?: string;
  /** Either `lectureLink` or `lectureVideoUrl` is accepted by the API */
  lectureLink?: string;
  lectureVideoUrl?: string;
  coverImageUrl?: string;
  /** Structured document entries (Drive or manual URL) */
  documents?: LectureDocumentInput[];
  /** Legacy: flat S3 URL array (kept for backward compat) */
  documentUrls?: string[];
  isActive?: boolean;
}

export interface UpdateStructuredLectureDto {
  instituteId?: string;
  classId?: string;
  subjectId?: string;
  grade?: number;
  title?: string;
  description?: string;
  lessonNumber?: number;
  lectureNumber?: number;
  provider?: string;
  lectureLink?: string;
  lectureVideoUrl?: string;
  coverImageUrl?: string;
  /** Structured document entries (Drive or manual URL) */
  documents?: LectureDocumentInput[];
  /** Legacy: flat S3 URL array (kept for backward compat) */
  documentUrls?: string[];
  isActive?: boolean;
}

// ─── Response shapes ─────────────────────────────────────────────────────────

/** POST /api/structured-lectures  |  PUT /api/structured-lectures/:id */
export interface SingleLectureResponse {
  success: boolean;
  message?: string;
  data: StructuredLecture;
}

/**
 * GET /api/structured-lectures  (paginated list for admin/teacher)
 * Top-level fields — no `data` wrapper.
 */
export interface StructuredLecturesResponse {
  lectures: StructuredLecture[];
  total: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

/**
 * GET /api/structured-lectures/subject/:subjectId/grade/:grade
 * Backend returns lectures grouped by lesson with subject info.
 */
export interface LecturesBySubjectGradeResponse {
  success: boolean;
  message: string;
  subjectInfo: {
    subjectId: string;
    grade: number;
    totalLectures: number;
    totalLessons: number;
    activeLectures: number;
  };
  data: LessonGroup[];
}

/**
 * Lectures scoped to a class + subject.
 * No dedicated backend route exists — resolved via
 * GET /api/structured-lectures/institute/:instituteId/subject/:subjectId
 * The caller must supply instituteId so we can hit the real endpoint.
 */
export type LecturesByClassSubjectResponse = StructuredLecturesResponse;

/** GET /api/structured-lectures/statistics/:subjectId */
export interface LectureStatisticsResponse {
  subjectId: string;
  grade: number | string;   // number when filtered, "all" when not
  totalLectures: number;
  activeLectures: number;
  inactiveLectures: number;
  totalLessons: number;
  totalGrades: number;
  totalDocuments: number;
  lecturesWithLinks: number;
}

// ─── Filter params for getAll ─────────────────────────────────────────────────

export interface StructuredLectureFilterParams {
  grade?: number;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'orderIndex';
  sortOrder?: 'ASC' | 'DESC';
}

// ─── API object ───────────────────────────────────────────────────────────────

export const structuredLecturesApi = {
  /**
   * Create a new structured lecture.
   * POST /api/structured-lectures  (alias: POST /structured-lectures)
   * Access: Admin, Teacher
   */
  create: async (data: CreateStructuredLectureDto): Promise<SingleLectureResponse> => {
    return apiClient.post('/api/structured-lectures', data);
  },

  /**
   * Get all lectures with filtering and pagination.
   * GET /api/structured-lectures
   * Access: Admin, Teacher
   */
  getAll: async (params?: StructuredLectureFilterParams): Promise<StructuredLecturesResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.grade !== undefined) queryParams.append('grade', params.grade.toString());
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.page !== undefined) queryParams.append('page', params.page.toString());
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    const qs = queryParams.toString();
    return enhancedCachedClient.get(`/api/structured-lectures${qs ? '?' + qs : ''}`, undefined, {
      ttl: CACHE_TTL.LECTURES,
    });
  },

  /**
   * Get a single lecture by ID.
   * GET /api/structured-lectures/:id
   * Access: All roles
   */
  getById: async (id: string): Promise<StructuredLecture> => {
    return enhancedCachedClient.get(`/api/structured-lectures/${id}`, undefined, {
      ttl: CACHE_TTL.LECTURES,
    });
  },

  /**
   * Update a lecture (partial — only supply fields to change).
   * PUT /api/structured-lectures/:id
   * Access: Admin, Teacher
   */
  update: async (id: string, data: UpdateStructuredLectureDto): Promise<SingleLectureResponse> => {
    return apiClient.put(`/api/structured-lectures/${id}`, data);
  },

  /**
   * Soft-delete a lecture (sets isActive = false, hidden from students).
   * DELETE /api/structured-lectures/:id
   * Access: Admin, Teacher
   */
  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/api/structured-lectures/${id}`);
  },

  /**
   * Permanently delete a lecture — irreversible.
   * DELETE /api/structured-lectures/:id/permanent
   * Access: SUPERADMIN only
   */
  permanentDelete: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/api/structured-lectures/${id}/permanent`);
  },

  /**
   * Get lectures for a subject within an institute (primary endpoint for students/parents/teachers).
   * GET /api/structured-lectures/institute/:instituteId/subject/:subjectId
   * Access: All roles. Students automatically see only active lectures.
   */
  getByInstituteAndSubject: async (
    instituteId: string,
    subjectId: string,
    grade?: number,
    isActive?: boolean,
  ): Promise<StructuredLecturesResponse> => {
    const queryParams = new URLSearchParams();
    if (grade !== undefined) queryParams.append('grade', grade.toString());
    if (isActive !== undefined) queryParams.append('isActive', isActive.toString());
    const qs = queryParams.toString();
    return enhancedCachedClient.get(
      `/api/structured-lectures/institute/${encodeURIComponent(instituteId)}/subject/${encodeURIComponent(subjectId)}${qs ? '?' + qs : ''}`,
      undefined,
      { ttl: CACHE_TTL.LECTURES, instituteId }
    );
  },

  /**
   * Get lectures for a subject at a specific grade (path-param variant).
   * GET /api/structured-lectures/subject/:subjectId/grade/:grade
   * Access: All roles. Students automatically see only active lectures.
   */
  getBySubjectAndGrade: async (
    subjectId: string,
    grade: number,
    isActive?: boolean,
  ): Promise<LecturesBySubjectGradeResponse> => {
    const queryParams = new URLSearchParams();
    if (isActive !== undefined) queryParams.append('isActive', isActive.toString());
    const qs = queryParams.toString();
    return enhancedCachedClient.get(
      `/api/structured-lectures/subject/${encodeURIComponent(subjectId)}/grade/${grade}${qs ? '?' + qs : ''}`,
      undefined,
      { ttl: CACHE_TTL.LECTURES }
    );
  },

  /**
   * Get lectures scoped to a class + subject.
   * Backend has no class/:classId/subject/:subjectId route.
   * Falls back to GET /api/structured-lectures/institute/:instituteId/subject/:subjectId
   * which returns lectures for the subject across the whole institute (by design).
   */
  getByClassAndSubject: async (
    classId: string,
    subjectId: string,
    params?: { grade?: number; isActive?: boolean; page?: number; limit?: number; instituteId?: string },
  ): Promise<LecturesByClassSubjectResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.grade !== undefined) queryParams.append('grade', params.grade.toString());
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
    if (params?.page !== undefined) queryParams.append('page', params.page.toString());
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString());
    const qs = queryParams.toString();
    // Use the institute+subject endpoint which is the closest match.
    // If no instituteId is provided, fall back to the subject-only endpoint.
    if (params?.instituteId) {
      return enhancedCachedClient.get(
        `/api/structured-lectures/institute/${encodeURIComponent(params.instituteId)}/subject/${encodeURIComponent(subjectId)}${qs ? '?' + qs : ''}`,
        undefined,
        { ttl: CACHE_TTL.LECTURES, instituteId: params.instituteId }
      );
    }
    // Fallback: subject-only endpoint (requires grade as path param or query)
    return enhancedCachedClient.get(
      `/api/structured-lectures/subject/${encodeURIComponent(subjectId)}${qs ? '?' + qs : ''}`,
      undefined,
      { ttl: CACHE_TTL.LECTURES }
    );
  },

  /**
   * Get aggregate statistics for a subject, optionally filtered by grade.
   * GET /api/structured-lectures/statistics/:subjectId
   * Access: Admin, Teacher
   */
  getStatistics: async (subjectId: string, grade?: number): Promise<LectureStatisticsResponse> => {
    const queryParams = new URLSearchParams();
    if (grade !== undefined) queryParams.append('grade', grade.toString());
    const qs = queryParams.toString();
    return enhancedCachedClient.get(
      `/api/structured-lectures/statistics/${encodeURIComponent(subjectId)}${qs ? '?' + qs : ''}`,
      undefined,
      { ttl: CACHE_TTL.LECTURES }
    );
  },

  /**
   * Get a presigned URL to upload a lecture cover image directly to storage.
   * POST /api/structured-lectures/upload/cover-image/signed-url
   */
  getCoverImageSignedUrl: async (
    fileName: string,
    contentType: string,
  ): Promise<{
    success: boolean;
    uploadUrl: string;
    relativePath: string;
    expiresAt: string;
    maxFileSize?: number;
    fields?: Record<string, string>; // For S3 POST uploads
  }> => {
    return apiClient.post('/api/structured-lectures/upload/cover-image/signed-url', { fileName, contentType });
  },

  /**
   * Verify a cover image was uploaded and get its public URL.
   * POST /api/structured-lectures/upload/cover-image/verify
   */
  verifyCoverImage: async (relativePath: string): Promise<{ success: boolean; publicUrl: string }> => {
    return apiClient.post('/api/structured-lectures/upload/cover-image/verify', { relativePath });
  },
};
