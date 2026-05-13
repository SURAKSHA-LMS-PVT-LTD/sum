import { apiClient } from './client';
import { enhancedCachedClient } from './enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';

export interface InlineClassSubmission {
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

export interface ClassPayment {
  id: string;
  instituteId: string;
  classId: string;
  createdBy?: string;
  title: string;
  description: string;
  targetType: 'PARENTS' | 'STUDENTS' | 'BOTH';
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
  // Inline fields from my-payments
  mySubmissionStatus?: 'PENDING' | 'VERIFIED' | 'HALF_VERIFIED' | 'QUARTER_VERIFIED' | 'REJECTED' | null;
  mySubmissionId?: string | null;
  hasSubmitted?: boolean;
  mySubmissions?: InlineClassSubmission[];
}

export interface ClassPaymentsResponse {
  data: ClassPayment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ClassPaymentSubmission {
  id: string;
  paymentId: string;
  userId: string;
  userType: string;
  username: string;
  paymentDate: string;
  receiptUrl: string;
  receiptFilename: string;
  transactionId?: string;
  submittedAmount: string;
  status: 'PENDING' | 'VERIFIED' | 'HALF_VERIFIED' | 'QUARTER_VERIFIED' | 'REJECTED';
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  notes?: string;
  uploadedAt: string;
  updatedAt: string;
  canResubmit?: boolean;
}

export interface ClassSubmissionsResponse {
  data: ClassPaymentSubmission[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ClassPaymentStatsResponse {
  totalSubmissions: number;
  verifiedSubmissions: number;
  pendingSubmissions: number;
  rejectedSubmissions: number;
  verificationRate: string;
}

// ── My Class Payment Submission (for student viewing their submissions) ────
export interface MyClassPaymentSubmission {
  id: string;
  paymentId: string;
  paymentType: string;
  description: string;
  priority: 'MANDATORY' | 'OPTIONAL' | 'DONATION';
  paymentAmount: number;
  dueDate: string;
  paymentMethod?: string;
  transactionReference?: string;
  paymentDate: string;
  status: 'PENDING' | 'VERIFIED' | 'HALF_VERIFIED' | 'QUARTER_VERIFIED' | 'REJECTED';
  verifiedAt: string | null;
  rejectionReason: string | null;
  lateFeeApplied: number;
  totalAmountPaid: number;
  receiptFileName: string;
  receiptFileUrl: string;
  receiptFileSize?: number;
  receiptFileType?: string;
  paymentRemarks?: string | null;
  createdAt: string;
  canResubmit: boolean;
  canDelete?: boolean;
  daysSinceSubmission: number | null;
}

export interface MyClassSubmissionsResponse {
  success?: boolean;
  message?: string;
  data: {
    submissions: MyClassPaymentSubmission[];
    pagination?: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
    total?: number;
    summary?: {
      totalSubmissions: number;
      byStatus: {
        pending: number;
        verified: number;
        rejected: number;
      };
      totalAmountSubmitted?: number;
      totalAmountVerified?: number;
      totalLateFees?: number;
    };
  };
}

// ── Student Payment Details (for admin collecting physical payments) ────────
export interface StudentPaymentDetail {
  // Student info
  studentId: string;
  studentUuid: string;
  studentName: string;
  nameWithInitials: string;
  image?: string;
  instituteUserId: string;
  phone?: string;
  email?: string;
  
  // Payment details
  paymentId: string;
  paymentTitle: string;
  paymentAmount: string;
  paymentDueDate: string;
  
  // Submission status
  submissionId?: string;
  submissionStatus?: 'PENDING' | 'VERIFIED' | 'HALF_VERIFIED' | 'QUARTER_VERIFIED' | 'REJECTED' | null;
  submittedAmount?: string;
  submittedDate?: string;
  receiptUrl?: string;
  receiptFilename?: string;
  transactionId?: string;
  rejectionReason?: string;
  notes?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  canResubmit?: boolean;
}

export interface StudentPaymentDetailsResponse {
  data: StudentPaymentDetail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary?: {
    totalStudents: number;
    verified: number;
    halfVerified: number;
    quarterVerified: number;
    pending: number;
    rejected: number;
    totalVerifiedAmount: string;
  };
}

// ── Class Payment Submission Response ──────────────────────────────────────
export interface ClassPaymentSubmissionDetail {
  id: string;
  paymentId: string;
  studentId: string;
  studentUuid: string;
  studentName: string;
  nameWithInitials: string;
  image?: string;
  paymentDate: string;
  receiptUrl: string;
  receiptFilename: string;
  transactionId?: string;
  submittedAmount: string;
  status: 'PENDING' | 'VERIFIED' | 'HALF_VERIFIED' | 'QUARTER_VERIFIED' | 'REJECTED';
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  notes?: string;
  uploadedAt: string;
  updatedAt: string;
  canResubmit?: boolean;
}

export interface ClassPaymentSubmissionsDetailResponse {
  data: ClassPaymentSubmissionDetail[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class ClassPaymentsApi {
  async getClassPayments(
    instituteId: string,
    classId: string,
    page: number = 1,
    limit: number = 50,
    forceRefresh: boolean = false,
  ): Promise<ClassPaymentsResponse> {
    return enhancedCachedClient.get(
      `/institute-class-payments/institute/${instituteId}/class/${classId}`,
      { page, limit },
      { ttl: CACHE_TTL.SUBJECT_PAYMENTS, forceRefresh, instituteId, classId },
    );
  }

  async getMyClassPayments(
    instituteId: string,
    classId: string,
    page: number = 1,
    limit: number = 50,
    forceRefresh: boolean = false,
  ): Promise<ClassPaymentsResponse> {
    return enhancedCachedClient.get(
      `/institute-class-payments/institute/${instituteId}/class/${classId}/my-payments`,
      { page, limit },
      { ttl: CACHE_TTL.SUBJECT_PAYMENTS, forceRefresh, instituteId, classId },
    );
  }

  async getPaymentById(paymentId: string): Promise<ClassPayment> {
    return enhancedCachedClient.get(`/institute-class-payments/payment/${paymentId}`, undefined, {
      ttl: CACHE_TTL.SUBJECT_PAYMENTS,
    });
  }

  async createPayment(
    instituteId: string,
    classId: string,
    data: {
      title: string;
      description?: string;
      targetType: 'STUDENTS' | 'PARENTS' | 'BOTH';
      priority: 'MANDATORY' | 'OPTIONAL' | 'DONATION';
      amount: number;
      teacherCommissionPct?: number;
      documentUrl?: string;
      lastDate: string;
      notes?: string;
      bankName: string;
      accountHolderName: string;
      accountHolderNumber: string;
    },
  ): Promise<any> {
    return apiClient.post(`/institute-class-payments/institute/${instituteId}/class/${classId}`, data);
  }

  async updatePayment(paymentId: string, data: Record<string, any>): Promise<any> {
    return apiClient.patch(`/institute-class-payments/payment/${paymentId}`, data);
  }

  async deletePayment(paymentId: string): Promise<any> {
    return apiClient.delete(`/institute-class-payments/payment/${paymentId}`);
  }

  async submitPayment(
    paymentId: string,
    data: { paymentDate: string; submittedAmount: number; transactionId?: string; notes?: string; receiptUrl: string; },
  ): Promise<{ success: boolean; message: string; data: { submissionId: string; status: string; }; }> {
    return apiClient.post(`/institute-class-payment-submissions/payment/${paymentId}/submit`, data);
  }

  async verifyPaymentSubmission(
    submissionId: string,
    data: { status: 'VERIFIED' | 'REJECTED'; rejectionReason?: string; notes?: string; },
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.patch(`/institute-class-payment-submissions/submission/${submissionId}/verify`, data);
  }

  async getPaymentSubmissions(paymentId: string, page = 1, limit = 50): Promise<ClassSubmissionsResponse> {
    return enhancedCachedClient.get(
      `/institute-class-payment-submissions/payment/${paymentId}/submissions`,
      { page, limit },
      { ttl: CACHE_TTL.PAYMENT_SUBMISSIONS },
    );
  }

  async getMySubmissionStatus(paymentId: string): Promise<any> {
    return enhancedCachedClient.get(
      `/institute-class-payment-submissions/payment/${paymentId}/my-status`,
      undefined,
      { ttl: CACHE_TTL.PAYMENT_SUBMISSIONS },
    );
  }

  async deleteSubmission(submissionId: string): Promise<{ success: boolean; message: string }> {
    return apiClient.patch(`/institute-class-payment-submissions/submission/${submissionId}/delete`, {});
  }

  async getAllSubmissions(
    instituteId: string,
    classId: string,
    params?: { page?: number; limit?: number; status?: string },
  ): Promise<ClassSubmissionsResponse> {
    return enhancedCachedClient.get(
      `/institute-class-payment-submissions/institute/${instituteId}/class/${classId}/all-submissions`,
      params,
      { ttl: CACHE_TTL.PAYMENT_SUBMISSIONS, instituteId, classId },
    );
  }

  async getSubmissionStats(instituteId: string, classId: string): Promise<ClassPaymentStatsResponse> {
    return enhancedCachedClient.get(
      `/institute-class-payment-submissions/institute/${instituteId}/class/${classId}/stats`,
      undefined,
      { ttl: CACHE_TTL.PAYMENT_SUBMISSIONS, instituteId, classId },
    );
  }

  async getStudentsForPayment(
    instituteId: string,
    classId: string,
    paymentId: string,
    page = 1,
    limit = 200,
  ): Promise<any> {
    return enhancedCachedClient.get(
      `/institute-class-payment-submissions/institute/${instituteId}/class/${classId}/payment/${paymentId}/users/STUDENT`,
      { page, limit },
      { ttl: CACHE_TTL.PAYMENT_SUBMISSIONS },
    );
  }

  async adminVerifyStudentClassPayment(
    paymentId: string,
    studentId: string,
    data: { amount: number; date: string; notes?: string; paymentTier?: 'full' | 'half' | 'quarter'; targetAccountId?: string; commissionPctOverride?: number; },
  ): Promise<any> {
    return apiClient.post(
      `/institute-class-payment-submissions/payment/${paymentId}/student/${studentId}/admin-verify`,
      data,
    );
  }

  // Get student submissions for a class (for physical payment collection)
  async getStudentClassSubmissions(
    instituteId: string,
    classId: string,
    studentId: string,
    params?: { page?: number; limit?: number },
  ): Promise<ClassSubmissionsResponse> {
    return enhancedCachedClient.get(
      `/institute-class-payment-submissions/institute/${instituteId}/class/${classId}/student/${studentId}/submissions`,
      params,
      { ttl: CACHE_TTL.PAYMENT_SUBMISSIONS, instituteId, classId },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── Institute Class Payment Submissions APIs ───────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  // Get all submissions for a specific payment (admin/teacher collecting)
  async getClassPaymentSubmissions(
    instituteId: string,
    classId: string,
    paymentId: string,
    params?: { page?: number; limit?: number; status?: string },
  ): Promise<ClassPaymentSubmissionsDetailResponse> {
    return enhancedCachedClient.get(
      `/institute-class-payment-submissions/institute/${instituteId}/class/${classId}/payment/${paymentId}/submissions`,
      params,
      { ttl: CACHE_TTL.PAYMENT_SUBMISSIONS, instituteId, classId },
    );
  }

  // Get all students for a payment with their submission details
  async getStudentsForPaymentWithDetails(
    instituteId: string,
    classId: string,
    paymentId: string,
    params?: { page?: number; limit?: number },
    forceRefresh: boolean = false,
  ): Promise<StudentPaymentDetailsResponse> {
    return enhancedCachedClient.get(
      `/institute-class-payment-submissions/institute/${instituteId}/class/${classId}/payment/${paymentId}/students-details`,
      params,
      { ttl: CACHE_TTL.PAYMENT_SUBMISSIONS, instituteId, classId, forceRefresh },
    );
  }

  // Submit a class payment (student/parent submitting with file upload)
  async submitClassPayment(
    instituteId: string,
    classId: string,
    paymentId: string,
    data: {
      paymentDate: string;
      submittedAmount: number;
      transactionId?: string;
      notes?: string;
      receiptFile?: File;
    },
  ): Promise<{ success: boolean; message: string; data: { submissionId: string; status: string } }> {
    const formData = new FormData();
    formData.append('paymentDate', data.paymentDate);
    formData.append('submittedAmount', String(data.submittedAmount));
    if (data.transactionId) formData.append('transactionId', data.transactionId);
    if (data.notes) formData.append('notes', data.notes);
    if (data.receiptFile) formData.append('receiptFile', data.receiptFile);

    return apiClient.post(
      `/institute-class-payment-submissions/institute/${instituteId}/class/${classId}/payment/${paymentId}/submit`,
      formData,
    );
  }

  // Verify a class payment submission (admin/teacher)
  async verifyClassPaymentSubmission(
    instituteId: string,
    classId: string,
    submissionId: string,
    data: {
      status: 'VERIFIED' | 'HALF_VERIFIED' | 'QUARTER_VERIFIED';
      notes?: string;
    },
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.patch(
      `/institute-class-payment-submissions/institute/${instituteId}/class/${classId}/submission/${submissionId}/verify`,
      data,
    );
  }

  // Reject a class payment submission (admin/teacher)
  async rejectClassPaymentSubmission(
    instituteId: string,
    classId: string,
    submissionId: string,
    data: {
      rejectionReason: string;
      notes?: string;
    },
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.patch(
      `/institute-class-payment-submissions/institute/${instituteId}/class/${classId}/submission/${submissionId}/reject`,
      data,
    );
  }

  // Get submission details for admin verification
  async getSubmissionDetailForVerification(
    instituteId: string,
    classId: string,
    submissionId: string,
  ): Promise<ClassPaymentSubmissionDetail> {
    return enhancedCachedClient.get(
      `/institute-class-payment-submissions/institute/${instituteId}/class/${classId}/submission/${submissionId}`,
      undefined,
      { ttl: CACHE_TTL.PAYMENT_SUBMISSIONS, instituteId, classId },
    );
  }

  // Get my (current user's) submissions for a specific class
  async getMyClassSubmissions(
    instituteId: string,
    classId: string,
    forceRefresh: boolean = false,
  ): Promise<any> {
    return enhancedCachedClient.get(
      `/institute-class-payment-submissions/institute/${instituteId}/class/${classId}/my-submissions`,
      undefined,
      { ttl: CACHE_TTL.PAYMENT_SUBMISSIONS, forceRefresh, instituteId, classId },
    );
  }
}

export const classPaymentsApi = new ClassPaymentsApi();
