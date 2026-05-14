// ============= ATTENDANCE STATUS TYPES =============
// Enhanced attendance system with 6 statuses including departure tracking

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'left' | 'left_early' | 'left_lately';

// ============= ADDRESS/COORDINATES TYPES =============

/**
 * ✅ NEW: Consolidated coordinates in address object
 * Use this for sending latitude/longitude to backend
 */
export interface AddressCoordinates {
  latitude?: number;
  longitude?: number;
}

// Marking method used to record attendance
export type MarkingMethod = 'qr' | 'barcode' | 'rfid/nfc' | 'manual' | 'system';

// User type auto-detected by backend
export type AttendanceUserType = 
  | 'STUDENT' 
  | 'TEACHER' 
  | 'INSTITUTE_ADMIN' 
  | 'ATTENDANCE_MARKER' 
  | 'PARENT' 
  | 'NOT_ENROLLED';

// Status display configuration for consistent UI across all components
export const ATTENDANCE_STATUS_CONFIG: Record<AttendanceStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  badgeVariant: 'default' | 'destructive' | 'secondary' | 'outline';
}> = {
  present: {
    label: 'Present',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20',
    icon: '✓',
    badgeVariant: 'default'
  },
  absent: {
    label: 'Absent',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/20',
    icon: '✗',
    badgeVariant: 'destructive'
  },
  late: {
    label: 'Late',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/20',
    icon: '⏰',
    badgeVariant: 'secondary'
  },
  left: {
    label: 'Left',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-500/10 border-purple-500/20',
    icon: '→',
    badgeVariant: 'secondary'
  },
  left_early: {
    label: 'Left Early',
    color: 'text-pink-600 dark:text-pink-400',
    bgColor: 'bg-pink-500/10 border-pink-500/20',
    icon: '⏰→',
    badgeVariant: 'secondary'
  },
  left_lately: {
    label: 'Left Late',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-500/10 border-indigo-500/20',
    icon: '🕐→',
    badgeVariant: 'secondary'
  }
};

// Extended summary interface with new departure fields
export interface AttendanceSummary {
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalLeft: number;
  totalLeftEarly: number;
  totalLeftLately: number;
  attendanceRate: number;
}

// Extended institute summary with additional fields
export interface InstituteAttendanceSummary extends AttendanceSummary {
  uniqueStudents?: number;
  totalClasses?: number;
  totalSubjects?: number;
}

// Helper function to get status config with fallback
export const getAttendanceStatusConfig = (status: string) => {
  const normalizedStatus = status?.toLowerCase() as AttendanceStatus;
  return ATTENDANCE_STATUS_CONFIG[normalizedStatus] || ATTENDANCE_STATUS_CONFIG.present;
};

// Helper to normalize summary with defaults for backward compatibility
export const normalizeAttendanceSummary = (summary: Partial<AttendanceSummary> | undefined): AttendanceSummary => {
  return {
    totalPresent: summary?.totalPresent || 0,
    totalAbsent: summary?.totalAbsent || 0,
    totalLate: summary?.totalLate || 0,
    totalLeft: summary?.totalLeft || 0,
    totalLeftEarly: summary?.totalLeftEarly || 0,
    totalLeftLately: summary?.totalLeftLately || 0,
    attendanceRate: summary?.attendanceRate || 0
  };
};

// All available statuses for selectors
export const ALL_ATTENDANCE_STATUSES: AttendanceStatus[] = [
  'present',
  'absent', 
  'late',
  'left',
  'left_early',
  'left_lately'
];

// All marking methods
export const ALL_MARKING_METHODS: MarkingMethod[] = [
  'qr',
  'barcode',
  'rfid/nfc',
  'manual',
  'system'
];

// All attendance user types
export const ALL_ATTENDANCE_USER_TYPES: AttendanceUserType[] = [
  'STUDENT',
  'TEACHER',
  'INSTITUTE_ADMIN',
  'ATTENDANCE_MARKER',
  'PARENT',
  'NOT_ENROLLED'
];

// Chart colors for visualization
export const ATTENDANCE_CHART_COLORS = {
  present: '#10b981',
  absent: '#ef4444',
  late: '#f59e0b',
  left: '#8b5cf6',
  left_early: '#ec4899',
  left_lately: '#6366f1'
};

// ============= ATTENDANCE RECORD INTERFACES =============

export interface AttendanceRecord {
  attendanceId?: string;
  id?: string;
  studentId: string;
  studentName?: string;
  studentImageUrl?: string;
  imageUrl?: string;
  userId?: string;
  userName?: string;
  instituteId: string;
  instituteName?: string;
  classId?: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  date?: string;
  markedAt?: string;
  status: AttendanceStatus;
  location?: string;
  // ✅ NEW: Consolidated coordinates
  address?: AddressCoordinates;
  // ⚠️ DEPRECATED: Legacy fields for backward compatibility (extracted from address on response)
  latitude?: number;
  longitude?: number;
  markingMethod?: MarkingMethod;
  markedBy?: string;
  eventId?: string;
  eventTitle?: string;
  calendarDayId?: string;
  userType?: AttendanceUserType;
  remarks?: string;
}

// ============= MARK ATTENDANCE PAYLOADS =============

export interface MarkAttendancePayload {
  studentId: string;
  studentName?: string;
  instituteId: string;
  instituteName: string;
  classId?: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  date: string;
  location?: string;
  // ✅ NEW: Consolidated coordinates in address object
  address?: AddressCoordinates;
  status: AttendanceStatus;
  remarks?: string;
  markingMethod?: MarkingMethod;
  eventId?: string;
  deviceUid?: string; // Registered device UID — triggers device validation
  // userType is auto-detected by backend — do NOT send
}

export interface BulkAttendancePayload {
  instituteId: string;
  instituteName: string;
  classId?: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  date?: string;
  eventId?: string;
  location?: string;
  // ✅ NEW: Consolidated coordinates in address object
  address?: AddressCoordinates;
  markingMethod?: MarkingMethod;
  students: {
    studentId: string;
    studentName?: string;
    status: AttendanceStatus;
    remarks?: string;
  }[];
}

export interface MarkByCardPayload {
  studentCardId: string;
  instituteId: string;
  instituteName: string;
  classId?: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  // ✅ NEW: Consolidated coordinates in address object
  address?: AddressCoordinates;
  location?: string;
  markingMethod: MarkingMethod;
  status: AttendanceStatus;
  date?: string;
  eventId?: string;
}

export interface BulkCardAttendancePayload {
  instituteId: string;
  instituteName: string;
  classId?: string;
  className?: string;
  subjectId?: string;
  // ✅ NEW: Consolidated coordinates in address object
  address?: AddressCoordinates;
  location?: string;
  markingMethod: MarkingMethod;
  students: {
    studentCardId: string;
    status: AttendanceStatus;
  }[];
}

export interface MarkByInstituteCardPayload {
  instituteCardId: string;
  instituteId: string;
  instituteName: string;
  classId?: string;
  className?: string;
  // ✅ NEW: Consolidated coordinates in address object
  address?: AddressCoordinates;
  location?: string;
  markingMethod: MarkingMethod;
  status: AttendanceStatus;
  date?: string;
  eventId?: string
  latitude?: number;
  longitude?: number;
  subjectId?: string;
  subjectName?: string;
}

// ============= RESPONSE INTERFACES =============

export interface AvailableEvent {
  id: string;
  eventType: string;
  title: string;
  isDefault: boolean;
  isAttendanceTracked: boolean;
  startTime?: string | null;
  endTime?: string | null;
}

export interface MarkAttendanceResponse {
  success: boolean;
  message: string;
  attendanceId?: string;
  date?: string;
  eventId?: string | null;
  calendarDayId?: string | null;
  availableEvents?: AvailableEvent[];
  imageUrl?: string;
  status?: string;
  name?: string;
  userType?: string;
}

export interface BulkAttendanceResponse {
  success: boolean;
  message: string;
  totalProcessed?: number;
  action?: string;
  date?: string;
  eventId?: string | null;
  calendarDayId?: string | null;
  availableEvents?: AvailableEvent[];
  summary: {
    successful: number;
    failed: number;
    total: number;
  };
  results: {
    studentId?: string;
    studentCardId?: string;
    studentName?: string;
    success: boolean;
    attendanceId?: string;
    error?: string;
  }[];
  records?: any[];
}

export interface MarkByCardResponse {
  success: boolean;
  message: string;
  attendanceId?: string;
  studentId?: string;
  studentCardId?: string;
  studentName?: string;
}

export interface MarkByInstituteCardResponse {
  success: boolean;
  message: string;
  data?: {
    studentId: string;
    studentName: string;
    instituteCardId: string;
    userIdByInstitute?: string;
    imageUrl?: string;
    isInstituteImage?: boolean;
    imageVerificationStatus?: string;
    status: AttendanceStatus;
    markedAt: string;
    location?: string;
  };
}

export interface CardUserResponse {
  success: boolean;
  message: string;
  data: {
    userId: string;
    userName: string;
    instituteCardId: string;
    userIdByInstitute?: string;
    imageUrl?: string;
    isInstituteImage?: boolean;
    imageVerificationStatus?: string;
    userType?: AttendanceUserType;
    className?: string;
    classId?: string;
    subjectId?: string;
  };
}

export interface AttendancePagination {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  recordsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface AttendanceQueryResponse {
  success: boolean;
  message?: string;
  pagination?: AttendancePagination;
  dateRange?: {
    startDate: string;
    endDate: string;
    totalDays: number;
  };
  data: AttendanceRecord[];
  summary?: AttendanceSummary | InstituteAttendanceSummary;
  studentInfo?: {
    studentId: string;
    studentCardId?: string;
    studentName: string;
    instituteName?: string;
    className?: string;
  };
  instituteInfo?: {
    instituteId: string;
    instituteName: string;
  };
  classInfo?: {
    instituteId: string;
    instituteName: string;
    classId: string;
    className: string;
  };
  subjectInfo?: {
    instituteId: string;
    instituteName: string;
    classId: string;
    className: string;
    subjectId: string;
    subjectName: string;
  };
}
