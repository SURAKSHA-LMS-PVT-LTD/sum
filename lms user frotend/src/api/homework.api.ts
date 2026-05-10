import { enhancedCachedClient } from './enhancedCachedClient';
import { ApiResponse } from './client';
import { HomeworkReference } from './homeworkReferences.api';

// =================== TYPES ===================

export interface HomeworkSubmissionSummary {
  id: string;
  submissionDate: string;
  fileUrl?: string;
  teacherCorrectionFileUrl?: string;
  driveViewUrl?: string;
  remarks?: string;
  grade?: string;
}

export interface Homework {
  id: string;
  instituteId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  title: string;
  description: string;
  instructions?: string;
  startDate?: string;
  endDate?: string;
  maxMarks?: number;
  attachmentUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  teacher?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  subject?: {
    id: string;
    name: string;
    code: string;
  };
  class?: {
    id: string;
    name: string;
    code: string;
  };
  institute?: {
    id: string;
    name: string;
    code: string;
  };
  referenceLink?: string;
  
  // Included when includeReferences=true
  references?: HomeworkReference[];
  
  // Student-only: included when includeSubmissions=true
  mySubmissions?: HomeworkSubmissionSummary[];
  hasSubmitted?: boolean;
  
  // Teacher/Admin: submission count (no full submissions in list)
  submissionCount?: number;
}

export interface HomeworkCreateData {
  title: string;
  description: string;
  classId: string;
  subjectId: string;
  startDate?: string | null;
  endDate?: string | null;
  // Legacy fields - kept for backward compatibility
  instituteId?: string;
  teacherId?: string;
  instructions?: string;
  maxMarks?: number | null;
  attachmentUrl?: string | null;
  isActive?: boolean;
}

export interface HomeworkUpdateData {
  title?: string;
  description?: string;
  startDate?: string | null;
  endDate?: string | null;
  instructions?: string;
  maxMarks?: number | null;
  attachmentUrl?: string | null;
  isActive?: boolean;
}

export interface HomeworkQueryParams {
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
  // New parameters for role-based data fetching
  includeReferences?: boolean;
  includeSubmissions?: boolean; // Only for students - DO NOT use for teachers
}

// =================== API CLASS ===================

class HomeworkApi {
  private basePath = '/institute-class-subject-homeworks';

  /**
   * Get homework list with role-based filtering
   * 
   * FOR STUDENTS:
   * - Use includeReferences=true & includeSubmissions=true
   * - Returns homework with references and own submissions in ONE call
   * 
   * FOR TEACHERS/ADMINS:
   * - Use includeReferences=true only
   * - DO NOT use includeSubmissions (use separate submission API for performance)
   * - Returns homework with references and submissionCount
   */
  async getHomework(params?: HomeworkQueryParams, forceRefresh = false): Promise<ApiResponse<Homework[]>> {
    console.log('📚 Fetching homework with secure caching:', params, { forceRefresh });
    
    // Separate cache context fields from actual API query params
    const { userId, role, ...apiParams } = params ?? {};
    
    return enhancedCachedClient.get<ApiResponse<Homework[]>>(
      this.basePath, 
      Object.keys(apiParams).length > 0 ? apiParams : undefined, 
      {
        forceRefresh,
        ttl: 15,
        useStaleWhileRevalidate: true,
        userId,
        instituteId: apiParams?.instituteId,
        classId: apiParams?.classId,
        subjectId: apiParams?.subjectId,
        role
      }
    );
  }

  /**
   * Get homework for students (with references and own submissions)
   */
  async getStudentHomework(
    classId: string, 
    subjectId: string, 
    params?: Omit<HomeworkQueryParams, 'classId' | 'subjectId' | 'includeReferences' | 'includeSubmissions'>,
    forceRefresh = false
  ): Promise<ApiResponse<Homework[]>> {
    console.log('📚 Fetching student homework (complete view):', { classId, subjectId });
    
    return this.getHomework({
      ...params,
      classId,
      subjectId,
      includeReferences: true,
      includeSubmissions: true
    }, forceRefresh);
  }

  /**
   * Get homework for teachers (NO submissions - use separate API for submissions)
   */
  async getTeacherHomework(
    classId: string, 
    subjectId: string, 
    params?: Omit<HomeworkQueryParams, 'classId' | 'subjectId' | 'includeSubmissions'>,
    forceRefresh = false
  ): Promise<ApiResponse<Homework[]>> {
    console.log('📚 Fetching teacher homework (no submissions):', { classId, subjectId });
    
    return this.getHomework({
      ...params,
      classId,
      subjectId,
      includeReferences: true
      // DO NOT include submissions - use separate API for performance
    }, forceRefresh);
  }

  /**
   * Get single homework by ID
   */
  async getHomeworkById(
    id: string, 
    forceRefresh = false, 
    context?: { 
      instituteId?: string; 
      classId?: string; 
      subjectId?: string; 
      userId?: string 
    }
  ): Promise<Homework> {
    console.log('📄 Fetching homework by ID with secure caching:', id, { forceRefresh, context });
    return enhancedCachedClient.get<Homework>(
      `${this.basePath}/${id}`, 
      undefined, 
      {
        forceRefresh,
        ttl: 15,
        useStaleWhileRevalidate: true,
        ...context
      }
    );
  }

  /**
   * Create homework (Teacher/Admin)
   */
  async createHomework(data: HomeworkCreateData): Promise<Homework> {
    console.log('✏️ Creating homework (will invalidate cache):', data);
    return enhancedCachedClient.post<Homework>(
      this.basePath, 
      data,
      {
        instituteId: data.instituteId,
        classId: data.classId,
        subjectId: data.subjectId
      }
    );
  }

  /**
   * Update homework (Teacher who created / Admin)
   */
  async updateHomework(id: string, data: HomeworkUpdateData, context?: { instituteId?: string; classId?: string; subjectId?: string }): Promise<Homework> {
    console.log('📝 Updating homework (will invalidate cache):', id, data);
    return enhancedCachedClient.patch<Homework>(
      `${this.basePath}/${id}`, 
      data,
      context
    );
  }

  /**
   * Delete homework (Soft delete - Teacher who created / Admin)
   */
  async deleteHomework(id: string, context?: { instituteId?: string; classId?: string; subjectId?: string }): Promise<void> {
    console.log('🗑️ Deleting homework (will invalidate cache):', id);
    return enhancedCachedClient.delete<void>(
      `${this.basePath}/${id}`,
      context
    );
  }

  // =================== CACHE UTILITIES ===================

  /**
   * Check if homework is cached
   */
  async hasHomeworkCached(params?: HomeworkQueryParams): Promise<boolean> {
    const { userId, role, ...apiParams } = params ?? {};
    return enhancedCachedClient.hasCache(
      this.basePath, 
      Object.keys(apiParams).length > 0 ? apiParams : undefined,
      {
        userId,
        instituteId: apiParams?.instituteId,
        classId: apiParams?.classId,
        subjectId: apiParams?.subjectId,
        role
      }
    );
  }

  /**
   * Get cached homework only (no API call)
   */
  async getCachedHomework(params?: HomeworkQueryParams): Promise<ApiResponse<Homework[]> | null> {
    const { userId, role, ...apiParams } = params ?? {};
    return enhancedCachedClient.getCachedOnly<ApiResponse<Homework[]>>(
      this.basePath, 
      Object.keys(apiParams).length > 0 ? apiParams : undefined,
      {
        userId,
        instituteId: apiParams?.instituteId,
        classId: apiParams?.classId,
        subjectId: apiParams?.subjectId,
        role
      }
    );
  }

  /**
   * Preload homework data for faster navigation
   */
  async preloadHomework(params?: HomeworkQueryParams): Promise<void> {
    const { userId, role, ...apiParams } = params ?? {};
    await enhancedCachedClient.preload<ApiResponse<Homework[]>>(
      this.basePath, 
      Object.keys(apiParams).length > 0 ? apiParams : undefined, 
      {
        ttl: 15,
        userId,
        instituteId: apiParams?.instituteId,
        classId: apiParams?.classId,
        subjectId: apiParams?.subjectId,
        role
      }
    );
  }
}

export const homeworkApi = new HomeworkApi();
