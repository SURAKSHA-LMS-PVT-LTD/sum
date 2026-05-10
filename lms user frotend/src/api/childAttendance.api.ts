import { attendanceApiClient } from './attendanceClient';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { getAttendanceUrl, getApiHeadersAsync, getBaseUrl, getCredentialsMode } from '@/contexts/utils/auth.api';
import { attendanceDuplicateChecker } from '@/utils/attendanceDuplicateCheck';
import { AttendanceStatus, AttendanceSummary, normalizeAttendanceSummary, AddressCoordinates, MarkingMethod } from '@/types/attendance.types';
import { getSriLankaDate } from '@/utils/timezone';

export interface ChildAttendanceRecord {
  attendanceId?: string;
  studentId: string;
  studentName: string;
  studentImageUrl?: string;
  instituteId?: string;
  instituteName: string;
  classId?: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  date: string;
  status: AttendanceStatus;
  location?: string;
  // ✅ NEW: Consolidated coordinates
  address?: AddressCoordinates;
  // ⚠️ DEPRECATED: Legacy fields for backward compatibility
  latitude?: number;
  longitude?: number;
  markingMethod: string;
  markedBy?: string;
  markedAt?: string;
}

export interface ChildAttendanceResponse {
  success: boolean;
  message: string;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    recordsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  data: ChildAttendanceRecord[];
  summary: AttendanceSummary;
}

export interface ChildAttendanceParams {
  studentId: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  userId?: string;
  role?: string;
}

export interface MarkAttendanceByCardRequest {
  studentCardId: string;
  instituteId: string;
  instituteName: string;
  classId?: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  // ✅ NEW: Consolidated coordinates
  address?: AddressCoordinates;
  location?: string;
  markingMethod: 'qr' | 'barcode' | 'rfid/nfc';
  status: AttendanceStatus;
  date?: string;
  eventId?: string;
  classSessionId?: string;
}

export interface MarkAttendanceByCardResponse {
  success: boolean;
  message: string;
  attendanceId: string;
  action: string;
  imageUrl?: string;
  status: AttendanceStatus;
  name?: string;
}

export interface MarkAttendanceRequest {
  studentId: string;
  studentName?: string;
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
  classSessionId?: string;
}

export interface MarkAttendanceResponse {
  success: boolean;
  message: string;
  attendanceId: string;
  action: string;
  imageUrl?: string;
  status: AttendanceStatus;
  name?: string;
}

class ChildAttendanceApi {
  async getChildAttendance(params: ChildAttendanceParams): Promise<ChildAttendanceResponse> {
    const { studentId, ...queryParams } = params;
    
    const defaultParams = {
      startDate: '2025-09-01',
      endDate: '2025-09-07',
      page: 1,
      limit: 50, // Default to 50 as requested
      ...queryParams
    };

    return attendanceApiClient.get<ChildAttendanceResponse>(
      `/api/attendance/student/${studentId}`,
      defaultParams,
      {
        forceRefresh: false,
        ttl: 60, // Cache for 1 minute
        useStaleWhileRevalidate: true
      }
    );
  }

  /**
   * Build a scoped attendance URL based on the presence of classId/subjectId.
   * - No classId → institute scope:  /api/attendance/institute/:id/<suffix>
   * - classId only → class scope:    /api/attendance/institute/:id/class/:classId/<suffix>
   * - classId + subjectId → subject: /api/attendance/institute/:id/class/:classId/subject/:subjectId/<suffix>
   */
  _buildScopedUrl(
    baseUrl: string,
    instituteId: string,
    suffix: string,
    classId?: string,
    subjectId?: string,
  ): string {
    let path = `${baseUrl}/api/attendance/institute/${instituteId}`;
    if (classId) {
      path += `/class/${classId}`;
      if (subjectId) {
        path += `/subject/${subjectId}`;
      }
    }
    return `${path}/${suffix}`;
  }

  async markAttendanceByCard(request: MarkAttendanceByCardRequest): Promise<MarkAttendanceByCardResponse> {
    // Get current user ID from localStorage
    const userId = localStorage.getItem('userId') || 'unknown';

    // 🛡️ CHECK FOR DUPLICATE ATTENDANCE
    const isDuplicate = attendanceDuplicateChecker.isDuplicate({
      userId,
      studentCardId: request.studentCardId,
      instituteId: request.instituteId,
      classId: request.classId,
      subjectId: request.subjectId,
      status: request.status,
      method: request.markingMethod
    });

    if (isDuplicate) {
      throw new Error('This attendance was already marked recently. Please wait a few minutes before marking again.');
    }

    let attendanceBaseUrl = getAttendanceUrl();
    if (!attendanceBaseUrl) {
      attendanceBaseUrl = getBaseUrl();
      if (!attendanceBaseUrl) {
        throw new Error('No API URL configured. Please set the API URL in settings.');
      }
    }

    const requestBody: any = {
      studentCardId: request.studentCardId,
      instituteId: request.instituteId,
      instituteName: request.instituteName,
      address: request.address,
      markingMethod: request.markingMethod,
      status: request.status,
    };

    if (request.date) requestBody.date = request.date;
    if (request.eventId) requestBody.eventId = request.eventId;
    if (request.classId && request.className) {
      requestBody.classId = request.classId;
      requestBody.className = request.className;
    }
    if (request.subjectId && request.subjectName) {
      requestBody.subjectId = request.subjectId;
      requestBody.subjectName = request.subjectName;
    }
    if (request.location) requestBody.location = request.location;
    if (request.address) requestBody.address = request.address;

    const baseUrl = attendanceBaseUrl.endsWith('/') ? attendanceBaseUrl.slice(0, -1) : attendanceBaseUrl;
    const fullApiUrl = this._buildScopedUrl(baseUrl, request.instituteId, 'mark-by-card', request.classId, request.subjectId);

    const authHeaders = await getApiHeadersAsync();
    const response = await fetch(fullApiUrl, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(requestBody),
      credentials: getCredentialsMode(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Failed to mark attendance by card: ${response.status}${errorText ? ` - ${errorText}` : ''}`);
    }

    const result: MarkAttendanceByCardResponse = await response.json();
    
    // ✅ RECORD ATTENDANCE LOCALLY TO PREVENT DUPLICATES
    attendanceDuplicateChecker.recordAttendance({
      userId,
      studentCardId: request.studentCardId,
      instituteId: request.instituteId,
      classId: request.classId,
      subjectId: request.subjectId,
      status: request.status,
      method: request.markingMethod
    });
    
    // ✅ REFRESH CACHE FOR DAILY EVENTS & RECENT ATTENDANCE
    enhancedCachedClient.enableGlobalForceRefresh(10000); // Refresh for 10 seconds
    
    return result;
  }

  async markAttendanceByInstituteCard(request: {
    instituteCardId: string;
    instituteId: string;
    instituteName: string;
    classId?: string;
    className?: string;
    subjectId?: string;
    subjectName?: string;
    // ✅ NEW: Consolidated coordinates in address object
    address?: AddressCoordinates;
    location?: string;
    markingMethod: string;
    status: AttendanceStatus;
    date: string;
    eventId?: string;
    classSessionId?: string;
  }): Promise<any> {
    // Get current user ID from localStorage
    const userId = localStorage.getItem('userId') || 'unknown';

    // 🛡️ CHECK FOR DUPLICATE ATTENDANCE (5 minute window)
    const isDuplicate = attendanceDuplicateChecker.isDuplicate({
      userId,
      // Reuse the studentCardId field to track institute card scans
      studentCardId: request.instituteCardId,
      instituteId: request.instituteId,
      classId: request.classId,
      subjectId: request.subjectId,
      status: request.status,
      method: (request.markingMethod as any) || 'rfid/nfc'
    });

    if (isDuplicate) {
      throw new Error('This attendance was already marked recently. Please wait a few minutes before marking again.');
    }

    let attendanceBaseUrl = getAttendanceUrl();
    if (!attendanceBaseUrl) {
      attendanceBaseUrl = getBaseUrl();
      if (!attendanceBaseUrl) {
        throw new Error('No API URL configured. Please set the API URL in settings.');
      }
    }

    const requestBody: any = {
      instituteCardId: request.instituteCardId,
      instituteId: request.instituteId,
      instituteName: request.instituteName,
      markingMethod: request.markingMethod,
      status: request.status,
      date: request.date,
    };

    if (request.location) requestBody.location = request.location;
    if (request.address) requestBody.address = request.address;
    if (request.eventId) requestBody.eventId = request.eventId;
    if (request.classSessionId) requestBody.classSessionId = request.classSessionId;
    if (request.classId && request.className) {
      requestBody.classId = request.classId;
      requestBody.className = request.className;
    }
    if (request.subjectId && request.subjectName) {
      requestBody.subjectId = request.subjectId;
      requestBody.subjectName = request.subjectName;
    }

    const baseUrl = attendanceBaseUrl.endsWith('/') ? attendanceBaseUrl.slice(0, -1) : attendanceBaseUrl;
    const fullApiUrl = this._buildScopedUrl(baseUrl, request.instituteId, 'mark-by-institute-card', request.classId, request.subjectId);

    const instCardHeaders = await getApiHeadersAsync();
    const response = await fetch(fullApiUrl, {
      method: 'POST',
      headers: instCardHeaders,
      body: JSON.stringify(requestBody),
      credentials: getCredentialsMode(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Failed to mark attendance: ${response.status}${errorText ? ` - ${errorText}` : ''}`);
    }

    const result = await response.json();

    // ✅ RECORD ATTENDANCE LOCALLY TO PREVENT DUPLICATES
    attendanceDuplicateChecker.recordAttendance({
      userId,
      studentCardId: request.instituteCardId,
      instituteId: request.instituteId,
      classId: request.classId,
      subjectId: request.subjectId,
      status: request.status,
      method: (request.markingMethod as any) || 'rfid/nfc'
    });
    
    // ✅ REFRESH CACHE FOR DAILY EVENTS & RECENT ATTENDANCE
    enhancedCachedClient.enableGlobalForceRefresh(10000); // Refresh for 10 seconds

    return result;
  }

  async markAttendance(request: MarkAttendanceRequest): Promise<MarkAttendanceResponse> {
    // Get current user ID from localStorage
    const userId = localStorage.getItem('userId') || 'unknown';

    // 🛡️ CHECK FOR DUPLICATE ATTENDANCE
    const isDuplicate = attendanceDuplicateChecker.isDuplicate({
      userId,
      studentId: request.studentId,
      instituteId: request.instituteId,
      classId: request.classId,
      subjectId: request.subjectId,
      status: request.status,
      method: request.markingMethod as 'manual' | 'qr' | 'barcode' | 'rfid/nfc'
    });

    if (isDuplicate) {
      throw new Error('This attendance was already marked recently. Please wait a few minutes before marking again.');
    }

    let attendanceBaseUrl = getAttendanceUrl();
    if (!attendanceBaseUrl) {
      attendanceBaseUrl = getBaseUrl();
      if (!attendanceBaseUrl) {
        throw new Error('No API URL configured. Please set the API URL in settings.');
      }
    }

    const requestBody: any = {
      studentId: request.studentId,
      studentName: request.studentName || `Student ${request.studentId}`,
      instituteId: request.instituteId,
      instituteName: request.instituteName,
      markingMethod: request.markingMethod,
      status: request.status,
      date: request.date || getSriLankaDate(),
    };

    if (request.location) requestBody.location = request.location;
    if (request.address) requestBody.address = request.address;
    if (request.eventId) requestBody.eventId = request.eventId;
    if (request.classId && request.className) {
      requestBody.classId = request.classId;
      requestBody.className = request.className;
    }
    if (request.subjectId && request.subjectName) {
      requestBody.subjectId = request.subjectId;
      requestBody.subjectName = request.subjectName;
    }

    const baseUrl = attendanceBaseUrl.endsWith('/') ? attendanceBaseUrl.slice(0, -1) : attendanceBaseUrl;
    const fullApiUrl = `${baseUrl}/api/attendance/mark`;

    const manualHeaders = await getApiHeadersAsync();
    const response = await fetch(fullApiUrl, {
      method: 'POST',
      headers: manualHeaders,
      body: JSON.stringify(requestBody),
      credentials: getCredentialsMode(),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Failed to mark attendance: ${response.status}${errorText ? ` - ${errorText}` : ''}`);
    }

    const result: MarkAttendanceResponse = await response.json();
    
    // ✅ RECORD ATTENDANCE LOCALLY TO PREVENT DUPLICATES
    attendanceDuplicateChecker.recordAttendance({
      userId,
      studentId: request.studentId,
      instituteId: request.instituteId,
      classId: request.classId,
      subjectId: request.subjectId,
      status: request.status,
      method: request.markingMethod as 'manual' | 'qr' | 'barcode' | 'rfid/nfc'
    });
    
    // ✅ REFRESH CACHE FOR DAILY EVENTS & RECENT ATTENDANCE
    enhancedCachedClient.enableGlobalForceRefresh(10000); // Refresh for 10 seconds
    
    return result;
  }
}

export const childAttendanceApi = new ChildAttendanceApi();