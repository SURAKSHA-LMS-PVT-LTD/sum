import { getBaseUrl, getApiHeadersAsync, getCredentialsMode } from '@/contexts/utils/auth.api';
import { parseApiError } from '@/api/apiError';

// ── Types ──────────────────────────────────────────────────────────────────────

export type AccountType = 'CASH' | 'BANK';
export type CategoryType = 'INCOME' | 'EXPENSE';
export type LedgerEntryType = 'CREDIT' | 'DEBIT';
export type LedgerTxSource =
  | 'PAYMENT_APPROVAL'
  | 'PHYSICAL_COLLECT'
  | 'FUND_TRANSFER'
  | 'TEACHER_PAYOUT'
  | 'TEACHER_DEDUCTION'
  | 'TEACHER_ADVANCE'
  | 'TEACHER_TOPUP'
  | 'MANUAL';

export interface FinanceAccount {
  id: string;
  instituteId: string;
  name: string;
  type: AccountType;
  currentBalance: string;
  bankName?: string;
  accountNumber?: string;
  isActive: boolean;
  createdAt: string;
}

export interface FinanceCategory {
  id: string;
  instituteId: string;
  name: string;
  type: CategoryType;
  description?: string;
  isActive: boolean;
}

export interface LedgerEntry {
  id: string;
  amount: string;
  type: LedgerEntryType;
  txSource: LedgerTxSource;
  fromAccountId?: string;
  toAccountId?: string;
  categoryId?: string;
  teacherId?: string;
  teacherAmount?: string;
  instituteAmount?: string;
  commissionPct?: string;
  referenceId?: string;
  studentId?: string;
  studentName?: string;
  description?: string;
  adminNote?: string;
  createdByUserId: string;
  createdByName?: string;
  createdAt: string;
  toAccount?: { id: string; name: string; type: AccountType };
  fromAccount?: { id: string; name: string; type: AccountType };
  category?: { id: string; name: string; type: CategoryType };
}

export interface TeacherWallet {
  id: string;
  teacherId: string;
  instituteId: string;
  balance: string;
  totalEarned: string;
  totalDeductions: string;
  totalPaidOut: string;
  updatedAt: string;
}

export interface FinanceSummary {
  totalBalance: string;
  cashBalance: string;
  bankBalance: string;
  accounts: FinanceAccount[];
}

export interface LedgerPage {
  data: LedgerEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AnalyticsRow {
  period: string;
  income: string;
  expense: string;
}

export interface AnalyticsResult {
  period: string;
  data: AnalyticsRow[];
  bySource?: { source: string; income: string; expense: string }[];
  summary: { totalIncome: string; totalExpense: string; net: string };
}

export interface TeacherWalletSummary {
  teacherId: string;
  teacherName?: string;
  teacherEmail?: string;
  teacherImageUrl?: string;
  instituteUserId?: string;
  // wallet fields — null if wallet not yet initialised
  walletId?: string | null;
  balance?: string | null;
  totalEarned?: string | null;
  totalDeductions?: string | null;
  totalPaidOut?: string | null;
}

export interface CategoryAnalyticsRow {
  category: string | null;
  categoryType: 'INCOME' | 'EXPENSE' | null;
  total: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function request<T>(method: string, path: string, body?: any, params?: Record<string, any>): Promise<T> {
  const baseUrl = getBaseUrl();
  const headers = await getApiHeadersAsync();
  const url = new URL(`${baseUrl}/api/finance${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, String(v)));
  const res = await fetch(url.toString(), {
    method,
    headers: { ...headers, 'Content-Type': 'application/json' },
    credentials: getCredentialsMode(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data && (data.message || data.error)) || `Finance API error ${res.status}`);
  return data as T;
}

// ── API Functions ──────────────────────────────────────────────────────────────

export const financeApi = {
  // Summary
  getSummary: () => request<FinanceSummary>('GET', '/summary'),

  // Accounts
  getAccounts: () => request<FinanceAccount[]>('GET', '/accounts'),
  createAccount: (dto: { name: string; type: AccountType; bankName?: string; accountNumber?: string }) =>
    request<FinanceAccount>('POST', '/accounts', dto),
  updateAccount: (id: string, dto: Partial<{ name: string; bankName: string; accountNumber: string; isActive: boolean }>) =>
    request<FinanceAccount>('PATCH', `/accounts/${id}`, dto),

  // Categories
  getCategories: () => request<FinanceCategory[]>('GET', '/categories'),
  createCategory: (dto: { name: string; type: CategoryType; description?: string }) =>
    request<FinanceCategory>('POST', '/categories', dto),
  updateCategory: (id: string, dto: Partial<{ name: string; description: string; isActive: boolean }>) =>
    request<FinanceCategory>('PATCH', `/categories/${id}`, dto),

  // Physical collection
  collectPhysical: (dto: {
    studentId: string;
    studentName?: string;
    classId: string;
    amount: number;
    targetAccountId: string;
    categoryId?: string;
    description?: string;
    adminNote?: string;
  }) => request<void>('POST', '/collect', dto),

  // Settle funds
  settleFunds: (dto: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
    adminNote?: string;
  }) => request<void>('POST', '/settle', dto),

  // Payout
  payoutTeacher: (dto: {
    teacherId: string;
    amount: number;
    fromAccountId: string;
    description?: string;
    adminNote?: string;
  }) => request<void>('POST', '/payout', dto),

  // Deduction
  deductTeacher: (dto: {
    teacherId: string;
    amount: number;
    toAccountId?: string;
    categoryId?: string;
    adminNote: string;
  }) => request<void>('POST', '/deduct', dto),

  // Ledger
  getLedger: (params?: {
    startDate?: string;
    endDate?: string;
    createdByUserId?: string;
    teacherId?: string;
    accountId?: string;
    categoryId?: string;
    type?: 'CREDIT' | 'DEBIT';
    page?: number;
    limit?: number;
  }) => request<LedgerPage>('GET', '/ledger', undefined, params),

  // Analytics
  getAnalytics: (params?: { period?: 'daily' | 'weekly' | 'monthly' | 'yearly'; startDate?: string; endDate?: string }) =>
    request<AnalyticsResult>('GET', '/analytics', undefined, params),

  // Teacher wallet (self)
  getMyWallet: () => request<TeacherWallet | null>('GET', '/teacher/wallet'),
  getMyLedger: (params?: { page?: number; limit?: number; startDate?: string; endDate?: string }) =>
    request<LedgerPage>('GET', '/teacher/ledger', undefined, params),

  // Teacher wallet (admin)
  getTeacherWallet: (teacherId: string) => request<TeacherWallet | null>('GET', `/teacher/${teacherId}/wallet`),
  getTeacherLedger: (teacherId: string, params?: { page?: number; limit?: number; startDate?: string; endDate?: string }) =>
    request<LedgerPage>('GET', `/teacher/${teacherId}/ledger`, undefined, params),

  // Teachers summary (all teachers in institute with optional wallet)
  getTeachersSummary: () => request<{ data: TeacherWalletSummary[]; total: number }>('GET', '/teachers/summary'),

  // Initialize teacher wallet
  initTeacherWallet: (teacherId: string) => request<TeacherWallet>('POST', `/teacher/${teacherId}/init-wallet`),

  // Teacher advance
  giveTeacherAdvance: (dto: { teacherId: string; amount: number; fromAccountId: string; description: string; adminNote?: string }) =>
    request<void>('POST', '/advance', dto),

  // Teacher wallet top-up (manual credit by admin)
  topupTeacherWallet: (dto: { teacherId: string; amount: number; fromAccountId: string; description: string; adminNote?: string }) =>
    request<void>('POST', '/topup', dto),

  // Manual record
  addManualRecord: (dto: {
    recordType: 'INCOME' | 'EXPENSE';
    amount: number;
    categoryId?: string;
    accountId: string;
    description: string;
    adminNote?: string;
    recordDate?: string;
  }) => request<void>('POST', '/manual', dto),

  // Category analytics
  getAnalyticsByCategory: (params?: { startDate?: string; endDate?: string }) =>
    request<{ data: CategoryAnalyticsRow[] }>('GET', '/analytics/categories', undefined, params),
};
