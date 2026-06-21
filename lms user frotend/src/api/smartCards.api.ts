import { apiClient } from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SmartCardScope = 'GLOBAL' | 'INSTITUTE';
export type SmartCardType = 'BARCODE' | 'QR' | 'RFID' | 'NFC';
export type SmartCardStatus =
  | 'AVAILABLE' | 'ASSIGNED_INSTITUTE' | 'ASSIGNED_CLASS' | 'ASSIGNED_USER' | 'INACTIVE';

export interface SmartCard {
  id: string;
  cardName: string;
  cardId: string;
  cardType: SmartCardType;
  scope: SmartCardScope;
  status: SmartCardStatus;
  instituteId?: string | null;
  classId?: string | null;
  assignedUserId?: string | null;
}

export interface SmartCardScopeCounts {
  total: number;
  available: number;
  assignedToUser: number;
  byStatus: Record<string, number>;
}

export interface InstituteSmartCardCounts {
  GLOBAL: SmartCardScopeCounts;
  INSTITUTE: SmartCardScopeCounts;
}

export interface SearchResult {
  items: SmartCard[];
  total: number;
  page: number;
  limit: number;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const smartCardsApi = {
  /** Institute-admin counts of available/assigned cards by scope (no raw ids). */
  getCounts(instituteId: string): Promise<InstituteSmartCardCounts> {
    return apiClient.get(`/institutes/${instituteId}/smart-cards/counts`);
  },

  /** Search the institute's own card pool by name/id, optionally by scope/status. */
  search(
    instituteId: string,
    params: { scope?: SmartCardScope; status?: SmartCardStatus; search?: string; page?: number; limit?: number },
  ): Promise<SearchResult> {
    return apiClient.get(`/institutes/${instituteId}/smart-cards/search`, params);
  },

  /** Assign one card to a user. Manual = pass cardValue; auto = omit it. */
  assignToUser(
    instituteId: string,
    data: { userId: string; scope: SmartCardScope; cardValue?: string; classId?: string },
  ): Promise<{ success: boolean; message: string; card: SmartCard }> {
    return apiClient.post(`/institutes/${instituteId}/smart-cards/assign-to-user`, data);
  },

  /** Revoke a user's active card of a scope, returning it to the pool. */
  revoke(
    instituteId: string,
    data: { userId: string; scope: SmartCardScope },
  ): Promise<{ revoked: boolean }> {
    return apiClient.patch(`/institutes/${instituteId}/smart-cards/revoke`, data);
  },
};
