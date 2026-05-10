// ============= CALENDAR DAY TYPES =============

export type CalendarDayType =
  | 'REGULAR'
  | 'HALF_DAY'
  | 'EXAM_DAY'
  | 'STAFF_ONLY'
  | 'SPECIAL_EVENT'
  | 'CANCELLED'
  | 'PUBLIC_HOLIDAY'
  | 'INSTITUTE_HOLIDAY'
  | 'WEEKEND';

// ============= CALENDAR EVENT TYPES =============
// Full list from API docs including all backend-supported types

export type CalendarEventType =
  | 'REGULAR_CLASS'
  | 'EXAM'
  | 'PARENTS_MEETING'
  | 'PRIZE_GIVING'
  | 'SPORTS_DAY'
  | 'CULTURAL_EVENT'
  | 'FIELD_TRIP'
  | 'WORKSHOP'
  | 'ORIENTATION'
  | 'OPEN_DAY'
  | 'RELIGIOUS_EVENT'
  | 'EXTRACURRICULAR'
  | 'STAFF_MEETING'
  | 'TRAINING'
  | 'GRADUATION'
  | 'ADMISSION'
  | 'MAINTENANCE'
  | 'CUSTOM';

export type EventStatus = 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED' | 'POSTPONED';

export type AttendanceOpenTo = 'TARGET_ONLY' | 'ALL_ENROLLED' | 'ANYONE';

export type TargetScope = 'INSTITUTE' | 'CLASS' | 'SUBJECT';

export type AttendanceUserType = 'STUDENT' | 'TEACHER' | 'PARENT' | 'STAFF';

// ============= ALL VALUES ARRAYS =============

export const ALL_CALENDAR_EVENT_TYPES: CalendarEventType[] = [
  'REGULAR_CLASS', 'EXAM', 'PARENTS_MEETING', 'PRIZE_GIVING',
  'SPORTS_DAY', 'CULTURAL_EVENT', 'FIELD_TRIP', 'WORKSHOP',
  'ORIENTATION', 'OPEN_DAY', 'RELIGIOUS_EVENT', 'EXTRACURRICULAR',
  'STAFF_MEETING', 'TRAINING', 'GRADUATION', 'ADMISSION',
  'MAINTENANCE', 'CUSTOM'
];

export const ALL_EVENT_STATUSES: EventStatus[] = [
  'SCHEDULED', 'ONGOING', 'COMPLETED', 'CANCELLED', 'POSTPONED'
];

export const ALL_ATTENDANCE_OPEN_TO: AttendanceOpenTo[] = [
  'TARGET_ONLY', 'ALL_ENROLLED', 'ANYONE'
];

export const ALL_TARGET_SCOPES: TargetScope[] = [
  'INSTITUTE', 'CLASS', 'SUBJECT'
];

export const ALL_CALENDAR_DAY_TYPES: CalendarDayType[] = [
  'REGULAR', 'HALF_DAY', 'EXAM_DAY', 'STAFF_ONLY',
  'SPECIAL_EVENT', 'CANCELLED', 'PUBLIC_HOLIDAY',
  'INSTITUTE_HOLIDAY', 'WEEKEND'
];

// ============= OPERATING CONFIG =============

export interface OperatingConfig {
  dayOfWeek: number; // 1-7 (1=Monday)
  dayName?: string;
  isOperating: boolean;
  startTime: string | null; // "HH:MM"
  endTime: string | null;   // "HH:MM"
}

export interface OperatingConfigPayload {
  dayOfWeek: number;
  isOperating: boolean;
  startTime?: string;
  endTime?: string;
  academicYear: string;
}

export interface BulkOperatingConfigPayload {
  academicYear: string;
  configs: Array<{
    dayOfWeek: number;
    isOperating: boolean;
    startTime?: string;
    endTime?: string;
  }>;
}

// ============= CALENDAR DAY =============

export interface CalendarDay {
  id: string;
  instituteId?: string;
  calendarDate: string; // YYYY-MM-DD
  dayType: CalendarDayType;
  title?: string;
  description?: string;
  startTime?: string; // HH:MM:SS
  endTime?: string;   // HH:MM:SS
  isAttendanceExpected: boolean;
  academicYear?: string;
  dayOfWeek?: number;
  events?: CalendarEvent[];
  defaultEventId?: string;
  // Class calendar override fields
  classOverride?: {
    classDayType?: CalendarDayType;
    isAttendanceExpected?: boolean;
  };
  effectiveDayType?: CalendarDayType;
  effectiveIsAttendanceExpected?: boolean;
}

export interface UpdateCalendarDayPayload {
  dayType?: CalendarDayType;
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  isAttendanceExpected?: boolean;
}

// ============= CALENDAR EVENT =============

export interface CalendarEvent {
  id: string;
  calendarDayId?: string;
  calendarDate?: string;
  eventType: CalendarEventType;
  title: string;
  description?: string;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  isAttendanceTracked: boolean;
  isDefault: boolean;
  targetUserTypes?: AttendanceUserType[];
  attendanceOpenTo?: AttendanceOpenTo;
  targetScope?: TargetScope;
  targetClassIds?: string[];
  targetSubjectIds?: string[];
  venue?: string;
  meetingLink?: string;
  status: EventStatus;
  isMandatory: boolean;
  maxParticipants?: number;
  notes?: string;
}

export interface CreateEventPayload {
  calendarDayId?: string;
  calendarDate?: string;
  eventType: CalendarEventType;
  title: string;
  description?: string;
  eventDate: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  isAttendanceTracked?: boolean;
  isDefault?: boolean;
  targetUserTypes?: AttendanceUserType[];
  attendanceOpenTo?: AttendanceOpenTo;
  targetScope?: TargetScope;
  targetClassIds?: string[];
  targetSubjectIds?: string[];
  venue?: string;
  meetingLink?: string;
  status?: EventStatus;
  isMandatory?: boolean;
  maxParticipants?: number;
  notes?: string;
}

export interface UpdateEventPayload {
  eventType?: CalendarEventType;
  title?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  isAllDay?: boolean;
  isAttendanceTracked?: boolean;
  targetUserTypes?: AttendanceUserType[];
  attendanceOpenTo?: AttendanceOpenTo;
  targetScope?: TargetScope;
  targetClassIds?: string[];
  targetSubjectIds?: string[];
  venue?: string;
  meetingLink?: string;
  status?: EventStatus;
  isMandatory?: boolean;
  maxParticipants?: number;
  notes?: string;
}

// ============= GENERATE CALENDAR =============

export interface PublicHoliday {
  date: string;  // YYYY-MM-DD
  title: string;
}

export interface TermBreak {
  startDate: string;
  endDate: string;
  title: string;
}

export interface GenerateCalendarPayload {
  academicYear: string;
  startDate: string;
  endDate: string;
  publicHolidays: PublicHoliday[];
  termBreaks: TermBreak[];
}

export interface GenerateCalendarResponse {
  success: boolean;
  message: string;
  data: {
    academicYear?: string;
    totalDays: number;
    regularDays?: number;
    breakdown?: {
      regular: number;
      weekend: number;
      publicHoliday: number;
      instituteHoliday: number;
    };
    weekends?: number;
    publicHolidays?: number;
    termBreaks?: number;
    totalEvents?: number;
    eventsCreated?: number;
  };
}

// ============= CACHE =============

export interface CacheStats {
  cacheEnabled: boolean;
  todayCacheKey: string;
  isCached: boolean;
  cachedAt?: string;
  ttlRemaining?: number;
}

// ============= API RESPONSE WRAPPER =============

export interface CalendarApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  total?: number;
  count?: number;
}

export interface CalendarViewSummary {
  working: number;
  holidays: number;
  weekends: number;
  exams: number;
  special: number;
}

export interface CalendarViewData {
  userType?: string;
  attendanceUserType?: string;
  role?: string;
  days?: CalendarDay[];
  calendarDays?: CalendarDay[];
  items?: CalendarDay[];
  monthSummary?: Partial<CalendarViewSummary>;
  [key: string]: unknown;
}

// ============= DELETE CALENDAR RESPONSE =============

export interface DeleteCalendarResponse {
  success: boolean;
  message: string;
  data?: {
    deletedDays: number;
    deletedEvents: number;
  };
}
