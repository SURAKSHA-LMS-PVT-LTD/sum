/**
 * Centralized Cache TTL (Time To Live) Configuration
 * 
 * All cache durations are defined here in minutes.
 * This makes it easy to adjust caching strategies across the entire application.
 * 
 * Default: 60 minutes (1 hour) for most data
 */

export interface CacheTTLConfig {
  // Default TTL
  DEFAULT: number;

  // User & Authentication Data
  USER_PROFILE: number;
  USER_PERMISSIONS: number;
  USER_ROLES: number;
  USER_LOOKUP: number;

  // Institute Data
  INSTITUTES: number;
  INSTITUTE_DETAILS: number;
  INSTITUTE_PROFILE: number;
  INSTITUTE_USERS: number;
  INSTITUTE_CLASSES: number;
  INSTITUTE_ORGANIZATIONS: number;
  ORGANIZATION_MEMBERS: number;

  // Academic Data
  CLASSES: number;
  SUBJECTS: number;
  GRADES: number;
  STUDENTS: number;
  TEACHERS: number;
  PARENTS: number;

  // Attendance Data
  ATTENDANCE_RECORDS: number;
  ATTENDANCE_MARKERS: number;
  DAILY_ATTENDANCE: number;
  MY_ATTENDANCE: number;
  CHILD_ATTENDANCE: number;

  // Academic Content
  LECTURES: number;
  LIVE_LECTURES: number;
  FREE_LECTURES: number;
  HOMEWORK: number;
  HOMEWORK_SUBMISSIONS: number;
  EXAMS: number;
  EXAM_RESULTS: number;
  CHILD_RESULTS: number;

  // Payments
  PAYMENTS: number;
  PAYMENT_SUBMISSIONS: number;
  INSTITUTE_PAYMENTS: number;
  SUBJECT_PAYMENTS: number;

  // Transport
  TRANSPORT: number;
  TRANSPORT_ATTENDANCE: number;
  CHILD_TRANSPORT: number;

  // Organization Data
  ORGANIZATIONS: number;
  ORGANIZATION_COURSES: number;
  ORGANIZATION_LECTURES: number;
  ORGANIZATION_GALLERY: number;

  // Static/Reference Data (longer cache)
  GALLERY: number;
  SETTINGS: number;

  // Real-time/Frequently Changing Data (shorter cache)
  NOTIFICATIONS: number;
  UNVERIFIED_STUDENTS: number;
  ENROLLMENT_STATUS: number;

  // API Configuration
  API_CONFIG: number;
  
  // SMS & Communications
  SMS_CREDENTIALS: number;
  SMS_HISTORY: number;
}

/**
 * Cache TTL Configuration
 * All values in minutes
 */
export const CACHE_TTL: CacheTTLConfig = {
  // ========================================== 
  // DEFAULT: 60 minutes (1 hour)
  // ==========================================
  DEFAULT: 60,

  // ==========================================
  // USER & AUTHENTICATION DATA: 60 minutes
  // ==========================================
  USER_PROFILE: 60,
  USER_PERMISSIONS: 60,
  USER_ROLES: 60,
  USER_LOOKUP: 30, // User lookups by phone/email/RFID - moderate caching

  // ==========================================
  // INSTITUTE DATA: 60 minutes
  // ==========================================
  INSTITUTES: 60,
  INSTITUTE_DETAILS: 60,
  INSTITUTE_PROFILE: 60, // Institute profile data
  INSTITUTE_USERS: 60,
  INSTITUTE_CLASSES: 60,
  INSTITUTE_ORGANIZATIONS: 60,
  ORGANIZATION_MEMBERS: 60, // Organization members list

  // ==========================================
  // ACADEMIC DATA: 60 minutes
  // ==========================================
  CLASSES: 60,
  SUBJECTS: 60,
  GRADES: 60,
  STUDENTS: 60,
  TEACHERS: 60,
  PARENTS: 60,

  // ==========================================
  // ATTENDANCE DATA: 30 minutes
  // (More frequently changing)
  // ==========================================
  ATTENDANCE_RECORDS: 30,
  ATTENDANCE_MARKERS: 60,
  DAILY_ATTENDANCE: 30,
  MY_ATTENDANCE: 30,
  CHILD_ATTENDANCE: 30,

  // ==========================================
  // ACADEMIC CONTENT: 60 minutes
  // ==========================================
  LECTURES: 60,
  LIVE_LECTURES: 15, // Shorter for real-time content
  FREE_LECTURES: 60,
  HOMEWORK: 60,
  HOMEWORK_SUBMISSIONS: 30,
  EXAMS: 60,
  EXAM_RESULTS: 60,
  CHILD_RESULTS: 60,

  // ==========================================
  // PAYMENTS: 30 minutes
  // (Financial data - moderate caching)
  // ==========================================
  PAYMENTS: 30,
  PAYMENT_SUBMISSIONS: 30,
  INSTITUTE_PAYMENTS: 30,
  SUBJECT_PAYMENTS: 30,

  // ==========================================
  // TRANSPORT: 60 minutes
  // ==========================================
  TRANSPORT: 60,
  TRANSPORT_ATTENDANCE: 30,
  CHILD_TRANSPORT: 60,

  // ==========================================
  // ORGANIZATION DATA: 60 minutes
  // ==========================================
  ORGANIZATIONS: 60,
  ORGANIZATION_COURSES: 60,
  ORGANIZATION_LECTURES: 60,
  ORGANIZATION_GALLERY: 120, // Longer - images don't change often

  // ==========================================
  // STATIC/REFERENCE DATA: 120 minutes (2 hours)
  // (Rarely changes)
  // ==========================================
  GALLERY: 120,
  SETTINGS: 60,

  // ==========================================
  // REAL-TIME DATA: 15 minutes
  // (Frequently changing)
  // ==========================================
  NOTIFICATIONS: 15,
  UNVERIFIED_STUDENTS: 15,
  ENROLLMENT_STATUS: 15,

  // ==========================================
  // API CONFIGURATION: 120 minutes (2 hours)
  // ==========================================
  API_CONFIG: 120,
  
  // ==========================================
  // SMS & COMMUNICATIONS: 30 minutes
  // ==========================================
  SMS_CREDENTIALS: 30, // SMS credentials status
  SMS_HISTORY: 30, // SMS sending history
};

/**
 * Get TTL for a specific cache key or endpoint
 * Returns DEFAULT if not found
 */
export function getTTL(key: keyof CacheTTLConfig | string): number {
  if (key in CACHE_TTL) {
    return CACHE_TTL[key as keyof CacheTTLConfig];
  }
  return CACHE_TTL.DEFAULT;
}

/**
 * Convert minutes to milliseconds
 */
export function minutesToMs(minutes: number): number {
  return minutes * 60 * 1000;
}

/**
 * Convert milliseconds to minutes
 */
export function msToMinutes(ms: number): number {
  return ms / 60 / 1000;
}

/**
 * Get TTL in milliseconds
 */
export function getTTLInMs(key: keyof CacheTTLConfig | string): number {
  return minutesToMs(getTTL(key));
}

/**
 * Helper function to determine TTL based on endpoint
 * This automatically maps API endpoints to their TTL configuration
 */
export function getTTLForEndpoint(endpoint: string): number {
  // Remove leading slash and query parameters
  const cleanEndpoint = endpoint.replace(/^\//, '').split('?')[0];

  // User & Auth
  if (cleanEndpoint.includes('user/profile')) return CACHE_TTL.USER_PROFILE;
  if (cleanEndpoint.includes('user/permissions')) return CACHE_TTL.USER_PERMISSIONS;
  if (cleanEndpoint.includes('user/roles')) return CACHE_TTL.USER_ROLES;

  // Institutes
  if (cleanEndpoint.includes('institute-users')) return CACHE_TTL.INSTITUTE_USERS;
  if (cleanEndpoint.includes('institute-classes')) return CACHE_TTL.INSTITUTE_CLASSES;
  if (cleanEndpoint.includes('institute-organizations')) return CACHE_TTL.INSTITUTE_ORGANIZATIONS;
  if (cleanEndpoint.includes('institute-payments')) return CACHE_TTL.INSTITUTE_PAYMENTS;
  if (cleanEndpoint.includes('institutes')) return CACHE_TTL.INSTITUTES;

  // Academic
  if (cleanEndpoint.includes('classes')) return CACHE_TTL.CLASSES;
  if (cleanEndpoint.includes('subjects')) return CACHE_TTL.SUBJECTS;
  if (cleanEndpoint.includes('grades')) return CACHE_TTL.GRADES;
  if (cleanEndpoint.includes('students')) return CACHE_TTL.STUDENTS;
  if (cleanEndpoint.includes('teachers')) return CACHE_TTL.TEACHERS;
  if (cleanEndpoint.includes('parents')) return CACHE_TTL.PARENTS;

  // Attendance
  if (cleanEndpoint.includes('attendance/markers')) return CACHE_TTL.ATTENDANCE_MARKERS;
  if (cleanEndpoint.includes('attendance/daily')) return CACHE_TTL.DAILY_ATTENDANCE;
  if (cleanEndpoint.includes('attendance/my')) return CACHE_TTL.MY_ATTENDANCE;
  if (cleanEndpoint.includes('attendance/student')) return CACHE_TTL.CHILD_ATTENDANCE;
  if (cleanEndpoint.includes('attendance')) return CACHE_TTL.ATTENDANCE_RECORDS;

  // Academic Content
  if (cleanEndpoint.includes('lectures/live')) return CACHE_TTL.LIVE_LECTURES;
  if (cleanEndpoint.includes('lectures/free')) return CACHE_TTL.FREE_LECTURES;
  if (cleanEndpoint.includes('lectures')) return CACHE_TTL.LECTURES;
  if (cleanEndpoint.includes('homework/submissions')) return CACHE_TTL.HOMEWORK_SUBMISSIONS;
  if (cleanEndpoint.includes('homework')) return CACHE_TTL.HOMEWORK;
  if (cleanEndpoint.includes('exams/results')) return CACHE_TTL.EXAM_RESULTS;
  if (cleanEndpoint.includes('exams')) return CACHE_TTL.EXAMS;

  // Payments
  if (cleanEndpoint.includes('payment-submissions')) return CACHE_TTL.PAYMENT_SUBMISSIONS;
  if (cleanEndpoint.includes('subject-payments')) return CACHE_TTL.SUBJECT_PAYMENTS;
  if (cleanEndpoint.includes('payments')) return CACHE_TTL.PAYMENTS;

  // Transport
  if (cleanEndpoint.includes('transport/attendance')) return CACHE_TTL.TRANSPORT_ATTENDANCE;
  if (cleanEndpoint.includes('transport')) return CACHE_TTL.TRANSPORT;

  // Organizations
  if (cleanEndpoint.includes('organizations/courses')) return CACHE_TTL.ORGANIZATION_COURSES;
  if (cleanEndpoint.includes('organizations/lectures')) return CACHE_TTL.ORGANIZATION_LECTURES;
  if (cleanEndpoint.includes('organizations/gallery')) return CACHE_TTL.ORGANIZATION_GALLERY;
  if (cleanEndpoint.includes('organizations')) return CACHE_TTL.ORGANIZATIONS;

  // Static Data
  if (cleanEndpoint.includes('gallery')) return CACHE_TTL.GALLERY;
  if (cleanEndpoint.includes('settings')) return CACHE_TTL.SETTINGS;

  // Real-time Data
  if (cleanEndpoint.includes('notifications')) return CACHE_TTL.NOTIFICATIONS;
  if (cleanEndpoint.includes('unverified')) return CACHE_TTL.UNVERIFIED_STUDENTS;
  if (cleanEndpoint.includes('enrollment/status')) return CACHE_TTL.ENROLLMENT_STATUS;

  // API Config
  if (cleanEndpoint.includes('api/config')) return CACHE_TTL.API_CONFIG;

  // Default
  return CACHE_TTL.DEFAULT;
}

/**
 * Cache TTL Presets for common scenarios
 */
export const CACHE_PRESETS = {
  /**
   * Very Short: 5 minutes
   * Use for real-time data that changes frequently
   */
  VERY_SHORT: 5,

  /**
   * Short: 15 minutes
   * Use for data that changes regularly
   */
  SHORT: 15,

  /**
   * Medium: 30 minutes
   * Use for data that changes occasionally
   */
  MEDIUM: 30,

  /**
   * Standard: 60 minutes (1 hour)
   * Use for most data
   */
  STANDARD: 60,

  /**
   * Long: 120 minutes (2 hours)
   * Use for static data that rarely changes
   */
  LONG: 120,

  /**
   * Very Long: 360 minutes (6 hours)
   * Use for reference data that almost never changes
   */
  VERY_LONG: 360,

  /**
   * No Cache: 0 minutes
   * Always fetch fresh data
   */
  NO_CACHE: 0,
};

// Export for easy importing
export default CACHE_TTL;
