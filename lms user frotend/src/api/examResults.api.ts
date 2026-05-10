import { enhancedCachedClient } from './enhancedCachedClient';
import { ApiResponse } from './client';

export interface ExamResult {
  id: string;
  instituteId: string;
  classId: string;
  subjectId: string;
  studentId: string;
  examId: string;
  score: string;
  grade: string;
  remarks: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  exam: {
    id: string;
    title: string;
    examType: string;
  };
}

export interface ExamResultsQueryParams {
  page?: number;
  limit?: number;
  instituteId?: string;
  classId?: string;
  subjectId?: string;
  examId?: string;
  studentId?: string;
  userId?: string;
  role?: string;
}

export interface ExamResultsResponse {
  data: ExamResult[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
    previousPage: number | null;
    nextPage: number | null;
  };
}

class ExamResultsApi {
  async getExamResults(params?: ExamResultsQueryParams, forceRefresh = false): Promise<ExamResultsResponse> {
    console.log('Fetching exam results:', params, { forceRefresh });
    // Separate cache context fields from actual API query params
    const { userId, role, ...apiParams } = params ?? {};
    return enhancedCachedClient.get<ExamResultsResponse>('/institute-class-subject-resaults', Object.keys(apiParams).length > 0 ? apiParams : undefined, {
      forceRefresh,
      ttl: 30,
      useStaleWhileRevalidate: true,
      userId,
      instituteId: apiParams?.instituteId,
      classId: apiParams?.classId,
      subjectId: apiParams?.subjectId,
      role
    });
  }

  // Utility methods
  hasResultsCached(params?: ExamResultsQueryParams): Promise<boolean> {
    const { userId, role, ...apiParams } = params ?? {};
    return enhancedCachedClient.hasCache('/institute-class-subject-resaults', Object.keys(apiParams).length > 0 ? apiParams : undefined, {
      userId,
      instituteId: apiParams?.instituteId,
      classId: apiParams?.classId,
      subjectId: apiParams?.subjectId,
      role
    });
  }

  getCachedResults(params?: ExamResultsQueryParams): Promise<ExamResultsResponse | null> {
    const { userId, role, ...apiParams } = params ?? {};
    return enhancedCachedClient.getCachedOnly<ExamResultsResponse>('/institute-class-subject-resaults', Object.keys(apiParams).length > 0 ? apiParams : undefined, {
      userId,
      instituteId: apiParams?.instituteId,
      classId: apiParams?.classId,
      subjectId: apiParams?.subjectId,
      role
    });
  }

  async preloadResults(params?: ExamResultsQueryParams): Promise<void> {
    const { userId, role, ...apiParams } = params ?? {};
    await enhancedCachedClient.get<ExamResultsResponse>('/institute-class-subject-resaults', Object.keys(apiParams).length > 0 ? apiParams : undefined, {
      ttl: 30,
      userId,
      instituteId: apiParams?.instituteId,
      classId: apiParams?.classId,
      subjectId: apiParams?.subjectId,
      role
    });
  }

  async createBulkResults(data: BulkResultsCreateData): Promise<ExamResult[]> {
    console.log('Creating bulk exam results:', data);
    return enhancedCachedClient.post<ExamResult[]>('/institute-class-subject-resaults/bulk', data, {
      instituteId: data.instituteId,
      classId: data.classId,
      subjectId: data.subjectId
    });
  }

  async getStudentsWithMarks(params: {
    instituteId: string;
    classId: string;
    subjectId: string;
    examId: string;
  }): Promise<StudentExamMark[]> {
    return enhancedCachedClient.get<StudentExamMark[]>(
      '/institute-class-subject-resaults/students-with-marks',
      params,
      { forceRefresh: true, ttl: 0, instituteId: params.instituteId, classId: params.classId, subjectId: params.subjectId }
    );
  }
}

export interface BulkResultsCreateData {
  instituteId: string;
  classId: string;
  subjectId: string;
  examId?: string;
  results: {
    studentId: string;
    score?: string;
    grade?: Grade;
    remarks?: string;
  }[];
}

export type Grade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'S' | 'F';

export interface StudentExamMark {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  instituteId: string;
  examId: string;
  score: string;
  grade: Grade | null;
}

export const examResultsApi = new ExamResultsApi();