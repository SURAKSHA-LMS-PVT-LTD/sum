import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import adminAttendanceApi, { AdminAttendanceRecord, AdminUserType } from '@/api/adminAttendance.api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { renderAttendanceStatusBadge } from '@/components/calendar/calendarTheme';
import { getImageUrl } from '@/utils/imageUrlHelper';

const USER_TYPES: { value: AdminUserType; label: string; icon: string }[] = [
  { value: 'STUDENT', label: 'Students', icon: '' },
  { value: 'TEACHER', label: 'Teachers', icon: '' },
  { value: 'INSTITUTE_ADMIN', label: 'Admin Staff', icon: '' },
  { value: 'ATTENDANCE_MARKER', label: 'Markers', icon: '' },
];

const AttendanceByUserType: React.FC = () => {
  const { currentInstituteId } = useAuth();
  const [activeType, setActiveType] = useState<AdminUserType>('STUDENT');
  const [records, setRecords] = useState<AdminAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = useCallback(async () => {
    if (!currentInstituteId) return;
    setLoading(true);
    try {
      const res = await adminAttendanceApi.getAttendanceByUserType(
        currentInstituteId,
        activeType,
        { page, limit: 20 }
      );
      setRecords(res?.data || []);
      setTotalPages(res?.pagination?.totalPages || 1);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load user type attendance');
    } finally {
      setLoading(false);
    }
  }, [currentInstituteId, activeType, page]);

  useEffect(() => { setPage(1); }, [activeType]);
  useEffect(() => { loadData(); }, [loadData]);

  const summary = {
    total: records.length,
    present: records.filter(r => r.status === 'present').length,
    absent: records.filter(r => r.status === 'absent').length,
    late: records.filter(r => r.status === 'late').length,
  };
  const avgRate = summary.total > 0 ? Math.round((summary.present / summary.total) * 1000) / 10 : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Attendance by User Type
          </CardTitle>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeType} onValueChange={(v) => setActiveType(v as AdminUserType)}>
          <TabsList className="grid w-full grid-cols-4 h-auto gap-1 bg-muted/50 p-1">
            {USER_TYPES.map(t => (
              <TabsTrigger key={t.value} value={t.value} className="text-[10px] sm:text-xs w-full justify-center py-2 sm:py-2.5 px-1 whitespace-nowrap">
                {t.icon} {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 bg-muted rounded-lg">
            <div className="text-lg font-bold">{summary.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
            <div className="text-lg font-bold text-emerald-600">{summary.present}</div>
            <div className="text-xs text-muted-foreground">Present</div>
          </div>
          <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="text-lg font-bold text-red-500">{summary.absent}</div>
            <div className="text-xs text-muted-foreground">Absent</div>
          </div>
          <div className="text-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="text-lg font-bold text-amber-600">{avgRate}%</div>
            <div className="text-xs text-muted-foreground">Rate</div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No records found</p>
        ) : (
          <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                    <TableHead className="text-xs">Event</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={getImageUrl(r.studentImageUrl || r.imageUrl || '')} alt={r.studentName || r.userName || r.studentId || r.userId} />
                            <AvatarFallback className="text-[10px]">
                              {(r.studentName || r.userName || r.studentId || r.userId || '?').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{r.studentName || r.userName || r.studentId || r.userId}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {(r.date || r.markedAt?.split('T')[0]) &&
                          new Date(r.date || r.markedAt!.split('T')[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </TableCell>
                      <TableCell className="text-xs text-center">{renderAttendanceStatusBadge(r.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.eventTitle || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AttendanceByUserType;
