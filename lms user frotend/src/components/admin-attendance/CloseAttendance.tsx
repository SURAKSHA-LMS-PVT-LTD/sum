import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import adminAttendanceApi from '@/api/adminAttendance.api';
import { instituteStudentsApi } from '@/api/instituteStudents.api';
import { apiClient } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  ArrowLeft,
  RefreshCw,
  Users,
  UserCheck,
  UserX,
  Lock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Building2,
  GraduationCap,
  BookOpen,
  CalendarDays,
  Search,
} from 'lucide-react';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { getSriLankaDate } from '@/utils/timezone';
import type { StudentListRecord } from '@/api/instituteStudents.api';
import { useTodayCalendarEvents, DEFAULT_EVENT_ID } from '@/hooks/useTodayCalendarEvents';
import EventSelector from '@/components/attendance/EventSelector';

const getInitials = (name: string) =>
  name ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '?';

interface ClassOption { id: string; name: string }
interface SubjectOption { id: string; name: string }

interface CloseResult {
  successful: number;
  failed: number;
  total: number;
}

type Scope = 'institute' | 'class' | 'subject';

const ALL_VALUE = '__all__';

const CloseAttendance: React.FC = () => {
  const navigate = useNavigate();
  const { currentInstituteId, selectedInstitute, selectedClass, selectedSubject } = useAuth();

  // Scope — auto-detect from current selection
  const [scope, setScope] = useState<Scope>(() =>
    selectedSubject?.id ? 'subject' : selectedClass?.id ? 'class' : 'class'
  );

  // Selectors — pre-seed from current selection
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(() => selectedClass?.id?.toString() ?? '');
  const [selectedClassName, setSelectedClassName] = useState(() => selectedClass?.name ?? '');
  const [selectedSubjectId, setSelectedSubjectId] = useState(() => selectedSubject?.id?.toString() ?? ALL_VALUE);
  const [selectedSubjectName, setSelectedSubjectName] = useState(() => selectedSubject?.name ?? '');
  const [date, setDate] = useState(() => getSriLankaDate());

  // Re-seed whenever the user changes their context selection elsewhere
  useEffect(() => {
    const classId = selectedClass?.id?.toString() ?? '';
    const subjectId = selectedSubject?.id?.toString() ?? ALL_VALUE;
    setSelectedClassId(classId);
    setSelectedClassName(selectedClass?.name ?? '');
    setSelectedSubjectId(subjectId);
    setSelectedSubjectName(selectedSubject?.name ?? '');
    setScope(subjectId !== ALL_VALUE ? 'subject' : classId ? 'class' : 'class');
    resetState();
  }, [selectedClass?.id, selectedSubject?.id]);

  // Auto-advance date when Sri Lanka rolls past midnight
  useEffect(() => {
    const checkDate = () => {
      const sriLankaToday = getSriLankaDate();
      setDate(prev => prev < sriLankaToday ? sriLankaToday : prev);
    };
    const interval = setInterval(checkDate, 60_000);
    checkDate();
    return () => clearInterval(interval);
  }, []);

  // Event
  const [selectedEventId, setSelectedEventId] = useState(DEFAULT_EVENT_ID);
  const calendarInfo = useTodayCalendarEvents(currentInstituteId, selectedClassId || undefined, date);

  // Data
  const [enrolledStudents, setEnrolledStudents] = useState<StudentListRecord[]>([]);
  const [markedStudentIds, setMarkedStudentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closing, setClosing] = useState(false);

  // Result
  const [closeResult, setCloseResult] = useState<CloseResult | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Load classes
  useEffect(() => {
    if (!currentInstituteId) return;
    apiClient
      .get(`/institutes/${currentInstituteId}/classes`)
      .then((res: any) => setClasses(res?.data || res || []))
      .catch(() => {});
  }, [currentInstituteId]);

  // Load subjects when class changes
  useEffect(() => {
    if (!currentInstituteId || !selectedClassId) {
      setSubjects([]);
      return;
    }
    apiClient
      .get(`/institutes/${currentInstituteId}/classes/${selectedClassId}/subjects`)
      .then((res: any) => {
        const raw: any[] = res?.data || res || [];
        setSubjects(raw.map((s: any) => ({
          id: s.subjectId ?? s.subject?.id ?? s.id,
          name: s.subject?.name ?? s.name ?? s.subjectName ?? s.subjectId ?? s.id,
        })));
      })
      .catch(() => {});
  }, [currentInstituteId, selectedClassId]);

  // Reset event when date changes
  useEffect(() => {
    setSelectedEventId(DEFAULT_EVENT_ID);
  }, [date]);

  const resetState = () => {
    setHasLoaded(false);
    setCloseResult(null);
    setEnrolledStudents([]);
    setMarkedStudentIds(new Set());
  };

  const resolveEventId = useCallback((): string | undefined => {
    if (selectedEventId === DEFAULT_EVENT_ID) {
      return calendarInfo.defaultEventId || undefined;
    }
    return selectedEventId;
  }, [selectedEventId, calendarInfo.defaultEventId]);

  const loadData = useCallback(async () => {
    if (!currentInstituteId) return;
    if (scope !== 'institute' && !selectedClassId) {
      toast.error('Select a class first');
      return;
    }
    setLoading(true);
    setHasLoaded(false);
    setCloseResult(null);
    try {
      const subjectId =
        scope === 'subject' && selectedSubjectId !== ALL_VALUE ? selectedSubjectId : undefined;
      const eventId = scope === 'institute' ? resolveEventId() : undefined;

      const studentPromise =
        scope === 'institute'
          ? instituteStudentsApi.getStudentsByInstitute(currentInstituteId, { limit: 500 })
          : instituteStudentsApi.getStudentsByClass(currentInstituteId, selectedClassId, { limit: 500 });

      let attPromise: Promise<any>;
      if (eventId) {
        attPromise = adminAttendanceApi.getEventAttendance(
          currentInstituteId,
          eventId,
          {
            date,
            classId: scope !== 'institute' ? selectedClassId : undefined,
            subjectId,
            limit: 500,
          }
        );
      } else if (scope === 'institute') {
        attPromise = adminAttendanceApi.getInstituteAttendance(currentInstituteId, {
          startDate: date,
          endDate: date,
          limit: 500,
          page: 1,
        });
      } else if (subjectId) {
        attPromise = adminAttendanceApi.getSubjectAttendance(
          currentInstituteId,
          selectedClassId,
          subjectId,
          { startDate: date, endDate: date, limit: 500, page: 1 }
        );
      } else {
        attPromise = adminAttendanceApi.getClassAttendance(currentInstituteId, selectedClassId, {
          startDate: date,
          endDate: date,
          limit: 500,
          page: 1,
        });
      }

      const [studentRes, attRes] = await Promise.allSettled([studentPromise, attPromise]);

      const students =
        studentRes.status === 'fulfilled' ? studentRes.value?.data || [] : [];
      const rawData = attRes.status === 'fulfilled' ? attRes.value : null;
      const records: any[] = Array.isArray(rawData?.data)
        ? rawData.data
        : rawData?.data?.records
        ? rawData.data.records
        : [];

      setEnrolledStudents(students);
      setMarkedStudentIds(new Set(records.map((r: any) => String(r.studentId))));
      setHasLoaded(true);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [currentInstituteId, scope, selectedClassId, selectedSubjectId, date, resolveEventId]);

  const unmarkedStudents = enrolledStudents.filter(
    (s) => !markedStudentIds.has(String(s.id))
  );
  const markedCount = enrolledStudents.length - unmarkedStudents.length;
  const totalCount = enrolledStudents.length;
  const attendanceRate =
    totalCount > 0 ? Math.round((markedCount / totalCount) * 100) : 0;

  const filteredUnmarked = searchQuery.trim()
    ? unmarkedStudents.filter((s) =>
        (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.id || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : unmarkedStudents;

  const handleCloseAttendance = useCallback(async () => {
    if (!currentInstituteId || unmarkedStudents.length === 0) return;
    setClosing(true);
    setConfirmOpen(false);
    try {
      const subjectId =
        scope === 'subject' && selectedSubjectId !== ALL_VALUE ? selectedSubjectId : undefined;
      const eventId = resolveEventId();

      const BATCH = 100;
      let successful = 0;
      let failed = 0;

      for (let i = 0; i < unmarkedStudents.length; i += BATCH) {
        const batch = unmarkedStudents.slice(i, i + BATCH);
        try {
          const res = await adminAttendanceApi.markBulkAttendance({
            instituteId: currentInstituteId,
            instituteName: selectedInstitute?.name || '',
            classId: scope !== 'institute' ? selectedClassId : undefined,
            className: scope !== 'institute' ? selectedClassName : undefined,
            subjectId,
            subjectName: subjectId ? selectedSubjectName : undefined,
            date,
            eventId: eventId || undefined,
            markingMethod: 'system',
            students: batch.map((s) => ({
              studentId: s.id,
              studentName: s.name,
              status: 'absent',
              remarks: 'Auto-marked absent on attendance close',
            })),
          });
          successful += res?.summary?.successful ?? batch.length;
          failed += res?.summary?.failed ?? 0;
        } catch {
          failed += batch.length;
        }
      }

      setCloseResult({ successful, failed, total: unmarkedStudents.length });

      if (successful > 0) {
        toast.success(`Closed - ${successful} student(s) marked absent`);
      }
      if (failed > 0) {
        toast.error(`${failed} record(s) failed to save`);
      }

      await loadData();
    } finally {
      setClosing(false);
    }
  }, [
    currentInstituteId,
    scope,
    selectedClassId,
    selectedClassName,
    selectedSubjectId,
    selectedSubjectName,
    selectedInstitute,
    date,
    unmarkedStudents,
    loadData,
    resolveEventId,
  ]);

  const handleScopeChange = (s: Scope) => {
    setScope(s);
    resetState();
  };

  const handleClassChange = (id: string) => {
    setSelectedClassId(id);
    const cls = classes.find((c) => c.id === id);
    setSelectedClassName(cls?.name || '');
    setSelectedSubjectId(ALL_VALUE);
    setSelectedSubjectName('');
    resetState();
  };

  const handleSubjectChange = (id: string) => {
    setSelectedSubjectId(id);
    const sub = subjects.find((s) => s.id === id);
    setSelectedSubjectName(id !== ALL_VALUE ? sub?.name || '' : '');
    resetState();
  };

  const activeEventLabel = (() => {
    if (selectedEventId === DEFAULT_EVENT_ID) return 'Regular Class';
    const ev = calendarInfo.events.find((e) => e.id === selectedEventId);
    return ev?.title || 'Selected Event';
  })();

  const scopeLabel =
    scope === 'institute'
      ? selectedInstitute?.name || 'Institute'
      : scope === 'subject' && selectedSubjectId !== ALL_VALUE
      ? `${selectedClassName} / ${selectedSubjectName}`
      : selectedClassName;

  const goBack = () => {
    if (currentInstituteId) {
      navigate(`/institute/${currentInstituteId}/select-attendance-mark-type`);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="-m-3 sm:-m-4 lg:-m-6 flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Fixed Header */}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="w-full px-4 sm:px-6 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Close Attendance</h1>
            <p className="text-sm text-muted-foreground truncate">
              {selectedInstitute?.name || 'Institute'} &mdash; Auto-mark unmarked students as Absent
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Step 1: Configuration */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</div>
              Configure Scope & Date
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Choose the scope, date, and event for closing the attendance session.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Scope Selector */}
            <div>
              <Label className="text-xs font-medium text-muted-foreground mb-2 block">Scope</Label>
              <div className="flex gap-2 flex-wrap">
                {(
                  [
                    { value: 'institute', label: 'Institute', Icon: Building2, desc: 'All students' },
                    { value: 'class', label: 'Class', Icon: GraduationCap, desc: 'By class' },
                    { value: 'subject', label: 'Class + Subject', Icon: BookOpen, desc: 'By subject' },
                  ] as { value: Scope; label: string; Icon: React.ElementType; desc: string }[]
                ).map(({ value, label, Icon, desc }) => (
                  <button
                    key={value}
                    onClick={() => handleScopeChange(value)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      scope === value
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/20'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Filters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Class selector */}
              {scope !== 'institute' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Class <span className="text-destructive">*</span></Label>
                  <Select value={selectedClassId} onValueChange={handleClassChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class..." />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Subject selector */}
              {scope === 'subject' && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Subject</Label>
                  <Select value={selectedSubjectId} onValueChange={handleSubjectChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Subjects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_VALUE}>All Subjects</SelectItem>
                      {subjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

            </div>

            {/* Date & Event Row - always same row, equal size */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => { setDate(e.target.value); resetState(); }}
                />
              </div>
              <div className="space-y-1.5">
                <EventSelector
                  events={calendarInfo.events}
                  selectedEventId={selectedEventId}
                  onEventChange={(id) => { setSelectedEventId(id); resetState(); }}
                  loading={calendarInfo.loading}
                  dayType={calendarInfo.dayType}
                  isAttendanceExpected={calendarInfo.isAttendanceExpected}
                  compact
                />
              </div>
            </div>

            {/* Day info */}
            {!calendarInfo.loading && calendarInfo.dayType && (
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {calendarInfo.dayType}
                </Badge>
                {!calendarInfo.isAttendanceExpected && (
                  <Badge variant="destructive" className="text-xs">No Attendance Expected</Badge>
                )}
                {activeEventLabel !== 'Regular Class' && (
                  <Badge variant="secondary" className="text-xs">Event: {activeEventLabel}</Badge>
                )}
              </div>
            )}

            {/* Load Button */}
            <Button
              onClick={loadData}
              disabled={(scope !== 'institute' && !selectedClassId) || loading}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading Students...' : 'Load & Preview'}
            </Button>
          </CardContent>
        </Card>

        {/* Result Banner */}
        {closeResult && (
          <Card className="border-emerald-500/40 bg-emerald-500/5">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                  Attendance Closed Successfully
                </p>
                <p className="text-sm text-muted-foreground">
                  {closeResult.successful} student{closeResult.successful !== 1 ? 's' : ''} marked absent
                  {closeResult.failed > 0 && ` Â· ${closeResult.failed} failed`}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Review & Close */}
        {hasLoaded && (
          <>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
                  Review & Close
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Review the attendance overview, then close the session.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-4 rounded-xl border bg-primary/5 border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Enrolled</span>
                    </div>
                    <p className="text-2xl font-bold">{totalCount}</p>
                  </div>
                  <div className="p-4 rounded-xl border bg-emerald-500/5 border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <UserCheck className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Marked</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-600">{markedCount}</p>
                  </div>
                  <div className="p-4 rounded-xl border bg-red-500/5 border-red-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <UserX className="h-4 w-4 text-red-600" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Not Marked</span>
                    </div>
                    <p className="text-2xl font-bold text-red-600">{unmarkedStudents.length}</p>
                  </div>
                  <div className="p-4 rounded-xl border">
                    <div className="mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Marked Rate</span>
                    </div>
                    <p className="text-2xl font-bold">{attendanceRate}%</p>
                    <Progress value={attendanceRate} className="h-1.5 mt-2" />
                  </div>
                </div>

                {/* Close Button */}
                {unmarkedStudents.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Lock className="h-5 w-5 text-destructive" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Ready to close?</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {unmarkedStudents.length} student{unmarkedStudents.length !== 1 ? 's' : ''} will be marked as <span className="font-medium text-destructive">Absent</span>
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={() => setConfirmOpen(true)}
                      disabled={closing}
                      className="gap-2 shrink-0 w-full sm:w-auto"
                    >
                      {closing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                      {closing ? 'Closing...' : 'Close Attendance'}
                    </Button>
                  </div>
                )}

                {/* All marked */}
                {unmarkedStudents.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                      <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                    </div>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                      All students are marked!
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      No unmarked students for{' '}
                      {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                      })}
                      {activeEventLabel !== 'Regular Class' && ` - ${activeEventLabel}`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 3: Unmarked Students List */}
            {unmarkedStudents.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <CardTitle className="text-base flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-4 w-4" />
                      Not Yet Marked ({unmarkedStudents.length})
                    </CardTitle>
                    {/* Search */}
                    <div className="relative w-full sm:w-64">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search students..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 text-sm"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Student</TableHead>
                          <TableHead className="text-xs">ID</TableHead>
                          <TableHead className="text-xs hidden sm:table-cell">Institute ID</TableHead>
                          <TableHead className="text-xs text-center">Will be marked</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUnmarked.length > 0 ? (
                          filteredUnmarked.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell>
                                <div className="flex items-center gap-2.5">
                                  <Avatar className="h-8 w-8 shrink-0">
                                    <AvatarImage src={getImageUrl(s.imageUrl || '')} />
                                    <AvatarFallback className="text-[10px]">
                                      {getInitials(s.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm font-medium">{s.name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground">{s.id}</TableCell>
                              <TableCell className="text-xs font-mono text-muted-foreground hidden sm:table-cell">
                                {s.userIdByInstitute || '-'}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="destructive" className="text-[10px]">Absent</Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-sm text-muted-foreground">
                              {searchQuery ? 'No matching students' : 'No unmarked students'}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Empty State */}
        {!hasLoaded && !loading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">Configure & Load</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Select a scope and date above, then click "Load & Preview" to see which students haven't been marked.
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-destructive" />
              Close Attendance Session?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This will mark{' '}
                  <span className="font-bold text-destructive">
                    {unmarkedStudents.length} student(s)
                  </span>{' '}
                  as <span className="font-bold">Absent</span> for{' '}
                  <span className="font-semibold">{scopeLabel}</span> on{' '}
                  <span className="font-semibold">
                    {new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  .
                </p>
                <p className="text-xs">
                  Event: <span className="font-semibold">{activeEventLabel}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Students already marked (present / late / etc.) will not be affected.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCloseAttendance}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, Close & Mark Absent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CloseAttendance;
