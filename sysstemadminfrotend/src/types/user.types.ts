// ========================================
// ENUMS
// ========================================

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER'
}

export enum ProfileCompletionStatus {
  INCOMPLETE = 'INCOMPLETE',
  BASIC = 'BASIC',
  COMPLETE = 'COMPLETE'
}

export enum UserType {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORGANIZATION_MANAGER = 'ORGANIZATION_MANAGER',
  USER = 'USER',
  USER_WITHOUT_PARENT = 'USER_WITHOUT_PARENT',
  USER_WITHOUT_STUDENT = 'USER_WITHOUT_STUDENT'
}

export enum InstituteUserType {
  INSTITUTE_ADMIN = 'INSTITUTE_ADMIN',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  ATTENDANCE_MARKER = 'ATTENDANCE_MARKER',
  PARENT = 'PARENT'
}

export enum InstituteUserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
  FORMER = 'FORMER',
  INVITED = 'INVITED'
}

export enum BloodGroup {
  A_POSITIVE = 'A+',
  A_NEGATIVE = 'A-',
  B_POSITIVE = 'B+',
  B_NEGATIVE = 'B-',
  O_POSITIVE = 'O+',
  O_NEGATIVE = 'O-',
  AB_POSITIVE = 'AB+',
  AB_NEGATIVE = 'AB-'
}

export enum Language {
  SINHALA = 'S',
  ENGLISH = 'E',
  TAMIL = 'T'
}

// ========================================
// REQUEST TYPES
// ========================================

/**
 * Flexible User Data - Maps to users table
 * Minimum required: email OR phoneNumber
 */
export interface FlexibleUserData {
  // 🔴 MINIMUM REQUIRED (at least ONE)
  email?: string;
  phoneNumber?: string;
  
  // 🟢 AUTHENTICATION
  password?: string;
  
  // 🟡 BASIC INFO (users table)
  firstName?: string;
  lastName?: string;
  nameWithInitials?: string;
  fullName?: string;
  religion?: string;
  gender?: Gender;
  dateOfBirth?: string;  // YYYY-MM-DD
  nic?: string;
  birthCertificateNo?: string;
  imageUrl?: string;
  rfid?: string;
  language?: Language;

  // 🟤 USER TYPE
  userType?: UserType;
  
  // 🔵 ADDRESS (users table)
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  province?: string;
  district?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Student Data - Maps to users + students tables
 */
export interface StudentData extends FlexibleUserData {
  // 🟣 STUDENT SPECIFIC (students table)
  studentId?: string;
  emergencyContact?: string;
  medicalConditions?: string;
  allergies?: string;
  bloodGroup?: BloodGroup | string;
  cardDeliveryRecipient?: 'SELF' | 'FATHER' | 'MOTHER' | 'GUARDIAN';
}

/**
 * Parent Data - Maps to users + parents tables
 */
export interface ParentData extends FlexibleUserData {
  // 🟣 PARENT SPECIFIC (parents table)
  occupation?: string;
  workplace?: string;
  workPhone?: string;
  educationLevel?: string;
  relationshipToStudent?: string;  // For guardian only
}

/**
 * Subject Enrollment - Maps to institute_class_subject_students
 */
export interface SubjectEnrollmentRequest {
  subjectId: string;
}

/**
 * Class Enrollment - Maps to institute_class_students
 */
export interface ClassEnrollmentRequest {
  classId: string;
  subjectEnrollments?: SubjectEnrollmentRequest[];
}

/**
 * Institute Enrollment - Maps to institute_user
 */
export interface InstituteEnrollmentRequest {
  instituteId: string;
  instituteUserType?: InstituteUserType;
  userIdByInstitute?: string;
  instituteUserImageUrl?: string;
  instituteCardId?: string;
  classEnrollments?: ClassEnrollmentRequest[];
}

/**
 * Create Family Unit Request
 */
export interface CreateFamilyUnitRequest {
  student: StudentData;
  father?: ParentData;
  mother?: ParentData;
  guardian?: ParentData;
  instituteEnrollments?: InstituteEnrollmentRequest[];
  sendWelcomeNotifications?: boolean;
  autoActivateEnrollments?: boolean;
}

// ========================================
// RESPONSE TYPES
// ========================================

export interface CreatedUserResponse {
  id: string;
  email?: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  nameWithInitials?: string;
  userType: UserType;
  profileCompletionStatus: ProfileCompletionStatus;
  profileCompletionPercentage: number;
  isActive: boolean;
  firstLoginCompleted: boolean;
  hasPassword?: boolean;
}

export interface CreatedStudentResponse extends CreatedUserResponse {
  studentId: string;
  needsWelcomeFlow: boolean;
}

export interface CreatedParentResponse extends CreatedUserResponse {
  parentId: string;
  isExisting: boolean;
}

export interface CreatedSubjectEnrollmentResponse {
  instituteId: string;
  classId: string;
  subjectId: string;
  subjectName?: string;
  studentId: string;
  isActive: boolean;
  enrollmentMethod: string;
  enrolledBy?: string;
}

export interface CreatedClassEnrollmentResponse {
  instituteId: string;
  classId: string;
  className?: string;
  studentUserId: string;
  isActive: boolean;
  isVerified: boolean;
  enrollmentMethod: string;
  verifiedBy?: string;
  verifiedAt?: string;
  subjectEnrollments: CreatedSubjectEnrollmentResponse[];
}

export interface CreatedInstituteEnrollmentResponse {
  instituteId: string;
  instituteName?: string;
  userId: string;
  instituteUserType: InstituteUserType;
  status: InstituteUserStatus;
  userIdByInstitute?: string;
  instituteUserImageUrl?: string;
  instituteCardId?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  classEnrollments: CreatedClassEnrollmentResponse[];
}

export interface CreateFamilyUnitResponse {
  success: boolean;
  student: CreatedStudentResponse;
  father?: CreatedParentResponse;
  mother?: CreatedParentResponse;
  guardian?: CreatedParentResponse;
  instituteEnrollments: CreatedInstituteEnrollmentResponse[];
  notificationsSent: {
    student: boolean;
    father?: boolean;
    mother?: boolean;
    guardian?: boolean;
  };
  summary: {
    usersCreated: number;
    parentsReused: number;
    institutesEnrolled: number;
    classesEnrolled: number;
    subjectsEnrolled: number;
    allEnrollmentsActive: boolean;
    allEnrollmentsVerified: boolean;
  };
}

// ========================================
// ERROR TYPES
// ========================================

export interface ApiError {
  success: false;
  error: {
    code: 'VALIDATION_ERROR' | 'DUPLICATE_ERROR' | 'NOT_FOUND' | 'UNAUTHORIZED';
    message: string;
    field?: string;
    details?: Record<string, unknown>;
  };
}

// ========================================
// OTHER TYPES
// ========================================

export interface IncompleteProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  profileCompletionStatus: ProfileCompletionStatus;
  profileCompletionPercentage: number;
  firstLoginCompleted: boolean;
  createdAt: string;
}

export interface BulkCreateResult {
  success: boolean;
  totalFamilies: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    index: number;
    success: boolean;
    student?: { id: string; studentId: string };
    father?: { id: string; isExisting: boolean };
    mother?: { id: string; isExisting: boolean };
    guardian?: { id: string; isExisting: boolean };
    instituteEnrollments?: CreatedInstituteEnrollmentResponse[];
    error?: {
      code: string;
      message: string;
      field?: string;
    };
  }>;
}

// ========================================
// INSTITUTE/CLASS/SUBJECT TYPES
// ========================================

export interface Institute {
  id: string;
  name: string;
  code?: string;
  type?: string;
  status?: string;
}

export interface InstituteClass {
  id: string;
  name: string;
  instituteId: string;
  grade?: string;
  section?: string;
}

export interface Subject {
  id: string;
  name: string;
  code?: string;
}
