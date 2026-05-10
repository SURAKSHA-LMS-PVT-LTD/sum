// src/services/notificationApiService.ts
import { apiClient } from '../api/client';

export interface Notification {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  icon?: string | null;
  actionUrl?: string | null;
  dataPayload?: any | null;
  scope: 'GLOBAL' | 'INSTITUTE' | 'CLASS' | 'SUBJECT';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  senderRole?: string;
  isRead: boolean;
  sentAt?: string;
  createdAt?: string;
  senderName?: string;
  targetClassName?: string;
  targetSubjectName?: string;
}

export interface PaginatedNotifications {
  data: Notification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount?: number;
}

export interface UnreadCount {
  unreadCount: number;
  totalCount: number;
}

class NotificationApiService {
  
  /**
   * Get SYSTEM/GLOBAL notifications only
   * Call this when user has NOT selected any institute
   */
  async getSystemNotifications(
    options?: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
    }
  ): Promise<PaginatedNotifications> {
    const params: Record<string, any> = {};
    if (options?.page) params.page = options.page;
    if (options?.limit) params.limit = options.limit;
    if (options?.unreadOnly) params.unreadOnly = true;

    return apiClient.get<PaginatedNotifications>('/push-notifications/system', params);
  }

  /**
   * Get unread count for system notifications
   */
  async getSystemUnreadCount(): Promise<UnreadCount> {
    return apiClient.get<UnreadCount>('/push-notifications/system/unread-count');
  }

  /**
   * Get notifications for a specific institute
   * Call this when user has selected an institute
   * Includes: INSTITUTE, CLASS, SUBJECT scope notifications
   */
  async getInstituteNotifications(
    instituteId: string,
    options?: {
      page?: number;
      limit?: number;
      unreadOnly?: boolean;
      scope?: 'INSTITUTE' | 'CLASS' | 'SUBJECT';
      classId?: string;
      subjectId?: string;
    }
  ): Promise<PaginatedNotifications> {
    const params: Record<string, any> = {};
    if (options?.page) params.page = options.page;
    if (options?.limit) params.limit = options.limit;
    if (options?.unreadOnly) params.unreadOnly = true;
    if (options?.scope) params.scope = options.scope;
    if (options?.classId) params.classId = options.classId;
    if (options?.subjectId) params.subjectId = options.subjectId;

    return apiClient.get<PaginatedNotifications>(
      `/push-notifications/institute/${instituteId}`,
      params
    );
  }

  /**
   * Get unread count for institute notifications
   */
  async getInstituteUnreadCount(instituteId: string): Promise<UnreadCount> {
    return apiClient.get<UnreadCount>(
      `/push-notifications/institute/${instituteId}/unread-count`
    );
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    return apiClient.post(`/push-notifications/${notificationId}/read`);
  }

  /**
   * Mark multiple notifications as read
   */
  async markMultipleAsRead(
    notificationIds: string[]
  ): Promise<{ message: string; count: number }> {
    return apiClient.post('/push-notifications/mark-read', { notificationIds });
  }

  /**
   * Mark all notifications as read for an institute
   */
  async markAllAsRead(instituteId: string): Promise<void> {
    return apiClient.post(`/push-notifications/institute/${instituteId}/mark-all-read`);
  }

  /**
   * Mark all system notifications as read
   */
  async markAllSystemAsRead(): Promise<void> {
    return apiClient.post('/push-notifications/system/mark-all-read');
  }

  // ─── Unified Inbox (All Notifications) ───

  /**
   * GET /push-notifications/my — Unified inbox across all scopes
   */
  async getMyNotifications(
    options?: {
      page?: number;
      limit?: number;
      isRead?: boolean;
      scope?: 'GLOBAL' | 'INSTITUTE' | 'CLASS' | 'SUBJECT';
      instituteId?: string;
      search?: string;
    }
  ): Promise<PaginatedNotifications> {
    const params: Record<string, any> = {};
    if (options?.page) params.page = options.page;
    if (options?.limit) params.limit = options.limit;
    if (options?.isRead !== undefined) params.isRead = options.isRead;
    if (options?.scope) params.scope = options.scope;
    if (options?.instituteId) params.instituteId = options.instituteId;
    if (options?.search) params.search = options.search;

    return apiClient.get<PaginatedNotifications>('/push-notifications/my', params);
  }

  /**
   * GET /push-notifications/my/unread-count — Total unread across all scopes
   */
  async getMyUnreadCount(): Promise<UnreadCount> {
    return apiClient.get<UnreadCount>('/push-notifications/my/unread-count');
  }

  /**
   * POST /push-notifications/my/mark-all-read — Mark all read across all scopes
   */
  async markAllMyNotificationsAsRead(): Promise<{ success: boolean; updatedCount: number }> {
    return apiClient.post('/push-notifications/my/mark-all-read');
  }
}

export const notificationApiService = new NotificationApiService();
