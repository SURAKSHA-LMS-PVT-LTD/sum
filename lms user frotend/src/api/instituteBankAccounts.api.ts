import { apiClient } from './client';
import { enhancedCachedClient } from './enhancedCachedClient';

export interface InstituteBankAccount {
  id: string;
  instituteId: string;
  label: string;
  bankName: string;
  branch: string | null;
  accountHolderName: string;
  accountNumber: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankAccountPayload {
  label: string;
  bankName: string;
  branch?: string;
  accountHolderName: string;
  accountNumber: string;
}

export interface UpdateBankAccountPayload {
  label?: string;
  bankName?: string;
  branch?: string | null;
  accountHolderName?: string;
  accountNumber?: string;
  isActive?: boolean;
}

class InstituteBankAccountsApi {
  async list(instituteId: string, includeInactive = false): Promise<InstituteBankAccount[]> {
    const params = includeInactive ? '?all=true' : '';
    return enhancedCachedClient.get(
      `/api/institutes/${instituteId}/bank-accounts${params}`,
      undefined,
      { ttl: 60, instituteId },
    );
  }

  async create(instituteId: string, data: CreateBankAccountPayload): Promise<InstituteBankAccount> {
    return apiClient.post(`/api/institutes/${instituteId}/bank-accounts`, data);
  }

  async update(instituteId: string, id: string, data: UpdateBankAccountPayload): Promise<InstituteBankAccount> {
    return apiClient.patch(`/api/institutes/${instituteId}/bank-accounts/${id}`, data);
  }

  async remove(instituteId: string, id: string): Promise<{ success: boolean }> {
    return apiClient.delete(`/api/institutes/${instituteId}/bank-accounts/${id}`);
  }
}

export const instituteBankAccountsApi = new InstituteBankAccountsApi();
