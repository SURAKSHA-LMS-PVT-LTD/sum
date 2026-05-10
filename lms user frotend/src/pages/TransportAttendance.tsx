import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import AppLayout from '@/components/layout/AppLayout';
import PageContainer from '@/components/layout/PageContainer';
import CurrentSelection from '@/components/ui/current-selection';
import { transportApi, type TransportAttendanceRecord } from '@/api/transport.api';
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

const TA_COL_DEFS: ColumnDef[] = [
  { key: 'date', header: 'Date', locked: true, defaultWidth: 120, minWidth: 90 },
  { key: 'status', header: 'Status', defaultWidth: 100, minWidth: 80 },
  { key: 'time', header: 'Time', defaultWidth: 100, minWidth: 80 },
  { key: 'vehicleNumber', header: 'Vehicle Number', defaultWidth: 140, minWidth: 110 },
  { key: 'location', header: 'Location', defaultWidth: 150, minWidth: 110 },
  { key: 'notes', header: 'Notes', defaultWidth: 150, minWidth: 110 },
];
const TransportAttendance: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    toast
  } = useToast();
  const {
    user,
    selectedTransport,
    setSelectedTransport,
    selectedChild
  } = useAuth();
  const [loading, setLoading] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<TransportAttendanceRecord[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const taColIds = useMemo(() => TA_COL_DEFS.map(c => c.key), []);
  const taColDefaultWidths = useMemo(() => Object.fromEntries(TA_COL_DEFS.map(c => [c.key, c.defaultWidth!])), []);
  const { getWidth: getTAColWidth, setHoveredCol: setTAHoveredCol, ResizeHandle: TAResizeHandle } = useResizableColumns(taColIds, taColDefaultWidths);
  const { colState: taColState, visibleColumns: taVisDefs, toggleColumn: toggleTACol, resetColumns: resetTACols } = useColumnConfig(TA_COL_DEFS, 'transport-attendance');
  const taVisKeys = useMemo(() => new Set(taVisDefs.map(c => c.key)), [taVisDefs]);
  useEffect(() => {
    // Set transport from location state if available
    if (location.state?.transport && !selectedTransport) {
      setSelectedTransport(location.state.transport);
    } else if (!location.state?.transport && !selectedTransport) {
      // If no transport in state or context, redirect back
      navigate('/transport');
    }
  }, [location.state, selectedTransport, setSelectedTransport, navigate]);
  const handleBack = () => {
    setSelectedTransport(null);
    navigate(-1);
  };
  const loadAttendance = async () => {
    const studentId = selectedChild?.id || user?.id;
    const bookhireId = selectedTransport?.bookhireId;
    if (!studentId || !bookhireId) {
      toast({
        title: "Error",
        description: "Missing student or transport information",
        variant: "destructive"
      });
      return;
    }
    setLoading(true);
    try {
      const response = await transportApi.getStudentAttendance(String(studentId), String(bookhireId), {
        page: 1,
        limit: 10
      });

      // Handle nested API structure: either data (array) or data.data (array)
      const inner = response?.data?.data;
      const list: TransportAttendanceRecord[] = Array.isArray(inner) ? inner : Array.isArray((inner as any)?.data) ? (inner as any).data : [];
      setAttendanceRecords(list);
      toast({
        title: "Success",
        description: `Loaded ${list.length} attendance records`
      });
    } catch (error: any) {
      console.error('Error loading attendance:', error);
      toast({
        title: "Error",
        description: "Failed to load attendance records",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if ((selectedChild?.id || user?.id) && selectedTransport?.bookhireId) {
      loadAttendance();
    }
  }, [selectedChild?.id, user?.id, selectedTransport?.bookhireId]);
  const normalizeStatus = (s?: string) => s?.toString().trim().toLowerCase() || '';
  const getStatusColor = (status: string) => {
    switch (normalizeStatus(status)) {
      case 'pickup':
        return 'bg-green-100 text-green-800';
      case 'dropoff':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
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
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(+event.target.value);
    setPage(0);
  };
  if (!selectedTransport) {
    return <AppLayout currentPage="transport-attendance">
        <PageContainer>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </div>
        </PageContainer>
      </AppLayout>;
  }
  return <AppLayout currentPage="transport-attendance">
      <div className="w-full h-full min-h-0 flex flex-col">
        <div className="p-4 md:p-6 space-y-4 shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Transport Attendance</h1>
              <p className="text-muted-foreground">Track your transport usage</p>
            </div>
          </div>

          <CurrentSelection transport={{
          id: selectedTransport?.id || '-',
          vehicleModel: String(selectedTransport?.bookhireId || '-')
        }} />
          

          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Attendance Records
            </h2>
            <Button onClick={loadAttendance} disabled={loading} size="sm">
              {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
            <ColumnConfigurator allColumns={TA_COL_DEFS} colState={taColState} onToggle={toggleTACol} onReset={resetTACols} />
          </div>
        </div>

        <div className="flex-1 min-h-0 px-0 md:px-6 pb-0 md:pb-6">
          {loading ? <div className="flex justify-center items-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>Loading attendance...</span>
            </div> : attendanceRecords.length > 0 ? <Paper sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}>
              <TableContainer sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                <Table stickyHeader aria-label="transport attendance table" sx={{ tableLayout: 'fixed', minWidth: taVisDefs.reduce((s, c) => s + getTAColWidth(c.key), 0) }}>
                   <TableHead>
                    <TableRow>
                      {taVisDefs.map((col) => (
                        <TableCell key={col.key} sx={{ position: 'relative', width: getTAColWidth(col.key), fontWeight: 600, bgcolor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}
                          onMouseEnter={() => setTAHoveredCol(col.key)} onMouseLeave={() => setTAHoveredCol(null)}>
                          <div style={{ paddingRight: 12 }}>{col.header}</div>
                          <TAResizeHandle colId={col.key} />
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                   <TableBody>
                    {attendanceRecords.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((record, index) => <TableRow hover key={`${record.timestamp}-${index}`}>
                      {taVisKeys.has('date') && <TableCell style={{ width: getTAColWidth('date'), maxWidth: getTAColWidth('date'), overflow: 'hidden' }}>{formatDate(record.attendanceDate)}</TableCell>}
                      {taVisKeys.has('status') && <TableCell style={{ width: getTAColWidth('status'), maxWidth: getTAColWidth('status'), overflow: 'hidden' }}><Badge className={getStatusColor(record.status)}>{record.status}</Badge></TableCell>}
                      {taVisKeys.has('time') && <TableCell style={{ width: getTAColWidth('time'), maxWidth: getTAColWidth('time'), overflow: 'hidden' }}>{formatTime(record.timestamp)}</TableCell>}
                      {taVisKeys.has('vehicleNumber') && <TableCell style={{ width: getTAColWidth('vehicleNumber'), maxWidth: getTAColWidth('vehicleNumber'), overflow: 'hidden' }}>{record.vehicleNumber || '-'}</TableCell>}
                      {taVisKeys.has('location') && <TableCell style={{ width: getTAColWidth('location'), maxWidth: getTAColWidth('location'), overflow: 'hidden' }}>{record.location || '-'}</TableCell>}
                      {taVisKeys.has('notes') && <TableCell style={{ width: getTAColWidth('notes'), maxWidth: getTAColWidth('notes'), overflow: 'hidden' }}>{record.notes || '-'}</TableCell>}
                    </TableRow>)}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination rowsPerPageOptions={[5, 10, 25, 50]} component="div" count={attendanceRecords.length} rowsPerPage={rowsPerPage} page={page} onPageChange={handleChangePage} onRowsPerPageChange={handleChangeRowsPerPage} />
            </Paper> : <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No attendance records found</p>
            </div>}
        </div>
      </div>
    </AppLayout>;
};
export default TransportAttendance;