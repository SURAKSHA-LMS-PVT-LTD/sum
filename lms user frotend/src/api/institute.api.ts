
import { enhancedCachedClient } from './enhancedCachedClient';
import { apiClient, ApiResponse } from './client';

// (existing interfaces)

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

  async getUserColumnSchema(instituteId: string): Promise<any> {
    return enhancedCachedClient.get(`/institutes/${instituteId}/user-column-schema`);
  }

  // (existing methods)
}

export const instituteApi = new InstituteApi();
