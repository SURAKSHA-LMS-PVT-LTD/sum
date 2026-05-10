/**
 * 🛡️ SECURE NAVIGATION UTILITIES
 * 
 * Type-safe route building with proper hierarchical structure
 * NO localStorage/sessionStorage reliance - URL is the source of truth
 */

import { ROUTES, addQueryParams } from '@/config/routes';

/**
 * Build URLs with proper hierarchy validation
 */
export class RouteBuilder {
  /**
   * Navigate within institute hierarchy
   * Automatically includes parent IDs
   */
  static buildInstituteUrl(
    instituteId: string,
    path: 'dashboard' | 'details' | 'profile' | 'users' | 'classes' | 'gallery' | 'payments',
    queryParams?: Record<string, string | number | boolean | undefined>
  ): string {
    const routes = {
      dashboard: ROUTES.instituteDashboard,
      details: ROUTES.instituteDetails,
      profile: ROUTES.instituteProfile,
      users: ROUTES.instituteUsers,
      classes: ROUTES.instituteClasses,
      gallery: ROUTES.instituteGallery,
      payments: ROUTES.institutePayments
    };
    
    const baseUrl = routes[path](instituteId);
    return queryParams ? addQueryParams(baseUrl, queryParams) : baseUrl;
  }

  /**
   * Navigate within class hierarchy
   * Automatically includes institute and class IDs
   */
  static buildClassUrl(
    instituteId: string,
    classId: string,
    path: 'dashboard' | 'students' | 'subjects' | 'attendance' | 'exams',
    queryParams?: Record<string, string | number | boolean | undefined>
  ): string {
    const routes = {
      dashboard: ROUTES.classDashboard,
      students: ROUTES.classStudents,
      subjects: ROUTES.classSubjects,
      attendance: ROUTES.classAttendance,
      exams: ROUTES.classExams
    };
    
    const baseUrl = routes[path](instituteId, classId);
    return queryParams ? addQueryParams(baseUrl, queryParams) : baseUrl;
  }

  /**
   * Navigate within subject hierarchy
   * Automatically includes institute, class, and subject IDs
   */
  static buildSubjectUrl(
    instituteId: string,
    classId: string,
    subjectId: string,
    path: 'dashboard' | 'lectures' | 'homework' | 'exams' | 'results' | 'payments',
    queryParams?: Record<string, string | number | boolean | undefined>
  ): string {
    const routes = {
      dashboard: ROUTES.subjectDashboard,
      lectures: ROUTES.subjectLectures,
      homework: ROUTES.subjectHomework,
      exams: ROUTES.subjectExams,
      results: ROUTES.subjectResults,
      payments: ROUTES.subjectPayments
    };
    
    const baseUrl = routes[path](instituteId, classId, subjectId);
    return queryParams ? addQueryParams(baseUrl, queryParams) : baseUrl;
  }

  /**
   * Build lecture URL with full hierarchy
   */
  static buildLectureUrl(
    instituteId: string,
    classId: string,
    subjectId: string,
    lectureId: string,
    action?: 'update',
    queryParams?: Record<string, string | number | boolean | undefined>
  ): string {
    const baseUrl = action === 'update'
      ? ROUTES.lectureUpdate(instituteId, classId, subjectId, lectureId)
      : ROUTES.lecture(instituteId, classId, subjectId, lectureId);
    
    return queryParams ? addQueryParams(baseUrl, queryParams) : baseUrl;
  }

  /**
   * Build homework URL with full hierarchy
   */
  static buildHomeworkUrl(
    instituteId: string,
    classId: string,
    subjectId: string,
    homeworkId: string,
    action?: 'update' | 'submissions',
    queryParams?: Record<string, string | number | boolean | undefined>
  ): string {
    let baseUrl: string;
    
    if (action === 'update') {
      baseUrl = ROUTES.homeworkUpdate(instituteId, classId, subjectId, homeworkId);
    } else if (action === 'submissions') {
      baseUrl = ROUTES.homeworkSubmissions(instituteId, classId, subjectId, homeworkId);
    } else {
      baseUrl = ROUTES.homework(instituteId, classId, subjectId, homeworkId);
    }
    
    return queryParams ? addQueryParams(baseUrl, queryParams) : baseUrl;
  }

  /**
   * Build exam URL with full hierarchy
   */
  static buildExamUrl(
    instituteId: string,
    classId: string,
    subjectId: string,
    examId: string,
    action?: 'results' | 'create-results',
    queryParams?: Record<string, string | number | boolean | undefined>
  ): string {
    let baseUrl: string;
    
    if (action === 'results') {
      baseUrl = ROUTES.examResults(instituteId, classId, subjectId, examId);
    } else if (action === 'create-results') {
      baseUrl = ROUTES.examCreateResults(instituteId, classId, subjectId, examId);
    } else {
      baseUrl = ROUTES.exam(instituteId, classId, subjectId, examId);
    }
    
    return queryParams ? addQueryParams(baseUrl, queryParams) : baseUrl;
  }

  /**
   * Build organization URL
   */
  static buildOrganizationUrl(
    organizationId: string,
    path?: 'dashboard' | 'members' | 'courses' | 'lectures',
    queryParams?: Record<string, string | number | boolean | undefined>
  ): string {
    const routes = {
      dashboard: ROUTES.organizationDashboard,
      members: ROUTES.organizationMembers,
      courses: ROUTES.organizationCourses,
      lectures: ROUTES.organizationLectures
    };
    
    const baseUrl = path ? routes[path](organizationId) : ROUTES.organization(organizationId);
    return queryParams ? addQueryParams(baseUrl, queryParams) : baseUrl;
  }

  /**
   * Build child URL
   */
  static buildChildUrl(
    childId: string,
    path: 'dashboard' | 'attendance' | 'results' | 'transport',
    queryParams?: Record<string, string | number | boolean | undefined>
  ): string {
    const routes = {
      dashboard: ROUTES.childDashboard,
      attendance: ROUTES.childAttendance,
      results: ROUTES.childResults,
      transport: ROUTES.childTransport
    };
    
    const baseUrl = routes[path](childId);
    return queryParams ? addQueryParams(baseUrl, queryParams) : baseUrl;
  }

  /**
   * Build transport URL
   */
  static buildTransportUrl(
    transportId: string,
    path?: 'attendance',
    queryParams?: Record<string, string | number | boolean | undefined>
  ): string {
    const baseUrl = path === 'attendance'
      ? ROUTES.transportAttendance(transportId)
      : ROUTES.transportDetails(transportId);
    
    return queryParams ? addQueryParams(baseUrl, queryParams) : baseUrl;
  }

  /**
   * Validate that required parent IDs exist
   */
  static validateHierarchy(params: {
    instituteId?: string;
    classId?: string;
    subjectId?: string;
  }): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    
    // If subjectId exists, class and institute must exist
    if (params.subjectId) {
      if (!params.classId) missing.push('classId');
      if (!params.instituteId) missing.push('instituteId');
    }
    
    // If classId exists, institute must exist
    if (params.classId && !params.instituteId) {
      missing.push('instituteId');
    }
    
    return {
      valid: missing.length === 0,
      missing
    };
  }
}

/**
 * Hook for type-safe navigation with hierarchy validation
 */
export const useSecureNavigation = () => {
  const buildUrl = RouteBuilder;
  
  return {
    buildUrl,
    ROUTES
  };
};
