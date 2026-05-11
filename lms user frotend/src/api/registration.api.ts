/**
 * Public User Registration API
 * Uses SPECIAL_API_KEY (no JWT required)
 * Endpoint: POST /api/users/comprehensive
 */

import { getBaseUrl } from '@/contexts/utils/auth.api';
import { parseApiError } from '@/api/apiError';
import { DISTRICTS, PROVINCES, DISTRICT_TO_PROVINCE } from '@/lib/constants';

// ============= TYPES =============

export type UserType = 'USER' | 'USER_WITHOUT_PARENT' | 'USER_WITHOUT_STUDENT';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type Language = 'S' | 'E' | 'T';

export type CardDeliveryRecipient = 'SELF' | 'FATHER' | 'MOTHER' | 'GUARDIAN';

export interface StudentData {
  studentId?: string;
  emergencyContact?: string;
  medicalConditions?: string;
  allergies?: string;
  bloodGroup?: string;
  cardDeliveryRecipient?: CardDeliveryRecipient;
  fatherId?: string;
  fatherPhoneNumber?: string;
  motherId?: string;
  motherPhoneNumber?: string;
  guardianId?: string;
  guardianPhoneNumber?: string;
  fatherSkipReason?: string;
  motherSkipReason?: string;
  guardianSkipReason?: string;
}

export interface ParentData {
  occupation?: string;
  workplace?: string;
  workPhone?: string;
  educationLevel?: string;
}

export interface CreateUserRequest {
  // Required
  firstName: string;
  lastName: string;
  nameWithInitials?: string;
  email?: string;
  userType: UserType;
  gender: Gender;
  district: string;
  province: string;
  country: string;
  // Optional
  phoneNumber?: string;
  dateOfBirth?: string;
  nic?: string;
  birthCertificateNo?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  language?: Language;
  imageUrl?: string;
  idUrl?: string;
  isActive?: boolean;
  instituteId?: string;
  // Conditional
  studentData?: StudentData;
  parentData?: ParentData;
  institute?: { instituteCode: string };
}

export interface RegistrationResponse {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    userType: string;
    gender: string;
    isActive: boolean;
    createdAt: string;
    subscriptionPlan: string;
  };
  student?: any;
  parent?: any;
  summary: {
    tablesCreated: string[];
    userType: string;
    totalTablesAffected: number;
  };
}

// ============= ENUMS =============

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

// ============= API =============

const getApiKey = (): string => {
  return import.meta.env.VITE_SPECIAL_API_KEY || '';
};

export const registerUser = async (data: CreateUserRequest): Promise<RegistrationResponse> => {
  const baseUrl = getBaseUrl();
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('Registration is not configured. Please contact support.');
  }

  const response = await fetch(`${baseUrl}/users/comprehensive`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw parseApiError(response.status, errorText);
  }

  const text = await response.text().catch(() => '');
  if (!text) return {} as RegistrationResponse;
  try {
    return JSON.parse(text);
  } catch {
    return {} as RegistrationResponse;
  }
};
