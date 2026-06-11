import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import adminAttendanceApi, { AdminAttendanceRecord } from '@/api/adminAttendance.api';
import calendarApi from '@/api/calendar.api';
import type { CalendarEvent } from '@/types/calendar.types';
import { instituteClassesApi } from '@/api/instituteClasses.api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, Calendar, Search, ChevronLeft, Users, UserCheck, UserX, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getImageUrl } from '@/utils/imageUrlHelper';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ClassInfo {
  id: string;
  name: string;
  grade?: number;
  classTeacherId?: string;
  classTeacherName?: string;
  classTeacherImage?: string;
}

interface ClassDrillRow {
  classId: string;
  className: string;
  grade?: number;
  present: number;
  absent: number;
  late: number;
  notMarked: number;
  totalSeen: number;   // unique students seen across all fetched events for this class
  rate: number;
  classTeacherId?: string;
  classTeacherName?: string;
  classTeacherImage?: string;
}

interface StudentDrillRow {
  studentId: string;
  studentName: string;
  imageUrl?: string;
  statusByEvent: Map<string, string>; // eventId → status
  present: number;
  absent: number;
  late: number;
  notMarked: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  catch { return d; }
};

const rateColor = (rate: number) =>
  rate >= 85 ? 'text-emerald-600' : rate >= 70 ? 'text-amber-600' : 'text-red-500';

const rateBadge = (rate: number): 'default' | 'secondary' | 'destructive' =>
  rate >= 85 ? 'default' : rate >= 70 ? 'secondary' : 'destructive';

// ─── Component ───────────────────────────────────────────────────────────────

const ClassSubjectDrillDown: React.FC = () => {
  const { currentInstituteId } = useAuth();

  // Date range for event discovery
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Events
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());

  // Classes
  const [classes, setClasses] = useState<ClassInfo[]>([]);

  // Fetched records keyed by eventId
  const [eventRecords, setEventRecords] = useState<Map<string, AdminAttendanceRecord[]>>(new Map());
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Drill-down state
  const [drillClassId, setDrillClassId] = useState<string | null>(null);

  // ── Load events ────────────────────────────────────────────────────────────

  const loadEvents = useCallback(async () => {
    if (!currentInstituteId) return;
    setLoadingEvents(true);
    setSelectedEventIds(new Set());
    setEventRecords(new Map());
    setDrillClassId(null);
    try {
      const [evtRes, rawClasses] = await Promise.all([
        calendarApi.getEvents(currentInstituteId, { startDate, endDate, limit: 200 }),
        instituteClassesApi.getByInstitute(currentInstituteId, {}, false),
      ]);
      const evts: CalendarEvent[] = (evtRes?.data || []).filter((e: CalendarEvent) => e.isAttendanceTracked);
      setEvents(evts.sort((a, b) => b.eventDate.localeCompare(a.eventDate)));
      setClasses((rawClasses || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        grade: c.grade,
        classTeacherId: c.classTeacherId,
        classTeacherName: c.classTeacher
          ? `${c.classTeacher.firstName || ''} ${c.classTeacher.lastName || ''}`.trim()
          : undefined,
        classTeacherImage: c.classTeacher?.imageUrl,
      })));
    } catch {
      toast.error('Failed to load events');
    } finally {
      setLoadingEvents(false);
    }
  }, [currentInstituteId, startDate, endDate]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // ── Event selection ────────────────────────────────────────────────────────

  const toggleEvent = (id: string) =>
    setSelectedEventIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectAll = () => setSelectedEventIds(new Set(events.map(e => e.id)));
  const clearAll = () => { setSelectedEventIds(new Set()); setEventRecords(new Map()); setDrillClassId(null); };

  // ── Fetch attendance ───────────────────────────────────────────────────────

  const fetchAttendance = useCallback(async () => {
    if (!currentInstituteId || selectedEventIds.size === 0) {
      toast.info('Select at least one event first');
      return;
    }
    setLoadingAttendance(true);
    setDrillClassId(null);
    try {
      const toFetch = Array.from(selectedEventIds).filter(id => !eventRecords.has(id));
      if (toFetch.length === 0) { setLoadingAttendance(false); return; }

      const results = await Promise.allSettled(
        toFetch.map(eventId =>
          adminAttendanceApi.getEventAttendance(currentInstituteId, eventId, { limit: 1000 })
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
    } catch (e: any) {
      toast.error(e.message || 'Failed to fetch attendance');
    } finally {
      setLoadingAttendance(false);
    }
  }, [currentInstituteId, selectedEventIds, eventRecords]);

  // ── Class-level drill table ────────────────────────────────────────────────

  const classDrillRows = useMemo((): ClassDrillRow[] => {
    const selectedIds = Array.from(selectedEventIds).filter(id => eventRecords.has(id));
    if (selectedIds.length === 0) return [];

    // Per-class, per-student aggregation across selected events
    // key: classId → studentId → { present, absent, late, eventsSeen: Set<eventId> }
    const classMap = new Map<string, Map<string, { present: number; absent: number; late: number; eventsSeen: Set<string> }>>();

    for (const eventId of selectedIds) {
      const records = eventRecords.get(eventId) || [];
      for (const r of records) {
        const classId = r.classId || '';
        if (!classId) continue;
        const studentId = r.studentId || r.userId || '';
        if (!studentId) continue;

        if (!classMap.has(classId)) classMap.set(classId, new Map());
        const stuMap = classMap.get(classId)!;
        if (!stuMap.has(studentId)) stuMap.set(studentId, { present: 0, absent: 0, late: 0, eventsSeen: new Set() });
        const s = stuMap.get(studentId)!;
        s.eventsSeen.add(eventId);
        if (r.status === 'present') s.present++;
        else if (r.status === 'absent') s.absent++;
        else if (r.status === 'late') s.late++;
      }
    }

    const numEvents = selectedIds.length;
    const rows: ClassDrillRow[] = [];

    classMap.forEach((stuMap, classId) => {
      const classInfo = classes.find(c => c.id === classId);
      let present = 0, absent = 0, late = 0, notMarked = 0;

      stuMap.forEach(s => {
        // Across N events, a student can appear in some and not others
        present += s.present;
        absent += s.absent;
        late += s.late;
        // Not marked = events where student didn't appear at all
        notMarked += numEvents - s.eventsSeen.size;
      });

      const totalSeen = stuMap.size;
      const totalMarked = present + absent + late;
      const rate = totalMarked > 0 ? Math.round(((present + late) / totalMarked) * 1000) / 10 : 0;

      rows.push({
        classId,
        className: classInfo?.name || classId,
        grade: classInfo?.grade,
        present,
        absent,
        late,
        notMarked,
        totalSeen,
        rate,
        classTeacherId: classInfo?.classTeacherId,
        classTeacherName: classInfo?.classTeacherName,
        classTeacherImage: classInfo?.classTeacherImage,
      });
    });

    return rows.sort((a, b) => b.totalSeen - a.totalSeen);
  }, [selectedEventIds, eventRecords, classes]);

  // ── Student-level drill ────────────────────────────────────────────────────

  const studentDrillRows = useMemo((): StudentDrillRow[] => {
    if (!drillClassId) return [];
    const selectedIds = Array.from(selectedEventIds).filter(id => eventRecords.has(id));

    const stuMap = new Map<string, StudentDrillRow>();

    for (const eventId of selectedIds) {
      const records = (eventRecords.get(eventId) || []).filter(r => r.classId === drillClassId);
      for (const r of records) {
        const studentId = r.studentId || r.userId || '';
        if (!studentId) continue;
        if (!stuMap.has(studentId)) {
          stuMap.set(studentId, {
            studentId,
            studentName: r.studentName || r.userName || studentId,
            imageUrl: r.studentImageUrl || r.imageUrl,
            statusByEvent: new Map(),
            present: 0, absent: 0, late: 0, notMarked: 0,
          });
        }
        const s = stuMap.get(studentId)!;
        s.statusByEvent.set(eventId, r.status);
        if (r.status === 'present') s.present++;
        else if (r.status === 'absent') s.absent++;
        else if (r.status === 'late') s.late++;
      }
    }

    // Fill notMarked
    stuMap.forEach(s => {
      s.notMarked = selectedIds.length - s.statusByEvent.size;
    });

    return Array.from(stuMap.values()).sort((a, b) => b.present - a.present);
  }, [drillClassId, selectedEventIds, eventRecords]);

  const selectedEvents = useMemo(
    () => events.filter(e => selectedEventIds.has(e.id)).sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
    [events, selectedEventIds]
  );

  const hasFetched = selectedEventIds.size > 0 && Array.from(selectedEventIds).some(id => eventRecords.has(id));

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Date range + reload */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Institute Attendance — Class-wise
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
            {loadingEvents ? 'Loading…' : 'Reload Events'}
          </Button>
        </CardContent>
      </Card>

      {/* Event selector */}
      {events.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm">
                Select Events ({selectedEventIds.size}/{events.length})
              </CardTitle>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={selectAll}>All</Button>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={clearAll}>Clear</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {events.map(event => (
              <label
                key={event.id}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  checked={selectedEventIds.has(event.id)}
                  onCheckedChange={() => toggleEvent(event.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{event.title}</div>
                  <div className="text-[10px] text-muted-foreground">{fmtDate(event.eventDate)}</div>
                </div>
                {eventRecords.has(event.id) && (
                  <Badge variant="outline" className="text-[10px] flex-shrink-0">
                    {eventRecords.get(event.id)!.length}
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
                : <><Search className="h-3 w-3 mr-1" />Fetch Attendance for {selectedEventIds.size} Event{selectedEventIds.size !== 1 ? 's' : ''}</>}
            </Button>
          </div>
        </Card>
      )}

      {events.length === 0 && !loadingEvents && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No attendance-tracked events in this date range
          </CardContent>
        </Card>
      )}

      {/* ── Class-level table ── */}
      {hasFetched && !drillClassId && classDrillRows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Class Overview
                <span className="text-xs font-normal text-muted-foreground">
                  — {selectedEventIds.size} event{selectedEventIds.size !== 1 ? 's' : ''}
                </span>
              </CardTitle>
              <div className="flex gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><UserCheck className="h-3 w-3 text-emerald-500" /> Present</span>
                <span className="flex items-center gap-1"><UserX className="h-3 w-3 text-red-500" /> Absent</span>
                <span className="flex items-center gap-1"><HelpCircle className="h-3 w-3 text-slate-400" /> Not Marked</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs pl-4">Class</TableHead>
                    <TableHead className="text-xs text-center">Grade</TableHead>
                    <TableHead className="text-xs text-center text-emerald-600">Present</TableHead>
                    <TableHead className="text-xs text-center text-red-500">Absent</TableHead>
                    <TableHead className="text-xs text-center text-slate-400">Not Marked</TableHead>
                    <TableHead className="text-xs text-center">Rate</TableHead>
                    <TableHead className="text-xs">Class Teacher</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classDrillRows.map(row => (
                    <TableRow
                      key={row.classId}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setDrillClassId(row.classId)}
                    >
                      <TableCell className="text-xs font-medium pl-4">
                        <div className="flex items-center gap-1.5">
                          {row.className}
                          <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">{row.totalSeen}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center text-muted-foreground">
                        {row.grade ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs text-center font-medium text-emerald-600">
                        {row.present}
                      </TableCell>
                      <TableCell className="text-xs text-center font-medium text-red-500">
                        {row.absent}
                      </TableCell>
                      <TableCell className="text-xs text-center text-slate-400">
                        {row.notMarked > 0 ? row.notMarked : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`font-medium ${rateColor(row.rate)}`}>{row.rate}%</span>
                          <Progress value={row.rate} className="h-1 w-12" />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.classTeacherId ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={getImageUrl(row.classTeacherImage || '')} />
                              <AvatarFallback className="text-[8px]">
                                {(row.classTeacherName || '?').charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate max-w-[100px]">{row.classTeacherName || '—'}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[10px]">Not assigned</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="px-4 py-2 border-t">
              <p className="text-[10px] text-muted-foreground">Click a row to see per-student breakdown</p>
            </div>
          </CardContent>
        </Card>
      )}

      {hasFetched && !drillClassId && classDrillRows.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No attendance records found for the selected events
          </CardContent>
        </Card>
      )}

      {/* ── Student-level drill ── */}
      {drillClassId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setDrillClassId(null)}
                >
                  <ChevronLeft className="h-3 w-3 mr-1" />
                  Back
                </Button>
                <span>
                  {classes.find(c => c.id === drillClassId)?.name || drillClassId}
                </span>
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {studentDrillRows.length} student{studentDrillRows.length !== 1 ? 's' : ''}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs pl-4 sticky top-0 bg-background z-10">Student</TableHead>
                    <TableHead className="text-xs text-center sticky top-0 bg-background z-10 text-emerald-600">P</TableHead>
                    <TableHead className="text-xs text-center sticky top-0 bg-background z-10 text-red-500">A</TableHead>
                    <TableHead className="text-xs text-center sticky top-0 bg-background z-10 text-amber-500">L</TableHead>
                    <TableHead className="text-xs text-center sticky top-0 bg-background z-10 text-slate-400">NM</TableHead>
                    {selectedEvents.map(e => (
                      <TableHead key={e.id} className="text-[10px] text-center sticky top-0 bg-background z-10 min-w-[60px]">
                        <div className="truncate max-w-[60px]" title={e.title}>{fmtDate(e.eventDate)}</div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentDrillRows.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium pl-4">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={getImageUrl(s.imageUrl || '')} />
                            <AvatarFallback className="text-[8px]">
                              {(s.studentName || '?').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate max-w-[120px]">{s.studentName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-center font-medium text-emerald-600">{s.present || '—'}</TableCell>
                      <TableCell className="text-xs text-center font-medium text-red-500">{s.absent || '—'}</TableCell>
                      <TableCell className="text-xs text-center text-amber-500">{s.late || '—'}</TableCell>
                      <TableCell className="text-xs text-center text-slate-400">{s.notMarked || '—'}</TableCell>
                      {selectedEvents.map(e => {
                        const status = s.statusByEvent.get(e.id);
                        return (
                          <TableCell key={e.id} className="text-[10px] text-center">
                            {status === 'present' && <span className="text-emerald-600 font-bold">P</span>}
                            {status === 'absent' && <span className="text-red-500 font-bold">A</span>}
                            {status === 'late' && <span className="text-amber-500 font-bold">L</span>}
                            {!status && <span className="text-slate-300">—</span>}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClassSubjectDrillDown;
