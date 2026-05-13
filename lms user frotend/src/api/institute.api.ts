
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

  async getUserColumnSchema(instituteId: string): Promise<any> {
    return enhancedCachedClient.get(`/institutes/${instituteId}/user-column-schema`);
  }

  // (existing methods)
}

export const instituteApi = new InstituteApi();
