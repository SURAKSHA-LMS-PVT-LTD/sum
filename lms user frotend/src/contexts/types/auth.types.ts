export interface User {
  id: string;
  nameWithInitials: string; // New field: "J. Doe" format
  name: string; // Computed display name (fallback to nameWithInitials)
  email: string;
  phone: string;
  userType: string;
  dateOfBirth: string;
  gender: string;
  nic: string;
  birthCertificateNo: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  province: string;
  postalCode: string;
  country: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  imageUrl: string;
  role: string;
  institutes?: Institute[]; // Optional institutes array
  
  // Deprecated fields - kept for backward compatibility
  /** @deprecated Use nameWithInitials instead */
  firstName?: string;
  /** @deprecated Use nameWithInitials instead */
  lastName?: string;
}

// Export UserRole type for use in other components
export type UserRole = 
  | 'OrganizationManager'
  | 'InstituteAdmin' 
  | 'Student' 
  | 'AttendanceMarker' 
  | 'Teacher' 
  | 'Parent'
  | 'User'
  | 'UserWithoutParent'
  | 'UserWithoutStudent';

export interface Institute {
  id: string;
  name: string;
  code: string;
  description: string;
  type?: string;
  isActive: boolean;
  instituteUserType?: string; // Raw API value: STUDENT, INSTITUTE_ADMIN, TEACHER, etc.
  userRole?: string; // Mapped role (kept for backward compatibility)
  userIdByInstitute?: string; // User's ID within this institute
  shortName?: string; // Institute's short name
  logo?: string; // Institute's logo URL
  loadingGifUrl?: string; // Custom loading animation (GIF/PNG/JPG)
  instituteUserImageUrl?: string; // User's profile image within this institute
}

export interface Class {
  id: string;
  name: string;
  code: string;
  description: string;
  grade: number;
  specialty: string;
}

export type SubjectVerificationStatus = 'verified' | 'pending' | 'rejected' | 'pending_payment' | 'payment_rejected' | 'enrolled_free_card' | 'not_enrolled';

export interface Subject {
  id: string;
  name: string;
  code: string;
  description: string;
  category?: string;
  creditHours?: number;
  isActive?: boolean;
  subjectType?: string;
  basketCategory?: string;
  instituteType?: string;
  imgUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Enrollment verification status for the current student (only relevant for Student role) */
  verificationStatus?: SubjectVerificationStatus;
}

export interface Child {
  id: string;                    // For navigation routes (userId from parent-children endpoint)
  userId: string;                // User table PK — always required
  studentId?: string;            // Student ID number
  name?: string;                 // Display name (from parent-children endpoint)
  nameWithInitials?: string;     // Name with initials
  email?: string;                // Email
  imageUrl?: string;             // Profile image URL
  relationship?: string;         // father/mother/guardian
  emergencyContact?: string;
  medicalConditions?: string;
  allergies?: string;
  bloodGroup?: string;
  user?: {
    id: string;
    nameWithInitials?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    imageUrl?: string;
    dateOfBirth?: string;
    gender?: string;
    userType?: string;
  };
}

export interface Organization {
  id: string;
  name: string;
  code: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  userRole?: string; // User's role in this organization
}

export interface LoginCredentials {
  identifier: string;  // Email, Phone, System ID, or Birth Certificate
  password?: string;
  /** When true, backend should issue long-lived refresh token (e.g. 30 days) */
  rememberMe?: boolean;
  /** Subdomain if logging in from abc.suraksha.lk */
  subdomain?: string;
  /** Custom domain if logging in from custom domain */
  customDomain?: string;
  /** Login method (auto-detected) */
  loginMethod?: 'SURAKSHA_WEB' | 'SURAKSHA_APP' | 'SUBDOMAIN' | 'CUSTOM_DOMAIN';
}

export interface InstituteLoginCredentials {
  instituteId: string;
  userIdByInstitute: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthContextType {
  user: User | null;
  selectedInstitute: Institute | null;
  selectedClass: Class | null;
  selectedSubject: Subject | null;
  selectedChild: Child | null;
  selectedOrganization: Organization | null;
  selectedTransport: { id: string; vehicleNumber: string; bookhireId: string } | null;
  selectedInstituteType: string | null;
  selectedClassGrade: number | null;
  currentInstituteId: string | null;
  currentClassId: string | null;
  currentSubjectId: string | null;
  currentChildId: string | null;
  currentOrganizationId: string | null;
  currentTransportId: string | null;
  isViewingAsParent: boolean;
  children: Child[];                                       // Cached children list (for parents)
  fetchChildren: (forceRefresh?: boolean) => Promise<Child[]>; // Fetch children from backend
  login: (credentials: LoginCredentials) => Promise<void>;
  instituteLogin: (credentials: InstituteLoginCredentials) => Promise<InstituteLoginResponse>;
  instituteLoginForce: (credentials: InstituteLoginCredentials) => Promise<InstituteLoginResponse>;
  logout: () => void;
  setSelectedInstitute: (institute: Institute | null) => void;
  setSelectedClass: (classData: Class | null) => void;
  setSelectedSubject: (subject: Subject | null) => void;
  setSelectedChild: (child: Child | null, viewAsParent?: boolean) => void;
  setSelectedOrganization: (organization: Organization | null) => void;
  setSelectedTransport: (transport: { id: string; vehicleNumber: string; bookhireId: string } | null) => void;
  loadUserInstitutes: (forceRefresh?: boolean) => Promise<Institute[]>;
  refreshUserData?: (forceRefresh?: boolean) => Promise<void>;
  validateUserToken?: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
}

// API Response types with new nameWithInitials format
import { InstituteLoginResponse } from '../utils/auth.api';

export interface ApiUserResponse {
  id: string;
  email: string;
  nameWithInitials: string;
  userType: string;
  imageUrl?: string;
  // Full user data (optional, returned from /auth/me)
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
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
  createdAt?: string;
  updatedAt?: string;
  role?: string;
}

export interface ApiResponse {
  access_token: string;
  user: ApiUserResponse;
  // Note: refresh_token is now stored in httpOnly cookie, not in response body
}
