import { apiClient } from './client';
import { enhancedCachedClient } from './enhancedCachedClient';

// Request/Response Types
export interface SelfEnrollRequest {
  enrollmentKey: string;
}

export interface SelfEnrollResponse {
  message: string;
  instituteId: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  className: string;
  enrollmentMethod: string;
  verificationStatus: 'verified' | 'pending' | 'rejected' | 'pending_payment' | 'payment_rejected' | 'enrolled_free_card';
  enrolledAt: string;
  paymentRequired?: boolean;
  feeAmount?: number;
  enrollmentPaymentId?: string;
  studentType?: 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid';
  /** Class-level payment gate details — returned when verificationStatus is pending_payment due to payment gate */
  enrollmentPaymentTitle?: string;
  enrollmentPaymentAmount?: number;
  enrollmentPaymentDueDate?: string;
}

export interface TeacherAssignRequest {
  studentIds: string[];
}

export interface TeacherAssignResponse {
  message: string;
  successCount: number;
  failedCount: number;
  successfulAssignments: Array<{
    studentId: string;
    studentName: string;
    status: string;
  }>;
  failedAssignments: Array<{
    studentId: string;
    studentName?: string;
    status: string;
    reason: string;
  }>;
}

export interface EnrollmentSettingsRequest {
  enrollmentEnabled: boolean;
  enrollmentKey?: string;
  enrollmentFeeRequired?: boolean;
  enrollmentFeeAmount?: number;
  enrollmentPaymentRefId?: string;
  enrollmentPaymentStatuses?: string[];
}

export interface EnrollmentSettingsResponse {
  instituteId: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  className: string;
  enrollmentEnabled: boolean;
  enrollmentKey?: string;
  currentEnrollmentCount: number;
  updatedAt: string;
  enrollmentFeeRequired?: boolean;
  enrollmentFeeAmount?: number;
  enrollmentPaymentRefId?: string;
  enrollmentPaymentStatuses?: string[];
}

export class ApiError extends Error {
  constructor(public status: number, public response: any) {
    const errorMessages: Record<number, string> = {
      400: "Invalid request. Please check your input.",
      401: "Authentication required. Please log in.",
      403: "You don't have permission for this action.",
      404: "Resource not found or enrollment disabled.",
      409: "Enrollment conflict (already enrolled).",
      500: "Server error. Please try again later."
    };
    
    super(errorMessages[status] || 'An unexpected error occurred');
  }
}

export interface ClassEnrollmentSummaryItem {
  studentId: string;
  name: string;
  email: string;
  imageUrl: string | null;
  hasFreeCard: boolean;
  extraData?: Record<string, any> | null;
  subjects: {
    subjectId: string;
    subjectName: string;
    studentType: 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid';
    verificationStatus: string;
  }[];
}

export interface EnrollmentQueryParams {
  userId?: string;
  role?: string;
  instituteId?: string;
  classId?: string;
  subjectId?: string;
}

export const enrollmentApi = {
  // Student self-enrollment with auto-invalidation
  async selfEnroll(enrollmentKey: string | undefined, params?: EnrollmentQueryParams): Promise<SelfEnrollResponse> {
    try {
      const body: Record<string, any> = {};
      if (enrollmentKey) body.enrollmentKey = enrollmentKey;
      if (params?.instituteId) body.instituteId = params.instituteId;
      if (params?.classId) body.classId = params.classId;
      if (params?.subjectId) body.subjectId = params.subjectId;
      return await enhancedCachedClient.post('/institute-class-subject-students/self-enroll', body, {
        userId: params?.userId,
        instituteId: params?.instituteId,
        classId: params?.classId,
        subjectId: params?.subjectId
      });
    } catch (error: any) {
      throw new ApiError(error.status || 500, error.response || error);
    }
  },

  // Teacher assigns students with auto-invalidation
  async teacherAssignStudents(
    instituteId: string,
    classId: string,
    subjectId: string,
    studentIds: string[],
    params?: EnrollmentQueryParams
  ): Promise<TeacherAssignResponse> {
    try {
      return await enhancedCachedClient.post(
        `/institute-class-subject-students/teacher-assign/${instituteId}/${classId}/${subjectId}`,
        { studentIds },
        {
          userId: params?.userId,
          instituteId,
          classId,
          subjectId,
          role: params?.role
        }
      );
    } catch (error: any) {
      throw new ApiError(error.status || 500, error.response || error);
    }
  },

  // Update enrollment settings with auto-invalidation
  async updateEnrollmentSettings(
    instituteId: string,
    classId: string,
    subjectId: string,
    enrollmentEnabled: boolean,
    enrollmentKey?: string,
    params?: EnrollmentQueryParams,
    extra?: {
      enrollmentFeeRequired?: boolean;
      enrollmentFeeAmount?: number;
      enrollmentPaymentRefId?: string;
      enrollmentPaymentStatuses?: string[];
    },
  ): Promise<EnrollmentSettingsResponse> {
    try {
      const body: EnrollmentSettingsRequest = { enrollmentEnabled };
      if (enrollmentKey !== undefined) {
        body.enrollmentKey = enrollmentKey;
      }
      if (extra?.enrollmentFeeRequired !== undefined) body.enrollmentFeeRequired = extra.enrollmentFeeRequired;
      if (extra?.enrollmentFeeAmount !== undefined) body.enrollmentFeeAmount = extra.enrollmentFeeAmount;
      if (extra?.enrollmentPaymentRefId !== undefined) body.enrollmentPaymentRefId = extra.enrollmentPaymentRefId;
      if (extra?.enrollmentPaymentStatuses !== undefined) body.enrollmentPaymentStatuses = extra.enrollmentPaymentStatuses;
      return await enhancedCachedClient.patch(
        `/institute-class-subject-students/enrollment-settings/${instituteId}/${classId}/${subjectId}`,
        body,
        {
          userId: params?.userId,
          instituteId,
          classId,
          subjectId,
          role: params?.role
        }
      );
    } catch (error: any) {
      throw new ApiError(error.status || 500, error.response || error);
    }
  },

  // Get enrollment settings with enhanced caching (legacy)
  async getEnrollmentSettings(
    instituteId: string,
    classId: string,
    subjectId: string,
    params?: EnrollmentQueryParams,
    forceRefresh = false
  ): Promise<EnrollmentSettingsResponse> {
    try {
      return await enhancedCachedClient.get(
        `/institute-class-subject-students/enrollment-settings/${instituteId}/${classId}/${subjectId}`,
        undefined,
        {
          forceRefresh,
          ttl: 20,
          useStaleWhileRevalidate: true,
          userId: params?.userId,
          instituteId,
          classId,
          subjectId,
          role: params?.role
        }
      );
    } catch (error: any) {
      throw new ApiError(error.status || 500, error.response || error);
    }
  },

  // ✅ NEW: Get subject enrollment key/settings from the new endpoint
  async getSubjectEnrollmentKey(
    instituteId: string,
    classId: string,
    subjectId: string,
    forceRefresh = false
  ): Promise<{
    subjectId: string;
    enrollmentKey: string | null;
    enrollmentEnabled: boolean;
    enrollmentType: 'OPEN' | 'KEY_REQUIRED';
  }> {
    return enhancedCachedClient.get(
      `/institutes/${instituteId}/classes/${classId}/subjects/${subjectId}/enrollment-key`,
      undefined,
      { forceRefresh, ttl: 10, instituteId, classId, subjectId }
    );
  },

  // Student claims free card status for pending_payment enrollment
  async claimFreeCard(
    instituteId: string,
    classId: string,
    subjectId: string,
    params?: EnrollmentQueryParams & { targetStudentId?: string }
  ): Promise<{ message: string; verificationStatus: string; studentType: string }> {
    try {
      const body: Record<string, any> = {};
      if (params?.targetStudentId) {
        body.targetStudentId = params.targetStudentId;
      }
      return await enhancedCachedClient.patch(
        `/institute-class-subject-students/claim-free-card/${instituteId}/${classId}/${subjectId}`,
        body,
        {
          userId: params?.userId,
          instituteId,
          classId,
          subjectId
        }
      );
    } catch (error: any) {
      throw new ApiError(error.status || 500, error.response || error);
    }
  },

  // Admin/Teacher updates student type (normal/paid/free_card)
  async updateStudentType(
    instituteId: string,
    classId: string,
    subjectId: string,
    studentId: string,
    studentType: 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid',
    params?: EnrollmentQueryParams
  ): Promise<{ message: string; studentType: string }> {
    try {
      return await enhancedCachedClient.patch(
        `/institute-class-subject-students/student-type/${instituteId}/${classId}/${subjectId}/${studentId}`,
        { studentType },
        {
          userId: params?.userId,
          instituteId,
          classId,
          subjectId,
          role: params?.role
        }
      );
    } catch (error: any) {
      throw new ApiError(error.status || 500, error.response || error);
    }
  },

  // GET class-level enrollment type summary (free_card/paid/normal per student × subject)
  async getClassEnrollmentSummary(
    instituteId: string,
    classId: string,
    filterType?: 'all' | 'free_card' | 'paid' | 'normal' | 'half_paid' | 'quarter_paid',
    params?: EnrollmentQueryParams,
    forceRefresh: boolean = false,
  ): Promise<ClassEnrollmentSummaryItem[]> {
    try {
      const query: Record<string, string> = {};
      if (filterType && filterType !== 'all') query.filterType = filterType;
      return await enhancedCachedClient.get(
        `/institute-class-subject-students/class-enrollment-summary/${instituteId}/${classId}`,
        query,
        { ttl: 60, userId: params?.userId, role: params?.role, instituteId, classId, forceRefresh },
      );
    } catch (error: any) {
      throw new ApiError(error.status || 500, error.response || error);
    }
  },

  // PATCH update student type for ALL subjects in a class (batch free card toggle)
  async updateClassStudentType(
    instituteId: string,
    classId: string,
    studentId: string,
    studentType: 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid',
    params?: EnrollmentQueryParams,
  ): Promise<{ message: string; updatedCount: number; studentType: string }> {
    try {
      return await enhancedCachedClient.patch(
        `/institute-class-subject-students/class-student-type/${instituteId}/${classId}/${studentId}`,
        { studentType },
        { userId: params?.userId, role: params?.role, instituteId, classId },
      );
    } catch (error: any) {
      throw new ApiError(error.status || 500, error.response || error);
    }
  },

  // PATCH update student type at class enrollment level (institute_class_students table)
  async updateClassEnrollmentStudentType(
    instituteId: string,
    classId: string,
    studentId: string,
    studentType: 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid',
    params?: EnrollmentQueryParams,
  ): Promise<{ message: string; studentType: string }> {
    try {
      return await enhancedCachedClient.patch(
        `/institutes/${instituteId}/classes/${classId}/students/student-type/${studentId}`,
        { studentType },
        { userId: params?.userId, role: params?.role, instituteId, classId },
      );
    } catch (error: any) {
      throw new ApiError(error.status || 500, error.response || error);
    }
  },
};