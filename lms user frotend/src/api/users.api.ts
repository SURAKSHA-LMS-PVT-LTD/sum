
import { apiClient } from './client';

export interface UserCreateData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  userType: string;
  nic?: string;
  birthCertificateNo?: string;
  dateOfBirth: string;
  gender: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  district?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  imageUrl?: string;
  idUrl?: string;
  isActive?: boolean;
  subscriptionPlan?: string;
  paymentExpiresAt?: string;
}

export interface UpgradeUserTypeData {
  studentData?: {
    emergencyContact?: string;
    medicalConditions?: string;
    allergies?: string;
    bloodGroup?: string;
  };
  parentData?: {
    occupation?: string;
    workplace?: string;
    workPhone?: string;
    educationLevel?: string;
  };
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  userType: string;
  dateOfBirth: string;
  gender: string;
  imageUrl?: string;
  telegramId?: string;
  rfid?: string;
  isActive: boolean;
  subscriptionPlan: string;
  paymentExpiresAt?: string;
  createdAt: string;
}

export interface BasicUser {
  id: string;
  imageUrl?: string;
  fullName: string;
  userType: string;
}

export interface UserLookupResult {
  id: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  imageUrl?: string;
  userType: string;
  phoneNumber?: string;
  email?: string;
}

/**
 * Normalizes a Sri Lankan phone number to E.164 format (+94XXXXXXXXX).
 * Handles inputs like: 0771234567, 94771234567, +94771234567, 771234567
 */
export function normalizePhoneNumber(input: string): string {
  const cleaned = input.trim().replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+94')) return cleaned;
  if (cleaned.startsWith('0094')) return '+94' + cleaned.slice(4);
  if (/^94\d{9}$/.test(cleaned)) return '+' + cleaned;
  if (/^0\d{9}$/.test(cleaned)) return '+94' + cleaned.slice(1);
  return cleaned;
}

export const usersApi = {
  create: async (data: UserCreateData): Promise<User> => {
    const response = await apiClient.post('/users/comprehensive', data);
    return response.data;
  },
  
  getBasicInfo: async (userId: string): Promise<BasicUser> => {
    const response = await apiClient.get(`/users/basic/${userId}`);
    return response;
  },

  getBasicInfoByRfid: async (rfid: string): Promise<BasicUser> => {
    const response = await apiClient.get(`/users/basic/rfid/${rfid}`);
    return response;
  },

  /** Lookup an existing user by normalized phone number (E.164 format) */
  lookupByPhone: async (phone: string): Promise<UserLookupResult> => {
    const normalized = normalizePhoneNumber(phone);
    const response = await apiClient.get(`/users/basic/phone/${encodeURIComponent(normalized)}`);
    return response;
  },

  /** Lookup an existing user by email address */
  lookupByEmail: async (email: string): Promise<UserLookupResult> => {
    const response = await apiClient.get(`/users/basic/email/${encodeURIComponent(email)}`);
    return response;
  },

  upgradeUserType: async (data: UpgradeUserTypeData): Promise<User> => {
    return await apiClient.patch<User>('/users/upgrade-type', data);
  },
};
