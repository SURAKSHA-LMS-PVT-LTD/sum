import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { lectureApi, Lecture } from '@/api/lecture.api';
import {
  lectureTrackingApi, AttendanceGridResult,
} from '@/api/lectureTracking.api';
import { instituteStudentsApi, StudentListRecord } from '@/api/instituteStudents.api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  ArrowLeft, Calendar, Users,
  Loader2, RefreshCw, Clock, FileDown, CheckCircle2, XCircle, Search,
} from 'lucide-react';
import { buildSidebarUrl } from '@/utils/pageNavigation';
import { useContextUrlSync } from '@/utils/pageNavigation';
import PageContainer from '@/components/layout/PageContainer';
import LiveAttendanceReportingDialog from '@/components/attendance/LiveAttendanceReportingDialog';
import { toast } from 'sonner';
import { getImageUrl } from '@/utils/imageUrlHelper';

export default function LectureAttendanceLivePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedInstitute, selectedClass, selectedSubject, currentInstituteId, currentClassId, currentSubjectId } = useAuth();

  useContextUrlSync('lecture-live-attendance');

  // ── Lecture list ──────────────────────────────────────────────────────────
  const [classLectures, setClassLectures] = useState<Lecture[]>([]);
  const [subjectLectures, setSubjectLectures] = useState<Lecture[]>([]);
  const [loadingLectures, setLoadingLectures] = useState(false);

  const [studentDirectoryById, setStudentDirectoryById] = useState<Record<string, StudentListRecord>>({});
  const [loadingStudentDirectory, setLoadingStudentDirectory] = useState(false);

  // ── Reporting grid (on-demand for single lecture) ───────────────────────
  const [reportGrid, setReportGrid] = useState<AttendanceGridResult | null>(null);
  const [reportLecture, setReportLecture] = useState<Lecture | null>(null);
  const [loadingReportLectureId, setLoadingReportLectureId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  // ── Dedicated grid view state ─────────────────────────────────────────────
  const [viewGrid, setViewGrid] = useState<AttendanceGridResult | null>(null);
  const [loadingViewGrid, setLoadingViewGrid] = useState(false);

  // ── Session-based grid (per-link columns, single live lecture) ────────────
  const [sessionGrid, setSessionGrid] = useState<Awaited<ReturnType<typeof lectureTrackingApi.getLiveAttendanceSessionGrid>> | null>(null);
  const [loadingSessionGrid, setLoadingSessionGrid] = useState(false);

  // ── Student search (grid / summary / session views) ──────────────────────
  const [studentSearch, setStudentSearch] = useState('');

  // ── Visit detail popup ────────────────────────────────────────────────────
  const [visitPopup, setVisitPopup] = useState<{
    studentName: string;
    lectureTitle: string;
    loginCount: number;
    visits: Array<{ joinTime?: string; leaveTime?: string; durationMinutes?: number; ipAddress?: string; userAgent?: string }>;
  } | null>(null);

  const viewMode = searchParams.get('view') === 'grid' ? 'grid' : 'list';
  const lectureIdsParam = searchParams.get('lectureIds') || '';
  const viewLectureIds = useMemo(
    () => lectureIdsParam
      .split(',')
      .map(id => id.trim())
      .filter(Boolean),
    [lectureIdsParam],
  );

  // ── Load lectures ─────────────────────────────────────────────────────────
  const fetchLectures = useCallback(async (forceRefresh = false) => {
    if (!currentInstituteId || !currentClassId) return;
    setLoadingLectures(true);
    try {
      if (currentSubjectId) {
        const res = await lectureApi.getLectures({
          instituteId: currentInstituteId,
          classId: currentClassId,
          subjectId: currentSubjectId,
        }, forceRefresh);
        const subjArr: Lecture[] = (res as any)?.data ?? [];
        setSubjectLectures(subjArr);
        setClassLectures([]);
      } else {
        const clsRes = await lectureApi.getLectures({ classId: currentClassId, instituteId: currentInstituteId }, forceRefresh);
        const clsArr: Lecture[] = (clsRes as any)?.data ?? [];
        setClassLectures(clsArr);
        setSubjectLectures([]);
      }
    } catch {
      setClassLectures([]);
      setSubjectLectures([]);
    } finally {
      setLoadingLectures(false);
    }
  }, [currentInstituteId, currentClassId, currentSubjectId]);

  useEffect(() => { fetchLectures(); }, [fetchLectures]);

  const allLectures = [...classLectures, ...subjectLectures];

  const sortedLectures = useMemo(
    () => [...allLectures].sort((a, b) => (b.startTime || '').localeCompare(a.startTime || '')),
    [allLectures],
  );

  const lecturesByDate = useMemo(() => {
    return sortedLectures.reduce<Record<string, Lecture[]>>((acc, lecture) => {
      const key = lecture.startTime ? new Date(lecture.startTime).toISOString().slice(0, 10) : 'No Date';
      (acc[key] = acc[key] ?? []).push(lecture);
      return acc;
    }, {});
  }, [sortedLectures]);

  const sortedDates = useMemo(
    () => Object.keys(lecturesByDate).sort((a, b) => b.localeCompare(a)),
    [lecturesByDate],
  );

  const activeLecture = useMemo(
    () => allLectures.find(lecture => lecture.id === viewLectureIds[0]) || null,
    [allLectures, viewLectureIds],
  );

  const selectedLectures = useMemo(
    () => allLectures.filter(lecture => viewLectureIds.includes(lecture.id)),
    [allLectures, viewLectureIds],
  );

  const fetchStudentDirectory = useCallback(async () => {
    if (!currentInstituteId || !currentClassId) {
      setStudentDirectoryById({});
      return;
    }
    setLoadingStudentDirectory(true);
    try {
      const PAGE_SIZE = 100;
      const next: Record<string, StudentListRecord> = {};
      let page = 1;
      // Paginate through all students in batches — avoids one massive request
      while (true) {
        const response = currentSubjectId
          ? await instituteStudentsApi.getStudentsBySubject(currentInstituteId, currentClassId, currentSubjectId, { page, limit: PAGE_SIZE, parent: false })
          : await instituteStudentsApi.getStudentsByClass(currentInstituteId, currentClassId, { page, limit: PAGE_SIZE, parent: false });
        for (const s of response.data ?? []) next[s.id] = s;
        if ((response.data?.length ?? 0) < PAGE_SIZE) break; // last page
        page++;
      }
      setStudentDirectoryById(next);
    } catch {
      setStudentDirectoryById({});
    } finally {
      setLoadingStudentDirectory(false);
    }
  }, [currentInstituteId, currentClassId, currentSubjectId]);

  useEffect(() => { fetchStudentDirectory(); }, [fetchStudentDirectory]);

  const openGridView = (lectureId: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('view', 'grid');
      const ids = viewLectureIds.length > 0
        ? Array.from(new Set([...viewLectureIds, lectureId]))
        : [lectureId];
      next.set('lectureIds', ids.join(','));
      next.delete('lectureId');
      return next;
    }, { replace: true });
  };

  const toggleLectureSelection = (lectureId: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      const ids = new Set((next.get('lectureIds') || '').split(',').map(id => id.trim()).filter(Boolean));
      if (ids.has(lectureId)) ids.delete(lectureId);
      else ids.add(lectureId);
      const nextIds = Array.from(ids);
      if (nextIds.length) next.set('lectureIds', nextIds.join(','));
      else next.delete('lectureIds');
      next.delete('lectureId');
      return next;
    }, { replace: true });
  };

  const selectAllLectures = () => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('lectureIds', allLectures.map(l => l.id).join(','));
      next.delete('lectureId');
      return next;
    }, { replace: true });
  };

  const clearLectureSelection = () => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('lectureIds');
      next.delete('lectureId');
      next.delete('view');
      return next;
    }, { replace: true });
  };

  const goBackToLectureList = () => {
    setStudentSearch('');
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('view');
      next.delete('lectureId');
      next.delete('lectureIds');
      return next;
    }, { replace: true });
  };

  const loadGridForView = useCallback(async () => {
    if (viewMode !== 'grid' || viewLectureIds.length === 0 || !currentInstituteId || !currentClassId) {
      setViewGrid(null);
      setSessionGrid(null);
      return;
    }

    // Single lecture with live attendance enabled → use session grid (per-link columns)
    const singleLecture = viewLectureIds.length === 1
      ? allLectures.find(l => l.id === viewLectureIds[0])
      : null;
    const useSessionGrid = !!(singleLecture?.liveAttendanceEnabled && singleLecture.status !== 'completed');

    if (useSessionGrid) {
      setSessionGrid(null);
      setViewGrid(null);
      setLoadingSessionGrid(true);
      try {
        const grid = await lectureTrackingApi.getLiveAttendanceSessionGrid({
          lectureId: viewLectureIds[0],
          classId: currentClassId,
          instituteId: currentInstituteId,
        });
        setSessionGrid(grid);
      } catch {
        setSessionGrid(null);
        toast.error('Failed to load session attendance grid.');
      } finally {
        setLoadingSessionGrid(false);
      }
    } else {
      setSessionGrid(null);
      setLoadingViewGrid(true);
      try {
        const grid = await lectureTrackingApi.getAttendanceGrid({
          lectureIds: viewLectureIds,
          classId: currentClassId,
          instituteId: currentInstituteId,
          includeSubjectLectures: !!currentSubjectId,
        });
        setViewGrid(grid);
      } catch {
        setViewGrid(null);
        toast.error('Failed to load attendance grid for this lecture.');
      } finally {
        setLoadingViewGrid(false);
      }
    }
  }, [viewMode, viewLectureIds, currentInstituteId, currentClassId, currentSubjectId, allLectures]);

  useEffect(() => { loadGridForView(); }, [loadGridForView]);

  const enrolledStudentsForView = useMemo(() => {
    const directoryStudents = Object.values(studentDirectoryById);
    if (directoryStudents.length > 0) {
      return directoryStudents
        .map(student => ({
          id: student.id,
          name: student.name,
          instituteUserId: student.userIdByInstitute || student.id,
          imageUrl: student.imageUrl || '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    return (viewGrid?.students || [])
      .map(student => ({
        id: student.id,
        name: student.name,
        instituteUserId: student.id,
        imageUrl: student.imageUrl || '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [studentDirectoryById, viewGrid]);

  const gridLectureColumns = useMemo(
    () => selectedLectures.length > 0 ? selectedLectures : allLectures.filter(lecture => viewLectureIds.includes(lecture.id)),
    [selectedLectures, allLectures, viewLectureIds],
  );

  const openReportingForLecture = async (lecture: Lecture) => {
    if (!currentInstituteId || !currentClassId) return;
    setLoadingReportLectureId(lecture.id);
    try {
      const grid = await lectureTrackingApi.getAttendanceGrid({
        lectureIds: [lecture.id],
        classId: currentClassId,
        instituteId: currentInstituteId,
        includeSubjectLectures: !!currentSubjectId,
      });
      setReportGrid(grid);
      setReportLecture(lecture);
      setReportOpen(true);
    } catch {
      toast.error('Failed to prepare report data for this lecture.');
    } finally {
      setLoadingReportLectureId(null);
    }
  };

  const goBack = () => navigate(buildSidebarUrl('dashboard', {
    instituteId: currentInstituteId, classId: currentClassId, subjectId: currentSubjectId,
  }));

  if (!selectedInstitute || !selectedClass) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Calendar className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Select a class to view live lecture attendance.</p>
      </div>
    );
  }

  // ── Summary mode: completed lecture with stored summary ──────────────────
  const summaryLecture = viewMode === 'grid' && gridLectureColumns.length === 1 && gridLectureColumns[0]?.status === 'completed'
    ? gridLectureColumns[0]
    : null;
  const summary = (summaryLecture as any)?.lectureSummary ?? null;

  if (summaryLecture && summary) {
    const sa: Array<{ studentId: string; attendCount: number; attendPercent: number; firstAt: string; lastAt: string }> = summary.studentAttendance ?? [];
    const recWatch: Array<{ userId: string; watchedMinutes: number; completionPercent: number | null; timesViewed: number; lastPositionMinutes: number }> = summary.recPerStudentWatch ?? [];
    const recWatchById = new Map(recWatch.map(r => [r.userId, r]));

    // Merge with student directory for names
    const allMergedRows = sa.map(s => ({
      ...s,
      name: studentDirectoryById[s.studentId]?.name ?? `ID ${s.studentId}`,
      imageUrl: studentDirectoryById[s.studentId]?.imageUrl ?? '',
      instituteUserId: studentDirectoryById[s.studentId]?.userIdByInstitute ?? s.studentId,
      rec: recWatchById.get(s.studentId) ?? null,
    })).sort((a, b) => b.attendCount - a.attendCount);
    const q = studentSearch.trim().toLowerCase();
    const mergedRows = q
      ? allMergedRows.filter(r => r.name.toLowerCase().includes(q) || r.instituteUserId.toLowerCase().includes(q))
      : allMergedRows;

    return (
      <PageContainer maxWidth="full" className="h-full">
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={goBackToLectureList} className="rounded-full shrink-0 h-8 w-8 hover:bg-primary/10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight">{summaryLecture.title}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Lecture Summary · Closed {summary.closedBy ? `by ${summary.closedBy}` : ''}{summaryLecture.closedAt ? ` · ${new Date((summaryLecture as any).closedAt).toLocaleDateString()}` : ''}
              </p>
            </div>
            <div className="relative shrink-0 w-44">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search student…"
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                className="h-8 pl-8 text-xs rounded-lg"
              />
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 to-blue-500/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Links</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{summary.totalAttendanceSessions}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500 opacity-40" />
              </CardContent>
            </Card>
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-green-500/10 to-green-500/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Marked</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{summary.totalStudentsMarked}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500 opacity-40" />
              </CardContent>
            </Card>
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Attend.</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1">{summary.fullAttendanceCount}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-40" />
              </CardContent>
            </Card>
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rec. Viewers</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">{summary.recUniqueViewers}</p>
                </div>
                <Users className="h-8 w-8 text-purple-500 opacity-40" />
              </CardContent>
            </Card>
          </div>

          {/* Per-student table */}
          <Card className="overflow-hidden border-0 shadow-md">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-b pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Student Attendance — Session by Session
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                {mergedRows.length}{q ? ` of ${allMergedRows.length}` : ''} student{mergedRows.length !== 1 ? 's' : ''} · {summary.totalAttendanceSessions} attendance link{summary.totalAttendanceSessions !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {mergedRows.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No attendance marks recorded.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-900/50 border-b-2 hover:bg-slate-50">
                        <TableHead className="text-xs font-semibold text-muted-foreground">Student</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground text-center">Status</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground text-center">Links Marked</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground text-center">Attendance %</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground text-center">First Mark</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground text-center">Last Mark</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground text-center">Recording</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mergedRows.map((row, idx) => (
                        <TableRow key={row.studentId} className={`border-b transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/30 ${idx % 2 === 0 ? 'bg-white/50 dark:bg-slate-900/20' : ''}`}>
                          <TableCell className="text-xs font-medium">
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar className="h-7 w-7 shrink-0 ring-2 ring-primary/20">
                                <AvatarImage src={getImageUrl(row.imageUrl)} alt={row.name} />
                                <AvatarFallback className="text-[10px] font-semibold">
                                  {row.name.split(' ').filter(Boolean).map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-foreground">{row.name}</div>
                                <div className="text-[10px] text-muted-foreground/60 font-mono">{row.instituteUserId}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                              row.attendPercent === 100 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : row.attendPercent >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : row.attendCount > 0 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                            }`}>
                              {row.attendPercent === 100 ? 'Present' : row.attendPercent >= 50 ? 'Partial' : row.attendCount > 0 ? 'Low' : 'Absent'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center gap-1 text-xs font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                              {row.attendCount} / {summary.totalAttendanceSessions}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              row.attendPercent === 100 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : row.attendPercent >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                            }`}>
                              {row.attendPercent}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground whitespace-nowrap">
                            {row.firstAt ? new Date(row.firstAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                            <div className="text-[10px] text-muted-foreground/60">{row.firstAt ? new Date(row.firstAt).toLocaleDateString() : ''}</div>
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground whitespace-nowrap">
                            {row.lastAt ? new Date(row.lastAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                            <div className="text-[10px] text-muted-foreground/60">{row.lastAt ? new Date(row.lastAt).toLocaleDateString() : ''}</div>
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {row.rec ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="font-medium">{row.rec.watchedMinutes} min</span>
                                {row.rec.completionPercent !== null && (
                                  <span className={`text-[10px] font-semibold ${row.rec.completionPercent >= 80 ? 'text-emerald-600' : row.rec.completionPercent >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>
                                    {row.rec.completionPercent}% complete
                                  </span>
                                )}
                                <span className="text-[10px] text-muted-foreground">{row.rec.timesViewed}× viewed</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recording totals */}
          {(summary.recUniqueViewers > 0 || summary.liveDirectJoins > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {summary.liveDirectJoins > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Direct Live Joins</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">Total joins</span><span className="font-medium">{summary.liveDirectJoins}</span>
                    <span className="text-muted-foreground">Unique users</span><span className="font-medium">{summary.liveDirectUniqueUsers}</span>
                    <span className="text-muted-foreground">Guests</span><span className="font-medium">{summary.liveGuestJoins}</span>
                    <span className="text-muted-foreground">Avg. duration</span><span className="font-medium">{summary.liveAvgDurationMinutes} min</span>
                  </CardContent>
                </Card>
              )}
              {summary.recUniqueViewers > 0 && (
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recording Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-muted-foreground">Viewers</span><span className="font-medium">{summary.recUniqueViewers}</span>
                    <span className="text-muted-foreground">Times viewed</span><span className="font-medium">{summary.recTimesViewed}</span>
                    <span className="text-muted-foreground">Total watched</span><span className="font-medium">{summary.recTotalWatchedMinutes} min</span>
                    <span className="text-muted-foreground">Avg. per viewer</span><span className="font-medium">{summary.recAvgWatchedMinutes} min</span>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </PageContainer>
    );
  }

  // Loading spinner while session grid is being fetched (not shown when summary mode takes over)
  if (viewMode === 'grid' && loadingSessionGrid && !sessionGrid && !summaryLecture) {
    return (
      <PageContainer maxWidth="full">
        <div className="space-y-4 animate-pulse">
          <Skeleton className="h-10 w-64 rounded-lg" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  // ── Session grid mode: single live lecture, per-link columns ─────────────
  if (viewMode === 'grid' && sessionGrid) {
    const sessions = sessionGrid.sessions;
    const allRosterStudents = Object.values(studentDirectoryById).length > 0
      ? Object.values(studentDirectoryById).map(s => ({
          id: s.id, name: s.name,
          instituteUserId: s.userIdByInstitute || s.id,
          imageUrl: s.imageUrl || '',
        })).sort((a, b) => a.name.localeCompare(b.name))
      : sessionGrid.students.map(s => ({
          id: s.id, name: s.name, instituteUserId: s.id, imageUrl: s.imageUrl || '',
        }));
    const sgQ = studentSearch.trim().toLowerCase();
    const rosterStudents = sgQ
      ? allRosterStudents.filter(s => s.name.toLowerCase().includes(sgQ) || s.instituteUserId.toLowerCase().includes(sgQ))
      : allRosterStudents;

    const totalSlots = allRosterStudents.length;

    return (
      <PageContainer maxWidth="full" className="h-full">
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={goBackToLectureList} className="rounded-full shrink-0 h-8 w-8 hover:bg-primary/10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Live Attendance
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {sessionGrid.lecture.title} · {sessions.length} link{sessions.length !== 1 ? 's' : ''} · {selectedClass?.name}
              </p>
            </div>
            <div className="relative shrink-0 w-40">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search student…"
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                className="h-8 pl-8 text-xs rounded-lg"
              />
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs shrink-0" onClick={() => fetchLectures(true)} disabled={loadingSessionGrid || loadingLectures}>
              <RefreshCw className={`h-3.5 w-3.5 ${(loadingSessionGrid || loadingLectures) ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-0 bg-gradient-to-br from-blue-500/10 to-blue-500/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Links</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{sessions.length}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500 opacity-40" />
              </CardContent>
            </Card>
            <Card className="border-0 bg-gradient-to-br from-green-500/10 to-green-500/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Students</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{sgQ ? `${rosterStudents.length}/` : ''}{totalSlots}</p>
                </div>
                <Users className="h-8 w-8 text-green-500 opacity-40" />
              </CardContent>
            </Card>
            <Card className="border-0 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Marks</p>
                  <p className="text-2xl font-bold text-purple-600 mt-1">
                    {sessions.reduce((s, sess) => s + (sess.markCount ?? 0), 0)}
                  </p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-purple-500 opacity-40" />
              </CardContent>
            </Card>
          </div>

          {/* Session × Student grid */}
          <Card className="overflow-hidden border-0 shadow-md">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-b pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Per-Link Attendance
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Each column = one attendance link. Green = marked present.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingSessionGrid ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                </div>
              ) : rosterStudents.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No enrolled students found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-900/50 border-b-2 hover:bg-slate-50">
                        <TableHead className="text-xs font-semibold text-muted-foreground sticky left-0 bg-slate-50 dark:bg-slate-900/50 z-10">Student</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground text-center">Marked</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground text-center">%</TableHead>
                        {sessions.map((sess, idx) => (
                          <TableHead key={sess.id} className="text-center min-w-[80px] text-xs font-semibold text-muted-foreground">
                            <div className="flex flex-col items-center gap-0.5">
                              <span>Link {idx + 1}</span>
                              <span className="text-[9px] text-muted-foreground/60 font-normal">
                                {new Date(sess.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className="text-[9px] font-normal text-primary/70">{sess.markCount ?? 0} marked</span>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rosterStudents.map((student, idx) => {
                        const studentMarks = sessions.map(sess => sessionGrid.grid?.[student.id]?.[sess.id] ?? { marked: false });
                        const markedCount = studentMarks.filter(m => m.marked).length;
                        const pct = sessions.length > 0 ? Math.round((markedCount / sessions.length) * 100) : 0;
                        return (
                          <TableRow key={student.id} className={`border-b hover:bg-slate-50 dark:hover:bg-slate-900/30 ${idx % 2 === 0 ? 'bg-white/50 dark:bg-slate-900/20' : ''}`}>
                            <TableCell className="sticky left-0 bg-inherit z-10 text-xs font-medium">
                              <div className="flex items-center gap-2 min-w-0">
                                <Avatar className="h-7 w-7 shrink-0 ring-2 ring-primary/20">
                                  <AvatarImage src={getImageUrl(student.imageUrl)} alt={student.name} />
                                  <AvatarFallback className="text-[10px] font-semibold">
                                    {student.name.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <div className="truncate font-semibold text-foreground max-w-[140px]">{student.name}</div>
                                  <div className="text-[10px] text-muted-foreground/60 font-mono">{student.instituteUserId}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-xs font-medium">
                              {markedCount}/{sessions.length}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                                pct === 100 ? 'bg-emerald-100 text-emerald-700'
                                : pct >= 50 ? 'bg-amber-100 text-amber-700'
                                : 'bg-rose-100 text-rose-700'
                              }`}>{pct}%</span>
                            </TableCell>
                            {studentMarks.map((mark, si) => (
                              <TableCell key={si} className="text-center p-1">
                                <div className={`inline-flex flex-col items-center justify-center min-h-[44px] w-full px-1 py-1 rounded-lg ${
                                  mark.marked
                                    ? 'bg-green-500/15 border border-green-500/30'
                                    : 'bg-red-500/10 border border-red-500/20'
                                }`}>
                                  {mark.marked ? (
                                    <>
                                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                                      {mark.markedAt && (
                                        <span className="text-[9px] text-green-700 mt-0.5 whitespace-nowrap">
                                          {new Date(mark.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-500" />
                                  )}
                                </div>
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    );
  }

  if (viewMode === 'grid') {
    const gridQ = studentSearch.trim().toLowerCase();
    const filteredStudentsForView = gridQ
      ? enrolledStudentsForView.filter(s => s.name.toLowerCase().includes(gridQ) || s.instituteUserId.toLowerCase().includes(gridQ))
      : enrolledStudentsForView;

    const attendanceRows = filteredStudentsForView.map(student => {
      return {
        ...student,
        cells: gridLectureColumns.map(lecture => {
          const cell = viewGrid?.grid?.[student.id]?.[lecture.id];
          return {
            lectureId: lecture.id,
            lectureTitle: lecture.title,
            attended: !!cell?.attended,
            loginCount: cell?.loginCount,
            joinTime: cell?.joinTime,
            durationMinutes: cell?.durationMinutes,
            visits: cell?.visits,
          };
        }),
      };
    });

    const presentCount = attendanceRows.reduce((count, row) => {
      return count + row.cells.filter(cell => cell.attended).length;
    }, 0);
    const totalSlots = attendanceRows.length * gridLectureColumns.length;
    const absentCount = totalSlots - presentCount;
    const attendancePercentage = totalSlots > 0 ? Math.round((presentCount / totalSlots) * 100) : 0;

    return (
      <PageContainer maxWidth="full" className="h-full">
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={goBackToLectureList} className="rounded-full shrink-0 h-8 w-8 hover:bg-primary/10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Attendance Overview
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {gridLectureColumns.length} lecture{gridLectureColumns.length === 1 ? '' : 's'} • {selectedClass.name}{selectedSubject ? ` • ${selectedSubject.name}` : ''}
              </p>
            </div>
            <div className="relative shrink-0 w-40">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search student…"
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                className="h-8 pl-8 text-xs rounded-lg"
              />
            </div>
            {gridLectureColumns[0] && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 hover:bg-primary/10 shrink-0"
                onClick={() => openReportingForLecture(gridLectureColumns[0])}
                disabled={loadingReportLectureId === gridLectureColumns[0].id}
              >
                {loadingReportLectureId === gridLectureColumns[0].id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <FileDown className="h-4 w-4" />
                    <span className="text-xs">Export Report</span>
                  </>
                )}
              </Button>
            )}
          </div>

          <LiveAttendanceReportingDialog
            open={reportOpen}
            onOpenChange={setReportOpen}
            grid={reportGrid}
            selectedLectures={reportLecture ? [reportLecture] : []}
            className={selectedClass.name}
            studentDirectoryById={studentDirectoryById}
          />

          {/* Visit Detail Sheet */}
          <Sheet open={!!visitPopup} onOpenChange={open => { if (!open) setVisitPopup(null); }} routeName="visit-details-sheet">
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader className="pb-4">
                <SheetTitle className="text-base">{visitPopup?.studentName}</SheetTitle>
                <SheetDescription className="text-xs">{visitPopup?.lectureTitle}</SheetDescription>
              </SheetHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">
                    {visitPopup?.loginCount ?? 0} login{(visitPopup?.loginCount ?? 0) !== 1 ? 's' : ''}
                  </span>
                </div>
                {(visitPopup?.visits ?? []).map((v, i) => (
                  <div key={i} className="rounded-lg border bg-card p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Login #{i + 1}</span>
                      {v.durationMinutes != null && (
                        <span className="text-xs font-medium text-green-700 bg-green-500/10 px-2 py-0.5 rounded-full">
                          {v.durationMinutes} min
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Join time</p>
                        <p className="font-medium">{v.joinTime ? new Date(v.joinTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</p>
                        {v.joinTime && <p className="text-muted-foreground/70">{new Date(v.joinTime).toLocaleDateString()}</p>}
                      </div>
                      <div>
                        <p className="text-muted-foreground">Leave time</p>
                        <p className="font-medium">{v.leaveTime ? new Date(v.leaveTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</p>
                        {v.leaveTime && <p className="text-muted-foreground/70">{new Date(v.leaveTime).toLocaleDateString()}</p>}
                      </div>
                    </div>
                    {v.ipAddress && (
                      <div className="text-xs">
                        <p className="text-muted-foreground">IP Address</p>
                        <p className="font-mono font-medium">{v.ipAddress}</p>
                      </div>
                    )}
                    {v.userAgent && (
                      <div className="text-xs">
                        <p className="text-muted-foreground">Device</p>
                        <p className="font-medium break-all text-muted-foreground/80">{v.userAgent}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-green-500/10 to-green-500/5 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Present</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{presentCount}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-red-500/10 to-red-500/5 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Absent</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">{absentCount}</p>
                  </div>
                  <XCircle className="h-8 w-8 text-red-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 to-blue-500/5 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Attendance Rate</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{attendancePercentage}%</p>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <span className="text-xs font-bold text-blue-600">{attendancePercentage}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 to-purple-500/5 hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Slots</p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">{totalSlots}</p>
                  </div>
                  <Users className="h-8 w-8 text-purple-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Table Card */}
          <Card className="overflow-hidden border-0 shadow-md">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-b pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Student Attendance Details
              </CardTitle>
              <CardDescription className="text-xs mt-2">
                {attendanceRows.length} students across {gridLectureColumns.length} lecture{gridLectureColumns.length === 1 ? '' : 's'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingViewGrid ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                </div>
              ) : attendanceRows.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No enrolled students found for this context.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-900/50 border-b-2 hover:bg-slate-50">
                        <TableHead className="text-xs font-semibold text-muted-foreground">Student</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground">Institute ID</TableHead>
                        <TableHead className="text-xs font-semibold text-muted-foreground">System ID</TableHead>
                        {gridLectureColumns.map(lecture => (
                          <TableHead key={lecture.id} className="text-center min-w-[140px] text-xs font-semibold text-muted-foreground">
                            <div className="truncate max-w-[130px] mx-auto font-semibold" title={lecture.title}>{lecture.title}</div>
                            {lecture.startTime && (
                              <div className="text-[10px] text-muted-foreground/70 font-normal mt-0.5">
                                {new Date(lecture.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </div>
                            )}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceRows.map((row, idx) => (
                        <TableRow key={row.id} className={`hover:bg-slate-50 dark:hover:bg-slate-900/30 border-b transition-colors ${idx % 2 === 0 ? 'bg-white/50 dark:bg-slate-900/20' : ''}`}>
                          <TableCell className="text-xs font-medium">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className="h-8 w-8 shrink-0 ring-2 ring-primary/20">
                                <AvatarImage
                                  src={getImageUrl((row.imageUrl || studentDirectoryById[row.id]?.imageUrl || '').trim()) || undefined}
                                  alt={row.name}
                                />
                                <AvatarFallback className="text-[10px] font-semibold">
                                  {row.name.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-foreground">{row.name}</div>
                                <div className="text-[10px] text-muted-foreground/60 truncate">ID: {row.id.slice(0, 8)}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground/70 font-mono">{row.instituteUserId}</TableCell>
                          <TableCell className="text-xs text-muted-foreground/70 font-mono">{row.id.slice(0, 12)}</TableCell>
                          {row.cells.map(cell => (
                            <TableCell key={cell.lectureId} className="text-center p-2">
                              <div
                                className={`inline-flex flex-col items-center justify-center gap-1 min-h-[50px] px-2 py-1 rounded-lg transition-all ${
                                  cell.attended
                                    ? 'bg-green-500/15 border border-green-500/30 cursor-pointer hover:bg-green-500/25'
                                    : 'bg-red-500/10 border border-red-500/20'
                                }`}
                                onClick={() => {
                                  if (cell.attended && (cell.loginCount ?? 0) > 0) {
                                    setVisitPopup({
                                      studentName: row.name,
                                      lectureTitle: cell.lectureTitle,
                                      loginCount: cell.loginCount ?? 1,
                                      visits: cell.visits ?? [],
                                    });
                                  }
                                }}
                              >
                                {cell.attended ? (
                                  <>
                                    <div className="flex items-center gap-1">
                                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                                      {(cell.loginCount ?? 1) > 1 && (
                                        <span className="text-[9px] font-bold text-white bg-orange-500 rounded-full px-1 leading-4">
                                          ×{cell.loginCount}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] font-semibold text-green-700 whitespace-nowrap">
                                      {cell.joinTime ? new Date(cell.joinTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Present'}
                                    </span>
                                    {cell.durationMinutes && (
                                      <span className="text-[9px] text-green-600/70">{Math.round(cell.durationMinutes)} min</span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-4 w-4 text-red-500" />
                                    <span className="text-[10px] font-semibold text-red-600">Absent</span>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="full" className="h-full">
      <div className="space-y-6">
        {/* Header with gradient background */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border border-primary/10">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={goBack} className="rounded-full shrink-0 h-9 w-9 hover:bg-primary/10 hover:border-primary/30">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Live Session Attendance
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                Track and manage attendance for {selectedClass.name}{selectedSubject ? ` • ${selectedSubject.name}` : ''} • {selectedInstitute.name}
              </p>
            </div>
            <Button variant="outline" size="sm" className="h-9 gap-2 hover:bg-primary/10" onClick={fetchLectures} disabled={loadingLectures}>
              <RefreshCw className={`h-4 w-4 ${loadingLectures ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline text-xs">Refresh</span>
            </Button>
          </div>
        </div>

        <LiveAttendanceReportingDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          grid={reportGrid}
          selectedLectures={reportLecture ? [reportLecture] : []}
          className={selectedClass.name}
          studentDirectoryById={studentDirectoryById}
        />

        {/* Quick Actions Card */}
        <Card className="overflow-hidden border-0 shadow-md bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Lecture Selection
            </CardTitle>
            <CardDescription className="text-xs">
              {allLectures.length} total lecture{allLectures.length === 1 ? '' : 's'} • {viewLectureIds.length} selected
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant={viewLectureIds.length === allLectures.length && allLectures.length > 0 ? "default" : "outline"} 
                size="sm" 
                className="h-8 text-xs" 
                onClick={selectAllLectures} 
                disabled={allLectures.length === 0}
              >
                Select All
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-8 text-xs" 
                onClick={clearLectureSelection} 
                disabled={viewLectureIds.length === 0}
              >
                Clear Selection
              </Button>
              <Button 
                variant="default" 
                size="sm" 
                className="h-8 text-xs gap-1 ml-auto" 
                onClick={() => openGridView(viewLectureIds[0])} 
                disabled={viewLectureIds.length === 0}
              >
                <Users className="h-3.5 w-3.5" />
                Compare Grid {viewLectureIds.length > 1 && `(${viewLectureIds.length})`}
              </Button>
            </div>
            
            {viewLectureIds.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedLectures.map(lecture => (
                  <Badge 
                    key={lecture.id}
                    variant="secondary" 
                    className="text-xs py-1 px-3 cursor-pointer hover:bg-secondary/80 transition-colors"
                    onClick={() => toggleLectureSelection(lecture.id)}
                  >
                    {lecture.title}
                    <span className="ml-1.5 opacity-70 hover:opacity-100">✕</span>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lectures by Date */}
        {sortedDates.length === 0 && !loadingLectures ? (
          <Card className="overflow-hidden border-0 shadow-md">
            <CardContent className="py-16 px-4 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-sm font-medium text-foreground mb-1">No lectures yet</p>
              <p className="text-xs text-muted-foreground">No live-tracked lectures found for this context. Check back later!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {sortedDates.map(date => (
              <div key={date}>
                {/* Date Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/10">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-foreground">
                        {date === 'No Date' ? 'No Date' : new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">{lecturesByDate[date].length} lecture{lecturesByDate[date].length === 1 ? '' : 's'}</span>
                </div>

                {/* Lectures Grid - Full Width */}
                <div className="space-y-2">
                  {lecturesByDate[date].map(lecture => {
                    const selected = viewLectureIds.includes(lecture.id);
                    return (
                      <Card
                        key={lecture.id}
                        className={`overflow-hidden transition-all duration-200 cursor-pointer border-0 shadow-md hover:shadow-lg hover:scale-[1.01] ${
                          selected 
                            ? 'ring-2 ring-primary bg-gradient-to-br from-primary/10 to-primary/5' 
                            : 'bg-white dark:bg-slate-900'
                        }`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            {/* Left: Checkbox + Title */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Checkbox
                                checked={selected}
                                onCheckedChange={() => toggleLectureSelection(lecture.id)}
                                onClick={e => e.stopPropagation()}
                                className="h-5 w-5 shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-sm truncate flex-1">{lecture.title}</h3>
                                  {lecture.liveAttendanceEnabled && (
                                    <Badge className="text-[10px] bg-green-500/20 text-green-700 border-green-500/30 font-semibold shrink-0">
                                      ● Live
                                    </Badge>
                                  )}
                                  {selectedSubject && (
                                    <Badge variant="outline" className="text-[10px] shrink-0">{selectedSubject.name}</Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Center: Time */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-lg shrink-0">
                              <Clock className="h-3.5 w-3.5" />
                              <span className="font-medium whitespace-nowrap">
                                {lecture.startTime ? new Date(lecture.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No time'}
                              </span>
                            </div>

                            {/* Right: Action Buttons */}
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 text-xs gap-1"
                                onClick={() => openGridView(lecture.id)}
                              >
                                <Users className="h-3.5 w-3.5" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1"
                                onClick={() => openReportingForLecture(lecture)}
                                disabled={loadingReportLectureId === lecture.id}
                              >
                                {loadingReportLectureId === lecture.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <FileDown className="h-3.5 w-3.5" />
                                    Export
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
