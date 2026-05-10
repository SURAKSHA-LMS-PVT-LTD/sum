// ============= ATTENDANCE DEVICE MANAGEMENT TYPES =============

// Device type enum
export type DeviceType = 'TABLET' | 'PHONE' | 'RFID_READER' | 'BIOMETRIC' | 'KIOSK' | 'NFC_TERMINAL' | 'QR_SCANNER' | 'OTHER';

// Device status enum
export type DeviceStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'BLOCKED';

// Allowed status mode for device marking
export type AllowedStatusMode = 'ANY' | 'BLOCKED' | 'ONLY';

// Event binding status
export type EventBindingStatus = 'ACTIVE' | 'INACTIVE';

// Device audit action
export type DeviceAuditAction =
  | 'CREATED' | 'ASSIGNED' | 'UNASSIGNED' | 'ENABLED' | 'DISABLED'
  | 'CONFIG_CHANGED' | 'EVENT_BOUND' | 'EVENT_UNBOUND'
  | 'SESSION_STARTED' | 'SESSION_ENDED' | 'BLOCKED' | 'UNBLOCKED'
  | 'INSTITUTE_CHANGED' | 'DELETED' | 'STATUS_MODE_CHANGED' | 'RATE_LIMIT_CHANGED';

// All enums for selectors
export const ALL_DEVICE_TYPES: DeviceType[] = ['TABLET', 'PHONE', 'RFID_READER', 'BIOMETRIC', 'KIOSK', 'NFC_TERMINAL', 'QR_SCANNER', 'OTHER'];
export const ALL_DEVICE_STATUSES: DeviceStatus[] = ['ACTIVE', 'INACTIVE', 'MAINTENANCE', 'BLOCKED'];
export const ALL_ALLOWED_STATUS_MODES: AllowedStatusMode[] = ['ANY', 'BLOCKED', 'ONLY'];

// Device type display config
export const DEVICE_TYPE_CONFIG: Record<DeviceType, { label: string; icon: string }> = {
  TABLET: { label: 'Tablet', icon: '📱' },
  PHONE: { label: 'Phone', icon: '📲' },
  RFID_READER: { label: 'RFID Reader', icon: '📡' },
  BIOMETRIC: { label: 'Biometric', icon: '🔐' },
  KIOSK: { label: 'Kiosk', icon: '🖥️' },
  NFC_TERMINAL: { label: 'NFC Terminal', icon: '📶' },
  QR_SCANNER: { label: 'QR Scanner', icon: '📷' },
  OTHER: { label: 'Other', icon: '⚙️' },
};

// Device status display config
export const DEVICE_STATUS_CONFIG: Record<DeviceStatus, { label: string; color: string; bgColor: string }> = {
  ACTIVE: { label: 'Active', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10 border-emerald-500/20' },
  INACTIVE: { label: 'Inactive', color: 'text-muted-foreground', bgColor: 'bg-muted/50 border-muted' },
  MAINTENANCE: { label: 'Maintenance', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10 border-amber-500/20' },
  BLOCKED: { label: 'Blocked', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500/10 border-red-500/20' },
};

// ============= INTERFACES =============

export interface AttendanceDevice {
  id: string;
  deviceUid: string;
  deviceName: string;
  deviceType: DeviceType;
  instituteId: string | null;
  instituteName: string | null;
  isEnabled: number;
  status: DeviceStatus;
  assignedBy: string | null;
  assignedAt: string | null;
  lastHeartbeatAt: string | null;
  lastActivityAt: string | null;
  ipAddress: string | null;
  firmwareVersion: string | null;
  metadata: Record<string, any> | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceConfig {
  id: string;
  deviceId: string;
  maxSessions: number;
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  allowedStatusMode: AllowedStatusMode;
  allowedStatusList: string[] | null;
  autoStatus: string | null;
  requireLocation: number;
  requirePhoto: number;
  allowedIpRanges: string[] | null;
  operatingStartTime: string | null;
  operatingEndTime: string | null;
}

export interface DeviceEventBinding {
  id: string;
  deviceId: string;
  eventId: number;
  eventName: string | null;
  calendarDayId: number | null;
  boundBy: string;
  isActive: number;
  status: EventBindingStatus;
  statusOverride: string | null;
  notes: string | null;
  boundAt: string;
  unboundAt: string | null;
}

export interface DeviceSession {
  id: string;
  deviceId: string;
  sessionToken: string;
  userId: string | null;
  isActive: number;
  ipAddress: string | null;
  userAgent: string | null;
  marksCount: number;
  startedAt: string;
  expiresAt: string | null;
  endedAt: string | null;
}

export interface DeviceAuditEntry {
  id: string;
  deviceId: string;
  action: DeviceAuditAction;
  performedBy: string;
  details: Record<string, any> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface DeviceDetail {
  device: AttendanceDevice;
  config: DeviceConfig;
  activeBinding: DeviceEventBinding | null;
  activeSessions: number;
}

export interface DeviceStats {
  totalDevices: number;
  activeDevices: number;
  blockedDevices: number;
  unassignedDevices: number;
  totalActiveSessions: number;
  devicesByType: Record<string, number>;
}

export interface DevicePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DeviceListResponse {
  data: AttendanceDevice[];
  pagination: DevicePagination;
}

// ============= PAYLOADS =============

export interface RegisterDevicePayload {
  deviceUid: string;
  deviceName: string;
  deviceType?: DeviceType;
  instituteId?: string;
  instituteName?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface UpdateDevicePayload {
  deviceName?: string;
  deviceType?: DeviceType;
  description?: string;
  firmwareVersion?: string;
  metadata?: Record<string, any>;
}

export interface AssignDevicePayload {
  instituteId: string;
  instituteName: string;
}

export interface UpdateDeviceConfigPayload {
  maxSessions?: number;
  rateLimitPerMinute?: number;
  rateLimitPerHour?: number;
  allowedStatusMode?: AllowedStatusMode;
  allowedStatusList?: string[];
  autoStatus?: string;
  requireLocation?: boolean;
  requirePhoto?: boolean;
  allowedIpRanges?: string[];
  operatingStartTime?: string;
  operatingEndTime?: string;
}

export interface BindEventPayload {
  eventId: number;
  eventName?: string;
  calendarDayId?: number;
  statusOverride?: string;
  notes?: string;
}

export interface StartSessionPayload {
  deviceUid: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface HeartbeatPayload {
  deviceUid: string;
  ipAddress?: string;
  firmwareVersion?: string;
}

export interface DeviceListQueryParams {
  instituteId?: string;
  status?: DeviceStatus;
  deviceType?: DeviceType;
  isEnabled?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}
