import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar, Clock, MapPin, User, RefreshCw, AlertTriangle, TrendingUp, UserCheck, UserX, Filter, Building2, BookOpen, GraduationCap, ChevronLeft, ChevronRight, CalendarDays, Zap, LogOut, DoorOpen, List, PieChart, CalendarRange, ChevronDown, LayoutGrid, Table2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRefreshWithCooldown } from '@/hooks/useRefreshWithCooldown';
import { myAttendanceHistoryApi, type MyAttendanceHistoryResponse, type MyAttendanceRecord as MyAttendanceHistoryRecord } from '@/api/myAttendanceHistory.api';
import { AttendanceStatus, ATTENDANCE_STATUS_CONFIG, normalizeAttendanceSummary, ATTENDANCE_CHART_COLORS } from '@/types/attendance.types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useViewMode } from '@/hooks/useViewMode';
import { EmptyState } from '@/components/ui/EmptyState';

const MyAttendance = () => {
  const { user, selectedInstitute, selectedClass, selectedSubject, currentInstituteId, currentClassId, currentSubjectId, isViewingAsParent, selectedChild } = useAuth();
  const params = useParams();
  const { toast } = useToast();
  const [attendanceData, setAttendanceData] = useState<MyAttendanceHistoryResponse | null>(null);
  const [activeTab, setActiveTab] = useState('records');
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const slStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    return new Date(slStr + 'T00:00:00');
  });
  
  const instituteId = params.instituteId || currentInstituteId || selectedInstitute?.id;
  const classId = params.classId || currentClassId || selectedClass?.id;
  const subjectId = params.subjectId || currentSubjectId || selectedSubject?.id;
  
  const getContextLevel = () => {
    if (subjectId && classId && instituteId) return 'subject';
    if (classId && instituteId) return 'class';
    if (instituteId) return 'institute';
    return 'all';
  };
  
  const contextLevel = getContextLevel();
  
  const getYesterday = () => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  };
  
  const getTomorrow = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date.toISOString().split('T')[0];
  };

  const getMinDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  };

  const getMaxDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(getYesterday());
  const [endDate, setEndDate] = useState(getTomorrow());
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const { viewMode, setViewMode } = useViewMode();
  const { refresh, isRefreshing, canRefresh, cooldownRemaining } = useRefreshWithCooldown(10);

  const toggleCard = (index: number) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const loadStudentAttendance = async (forceRefresh = false) => {
    if (!user?.id) {
      toast({
        title: "Missing Context",
        description: "Please log in to view attendance",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const effectiveStudentId = isViewingAsParent && selectedChild ? selectedChild.id : undefined;
    try {
      const response = await myAttendanceHistoryApi.getMyHistory({
        startDate,
        endDate,
        instituteId: instituteId?.toString(),
        page: currentPage,
        limit,
        ...(effectiveStudentId ? { studentId: effectiveStudentId } : {}),
      }, forceRefresh);
      
      setAttendanceData(response);
    } catch (error: any) {
      console.error('Error loading attendance:', error);
      toast({
        title: "Error",
        description: "Failed to load attendance data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadStudentAttendance();
    }
  }, [user?.id, currentPage, limit, instituteId, classId, subjectId, isViewingAsParent, selectedChild?.id]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getInitials = (name?: string) =>
    (name || 'Me').split(' ').filter(Boolean).map(part => part[0]).join('').toUpperCase().slice(0, 2);

  const getStatusStyles = (status: string) => {
    const normalizedStatus = status?.toLowerCase() as AttendanceStatus;
    const config = ATTENDANCE_STATUS_CONFIG[normalizedStatus] || ATTENDANCE_STATUS_CONFIG.present;
    
    const iconMap: Record<AttendanceStatus, React.ReactNode> = {
      present: <UserCheck className="h-4 w-4" />,
      absent: <UserX className="h-4 w-4" />,
      late: <Clock className="h-4 w-4" />,
      left: <LogOut className="h-4 w-4" />,
      left_early: <DoorOpen className="h-4 w-4" />,
      left_lately: <Clock className="h-4 w-4" />
    };

    const dotColorMap: Record<AttendanceStatus, string> = {
      present: 'bg-emerald-500',
      absent: 'bg-red-500',
      late: 'bg-amber-500',
      left: 'bg-purple-500',
      left_early: 'bg-pink-500',
      left_lately: 'bg-indigo-500'
    };

    return {
      bg: config.bgColor,
      text: config.color,
      icon: iconMap[normalizedStatus] || <User className="h-4 w-4" />,
      dot: dotColorMap[normalizedStatus] || 'bg-muted-foreground'
    };
  };

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

  // Create attendance map for calendar
  const attendanceMap = useMemo(() => {
    const map: Record<string, AttendanceStatus> = {};
    if (attendanceData?.data) {
      attendanceData.data.forEach((record) => {
        const dateKey = new Date(record.date).toISOString().split('T')[0];
        map[dateKey] = record.status?.toLowerCase() as AttendanceStatus;
      });
    }
    return map;
  }, [attendanceData]);

  const getDateStatus = (day: number): AttendanceStatus | null => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return attendanceMap[dateStr] || null;
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

  // Pie chart data
  const pieChartData = useMemo(() => {
    const summary = attendanceData?.summary ? normalizeAttendanceSummary(attendanceData.summary as any) : null;
    if (!summary) return [];

    const data = [
      { name: 'Present', value: summary.totalPresent, color: ATTENDANCE_CHART_COLORS.present },
      { name: 'Absent', value: summary.totalAbsent, color: ATTENDANCE_CHART_COLORS.absent },
      { name: 'Late', value: summary.totalLate, color: ATTENDANCE_CHART_COLORS.late },
      { name: 'Left', value: summary.totalLeft, color: ATTENDANCE_CHART_COLORS.left },
      { name: 'Left Early', value: summary.totalLeftEarly, color: ATTENDANCE_CHART_COLORS.left_early },
      { name: 'Left Late', value: summary.totalLeftLately, color: ATTENDANCE_CHART_COLORS.left_lately },
    ].filter(item => item.value > 0);

    return data;
  }, [attendanceData]);

  if (!user) {
    return (
      <div className="p-6">
        <EmptyState icon={AlertTriangle} title="Authentication Required" description="Please log in to view your attendance records." />
      </div>
    );
  }

  const summary = attendanceData?.summary ? normalizeAttendanceSummary(attendanceData.summary as any) : null;
  const totalRecords = summary ?
    (summary.totalPresent + summary.totalAbsent + summary.totalLate + summary.totalLeft + summary.totalLeftEarly + summary.totalLeftLately) : 0;

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:gap-3">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">My Attendance</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
            Your attendance records{selectedInstitute ? ` • ${selectedInstitute.name}` : ''}{selectedClass ? ` • ${selectedClass.name}` : ''}{selectedSubject ? ` • ${selectedSubject.name}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
          >
            <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
            <span className="hidden xs:inline">Filters</span>
          </Button>
          <Button
            onClick={() => loadStudentAttendance(false)}
            disabled={loading}
            variant="outline"
            size="sm"
            className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
          >
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'card' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title="Card View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              title="Table View"
            >
              <Table2 className="h-4 w-4" />
            </button>
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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  min={getMinDate()}
                  max={endDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={getMaxDate()}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Records Per Page</label>
                <select 
                  className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm"
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <Button onClick={() => loadStudentAttendance(false)} disabled={loading} className="md:col-span-2 gap-2">
                <Zap className="h-4 w-4" />
                Apply Filters
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>

        {/* Tab 1: Records */}
        <TabsContent value="records" className="mt-4 space-y-4">
          {/* Attendance Records Table */}
          <Card className="border-border/50">
            <CardHeader className="border-b border-border/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <CardTitle className="text-lg font-semibold">Attendance Records</CardTitle>
                {attendanceData?.totalPages != null && (
                  <p className="text-sm text-muted-foreground">
                    Page {attendanceData.page} of {attendanceData.totalPages}
                    <span className="hidden sm:inline"> • {attendanceData.total} total records</span>
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-muted-foreground">Loading attendance...</span>
                </div>
              ) : attendanceData?.data && attendanceData.data.length > 0 ? (
                <>
                  {viewMode === 'table' ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Institute</TableHead>
                            <TableHead>Class</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead>Marked By</TableHead>
                            <TableHead>Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {attendanceData.data.map((record, index) => {
                            const statusStyles = getStatusStyles(record.status);
                            return (
                              <TableRow key={`tbl-${record.studentId ?? 'me'}-${record.date}-${index}`}>
                                <TableCell className="text-sm">{formatDate(record.date)}</TableCell>
                                <TableCell>
                                  <Badge className={`${statusStyles.bg} ${statusStyles.text} border text-xs gap-1`}>
                                    {statusStyles.icon}
                                    {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-sm">{record.instituteName || 'N/A'}</TableCell>
                                <TableCell className="text-sm">{record.className || 'N/A'}</TableCell>
                                <TableCell className="text-sm">{record.subjectName || 'N/A'}</TableCell>
                                <TableCell className="text-sm">{record.markedBy || 'N/A'}</TableCell>
                                <TableCell className="text-sm">{record.markedAt ? formatTime(record.markedAt) : 'N/A'}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                  <div className="space-y-2">
                    {attendanceData.data.map((record, index) => {
                      const statusStyles = getStatusStyles(record.status);
                      const isExpanded = expandedCards.has(index);
                      return (
                        <Card
                          key={`${record.studentId ?? 'me'}-${record.date}-${index}`}
                          className="hover:shadow-md transition-shadow cursor-pointer select-none"
                          onClick={() => toggleCard(index)}
                        >
                          {/* Always-visible summary row */}
                          <div className="p-4 space-y-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 shrink-0">
                                <AvatarImage src={getImageUrl(record.studentImageUrl || '')} alt={record.studentName || 'Me'} />
                                <AvatarFallback className="text-xs">{getInitials(record.studentName || (user?.name ?? ''))}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm truncate">{formatDate(record.date)}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{formatTime(record.markedAt || record.date)}</p>
                              </div>
                              <Badge className={`${statusStyles.bg} ${statusStyles.text} border text-xs shrink-0 gap-1`}>
                                {statusStyles.icon}
                                {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                              </Badge>
                              <ChevronDown
                                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                            </div>
                            
                            {/* Date, Time, User Type badges */}
                            <div className="flex flex-wrap gap-2 items-center text-xs">
                              {record.date && (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                                  {new Date(record.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                                </Badge>
                              )}
                              {record.markedAt && (
                                <Badge variant="outline" className="bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20">
                                  {new Date(record.markedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </Badge>
                              )}
                              {(record as any).userType && (
                                <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">
                                  {(record as any).userType}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Expandable detail section */}
                          {isExpanded && (
                            <div className="px-4 pb-4 border-t pt-3 space-y-2 text-xs">
                              {record.instituteName && (
                                <p><span className="font-medium text-foreground">Institute:</span> <span className="text-muted-foreground">{record.instituteName}</span></p>
                              )}
                              {record.className && (
                                <p><span className="font-medium text-foreground">Class:</span> <span className="text-muted-foreground">{record.className}</span></p>
                              )}
                              {record.subjectName && (
                                <p><span className="font-medium text-foreground">Subject:</span> <span className="text-muted-foreground">{record.subjectName}</span></p>
                              )}
                              {record.markedBy && (
                                <p><span className="font-medium text-foreground">Marked by:</span> <span className="text-muted-foreground">{record.markedBy}</span></p>
                              )}
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                  )}

                  {/* Pagination */}
                  {attendanceData.totalPages != null && attendanceData.totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-border/50 bg-muted/20">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="gap-1"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-2">
                        {Array.from({ length: Math.min(5, attendanceData.totalPages) }, (_, i) => {
                          const pg = i + 1;
                          return (
                            <Button
                              key={pg}
                              variant={currentPage === pg ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pg)}
                              className="w-8 h-8 p-0"
                            >
                              {pg}
                            </Button>
                          );
                        })}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(attendanceData.totalPages, prev + 1))}
                        disabled={currentPage === attendanceData.totalPages}
                        className="gap-1"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-4">
                  <EmptyState
                    icon={Calendar}
                    title="No Attendance Records"
                    description="No attendance records found for the selected date range"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Calendar View */}
        <TabsContent value="calendar" className="mt-6">
          <Card className="border-border/50">
            <CardHeader className="border-b border-border/50 pb-3">
              <div className="flex flex-col gap-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <CalendarRange className="h-5 w-5 text-primary" />
                  Attendance Calendar
                </CardTitle>
                <div className="flex items-center justify-between gap-2">
                  <Button variant="outline" size="lg" onClick={() => navigateMonth('prev')} className="h-11 w-11 sm:h-9 sm:w-9 flex-shrink-0">
                    <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                  <span className="font-semibold text-base sm:text-sm text-center flex-1">
                    {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Colombo' })}
                  </span>
                  <Button variant="outline" size="lg" onClick={() => navigateMonth('next')} className="h-11 w-11 sm:h-9 sm:w-9 flex-shrink-0">
                    <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-emerald-500" />
                  <span className="text-sm">Present</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-500" />
                  <span className="text-sm">Absent</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-amber-500" />
                  <span className="text-sm">Late</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-purple-500" />
                  <span className="text-sm">Left</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-pink-500" />
                  <span className="text-sm">Left Early</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-indigo-500" />
                  <span className="text-sm">Left Late</span>
                </div>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5 md:gap-2">
                {/* Week Day Headers */}
                {weekDays.map(day => (
                  <div key={day} className="text-center text-[10px] sm:text-xs md:text-sm font-medium text-muted-foreground py-1 sm:py-2">
                    <span className="hidden sm:inline">{day}</span>
                    <span className="sm:hidden">{day.charAt(0)}</span>
                  </div>
                ))}
                
                {/* Calendar Days */}
                {getCalendarDays.map((day, index) => {
                  if (day === null) {
                    return <div key={`empty-${index}`} className="min-h-[52px] sm:min-h-[70px] md:min-h-[80px]" />;
                  }
                  
                  const status = getDateStatus(day);
                  const statusColor = getDateStatusColor(status);
                  const weekday = index % 7; // 0=Sun, 6=Sat
                  const isWeekend = weekday === 0 || weekday === 6;
                  const slStr = new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit',
                  }).format(new Date());
                  const slToday = new Date(slStr + 'T00:00:00');
                  const isToday = slToday.getDate() === day &&
                                  slToday.getMonth() === calendarMonth.getMonth() &&
                                  slToday.getFullYear() === calendarMonth.getFullYear();
                  
                  return (
                    <div 
                      key={day}
                      className={`
                        min-h-[52px] sm:min-h-[70px] md:min-h-[80px] flex items-center justify-center rounded-lg
                        text-sm font-semibold transition-all duration-200 cursor-default
                        ${status ? statusColor : isWeekend ? 'bg-sky-100 dark:bg-sky-900/30 text-foreground' : 'bg-muted/50 text-muted-foreground'}
                        ${isToday ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}
                      `}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Statistics View */}
        <TabsContent value="statistics" className="mt-6 space-y-4">
          {/* Attendance Rate (full width) */}
          {summary && totalRecords > 0 && (
            <Card className="border-border/50">
              <CardContent className="p-4 sm:p-6">
                <div className="text-center py-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                  <p className="text-sm text-muted-foreground mb-1">Overall Attendance Rate</p>
                  <p className="text-5xl font-bold text-primary">{summary.attendanceRate}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{totalRecords} total records</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Pie Chart */}
          <Card className="border-border/50">
            <CardHeader className="border-b border-border/50 pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" />
                Attendance Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {pieChartData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <RechartsPie>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [`${value} days`, name]}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderColor: 'hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '13px',
                        }}
                      />
                    </RechartsPie>
                  </ResponsiveContainer>
                  {/* Legend grid below chart */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                    {pieChartData.map((entry) => {
                      const pct = totalRecords > 0 ? ((entry.value / totalRecords) * 100).toFixed(1) : '0';
                      return (
                        <div key={entry.name} className="flex items-center gap-2 bg-muted/40 rounded-lg px-2 py-1.5">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                          <span className="text-xs font-medium truncate flex-1">{entry.name}</span>
                          <span className="text-xs font-bold">{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Breakdown */}
          <Card className="border-border/50">
            <CardHeader className="border-b border-border/50 pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Monthly Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {summary && totalRecords > 0 ? (
                <div className="space-y-2.5">
                  {[
                    { label: 'Present',    count: summary.totalPresent,     color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Absent',     count: summary.totalAbsent,      color: 'bg-red-500',     textColor: 'text-red-600 dark:text-red-400' },
                    { label: 'Late',       count: summary.totalLate,        color: 'bg-amber-500',   textColor: 'text-amber-600 dark:text-amber-400' },
                    { label: 'Left',       count: summary.totalLeft,        color: 'bg-purple-500',  textColor: 'text-purple-600 dark:text-purple-400' },
                    { label: 'Left Early', count: summary.totalLeftEarly,   color: 'bg-pink-500',    textColor: 'text-pink-600 dark:text-pink-400' },
                    { label: 'Left Late',  count: summary.totalLeftLately,  color: 'bg-indigo-500',  textColor: 'text-indigo-600 dark:text-indigo-400' },
                  ].map((item) => {
                    const percentage = totalRecords > 0 ? ((item.count / totalRecords) * 100) : 0;
                    return (
                      <div key={item.label}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                            <span className="text-sm font-medium">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${item.textColor}`}>{item.count}</span>
                            <span className="text-xs text-muted-foreground w-10 text-right">{percentage.toFixed(1)}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${item.color}`} style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="pt-3 mt-1 border-t border-border/50 flex items-center justify-between">
                    <span className="text-sm font-medium">Total Records</span>
                    <span className="text-xl font-bold">{totalRecords}</span>
                  </div>
                </div>
              ) : (
                <div className="py-12 flex items-center justify-center text-muted-foreground text-sm">
                  No statistics available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MyAttendance;
