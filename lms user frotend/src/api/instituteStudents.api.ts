import { getAttendanceUrl, getApiHeadersAsync } from '@/contexts/utils/auth.api';

export interface StudentListRecord {
  id: string;
  name: string;
  nameWithInitials?: string;
  email: string;
  addressLine1?: string;
  addressLine2?: string;
  phoneNumber: string;
  imageUrl?: string;
  dateOfBirth?: string;
  userIdByInstitute?: string;
  fatherId?: string;
  motherId?: string;
  guardianId?: string;
  emergencyContact?: string;
  medicalConditions?: string;
  allergies?: string;
  studentId?: string;
  father?: {
    id: string;
    name: string;
    email: string;
    occupation?: string;
    workPlace?: string;
    children: any[];
  };
  mother?: {
    id: string;
    name: string;
    email: string;
    occupation?: string;
    workPlace?: string;
    children: any[];
  };
  guardian?: {
    id: string;
    name: string;
    email: string;
    occupation?: string;
    workPlace?: string;
    children: any[];
  };
}

export interface StudentListResponse {
  data: StudentListRecord[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

import { AttendanceStatus, AttendanceSummary } from '@/types/attendance.types';

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
  status: AttendanceStatus;
  location: string;
  markingMethod: string;
  userType?: string;
  calendarDayId?: string;
  eventId?: string;
  timestamp?: number;
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
  summary?: AttendanceSummary;
}

export interface StudentAttendanceParams {
  page?: number;
  limit?: number;
  userId?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  searchTerm?: string;
  studentName?: string;
  markingMethod?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class InstituteStudentsApi {
  // STUDENT LIST METHODS

  // Get all students in an institute (no class filter)
  async getStudentsByInstitute(
    instituteId: string,
    params: { page?: number; limit?: number } = {}
  ): Promise<StudentListResponse> {
    const queryParams = new URLSearchParams({
      page: String(params.page || 1),
      limit: String(params.limit || 500),
    });

    const attendanceUrl = getAttendanceUrl();
    const endpoint = `${attendanceUrl}/institute-users/institute/${instituteId}/users/STUDENT?${queryParams}`;
    const headers = await getApiHeadersAsync();

    const response = await fetch(endpoint, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  // Get students by class
  async getStudentsByClass(
    instituteId: string,
    classId: string,
    params: { page?: number; limit?: number; parent?: boolean } = {}
  ): Promise<StudentListResponse> {
    const queryParams = new URLSearchParams({
      page: String(params.page || 1),
      limit: String(params.limit || 50)
    });
    
    // Only add parent param if explicitly specified
    if (params.parent !== undefined) {
      queryParams.append('parent', String(params.parent));
    }

    console.log('Fetching students for institute:', instituteId, 'class:', classId);

    const attendanceUrl = getAttendanceUrl();
    const endpoint = `${attendanceUrl}/institute-users/institute/${instituteId}/users/STUDENT/class/${classId}?${queryParams}`;
    const headers = await getApiHeadersAsync();
    
    const response = await fetch(endpoint, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  // Get students by class and subject
  async getStudentsBySubject(
    instituteId: string,
    classId: string,
    subjectId: string,
    params: { page?: number; limit?: number; parent?: boolean } = {}
  ): Promise<StudentListResponse> {
    const queryParams = new URLSearchParams({
      page: String(params.page || 1),
      limit: String(params.limit || 50)
    });
    
    // Only add parent param if explicitly specified
    if (params.parent !== undefined) {
      queryParams.append('parent', String(params.parent));
    }

    console.log('Fetching students for institute:', instituteId, 'class:', classId, 'subject:', subjectId);

    const attendanceUrl = getAttendanceUrl();
    const endpoint = `${attendanceUrl}/institute-users/institute/${instituteId}/users/STUDENT/class/${classId}/subject/${subjectId}?${queryParams}`;
    const headers = await getApiHeadersAsync();
    
    const response = await fetch(endpoint, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  // ATTENDANCE METHODS
  
  // 1. Institute-level attendance (InstituteAdmin only)
  async getInstituteStudentAttendance(
    instituteId: string, 
    params: StudentAttendanceParams = {},
    forceRefresh = false
  ): Promise<StudentAttendanceResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append('page', String(params.page || 1));
    queryParams.append('limit', String(params.limit || 50));
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.status) queryParams.append('status', params.status);
    if (params.searchTerm) queryParams.append('searchTerm', params.searchTerm);
    if (params.studentName) queryParams.append('studentName', params.studentName);
    if (params.markingMethod) queryParams.append('markingMethod', params.markingMethod);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    console.log('Fetching institute student attendance for institute:', instituteId, 'with params:', Object.fromEntries(queryParams));

    const attendanceUrl = getAttendanceUrl();
    const endpoint = `${attendanceUrl}/api/attendance/institute/${instituteId}?${queryParams.toString()}`;
    const headers = await getApiHeadersAsync();
    
    const response = await fetch(endpoint, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  // 2. Class-level attendance (InstituteAdmin, Teacher)
  async getClassStudentAttendance(
    instituteId: string,
    classId: string,
    params: StudentAttendanceParams = {},
    forceRefresh = false
  ): Promise<StudentAttendanceResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append('page', String(params.page || 1));
    queryParams.append('limit', String(params.limit || 50));
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.status) queryParams.append('status', params.status);
    if (params.searchTerm) queryParams.append('searchTerm', params.searchTerm);
    if (params.studentName) queryParams.append('studentName', params.studentName);
    if (params.markingMethod) queryParams.append('markingMethod', params.markingMethod);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    console.log('Fetching class student attendance for institute:', instituteId, 'class:', classId, 'with params:', Object.fromEntries(queryParams));

    const attendanceUrl = getAttendanceUrl();
    const endpoint = `${attendanceUrl}/api/attendance/institute/${instituteId}/class/${classId}?${queryParams.toString()}`;
    const headers = await getApiHeadersAsync();
    
    const response = await fetch(endpoint, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }

  // 3. Subject-level attendance (InstituteAdmin, Teacher)
  async getSubjectStudentAttendance(
    instituteId: string,
    classId: string,
    subjectId: string,
    params: StudentAttendanceParams = {},
    forceRefresh = false
  ): Promise<StudentAttendanceResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append('page', String(params.page || 1));
    queryParams.append('limit', String(params.limit || 50));
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.status) queryParams.append('status', params.status);
    if (params.searchTerm) queryParams.append('searchTerm', params.searchTerm);
    if (params.studentName) queryParams.append('studentName', params.studentName);
    if (params.markingMethod) queryParams.append('markingMethod', params.markingMethod);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    console.log('Fetching subject student attendance for institute:', instituteId, 'class:', classId, 'subject:', subjectId, 'with params:', Object.fromEntries(queryParams));

    const attendanceUrl = getAttendanceUrl();
    const endpoint = `${attendanceUrl}/api/attendance/institute/${instituteId}/class/${classId}/subject/${subjectId}?${queryParams.toString()}`;
    const headers = await getApiHeadersAsync();
    
    const response = await fetch(endpoint, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  }
}

export const instituteStudentsApi = new InstituteStudentsApi();
