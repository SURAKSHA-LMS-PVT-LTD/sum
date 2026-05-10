import { enhancedCachedClient } from './enhancedCachedClient';

const BASE = (instituteId: string) => `/v2/auth/institute/admin/${instituteId}`;

export interface InstituteSession {
  id: string;
  userId: string;
  userIdByInstitute: string;
  deviceLabel: string | null;
  ipAddress: string | null;
  loginMethod: string;
  scopeHost: string | null;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
  maxDevicesPerUser: number | null;
}

export interface SessionListResponse {
  data: InstituteSession[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export const instituteSessionApi = {
  listSessions: (
    instituteId: string,
    params?: { userId?: string; page?: number; limit?: number },
  ) =>
    enhancedCachedClient.get<SessionListResponse>(
      `${BASE(instituteId)}/sessions`,
      params ?? {},
      { ttl: 0, userId: instituteId, role: 'admin' },
    ),

  revokeSession: (instituteId: string, sessionId: string) =>
    enhancedCachedClient.delete(`${BASE(instituteId)}/sessions/${sessionId}`, {}),

  revokeAllForUser: (instituteId: string, userId: string) =>
    enhancedCachedClient.delete(`${BASE(instituteId)}/users/${userId}/sessions`, {}),

  setDeviceLimit: (instituteId: string, userId: string, maxDevices: number | null) =>
    enhancedCachedClient.put(
      `/v2/auth/institute/admin/${instituteId}/users/${userId}/device-limit`,
      { maxDevices },
    ),

  bulkSetDeviceLimit: (
    instituteId: string,
    userIds: string[],
    maxDevices: number | null,
  ) =>
    enhancedCachedClient.post(
      `/v2/auth/institute/admin/${instituteId}/users/bulk-device-limit`,
      { userIds, maxDevices },
    ),
};
