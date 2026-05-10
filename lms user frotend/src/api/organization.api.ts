import { apiClient } from './client';
import { getBaseUrl2, getApiHeaders } from '@/contexts/utils/auth.api';
import { parseApiError } from '@/api/apiError';
import { enhancedCachedClient } from './enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';

export interface Organization {
  organizationId: string;
  name: string;
  type: 'INSTITUTE' | 'GLOBAL';
  isPublic: boolean;
  needEnrollmentVerification: boolean;
  imageUrl: string | null;
  instituteId: string | null;
  userRole?: string;
  isVerified?: boolean;
  joinedAt?: string;
  memberCount?: number;
  causeCount?: number;
  createdAt?: any;
  institute?: {
    instituteId: string;
    name: string;
    imageUrl: string;
  };
}

export interface OrganizationCreateData {
  name: string;
  type: 'INSTITUTE' | 'GLOBAL';
  isPublic: boolean;
  enrollmentKey?: string;
  needEnrollmentVerification?: boolean;
  enabledEnrollments?: boolean;
  imageUrl?: string;
  instituteId?: string;
}

export interface OrganizationUpdateData {
  name?: string;
  isPublic?: boolean;
  enrollmentKey?: string;
  needEnrollmentVerification?: boolean;
  enabledEnrollments?: boolean;
  imageUrl?: string;
  instituteId?: string;
}

export interface OrganizationResponse {
  data: Organization[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta: {
    sortBy: string;
    sortOrder: string;
  };
  institute?: {
    instituteId: string;
    name: string;
    imageUrl: string;
  };
}

export interface OrganizationQueryParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  type?: 'INSTITUTE' | 'GLOBAL';
  isPublic?: boolean;
  userId?: string;
  role?: string;
}

// Course/Cause interfaces
export interface Course {
  causeId: string;
  title: string;
  description: string;
  imageUrl?: string;
  introVideoUrl?: string;
  isPublic: boolean;
  organizationId: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface CourseResponse {
  data: Course[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta: {
    sortBy: string;
    sortOrder: string;
  };
}

// Course create data interface
export interface CourseCreateData {
  title: string;
  description: string;
  organizationId: string;
  introVideoUrl?: string;
  isPublic?: boolean;
  image?: File;
}

// Lecture interfaces
export interface LectureDocument {
  documentationId: string;
  title: string;
  description: string;
  docUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationLecture {
  lectureId: string;
  title: string;
  description: string;
  venue: string;
  mode: 'online' | 'physical';
  timeStart: string;
  timeEnd: string;
  liveLink: string | null;
  liveMode: string | null;
  recordingUrl: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  causeId: string;
  documents: LectureDocument[];
  documentCount: number;
}

export interface LectureResponse {
  data: OrganizationLecture[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  meta: {
    sortBy: string;
    sortOrder: string;
  };
}

class OrganizationApiClient {
  // Organization endpoints are on the main API, not a separate service
  private baseUrl = '';

  async getUserEnrolledOrganizations(params?: OrganizationQueryParams): Promise<OrganizationResponse> {
    const response = await apiClient.get<OrganizationResponse>('/organizations/user/enrolled', params);
    return response;
  }

  async getOrganizations(params?: OrganizationQueryParams): Promise<OrganizationResponse> {
    const response = await apiClient.get<OrganizationResponse>('/organizations', params);
    return response;
  }

  async getInstituteOrganizations(instituteId: string, params?: OrganizationQueryParams): Promise<OrganizationResponse> {
    const response = await apiClient.get<OrganizationResponse>(`/organizations/institute/${instituteId}`, params);
    return response;
  }

  async getCourses(params?: OrganizationQueryParams): Promise<CourseResponse> {
    const response = await apiClient.get<CourseResponse>('/causes', params);
    return response;
  }

  async getOrganizationCourses(organizationId: string, params?: OrganizationQueryParams): Promise<CourseResponse> {
    const response = await apiClient.get<CourseResponse>(`/organizations/${organizationId}/causes`, params);
    return response;
  }

  async getLectures(params?: OrganizationQueryParams): Promise<LectureResponse> {
    const response = await apiClient.get<LectureResponse>('/lectures', params);
    return response;
  }

  async createOrganization(data: OrganizationCreateData): Promise<Organization> {
    const response = await apiClient.post<Organization>('/organizations', data);
    return response;
  }

  async createCourse(data: CourseCreateData): Promise<Course> {
    const response = await apiClient.post<Course>('/causes/with-image', data);
    return response;
  }

  async getOrganizationById(id: string): Promise<Organization> {
    const response = await apiClient.get<Organization>(`/organizations/${id}`);
    return response;
  }

  async updateOrganization(id: string, data: Partial<OrganizationCreateData>): Promise<Organization> {
    const response = await apiClient.put<Organization>(`/organizations/${id}`, data);
    return response;
  }

  async deleteOrganization(id: string): Promise<void> {
    await apiClient.delete(`/organizations/${id}`);
  }

  async enrollInOrganization(data: { organizationId: string; enrollmentKey?: string }): Promise<any> {
    const response = await apiClient.post('/organizations/enroll', data);
    return response;
  }

  async transferPresidency(organizationId: string, data: { newPresidentUserId: string }): Promise<any> {
    const response = await apiClient.post(`/organizations/${organizationId}/transfer-presidency`, data);
    return response;
  }

  async updateOrganizationManagement(organizationId: string, data: OrganizationUpdateData): Promise<Organization> {
    const response = await apiClient.patch(`/organizations/${organizationId}/management`, data);
    return response;
  }

  async getUnverifiedMembers(organizationId: string): Promise<any> {
    const response = await enhancedCachedClient.get(`/organizations/${organizationId}/unverified-members`, undefined, {
      ttl: CACHE_TTL.UNVERIFIED_STUDENTS,
    });
    return response;
  }

  async verifyMember(organizationId: string, data: { userId: string; isVerified: boolean }): Promise<any> {
    const response = await apiClient.put(`/organizations/${organizationId}/verify`, data);
    return response;
  }

  async getOrganizationStudents(instituteId: string, organizationId: string, params?: OrganizationQueryParams): Promise<any> {
    const response = await enhancedCachedClient.get(`/organizations/institute/${instituteId}/organization/${organizationId}/students`, params as Record<string, any>, {
      ttl: CACHE_TTL.ORGANIZATIONS,
      instituteId,
    });
    return response;
  }

  async getEnrollmentKey(organizationId: string): Promise<{ organizationId: string; organizationName: string; isPublic: boolean; enrollmentKey: string }> {
    const response = await enhancedCachedClient.get(`/organizations/${organizationId}/enrollment-key`, undefined, {
      ttl: CACHE_TTL.SETTINGS,
    });
    return response;
  }
}

// Organization-specific API client that uses baseUrl2
class OrganizationSpecificApiClient {
  private getBaseUrl2(): string {
    return getBaseUrl2();
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const token = localStorage.getItem('org_access_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw parseApiError(response.status, errorText, response.url);
    }

    const contentType = response.headers.get('Content-Type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return {} as T;
  }

  async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const baseUrl = this.getBaseUrl2();
    const url = new URL(`${baseUrl}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders()
    });

    return this.handleResponse<T>(response);
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    const baseUrl = this.getBaseUrl2();
    const url = `${baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined
    });

    return this.handleResponse<T>(response);
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    const baseUrl = this.getBaseUrl2();
    const url = `${baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined
    });

    return this.handleResponse<T>(response);
  }

  async transferPresidency(organizationId: string, data: { newPresidentUserId: string }): Promise<any> {
    const response = await this.post(`/organizations/${organizationId}/transfer-presidency`, data);
    return response;
  }

  async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    const baseUrl = this.getBaseUrl2();
    const url = `${baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined
    });

    return this.handleResponse<T>(response);
  }

  async delete<T = any>(endpoint: string, data?: any): Promise<T> {
    const baseUrl = this.getBaseUrl2();
    const url = `${baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined
    });

    return this.handleResponse<T>(response);
  }

  async updateOrganizationManagement(organizationId: string, data: any): Promise<any> {
    const response = await this.put(`/organizations/${organizationId}/change-role`, data);
    return response;
  }

  async removeUserFromOrganization(organizationId: string, data: { userId: string }): Promise<any> {
    const baseUrl = this.getBaseUrl2();
    const url = `${baseUrl}/organizations/${organizationId}/remove-user`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });

    return this.handleResponse<any>(response);
  }
}

export const organizationApi = new OrganizationApiClient();
export const organizationSpecificApi = new OrganizationSpecificApiClient();
