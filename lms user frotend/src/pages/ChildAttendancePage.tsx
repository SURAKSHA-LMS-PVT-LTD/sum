import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  RefreshCw, 
  UserCheck, 
  UserX, 
  Clock, 
  Filter, 
  TrendingUp,
  CalendarDays,
  Download,
  Search
} from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { childAttendanceApi, type ChildAttendanceResponse } from '@/api/childAttendance.api';
import { format, subDays, addDays } from 'date-fns';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { useResizableColumns } from '@/hooks/useResizableColumns';
import { useColumnConfig, type ColumnDef } from '@/hooks/useColumnConfig';
import ColumnConfigurator from '@/components/ui/column-configurator';

const CAP_COL_DEFS: ColumnDef[] = [
  { key: 'date', header: 'Date', locked: true, defaultWidth: 120, minWidth: 90 },
  { key: 'status', header: 'Status', defaultWidth: 110, minWidth: 80 },
  { key: 'institute', header: 'Institute', defaultWidth: 150, minWidth: 110 },
  { key: 'class', header: 'Class', defaultWidth: 130, minWidth: 90 },
  { key: 'subject', header: 'Subject', defaultWidth: 150, minWidth: 110 },
  { key: 'location', header: 'Location', defaultVisible: false, defaultWidth: 150, minWidth: 110 },
  { key: 'method', header: 'Method', defaultWidth: 120, minWidth: 90 },
];

const ChildAttendancePage = () => {
  const capColIds = useMemo(() => CAP_COL_DEFS.map(c => c.key), []);
  const capColDefaultWidths = useMemo(() => Object.fromEntries(CAP_COL_DEFS.map(c => [c.key, c.defaultWidth!])), []);
  const { getWidth: getCAPColWidth, setHoveredCol: setCAPHoveredCol, ResizeHandle: CAPResizeHandle } = useResizableColumns(capColIds, capColDefaultWidths);
  const { colState: capColState, visibleColumns: capVisDefs, toggleColumn: toggleCAPCol, resetColumns: resetCAPCols } = useColumnConfig(CAP_COL_DEFS, 'child-attendance-page');
  const capVisKeys = useMemo(() => new Set(capVisDefs.map(c => c.key)), [capVisDefs]);

  const { selectedChild } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [attendanceData, setAttendanceData] = useState<ChildAttendanceResponse | null>(null);
  const getYesterday = () => format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const getTomorrow = () => format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(getYesterday());
  const [endDate, setEndDate] = useState(getTomorrow());
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (selectedChild?.id) {
      loadAttendance();
    }
  }, [selectedChild?.id]);

  const loadAttendance = async () => {
    if (!selectedChild?.id) {
      toast({
        title: "No Child Selected",
        description: "Please select a child to view attendance",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await childAttendanceApi.getChildAttendance({
        studentId: selectedChild.id,
        startDate,
        endDate,
        page: 1,
        limit: 100
      });
      
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

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'present':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'absent':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'late':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'present':
        return <UserCheck className="h-3.5 w-3.5" />;
      case 'absent':
        return <UserX className="h-3.5 w-3.5" />;
      case 'late':
        return <Clock className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };

  return (
    <div className="h-screen flex flex-col space-y-6 p-6 overflow-hidden bg-gradient-to-br from-background to-muted/20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
              <CalendarDays className="h-5 w-5 text-primary-foreground" />
            </div>
            Attendance Records
          </h1>
        <p className="text-muted-foreground">
          {selectedChild?.user?.firstName 
            ? `Viewing attendance for ${selectedChild.user.firstName} ${selectedChild.user.lastName || ''}`.trim() 
            : selectedChild?.name
            ? `Viewing attendance for ${selectedChild.name}`
            : 'Select a child to view attendance'}
        </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`gap-2 ${showFilters ? 'bg-muted' : ''}`}
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          {attendanceData && (
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Filters Card */}
      <Card className={`transition-all duration-300 ${showFilters ? 'opacity-100' : 'hidden'}`}>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Start Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                End Date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </div>
            <Button onClick={loadAttendance} disabled={loading} className="gap-2 h-10">
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {loading ? 'Loading...' : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {loading && !attendanceData && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      {!loading && !attendanceData && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <CalendarDays className="h-7 w-7 opacity-40" />
          </div>
          <p className="font-medium">No attendance records found</p>
          <p className="text-sm text-muted-foreground">No records available for the selected date range.</p>
        </div>
      )}
      {attendanceData?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Present</p>
                  <p className="text-xl font-semibold text-foreground">
                    {attendanceData.summary.totalPresent}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <UserX className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Absent</p>
                  <p className="text-xl font-semibold text-foreground">
                    {attendanceData.summary.totalAbsent}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Late</p>
                  <p className="text-xl font-semibold text-foreground">
                    {attendanceData.summary.totalLate}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rate</p>
                  <p className="text-xl font-semibold text-foreground">
                    {attendanceData.summary.attendanceRate}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Table */}
      {attendanceData && (
        <Card className="flex-1 overflow-hidden flex flex-col">
          <CardHeader className="flex-shrink-0 border-b">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-muted-foreground" />
                Records
                <Badge variant="secondary" className="ml-2">
                  {attendanceData.pagination.totalRecords}
                </Badge>
              </span>
              <ColumnConfigurator allColumns={CAP_COL_DEFS} colState={capColState} onToggle={toggleCAPCol} onReset={resetCAPCols} />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
            {attendanceData.data && attendanceData.data.length > 0 ? (
              <Paper sx={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                  <Table stickyHeader aria-label="attendance records table" sx={{ tableLayout: 'fixed', minWidth: capVisDefs.reduce((s, c) => s + getCAPColWidth(c.key), 0) }}>
                    <TableHead>
                      <TableRow>
                        {capVisDefs.map((col) => (
                          <TableCell key={col.key} sx={{ position: 'relative', width: getCAPColWidth(col.key), fontWeight: 600, bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}
                            onMouseEnter={() => setCAPHoveredCol(col.key)} onMouseLeave={() => setCAPHoveredCol(null)}>
                            <div style={{ paddingRight: 12 }}>{col.header}</div>
                            <CAPResizeHandle colId={col.key} />
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {attendanceData.data
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((record, index) => (
                          <TableRow hover key={record.attendanceId || `${record.studentId}-${record.date}-${index}`}>
                            {capVisKeys.has('date') && <TableCell style={{ width: getCAPColWidth('date'), maxWidth: getCAPColWidth('date'), overflow: 'hidden' }}><span className="font-medium">{new Date(record.date || record.markedAt || '').toLocaleDateString()}</span></TableCell>}
                            {capVisKeys.has('status') && <TableCell style={{ width: getCAPColWidth('status'), maxWidth: getCAPColWidth('status'), overflow: 'hidden' }}><Badge className={`${getStatusColor(record.status)} border`}><div className="flex items-center gap-1.5">{getStatusIcon(record.status)}{record.status.charAt(0).toUpperCase() + record.status.slice(1)}</div></Badge></TableCell>}
                            {capVisKeys.has('institute') && <TableCell style={{ width: getCAPColWidth('institute'), maxWidth: getCAPColWidth('institute'), overflow: 'hidden' }}>{record.instituteName || '-'}</TableCell>}
                            {capVisKeys.has('class') && <TableCell style={{ width: getCAPColWidth('class'), maxWidth: getCAPColWidth('class'), overflow: 'hidden' }}>{record.className || '-'}</TableCell>}
                            {capVisKeys.has('subject') && <TableCell style={{ width: getCAPColWidth('subject'), maxWidth: getCAPColWidth('subject'), overflow: 'hidden' }}>{record.subjectName || '-'}</TableCell>}
                            {capVisKeys.has('location') && <TableCell style={{ width: getCAPColWidth('location'), maxWidth: getCAPColWidth('location'), overflow: 'hidden' }} className="text-muted-foreground">{record.location || record.address || '-'}</TableCell>}
                            {capVisKeys.has('method') && <TableCell style={{ width: getCAPColWidth('method'), maxWidth: getCAPColWidth('method'), overflow: 'hidden' }}><Badge variant="outline" className="text-xs font-normal">{record.markingMethod}</Badge></TableCell>}
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25, 50]}
                  component="div"
                  count={attendanceData.data.length}
                  rowsPerPage={rowsPerPage}
                  page={page}
                  onPageChange={handleChangePage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                />
              </Paper>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="No Records Found"
                description="No attendance records found for the selected date range."
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ChildAttendancePage;
