import { apiClient } from './client';
import { enhancedCachedClient } from './enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';
import type {
  OperatingConfig,
  OperatingConfigPayload,
  BulkOperatingConfigPayload,
  CalendarDay,
  UpdateCalendarDayPayload,
  CalendarEvent,
  CreateEventPayload,
  UpdateEventPayload,
  GenerateCalendarPayload,
  GenerateCalendarResponse,
  DeleteCalendarResponse,
  CacheStats,
  CalendarApiResponse,
  CalendarViewData,
} from '@/types/calendar.types';

const calendarApi = {
  // ══════════════════════════════════════════════════════════════
  // Operating Config (Section 7)
  // ══════════════════════════════════════════════════════════════

  /** 7.3 — Get operating config for an institute */
  getOperatingConfig(instituteId: string, academicYear?: string) {
    const params: Record<string, string> = {};
    if (academicYear) params.academicYear = academicYear;
    return enhancedCachedClient.get<CalendarApiResponse<OperatingConfig[]>>(
      `/institutes/${instituteId}/calendar/operating-config`,
      Object.keys(params).length ? params : undefined,
      { ttl: CACHE_TTL.SETTINGS }
    );
  },

  /** 7.1 — Set single day operating config */
  saveOperatingConfig(instituteId: string, payload: OperatingConfigPayload) {
    return apiClient.post<CalendarApiResponse<OperatingConfig>>(
      `/institutes/${instituteId}/calendar/operating-config`,
      payload
    );
  },

  /** 7.2 — Set bulk operating config (all 7 days) */
  saveOperatingConfigBulk(instituteId: string, payload: BulkOperatingConfigPayload) {
    return apiClient.post<CalendarApiResponse<OperatingConfig[]>>(
      `/institutes/${instituteId}/calendar/operating-config/bulk`,
      payload
    );
  },

  // ══════════════════════════════════════════════════════════════
  // Generate / Delete Calendar (Section 8)
  // ══════════════════════════════════════════════════════════════

  /** 8.1 — Generate calendar for an academic year */
  generateCalendar(instituteId: string, payload: GenerateCalendarPayload) {
    return apiClient.post<GenerateCalendarResponse>(
      `/institutes/${instituteId}/calendar/generate`,
      payload
    );
  },

  /** 8.2 — Delete calendar for an academic year */
  deleteCalendar(instituteId: string, academicYear: string) {
    return apiClient.delete<DeleteCalendarResponse>(
      `/institutes/${instituteId}/calendar/${academicYear}`
    );
  },

  // ══════════════════════════════════════════════════════════════
  // Calendar Days (Section 9)
  // ══════════════════════════════════════════════════════════════

  /** 9.1 — List calendar days (paginated, filterable) */
  getDays(instituteId: string, params?: Record<string, any>) {
    return enhancedCachedClient.get<CalendarApiResponse<CalendarDay[]>>(
      `/institutes/${instituteId}/calendar/days`,
      params,
      { ttl: CACHE_TTL.SETTINGS }
    );
  },

  /** 9.2 — Get today's calendar day (cached) */
  getToday(instituteId: string) {
    return enhancedCachedClient.get<CalendarApiResponse<CalendarDay>>(
      `/institutes/${instituteId}/calendar/today`,
      undefined,
      { ttl: CACHE_TTL.SETTINGS }
    );
  },

  /** 9.2b — Get calendar day + events for a specific date */
  getByDate(instituteId: string, date: string) {
    return enhancedCachedClient.get<CalendarApiResponse<CalendarDay>>(
      `/institutes/${instituteId}/calendar/date/${date}`,
      undefined,
      { ttl: CACHE_TTL.SETTINGS }
    );
  },

  /** 9.2c — Get role-aware calendar month view (teacher/student supported) */
  getCalendarView(instituteId: string, params?: Record<string, any>) {
    return enhancedCachedClient.get<CalendarApiResponse<CalendarDay[] | CalendarViewData>>(
      `/institutes/${instituteId}/calendar/days`,
      params,
      { ttl: CACHE_TTL.SETTINGS }
    );
  },

  /** Get calendar month data with all days and events */
  getMonth(instituteId: string, year: number, month: number) {
    return enhancedCachedClient.get<CalendarApiResponse<{ year: number; month: number; totalDays: number; days: CalendarDay[] }>>(
      `/institutes/${instituteId}/calendar/month`,
      { year, month },
      { ttl: CACHE_TTL.SETTINGS }
    );
  },

  /** 9.3 — Update a calendar day */
  updateDay(instituteId: string, dayId: string, payload: UpdateCalendarDayPayload) {
    return apiClient.patch<CalendarApiResponse<CalendarDay>>(
      `/institutes/${instituteId}/calendar/days/${dayId}`,
      payload
    );
  },

  /** 9.4 — Delete a calendar day */
  deleteDay(instituteId: string, dayId: string) {
    return apiClient.delete<CalendarApiResponse<null>>(
      `/institutes/${instituteId}/calendar/days/${dayId}`
    );
  },

  // ══════════════════════════════════════════════════════════════
  // Calendar Events (Section 10)
  // ══════════════════════════════════════════════════════════════

  /** 10.1 — Create a calendar event */
  createEvent(instituteId: string, payload: CreateEventPayload) {
    return apiClient.post<CalendarApiResponse<CalendarEvent>>(
      `/institutes/${instituteId}/calendar/events`,
      payload
    );
  },

  /** 10.2 — Update a calendar event */
  updateEvent(instituteId: string, eventId: string, payload: UpdateEventPayload) {
    return apiClient.patch<CalendarApiResponse<CalendarEvent>>(
      `/institutes/${instituteId}/calendar/events/${eventId}`,
      payload
    );
  },

  /** 10.3 — Delete a calendar event */
  deleteEvent(instituteId: string, eventId: string) {
    return apiClient.delete<CalendarApiResponse<null>>(
      `/institutes/${instituteId}/calendar/events/${eventId}`
    );
  },

  /** 10.4 — List all events (paginated) */
  getEvents(instituteId: string, params?: Record<string, any>) {
    return enhancedCachedClient.get<CalendarApiResponse<CalendarEvent[]>>(
      `/institutes/${instituteId}/calendar/events`,
      params,
      { ttl: CACHE_TTL.SETTINGS }
    );
  },

  /** 10.5 — Get events for a specific calendar day */
  getDayEvents(instituteId: string, dayId: string) {
    return enhancedCachedClient.get<CalendarApiResponse<CalendarEvent[]>>(
      `/institutes/${instituteId}/calendar/days/${dayId}/events`,
      undefined,
      { ttl: CACHE_TTL.SETTINGS }
    );
  },

  /** 10.6 — Get default event for a day */
  getDefaultEvent(instituteId: string, dayId: string) {
    return enhancedCachedClient.get<CalendarApiResponse<CalendarEvent>>(
      `/institutes/${instituteId}/calendar/days/${dayId}/default-event`,
      undefined,
      { ttl: CACHE_TTL.SETTINGS }
    );
  },

  // ══════════════════════════════════════════════════════════════
  // Cache Management (Section 11)
  // ══════════════════════════════════════════════════════════════

  /** Get cache stats (admin only) */
  getCacheStats(instituteId: string) {
    return enhancedCachedClient.get<CalendarApiResponse<CacheStats>>(
      `/institutes/${instituteId}/calendar/cache/stats`,
      undefined,
      { ttl: CACHE_TTL.SETTINGS }
    );
  },

  /** Invalidate cache */
  invalidateCache(instituteId: string) {
    return apiClient.post<CalendarApiResponse<null>>(
      `/institutes/${instituteId}/calendar/cache/invalidate`
    );
  },

  // ══════════════════════════════════════════════════════════════
  // Class Calendar Endpoints (Section 12)
  // ══════════════════════════════════════════════════════════════

  /** 12.1 — Get today (class-scoped, with overrides) */
  getClassToday(instituteId: string, classId: string) {
    return enhancedCachedClient.get<CalendarApiResponse<CalendarDay>>(
      `/institutes/${instituteId}/class/${classId}/calendar/today`,
      undefined,
      { ttl: CACHE_TTL.SETTINGS }
    );
  },

  /** 12.2 — Generate calendar (class context) */
  generateClassCalendar(instituteId: string, classId: string, payload: GenerateCalendarPayload) {
    return apiClient.post<GenerateCalendarResponse>(
      `/institutes/${instituteId}/class/${classId}/calendar/generate`,
      payload
    );
  },

  /** 12.3 — Get events (class-scoped) */
  getClassEvents(instituteId: string, classId: string, params?: Record<string, any>) {
    return enhancedCachedClient.get<CalendarApiResponse<CalendarEvent[]>>(
      `/institutes/${instituteId}/class/${classId}/calendar/events`,
      params,
      { ttl: CACHE_TTL.SETTINGS }
    );
  },

  /** 12.4 — Get days (class-scoped, with overrides merged) */
  getClassDays(instituteId: string, classId: string, params?: Record<string, any>) {
    return enhancedCachedClient.get<CalendarApiResponse<CalendarDay[]>>(
      `/institutes/${instituteId}/class/${classId}/calendar/days`,
      params,
      { ttl: CACHE_TTL.SETTINGS }
    );
  },
};

export default calendarApi;
