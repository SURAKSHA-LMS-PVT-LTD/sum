
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

export type Permission = 
  | 'view-dashboard'
  | 'view-users'
  | 'create-user'
  | 'edit-user'
  | 'delete-user'
  | 'view-students'
  | 'create-student'
  | 'edit-student'
  | 'delete-student'
  | 'view-parents'
  | 'create-parent'
  | 'edit-parent'
  | 'delete-parent'
  | 'view-teachers'
  | 'create-teacher'
  | 'edit-teacher'
  | 'delete-teacher'
  | 'view-classes'
  | 'create-class'
  | 'edit-class'
  | 'delete-class'
  | 'view-subjects'
  | 'create-subject'
  | 'edit-subject'
  | 'delete-subject'
  | 'view-institutes'
  | 'create-institute'
  | 'edit-institute'
  | 'delete-institute'
  | 'view-attendance'
  | 'mark-attendance'
  | 'manage-attendance-markers'
  | 'create-attendance-marker'
  | 'edit-attendance-marker'
  | 'delete-attendance-marker'
  | 'view-attendance-marker-details'
  | 'view-grades'
  | 'create-grade'
  | 'edit-grade'
  | 'delete-grade'
  | 'view-grading'
  | 'create-grading'
  | 'edit-grading'
  | 'delete-grading'
  | 'grade-assignments'
  | 'manage-grades'
  | 'view-lectures'
  | 'create-lecture'
  | 'edit-lecture'
  | 'delete-lecture'
  | 'view-gallery'
  | 'view-homework'
  | 'create-homework'
  | 'edit-homework'
  | 'delete-homework'
  | 'view-homework-submissions'
  | 'view-exams'
  | 'create-exam'
  | 'edit-exam'
  | 'delete-exam'
  | 'view-results'
  | 'create-result'
  | 'edit-result'
  | 'delete-result'
  | 'view-profile'
  | 'edit-profile'
  | 'view-institute-details'
  | 'edit-institute-details'
  | 'view-organizations'
  | 'create-organization'
  | 'edit-organization'
  | 'delete-organization'
  | 'view-settings'
  | 'view-appearance'
  | 'view-transport'
  | 'manage-transport'
  | 'view-payments'
  | 'view-submissions';

const rolePermissions: Record<UserRole, Permission[]> = {
  Student: [
    'view-dashboard',
    'view-classes',
    'view-subjects',
    'view-students',
    'view-grades',
    'view-lectures',
    'view-homework',
    'view-exams',
    'view-results',
    'view-profile',
    'edit-profile',
    'view-appearance',
    'view-transport',
    'view-payments',
    'view-submissions'
  ],
  Parent: [
    'view-dashboard',
    'view-students',
    'view-attendance',
    'view-grades',
    'view-lectures',
    'view-homework',
    'view-exams',
    'view-results',
    'view-profile',
    'edit-profile',
    'view-appearance',
    'view-transport',
    'view-payments',
    'view-submissions'
  ],
  Teacher: [
    'view-dashboard',
    'view-users',
    'view-students',
    'create-student',
    'edit-student',
    'delete-student',
    'view-parents',
    'view-classes',
    'view-subjects',
    'view-attendance',
    'mark-attendance',
    'view-grades',
    'create-grade',
    'edit-grade',
    'delete-grade',
    'view-grading',
    'create-grading',
    'edit-grading',
    'delete-grading',
    'grade-assignments',
    'manage-grades',
    'view-lectures',
    'create-lecture',
    'edit-lecture',
    'delete-lecture',
    'view-homework',
    'create-homework',
    'edit-homework',
    'delete-homework',
    'view-homework-submissions',
    'view-exams',
    'create-exam',
    'edit-exam',
    'delete-exam',
    'view-results',
    'create-result',
    'edit-result',
    'delete-result',
    'view-profile',
    'edit-profile',
    'view-appearance',
    'view-transport',
    'view-payments',
    'view-submissions'
  ],
  AttendanceMarker: [
    'view-dashboard',
    'view-students',
    'view-classes',
    'view-subjects',
    'view-attendance',
    'mark-attendance',
    'view-profile',
    'edit-profile',
    'view-appearance',
    'view-transport',
    'manage-transport'
  ],
  InstituteAdmin: [
    'view-dashboard',
    'view-users',
    'create-user',
    'edit-user',
    'delete-user',
    'view-students',
    'create-student',
    'edit-student',
    'delete-student',
    'view-parents',
    'create-parent',
    'edit-parent',
    'delete-parent',
    'view-teachers',
    'create-teacher',
    'edit-teacher',
    'delete-teacher',
    'view-classes',
    'create-class',
    'edit-class',
    'delete-class',
    'view-subjects',
    'create-subject',
    'edit-subject',
    'delete-subject',
    'view-institutes',
    'create-institute',
    'edit-institute',
    'delete-institute',
    'view-attendance',
    'mark-attendance',
    'manage-attendance-markers',
    'create-attendance-marker',
    'edit-attendance-marker',
    'delete-attendance-marker',
    'view-attendance-marker-details',
    'view-grades',
    'create-grade',
    'edit-grade',
    'delete-grade',
    'view-grading',
    'create-grading',
    'edit-grading',
    'delete-grading',
    'grade-assignments',
    'manage-grades',
    'view-lectures',
    'create-lecture',
    'edit-lecture',
    'delete-lecture',
    'view-homework',
    'create-homework',
    'edit-homework',
    'delete-homework',
    'view-homework-submissions',
    'view-exams',
    'create-exam',
    'edit-exam',
    'delete-exam',
    'view-results',
    'create-result',
    'edit-result',
    'delete-result',
'view-profile',
  'edit-profile',
  'view-institute-details',
  'edit-institute-details',
  'view-appearance',
  'view-organizations',
  'view-transport',
  'manage-transport',
  'view-payments',
  'view-submissions'
  ],
  OrganizationManager: [
    'view-dashboard',
    'view-students',
    'create-student',
    'edit-student',
    'delete-student',
    'view-lectures',
    'create-lecture',
    'edit-lecture',
    'delete-lecture',
    'view-gallery',
    'view-users',
    'create-user',
    'edit-user',
    'delete-user',
    'view-parents',
    'create-parent',
    'edit-parent',
    'delete-parent',
    'view-teachers',
    'create-teacher',
    'edit-teacher',
    'delete-teacher',
    'view-grades',
    'create-grade',
    'edit-grade',
    'delete-grade',
    'view-classes',
    'create-class',
    'edit-class',
    'delete-class',
    'view-subjects',
    'create-subject',
    'edit-subject',
    'delete-subject',
    'view-institutes',
    'create-institute',
    'edit-institute',
    'delete-institute',
    'view-attendance',
    'mark-attendance',
    'manage-attendance-markers',
    'create-attendance-marker',
    'edit-attendance-marker',
    'delete-attendance-marker',
    'view-attendance-marker-details',
    'view-grading',
    'create-grading',
    'edit-grading',
    'delete-grading',
    'grade-assignments',
    'manage-grades',
    'view-homework',
    'create-homework',
    'edit-homework',
    'delete-homework',
    'view-homework-submissions',
    'view-exams',
    'create-exam',
    'edit-exam',
    'delete-exam',
    'view-results',
    'create-result',
    'edit-result',
    'delete-result',
    'view-organizations',
    'create-organization',
    'edit-organization',
    'delete-organization',
    'view-profile',
    'edit-profile',
    'view-settings',
    'view-appearance',
    'view-transport',
    'manage-transport'
  ],
  User: [
    'view-dashboard',
    'view-users',
    'view-students',
    'create-student',
    'edit-student',
    'view-parents',
    'create-parent',
    'edit-parent',
    'view-teachers',
    'view-classes',
    'view-subjects',
    'view-attendance',
    'mark-attendance',
    'view-grades',
    'create-grade',
    'edit-grade',
    'view-grading',
    'view-lectures',
    'create-lecture',
    'edit-lecture',
    'view-homework',
    'create-homework',
    'edit-homework',
    'view-homework-submissions',
    'view-exams',
    'create-exam',
    'edit-exam',
    'view-results',
    'create-result',
    'edit-result',
    'view-profile',
    'edit-profile',
    'view-appearance',
    'view-transport'
  ],
  UserWithoutParent: [
    'view-dashboard',
    'view-users',
    'view-students',
    'create-student',
    'edit-student',
    'view-teachers',
    'view-classes',
    'view-subjects',
    'view-attendance',
    'mark-attendance',
    'view-grades',
    'create-grade',
    'edit-grade',
    'view-grading',
    'view-lectures',
    'create-lecture',
    'edit-lecture',
    'view-homework',
    'create-homework',
    'edit-homework',
    'view-homework-submissions',
    'view-exams',
    'create-exam',
    'edit-exam',
    'view-results',
    'create-result',
    'edit-result',
    'view-profile',
    'edit-profile',
    'view-appearance',
    'view-transport'
  ],
  UserWithoutStudent: [
    'view-dashboard',
    'view-students',
    'view-attendance',
    'view-parents',
    'create-parent',
    'edit-parent',
    'view-teachers',
    'view-classes',
    'view-subjects',
    'view-grades',
    'view-lectures',
    'view-homework',
    'view-homework-submissions',
    'view-exams',
    'view-results',
    'view-profile',
    'edit-profile',
    'view-appearance',
    'view-transport'
  ]
};

export class AccessControl {
  static hasPermission(userRole: UserRole, permission: Permission): boolean {
    const permissions = rolePermissions[userRole] || [];
    return permissions.includes(permission);
  }

  static hasAnyPermission(userRole: UserRole, permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(userRole, permission));
  }

  static hasAllPermissions(userRole: UserRole, permissions: Permission[]): boolean {
    return permissions.every(permission => this.hasPermission(userRole, permission));
  }

  static getPermissions(userRole: UserRole): Permission[] {
    return rolePermissions[userRole] || [];
  }

  static canAccessRoute(userRole: UserRole, route: string): boolean {
    const routePermissionMap: Record<string, Permission> = {
      '/dashboard': 'view-dashboard',
      '/users': 'view-users',
      '/students': 'view-students',
      '/parents': 'view-parents',
      '/teachers': 'view-teachers',
      '/classes': 'view-classes',
      '/subjects': 'view-subjects',
      '/institutes': 'view-institutes',
      '/attendance': 'view-attendance',
      '/my-attendance': 'view-attendance',
      '/daily-attendance': 'view-attendance',
      
      '/attendance-markers': 'manage-attendance-markers',
      '/qr-attendance': 'mark-attendance',
      '/rfid-attendance': 'mark-attendance',
      '/grades': 'view-grades',
      '/grading': 'view-grading',
      '/lectures': 'view-lectures',
      '/gallery': 'view-gallery',
      '/homework': 'view-homework',
      '/homework-submissions': 'view-homework-submissions',
      '/exams': 'view-exams',
      '/results': 'view-results',
      '/profile': 'view-profile',
      '/institute-details': 'view-institute-details',
      '/organizations': 'view-organizations',
      '/settings': 'view-settings',
      '/appearance': 'view-appearance',
      '/transport': 'view-transport',
      '/transport-attendance': 'view-transport'
    };

    const requiredPermission = routePermissionMap[route];
    return requiredPermission ? this.hasPermission(userRole, requiredPermission) : false;
  }
}
