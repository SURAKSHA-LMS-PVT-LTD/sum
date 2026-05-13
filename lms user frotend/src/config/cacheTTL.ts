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
  USER_TYPES: number; // <-- New

  // Institute Data
  INSTITUTES: number;
  INSTITUTE_DETAILS: number;
  INSTITUTE_PROFILE: number;
  INSTITUTE_USERS: number;
  INSTITUTE_CLASSES: number;
  INSTITUTE_ORGANIZATIONS: number;
  ORGANIZATION_MEMBERS: number;

  // ... (rest of the interface)
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
  USER_LOOKUP: 30,
  USER_TYPES: 120, // <-- New: User types rarely change

  // ... (rest of the configuration)
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

