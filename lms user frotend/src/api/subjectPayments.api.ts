import { apiClient } from './client';
import { enhancedCachedClient } from './enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';

export interface InlineSubjectSubmission {
  id: string;
  paymentId: string;
  submittedAmount: string;
  transactionId?: string;
  paymentDate?: string | null;
  status: 'PENDING' | 'VERIFIED' | 'HALF_VERIFIED' | 'QUARTER_VERIFIED' | 'REJECTED';
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  notes?: string;
  receiptUrl?: string | null;
  receiptFilename?: string;
  uploadedAt?: string | null;
  canResubmit?: boolean;
  daysSinceSubmission?: number | null;
}

export interface SubjectPayment {
  id: string;
  instituteId: string;
  classId: string;
  subjectId: string;
  createdBy: string;
  title: string;
  description: string;
  targetType: 'PARENTS' | 'STUDENTS';
  priority: 'MANDATORY' | 'OPTIONAL' | 'DONATION';
  amount: string;
  documentUrl?: string;
  lastDate: string;
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string;
  bankName?: string;
  accountHolderName?: string;
  accountHolderNumber?: string;
  createdAt: string;
  updatedAt: string;
  submissionsCount: number;
  verifiedSubmissionsCount: number;
  pendingSubmissionsCount: number;
  // Inline submission fields â€” returned by my-payments API
  mySubmissionStatus?: 'PENDING' | 'VERIFIED' | 'HALF_VERIFIED' | 'QUARTER_VERIFIED' | 'REJECTED' | null;
  mySubmissionId?: string | null;
  hasSubmitted?: boolean;
  mySubmissions?: InlineSubjectSubmission[];
}

export interface SubjectPaymentsResponse {
  data: SubjectPayment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SubjectPaymentSubmission {
  id: string;
  paymentId: string;
  userId: string;
  userType: string;
  username: string;
  paymentDate: string;
  receiptUrl: string;
  receiptFilename: string;
  transactionId: string;
  submittedAmount: string;
  status: 'PENDING' | 'VERIFIED' | 'HALF_VERIFIED' | 'QUARTER_VERIFIED' | 'REJECTED';
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  notes?: string;
  uploadedAt: string;
  updatedAt: string;
  // Legacy fields for backward compatibility
  paymentAmount?: number;
  paymentMethod?: string;
  transactionReference?: string;
  receiptFileName?: string;
  receiptFileUrl?: string;
  submitterName?: string;
  verifierName?: string;
  createdAt?: string;
  paymentRemarks?: string;
  lateFeeApplied?: number;
  totalAmountPaid?: number;
  canResubmit?: boolean;
  canDelete?: boolean;
  paymentTitle?: string;
  paymentDescription?: string;
  dueDate?: string;
  priority?: string;
}

export interface SubjectSubmissionsResponse {
  data: SubjectPaymentSubmission[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary?: {
    totalSubmissions: number;
    byStatus: {
      pending: number;
      verified: number;
      rejected: number;
    };
    totalAmountSubmitted: number;
    totalAmountVerified: number;
    totalLateFees: number;
  };
}

export interface SubjectPaymentStatsResponse {
  totalSubmissions: number;
  verifiedSubmissions: number;
  pendingSubmissions: number;
  rejectedSubmissions: number;
  verificationRate: string;
}

export interface SubjectMyStatusResponse {
  hasSubmission: boolean;
  submission?: SubjectPaymentSubmission;
  payment?: SubjectPayment;
}

class SubjectPaymentsApi {
  // Get all subject payments for Admin/Teacher
  async getSubjectPayments(
    instituteId: string, 
    classId: string, 
    subjectId: string,
    page: number = 1,
    limit: number = 50,
    forceRefresh: boolean = false
  ): Promise<SubjectPaymentsResponse> {
    return enhancedCachedClient.get(
      `/institute-class-payments/institute/${instituteId}/class/${classId}`,
      { page, limit, subjectId },
      {
        ttl: CACHE_TTL.SUBJECT_PAYMENTS,
        forceRefresh,
        instituteId,
        classId,
        subjectId
      }
    );
  }

  // Get student's subject payments (studentId: pass child's ID when parent is viewing as child)
  async getMySubjectPayments(
    instituteId: string, 
    classId: string, 
    subjectId: string,
    page: number = 1,
    limit: number = 50,
    forceRefresh: boolean = false,
    studentId?: string
  ): Promise<SubjectPaymentsResponse> {
    return enhancedCachedClient.get(
      `/institute-class-payments/institute/${instituteId}/class/${classId}/my-payments`,
      { page, limit, subjectId, ...(studentId ? { studentId } : {}) },
      {
        ttl: CACHE_TTL.SUBJECT_PAYMENTS,
        forceRefresh,
        instituteId,
        classId,
        subjectId
      }
    );
  }

  // Get payment details
  async getPaymentDetails(
    instituteId: string,
    classId: string,
    subjectId: string,
    paymentId: string
  ): Promise<SubjectPayment> {
    return enhancedCachedClient.get(`/institute-class-payments/payment/${paymentId}`, undefined, {
      ttl: CACHE_TTL.SUBJECT_PAYMENTS,
      instituteId,
    });
  }

  // Create subject payment (admin/teacher)
  async createPayment(
    instituteId: string,
    classId: string,
    subjectId: string,
    data: {
      title: string;
      description?: string;
      targetType: 'STUDENTS' | 'PARENTS';
      priority: 'MANDATORY' | 'OPTIONAL' | 'DONATION';
      amount: number;
      documentUrl?: string;
      lastDate: string;
      notes?: string;
    }
  ): Promise<any> {
    return apiClient.post(`/institute-class-payments/institute/${instituteId}/class/${classId}`, { ...data, subjectId });
  }

  // Update subject payment
  async updatePayment(
    instituteId: string,
    classId: string,
    subjectId: string,
    paymentId: string,
    data: Record<string, any>
  ): Promise<any> {
    return apiClient.patch(`/institute-class-payments/payment/${paymentId}`, data);
  }

  // List payments by class (all subjects)
  async getPaymentsByClass(
    instituteId: string,
    classId: string,
    page: number = 1,
    limit: number = 50,
    forceRefresh: boolean = false
  ): Promise<SubjectPaymentsResponse> {
    return enhancedCachedClient.get(`/institute-class-payments/institute/${instituteId}/class/${classId}`, { page, limit }, {
      ttl: CACHE_TTL.SUBJECT_PAYMENTS,
      forceRefresh,
      instituteId,
      classId,
    });
  }

  // List payments by institute (all classes)
  async getPaymentsByInstitute(
    instituteId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<SubjectPaymentsResponse> {
    return enhancedCachedClient.get(`/institute-class-payments/institute/${instituteId}`, { page, limit }, {
      ttl: CACHE_TTL.SUBJECT_PAYMENTS,
      instituteId,
    });
  }

  // Get enrolled users for a class/subject
  async getEnrolledUsers(
    instituteId: string,
    classId: string,
    subjectId: string,
    forceRefresh: boolean = false
  ): Promise<any> {
    return enhancedCachedClient.get(`/institute-class-payments/institute/${instituteId}/class/${classId}/users`, { subjectId }, {
      ttl: CACHE_TTL.SUBJECT_PAYMENTS,
      forceRefresh,
      instituteId,
      classId,
      subjectId,
    });
  }

  // Get student's subject payment submissions (studentId: pass child's ID when parent is viewing as child)
  async getMySubjectSubmissions(
    instituteId: string, 
    classId: string, 
    subjectId: string,
    page: number = 1,
    limit: number = 10,
    studentId?: string
  ): Promise<SubjectSubmissionsResponse> {
    return enhancedCachedClient.get(`/institute-class-payment-submissions/payment/:paymentId/my-status`, { page, limit, ...(studentId ? { studentId } : {}) }, {
      ttl: CACHE_TTL.PAYMENT_SUBMISSIONS,
      instituteId,
      classId,
      subjectId,
    });
  }

  // Get all submissions for a specific subject payment (admin/teacher)
  async getSubjectPaymentSubmissions(
    instituteId: string, 
    classId: string, 
    subjectId: string,
    paymentId: string
  ): Promise<SubjectSubmissionsResponse> {
    return enhancedCachedClient.get(`/institute-class-payment-submissions/payment/${paymentId}/submissions`, undefined, {
      ttl: CACHE_TTL.PAYMENT_SUBMISSIONS,
      instituteId,
    });
  }

  // Get all submissions (admin/teacher) with status filter — uses class-level endpoint
  async getAllSubmissions(
    instituteId: string,
    classId: string,
    subjectId?: string, // kept for backward compat but ignored — class-level doesn't need it
    params?: { page?: number; limit?: number; status?: string }
  ): Promise<SubjectSubmissionsResponse> {
    return enhancedCachedClient.get(`/institute-class-payment-submissions/institute/${instituteId}/class/${classId}/all-submissions`, params, {
      ttl: CACHE_TTL.PAYMENT_SUBMISSIONS,
      instituteId,
      classId,
    });
  }

  // Get submission statistics
  async getSubmissionStats(
    instituteId: string,
    classId: string,
    subjectId: string
  ): Promise<SubjectPaymentStatsResponse> {
    return enhancedCachedClient.get(`/institute-class-payment-submissions/institute/${instituteId}/class/${classId}/stats`, undefined, {
      ttl: CACHE_TTL.PAYMENT_SUBMISSIONS,
      instituteId,
      classId,
      subjectId,
    });
  }

  // Get payment submissions by payment ID only
  async getPaymentSubmissions(
    paymentId: string, 
    page: number = 1, 
    limit: number = 50
  ): Promise<SubjectSubmissionsResponse> {
    return enhancedCachedClient.get(`/institute-class-payment-submissions/payment/${paymentId}/submissions`, { page, limit }, {
      ttl: CACHE_TTL.PAYMENT_SUBMISSIONS,
    });
  }

  // Check my submission status for a payment
  async getMySubmissionStatus(paymentId: string): Promise<SubjectMyStatusResponse> {
    return enhancedCachedClient.get(`/institute-class-payment-submissions/payment/${paymentId}/my-status`, undefined, {
      ttl: CACHE_TTL.PAYMENT_SUBMISSIONS,
    });
  }

  // Verify payment submission (admin/teacher)
  async verifyPaymentSubmission(submissionId: string, data: {
    status: 'VERIFIED' | 'REJECTED';
    rejectionReason?: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string }> {
    return apiClient.patch(`/institute-class-payment-submissions/submission/${submissionId}/verify`, data);
  }

  // Submit payment (student/parent)
  async submitPayment(paymentId: string, data: {
    paymentDate: string;
    submittedAmount: number;
    transactionId?: string;
    notes?: string;
    receiptUrl: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      submissionId: string;
      status: string;
    };
  }> {
    return apiClient.post(`/institute-class-payment-submissions/payment/${paymentId}/submit`, data);
  }

  // Get submission details
  async getSubmissionDetails(submissionId: string): Promise<any> {
    return enhancedCachedClient.get(`/institute-class-payment-submissions/submission/${submissionId}`, undefined, {
      ttl: CACHE_TTL.PAYMENT_SUBMISSIONS,
    });
  }

  // Delete submission (student/parent - pending only)
  async deleteSubmission(submissionId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.patch(`/institute-class-payment-submissions/submission/${submissionId}/delete`, {});
  }

  // Soft delete a subject payment (admin/teacher, blocked if submissions exist)
  async deletePayment(paymentId: string): Promise<any> {
    return apiClient.delete(`/institute-class-payments/payment/${paymentId}`);
  }

  // Admin: collect/record a physical payment for a student directly
  async adminVerifyStudentCspPayment(
    paymentId: string,
    studentId: string,
    data: {
      amount: number;
      date: string;
      notes?: string;
      paymentTier?: 'full' | 'half' | 'quarter';
      targetAccountId?: string;
      commissionPctOverride?: number;
    }
  ): Promise<any> {
    return apiClient.post(
      `/institute-class-payment-submissions/payment/${paymentId}/student/${studentId}/admin-verify`,
      data
    );
  }

  // Get all students with payment status for a specific payment (admin/teacher)
  async getStudentsForPayment(paymentId: string, page = 1, limit = 200, forceRefresh = false): Promise<any> {
    return enhancedCachedClient.get(
      `/institute-class-payment-submissions/payment/${paymentId}/users/STUDENT`,
      { page, limit },
      { ttl: CACHE_TTL.PAYMENT_SUBMISSIONS, forceRefresh }
    );
  }
}

export const subjectPaymentsApi = new SubjectPaymentsApi();