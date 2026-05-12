import { apiClient } from './client';
import { FeaturePermission } from '../contexts/types/auth.types';

export interface InstituteUserType {
  id: number;
  instituteId: number;
  name: string;
  description?: string;
  baseRole: 'INSTITUTE_ADMIN' | 'TEACHER' | 'STUDENT' | 'ATTENDANCE_MARKER' | 'PARENT';
  color?: string;
  icon?: string;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  memberCount?: number;
  permissions?: FeaturePermissionRow[];
}

export interface FeaturePermissionRow {
  featureKey: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canReport: boolean;
}

export interface MyContextResponse {
  userType: InstituteUserType;
  permissions: Record<string, {
    enabled: boolean;
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canReport: boolean;
  }>;
}

export const userTypesApi = {
  list: (instituteId: string) =>
    apiClient.get<InstituteUserType[]>(`/institutes/${instituteId}/user-types`),

  create: (instituteId: string, data: Partial<InstituteUserType>) =>
    apiClient.post<InstituteUserType>(`/institutes/${instituteId}/user-types`, data),

  update: (instituteId: string, typeId: number, data: Partial<InstituteUserType>) =>
    apiClient.patch<InstituteUserType>(`/institutes/${instituteId}/user-types/${typeId}`, data),

  delete: (instituteId: string, typeId: number) =>
    apiClient.delete(`/institutes/${instituteId}/user-types/${typeId}`),

  getPermissions: (instituteId: string, typeId: number) =>
    apiClient.get<FeaturePermissionRow[]>(`/institutes/${instituteId}/user-types/${typeId}/permissions`),

  updatePermissions: (instituteId: string, typeId: number, matrix: FeaturePermissionRow[]) =>
    apiClient.put(`/institutes/${instituteId}/user-types/${typeId}/permissions`, { permissions: matrix }),

  getMyContext: (instituteId: string) =>
    apiClient.get<MyContextResponse>(`/institutes/${instituteId}/my-context`),

  assignType: (instituteId: string, userId: string, typeId: number) =>
    apiClient.patch(`/institutes/${instituteId}/users/${userId}/user-type`, { userTypeId: typeId }),
};
