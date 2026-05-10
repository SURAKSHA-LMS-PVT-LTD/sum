/**
 * 🛡️ PRODUCTION-STANDARD ROUTE CONFIGURATION
 * 
 * Hierarchical URL structure following industry best practices:
 * - Path params for resource identity (instituteId, classId, etc.)
 * - Query params only for filters (page, search, sort)
 * - URL is the source of truth (NO localStorage/sessionStorage)
 */

// ============================================
// ROUTE PATTERNS (for React Router)
// ============================================

export const ROUTE_PATTERNS = {
  // Root & Auth
  ROOT: '/',
  DASHBOARD: '/dashboard',
  LOGIN: '/login',
  ACTIVATE_IDENTIFY: '/activate/identify',
  ACTIVATE_VERIFY: '/activate/verify',
  ACTIVATE_PROFILE: '/activate/profile',
  
  // Institute Hierarchy
  INSTITUTES: '/institutes',
  INSTITUTE: '/institute/:instituteId',
  INSTITUTE_DASHBOARD: '/institute/:instituteId/dashboard',
  INSTITUTE_DETAILS: '/institute/:instituteId/details',
  INSTITUTE_PROFILE: '/institute/:instituteId/profile',
  INSTITUTE_USERS: '/institute/:instituteId/users',
  INSTITUTE_CLASSES: '/institute/:instituteId/classes',
  INSTITUTE_GALLERY: '/institute/:instituteId/gallery',
  INSTITUTE_PAYMENTS: '/institute/:instituteId/payments',
  INSTITUTE_SUBJECTS: '/institute/:instituteId/subjects',
  
  // Class Hierarchy
  CLASS: '/institute/:instituteId/class/:classId',
  CLASS_DASHBOARD: '/institute/:instituteId/class/:classId/dashboard',
  CLASS_STUDENTS: '/institute/:instituteId/class/:classId/students',
  CLASS_SUBJECTS: '/institute/:instituteId/class/:classId/subjects',
  CLASS_ATTENDANCE: '/institute/:instituteId/class/:classId/attendance',
  CLASS_EXAMS: '/institute/:instituteId/class/:classId/exams',
  
  // Subject Hierarchy
  SUBJECT: '/institute/:instituteId/class/:classId/subject/:subjectId',
  SUBJECT_DASHBOARD: '/institute/:instituteId/class/:classId/subject/:subjectId/dashboard',
  SUBJECT_LECTURES: '/institute/:instituteId/class/:classId/subject/:subjectId/lectures',
  SUBJECT_HOMEWORK: '/institute/:instituteId/class/:classId/subject/:subjectId/homework',
  SUBJECT_EXAMS: '/institute/:instituteId/class/:classId/subject/:subjectId/exams',
  SUBJECT_RESULTS: '/institute/:instituteId/class/:classId/subject/:subjectId/results',
  SUBJECT_PAYMENTS: '/institute/:instituteId/class/:classId/subject/:subjectId/payments',
  
  // Lecture Details
  LECTURE_VIEW: '/institute/:instituteId/class/:classId/subject/:subjectId/lecture/:lectureId',
  LECTURE_UPDATE: '/institute/:instituteId/class/:classId/subject/:subjectId/lecture/:lectureId/update',
  
  // Homework Details
  HOMEWORK_VIEW: '/institute/:instituteId/class/:classId/subject/:subjectId/homework/:homeworkId',
  HOMEWORK_UPDATE: '/institute/:instituteId/class/:classId/subject/:subjectId/homework/:homeworkId/update',
  HOMEWORK_SUBMISSIONS: '/institute/:instituteId/class/:classId/subject/:subjectId/homework/:homeworkId/submissions',
  
  // Exam Details
  EXAM_VIEW: '/institute/:instituteId/class/:classId/subject/:subjectId/exam/:examId',
  EXAM_RESULTS: '/institute/:instituteId/class/:classId/subject/:subjectId/exam/:examId/results',
  EXAM_CREATE_RESULTS: '/institute/:instituteId/class/:classId/subject/:subjectId/exam/:examId/create-results',
  
  // Organization Routes
  ORGANIZATIONS: '/organizations',
  ORGANIZATION: '/organization/:organizationId',
  ORGANIZATION_DASHBOARD: '/organization/:organizationId/dashboard',
  ORGANIZATION_MEMBERS: '/organization/:organizationId/members',
  ORGANIZATION_COURSES: '/organization/:organizationId/courses',
  ORGANIZATION_LECTURES: '/organization/:organizationId/lectures',
  
  // Parent/Child Routes
  MY_CHILDREN: '/my-children',
  CHILD_DASHBOARD: '/child/:childId/dashboard',
  CHILD_ATTENDANCE: '/child/:childId/attendance',
  CHILD_RESULTS: '/child/:childId/results',
  CHILD_TRANSPORT: '/child/:childId/transport',
  
  // Transport Routes
  TRANSPORT: '/transport',
  TRANSPORT_DETAILS: '/transport/:transportId',
  TRANSPORT_ATTENDANCE: '/transport/:transportId/attendance',
  
  // User Management (Global - requires SuperAdmin)
  USERS: '/users',
  STUDENTS: '/students',
  TEACHERS: '/teachers',
  PARENTS: '/parents',
  
  // Settings & Profile
  PROFILE: '/profile',
  SETTINGS: '/settings',
  SESSIONS: '/sessions',
  APPEARANCE: '/appearance',
  
  // Special Routes
  QR_ATTENDANCE: '/qr-attendance',
  RFID_ATTENDANCE: '/rfid-attendance',
  SMS_HISTORY: '/sms-history',
  ENROLLMENT_MANAGEMENT: '/enrollment-management',
  
  // 404
  NOT_FOUND: '*'
} as const;

// ============================================
// ROUTE BUILDERS (Type-safe URL construction)
// ============================================

export const ROUTES = {
  // Root
  dashboard: () => '/dashboard',
  
  // Institute
  institutes: () => '/institutes',
  institute: (instituteId: string) => `/institute/${instituteId}`,
  instituteDashboard: (instituteId: string) => `/institute/${instituteId}/dashboard`,
  instituteDetails: (instituteId: string) => `/institute/${instituteId}/details`,
  instituteProfile: (instituteId: string) => `/institute/${instituteId}/profile`,
  instituteUsers: (instituteId: string) => `/institute/${instituteId}/users`,
  instituteClasses: (instituteId: string) => `/institute/${instituteId}/classes`,
  instituteGallery: (instituteId: string) => `/institute/${instituteId}/gallery`,
  institutePayments: (instituteId: string) => `/institute/${instituteId}/payments`,
  instituteSubjects: (instituteId: string) => `/institute/${instituteId}/subjects`,
  
  // Class
  class: (instituteId: string, classId: string) => 
    `/institute/${instituteId}/class/${classId}`,
  classDashboard: (instituteId: string, classId: string) => 
    `/institute/${instituteId}/class/${classId}/dashboard`,
  classStudents: (instituteId: string, classId: string) => 
    `/institute/${instituteId}/class/${classId}/students`,
  classSubjects: (instituteId: string, classId: string) => 
    `/institute/${instituteId}/class/${classId}/subjects`,
  classAttendance: (instituteId: string, classId: string) => 
    `/institute/${instituteId}/class/${classId}/attendance`,
  classExams: (instituteId: string, classId: string) => 
    `/institute/${instituteId}/class/${classId}/exams`,
  
  // Subject
  subject: (instituteId: string, classId: string, subjectId: string) => 
    `/institute/${instituteId}/class/${classId}/subject/${subjectId}`,
  subjectDashboard: (instituteId: string, classId: string, subjectId: string) => 
    `/institute/${instituteId}/class/${classId}/subject/${subjectId}/dashboard`,
  subjectLectures: (instituteId: string, classId: string, subjectId: string) => 
    `/institute/${instituteId}/class/${classId}/subject/${subjectId}/lectures`,
  subjectHomework: (instituteId: string, classId: string, subjectId: string) => 
    `/institute/${instituteId}/class/${classId}/subject/${subjectId}/homework`,
  subjectExams: (instituteId: string, classId: string, subjectId: string) => 
    `/institute/${instituteId}/class/${classId}/subject/${subjectId}/exams`,
  subjectResults: (instituteId: string, classId: string, subjectId: string) => 
    `/institute/${instituteId}/class/${classId}/subject/${subjectId}/results`,
  subjectPayments: (instituteId: string, classId: string, subjectId: string) => 
    `/institute/${instituteId}/class/${classId}/subject/${subjectId}/payments`,
  
  // Lecture
  lecture: (instituteId: string, classId: string, subjectId: string, lectureId: string) => 
    `/institute/${instituteId}/class/${classId}/subject/${subjectId}/lecture/${lectureId}`,
  lectureUpdate: (instituteId: string, classId: string, subjectId: string, lectureId: string) => 
    `/institute/${instituteId}/class/${classId}/subject/${subjectId}/lecture/${lectureId}/update`,
  
  // Homework
  homework: (instituteId: string, classId: string, subjectId: string, homeworkId: string) => 
    `/institute/${instituteId}/class/${classId}/subject/${subjectId}/homework/${homeworkId}`,
  homeworkUpdate: (instituteId: string, classId: string, subjectId: string, homeworkId: string) => 
    `/institute/${instituteId}/class/${classId}/subject/${subjectId}/homework/${homeworkId}/update`,
  homeworkSubmissions: (instituteId: string, classId: string, subjectId: string, homeworkId: string) => 
    `/institute/${instituteId}/class/${classId}/subject/${subjectId}/homework/${homeworkId}/submissions`,
  
  // Exam
  exam: (instituteId: string, classId: string, subjectId: string, examId: string) => 
    `/institute/${instituteId}/class/${classId}/subject/${subjectId}/exam/${examId}`,
  examResults: (instituteId: string, classId: string, subjectId: string, examId: string) => 
    `/institute/${instituteId}/class/${classId}/subject/${subjectId}/exam/${examId}/results`,
  examCreateResults: (instituteId: string, classId: string, subjectId: string, examId: string) => 
    `/institute/${instituteId}/class/${classId}/subject/${subjectId}/exam/${examId}/create-results`,
  
  // Organization
  organizations: () => '/organizations',
  organization: (organizationId: string) => `/organization/${organizationId}`,
  organizationDashboard: (organizationId: string) => `/organization/${organizationId}/dashboard`,
  organizationMembers: (organizationId: string) => `/organization/${organizationId}/members`,
  organizationCourses: (organizationId: string) => `/organization/${organizationId}/courses`,
  organizationLectures: (organizationId: string) => `/organization/${organizationId}/lectures`,
  
  // Parent/Child
  myChildren: () => '/my-children',
  childDashboard: (childId: string) => `/child/${childId}/dashboard`,
  childAttendance: (childId: string) => `/child/${childId}/attendance`,
  childResults: (childId: string) => `/child/${childId}/results`,
  childTransport: (childId: string) => `/child/${childId}/transport`,
  
  // Transport
  transport: () => '/transport',
  transportDetails: (transportId: string) => `/transport/${transportId}`,
  transportAttendance: (transportId: string) => `/transport/${transportId}/attendance`,
  
  // User Management
  users: () => '/users',
  students: () => '/students',
  teachers: () => '/teachers',
  parents: () => '/parents',
  
  // Profile & Settings
  profile: () => '/profile',
  settings: () => '/settings',
  sessions: () => '/sessions',
  appearance: () => '/appearance',
  
  // Special
  qrAttendance: () => '/qr-attendance',
  rfidAttendance: () => '/rfid-attendance',
  smsHistory: () => '/sms-history',
  enrollmentManagement: (params: { instituteId: string; classId: string; subjectId: string; subjectName?: string; className?: string }) => {
    const searchParams = new URLSearchParams({
      instituteId: params.instituteId,
      classId: params.classId,
      subjectId: params.subjectId,
      ...(params.subjectName && { subjectName: params.subjectName }),
      ...(params.className && { className: params.className })
    });
    return `/enrollment-management?${searchParams.toString()}`;
  }
} as const;

// ============================================
// QUERY PARAM HELPERS
// ============================================

export const addQueryParams = (baseUrl: string, params: Record<string, string | number | boolean | undefined>): string => {
  const url = new URL(baseUrl, window.location.origin);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });
  
  return url.pathname + url.search;
};

// Example: addQueryParams('/institute/123/classes', { page: 1, search: 'Math' })
// Result: '/institute/123/classes?page=1&search=Math'
