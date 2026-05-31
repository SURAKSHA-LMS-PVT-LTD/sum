import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { lectureApi, Lecture } from '@/api/lecture.api';
import {
  lectureTrackingApi, AttendanceGridResult, LiveAttendanceSessionGrid,
} from '@/api/lectureTracking.api';
import { instituteStudentsApi, StudentListRecord } from '@/api/instituteStudents.api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  ArrowLeft, Calendar, Users,
  Loader2, RefreshCw, Clock, FileDown, CheckCircle2, XCircle, Link2, Copy,
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

  // ── Live attendance link sessions ─────────────────────────────────────────
  const [sessionGrid, setSessionGrid] = useState<LiveAttendanceSessionGrid | null>(null);
  const [loadingSessionGrid, setLoadingSessionGrid] = useState(false);
  const [createSessionOpen, setCreateSessionOpen] = useState(false);
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState(300);
  const [creatingSession, setCreatingSession] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'present' | 'absent'>('all');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'marked' | 'not_marked'>('all');
  const [showFilterSheet, setShowFilterSheet] = useState(false);

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
  const fetchLectures = useCallback(async () => {
    if (!currentInstituteId || !currentClassId) return;
    setLoadingLectures(true);
    try {
      if (currentSubjectId) {
        // Subject level: fetch only subject lectures
        const res = await lectureApi.getLectures({
          instituteId: currentInstituteId,
          classId: currentClassId,
          subjectId: currentSubjectId,
        });
        const subjArr: Lecture[] = (res as any)?.data ?? [];
        setSubjectLectures(subjArr);
        setClassLectures([]);
      } else {
        // Class level: fetch only class lectures
        const clsRes = await lectureApi.getLectures({ classId: currentClassId, instituteId: currentInstituteId });
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
      const response = currentSubjectId
        ? await instituteStudentsApi.getStudentsBySubject(currentInstituteId, currentClassId, currentSubjectId, { page: 1, limit: 1000, parent: false })
        : await instituteStudentsApi.getStudentsByClass(currentInstituteId, currentClassId, { page: 1, limit: 1000, parent: false });

      const next: Record<string, StudentListRecord> = {};
      for (const student of response.data ?? []) {
        next[student.id] = student;
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
      return;
    }

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
  }, [viewMode, viewLectureIds, currentInstituteId, currentClassId, currentSubjectId]);

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

    const fallbackStudents = viewGrid?.students?.length
      ? viewGrid.students
      : (sessionGrid?.students || []);

    // Dedupe fallback students by id and ensure imageUrl is present
    const dedupMap = new Map<string, any>();
    for (const s of fallbackStudents) {
      if (!s || !s.id) continue;
      if (!dedupMap.has(String(s.id))) {
        dedupMap.set(String(s.id), {
          id: String(s.id),
          name: s.name || String(s.id),
          instituteUserId: s.id,
          imageUrl: s.imageUrl ?? '',
        });
      }
    }

    return Array.from(dedupMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [studentDirectoryById, viewGrid, sessionGrid]);

  const gridLectureColumns = useMemo(
    () => selectedLectures.length > 0 ? selectedLectures : allLectures.filter(lecture => viewLectureIds.includes(lecture.id)),
    [selectedLectures, allLectures, viewLectureIds],
  );

  const activeSessionLecture = useMemo(
    () => (viewMode === 'grid' && gridLectureColumns.length === 1 ? gridLectureColumns[0] : null),
    [viewMode, gridLectureColumns],
  );

  const loadSessionGrid = useCallback(async () => {
    if (viewMode !== 'grid' || !activeSessionLecture || !currentInstituteId || !currentClassId) {
      setSessionGrid(null);
      return;
    }

    setLoadingSessionGrid(true);
    try {
      const grid = await lectureTrackingApi.getLiveAttendanceSessionGrid({
        lectureId: activeSessionLecture.id,
        classId: currentClassId,
        instituteId: currentInstituteId,
      });
      setSessionGrid(grid);
    } catch {
      setSessionGrid(null);
      toast.error('Failed to load live attendance sessions.');
    } finally {
      setLoadingSessionGrid(false);
    }
  }, [viewMode, activeSessionLecture?.id, currentInstituteId, currentClassId]);

  useEffect(() => { loadSessionGrid(); }, [loadSessionGrid]);

  const handleCreateSession = async () => {
    if (!activeSessionLecture) return;
    const seconds = Math.floor(Number(sessionDurationSeconds));
    if (!Number.isFinite(seconds) || seconds <= 0) {
      toast.error('Enter a valid duration in seconds.');
      return;
    }

    setCreatingSession(true);
    try {
      await lectureTrackingApi.createLiveAttendanceSession({
        lectureId: activeSessionLecture.id,
        validSeconds: seconds,
      });
      toast.success('Live attendance link created.');
      setCreateSessionOpen(false);
      await loadSessionGrid();
    } catch {
      toast.error('Failed to create live attendance link.');
    } finally {
      setCreatingSession(false);
    }
  };

  const handleCopySessionUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied.');
    } catch {
      toast.error('Failed to copy link.');
    }
  };

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

  if (viewMode === 'grid') {
    const sessionColumns = sessionGrid?.sessions ?? [];

    const attendanceRows = enrolledStudentsForView.map(student => {
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
        sessionCells: sessionColumns.map(session => {
          const cell = sessionGrid?.grid?.[student.id]?.[session.id];
          return {
            sessionId: session.id,
            marked: !!cell?.marked,
            markedAt: cell?.markedAt,
          };
        }),
      };
    });

    // Apply search & filters
    const matchesSearch = (row: any) => {
      if (!searchTerm) return true;
      const q = searchTerm.trim().toLowerCase();
      return (row.name || '').toLowerCase().includes(q)
        || (row.instituteUserId || '').toLowerCase().includes(q)
        || (row.id || '').toLowerCase().includes(q);
    };

    const matchesAttendanceFilter = (row: any) => {
      if (attendanceFilter === 'all') return true;
      const anyPresent = row.cells.some((c: any) => c.attended);
      return attendanceFilter === 'present' ? anyPresent : !anyPresent;
    };

    const matchesSessionFilter = (row: any) => {
      if (sessionFilter === 'all') return true;
      const anyMarked = row.sessionCells.some((s: any) => s.marked);
      return sessionFilter === 'marked' ? anyMarked : !anyMarked;
    };

    const filteredRows = attendanceRows.filter(row => matchesSearch(row) && matchesAttendanceFilter(row) && matchesSessionFilter(row));

    const presentCount = filteredRows.reduce((count, row) => {
      return count + row.cells.filter((cell: any) => cell.attended).length;
    }, 0);
    const totalSlots = filteredRows.length * Math.max(1, gridLectureColumns.length);
    const absentCount = totalSlots - presentCount;
    const attendancePercentage = totalSlots > 0 ? Math.round((presentCount / totalSlots) * 100) : 0;

    // reusable counts for filter UI (per-student and per-session)
    const totalStudents = attendanceRows.length;
    const presentStudents = attendanceRows.filter(r => r.cells.some((c: any) => c.attended)).length;
    const absentStudents = totalStudents - presentStudents;
    const sessionMarked = attendanceRows.filter(r => r.sessionCells.some((s: any) => s.marked)).length;
    const sessionNotMarked = totalStudents - sessionMarked;

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
            {gridLectureColumns[0] && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 hover:bg-primary/10"
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
            {activeSessionLecture && (
              <Button
                variant="default"
                size="sm"
                className="h-9 gap-2 ml-2"
                onClick={() => setCreateSessionOpen(true)}
              >
                <Link2 className="h-4 w-4" />
                <span className="text-xs">Collect Live Attendance</span>
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

          {/* Search & Filters (responsive) */}
          <div className="flex items-center gap-3 w-full">
            {/* Desktop: show full filters */}
            <div className="hidden md:flex items-center gap-3">
              <Input
                placeholder="Search students by name / institute id / system id"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-64"
              />

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Button size="sm" variant={attendanceFilter === 'all' ? 'default' : 'outline'} onClick={() => setAttendanceFilter('all')}>
                    All
                  </Button>
                  <Button size="sm" variant={attendanceFilter === 'present' ? 'default' : 'outline'} onClick={() => setAttendanceFilter('present')}>
                    Present
                  </Button>
                  <Button size="sm" variant={attendanceFilter === 'absent' ? 'default' : 'outline'} onClick={() => setAttendanceFilter('absent')}>
                    Absent
                  </Button>
                  <Badge className="text-[11px] ml-2">{presentStudents}P · {absentStudents}A</Badge>
                </div>

                <div className="flex items-center gap-1">
                  <Button size="sm" variant={sessionFilter === 'all' ? 'default' : 'outline'} onClick={() => setSessionFilter('all')}>
                    Session: All
                  </Button>
                  <Button size="sm" variant={sessionFilter === 'marked' ? 'default' : 'outline'} onClick={() => setSessionFilter('marked')}>
                    Marked
                  </Button>
                  <Button size="sm" variant={sessionFilter === 'not_marked' ? 'default' : 'outline'} onClick={() => setSessionFilter('not_marked')}>
                    Not marked
                  </Button>
                  <Badge className="text-[11px] ml-2">{sessionMarked}M · {sessionNotMarked}NM</Badge>
                </div>
              </div>

              <Button size="sm" variant="ghost" onClick={() => { setSearchTerm(''); setAttendanceFilter('all'); setSessionFilter('all'); }}>
                Clear
              </Button>
            </div>

            {/* Mobile: compact search + Filters sheet trigger */}
            <div className="flex md:hidden items-center gap-2 w-full">
              <Input
                placeholder="Search"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Button size="sm" onClick={() => setShowFilterSheet(true)}>
                Filters
                <Badge className="ml-2 text-[11px]">{presentStudents}P</Badge>
              </Button>
            </div>

            {/* Mobile filters sheet */}
            <Sheet open={showFilterSheet} onOpenChange={setShowFilterSheet}>
              <SheetContent side="bottom" className="w-full sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription className="text-xs">Search and filter attendance</SheetDescription>
                </SheetHeader>
                <div className="p-4 space-y-3">
                  <Input
                    placeholder="Search students by name / institute id / system id"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={attendanceFilter === 'all' ? 'default' : 'outline'} onClick={() => setAttendanceFilter('all')}>
                      All
                    </Button>
                    <Button size="sm" variant={attendanceFilter === 'present' ? 'default' : 'outline'} onClick={() => setAttendanceFilter('present')}>
                      Present
                    </Button>
                    <Button size="sm" variant={attendanceFilter === 'absent' ? 'default' : 'outline'} onClick={() => setAttendanceFilter('absent')}>
                      Absent
                    </Button>
                    <Badge className="text-[11px] ml-2">{presentStudents}P · {absentStudents}A</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={sessionFilter === 'all' ? 'default' : 'outline'} onClick={() => setSessionFilter('all')}>
                      Session: All
                    </Button>
                    <Button size="sm" variant={sessionFilter === 'marked' ? 'default' : 'outline'} onClick={() => setSessionFilter('marked')}>
                      Marked
                    </Button>
                    <Button size="sm" variant={sessionFilter === 'not_marked' ? 'default' : 'outline'} onClick={() => setSessionFilter('not_marked')}>
                      Not marked
                    </Button>
                    <Badge className="text-[11px] ml-2">{sessionMarked}M · {sessionNotMarked}NM</Badge>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" variant="ghost" onClick={() => { setSearchTerm(''); setAttendanceFilter('all'); setSessionFilter('all'); setShowFilterSheet(false); }}>
                      Clear
                    </Button>
                    <Button size="sm" className="ml-2" onClick={() => setShowFilterSheet(false)}>Done</Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

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
                        {sessionColumns.map((session, idx) => (
                          <TableHead key={session.id} className="text-center min-w-[140px] text-xs font-semibold text-muted-foreground">
                            <div className="flex flex-col items-center gap-1">
                              <div className="text-[10px] font-semibold">Session {idx + 1}</div>
                              <div className="flex items-center gap-1">
                                <Badge variant={session.isExpired ? 'destructive' : 'secondary'} className="text-[9px]">
                                  {session.isExpired ? 'Expired' : 'Active'}
                                </Badge>
                                {session.markedCount != null && (
                                  <span className="text-[9px] text-muted-foreground/70">{session.markedCount} marked</span>
                                )}
                              </div>
                              {session.createdAt && (
                                <div className="text-[9px] text-muted-foreground/70">
                                  {new Date(session.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </div>
                              )}
                              {session.publicUrl && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => handleCopySessionUrl(session.publicUrl)}
                                  aria-label={`Copy session ${idx + 1} link`}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((row, idx) => (
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

                          {/* Lecture attendance cells (per selected lecture columns) */}
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

                          {/* Session mark columns */}
                          {row.sessionCells.map(cell => (
                            <TableCell key={cell.sessionId} className="text-center p-2">
                              <div className={`inline-flex flex-col items-center justify-center gap-1 min-h-[46px] px-2 py-1 rounded-lg border ${
                                cell.marked ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-50 border border-slate-200'
                              }`}>
                                {cell.marked ? (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    <span className="text-[10px] font-semibold text-emerald-700">Present</span>
                                    {cell.markedAt && (
                                      <span className="text-[9px] text-emerald-600/70">{new Date(cell.markedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-4 w-4 text-slate-500" />
                                    <span className="text-[10px] font-semibold text-slate-700">Not Marked</span>
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

          {/* Live Attendance Links */}
          <Dialog open={createSessionOpen} onOpenChange={setCreateSessionOpen} routeName="create-live-attendance-link-popup">
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>Create Live Attendance Link</DialogTitle>
                <DialogDescription>
                  Generate a time-limited link for students to mark attendance once.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label>Valid for (seconds)</Label>
                  <Input
                    type="number"
                    min={5}
                    value={sessionDurationSeconds}
                    onChange={(e) => setSessionDurationSeconds(Number(e.target.value))}
                  />
                  <p className="text-[10px] text-muted-foreground">Example: 300 seconds = 5 minutes.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateSessionOpen(false)} disabled={creatingSession}>Cancel</Button>
                <Button onClick={handleCreateSession} disabled={creatingSession || !activeSessionLecture}>
                  {creatingSession ? 'Creating...' : 'Create Link'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Live Attendance Links card removed — session columns are integrated into the main table */}
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
