import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import adminAttendanceApi, { AdminAttendanceRecord } from '@/api/adminAttendance.api';
import { getAuthHeadersSync } from '@/services/tokenStorageService';
import { normalizeAttendanceSummary, AttendanceSummary } from '@/types/attendance.types';
import calendarApi from '@/api/calendar.api';
import type { CalendarEvent } from '@/types/calendar.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, Search, Download, Filter, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { renderAttendanceStatusBadge } from '@/components/calendar/calendarTheme';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getImageUrl } from '@/utils/imageUrlHelper';

function toSriLankaTime(utcStr: string): string {
  try {
    return new Date(utcStr).toLocaleString('en-LK', {
      timeZone: 'Asia/Colombo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch { return utcStr; }
}

const EventAttendanceView: React.FC = () => {
  const { currentInstituteId } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [records, setRecords] = useState<AdminAttendanceRecord[]>([]);
  const [apiSummary, setApiSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [studentImagesMap, setStudentImagesMap] = useState<Map<string, string>>(new Map());
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Load events
  const loadEvents = useCallback(async () => {
    if (!currentInstituteId) return;
    setLoadingEvents(true);
    try {
      const res = await calendarApi.getEvents(currentInstituteId, { startDate, endDate, limit: 100 });
      setEvents(res?.data || []);
    } catch (e: any) {
      toast.error('Failed to load events');
    } finally {
      setLoadingEvents(false);
    }
  }, [currentInstituteId, startDate, endDate]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Load event attendance
  const loadEventAttendance = useCallback(async () => {
    if (!currentInstituteId || !selectedEventId) return;
    setLoading(true);
    try {
      const res = await adminAttendanceApi.getEventAttendance(currentInstituteId, selectedEventId, { limit: 200 });
      const data = res?.data;
      // Handle both flat array and nested response
      if (Array.isArray(data)) {
        setRecords(data);
      } else if (data && typeof data === 'object' && 'records' in data) {
        setRecords((data as any).records || []);
      } else {
        setRecords([]);
      }
      setApiSummary(normalizeAttendanceSummary(res?.summary));
    } catch (e: any) {
      toast.error(e.message || 'Failed to load event attendance');
    } finally {
      setLoading(false);
    }
  }, [currentInstituteId, selectedEventId]);

  useEffect(() => {
    if (selectedEventId) loadEventAttendance();
  }, [selectedEventId, loadEventAttendance]);

  // ✅ NEW: Load student images when records are loaded
  useEffect(() => {
    if (records.length === 0 || !currentInstituteId) {
      setStudentImagesMap(new Map());
      return;
    }

    const fetchStudentImages = async () => {
      try {
        const classId = (records[0] as any)?.classId;

        if (classId) {
          const response = await fetch(
            `${import.meta.env.VITE_LMS_BASE_URL || 'https://lmsapi.suraksha.lk'}/institutes/${currentInstituteId}/classes/${classId}/students`,
            { headers: getAuthHeadersSync() }
          );
          
          if (response.ok) {
            const data = await response.json();
            const studentsData = data.data || [];
            const imagesMap = new Map<string, string>();
            studentsData.forEach((student: any) => {
              if (student.id && student.imageUrl) {
                imagesMap.set(student.id.toString(), student.imageUrl);
              }
            });
            setStudentImagesMap(imagesMap);
          }
        }
      } catch (error: any) {
        console.error('Failed to fetch student images:', error);
      }
    };

    fetchStudentImages();
  }, [records, currentInstituteId]);

  // Summary - use records if available, fall back to API summary
  const summary = React.useMemo(() => {
    if (records.length > 0) {
      const present = records.filter(r => r.status === 'present').length;
      const absent = records.filter(r => r.status === 'absent').length;
      const late = records.filter(r => r.status === 'late').length;
      const left = records.filter(r => ['left', 'left_early', 'left_lately'].includes(r.status)).length;
      const total = records.length;
      const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
      return { present, absent, late, left, total, rate };
    }
    if (apiSummary && (apiSummary.totalPresent > 0 || apiSummary.totalAbsent > 0)) {
      const left = apiSummary.totalLeft + apiSummary.totalLeftEarly + apiSummary.totalLeftLately;
      const total = apiSummary.totalPresent + apiSummary.totalAbsent + apiSummary.totalLate + left;
      return {
        present: apiSummary.totalPresent,
        absent: apiSummary.totalAbsent,
        late: apiSummary.totalLate,
        left,
        total,
        rate: apiSummary.attendanceRate,
      };
    }
    return { present: 0, absent: 0, late: 0, left: 0, total: 0, rate: 0 };
  }, [records, apiSummary]);

  // Filter + search
  const filteredRecords = React.useMemo(() => {
    return records.filter(r => {
      if (filterStatus !== 'all' && r.status !== filterStatus) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = (r.studentName || r.userName || '').toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [records, filterStatus, searchQuery]);

  const selectedEvent = events.find(e => String(e.id) === selectedEventId);

  return (
    <div className="space-y-4">
      {/* Event Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Event Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs" />
            </div>
            <div>
              <Label className="text-xs">Event</Label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder={loadingEvents ? 'Loading...' : 'Select Event'} />
                </SelectTrigger>
                <SelectContent>
                  {events.map(e => (
                    <SelectItem key={e.id} value={String(e.id)} className="text-xs">
                      {e.title} — {e.eventDate || ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Event Details + Summary */}
      {selectedEvent && summary.total > 0 && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                {selectedEvent.title}
              </CardTitle>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{selectedEvent.eventDate || ''}</span>
                {selectedEvent.startTime && <span>{selectedEvent.startTime} — {selectedEvent.endTime || ''}</span>}
                {selectedEvent.eventType && <Badge variant="outline" className="text-xs">{selectedEvent.eventType}</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <div className="text-lg font-bold text-emerald-600">{summary.present}</div>
                  <div className="text-xs text-muted-foreground">Present</div>
                </div>
                <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-lg font-bold text-red-500">{summary.absent}</div>
                  <div className="text-xs text-muted-foreground">Absent</div>
                </div>
                <div className="text-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <div className="text-lg font-bold text-amber-600">{summary.late}</div>
                  <div className="text-xs text-muted-foreground">Late</div>
                </div>
                <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <div className="text-lg font-bold text-purple-600">{summary.left}</div>
                  <div className="text-xs text-muted-foreground">→ Left</div>
                </div>
                <div className="text-center p-2 bg-primary/10 rounded-lg">
                  <div className="text-lg font-bold text-primary">{summary.rate}%</div>
                  <div className="text-xs text-muted-foreground">Rate</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <Progress value={summary.rate} className="h-3" />
                <p className="text-xs text-muted-foreground text-center">
                  {summary.present}/{summary.total} attended ({summary.rate}%)
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Filter + Records */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm">Attendance Records</CardTitle>
                <div className="flex gap-2">
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="text-xs w-[100px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">All</SelectItem>
                      <SelectItem value="present" className="text-xs">Present</SelectItem>
                      <SelectItem value="absent" className="text-xs">Absent</SelectItem>
                      <SelectItem value="late" className="text-xs">Late</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Search name..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="text-xs w-[140px]"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">Student</TableHead>
                      <TableHead className="text-xs text-center">Status</TableHead>
                      <TableHead className="text-xs">Time</TableHead>
                      <TableHead className="text-xs">Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{i + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7 shrink-0">
                              {/* ✅ NEW: Try to get image from studentImagesMap first */}
                              {(() => {
                                const mappedImage = studentImagesMap.get(r.studentId);
                                const imageUrl = mappedImage || r.studentImageUrl || r.imageUrl || '';
                                return <AvatarImage src={getImageUrl(imageUrl)} />;
                              })()}
                              <AvatarFallback className="text-[10px]">
                                {((r.studentName || r.userName || '?').charAt(0)).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium">{r.studentName || r.userName || r.studentId}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          {renderAttendanceStatusBadge(r.status)}
                        </TableCell>
                        <TableCell className="text-xs">{r.markedAt ? toSriLankaTime(r.markedAt) : '—'}</TableCell>
                        <TableCell className="text-xs">{r.markingMethod || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {filteredRecords.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No records found</p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {selectedEventId && !loading && records.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">No attendance records found for this event</p>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}
    </div>
  );
};

export default EventAttendanceView;
