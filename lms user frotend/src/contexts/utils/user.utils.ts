import { User, UserRole, Institute, ApiUserResponse } from '../types/auth.types';

// Updated user type mapping to handle backend enum
export const mapUserTypeToRole = (userType: string): UserRole => {
  const typeMapping: Record<string, UserRole> = {
    'ORGANIZATION_MANAGER': 'OrganizationManager',
    'INSTITUTE_ADMIN': 'InstituteAdmin',
    'STUDENT': 'Student',
    'ATTENDANCE_MARKER': 'AttendanceMarker',
    'ATTEDANCE_MARKER': 'AttendanceMarker',
    'TEACHER': 'Teacher',
    'PARENT': 'Parent',
    'USER': 'User',
    'USER_WITHOUT_PARENT': 'UserWithoutParent',
    'USER_WITHOUT_STUDENT': 'UserWithoutStudent',
    'ORGANIZATIONMANAGER': 'OrganizationManager'
  };
  return typeMapping[userType?.toUpperCase()] || 'User';
};

/**
 * Generates nameWithInitials from firstName and lastName
 * Format: "J. Doe" or "J." or "Doe" or ""
 */
export const generateNameWithInitials = (firstName?: string, lastName?: string): string => {
  const first = firstName?.trim();
  const last = lastName?.trim();
  
  if (first && last) {
    return `${first.charAt(0).toUpperCase()}. ${last}`;
  } else if (first) {
    return `${first.charAt(0).toUpperCase()}.`;
  } else if (last) {
    return last;
  }
  return '';
};

/**
 * Maps API user response to internal User type
 * Handles both new (nameWithInitials) and legacy (firstName/lastName) formats
 */
export const mapUserData = (apiUser: any, institutes: Institute[] = []): User => {
  // Handle new API format with nameWithInitials
  const nameWithInitials = apiUser.nameWithInitials || 
    generateNameWithInitials(apiUser.firstName, apiUser.lastName);
  
  // Generate display name from nameWithInitials or legacy fields
  const displayName = apiUser.name || 
    nameWithInitials || 
    `${apiUser.firstName || ''} ${apiUser.lastName || ''}`.trim() ||
    'User';

  return {
    id: apiUser.id || '',
    nameWithInitials: nameWithInitials,
    name: displayName,
    email: apiUser.email || '',
    phone: apiUser.phone || '',
    userType: apiUser.userType || '',
    dateOfBirth: apiUser.dateOfBirth || '',
    gender: apiUser.gender || '',
    nic: apiUser.nic || '',
    birthCertificateNo: apiUser.birthCertificateNo || '',
    addressLine1: apiUser.addressLine1 || '',
    addressLine2: apiUser.addressLine2 || '',
    city: apiUser.city || '',
    district: apiUser.district || '',
    province: apiUser.province || '',
    postalCode: apiUser.postalCode || '',
    country: apiUser.country || '',
    isActive: apiUser.isActive ?? true,
    createdAt: apiUser.createdAt || '',
    updatedAt: apiUser.updatedAt || '',
    imageUrl: apiUser.imageUrl || '',
    role: mapUserTypeToRole(apiUser.userType),
    institutes: institutes,
    // Deprecated fields for backward compatibility
    firstName: apiUser.firstName,
    lastName: apiUser.lastName,
  };
};

/**
 * Maps minimal user data from token refresh response
 */
export const mapMinimalUserData = (userData: ApiUserResponse): Partial<User> => {
  return {
    id: userData.id,
    email: userData.email,
    nameWithInitials: userData.nameWithInitials,
    name: userData.nameWithInitials || 'User',
    userType: userData.userType,
    imageUrl: userData.imageUrl || '',
  };
};
