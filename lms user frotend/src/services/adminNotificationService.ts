// src/services/adminNotificationService.ts
import { apiClient } from '../api/client';

export enum NotificationScope {
  GLOBAL = 'GLOBAL',
  INSTITUTE = 'INSTITUTE',
  CLASS = 'CLASS',
  SUBJECT = 'SUBJECT'
}

export enum NotificationTargetUserType {
  ALL = 'ALL',
  STUDENTS = 'STUDENTS',
  PARENTS = 'PARENTS',
  TEACHERS = 'TEACHERS',
  ADMINS = 'ADMINS'
}

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export interface CreateNotificationPayload {
  title: string;
  body: string;
  imageUrl?: string;
  icon?: string;
  actionUrl?: string;
  dataPayload?: Record<string, string>;
  scope: NotificationScope;
  targetUserTypes: NotificationTargetUserType[];
  instituteId?: string;
  classId?: string;
  subjectId?: string;
  priority?: NotificationPriority;
  collapseKey?: string;
  timeToLive?: number;
  scheduledAt?: string;
  sendImmediately?: boolean;
}

export interface NotificationResult {
  id: string;
  title: string;
  body: string;
  scope: NotificationScope;
  status: 'DRAFT' | 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  recipientCount: number;
  successCount: number;
  failureCount: number;
  createdAt: string;
  sentAt?: string;
  scheduledAt?: string;
  priority: NotificationPriority;
}

export interface PaginatedNotificationResults {
  data: NotificationResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class AdminNotificationService {
  /**
   * Create and send a new push notification
   * @access SUPERADMIN, Institute Admin, Teacher
   */
  async createNotification(payload: CreateNotificationPayload): Promise<NotificationResult> {
    return apiClient.post<NotificationResult>('/push-notifications/admin', payload);
  }

  /**
   * Get all notifications created by admin (for management)
   */
  async getAdminNotifications(options?: {
    page?: number;
    limit?: number;
    scope?: NotificationScope;
    status?: string;
    instituteId?: string;
  }): Promise<PaginatedNotificationResults> {
    const params: Record<string, any> = {};
    if (options?.page) params.page = options.page;
    if (options?.limit) params.limit = options.limit;
    if (options?.scope) params.scope = options.scope;
    if (options?.status) params.status = options.status;
    if (options?.instituteId) params.instituteId = options.instituteId;

    return apiClient.get<PaginatedNotificationResults>('/push-notifications/admin', params);
  }

  /**
   * Get notification details
   */
  async getNotificationDetails(notificationId: string): Promise<NotificationResult> {
    return apiClient.get<NotificationResult>(`/push-notifications/admin/${notificationId}`);
  }

  /**
   * Send a draft notification
   */
  async sendNotification(notificationId: string): Promise<NotificationResult> {
    return apiClient.post<NotificationResult>(`/push-notifications/admin/${notificationId}/send`);
  }

  /**
   * Resend a failed notification
   */
  async resendNotification(notificationId: string): Promise<NotificationResult> {
    return apiClient.post<NotificationResult>(`/push-notifications/admin/${notificationId}/resend`);
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(notificationId: string): Promise<void> {
    return apiClient.put(`/push-notifications/admin/${notificationId}/cancel`);
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    return apiClient.delete(`/push-notifications/admin/${notificationId}`);
  }
}

export const adminNotificationService = new AdminNotificationService();
