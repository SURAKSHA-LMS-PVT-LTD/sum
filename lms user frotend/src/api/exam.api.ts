import { cachedApiClient } from './cachedClient';
import { enhancedCachedClient } from './enhancedCachedClient';
import { ApiResponse } from './client';

export interface Exam {
  id: string;
  instituteId: string;
  classId: string;
  subjectId: string;
  title: string;
  description: string;
  examType: 'online' | 'physical';
  duration: number;
  maxMarks: number;
  passingMarks: number;
  examDate: string;
  startTime: string;
  endTime: string;
  venue?: string;
  examLink?: string;
  instructions?: string;
  status: 'scheduled' | 'draft' | 'completed' | 'cancelled';
  createdBy: string;
  toWhom: string;
  isActive: boolean;
}

export interface ExamCreateData {
  instituteId: string;
  classId: string;
  subjectId: string;
  title: string;
  description: string;
  examType: 'online' | 'physical';
  duration: number;
  maxMarks: number;
  passingMarks: number;
  examDate: string;
  startTime: string;
  endTime: string;
  venue?: string | null;
  examLink?: string | null;
  instructions?: string | null;
  status: 'scheduled' | 'draft' | 'completed' | 'cancelled';
  createdBy: string;
  toWhom: string;
  isActive: boolean;
}

export interface ExamQueryParams {
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

class ExamApi {
  async getExams(params?: ExamQueryParams, forceRefresh = false): Promise<ApiResponse<Exam[]>> {
    console.log('📝 Fetching exams with secure caching:', params, { forceRefresh });
    // Separate cache context fields from actual API query params
    const { userId, role, ...apiParams } = params ?? {};
    return enhancedCachedClient.get<ApiResponse<Exam[]>>('/institute-class-subject-exams', Object.keys(apiParams).length > 0 ? apiParams : undefined, {
      forceRefresh,
      ttl: 30, // Cache exams for 30 minutes
      useStaleWhileRevalidate: true,
      userId,
      instituteId: apiParams?.instituteId,
      classId: apiParams?.classId,
      subjectId: apiParams?.subjectId,
      role
    });
  }

  async getExamById(id: string, forceRefresh = false, context?: { instituteId?: string; classId?: string; subjectId?: string; userId?: string }): Promise<Exam> {
    console.log('📄 Fetching exam by ID with secure caching:', id, { forceRefresh, context });
    return enhancedCachedClient.get<Exam>(`/institute-class-subject-exams/${id}`, undefined, {
      forceRefresh,
      ttl: 30,
      useStaleWhileRevalidate: true,
      ...context
    });
  }

  async createExam(data: ExamCreateData): Promise<Exam> {
    console.log('✏️ Creating exam (will invalidate cache):', data);
    return enhancedCachedClient.post<Exam>('/institute-class-subject-exams', data, {
      instituteId: data.instituteId,
      classId: data.classId,
      subjectId: data.subjectId
    });
  }

  async updateExam(id: string, data: Partial<ExamCreateData>): Promise<Exam> {
    console.log('📝 Updating exam (will invalidate cache):', id, data);
    return enhancedCachedClient.patch<Exam>(`/institute-class-subject-exams/${id}`, data, {
      instituteId: data.instituteId,
      classId: data.classId,
      subjectId: data.subjectId
    });
  }

  async deleteExam(id: string, context?: { instituteId?: string; classId?: string; subjectId?: string }): Promise<void> {
    console.log('🗑️ Deleting exam (will invalidate cache):', id);
    return enhancedCachedClient.delete<void>(`/institute-class-subject-exams/${id}`, context);
  }

  async hasExamsCached(params?: ExamQueryParams): Promise<boolean> {
    const { userId, role, ...apiParams } = params ?? {};
    return enhancedCachedClient.hasCache('/institute-class-subject-exams', Object.keys(apiParams).length > 0 ? apiParams : undefined, {
      userId,
      instituteId: apiParams?.instituteId,
      classId: apiParams?.classId,
      subjectId: apiParams?.subjectId,
      role
    });
  }

  async getCachedExams(params?: ExamQueryParams): Promise<ApiResponse<Exam[]> | null> {
    const { userId, role, ...apiParams } = params ?? {};
    return enhancedCachedClient.getCachedOnly<ApiResponse<Exam[]>>('/institute-class-subject-exams', Object.keys(apiParams).length > 0 ? apiParams : undefined, {
      userId,
      instituteId: apiParams?.instituteId,
      classId: apiParams?.classId,
      subjectId: apiParams?.subjectId,
      role
    });
  }

  async preloadExams(params?: ExamQueryParams): Promise<void> {
    const { userId, role, ...apiParams } = params ?? {};
    await enhancedCachedClient.preload<ApiResponse<Exam[]>>('/institute-class-subject-exams', Object.keys(apiParams).length > 0 ? apiParams : undefined, {
      ttl: 30,
      userId,
      instituteId: apiParams?.instituteId,
      classId: apiParams?.classId,
      subjectId: apiParams?.subjectId,
      role
    });
  }
}

export const examApi = new ExamApi();
