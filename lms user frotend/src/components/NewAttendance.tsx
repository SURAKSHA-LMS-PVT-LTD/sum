import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Search, Filter, Calendar, User, Clock, CheckCircle, MapPin, School, BookOpen, UserCheck, UserX, TrendingUp, LogOut, DoorOpen, Building2, GraduationCap, ChevronRight, ChevronLeft, CalendarDays, List, PieChart as PieChartIcon, CalendarRange, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useToast } from '@/hooks/use-toast';
import { getAttendanceUrl, getBaseUrl, getApiHeadersAsync } from '@/contexts/utils/auth.api';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getImageUrl } from '@/utils/imageUrlHelper';

interface AttendanceRecord {
  attendanceId?: string;
  studentId: string;
  studentName: string;
  studentImageUrl?: string;
  imageUrl?: string;
  instituteId?: string;
  instituteName?: string;
  classId?: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  date: string;
  markedAt?: string;
  status: 'present' | 'absent' | 'late' | 'left' | 'left_early' | 'left_lately';
  location?: string;
  markingMethod: string;
  markedBy?: string;
}

function parseLocation(raw?: string | null): { address: string; mapsUrl?: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.address) {
      const mapsUrl = parsed.latitude != null && parsed.longitude != null
        ? `https://www.google.com/maps?q=${parsed.latitude},${parsed.longitude}`
        : undefined;
      return { address: parsed.address, mapsUrl };
    }
  } catch { /* plain string */ }
  return { address: raw };
}

interface AttendanceResponse {
  success: boolean;
  message: string;
  instituteInfo?: {
    instituteId: string;
    instituteName: string;
  };
  classInfo?: {
    instituteId: string;
    instituteName: string;
    classId: string;
    className: string;
  };
  subjectInfo?: {
    instituteId: string;
    instituteName: string;
    classId: string;
    className: string;
    subjectId: string;
    subjectName: string;
  };
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    recordsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  dateRange: {
    startDate: string;
    endDate: string;
    totalDays: number;
  };
  data: AttendanceRecord[];
  summary?: {
    totalPresent?: number;
    totalAbsent?: number;
    totalLate?: number;
    totalLeft?: number;
    totalLeftEarly?: number;
    totalLeftLately?: number;
    attendanceRate?: number;
    uniqueStudents?: number;
    totalClasses?: number;
    totalSubjects?: number;
  };
}

type AttendanceStatus = 'present' | 'absent' | 'late' | 'left' | 'left_early' | 'left_lately';

const CHART_COLORS = {
  present: '#10b981',
  absent: '#ef4444',
  late: '#f59e0b',
  left: '#a855f7',
  left_early: '#ec4899',
  left_lately: '#6366f1',
};

const NewAttendance = () => {
  const {
    selectedInstitute,
    selectedClass,
    selectedSubject,
    currentInstituteId,
    currentClassId,
    currentSubjectId
  } = useAuth();
  const userRole = useInstituteRole();
  const { toast } = useToast();
  
  const [attendanceData, setAttendanceData] = useState<AttendanceResponse | null>(null);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('records');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const shiftInputDate = (inputDate: string, days: number): string => {
    // Use midday to avoid timezone edge cases that can shift dates.
    const d = new Date(`${inputDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    return formatDateForInput(d);
  };

  const getDefaultDates = () => {
    const today = new Date();
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 4); // 5 days including today
    return {
      startDate: formatDateForInput(fiveDaysAgo),
      endDate: formatDateForInput(today)
    };
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState(() => getDefaultDates().startDate);
  const [endDate, setEndDate] = useState(() => getDefaultDates().endDate);
  const [sortOrder, setSortOrder] = useState<string>('descending');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [showFilters, setShowFilters] = useState(false);

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (value) setEndDate(shiftInputDate(value, 4)); // always keep 5-day range
    setCurrentPage(1);
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    if (value) setStartDate(shiftInputDate(value, -4)); // always keep 5-day range
    setCurrentPage(1);
  };

  const getPermissionAndEndpoint = () => {
    const canViewSubject = (userRole === 'InstituteAdmin' || userRole === 'Teacher' || userRole === 'AttendanceMarker') && currentInstituteId && currentClassId && currentSubjectId;
    const canViewClass = (userRole === 'InstituteAdmin' || userRole === 'Teacher' || userRole === 'AttendanceMarker') && currentInstituteId && currentClassId;
    const canViewInstitute = (userRole === 'InstituteAdmin' || userRole === 'AttendanceMarker') && currentInstituteId;

    let attendanceBaseUrl = getAttendanceUrl() || getBaseUrl() || localStorage.getItem('baseUrl2') || '';
    attendanceBaseUrl = attendanceBaseUrl.endsWith('/') ? attendanceBaseUrl.slice(0, -1) : attendanceBaseUrl;
    
    if (canViewSubject) {
      return {
        hasPermission: true,
        endpoint: attendanceBaseUrl ? `${attendanceBaseUrl}/api/attendance/institute/${currentInstituteId}/class/${currentClassId}/subject/${currentSubjectId}` : '',
        title: 'Subject Attendance Records'
      };
    }
    if (canViewClass) {
      return {
        hasPermission: true,
        endpoint: attendanceBaseUrl ? `${attendanceBaseUrl}/api/attendance/institute/${currentInstituteId}/class/${currentClassId}` : '',
        title: 'Class Attendance Records'
      };
    }
    if (canViewInstitute) {
      return {
        hasPermission: true,
        endpoint: attendanceBaseUrl ? `${attendanceBaseUrl}/api/attendance/institute/${currentInstituteId}` : '',
        title: 'Institute Attendance Records'
      };
    }
    if (userRole === 'Student') {
      return {
        hasPermission: false,
        endpoint: '',
        title: 'Attendance Access Restricted'
      };
    }
    return {
      hasPermission: false,
      endpoint: '',
      title: 'Attendance Records'
    };
  };

  const { hasPermission, endpoint, title } = getPermissionAndEndpoint();


  const loadAttendanceData = async () => {
    if (!hasPermission) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to view attendance records.",
        variant: "destructive"
      });
      return;
    }

    if (!endpoint) {
      toast({
        title: 'Configuration Required',
        description: 'No API base URL configured. Please set attendance URL in Settings.',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const headers = await getApiHeadersAsync();
      const params = new URLSearchParams({
        startDate,
        endDate,
        page: currentPage.toString(),
        limit: rowsPerPage.toString()
      });
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      const fullUrl = `${endpoint}?${params.toString()}`;
      const response = await fetch(fullUrl, { method: 'GET', headers });

      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('text/html')) {
        const htmlContent = await response.text();
        if (htmlContent.includes('ngrok') && htmlContent.includes('You are about to visit')) {
          throw new Error('Ngrok tunnel is showing a browser warning.');
        }
        throw new Error('API returned HTML instead of JSON.');
      }
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          if (contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.message || JSON.stringify(errorData);
          }
        } catch { /* use default */ }
        throw new Error(`Failed to fetch attendance data: ${errorMessage}`);
      }
      
      const result: AttendanceResponse = await response.json();
      console.log('📊 Attendance API Response:', result);
      console.log('📸 First record image fields:', result.data[0] ? {
        studentImageUrl: result.data[0].studentImageUrl,
        imageUrl: result.data[0].imageUrl,
        studentName: result.data[0].studentName
      } : 'No records');
      setAttendanceData(result);
      setFilteredRecords(result.data);
      setDataLoaded(true);
    } catch (error: any) {
      console.error('Failed to load attendance data:', error);
      toast({
        title: "Load Failed",
        description: error instanceof Error ? error.message : "Failed to load attendance data.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-load attendance data when component mounts and has permission
  useEffect(() => {
    if (hasPermission && endpoint) {
      loadAttendanceData();
    }
  }, [currentPage, rowsPerPage, currentInstituteId, currentClassId, currentSubjectId]);

  useEffect(() => {
    if (!attendanceData) return;
    let filtered = attendanceData.data;

    if (searchTerm) {
      filtered = filtered.filter(record => 
        record.studentId.toLowerCase().includes(searchTerm.toLowerCase()) || 
        record.studentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        record.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (record.className && record.className.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (record.subjectName && record.subjectName.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    filtered.sort((a, b) => {
      const aDateStr = a.markedAt || a.date || '';
      const bDateStr = b.markedAt || b.date || '';
      const dateA = new Date(aDateStr);
      const dateB = new Date(bDateStr);
      return sortOrder === 'ascending' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
    });
    setFilteredRecords(filtered);
  }, [attendanceData, searchTerm, sortOrder]);

  // Calendar helpers
  const getCalendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();
    
    const days: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  }, [calendarMonth]);

  const attendanceMap = useMemo(() => {
    const map: Record<string, { status: AttendanceStatus; count: number }> = {};
    if (attendanceData?.data) {
      attendanceData.data.forEach((record) => {
        const dateKey = new Date(record.date).toISOString().split('T')[0];
        if (!map[dateKey]) {
          map[dateKey] = { status: record.status, count: 1 };
        } else {
          map[dateKey].count += 1;
        }
      });
    }
    return map;
  }, [attendanceData]);

  const getDateStatus = (day: number): AttendanceStatus | null => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return attendanceMap[dateStr]?.status || null;
  };

  const getDateCount = (day: number): number => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return attendanceMap[dateStr]?.count || 0;
  };

  const getDateStatusColor = (status: AttendanceStatus | null): string => {
    if (!status) return 'bg-muted/50 text-muted-foreground';
    const colorMap: Record<AttendanceStatus, string> = {
      present: 'bg-emerald-500 text-white',
      absent: 'bg-red-500 text-white',
      late: 'bg-amber-500 text-white',
      left: 'bg-purple-500 text-white',
      left_early: 'bg-pink-500 text-white',
      left_lately: 'bg-indigo-500 text-white'
    };
    return colorMap[status] || 'bg-muted/50 text-muted-foreground';
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCalendarMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  // Totals for summary cards - use individual records if available, otherwise fall back to API summary
  const totals = useMemo(() => {
    const records = attendanceData?.data ?? [];
    const apiSummary = attendanceData?.summary;
    
    if (records.length > 0) {
      // Count from individual records
      let totalPresent = 0, totalAbsent = 0, totalLate = 0, totalLeft = 0, totalLeftEarly = 0, totalLeftLately = 0;
      for (const r of records) {
        if (r.status === 'present') totalPresent += 1;
        else if (r.status === 'absent') totalAbsent += 1;
        else if (r.status === 'late') totalLate += 1;
        else if (r.status === 'left') totalLeft += 1;
        else if (r.status === 'left_early') totalLeftEarly += 1;
        else if (r.status === 'left_lately') totalLeftLately += 1;
      }
      const total = totalPresent + totalAbsent + totalLate + totalLeft + totalLeftEarly + totalLeftLately;
      const attendanceRate = total > 0 ? Math.round((totalPresent / total) * 100) : 0;
      return { totalPresent, totalAbsent, totalLate, totalLeft, totalLeftEarly, totalLeftLately, total, attendanceRate };
    } else if (apiSummary && (apiSummary.totalPresent || apiSummary.totalAbsent || apiSummary.totalLate)) {
      // Fall back to API summary when data array is empty
      const totalPresent = apiSummary.totalPresent || 0;
      const totalAbsent = apiSummary.totalAbsent || 0;
      const totalLate = apiSummary.totalLate || 0;
      const totalLeft = apiSummary.totalLeft || 0;
      const totalLeftEarly = apiSummary.totalLeftEarly || 0;
      const totalLeftLately = apiSummary.totalLeftLately || 0;
      const total = totalPresent + totalAbsent + totalLate + totalLeft + totalLeftEarly + totalLeftLately;
      const attendanceRate = apiSummary.attendanceRate != null ? Math.round(apiSummary.attendanceRate) : (total > 0 ? Math.round((totalPresent / total) * 100) : 0);
      return { totalPresent, totalAbsent, totalLate, totalLeft, totalLeftEarly, totalLeftLately, total, attendanceRate };
    }
    
    return { totalPresent: 0, totalAbsent: 0, totalLate: 0, totalLeft: 0, totalLeftEarly: 0, totalLeftLately: 0, total: 0, attendanceRate: 0 };
  }, [attendanceData]);

  // Pie chart data
  const pieChartData = useMemo(() => {
    const data = [
      { name: 'Present', value: totals.totalPresent, color: CHART_COLORS.present },
      { name: 'Absent', value: totals.totalAbsent, color: CHART_COLORS.absent },
      { name: 'Late', value: totals.totalLate, color: CHART_COLORS.late },
      { name: 'Left', value: totals.totalLeft, color: CHART_COLORS.left },
      { name: 'Left Early', value: totals.totalLeftEarly, color: CHART_COLORS.left_early },
      { name: 'Left Late', value: totals.totalLeftLately, color: CHART_COLORS.left_lately },
    ].filter(item => item.value > 0);
    return data;
  }, [totals]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'present': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'absent': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'late': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'left': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'left_early': return 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300';
      case 'left_lately': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'present': return <UserCheck className="h-4 w-4" />;
      case 'absent': return <UserX className="h-4 w-4" />;
      case 'late': return <Clock className="h-4 w-4" />;
      case 'left': return <LogOut className="h-4 w-4" />;
      case 'left_early': return <DoorOpen className="h-4 w-4" />;
      case 'left_lately': return <Clock className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const getCurrentSelection = () => {
    const selections = [];
    if (selectedInstitute) selections.push(`Institute: ${selectedInstitute.name}`);
    if (selectedClass) selections.push(`Class: ${selectedClass.name}`);
    if (selectedSubject) selections.push(`Subject: ${selectedSubject.name}`);
    return selections.join(', ');
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getContextInfo = () => {
    if (attendanceData?.subjectInfo) {
      return `${attendanceData.subjectInfo.instituteName} > ${attendanceData.subjectInfo.className} > ${attendanceData.subjectInfo.subjectName}`;
    }
    if (attendanceData?.classInfo) {
      return `${attendanceData.classInfo.instituteName} > ${attendanceData.classInfo.className}`;
    }
    if (attendanceData?.instituteInfo) {
      return attendanceData.instituteInfo.instituteName;
    }
    return getCurrentSelection();
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Mobile Card Component
  const AttendanceCard = ({ record }: { record: AttendanceRecord }) => {
    const imageUrl = record.studentImageUrl || record.imageUrl;
    console.log('🖼️ Raw image fields:', {
      studentImageUrl: record.studentImageUrl,
      imageUrl: record.imageUrl,
      combined: imageUrl,
      transformed: getImageUrl(imageUrl),
      studentName: record.studentName
    });

    return (
    <Card className="hover:shadow-md transition-shadow duration-200 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarImage
                src={imageUrl || ''}
                alt={record.studentName}
                onError={(e) => {
                  console.error('❌ Image load failed for', record.studentName, 'URL:', imageUrl);
                }}
                onLoad={() => console.log('✅ Image loaded for', record.studentName)}
              />
              <AvatarFallback className="text-sm font-semibold">
                {record.studentName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <CardTitle className="text-lg font-semibold">{record.studentName}</CardTitle>
          </div>
          <Badge className={`${getStatusColor(record.status)} gap-1`}>
            {getStatusIcon(record.status)}
            {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4 text-primary" />
            <span>ID: {record.studentId}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 text-primary" />
            <span>{formatDate(record.date || record.markedAt || '')}</span>
          </div>
          {record.instituteName && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <School className="h-4 w-4 text-primary" />
              <span>{record.instituteName}</span>
            </div>
          )}
          {record.location && (() => {
            const loc = parseLocation(record.location);
            return loc ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <span>{loc.address}</span>
                {loc.mapsUrl && (
                  <a href={loc.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-primary shrink-0">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            ) : null;
          })()}
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle className="h-4 w-4 text-primary" />
            <span>{record.markingMethod}</span>
          </div>
        </div>
      </CardContent>
    </Card>
    );
  };

  if (!hasPermission) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-border/50">
          <CardContent className="text-center py-12">
            <h3 className="text-lg font-medium mb-2">Access Denied or Missing Selection</h3>
            <p className="text-muted-foreground mb-4">Please select the required context to view attendance records.</p>
            <div className="mt-4 text-sm text-muted-foreground">Current Selection: {getContextInfo() || 'None'}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!dataLoaded && !isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center py-12">
          <div className="text-center space-y-4">
            <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 inline-flex">
              <CalendarDays className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="text-muted-foreground">{getContextInfo()}</p>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Loading attendance data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Modern Header with Context Breadcrumb */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 md:p-8 border border-primary/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                <CalendarDays className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
              </div>
            </div>
            
            {/* Context Breadcrumb */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {selectedInstitute && (
                <Badge variant="outline" className="bg-background/60 backdrop-blur-sm border-border/50 gap-1.5 py-1.5 px-3">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  {selectedInstitute.name}
                </Badge>
              )}
              {selectedClass && (
                <>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline" className="bg-background/60 backdrop-blur-sm border-border/50 gap-1.5 py-1.5 px-3">
                    <GraduationCap className="h-3.5 w-3.5 text-primary" />
                    {selectedClass.name}
                  </Badge>
                </>
              )}
              {selectedSubject && (
                <>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="outline" className="bg-background/60 backdrop-blur-sm border-border/50 gap-1.5 py-1.5 px-3">
                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                    {selectedSubject.name}
                  </Badge>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2 bg-background/50 backdrop-blur-sm hover:bg-background/80"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Button 
              onClick={loadAttendanceData} 
              disabled={isLoading}
              variant="outline"
              size="sm"
              className="gap-2 bg-background/50 backdrop-blur-sm hover:bg-background/80"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5 text-primary" />
              Filters & Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Name or ID" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 bg-background" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sort Order</label>
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Descending" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="descending">Newest First</SelectItem>
                    <SelectItem value="ascending">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Records/Page</label>
                <Select value={rowsPerPage.toString()} onValueChange={(v) => setRowsPerPage(Number(v))}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={loadAttendanceData} disabled={isLoading} className="gap-2">
                <Calendar className="h-4 w-4" />
                Apply
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab Navigation - Arrow Style */}
      <div className="w-full">
        <div className="flex items-center justify-center gap-4 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const tabs = ['records', 'calendar', 'statistics'];
              const currentIndex = tabs.indexOf(activeTab);
              if (currentIndex > 0) setActiveTab(tabs[currentIndex - 1]);
            }}
            disabled={activeTab === 'records'}
            className="h-10 w-10 rounded-full bg-muted/50 hover:bg-muted disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-2">
            {[
              { id: 'records', icon: List, label: 'Records' },
              { id: 'calendar', icon: CalendarRange, label: 'Calendar' },
              { id: 'statistics', icon: PieChartIcon, label: 'Statistics' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300
                  ${activeTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
              >
                <tab.icon className="h-4 w-4" />
                <span className="text-sm font-medium hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const tabs = ['records', 'calendar', 'statistics'];
              const currentIndex = tabs.indexOf(activeTab);
              if (currentIndex < tabs.length - 1) setActiveTab(tabs[currentIndex + 1]);
            }}
            disabled={activeTab === 'statistics'}
            className="h-10 w-10 rounded-full bg-muted/50 hover:bg-muted disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'records' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <CardContent className="relative pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Present</p>
                    <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{totals.totalPresent}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/10">
                    <UserCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                {totals.total > 0 && (
                  <div className="mt-3 h-1.5 bg-emerald-500/20 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${(totals.totalPresent / totals.total) * 100}%` }} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-red-500/10 to-red-500/5">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <CardContent className="relative pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Absent</p>
                    <p className="text-3xl font-bold text-red-600 dark:text-red-400">{totals.totalAbsent}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-red-500/10">
                    <UserX className="h-6 w-6 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                {totals.total > 0 && (
                  <div className="mt-3 h-1.5 bg-red-500/20 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full transition-all duration-500" style={{ width: `${(totals.totalAbsent / totals.total) * 100}%` }} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-amber-500/10 to-amber-500/5">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <CardContent className="relative pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Late</p>
                    <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{totals.totalLate}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-500/10">
                    <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
                {totals.total > 0 && (
                  <div className="mt-3 h-1.5 bg-amber-500/20 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${(totals.totalLate / totals.total) * 100}%` }} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <CardContent className="relative pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Left</p>
                    <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">{totals.totalLeft}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-500/10">
                    <LogOut className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
                {totals.total > 0 && (
                  <div className="mt-3 h-1.5 bg-purple-500/20 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${(totals.totalLeft / totals.total) * 100}%` }} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-pink-500/10 to-pink-500/5">
              <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <CardContent className="relative pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Left Early</p>
                    <p className="text-3xl font-bold text-pink-600 dark:text-pink-400">{totals.totalLeftEarly}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-pink-500/10">
                    <DoorOpen className="h-6 w-6 text-pink-600 dark:text-pink-400" />
                  </div>
                </div>
                {totals.total > 0 && (
                  <div className="mt-3 h-1.5 bg-pink-500/20 rounded-full overflow-hidden">
                    <div className="h-full bg-pink-500 rounded-full transition-all duration-500" style={{ width: `${(totals.totalLeftEarly / totals.total) * 100}%` }} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-indigo-500/10 to-indigo-500/5">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <CardContent className="relative pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Left Late</p>
                    <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{totals.totalLeftLately}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-indigo-500/10">
                    <Clock className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
                {totals.total > 0 && (
                  <div className="mt-3 h-1.5 bg-indigo-500/20 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${(totals.totalLeftLately / totals.total) * 100}%` }} />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/10 to-primary/5">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
              <CardContent className="relative pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Rate</p>
                    <p className="text-3xl font-bold text-primary">{totals.attendanceRate}%</p>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/10">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="mt-3 h-1.5 bg-primary/20 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${totals.attendanceRate}%` }} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Records Table */}
          <Card className="border-border/50">
            <CardHeader className="border-b border-border/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <CardTitle className="text-lg font-semibold">Attendance Records</CardTitle>
                {attendanceData?.pagination && (
                  <p className="text-sm text-muted-foreground">
                    Page {attendanceData.pagination.currentPage} of {attendanceData.pagination.totalPages}
                    <span className="hidden sm:inline"> • {attendanceData.pagination.totalRecords} total</span>
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-muted-foreground">Loading attendance...</span>
                </div>
              ) : filteredRecords.length > 0 ? (
                <>
                  {/* Table (sm+ full columns) */}
                  <div className="hidden sm:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="font-semibold">Student</TableHead>
                          <TableHead className="font-semibold">Date & Time</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold">Institute</TableHead>
                          <TableHead className="font-semibold hidden lg:table-cell">Location</TableHead>
                          <TableHead className="font-semibold hidden lg:table-cell">Method</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRecords.map((record, index) => (
                          <TableRow key={record.attendanceId || index} className="group hover:bg-muted/30 transition-colors">
                            <TableCell className="py-4">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8 shrink-0">
                                  <AvatarImage
                                    src={record.studentImageUrl || record.imageUrl || ''}
                                    alt={record.studentName}
                                    onError={(e) => {
                                      console.error('❌ Table image failed:', record.studentName, 'URL:', record.studentImageUrl || record.imageUrl);
                                    }}
                                    onLoad={() => console.log('✅ Table image loaded:', record.studentName)}
                                  />
                                  <AvatarFallback className="text-xs font-semibold">
                                    {record.studentName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{record.studentName}</p>
                                  <p className="text-xs text-muted-foreground">{record.studentId}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{formatDate(record.date)}</p>
                                <p className="text-xs text-muted-foreground">{formatTime(record.date)}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${getStatusColor(record.status)} gap-1.5 font-medium`}>
                                {getStatusIcon(record.status)}
                                {record.status.charAt(0).toUpperCase() + record.status.slice(1).replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{record.instituteName || '-'}</p>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              {(() => {
                                const loc = parseLocation(record.location);
                                if (!loc) return <p className="text-sm text-muted-foreground">-</p>;
                                return (
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-sm text-muted-foreground">{loc.address}</p>
                                    {loc.mapsUrl && (
                                      <a href={loc.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-primary shrink-0">
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    )}
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <p className="text-sm text-muted-foreground">{record.markingMethod}</p>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Table (no cards) */}
                  <div className="sm:hidden overflow-x-auto">
                    <Table className="min-w-[560px]">
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="font-semibold">Student</TableHead>
                          <TableHead className="font-semibold">Date</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold">Method</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRecords.map((record, index) => (
                          <TableRow key={record.attendanceId || index} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="py-3">
                              <div>
                                <p className="font-medium text-sm">{record.studentName}</p>
                                <p className="text-xs text-muted-foreground">{record.studentId}</p>
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <div>
                                <p className="font-medium text-sm">{formatDate(record.date)}</p>
                                <p className="text-xs text-muted-foreground">{formatTime(record.date)}</p>
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <Badge className={`${getStatusColor(record.status)} gap-1.5 font-medium`}>
                                {getStatusIcon(record.status)}
                                {record.status.charAt(0).toUpperCase() + record.status.slice(1).replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3">
                              <p className="text-sm text-muted-foreground">{record.markingMethod}</p>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {attendanceData?.pagination && attendanceData.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-4 border-t border-border/50">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" /> Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {attendanceData.pagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(attendanceData.pagination.totalPages, prev + 1))}
                        disabled={currentPage === attendanceData.pagination.totalPages}
                      >
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <h3 className="text-lg font-medium mb-2">No attendance records found</h3>
                  <p className="text-muted-foreground">No records available for the current selection.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Calendar View */}
      {activeTab === 'calendar' && (
        <Card className="border-border/50">
          <CardHeader className="border-b border-border/50 pb-4">
            <div className="flex flex-col gap-4">
              {/* Calendar Navigation */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  <span className="hidden sm:inline">Attendance Calendar</span>
                  <span className="sm:hidden">Calendar</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')} className="h-8 w-8">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[100px] sm:min-w-[140px] text-center font-medium text-sm sm:text-base">
                    {calendarMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                  <Button variant="outline" size="icon" onClick={() => navigateMonth('next')} className="h-8 w-8">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Status Filter - Moved to Calendar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Filter Status:</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px] bg-background h-9">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="left_early">Left Early</SelectItem>
                    <SelectItem value="left_lately">Left Late</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            {/* Week header - Responsive */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 sm:mb-4">
              {weekDays.map((day) => (
                <div key={day} className="text-center text-xs sm:text-sm font-medium text-muted-foreground py-1 sm:py-2">
                  <span className="hidden sm:inline">{day}</span>
                  <span className="sm:hidden">{day.charAt(0)}</span>
                </div>
              ))}
            </div>

            {/* Calendar days - Responsive */}
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {getCalendarDays.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }
                const status = getDateStatus(day);
                const count = getDateCount(day);
                return (
                  <div
                    key={day}
                    className={`aspect-square rounded-md sm:rounded-lg flex flex-col items-center justify-center text-xs sm:text-sm font-medium transition-all ${getDateStatusColor(status)}`}
                  >
                    <span>{day}</span>
                    {count > 0 && <span className="text-[10px] sm:text-xs opacity-75">{count}</span>}
                  </div>
                );
              })}
            </div>

            {/* Legend - Responsive Grid */}
            <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center justify-center gap-2 sm:gap-4 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border/50">
              <div className="flex items-center gap-1.5 sm:gap-2"><div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-emerald-500" /><span className="text-[10px] sm:text-xs text-muted-foreground">Present</span></div>
              <div className="flex items-center gap-1.5 sm:gap-2"><div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-red-500" /><span className="text-[10px] sm:text-xs text-muted-foreground">Absent</span></div>
              <div className="flex items-center gap-1.5 sm:gap-2"><div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-amber-500" /><span className="text-[10px] sm:text-xs text-muted-foreground">Late</span></div>
              <div className="flex items-center gap-1.5 sm:gap-2"><div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-purple-500" /><span className="text-[10px] sm:text-xs text-muted-foreground">Left</span></div>
              <div className="flex items-center gap-1.5 sm:gap-2"><div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-pink-500" /><span className="text-[10px] sm:text-xs text-muted-foreground">Early</span></div>
              <div className="flex items-center gap-1.5 sm:gap-2"><div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-indigo-500" /><span className="text-[10px] sm:text-xs text-muted-foreground">Late Exit</span></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics View */}
      {activeTab === 'statistics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-primary" />
                Attendance Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pieChartData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No data available for chart
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Statistics */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Summary Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Total Records</p>
                  <p className="text-2xl font-bold">{totals.total}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground">Attendance Rate</p>
                  <p className="text-2xl font-bold text-primary">{totals.attendanceRate}%</p>
                </div>
                <div className="p-4 rounded-lg bg-emerald-500/10">
                  <p className="text-sm text-muted-foreground">Present</p>
                  <p className="text-2xl font-bold text-emerald-600">{totals.totalPresent}</p>
                </div>
                <div className="p-4 rounded-lg bg-red-500/10">
                  <p className="text-sm text-muted-foreground">Absent</p>
                  <p className="text-2xl font-bold text-red-600">{totals.totalAbsent}</p>
                </div>
                <div className="p-4 rounded-lg bg-amber-500/10">
                  <p className="text-sm text-muted-foreground">Late</p>
                  <p className="text-2xl font-bold text-amber-600">{totals.totalLate}</p>
                </div>
                <div className="p-4 rounded-lg bg-purple-500/10">
                  <p className="text-sm text-muted-foreground">Left</p>
                  <p className="text-2xl font-bold text-purple-600">{totals.totalLeft}</p>
                </div>
              </div>

              {attendanceData?.pagination && (
                <div className="pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground mb-2">Data Range</p>
                  <p className="text-sm font-medium">
                    {startDate} to {endDate}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {attendanceData.pagination.totalRecords} records across {Math.max(1, attendanceData.pagination.totalPages)} pages
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default NewAttendance;
