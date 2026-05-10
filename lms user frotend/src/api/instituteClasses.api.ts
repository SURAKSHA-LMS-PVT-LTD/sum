
import { apiClient } from './client';
import { enhancedCachedClient } from './enhancedCachedClient';

export interface InstituteClassCreateData {
  instituteId: string;
  name: string;
  code: string;
  academicYear: string;
  level: number;
  grade: number;
  specialty: string;
  classType: string;
  capacity: number;
  classTeacherId?: string;
  description?: string;
  isActive?: boolean;
  startDate: string;
  endDate: string;
  enrollmentCode?: string;
  enrollmentEnabled?: boolean;
  requireTeacherVerification?: boolean;
  imageUrl?: string;
}

export interface InstituteClass {
  id: string;
  instituteId: string;
  name: string;
  code: string;
  academicYear: string;
  level: number;
  grade: number;
  specialty: string;
  classType: string;
  capacity: number;
  classTeacherId?: string;
  description?: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
  imageUrl?: string;
  enrollmentCode?: string;
  enrollmentEnabled: boolean;
  requireTeacherVerification: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InstituteClassResponse {
  class: InstituteClass;
  message: string;
}

export interface BulkAssignStudentsData {
  studentUserIds: string[];
  skipVerification?: boolean;
  assignmentNotes?: string;
}

export interface TeacherAssignResponse {
  success: string[];
  failed: string[];
}

export interface AssignmentResult {
  studentUserId: string;
  success: boolean;
  status: string;
  assignment?: {
    instituteId: string;
    classId: string;
    studentUserId: string;
    isActive: boolean;
    isVerified: boolean;
    enrollmentMethod: string;
    assignedAt: string;
  };
  error?: string;
}

export interface BulkAssignResponse {
  message: string;
  class: {
    id: string;
    name: string;
    code: string;
    instituteId: string;
  };
  summary: {
    totalRequested: number;
    newlyAssigned: number;
    alreadyEnrolled: number;
    failed: number;
    assignedBy: string;
    operationType: string;
  };
  newlyAssigned: AssignmentResult[];
  errors: AssignmentResult[];
}

export interface EnrollClassData {
  classId: string;
  enrollmentCode: string;
}

export interface EnrollmentResult {
  message: string;
  class: {
    id: string;
    name: string;
    code: string;
  };
  enrollment: {
    studentUserId: string;
    isVerified: boolean;
    enrollmentMethod: string;
    enrolledAt: string;
  };
  requiresVerification: boolean;
}

export interface TeacherClassAssignment {
  instituteId: string;
  classId: string;
  isActive: boolean;
  assignedAt: string;
  teacherRole: string;
  priority: number;
  class: {
    id: string;
    name: string;
    code: string;
    grade: number;
    specialty: string;
    academicYear: string;
    classType: string;
    imageUrl?: string;
  };
}

export interface TeacherClassesResponse {
  data: TeacherClassAssignment[];
  total: number;
  page: number;
  limit: number;
  instituteId: string;
  requestId: string;
  timestamp: string;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface EnrollmentCodeResponse {
  classId: string;
  enrollmentCode: string;
  enrollmentEnabled: boolean;
  requireTeacherVerification: boolean;
}

export interface ClassQueryParams {
  userId?: string;
  role?: string;
  instituteId?: string;
  classId?: string;
}

export interface TeacherInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  imageUrl?: string;
  phoneNumber?: string;
  userType: string;
}

export const instituteClassesApi = {
  // Assign teacher to class
  assignTeacher: async (classId: string, teacherId: string): Promise<{ success: boolean; message: string; data: any }> => {
    return enhancedCachedClient.patch(`/institute-classes/${classId}/assign-teacher`, { teacherId }, {
      classId
    });
  },

  // Unassign teacher from class
  unassignTeacher: async (classId: string): Promise<{ success: boolean; message: string; data: any }> => {
    return enhancedCachedClient.patch(`/institute-classes/${classId}/unassign-teacher`, {}, {
      classId
    });
  },

  // Create with auto-invalidation
  create: async (data: InstituteClassCreateData): Promise<InstituteClassResponse> => {
    return enhancedCachedClient.post('/institute-classes', data, {
      instituteId: data.instituteId
    });
  },

  // Update with auto-invalidation
  update: async (classId: string, data: InstituteClassCreateData): Promise<InstituteClassResponse> => {
    return enhancedCachedClient.patch(`/institute-classes/${classId}`, data, {
      instituteId: data.instituteId,
      classId
    });
  },

  // Get by institute with enhanced caching
  getByInstitute: async (instituteId: string, params?: ClassQueryParams & { page?: number; limit?: number }, forceRefresh = false): Promise<InstituteClass[]> => {
    console.log('🚀 API call to getByInstitute with instituteId:', instituteId, 'page:', params?.page || 1, 'limit:', params?.limit || 50);
    const page = params?.page || 1;
    const limit = params?.limit || 50;
    const result = await enhancedCachedClient.get<InstituteClass[]>(`/institute-classes/institute/${instituteId}?page=${page}&limit=${limit}`, undefined, {
      forceRefresh,
      ttl: 15,
      useStaleWhileRevalidate: true,
      userId: params?.userId,
      instituteId,
      classId: params?.classId,
      role: params?.role
    });
    console.log('� Full API response:', result);
    console.log('� Response data:', result);
    return result || [];
  },

  // Get by institute and teacher with enhanced caching
  getByInstituteAndTeacher: async (instituteId: string, teacherId: string, params?: ClassQueryParams & { page?: number; limit?: number }, forceRefresh = false): Promise<TeacherClassesResponse> => {
    console.log('🚀 API call to getByInstituteAndTeacher with:', { instituteId, teacherId, page: params?.page || 1, limit: params?.limit || 50 });
    const page = params?.page || 1;
    const limit = params?.limit || 50;
    const result = await enhancedCachedClient.get<TeacherClassesResponse>(`/institute-classes/${instituteId}/teacher/${teacherId}?page=${page}&limit=${limit}`, undefined, {
      forceRefresh,
      ttl: 15,
      useStaleWhileRevalidate: true,
      userId: params?.userId || teacherId,
      instituteId,
      classId: params?.classId,
      role: params?.role
    });
    console.log('📡 Teacher classes response:', result);
    return result;
  },

  // Enroll with auto-invalidation
  enroll: async (data: EnrollClassData): Promise<EnrollmentResult> => {
    return enhancedCachedClient.post('/institute-classes/enroll', data, {
      classId: data.classId
    });
  },

  // Assign students bulk with auto-invalidation
  assignStudentsBulk: async (classId: string, data: BulkAssignStudentsData, instituteId?: string): Promise<BulkAssignResponse> => {
    return enhancedCachedClient.post(`/institute-classes/${classId}/assign-students-bulk`, data, {
      classId,
      instituteId
    });
  },

  // Teacher assign students with auto-invalidation
  teacherAssignStudents: async (instituteId: string, classId: string, data: BulkAssignStudentsData): Promise<TeacherAssignResponse> => {
    // For class-level bulk assignment (admin only). Teachers with subject context should use enrollmentApi.teacherAssignStudents.
    return enhancedCachedClient.post(`/institute-classes/${classId}/assign-students-bulk`, data, {
      instituteId,
      classId
    });
  },

  // Get enrollment code with enhanced caching
  getEnrollmentCode: async (classId: string, params?: ClassQueryParams, forceRefresh = false): Promise<EnrollmentCodeResponse> => {
    return enhancedCachedClient.get(`/institute-classes/${classId}/enrollment-code`, undefined, {
      forceRefresh,
      ttl: 30,
      userId: params?.userId,
      instituteId: params?.instituteId,
      classId,
      role: params?.role
    });
  },

  // Utility methods
  hasClassesCached: (instituteId: string, params?: ClassQueryParams) => {
    return enhancedCachedClient.hasCache(`/institute-classes/institute/${instituteId}`, undefined, {
      userId: params?.userId,
      instituteId,
      classId: params?.classId,
      role: params?.role
    });
  },

  getCachedClasses: (instituteId: string, params?: ClassQueryParams) => {
    return enhancedCachedClient.getCachedOnly<InstituteClass[]>(`/institute-classes/institute/${instituteId}`, undefined, {
      userId: params?.userId,
      instituteId,
      classId: params?.classId,
      role: params?.role
    });
  },

  preloadClasses: async (instituteId: string, params?: ClassQueryParams) => {
    await enhancedCachedClient.get<InstituteClass[]>(`/institute-classes/institute/${instituteId}`, undefined, {
      ttl: 15,
      userId: params?.userId,
      instituteId,
      classId: params?.classId,
      role: params?.role
    });
  }
};
