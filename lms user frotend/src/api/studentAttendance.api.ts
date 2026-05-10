import { enhancedCachedClient } from './enhancedCachedClient';
import { AttendanceStatus, AttendanceSummary, normalizeAttendanceSummary } from '@/types/attendance.types';

export interface StudentAttendanceRecord {
  studentId: string;
  studentName: string;
  studentImageUrl?: string;
  imageUrl?: string;
  instituteId: string;
  instituteName: string;
  classId?: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  date: string;
  markedAt?: string;
  status: AttendanceStatus;
  location: string;
  markingMethod: string;
}

export interface StudentAttendanceResponse {
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
  data: StudentAttendanceRecord[];
  summary: AttendanceSummary;
}

export interface StudentAttendanceParams {
  studentId: string;
  instituteId: string;
  classId?: string;
  subjectId?: string;
  startDate: string;
  endDate: string;
  page?: number;
  limit?: number;
  userId?: string;
  role?: string;
}

export const studentAttendanceApi = {
  // Institute level attendance
  getInstituteAttendance: async (params: StudentAttendanceParams, forceRefresh = false): Promise<StudentAttendanceResponse> => {
    const queryParams = new URLSearchParams();
    queryParams.append('startDate', params.startDate);
    queryParams.append('endDate', params.endDate);
    queryParams.append('studentId', params.studentId);
    queryParams.append('page', (params.page || 1).toString());
    queryParams.append('limit', (params.limit || 50).toString());

    const endpoint = `/api/attendance/institute/${params.instituteId}?${queryParams.toString()}`;
    
    console.log('=== INSTITUTE ATTENDANCE API CALL ===');
    console.log('Endpoint:', endpoint);
    
    return enhancedCachedClient.get<StudentAttendanceResponse>(endpoint, undefined, {
      forceRefresh,
      ttl: 10,
      useStaleWhileRevalidate: true,
      userId: params.userId || params.studentId,
      instituteId: params.instituteId,
      role: params.role
    });
  },

  // Class level attendance
  getClassAttendance: async (params: StudentAttendanceParams, forceRefresh = false): Promise<StudentAttendanceResponse> => {
    if (!params.classId) {
      throw new Error('classId is required for class level attendance');
    }
    
    const queryParams = new URLSearchParams();
    queryParams.append('startDate', params.startDate);
    queryParams.append('endDate', params.endDate);
    queryParams.append('studentId', params.studentId);
    queryParams.append('page', (params.page || 1).toString());
    queryParams.append('limit', (params.limit || 50).toString());

    const endpoint = `/api/attendance/institute/${params.instituteId}/class/${params.classId}?${queryParams.toString()}`;
    
    console.log('=== CLASS ATTENDANCE API CALL ===');
    console.log('Endpoint:', endpoint);
    
    return enhancedCachedClient.get<StudentAttendanceResponse>(endpoint, undefined, {
      forceRefresh,
      ttl: 10,
      useStaleWhileRevalidate: true,
      userId: params.userId || params.studentId,
      instituteId: params.instituteId,
      classId: params.classId,
      role: params.role
    });
  },

  // Subject level attendance
  getSubjectAttendance: async (params: StudentAttendanceParams, forceRefresh = false): Promise<StudentAttendanceResponse> => {
    if (!params.classId || !params.subjectId) {
      throw new Error('classId and subjectId are required for subject level attendance');
    }
    
    const queryParams = new URLSearchParams();
    queryParams.append('startDate', params.startDate);
    queryParams.append('endDate', params.endDate);
    queryParams.append('studentId', params.studentId);
    queryParams.append('page', (params.page || 1).toString());
    queryParams.append('limit', (params.limit || 50).toString());

    const endpoint = `/api/attendance/institute/${params.instituteId}/class/${params.classId}/subject/${params.subjectId}?${queryParams.toString()}`;
    
    console.log('=== SUBJECT ATTENDANCE API CALL ===');
    console.log('Endpoint:', endpoint);
    
    return enhancedCachedClient.get<StudentAttendanceResponse>(endpoint, undefined, {
      forceRefresh,
      ttl: 10,
      useStaleWhileRevalidate: true,
      userId: params.userId || params.studentId,
      instituteId: params.instituteId,
      classId: params.classId,
      subjectId: params.subjectId,
      role: params.role
    });
  },

  // Smart method that picks the right endpoint based on context
  getAttendance: async (params: StudentAttendanceParams, forceRefresh = false): Promise<StudentAttendanceResponse> => {
    if (params.subjectId && params.classId) {
      return studentAttendanceApi.getSubjectAttendance(params, forceRefresh);
    } else if (params.classId) {
      return studentAttendanceApi.getClassAttendance(params, forceRefresh);
    } else {
      return studentAttendanceApi.getInstituteAttendance(params, forceRefresh);
    }
  }
};
