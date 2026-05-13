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

// ... (rest of the file)
