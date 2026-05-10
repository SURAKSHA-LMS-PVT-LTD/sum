import { apiClient } from '@/api/client';

export interface AttendanceMarkResponse {
  success?: boolean;
  data?: any;
  message?: string;
  error?: string;
}

export class AttendanceSessionService {
  // ✅ Mark attendance in a session
  static async markAttendance(
    instituteId: string,
    classId: string,
    sessionId: string,
    studentId: string,
    status: string
  ): Promise<AttendanceMarkResponse> {
    // Validate inputs
    if (!instituteId || !classId || !sessionId || !studentId) {
      console.warn('⚠️ Missing required parameters');
      return { error: 'Missing parameters' };
    }

    const payload = {
      studentId,
      status  // e.g., 'PRESENT', 'ABSENT', 'LATE'
    };

    const endpoint = `/attendance/institute/${instituteId}/class/${classId}/sessions/${sessionId}/mark`;
    
    console.log('📝 Marking attendance:', { endpoint, payload });

    try {
      const response = await apiClient.post<AttendanceMarkResponse>(endpoint, payload);
      console.log('✅ Attendance marked:', response);
      return response;
    } catch (err: any) {
      console.error('❌ Mark attendance error:', err.status, err.message);
      
      if (err.status === 403) {
        console.error('🚫 Permission denied - check:');
        console.error('  1. User role: Must be TEACHER, INSTITUTE_ADMIN, or ATTENDANCE_MARKER');
        console.error('  2. Institute access: Must have access to institute', instituteId);
        console.error('  3. Class access: Must be teacher/admin of class', classId);
        console.error('  4. JWT token: Must be valid and not expired');
      }
      
      return { error: err.message || 'Failed to mark attendance' };
    }
  }

  // Bulk mark attendance
  static async bulkMarkAttendance(
    instituteId: string,
    classId: string,
    sessionId: string,
    attendanceData: Array<{ studentId: string; status: string }>
  ): Promise<AttendanceMarkResponse> {
    const endpoint = `/attendance/institute/${instituteId}/class/${classId}/sessions/${sessionId}/mark-bulk`;

    try {
      const response = await apiClient.post<AttendanceMarkResponse>(endpoint, { records: attendanceData });
      console.log('✅ Bulk attendance marked:', response);
      return response;
    } catch (err: any) {
      console.error('❌ Bulk mark error:', err);
      return { error: err.message || 'Failed to mark bulk attendance' };
    }
  }
}
