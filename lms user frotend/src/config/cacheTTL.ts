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
  USER_TYPES: number;

  // Institute Data
  INSTITUTES: number;
  INSTITUTE_DETAILS: number;
  INSTITUTE_PROFILE: number;
  INSTITUTE_USERS: number;
  INSTITUTE_CLASSES: number;
  INSTITUTE_ORGANIZATIONS: number;
  ORGANIZATION_MEMBERS: number;

  // Allow arbitrary cache keys defined ad-hoc by feature APIs
  [key: string]: number;
}

/**
 * Cache TTL Configuration
 * All values in minutes
 */
export const CACHE_TTL: CacheTTLConfig = {
  DEFAULT: 60,

  USER_PROFILE: 60,
  USER_PERMISSIONS: 60,
  USER_ROLES: 60,
  USER_LOOKUP: 30,
  USER_TYPES: 120,

  INSTITUTES: 60,
  INSTITUTE_DETAILS: 60,
  INSTITUTE_PROFILE: 60,
  INSTITUTE_USERS: 30,
  INSTITUTE_CLASSES: 60,
  INSTITUTE_ORGANIZATIONS: 60,
  ORGANIZATION_MEMBERS: 30,

  // Feature-specific TTLs referenced across the api/ layer
  SETTINGS: 60,
  SUBJECT_PAYMENTS: 15,
  PAYMENT_SUBMISSIONS: 5,
  INSTITUTE_PAYMENTS: 15,
  HOMEWORK: 15,
  LECTURES: 15,
  STUDENTS: 30,
  ORGANIZATIONS: 60,
  UNVERIFIED_STUDENTS: 5,

  // Transport (bookhire) — enrollments change rarely; attendance is more dynamic
  TRANSPORT: 15,
  TRANSPORT_ATTENDANCE: 5,
};

// Simple TTL resolver used by apiCache
export function getTTLForEndpoint(endpoint: string): number {
  if (!endpoint) return CACHE_TTL.DEFAULT;
  const e = endpoint.toLowerCase();

  // User-related
  if (e.includes('/me') || e.includes('/users/') || e.includes('/user')) return CACHE_TTL.USER_PROFILE;
  if (e.includes('user-types')) return CACHE_TTL.USER_TYPES;

  // Institute-related
  if (e.includes('/institutes/') && (e.includes('/profile') || e.includes('/settings'))) return CACHE_TTL.INSTITUTE_PROFILE;
  if (e.includes('/institutes/') && e.includes('/users')) return CACHE_TTL.INSTITUTE_USERS;
  if (e.includes('institute-classes') || (e.includes('/class') && e.includes('institute'))) return CACHE_TTL.INSTITUTE_CLASSES;
  if (e.includes('/institutes') && !e.includes('/profile')) return CACHE_TTL.INSTITUTES;

  // Attendance and high-change endpoints should be short
  if (e.includes('attendance') || e.includes('sessions') || e.includes('submissions')) return 5;

  // Default fallback
  return CACHE_TTL.DEFAULT;
}

