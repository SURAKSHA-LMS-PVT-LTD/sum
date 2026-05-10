import { apiClient } from '@/api/client';

export interface DeletionStatus {
  hasPendingDeletion: boolean;
  status?: 'PENDING' | 'CANCELLED' | 'COMPLETED';
  scheduledDeletionDate?: string;
  requestedAt?: string;
  reason?: string;
}

export interface DeletionResponse {
  success: boolean;
  message: string;
  scheduledDeletionDate?: string;
}

export const accountDeletionApi = {
  getStatus: async (): Promise<DeletionStatus> => {
    const response = await apiClient.get('/account/deletion-status');
    return response;
  },

  requestDeletion: async (reason?: string): Promise<DeletionResponse> => {
    const response = await apiClient.post('/account/delete', {
      confirmDeletion: true,
      reason: reason || undefined,
    });
    return response;
  },

  cancelDeletion: async (): Promise<DeletionResponse> => {
    const response = await apiClient.post('/account/cancel-deletion');
    return response;
  },
};
