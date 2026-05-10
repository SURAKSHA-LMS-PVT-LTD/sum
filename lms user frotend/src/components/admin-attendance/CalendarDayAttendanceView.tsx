import React, { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import adminAttendanceApi, { AdminAttendanceRecord } from '@/api/adminAttendance.api';
import { normalizeAttendanceSummary, AttendanceSummary } from '@/types/attendance.types';
import calendarApi from '@/api/calendar.api';
import type { CalendarDay, CalendarEvent } from '@/types/calendar.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RefreshCw, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { getDayTypeMeta, renderAttendanceStatusBadge } from '@/components/calendar/calendarTheme';
import { getImageUrl } from '@/utils/imageUrlHelper';

function toSriLankaTime(utcStr: string): string {
  try {
    return new Date(utcStr).toLocaleString('en-LK', {
      timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return utcStr; }
}

interface EventGroup {
  eventId: string;
  eventTitle: string;
  records: AdminAttendanceRecord[];
  present: number;
  absent: number;
  late: number;
  total: number;
  rate: number;
}

const CalendarDayAttendanceView: React.FC = () => {
  const { currentInstituteId } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [calendarDay, setCalendarDay] = useState<CalendarDay | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [records, setRecords] = useState<AdminAttendanceRecord[]>([]);
  const [apiSummary, setApiSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const loadDayData = useCallback(async () => {
    if (!currentInstituteId) return;
    setLoading(true);
    try {
      // Get calendar day info
      const calRes = await calendarApi.getDays(currentInstituteId, {
        startDate: selectedDate, endDate: selectedDate, limit: 1
      });
      const calDays = calRes?.data || [];
      const day = calDays.length > 0 ? calDays[0] : null;
      setCalendarDay(day);

      // Get events for the day
      if (day?.id) {
        const eventsRes = await calendarApi.getDayEvents(currentInstituteId, String(day.id));
        setEvents(eventsRes?.data || []);

        // Get calendar day attendance
        const attRes = await adminAttendanceApi.getCalendarDayAttendance(
          currentInstituteId, String(day.id), { limit: 100 }
        );
        const data = attRes?.data;
        if (Array.isArray(data) && data.length > 0) {
          setRecords(data);
        } else if (data && typeof data === 'object' && 'records' in data) {
          setRecords((data as any).records || []);
        } else {
          setRecords([]);
        }
        // Always capture summary
        setApiSummary(normalizeAttendanceSummary(attRes?.summary));
      } else {
        setEvents([]);
        // Fallback: use institute attendance for the date
        const attRes = await adminAttendanceApi.getInstituteAttendance(
          currentInstituteId,
          { startDate: selectedDate, endDate: selectedDate, limit: 100 }
        );
        setRecords(attRes?.data || []);
        setApiSummary(normalizeAttendanceSummary(attRes?.summary));
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to load day attendance');
    } finally {
      setLoading(false);
    }
  }, [currentInstituteId, selectedDate]);

  // Group records by event
  const eventGroups = React.useMemo((): EventGroup[] => {
    const grouped = new Map<string, AdminAttendanceRecord[]>();
    for (const r of records) {
      const key = r.eventId || 'no_event';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    }

    return Array.from(grouped.entries()).map(([eventId, recs]) => {
      const present = recs.filter(r => r.status === 'present').length;
      const absent = recs.filter(r => r.status === 'absent').length;
      const late = recs.filter(r => r.status === 'late').length;
      const total = recs.length;
      const eventInfo = events.find(e => String(e.id) === eventId);
      const firstRec = recs[0];
      return {
        eventId,
        eventTitle: eventInfo?.title || firstRec?.eventTitle || (eventId === 'no_event' ? 'General Attendance' : `Event ${eventId}`),
        records: recs,
        present, absent, late, total,
        rate: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
      };
    });
  }, [records, events]);

  // Day totals - use records if available, fall back to summary
  const dayTotals = React.useMemo(() => {
    if (records.length > 0) {
      const present = records.filter(r => r.status === 'present').length;
      const absent = records.filter(r => r.status === 'absent').length;
      const late = records.filter(r => r.status === 'late').length;
      const total = records.length;
      return { present, absent, late, total, rate: total > 0 ? Math.round((present / total) * 1000) / 10 : 0 };
    }
    if (apiSummary && (apiSummary.totalPresent > 0 || apiSummary.totalAbsent > 0)) {
      const left = apiSummary.totalLeft + apiSummary.totalLeftEarly + apiSummary.totalLeftLately;
      const total = apiSummary.totalPresent + apiSummary.totalAbsent + apiSummary.totalLate + left;
      return { present: apiSummary.totalPresent, absent: apiSummary.totalAbsent, late: apiSummary.totalLate, total, rate: apiSummary.attendanceRate };
    }
    return { present: 0, absent: 0, late: 0, total: 0, rate: 0 };
  }, [records, apiSummary]);

  const toggleEvent = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });

  return (
    <div className="space-y-4">
      {/* Date Picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Day Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div>
              <Label className="text-xs">Select Date</Label>
              <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="text-xs" />
            </div>
            <Button size="sm" onClick={loadDayData} disabled={loading}>
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Load
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}

      {!loading && dayTotals.total > 0 && (
        <>
          {/* Day Header */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{dateLabel}</CardTitle>
              {calendarDay && (
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${getDayTypeMeta(calendarDay.dayType).dot}`} />
                    {getDayTypeMeta(calendarDay.dayType).label}
                  </span>
                  {calendarDay.startTime && <span>{calendarDay.startTime} — {calendarDay.endTime || ''}</span>}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded">
                  <div className="text-lg font-bold text-emerald-600">{dayTotals.present}</div>
                  <div className="text-xs text-muted-foreground">Present</div>
                </div>
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded">
                  <div className="text-lg font-bold text-red-500">{dayTotals.absent}</div>
                  <div className="text-xs text-muted-foreground">Absent</div>
                </div>
                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded">
                  <div className="text-lg font-bold text-amber-600">{dayTotals.late}</div>
                  <div className="text-xs text-muted-foreground">Late</div>
                </div>
                <div className="p-2 bg-primary/10 rounded">
                  <div className="text-lg font-bold text-primary">{dayTotals.rate}%</div>
                  <div className="text-xs text-muted-foreground">Rate</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Event Groups */}
          {eventGroups.map(group => (
            <Card key={group.eventId}>
              <Collapsible open={expandedEvents.has(group.eventId)} onOpenChange={() => toggleEvent(group.eventId)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm">{group.eventTitle}</CardTitle>
                        <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="text-emerald-600">Present: {group.present}</span>
                          <span className="text-red-500">Absent: {group.absent}</span>
                          <span className="text-amber-600">Late: {group.late}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={group.rate >= 85 ? 'default' : group.rate >= 75 ? 'secondary' : 'destructive'} className="text-xs">
                          {group.rate}%
                        </Badge>
                        {expandedEvents.has(group.eventId) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                    <Progress value={group.rate} className="h-2 mt-2" />
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">#</TableHead>
                            <TableHead className="text-xs">Student</TableHead>
                            <TableHead className="text-xs text-center">Status</TableHead>
                            <TableHead className="text-xs">Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.records.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs">{i + 1}</TableCell>
                              <TableCell className="text-xs font-medium">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-7 w-7">
                                    <AvatarImage src={getImageUrl(r.studentImageUrl || r.imageUrl || '')} alt={r.studentName || r.userName || r.studentId} />
                                    <AvatarFallback className="text-[10px]">
                                      {(r.studentName || r.userName || r.studentId || '?').charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{r.studentName || r.userName || r.studentId}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-center">{renderAttendanceStatusBadge(r.status)}</TableCell>
                              <TableCell className="text-xs">{r.markedAt ? toSriLankaTime(r.markedAt) : '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </>
      )}

      {!loading && dayTotals.total === 0 && calendarDay && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">No attendance records for this day</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CalendarDayAttendanceView;
