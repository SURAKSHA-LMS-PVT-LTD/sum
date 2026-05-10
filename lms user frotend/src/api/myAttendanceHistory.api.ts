import { enhancedCachedClient } from './enhancedCachedClient';

export interface MyAttendanceRecord {
  id?: string;
  date: string;
  status: string;
  statusLabel: string;
  studentId?: string;
  studentName?: string;
  studentImageUrl?: string;
  instituteId: string;
  instituteName: string;
  instituteShortName?: string;
  instituteLogoUrl?: string;
  classId?: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  markedAt: string;
  markedBy?: string;
  timestamp: number;
}

export interface MyAttendanceSummary {
  totalPresent: number;
  totalAbsent: number;
  totalLate: number;
  totalLeft: number;
  totalLeftEarly: number;
  totalLeftLately: number;
  attendanceRate: number | null;
}

export interface MyAttendanceByInstitute {
  [instituteId: string]: {
    instituteName: string;
    instituteLogoUrl?: string;
    totalPresent: number;
    totalAbsent: number;
    totalLate: number;
    totalLeft: number;
    totalLeftEarly: number;
    totalLeftLately: number;
    attendanceRate: number | null;
  };
}

export interface MyAttendanceHistoryResponse {
  success: boolean;
  data: MyAttendanceRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: MyAttendanceSummary;
  byInstitute: MyAttendanceByInstitute;
}

export interface MyAttendanceHistoryParams {
  startDate?: string;
  endDate?: string;
  instituteId?: string;
  status?: string;
  page?: number;
  limit?: number;
  child?: boolean;
  studentId?: string;
}

export const myAttendanceHistoryApi = {
  getMyHistory: async (
    params: MyAttendanceHistoryParams = {},
    forceRefresh = false
  ): Promise<MyAttendanceHistoryResponse> => {
    const queryParams = new URLSearchParams();
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.instituteId) queryParams.append('instituteId', params.instituteId);
    if (params.status) queryParams.append('status', params.status);
    if (params.child !== undefined) queryParams.append('child', String(params.child));
    if (params.studentId) queryParams.append('studentId', params.studentId);
    queryParams.append('page', (params.page || 1).toString());
    queryParams.append('limit', (params.limit || 50).toString());

    const endpoint = `/api/attendance/my-history?${queryParams.toString()}`;

    console.log('=== MY ATTENDANCE HISTORY API CALL ===');
    console.log('Endpoint:', endpoint);

    return enhancedCachedClient.get<MyAttendanceHistoryResponse>(endpoint, undefined, {
      forceRefresh,
      ttl: 10,
      useStaleWhileRevalidate: true,
    });
  },
};
