/**
 * AttendanceRangeViewer
 *
 * Split-panel attendance viewer for class / subject level.
 *   LEFT  – Date range selector → calendar days with their events
 *   RIGHT – All students in the class with their attendance status
 *           (Present / Absent / Late / Left / Not Marked)
 *
 * Supports Excel export of the current view.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import adminAttendanceApi from '@/api/adminAttendance.api';
import { getAuthHeadersSync } from '@/services/tokenStorageService';
import calendarApi from '@/api/calendar.api';
import { cachedApiClient } from '@/api/cachedClient';
import { normalizeAttendanceSummary } from '@/types/attendance.types';
import type { AttendanceRecord, AttendanceSummary } from '@/types/attendance.types';
import type { CalendarEvent } from '@/types/calendar.types';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  Download,
  Search,
  Users,
  BookOpen,
  GraduationCap,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClassOption {
  id: string;
  name: string;
}

interface SubjectOption {
  id: string;
  name: string;
}

interface StudentInfo {
  id: string;
  name: string;
  imageUrl?: string;
  userIdByInstitute?: string;
  instituteUserId?: string;
}

interface DayEntry {
  date: string; // 'YYYY-MM-DD'
  label: string; // friendly "Mon 9 Apr"
  events: CalendarEvent[];
}

interface MergedRow {
  studentId: string;
  studentName: string;
  imageUrl?: string;
  instituteUserId?: string;
  status: string; // 'present' | 'absent' | 'late' | 'left' | 'left_early' | 'left_lately' | 'not_marked'
  eventTitle?: string;
  markedAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  present:     { label: 'Present',     className: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400' },
  absent:      { label: 'Absent',      className: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-950/40 dark:text-red-400' },
  late:        { label: 'Late',        className: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-400' },
  left:        { label: 'Left',        className: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/40 dark:text-purple-400' },
  left_early:  { label: 'Left Early',  className: 'bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-950/40 dark:text-pink-400' },
  left_lately: { label: 'Left Lately', className: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-400' },
  not_marked:  { label: 'Not Marked',  className: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800/60 dark:text-gray-500' },
};

function statusConfig(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.not_marked;
}

function friendlyDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-LK', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
  } catch {
    return dateStr;
  }
}

function friendlyTime(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-LK', {
      hour: '2-digit', minute: '2-digit', hour12: true,
      timeZone: 'Asia/Colombo',
    });
  } catch {
    return '';
  }
}

function getInitials(name: string): string {
  return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  CLASS:     'bg-blue-100 text-blue-700',
  EXAM:      'bg-red-100 text-red-700',
  HOLIDAY:   'bg-gray-100 text-gray-600',
  MEETING:   'bg-purple-100 text-purple-700',
  EVENT:     'bg-orange-100 text-orange-700',
  OTHER:     'bg-teal-100 text-teal-700',
};

function eventTypeColor(type: string) {
  return EVENT_TYPE_COLORS[type?.toUpperCase()] ?? 'bg-slate-100 text-slate-600';
}

// ─── Date-range expansion ─────────────────────────────────────────────────────

function expandDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + 'T00:00:00');
  const fin = new Date(end + 'T00:00:00');
  while (cur <= fin) {
    dates.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ALL_SUBJECTS = '__all__';

const AttendanceRangeViewer: React.FC = () => {
  const { currentInstituteId, selectedInstitute } = useAuth();

  // Controls
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(ALL_SUBJECTS);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Calendar state
  const [dayEntries, setDayEntries] = useState<DayEntry[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Student + attendance state
  const [allStudents, setAllStudents] = useState<StudentInfo[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);

  // UI
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // ── Load classes ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentInstituteId) return;
    cachedApiClient
      .get(`/institutes/${currentInstituteId}/classes`, undefined, { ttl: 60 })
      .then((res: any) => setClasses(res?.data || res || []))
      .catch(() => {});
  }, [currentInstituteId]);

  // ── Load subjects when class changes ─────────────────────────────────────

  useEffect(() => {
    if (!currentInstituteId || !selectedClass) {
      setSubjects([]);
      setSelectedSubject(ALL_SUBJECTS);
      return;
    }
    cachedApiClient
      .get(`/institutes/${currentInstituteId}/classes/${selectedClass}/subjects`, undefined, { ttl: 60 })
      .then((res: any) => {
        const raw: any[] = res?.data || res || [];
        setSubjects(raw.map((s: any) => ({
          id: s.subjectId ?? s.subject?.id ?? s.id,
          name: s.subject?.name ?? s.name ?? s.subjectName ?? s.subjectId ?? s.id,
        })));
      })
      .catch(() => {});
  }, [currentInstituteId, selectedClass]);

  // ── Load all students in class ────────────────────────────────────────────

  useEffect(() => {
    if (!currentInstituteId || !selectedClass) {
      setAllStudents([]);
      return;
    }
    setLoadingStudents(true);
    const base = import.meta.env.VITE_LMS_BASE_URL || 'https://lmsapi.suraksha.lk';
    fetch(`${base}/institutes/${currentInstituteId}/classes/${selectedClass}/students`, {
      headers: getAuthHeadersSync(),
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: any) => {
        const list: any[] = data?.data || data || [];
        setAllStudents(
          list.map((s: any) => ({
            id: String(s.id || s.userId || s.studentId || ''),
            name: s.name || s.studentName || s.userName || '',
            imageUrl: s.imageUrl || s.studentImageUrl || s.profileImageUrl || '',
            userIdByInstitute: s.userIdByInstitute || s.instituteUserId || s.userCode || '',
          }))
        );
      })
      .catch(() => setAllStudents([]))
      .finally(() => setLoadingStudents(false));
  }, [currentInstituteId, selectedClass]);

  // ── Load calendar events for date range ───────────────────────────────────

  const loadCalendar = useCallback(async () => {
    if (!currentInstituteId || !selectedClass) {
      toast.error('Select a class first');
      return;
    }
    setLoadingCalendar(true);
    setSelectedDate(null);
    setSelectedEventId(null);
    setAttendanceRecords([]);
    setSummary(null);
    try {
      const params = { startDate, endDate, limit: 200 };

      // Fetch institute-level events and class-level events in parallel
      const [instRes, classRes] = await Promise.allSettled([
        calendarApi.getEvents(currentInstituteId, params),
        calendarApi.getClassEvents(currentInstituteId, selectedClass, params),
      ]);

      const instEvents: CalendarEvent[] =
        (instRes.status === 'fulfilled' ? instRes.value?.data : null) || [];
      const classEvents: CalendarEvent[] =
        (classRes.status === 'fulfilled' ? classRes.value?.data : null) || [];

      // Merge deduped by event id
      const seen = new Set<string>();
      const allEvents: CalendarEvent[] = [];
      for (const ev of [...instEvents, ...classEvents]) {
        if (!seen.has(String(ev.id))) {
          seen.add(String(ev.id));
          allEvents.push(ev);
        }
      }

      // Group by date
      const dateMap = new Map<string, CalendarEvent[]>();
      for (const ev of allEvents) {
        const d = ev.eventDate?.split('T')[0] ?? ev.calendarDate?.split('T')[0] ?? '';
        if (!d) continue;
        if (!dateMap.has(d)) dateMap.set(d, []);
        dateMap.get(d)!.push(ev);
      }

      // Build entries for every date in the range (even if no events)
      const entries: DayEntry[] = expandDateRange(startDate, endDate).map(date => ({
        date,
        label: friendlyDate(date),
        events: dateMap.get(date) ?? [],
      }));

      setDayEntries(entries);
    } catch {
      toast.error('Failed to load calendar events');
    } finally {
      setLoadingCalendar(false);
    }
  }, [currentInstituteId, selectedClass, startDate, endDate]);

  // ── Load attendance for selected date ─────────────────────────────────────

  const loadAttendance = useCallback(async (date: string) => {
    if (!currentInstituteId || !selectedClass) return;
    setLoadingAttendance(true);
    try {
      const subjectId = selectedSubject !== ALL_SUBJECTS ? selectedSubject : undefined;
      // NOTE: eventId is NOT passed here — class/subject attendance records never store
      // an eventId (backend strips it at mark time). The event is informational context only.
      // Attendance is queried by date; the left panel event badge just shows what was scheduled.
      const base = { startDate: date, endDate: date, limit: 500, page: 1 };

      let res;
      if (subjectId) {
        res = await adminAttendanceApi.getSubjectAttendance(
          currentInstituteId, selectedClass, subjectId, base
        );
      } else {
        res = await adminAttendanceApi.getClassAttendance(
          currentInstituteId, selectedClass, base
        );
      }
      setAttendanceRecords(res?.data || []);
      setSummary(normalizeAttendanceSummary(res?.summary));
    } catch (e: any) {
      toast.error(e.message || 'Failed to load attendance');
      setAttendanceRecords([]);
    } finally {
      setLoadingAttendance(false);
    }
  }, [currentInstituteId, selectedClass, selectedSubject]);

  const handleSelectDate = useCallback((date: string, eventId: string | null) => {
    setSelectedDate(date);
    setSelectedEventId(eventId);
    loadAttendance(date);
  }, [loadAttendance]);

  // ── Merged rows: students + their attendance status ────────────────────────

  const mergedRows = useMemo<MergedRow[]>(() => {
    const recordMap = new Map<string, AttendanceRecord>();
    for (const r of attendanceRecords) {
      const key = String(r.studentId || r.userId || '');
      if (key) recordMap.set(key, r);
    }
    return allStudents.map(s => {
      const rec = recordMap.get(s.id);
      return {
        studentId: s.id,
        studentName: s.name,
        imageUrl: s.imageUrl || rec?.studentImageUrl || rec?.imageUrl,
        instituteUserId: s.userIdByInstitute,
        status: rec ? rec.status : 'not_marked',
        eventTitle: rec?.eventTitle,
        markedAt: rec?.markedAt,
      };
    });
  }, [allStudents, attendanceRecords]);

  // ── Filter + search ────────────────────────────────────────────────────────

  const filteredRows = useMemo(() => {
    return mergedRows.filter(row => {
      if (filterStatus !== 'all' && row.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !(row.studentName || '').toLowerCase().includes(q) &&
          !(row.instituteUserId || '').toLowerCase().includes(q) &&
          !(row.studentId || '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [mergedRows, filterStatus, search]);

  // ── Summary counts ─────────────────────────────────────────────────────────

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of mergedRows) {
      m[r.status] = (m[r.status] ?? 0) + 1;
    }
    return m;
  }, [mergedRows]);

  // ─── Export to Excel ──────────────────────────────────────────────────────

  const exportExcel = useCallback(() => {
    if (!selectedDate || mergedRows.length === 0) {
      toast.error('Select a date with students to export');
      return;
    }

    const institute = selectedInstitute?.name || currentInstituteId || '';
    const className = classes.find(c => c.id === selectedClass)?.name || selectedClass;
    const subjectName =
      selectedSubject !== ALL_SUBJECTS
        ? subjects.find(s => s.id === selectedSubject)?.name || selectedSubject
        : '';

    const sheetData = [
      [`Institute: ${institute}`, '', `Class: ${className}`, subjectName ? `Subject: ${subjectName}` : '', `Date: ${selectedDate}`],
      [''],
      ['#', 'Student Name', 'System ID', 'Institute User ID', 'Attendance Status', 'Event', 'Marked At'],
      ...mergedRows.map((row, i) => [
        i + 1,
        row.studentName,
        row.studentId,
        row.instituteUserId || '',
        statusConfig(row.status).label,
        row.eventTitle || '',
        row.markedAt ? friendlyTime(row.markedAt) : '',
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Column widths
    ws['!cols'] = [
      { wch: 4 }, { wch: 26 }, { wch: 16 }, { wch: 18 },
      { wch: 14 }, { wch: 22 }, { wch: 12 },
    ];

    const wb = XLSX.utils.book_new();
    const sheetName = subjectName
      ? `${className}-${subjectName}`.slice(0, 31)
      : className.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const fileName = `attendance_${className}${subjectName ? '_' + subjectName : ''}_${selectedDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success('Excel file downloaded');
  }, [selectedDate, mergedRows, selectedInstitute, currentInstituteId, selectedClass, selectedSubject, classes, subjects]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const selectedDay = dayEntries.find(d => d.date === selectedDate);

  return (
    <div className="space-y-4">
      {/* ── Controls ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Class / Subject Attendance Viewer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Class */}
            <div className="space-y-1">
              <Label className="text-xs">Class</Label>
              <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setDayEntries([]); setAttendanceRecords([]); }}>
                <SelectTrigger className="text-xs h-8">
                  <GraduationCap className="h-3 w-3 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Select class…" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-1">
              <Label className="text-xs">Subject (optional)</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="text-xs h-8">
                  <BookOpen className="h-3 w-3 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SUBJECTS} className="text-xs">All Subjects</SelectItem>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* From */}
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs h-8" />
            </div>

            {/* To */}
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs h-8" />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={loadCalendar}
              disabled={!selectedClass || loadingCalendar}
            >
              {loadingCalendar ? (
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Calendar className="h-3 w-3 mr-1" />
              )}
              Load Events
            </Button>
            {selectedDate && mergedRows.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={exportExcel}
              >
                <Download className="h-3 w-3 mr-1" />
                Export Excel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── No class selected ── */}
      {!selectedClass && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <GraduationCap className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Select a class to begin</p>
            <p className="text-xs text-muted-foreground mt-1">Choose a class above, then click Load Events</p>
          </CardContent>
        </Card>
      )}

      {/* ── Main split layout ── */}
      {selectedClass && (dayEntries.length > 0 || loadingCalendar) && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-start">

          {/* ─ LEFT: date / event list ─ */}
          <Card className="lg:sticky lg:top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">
                Dates & Events
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[70vh] overflow-y-auto">
              {loadingCalendar ? (
                <div className="flex items-center justify-center py-10">
                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : dayEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 px-4">
                  No calendar data for this range.
                </p>
              ) : (
                <div className="divide-y">
                  {dayEntries.map(entry => {
                    const isSelected = selectedDate === entry.date && !selectedEventId;
                    return (
                      <div key={entry.date} className="px-3 py-2">
                        {/* Date header row */}
                        <button
                          className={cn(
                            'w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors',
                            isSelected
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'hover:bg-muted/60 text-foreground'
                          )}
                          onClick={() => handleSelectDate(entry.date, null)}
                        >
                          <span className="text-xs font-medium">{entry.label}</span>
                          <div className="flex items-center gap-1">
                            {entry.events.length > 0 && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                {entry.events.length}
                              </Badge>
                            )}
                            <ChevronRight className={cn('h-3 w-3 transition-transform', isSelected && 'rotate-90')} />
                          </div>
                        </button>

                        {/* Events under each date */}
                        {entry.events.length > 0 && (
                          <div className="mt-1 pl-2 space-y-0.5">
                            {entry.events.map(ev => {
                              const isEvSelected = selectedDate === entry.date && selectedEventId === String(ev.id);
                              return (
                                <button
                                  key={ev.id}
                                  className={cn(
                                    'w-full flex items-start gap-1.5 rounded-md px-2 py-1 text-left text-[11px] transition-colors',
                                    isEvSelected
                                      ? 'bg-primary/15 text-primary font-medium'
                                      : 'hover:bg-muted/50 text-muted-foreground'
                                  )}
                                  onClick={() => handleSelectDate(entry.date, String(ev.id))}
                                >
                                  <span className={cn('mt-0.5 shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase', eventTypeColor(ev.eventType))}>
                                    {ev.eventType}
                                  </span>
                                  <span className="leading-tight">{ev.title}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ─ RIGHT: student attendance grid ─ */}
          <div className="space-y-3">
            {/* Summary header */}
            {selectedDate ? (
              <Card>
                <CardContent className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold">
                        {selectedDay?.label ?? selectedDate}
                        {selectedEventId && selectedDay && (
                          <span className="ml-2 text-muted-foreground font-normal">
                            — {selectedDay.events.find(e => String(e.id) === selectedEventId)?.title ?? ''}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {classes.find(c => c.id === selectedClass)?.name}
                        {selectedSubject !== ALL_SUBJECTS && (
                          <> · {subjects.find(s => s.id === selectedSubject)?.name}</>
                        )}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={exportExcel}>
                      <Download className="h-3 w-3 mr-1" />
                      Export Excel
                    </Button>
                  </div>

                  {/* Status counts */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {Object.entries(counts).map(([s, n]) => (
                      <span key={s} className={cn('text-[11px] border rounded px-1.5 py-0.5 font-medium', statusConfig(s).className)}>
                        {statusConfig(s).label}: {n}
                      </span>
                    ))}
                    {mergedRows.length > 0 && (
                      <span className="text-[11px] border rounded px-1.5 py-0.5 font-medium bg-muted text-muted-foreground">
                        Total: {mergedRows.length}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex items-center justify-center gap-2 py-8">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Select a date or event on the left</p>
                </CardContent>
              </Card>
            )}

            {/* Search + filter */}
            {selectedDate && (
              <div className="flex gap-2 items-center flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8 h-8 text-xs"
                    placeholder="Search name, ID…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-8 text-xs w-36">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All statuses</SelectItem>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Student list */}
            {selectedDate && (
              <div>
                {(loadingAttendance || loadingStudents) ? (
                  <Card>
                    <CardContent className="flex items-center justify-center py-10">
                      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
                      <span className="text-sm text-muted-foreground">Loading…</span>
                    </CardContent>
                  </Card>
                ) : filteredRows.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                      <Users className="h-6 w-6 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">No students found</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {allStudents.length === 0
                          ? 'The class has no enrolled students.'
                          : 'No matches for current filter.'}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                    {filteredRows.map(row => (
                      <StudentCard
                        key={row.studentId}
                        row={row}
                        instituteName={selectedInstitute?.name}
                        instituteImageUrl={(selectedInstitute as any)?.imageUrl || (selectedInstitute as any)?.logoUrl}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Student Card ─────────────────────────────────────────────────────────────

interface StudentCardProps {
  row: MergedRow;
  instituteName?: string;
  instituteImageUrl?: string;
}

const StudentCard: React.FC<StudentCardProps> = ({ row, instituteName, instituteImageUrl }) => {
  const cfg = statusConfig(row.status);
  const imageUrl = getImageUrl(row.imageUrl);
  const instImg = getImageUrl(instituteImageUrl);

  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Student avatar */}
      <div className="relative shrink-0">
        <Avatar className="h-11 w-11 rounded-lg border">
          <AvatarImage src={imageUrl} alt={row.studentName} className="object-cover" />
          <AvatarFallback className="rounded-lg text-xs font-semibold bg-muted">
            {getInitials(row.studentName)}
          </AvatarFallback>
        </Avatar>
        {/* Institute mini-badge */}
        {instImg && (
          <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-card overflow-hidden bg-white shadow">
            <img src={instImg} alt={instituteName} className="h-full w-full object-cover" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{row.studentName || '—'}</p>

        {/* IDs row */}
        <div className="flex flex-wrap gap-x-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground font-mono">#{row.studentId}</span>
          {row.instituteUserId && (
            <span className="text-[10px] text-muted-foreground">
              <span className="opacity-60">ID: </span>
              <span className="font-medium">{row.instituteUserId}</span>
            </span>
          )}
        </div>

        {/* Institute name */}
        {instituteName && (
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{instituteName}</p>
        )}

        {/* Status + time */}
        <div className="flex items-center justify-between mt-1.5 gap-1 flex-wrap">
          <span className={cn('text-[11px] border rounded px-1.5 py-0.5 font-medium leading-none', cfg.className)}>
            {cfg.label}
          </span>
          {row.markedAt && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {friendlyTime(row.markedAt)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendanceRangeViewer;
