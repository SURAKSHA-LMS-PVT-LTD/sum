import React, { useState, useEffect, useMemo } from 'react';
import { useResizableColumns } from '@/hooks/useResizableColumns';
import { useColumnConfig, type ColumnDef } from '@/hooks/useColumnConfig';
import ColumnConfigurator from '@/components/ui/column-configurator';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, MapPin, User, RefreshCw, AlertTriangle, TrendingUp, UserCheck, UserX, LogOut, DoorOpen, ChevronLeft, ChevronRight, List, CalendarRange, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { childAttendanceApi, type ChildAttendanceRecord, type ChildAttendanceResponse } from '@/api/childAttendance.api';
import { useApiRequest } from '@/hooks/useApiRequest';
import { EmptyState } from '@/components/ui/EmptyState';
import { AttendanceStatus, ATTENDANCE_STATUS_CONFIG, ATTENDANCE_CHART_COLORS, normalizeAttendanceSummary } from '@/types/attendance.types';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const CA_COL_DEFS: ColumnDef[] = [
  { key: 'datetime', header: 'Date & Time', locked: true, defaultWidth: 200, minWidth: 120 },
  { key: 'status', header: 'Status', locked: true, defaultWidth: 100, minWidth: 80 },
  { key: 'institute', header: 'Institute', defaultVisible: false, defaultWidth: 160, minWidth: 100 },
  { key: 'classSubject', header: 'Class & Subject', defaultVisible: true, defaultWidth: 180, minWidth: 120 },
  { key: 'location', header: 'Location', defaultVisible: true, defaultWidth: 160, minWidth: 100 },
  { key: 'markedBy', header: 'Marked By', defaultVisible: true, defaultWidth: 140, minWidth: 80 },
  { key: 'method', header: 'Method', defaultVisible: true, defaultWidth: 120, minWidth: 80 },
];

const ChildAttendance = () => {
  const { selectedChild, user } = useAuth();
  const userRole = useInstituteRole();
  const { toast } = useToast();
  const [attendanceData, setAttendanceData] = useState<ChildAttendanceResponse | null>(null);
  const [startDate, setStartDate] = useState('2025-09-01');
  const [endDate, setEndDate] = useState('2025-09-07');
  const [currentPage, setCurrentPage] = useState(0);
  const [limit, setLimit] = useState(50);
  const [rowsPerPageOptions] = useState([25, 50, 100]);
  const [activeTab, setActiveTab] = useState('records');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const { execute: fetchAttendance, loading } = useApiRequest(childAttendanceApi.getChildAttendance);

  const loadChildAttendance = async () => {
    if (!selectedChild?.id) {
      toast({
        title: "No Child Selected",
        description: "Please select a child to view attendance",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Loading attendance for child:', selectedChild.id);
      const response = await fetchAttendance({
        studentId: selectedChild.id,
        startDate,
        endDate,
        page: currentPage + 1,
        limit,
        userId: user?.id,
        role: userRole || 'User'
      });
      
      console.log('Child attendance API response:', response);
      setAttendanceData(response);
      
      toast({
        title: response.success ? "Attendance Loaded" : "Partial Load",
        description: response.message || `Loaded ${response.data?.length || 0} attendance records`,
      });
    } catch (error: any) {
      console.error('Error loading child attendance:', error);
      toast({
        title: "Error",
        description: "Failed to load attendance data",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (selectedChild?.id) {
      loadChildAttendance();
    }
  }, [selectedChild?.id, currentPage]);

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

  // Daily attendance summary for calendar
  const dailyAttendanceMap = useMemo(() => {
    const map: Record<string, { present: number; absent: number; late: number }> = {};
    if (attendanceData?.data) {
      attendanceData.data.forEach((record) => {
        const dateKey = new Date(record.markedAt).toISOString().split('T')[0];
        if (!map[dateKey]) {
          map[dateKey] = { present: 0, absent: 0, late: 0 };
        }
        const status = record.status?.toLowerCase() as AttendanceStatus;
        if (status === 'present') map[dateKey].present++;
        else if (status === 'absent') map[dateKey].absent++;
        else if (status === 'late') map[dateKey].late++;
      });
    }
    return map;
  }, [attendanceData?.data]);

  const getDayStats = (day: number) => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dailyAttendanceMap[dateStr] || null;
  };

  // 30-day statistics for pie chart
  const last30DaysStats = useMemo(() => {
    const stats = { present: 0, absent: 0, late: 0 };
    const today = new Date();
    const last30Days: string[] = [];
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      last30Days.push(date.toISOString().split('T')[0]);
    }
    
    if (attendanceData?.data) {
      attendanceData.data.forEach((record) => {
        const dateKey = new Date(record.markedAt).toISOString().split('T')[0];
        if (last30Days.includes(dateKey)) {
          const status = record.status?.toLowerCase() as AttendanceStatus;
          if (status === 'present') stats.present++;
          else if (status === 'absent') stats.absent++;
          else if (status === 'late') stats.late++;
        }
      });
    }
    
    return stats;
  }, [attendanceData?.data]);

  const pieChartData = useMemo(() => {
    const total = last30DaysStats.present + last30DaysStats.absent + last30DaysStats.late;
    if (total === 0) return [];
    
    return [
      { name: 'Present', value: last30DaysStats.present, color: ATTENDANCE_CHART_COLORS.present, percentage: ((last30DaysStats.present / total) * 100).toFixed(1) },
      { name: 'Absent', value: last30DaysStats.absent, color: ATTENDANCE_CHART_COLORS.absent, percentage: ((last30DaysStats.absent / total) * 100).toFixed(1) },
      { name: 'Late', value: last30DaysStats.late, color: ATTENDANCE_CHART_COLORS.late, percentage: ((last30DaysStats.late / total) * 100).toFixed(1) },
    ].filter(item => item.value > 0);
  }, [last30DaysStats]);

  // Bar chart data for last 30 days (grouped by week)
  const barChartData = useMemo(() => {
    const today = new Date();
    const data: { day: string; present: number; absent: number; late: number }[] = [];
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const dayStats = dailyAttendanceMap[dateKey] || { present: 0, absent: 0, late: 0 };
      
      data.push({
        day: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        present: dayStats.present,
        absent: dayStats.absent,
        late: dayStats.late
      });
    }
    
    return data;
  }, [dailyAttendanceMap]);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
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

  const getStatusColor = (status: string) => {
    const config = ATTENDANCE_STATUS_CONFIG[status?.toLowerCase() as AttendanceStatus];
    if (!config) return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    return `${config.bgColor} ${config.color}`;
  };

  const getStatusIcon = (status: string) => {
    const normalizedStatus = status?.toLowerCase() as AttendanceStatus;
    const iconMap: Record<AttendanceStatus, React.ReactNode> = {
      present: <UserCheck className="h-4 w-4" />,
      absent: <UserX className="h-4 w-4" />,
      late: <Clock className="h-4 w-4" />,
      left: <LogOut className="h-4 w-4" />,
      left_early: <DoorOpen className="h-4 w-4" />,
      left_lately: <Clock className="h-4 w-4" />
    };
    return iconMap[normalizedStatus] || <User className="h-4 w-4" />;
  };

  const renderCACell = (colId: string, record: ChildAttendanceRecord) => {
    switch (colId) {
      case 'datetime':
        return (
          <div className="flex flex-col">
            <span className="font-medium">{formatDate(record.markedAt)}</span>
            <span className="text-sm text-muted-foreground">{formatTime(record.markedAt)}</span>
          </div>
        );
      case 'status':
        return (
          <Badge className={getStatusColor(record.status)}>
            <div className="flex items-center gap-1">
              {getStatusIcon(record.status)}
              {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
            </div>
          </Badge>
        );
      case 'institute':
        return <span className="font-medium">{record.instituteName}</span>;
      case 'classSubject':
        return (
          <div className="flex flex-col">
            <span className="font-medium">{record.className}</span>
            <span className="text-sm text-muted-foreground">{record.subjectName}</span>
          </div>
        );
      case 'location':
        return (
          <div className="flex items-center gap-1 text-sm">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            <span className="max-w-[150px] truncate" title={String(record.address ?? '')}>
              {String(record.address ?? '')}
            </span>
          </div>
        );
      case 'markedBy':
        return <span className="text-sm">{record.markedBy}</span>;
      case 'method':
        return (
          <Badge variant="outline" className="text-xs">
            {record.markingMethod}
          </Badge>
        );
      default:
        return null;
    }
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const { getWidth: getCAColWidth, totalWidth: totalCATableWidth, setHoveredCol: setCAHoveredCol, ResizeHandle: CAResizeHandle } = useResizableColumns(
    ['datetime', 'status', 'institute', 'classSubject', 'location', 'markedBy', 'method'],
    { datetime: 200, status: 100, institute: 160, classSubject: 180, location: 160, markedBy: 140, method: 120 }
  );

  const { colState: caColState, visibleColumns: caVisColDefs, toggleColumn: toggleCACol, resetColumns: resetCACols } = useColumnConfig(CA_COL_DEFS, 'child-attendance');
  const caVisibleKeys = useMemo(() => new Set(caVisColDefs.map(c => c.key)), [caVisColDefs]);

  if (!selectedChild) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <Card>
          <CardContent className="p-6 sm:p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Child Selected</h3>
            <p className="text-muted-foreground">
              Please select a child to view their attendance records.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 min-h-screen flex flex-col space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Child Attendance</h1>
          <p className="text-muted-foreground">
            Viewing attendance for: <span className="font-semibold">{(selectedChild as any).name}</span>
          </p>
        </div>
        <Button 
          onClick={loadChildAttendance} 
          disabled={loading}
          variant="outline"
          size="sm"
        >
          {loading ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* Date Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Date Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-sm font-medium mb-2 block">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button onClick={loadChildAttendance} disabled={loading}>
              Apply Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation - Pill Style with Arrows */}
      <div className="w-full">
        <div className="flex items-center justify-center gap-2 py-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const tabs = ['records', 'calendar', 'statistics'];
              const currentIndex = tabs.indexOf(activeTab);
              if (currentIndex > 0) {
                setActiveTab(tabs[currentIndex - 1]);
              }
            }}
            disabled={activeTab === 'records'}
            className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </Button>

          {/* Pill Tab Buttons */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-full p-1">
            {[
              { id: 'records', icon: List, label: 'Records' },
              { id: 'calendar', icon: CalendarRange, label: 'Calendar' },
              { id: 'statistics', icon: PieChartIcon, label: 'Statistics' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                  ${activeTab === tab.id 
                    ? 'bg-primary text-primary-foreground shadow-md' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }
                `}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const tabs = ['records', 'calendar', 'statistics'];
              const currentIndex = tabs.indexOf(activeTab);
              if (currentIndex < tabs.length - 1) {
                setActiveTab(tabs[currentIndex + 1]);
              }
            }}
            disabled={activeTab === 'statistics'}
            className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </Button>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 pb-4">
          {['records', 'calendar', 'statistics'].map((tab) => (
            <div
              key={tab}
              className={`h-2 w-2 rounded-full transition-all ${
                activeTab === tab ? 'bg-primary w-6' : 'bg-muted-foreground/30'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Records Tab */}
      {activeTab === 'records' && (
        <>
          {/* Summary Cards */}
          {attendanceData?.summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Present</CardTitle>
                  <UserCheck className="h-4 w-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">
                    {attendanceData.summary.totalPresent || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Absent</CardTitle>
                  <UserX className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {attendanceData.summary.totalAbsent || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Late</CardTitle>
                  <Clock className="h-4 w-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">
                    {attendanceData.summary.totalLate || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Left</CardTitle>
                  <LogOut className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    {attendanceData.summary.totalLeft || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Left Early</CardTitle>
                  <DoorOpen className="h-4 w-4 text-pink-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-pink-600">
                    {attendanceData.summary.totalLeftEarly || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Left Late</CardTitle>
                  <Clock className="h-4 w-4 text-indigo-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-indigo-600">
                    {attendanceData.summary.totalLeftLately || 0}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {attendanceData.summary.attendanceRate || 0}%
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Attendance Records Table */}
          <Card className="flex-1 min-h-0 flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Attendance Records</CardTitle>
                <ColumnConfigurator allColumns={CA_COL_DEFS} colState={caColState} onToggle={toggleCACol} onReset={resetCACols} />
              </div>
              {attendanceData?.pagination && (
                <p className="text-sm text-muted-foreground">
                  Page {attendanceData.pagination.currentPage} of {attendanceData.pagination.totalPages} 
                  ({attendanceData.pagination.totalRecords} total records)
                </p>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0">
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading attendance...</span>
                </div>
              ) : attendanceData?.data && attendanceData.data.length > 0 ? (
                <Paper sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <TableContainer sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                    <Table stickyHeader aria-label="attendance table" sx={{ tableLayout: 'fixed', minWidth: caVisColDefs.reduce((sum, col) => sum + getCAColWidth(col.key), 0) }}>
                      <TableHead>
                        <TableRow>
                          {caVisColDefs.map((col) => (
                            <TableCell
                              key={col.key}
                              onMouseEnter={() => setCAHoveredCol(col.key)}
                              onMouseLeave={() => setCAHoveredCol(null)}
                              style={{ position: 'relative', width: getCAColWidth(col.key), userSelect: 'none' }}
                            >
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.header}</div>
                              <CAResizeHandle colId={col.key} />
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {attendanceData.data
                          .slice(currentPage * limit, currentPage * limit + limit)
                          .map((record) => (
                          <TableRow hover role="checkbox" tabIndex={-1} key={record.attendanceId}>
                            {caVisColDefs.map(col => (
                              <TableCell key={col.key}>{renderCACell(col.key, record)}</TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    rowsPerPageOptions={rowsPerPageOptions}
                    component="div"
                    count={attendanceData.data.length}
                    rowsPerPage={limit}
                    page={currentPage}
                    onPageChange={(event: unknown, newPage: number) => {
                      setCurrentPage(newPage);
                    }}
                    onRowsPerPageChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                      setLimit(parseInt(event.target.value, 10));
                      setCurrentPage(0);
                    }}
                  />
                </Paper>
              ) : (
                <EmptyState
                  icon={Calendar}
                  title="No Attendance Records"
                  description="No attendance records found for the selected date range."
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Calendar Tab */}
      {activeTab === 'calendar' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarRange className="h-5 w-5" />
                Monthly Attendance Calendar
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium min-w-[140px] text-center">
                  {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Legend */}
            <div className="flex flex-wrap gap-4 mb-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span>Present</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Absent</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span>Late</span>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {weekDays.map((day) => (
                <div key={day} className="text-center font-medium text-sm py-2 text-muted-foreground">
                  {day}
                </div>
              ))}
              {getCalendarDays.map((day, index) => {
                const stats = day ? getDayStats(day) : null;
                return (
                  <div
                    key={index}
                    className={`min-h-[80px] p-2 border rounded-lg ${
                      day ? 'bg-card hover:bg-muted/50' : 'bg-transparent'
                    }`}
                  >
                    {day && (
                      <>
                        <div className="font-medium text-sm mb-1">{day}</div>
                        {stats && (
                          <div className="space-y-1 text-xs">
                            {stats.present > 0 && (
                              <div className="flex items-center gap-1 text-emerald-600">
                                <UserCheck className="h-3 w-3" />
                                <span>{stats.present}</span>
                              </div>
                            )}
                            {stats.absent > 0 && (
                              <div className="flex items-center gap-1 text-red-600">
                                <UserX className="h-3 w-3" />
                                <span>{stats.absent}</span>
                              </div>
                            )}
                            {stats.late > 0 && (
                              <div className="flex items-center gap-1 text-amber-600">
                                <Clock className="h-3 w-3" />
                                <span>{stats.late}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Tab */}
      {activeTab === 'statistics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5" />
                30-Day Attendance Distribution
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
                        paddingAngle={5}
                        dataKey="value"
                        label={(props: any) => `${props.name}: ${props.percentage}%`}
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
                  No attendance data available for the last 30 days
                </div>
              )}

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="text-center p-3 rounded-lg bg-emerald-500/10">
                  <div className="text-2xl font-bold text-emerald-600">{last30DaysStats.present}</div>
                  <div className="text-sm text-muted-foreground">Present</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-500/10">
                  <div className="text-2xl font-bold text-red-600">{last30DaysStats.absent}</div>
                  <div className="text-sm text-muted-foreground">Absent</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-amber-500/10">
                  <div className="text-2xl font-bold text-amber-600">{last30DaysStats.late}</div>
                  <div className="text-sm text-muted-foreground">Late</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                30-Day Attendance Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="day" 
                      tick={{ fontSize: 10 }} 
                      interval={4}
                      className="text-muted-foreground"
                    />
                    <YAxis className="text-muted-foreground" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="present" name="Present" fill={ATTENDANCE_CHART_COLORS.present} />
                    <Bar dataKey="absent" name="Absent" fill={ATTENDANCE_CHART_COLORS.absent} />
                    <Bar dataKey="late" name="Late" fill={ATTENDANCE_CHART_COLORS.late} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ChildAttendance;