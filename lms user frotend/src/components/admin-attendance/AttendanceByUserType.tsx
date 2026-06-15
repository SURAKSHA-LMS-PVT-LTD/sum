import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import adminAttendanceApi, { AdminAttendanceRecord } from '@/api/adminAttendance.api';
import calendarApi from '@/api/calendar.api';
import type { CalendarEvent } from '@/types/calendar.types';
import { normalizeAttendanceSummary } from '@/types/attendance.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RefreshCw, Calendar, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { renderAttendanceStatusBadge } from '@/components/calendar/calendarTheme';
import { getImageUrl } from '@/utils/imageUrlHelper';

interface EventWithRecords {
  event: CalendarEvent;
  records: AdminAttendanceRecord[];
  present: number;
  absent: number;
  late: number;
  total: number;
  rate: number;
}

const AttendanceByUserType: React.FC = () => {
  const { currentInstituteId } = useAuth();

  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [eventRecords, setEventRecords] = useState<Map<string, AdminAttendanceRecord[]>>(new Map());

  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Load events
  const loadEvents = useCallback(async () => {
    if (!currentInstituteId) return;
    setLoadingEvents(true);
    setSelectedEventIds(new Set());
    setEventRecords(new Map());
    try {
      const res = await calendarApi.getEvents(currentInstituteId, { startDate, endDate, limit: 200 });
      const evts: CalendarEvent[] = res?.data || [];
      // Only show attendance-tracked events
      setEvents(evts.filter(e => e.isAttendanceTracked));
    } catch {
      toast.error('Failed to load events');
    } finally {
      setLoadingEvents(false);
    }
  }, [currentInstituteId, startDate, endDate]);

  // Debounce so adjusting both date inputs in quick succession fires one load, not two.
  useEffect(() => {
    const t = setTimeout(() => { loadEvents(); }, 400);
    return () => clearTimeout(t);
  }, [loadEvents]);

  const toggleEvent = (id: string) => {
    setSelectedEventIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedEventIds(new Set(events.map(e => e.id)));
  const clearAll = () => setSelectedEventIds(new Set());

  // Fetch attendance for all selected events (parallel, cached)
  const fetchAttendance = useCallback(async () => {
    if (!currentInstituteId || selectedEventIds.size === 0) {
      toast.info('Select at least one event first');
      return;
    }
    setLoadingAttendance(true);
    try {
      const toFetch = Array.from(selectedEventIds).filter(id => !eventRecords.has(id));
      if (toFetch.length > 0) {
        const results = await Promise.allSettled(
          toFetch.map(eventId =>
            adminAttendanceApi.getEventAttendance(currentInstituteId, eventId, { limit: 500 })
          )
        );
        const next = new Map(eventRecords);
        toFetch.forEach((eventId, i) => {
          const r = results[i];
          if (r.status === 'fulfilled') {
            const raw = r.value?.data;
            const records = Array.isArray(raw) ? raw
              : (raw && typeof raw === 'object' && 'records' in raw) ? (raw as any).records || []
              : [];
            next.set(eventId, records);
          } else {
            next.set(eventId, []);
          }
        });
        setEventRecords(next);
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to load attendance');
    } finally {
      setLoadingAttendance(false);
    }
  }, [currentInstituteId, selectedEventIds, eventRecords]);

  // Build merged view across selected events
  const mergedData = useMemo((): EventWithRecords[] => {
    return Array.from(selectedEventIds)
      .map(eventId => {
        const event = events.find(e => e.id === eventId);
        if (!event) return null;
        const records = eventRecords.get(eventId) || [];
        const present = records.filter(r => r.status === 'present').length;
        const absent = records.filter(r => r.status === 'absent').length;
        const late = records.filter(r => r.status === 'late').length;
        const total = records.length;
        const rate = total > 0 ? Math.round(((present + late) / total) * 1000) / 10 : 0;
        return { event, records, present, absent, late, total, rate };
      })
      .filter((x): x is EventWithRecords => x !== null && eventRecords.has(x.event.id))
      .sort((a, b) => b.event.eventDate.localeCompare(a.event.eventDate));
  }, [selectedEventIds, events, eventRecords]);

  // Combined student list across selected events (for record view)
  const allRecords = useMemo(() => {
    const seen = new Set<string>();
    const result: (AdminAttendanceRecord & { _eventTitle: string })[] = [];
    for (const { event, records } of mergedData) {
      for (const r of records) {
        const key = `${event.id}:${r.studentId || r.userId}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ ...r, _eventTitle: event.title });
        }
      }
    }
    return result;
  }, [mergedData]);

  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return allRecords;
    const q = searchQuery.toLowerCase();
    return allRecords.filter(r =>
      (r.studentName || r.userName || '').toLowerCase().includes(q) ||
      (r.studentId || r.userId || '').toLowerCase().includes(q)
    );
  }, [allRecords, searchQuery]);

  // Overall summary across selected events
  const overallSummary = useMemo(() => {
    return mergedData.reduce(
      (acc, { present, absent, late, total }) => ({
        present: acc.present + present,
        absent: acc.absent + absent,
        late: acc.late + late,
        total: acc.total + total,
      }),
      { present: 0, absent: 0, late: 0, total: 0 }
    );
  }, [mergedData]);

  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <div className="space-y-4">
      {/* Date Range + Fetch */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Institute Attendance Events
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs" />
            </div>
          </div>
          <Button size="sm" onClick={loadEvents} disabled={loadingEvents} variant="outline" className="w-full">
            <RefreshCw className={`h-3 w-3 mr-1 ${loadingEvents ? 'animate-spin' : ''}`} />
            {loadingEvents ? 'Loading Events…' : 'Reload Events'}
          </Button>
        </CardContent>
      </Card>

      {/* Event Selection */}
      {events.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm">
                Select Events ({selectedEventIds.size}/{events.length})
              </CardTitle>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={selectAll}>All</Button>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={clearAll}>None</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {events.map(event => (
              <label
                key={event.id}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  checked={selectedEventIds.has(event.id)}
                  onCheckedChange={() => toggleEvent(event.id)}
                  className="flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{event.title}</div>
                  <div className="text-[10px] text-muted-foreground">{fmtDate(event.eventDate)}</div>
                </div>
                {eventRecords.has(event.id) && (
                  <Badge variant="outline" className="text-[10px] flex-shrink-0">
                    {eventRecords.get(event.id)!.length} records
                  </Badge>
                )}
              </label>
            ))}
          </CardContent>
          <div className="px-4 pb-4">
            <Button
              size="sm"
              onClick={fetchAttendance}
              disabled={loadingAttendance || selectedEventIds.size === 0}
              className="w-full"
            >
              {loadingAttendance
                ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Fetching…</>
                : <><Search className="h-3 w-3 mr-1" />Fetch Attendance ({selectedEventIds.size} events)</>}
            </Button>
          </div>
        </Card>
      )}

      {events.length === 0 && !loadingEvents && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No attendance-tracked events found in this date range
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {mergedData.length > 0 && (
        <>
          {/* Overall summary */}
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center p-2 bg-muted rounded-lg">
              <div className="text-lg font-bold">{overallSummary.total}</div>
              <div className="text-xs text-muted-foreground">Total Records</div>
            </div>
            <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <div className="text-lg font-bold text-emerald-600">{overallSummary.present}</div>
              <div className="text-xs text-muted-foreground">Present</div>
            </div>
            <div className="text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-lg font-bold text-red-500">{overallSummary.absent}</div>
              <div className="text-xs text-muted-foreground">Absent</div>
            </div>
            <div className="text-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <div className="text-lg font-bold text-amber-600">
                {overallSummary.total > 0
                  ? Math.round(((overallSummary.present + overallSummary.late) / overallSummary.total) * 1000) / 10
                  : 0}%
              </div>
              <div className="text-xs text-muted-foreground">Rate</div>
            </div>
          </div>

          {/* Per-event summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Per-Event Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {mergedData.map(({ event, records, present, absent, late, total, rate }) => (
                <div key={event.id} className="border rounded-md overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/50 text-left"
                    onClick={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{event.title}</div>
                      <div className="text-[10px] text-muted-foreground">{fmtDate(event.eventDate)}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex gap-1.5 text-[10px]">
                        <span className="text-emerald-600 font-medium">{present}P</span>
                        <span className="text-red-500 font-medium">{absent}A</span>
                        {late > 0 && <span className="text-amber-500 font-medium">{late}L</span>}
                      </div>
                      <Badge
                        variant={rate >= 85 ? 'default' : rate >= 75 ? 'secondary' : 'destructive'}
                        className="text-[10px]"
                      >
                        {rate}%
                      </Badge>
                      {expandedEventId === event.id
                        ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
                        : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </button>

                  {expandedEventId === event.id && records.length > 0 && (
                    <div className="border-t overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Student</TableHead>
                            <TableHead className="text-xs text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {records.map((r, i) => (
                            <TableRow key={i}>
                              <TableCell className="text-xs">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={getImageUrl(r.studentImageUrl || r.imageUrl || '')} />
                                    <AvatarFallback className="text-[9px]">
                                      {(r.studentName || r.userName || '?').charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{r.studentName || r.userName || r.studentId || r.userId}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs text-center">
                                {renderAttendanceStatusBadge(r.status)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* All records (searchable) */}
          {allRecords.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">All Records ({allRecords.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or ID…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 text-xs"
                  />
                </div>
                <div className="rounded-md border overflow-x-auto max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sticky top-0 bg-background">Name</TableHead>
                        <TableHead className="text-xs sticky top-0 bg-background text-center">Status</TableHead>
                        <TableHead className="text-xs sticky top-0 bg-background">Event</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-medium">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={getImageUrl(r.studentImageUrl || r.imageUrl || '')} />
                                <AvatarFallback className="text-[9px]">
                                  {(r.studentName || r.userName || '?').charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate max-w-[140px]">{r.studentName || r.userName || r.studentId || r.userId}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-center">{renderAttendanceStatusBadge(r.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">{r._eventTitle}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default AttendanceByUserType;
