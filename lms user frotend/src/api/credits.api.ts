import { apiClient } from './client';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface CreditBalance {
  instituteId: string;
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  dailyUsed: number;
  monthlyUsed: number;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  isActive: boolean;
}

export interface CreditTransaction {
  id: string;
  instituteId: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CreditTransactionList {
  data: CreditTransaction[];
  total: number;
  page: number;
  limit: number;
}

export interface TopUpSubmission {
  id: string;
  instituteId: string;
  serviceType: string;
  serviceDescription: string | null;
  billingMonth: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentReference: string | null;
  paymentSlipUrl: string | null;
  requestedQuantity: number | null;
  grantedQuantity: number | null;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  submittedBy: string;
  submittedAt: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
}

export interface TopUpSubmissionList {
  data: TopUpSubmission[];
  total: number;
  page: number;
  limit: number;
}

export interface SubmitTopUpDto {
  serviceType?: 'CREDITS' | 'SMS_CREDITS' | 'EMAIL_CREDITS' | 'WHATSAPP_CREDITS' | 'STORAGE_PURCHASE';
  serviceDescription?: string;
  paymentAmount: number;
  paymentMethod: 'BANK_TRANSFER' | 'ONLINE_PAYMENT' | 'CASH_DEPOSIT';
  paymentReference?: string;
  paymentSlipUrl?: string;
  paymentDate: string;
  notes?: string;
  requestedQuantity: number;
}

// ═══════════════════════════════════════════════════════════════
// API Methods
// ═══════════════════════════════════════════════════════════════

export const creditsApi = {
  /** Get institute credit balance */
  getBalance: (instituteId: string): Promise<CreditBalance> => {
    const query = new URLSearchParams({ instituteId });
    return apiClient.get(`/v2/credits/balance?${query.toString()}`);
  },

  /** Get credit transaction history */
  getTransactions: (
    instituteId: string,
    params?: { type?: string; startDate?: string; endDate?: string; page?: number; limit?: number },
  ): Promise<CreditTransactionList> => {
    const query = new URLSearchParams({ instituteId });
    if (params?.type) query.set('type', params.type);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    return apiClient.get(`/v2/credits/transactions?${query.toString()}`);
  },

  /** Submit a credit top-up request (creates a tenant service payment) */
  submitTopUp: (instituteId: string, dto: SubmitTopUpDto): Promise<TopUpSubmission> => {
    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    const billingMonth = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
    return apiClient.post(`/v2/tenant/institutes/${instituteId}/service-payments`, {
      ...dto,
      serviceType: dto.serviceType || 'CREDITS',
      billingMonth,
    });
  },

  /** Get top-up submission history for the institute */
  getSubmissions: (
    instituteId: string,
    params?: { status?: string; page?: number; limit?: number },
  ): Promise<TopUpSubmissionList> => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiClient.get(`/v2/tenant/institutes/${instituteId}/service-payments${qs ? `?${qs}` : ''}`);
  },

  /** Get a single top-up submission */
  getSubmission: (instituteId: string, paymentId: string): Promise<TopUpSubmission> =>
    apiClient.get(`/v2/tenant/institutes/${instituteId}/service-payments/${paymentId}`),
};
