
import { apiClient } from './client';
import { enhancedCachedClient } from './enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';

export interface ParentCreateData {
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
  occupation: string;
  workplace?: string;
  workPhone?: string;
  educationLevel?: string;
  isActive?: boolean;
}

export interface Parent {
  userId: string;
  occupation: string;
  workplace?: string;
  workPhone?: string;
  educationLevel?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    dateOfBirth: string;
    gender: string;
    imageUrl?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    district?: string;
    province?: string;
    postalCode?: string;
    country?: string;
    userType: string;
    isActive: boolean;
    subscriptionPlan: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface InstituteParent {
  id: string;
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  phoneNumber?: string;
  imageUrl?: string;
  dateOfBirth?: string;
  userIdByInstitute: string | null;
  verifiedBy: string | null;
  occupation?: string;
  workPlace?: string;
}

export interface InstituteParentsResponse {
  data: InstituteParent[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ParentsResponse {
  data: Parent[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ChildData {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  relationship: string;
  imageUrl?: string;
}

export interface ParentChildrenResponse {
  parentId: string;
  parentName: string;
  children: ChildData[];
}

export interface ParentFilterParams {
  page?: number;
  limit?: number;
  occupation?: string;
  workplace?: string;
  enrolledAfter?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export const parentsApi = {
  create: async (data: ParentCreateData): Promise<Parent> => {
    const response = await apiClient.post('/parents', data);
    return response.data;
  },
  
  getInstituteParents: async (instituteId: string, params?: ParentFilterParams): Promise<InstituteParentsResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.occupation) queryParams.append('occupation', params.occupation);
    if (params?.workplace) queryParams.append('workplace', params.workplace);
    if (params?.enrolledAfter) queryParams.append('enrolledAfter', params.enrolledAfter);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    
    const url = `/institute-users/institute/${instituteId}/users/PARENT${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await enhancedCachedClient.get(url, undefined, {
      ttl: CACHE_TTL.STUDENTS,
      instituteId,
    });
    return response;
  },

  getClassParents: async (
    instituteId: string, 
    classId: string, 
    params?: ParentFilterParams
  ): Promise<InstituteParentsResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.occupation) queryParams.append('occupation', params.occupation);
    if (params?.workplace) queryParams.append('workplace', params.workplace);
    if (params?.enrolledAfter) queryParams.append('enrolledAfter', params.enrolledAfter);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    
    const url = `/institute-users/institute/${instituteId}/users/PARENT/class/${classId}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await enhancedCachedClient.get(url, undefined, {
      ttl: CACHE_TTL.STUDENTS,
      instituteId,
      classId,
    });
    return response;
  },

  getSubjectParents: async (
    instituteId: string, 
    classId: string, 
    subjectId: string,
    params?: ParentFilterParams
  ): Promise<InstituteParentsResponse> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.occupation) queryParams.append('occupation', params.occupation);
    if (params?.workplace) queryParams.append('workplace', params.workplace);
    if (params?.enrolledAfter) queryParams.append('enrolledAfter', params.enrolledAfter);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);
    
    const url = `/institute-users/institute/${instituteId}/users/PARENT/class/${classId}/subject/${subjectId}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await enhancedCachedClient.get(url, undefined, {
      ttl: CACHE_TTL.STUDENTS,
      instituteId,
      classId,
      subjectId,
    });
    return response;
  },

  getChildren: async (parentId: string): Promise<ParentChildrenResponse> => {
    const response = await enhancedCachedClient.get(`/parents/${parentId}/children`, undefined, {
      ttl: CACHE_TTL.DEFAULT,
    });
    return response;
  },
  
};
