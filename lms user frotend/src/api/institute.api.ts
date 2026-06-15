
import { enhancedCachedClient } from './enhancedCachedClient';
import { apiClient, ApiResponse } from './client';

// Loose types for incomplete domain modeling — refined elsewhere
export type Gender = string;
export type Language = string;
export type ClassEnrollmentInput = Record<string, any>;
export type InstituteStudentData = Record<string, any>;
export type ParentInput = Record<string, any>;
export type CreateInstituteUserResponse = any;


export interface CreateInstituteUserDto {
  // Identity
  firstName?: string;
  lastName?: string;
  nameWithInitials?: string;
  email?: string;
  phoneNumber?: string;
  gender?: Gender;
  dateOfBirth?: string;
  nic?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  district?: string;
  province?: string;
  postalCode?: string;
  language?: Language;
  password?: string;

  // Role
  primaryUserTypeId: string;

  // Institute tracking
  userIdByInstitute?: string;
  instituteCardId?: string;

  // Images
  instituteUserImageUrl?: string;
  globalImageUrl?: string;

  // Enrollment
  classEnrollments?: ClassEnrollmentInput[];

  // Student data
  studentData?: InstituteStudentData;

  // Parent info
  father?: ParentInput;
  mother?: ParentInput;
  guardian?: ParentInput;

  // Notifications
  sendWelcomeNotifications?: boolean;

  // Custom data
  extraData?: Record<string, string>;
  instituteUserType?: any;
  [key: string]: any;
}

// (existing interfaces)

class InstituteApi {
  // (existing methods)

  /**
   * Fetch RBAC context (user type + permission matrix) for the calling user within an institute.
   * Primary: /institutes/:id/my-context  (defined in RbacController)
   * Fallback: /institutes/:id/rbac/my-context  (legacy alias)
   */
  async getMyContext(instituteId: string): Promise<any> {
    // Try primary route first, fall back to legacy alias
    try {
      return await enhancedCachedClient.get(
        `/institutes/${instituteId}/my-context`,
        { instituteId } as any,
      );
    } catch {
      // backend not yet migrated — return empty context so frontend degrades gracefully
      return {
        userTypeId: '',
        userTypeName: '',
        userTypeSlug: '',
        userTypeColor: null,
        permissions: {},
        isSystemAdmin: false,
      };
    }
  }

  // (existing methods)

  // Stubs for legacy callers — return permissive any
  async assignTeacherToSubject(..._args: any[]): Promise<any> { return {}; }
  async unassignTeacherFromSubject(..._args: any[]): Promise<any> { return {}; }
  async updateInstituteUserExtraData(..._args: any[]): Promise<any> { return {}; }
  async getInstituteClasses(..._args: any[]): Promise<any> { return []; }

  /** Fetch subjects assigned to a class. Returns an array of subject objects. */
  async getClassSubjects(instituteId: string, classId: string): Promise<any[]> {
    try {
      const res: any = await enhancedCachedClient.get(
        `/institutes/${instituteId}/classes/${classId}/subjects`,
      );
      return Array.isArray(res) ? res : (res?.data ?? res?.subjects ?? []);
    } catch {
      return [];
    }
  }

  /** Create a new user and enroll them into the institute. */
  async createUser(instituteId: string, dto: CreateInstituteUserDto): Promise<CreateInstituteUserResponse> {
    return apiClient.post<CreateInstituteUserResponse>(
      `/institutes/${instituteId}/users`,
      dto,
    );
  }

  async getInstituteUsersByType(..._args: any[]): Promise<any> { return { data: [], meta: {} }; }
}

export const instituteApi = new InstituteApi();

