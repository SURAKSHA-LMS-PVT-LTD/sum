
import { apiClient } from './client';
import { enhancedCachedClient } from './enhancedCachedClient';

export interface StudentCreateData {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    userType: string;
    dateOfBirth: string;
    gender: string;
    nic?: string;
    birthCertificateNo?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    district?: string;
    province?: string;
    postalCode?: string;
    country?: string;
    isActive?: boolean;
  };
  fatherId?: string | null;
  motherId?: string | null;
  guardianId?: string | null;
  studentId: string;
  emergencyContact: string;
  medicalConditions?: string;
  allergies?: string;
  bloodGroup?: string;
  isActive?: boolean;
}

export interface Student {
  userId: string;
  fatherId: string | null;
  motherId: string | null;
  guardianId: string | null;
  studentId: string;
  emergencyContact: string;
  medicalConditions?: string;
  allergies?: string;
  bloodGroup?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    userType: string;
    dateOfBirth: string;
    gender: string;
    imageUrl?: string;
    isActive: boolean;
    subscriptionPlan: string;
    createdAt: string;
  };
}

export interface AssignParentData {
  parentUserId: string;
  parentType: 'father' | 'mother' | 'guardian';
}

export interface AssignParentResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

export interface GetStudentParams {
  userId?: string;
  role?: string;
  instituteId?: string;
  classId?: string;
}

export const studentsApi = {
  // Get single student by userId with enhanced caching
  getById: async (userId: string, params?: GetStudentParams, forceRefresh = false): Promise<Student> => {
    return enhancedCachedClient.get(`/students/${userId}`, undefined, {
      forceRefresh,
      ttl: 15,
      useStaleWhileRevalidate: true,
      userId: params?.userId,
      instituteId: params?.instituteId,
      classId: params?.classId,
      role: params?.role
    });
  },

  // Create student with auto-invalidation
  create: async (data: StudentCreateData, instituteId?: string): Promise<Student> => {
    return enhancedCachedClient.post('/students', data, {
      instituteId
    });
  },
  
  // Assign parent with auto-invalidation
  assignParent: async (studentId: string, data: AssignParentData, instituteId?: string): Promise<AssignParentResponse> => {
    return enhancedCachedClient.patch(`/students/${studentId}/assign-parent`, data, {
      instituteId
    });
  },

  // Utility methods
  hasStudentCached: async (userId: string, params?: GetStudentParams): Promise<boolean> => {
    return enhancedCachedClient.hasCache(`/students/${userId}`, undefined, {
      userId: params?.userId,
      instituteId: params?.instituteId,
      classId: params?.classId,
      role: params?.role
    });
  },

  getCachedStudent: async (userId: string, params?: GetStudentParams): Promise<Student | null> => {
    return enhancedCachedClient.getCachedOnly<Student>(`/students/${userId}`, undefined, {
      userId: params?.userId,
      instituteId: params?.instituteId,
      classId: params?.classId,
      role: params?.role
    });
  },

  preloadStudent: async (userId: string, params?: GetStudentParams): Promise<void> => {
    await enhancedCachedClient.get<Student>(`/students/${userId}`, undefined, {
      ttl: 15,
      userId: params?.userId,
      instituteId: params?.instituteId,
      classId: params?.classId,
      role: params?.role
    });
  }
};
