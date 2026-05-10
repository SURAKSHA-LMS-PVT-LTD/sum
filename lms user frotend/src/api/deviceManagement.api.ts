import { attendanceApiClient } from './attendanceClient';
import type {
  AttendanceDevice,
  DeviceConfig,
  DeviceEventBinding,
  DeviceSession,
  DeviceAuditEntry,
  DeviceDetail,
  DeviceStats,
  DeviceListResponse,
  DeviceListQueryParams,
  RegisterDevicePayload,
  UpdateDevicePayload,
  AssignDevicePayload,
  UpdateDeviceConfigPayload,
  BindEventPayload,
  StartSessionPayload,
  HeartbeatPayload,
} from '@/types/device.types';

// ══════════════════════════════════════════════════════════════
// SYSTEM ADMIN — /api/admin/attendance-devices
// ══════════════════════════════════════════════════════════════

const ADMIN_BASE = '/api/admin/attendance-devices';

export const systemAdminDeviceApi = {

  // ── CRUD (Section 4) ──────────────────────────────────────

  /** 4.1 — Register device */
  register(payload: RegisterDevicePayload) {
    return attendanceApiClient.post<AttendanceDevice>(ADMIN_BASE, payload);
  },

  /** 4.2 — Update device */
  update(deviceId: string, payload: UpdateDevicePayload) {
    return attendanceApiClient.patch<AttendanceDevice>(`${ADMIN_BASE}/${deviceId}`, payload);
  },

  /** 4.3 — Delete device */
  delete(deviceId: string) {
    return attendanceApiClient.delete<void>(`${ADMIN_BASE}/${deviceId}`);
  },

  // ── Assign / Unassign / Change (Section 5) ────────────────

  /** 5.1 — Assign to institute */
  assign(deviceId: string, payload: AssignDevicePayload) {
    return attendanceApiClient.post<AttendanceDevice>(`${ADMIN_BASE}/${deviceId}/assign`, payload);
  },

  /** 5.2 — Unassign from institute */
  unassign(deviceId: string) {
    return attendanceApiClient.post<AttendanceDevice>(`${ADMIN_BASE}/${deviceId}/unassign`);
  },

  /** 5.3 — Change institute */
  changeInstitute(deviceId: string, payload: AssignDevicePayload) {
    return attendanceApiClient.post<AttendanceDevice>(`${ADMIN_BASE}/${deviceId}/change-institute`, payload);
  },

  // ── Enable / Disable / Block (Section 6) ──────────────────

  enable(deviceId: string) {
    return attendanceApiClient.post<AttendanceDevice>(`${ADMIN_BASE}/${deviceId}/enable`);
  },
  disable(deviceId: string) {
    return attendanceApiClient.post<AttendanceDevice>(`${ADMIN_BASE}/${deviceId}/disable`);
  },
  block(deviceId: string, reason?: string) {
    return attendanceApiClient.post<AttendanceDevice>(`${ADMIN_BASE}/${deviceId}/block`, reason ? { reason } : undefined);
  },
  unblock(deviceId: string) {
    return attendanceApiClient.post<AttendanceDevice>(`${ADMIN_BASE}/${deviceId}/unblock`);
  },

  // ── Config (Section 7) ────────────────────────────────────

  getConfig(deviceId: string) {
    return attendanceApiClient.get<DeviceConfig>(`${ADMIN_BASE}/${deviceId}/config`);
  },
  updateConfig(deviceId: string, payload: UpdateDeviceConfigPayload) {
    return attendanceApiClient.patch<DeviceConfig>(`${ADMIN_BASE}/${deviceId}/config`, payload);
  },

  // ── Event Binding (Section 8) ─────────────────────────────

  bindEvent(deviceId: string, payload: BindEventPayload) {
    return attendanceApiClient.post<DeviceEventBinding>(`${ADMIN_BASE}/${deviceId}/bind-event`, payload);
  },
  unbindEvent(deviceId: string) {
    return attendanceApiClient.post<void>(`${ADMIN_BASE}/${deviceId}/unbind-event`);
  },
  getBindings(deviceId: string) {
    return attendanceApiClient.get<DeviceEventBinding[]>(`${ADMIN_BASE}/${deviceId}/bindings`);
  },

  // ── Queries & Stats (Section 9) ───────────────────────────

  list(params?: DeviceListQueryParams) {
    return attendanceApiClient.get<DeviceListResponse>(ADMIN_BASE, params as Record<string, any>);
  },
  getDetail(deviceId: string) {
    return attendanceApiClient.get<DeviceDetail>(`${ADMIN_BASE}/${deviceId}`);
  },
  getStats() {
    return attendanceApiClient.get<DeviceStats>(`${ADMIN_BASE}/stats`);
  },
  getAudit(deviceId: string, limit = 50) {
    return attendanceApiClient.get<DeviceAuditEntry[]>(`${ADMIN_BASE}/${deviceId}/audit`, { limit });
  },
  getSessions(deviceId: string) {
    return attendanceApiClient.get<DeviceSession[]>(`${ADMIN_BASE}/${deviceId}/sessions`);
  },
};

// ══════════════════════════════════════════════════════════════
// INSTITUTE ADMIN — /api/institute/:instituteId/devices
// ══════════════════════════════════════════════════════════════

function instBase(instituteId: string) {
  return `/api/institute/${instituteId}/devices`;
}

export const instituteDeviceApi = {

  // ── Device Management (Section 10) ────────────────────────

  list(instituteId: string, params?: Omit<DeviceListQueryParams, 'instituteId'>) {
    return attendanceApiClient.get<DeviceListResponse>(instBase(instituteId), params as Record<string, any>);
  },
  getDetail(instituteId: string, deviceId: string) {
    return attendanceApiClient.get<DeviceDetail>(`${instBase(instituteId)}/${deviceId}`);
  },
  update(instituteId: string, deviceId: string, payload: Pick<UpdateDevicePayload, 'deviceName' | 'description'>) {
    return attendanceApiClient.patch<AttendanceDevice>(`${instBase(instituteId)}/${deviceId}`, payload);
  },
  enable(instituteId: string, deviceId: string) {
    return attendanceApiClient.post<AttendanceDevice>(`${instBase(instituteId)}/${deviceId}/enable`);
  },
  disable(instituteId: string, deviceId: string) {
    return attendanceApiClient.post<AttendanceDevice>(`${instBase(instituteId)}/${deviceId}/disable`);
  },

  // ── Config (Section 11) ───────────────────────────────────

  getConfig(instituteId: string, deviceId: string) {
    return attendanceApiClient.get<DeviceConfig>(`${instBase(instituteId)}/${deviceId}/config`);
  },
  updateConfig(instituteId: string, deviceId: string, payload: Omit<UpdateDeviceConfigPayload, 'maxSessions' | 'rateLimitPerMinute' | 'rateLimitPerHour' | 'allowedIpRanges'>) {
    return attendanceApiClient.patch<DeviceConfig>(`${instBase(instituteId)}/${deviceId}/config`, payload);
  },

  // ── Event Binding (Section 12) ────────────────────────────

  bindEvent(instituteId: string, deviceId: string, payload: BindEventPayload) {
    return attendanceApiClient.post<DeviceEventBinding>(`${instBase(instituteId)}/${deviceId}/bind-event`, payload);
  },
  unbindEvent(instituteId: string, deviceId: string) {
    return attendanceApiClient.post<void>(`${instBase(instituteId)}/${deviceId}/unbind-event`);
  },
  getActiveBinding(instituteId: string, deviceId: string) {
    return attendanceApiClient.get<DeviceEventBinding | null>(`${instBase(instituteId)}/${deviceId}/active-binding`);
  },
  getBindings(instituteId: string, deviceId: string) {
    return attendanceApiClient.get<DeviceEventBinding[]>(`${instBase(instituteId)}/${deviceId}/bindings`);
  },

  // ── Sessions (Section 13) ────────────────────────────────

  startSession(instituteId: string, deviceId: string, payload: StartSessionPayload) {
    return attendanceApiClient.post<DeviceSession>(`${instBase(instituteId)}/${deviceId}/sessions/start`, payload);
  },
  endSession(instituteId: string, deviceId: string, sessionToken: string) {
    return attendanceApiClient.post<void>(`${instBase(instituteId)}/${deviceId}/sessions/${sessionToken}/end`);
  },
  listSessions(instituteId: string, deviceId: string) {
    return attendanceApiClient.get<DeviceSession[]>(`${instBase(instituteId)}/${deviceId}/sessions`);
  },

  // ── Heartbeat & Audit (Section 14) ───────────────────────

  heartbeat(instituteId: string, payload: HeartbeatPayload) {
    return attendanceApiClient.post<{ status: string; isEnabled: boolean }>(`${instBase(instituteId)}/heartbeat`, payload);
  },
  getAudit(instituteId: string, deviceId: string, limit = 50) {
    return attendanceApiClient.get<DeviceAuditEntry[]>(`${instBase(instituteId)}/${deviceId}/audit`, { limit });
  },
};
