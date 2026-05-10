// =============== PUSH NOTIFICATION ENUMS (Based on Backend API) ===============

// Notification Scope - Determines the reach of the notification
export enum NotificationScope {
  GLOBAL = 'GLOBAL',       // System-wide (SUPERADMIN only)
  INSTITUTE = 'INSTITUTE', // Institute-wide
  CLASS = 'CLASS',         // Class-specific
  SUBJECT = 'SUBJECT'      // Subject-specific
}

// Target User Types - Who receives the notification
export enum NotificationTargetUserType {
  // Standard targets
  ALL = 'ALL',
  STUDENTS = 'STUDENTS',
  TEACHERS = 'TEACHERS',
  PARENTS = 'PARENTS',
  ATTENDANCE_MARKERS = 'ATTENDANCE_MARKERS',
  INSTITUTE_ADMINS = 'INSTITUTE_ADMINS',
  
  // Advanced filters (GLOBAL scope only)
  USERS_WITHOUT_INSTITUTE = 'USERS_WITHOUT_INSTITUTE',   // Not enrolled anywhere
  USERS_WITHOUT_PARENT = 'USERS_WITHOUT_PARENT',         // USER_WITHOUT_PARENT type
  USERS_WITHOUT_STUDENT = 'USERS_WITHOUT_STUDENT',       // USER_WITHOUT_STUDENT type
  VERIFIED_USERS_ONLY = 'VERIFIED_USERS_ONLY',           // isEmailVerified = true
  UNVERIFIED_USERS_ONLY = 'UNVERIFIED_USERS_ONLY'        // isEmailVerified = false
}

// Notification Status - Current state of the notification
export enum NotificationStatus {
  DRAFT = 'DRAFT',         // Initial state
  SCHEDULED = 'SCHEDULED', // For future delivery
  SENDING = 'SENDING',     // Currently processing
  SENT = 'SENT',           // Successfully sent
  FAILED = 'FAILED',       // Send failed
  CANCELLED = 'CANCELLED'  // Manually cancelled
}

// Notification Priority
export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',   // Default
  HIGH = 'HIGH'
}

// =============== LEGACY ENUMS (For backward compatibility) ===============

// Notification Types for Super Admin
export enum SuperAdminNotificationType {
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  MAINTENANCE = 'MAINTENANCE',
  SECURITY_ALERT = 'SECURITY_ALERT',
  USER_ACTIVITY = 'USER_ACTIVITY',
  INSTITUTE_ALERT = 'INSTITUTE_ALERT',
  PAYMENT_ALERT = 'PAYMENT_ALERT',
  COMPLIANCE_NOTICE = 'COMPLIANCE_NOTICE',
  BROADCAST = 'BROADCAST',
  BULK_OPERATION = 'BULK_OPERATION',
  USAGE_ALERT = 'USAGE_ALERT'
}

export enum TargetAudience {
  ALL_USERS = 'ALL_USERS',
  ALL_INSTITUTES = 'ALL_INSTITUTES',
  SPECIFIC_INSTITUTES = 'SPECIFIC_INSTITUTES',
  SPECIFIC_USERS = 'SPECIFIC_USERS'
}

export enum SystemAlertCategory {
  MAINTENANCE = 'MAINTENANCE',
  SECURITY = 'SECURITY',
  PERFORMANCE = 'PERFORMANCE',
  DATA = 'DATA',
  COMPLIANCE = 'COMPLIANCE',
  SERVICE = 'SERVICE'
}

export enum AlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

export interface BroadcastNotification {
  id: string;
  title: string;
  message: string;
  type: SuperAdminNotificationType;
  targetAudience: TargetAudience;
  instituteIds?: number[];
  userIds?: number[];
  imageUrl?: string;
  actionUrl?: string;
  createdAt: string;
  sentAt?: string;
  scheduledTime?: string;
  deliveryStats: {
    total: number;
    delivered: number;
    failed: number;
    pending: number;
  };
  status: NotificationStatus;
}

export interface SystemAlert {
  id: string;
  category: SystemAlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  affectedSystems: string[];
  estimatedResolutionTime?: string;
  actionRequired: boolean;
  createdAt: string;
  resolvedAt?: string;
  notificationsSent: number;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  type: SuperAdminNotificationType;
  titleTemplate: string;
  messageTemplate: string;
  variables: string[];
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationAnalytics {
  totalSent: number;
  totalDelivered: number;
  totalFailed: number;
  successRate: number;
  averageDeliveryTime: number;
  byType: Record<string, number>;
  byInstitute: Array<{
    instituteName: string;
    notificationsSent: number;
    deliveryRate: number;
  }>;
  timeline: Array<{
    date: string;
    sent: number;
    delivered: number;
    failed: number;
  }>;
}

// =============== PUSH NOTIFICATION INTERFACES ===============

// Push Notification Entity (matching backend)
export interface PushNotification {
  id: string;
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
  institute?: {
    id: string;
    name: string;
  };
  class?: {
    id: string;
    name: string;
  };
  subject?: {
    id: string;
    name: string;
  };
  priority: NotificationPriority;
  status: NotificationStatus;
  collapseKey?: string;
  timeToLive: number;
  scheduledAt?: string;
  sentAt?: string;
  senderId?: string;
  senderRole: string;
  sender?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  readCount: number;
  createdAt: string;
  updatedAt: string;
}

// Create Notification DTO
export interface CreatePushNotificationDto {
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

// Send Notification Result
export interface SendNotificationResultDto {
  notificationId: string;
  status: NotificationStatus;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  sentAt: string;
}

// Paginated Response
export interface PaginatedPushNotifications {
  data: PushNotification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Target User Type Display Config
export const TARGET_USER_TYPE_CONFIG: Record<NotificationTargetUserType, { 
  label: string; 
  description: string; 
  category: 'basic' | 'advanced';
  globalOnly?: boolean;
}> = {
  [NotificationTargetUserType.ALL]: { 
    label: 'All Users', 
    description: 'Send to everyone', 
    category: 'basic' 
  },
  [NotificationTargetUserType.STUDENTS]: { 
    label: 'Students', 
    description: 'All student accounts', 
    category: 'basic' 
  },
  [NotificationTargetUserType.TEACHERS]: { 
    label: 'Teachers', 
    description: 'All teacher accounts', 
    category: 'basic' 
  },
  [NotificationTargetUserType.PARENTS]: { 
    label: 'Parents', 
    description: 'All parent accounts', 
    category: 'basic' 
  },
  [NotificationTargetUserType.ATTENDANCE_MARKERS]: { 
    label: 'Attendance Markers', 
    description: 'Users who mark attendance', 
    category: 'basic' 
  },
  [NotificationTargetUserType.INSTITUTE_ADMINS]: { 
    label: 'Institute Admins', 
    description: 'Institute administrators', 
    category: 'basic' 
  },
  [NotificationTargetUserType.USERS_WITHOUT_INSTITUTE]: { 
    label: 'Users Without Institute', 
    description: 'Not enrolled in any institute', 
    category: 'advanced',
    globalOnly: true
  },
  [NotificationTargetUserType.USERS_WITHOUT_PARENT]: { 
    label: 'Users Without Parent', 
    description: 'Cannot be assigned as parent', 
    category: 'advanced',
    globalOnly: true
  },
  [NotificationTargetUserType.USERS_WITHOUT_STUDENT]: { 
    label: 'Users Without Student', 
    description: 'Cannot play student role', 
    category: 'advanced',
    globalOnly: true
  },
  [NotificationTargetUserType.VERIFIED_USERS_ONLY]: { 
    label: 'Verified Users Only', 
    description: 'Email verified users', 
    category: 'advanced',
    globalOnly: true
  },
  [NotificationTargetUserType.UNVERIFIED_USERS_ONLY]: { 
    label: 'Unverified Users Only', 
    description: 'Not email verified', 
    category: 'advanced',
    globalOnly: true
  },
};
