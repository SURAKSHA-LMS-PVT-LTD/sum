import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft, Calendar, Users,
  Loader2, RefreshCw, Clock, FileDown, CheckCircle2, XCircle,
} from 'lucide-react';
import { buildSidebarUrl } from '@/utils/pageNavigation';
import { useContextUrlSync } from '@/utils/pageNavigation';
import PageContainer from '@/components/layout/PageContainer';
import LiveAttendanceReportingDialog from '@/components/attendance/LiveAttendanceReportingDialog';
import { toast } from 'sonner';
import { getImageUrl } from '@/utils/imageUrlHelper';
import SessionViewerDialog from '@/components/dialogs/SessionViewerDialog';

export default function LectureAttendanceLivePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedInstitute, selectedClass, selectedSubject, currentInstituteId, currentClassId, currentSubjectId } = useAuth();

  useContextUrlSync('lecture-live-attendance');

  // ─── State Management ───────────────────────────────────────────────────────┘

  const [classLectures, setClassLectures] = useState<Lecture[]>([]);
  const [subjectLectures, setSubjectLectures] = useState<Lecture[]>([]);
  const [loadingLectures, setLoadingLectures] = useState(false);
  const [studentDirectoryById, setStudentDirectoryById] = useState<Record<string, StudentListRecord>>({});
  const [loadingStudentDirectory, setLoadingStudentDirectory] = useState(false);
  const [reportGrid, setReportGrid] = useState<AttendanceGridResult | null>(null);
  const [reportLectures, setReportLectures] = useState<Lecture[]>([]);
  const [loadingReportLectureId, setLoadingReportLectureId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [viewGrid, setViewGrid] = useState<AttendanceGridResult | null>(null);
  const [loadingViewGrid, setLoadingViewGrid] = useState(false);
  const [sessionViewerOpen, setSessionViewerOpen] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<{ joinTime?: string }[]>([]);
  const [selectedStudentName, setSelectedStudentName] = useState('');
  const [selectedLectureTitle, setSelectedLectureTitle] = useState('');

  // ─── URL Params & Derived State ───────────────────────────────────────────┘

  const viewMode = searchParams.get('view') === 'grid' ? 'grid' : 'list';
  const lectureIdsParam = searchParams.get('lectureIds') || '';
  const viewLectureIds = useMemo(() => lectureIdsParam.split(',').map(id => id.trim()).filter(Boolean), [lectureIdsParam]);

  // ─── Data Fetching ────────────────────────────────────────────────────────┘

  const fetchLectures = useCallback(async (forceRefresh = false) => {
    if (!currentInstituteId || !currentClassId) return;
    setLoadingLectures(true);
    try {
      const lectures = currentSubjectId
        ? (await lectureApi.getLectures({ instituteId: currentInstituteId, classId: currentClassId, subjectId: currentSubjectId }, forceRefresh)).data
        : (await lectureApi.getLectures({ classId: currentClassId, instituteId: currentInstituteId }, forceRefresh)).data;
      setClassLectures(currentSubjectId ? [] : lectures || []);
      setSubjectLectures(currentSubjectId ? lectures || [] : []);
    } catch {
      setClassLectures([]);
      setSubjectLectures([]);
    } finally {
      setLoadingLectures(false);
    }
  }, [currentInstituteId, currentClassId, currentSubjectId]);

  useEffect(() => { fetchLectures(); }, [fetchLectures]);

  const allLectures = useMemo(() => [...classLectures, ...subjectLectures], [classLectures, subjectLectures]);

  const sortedLectures = useMemo(
    () => [...allLectures].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')),
    [allLectures],
  );

  const lecturesByDate = useMemo(() => {
    const reversed = [...sortedLectures].reverse();
    return reversed.reduce<Record<string, Lecture[]>>((acc, lecture) => {
      const key = lecture.startTime ? new Date(lecture.startTime).toISOString().slice(0, 10) : 'No Date';
      (acc[key] = acc[key] ?? []).push(lecture);
      return acc;
    }, {});
  }, [sortedLectures]);

  const sortedDates = useMemo(() => Object.keys(lecturesByDate).sort((a, b) => b.localeCompare(a)), [lecturesByDate]);

  const selectedLectures = useMemo(
    () => sortedLectures.filter(lecture => viewLectureIds.includes(lecture.id)),
    [sortedLectures, viewLectureIds],
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
      const next = Object.fromEntries((response.data || []).map(s => [s.id, s]));
      setStudentDirectoryById(next);
    } catch {
      setStudentDirectoryById({});
    } finally {
      setLoadingStudentDirectory(false);
    }
  }, [currentInstituteId, currentClassId, currentSubjectId]);

  useEffect(() => { fetchStudentDirectory(); }, [fetchStudentDirectory]);

  const loadGridForView = useCallback(async (forceRefresh = false) => {
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
      }, forceRefresh);
      setViewGrid(grid);
    } catch {
      setViewGrid(null);
      toast.error('Failed to load attendance grid for this lecture.');
    } finally {
      setLoadingViewGrid(false);
    }
  }, [viewMode, viewLectureIds, currentInstituteId, currentClassId, currentSubjectId]);

  useEffect(() => { loadGridForView(); }, [loadGridForView]);

  // ─── UI Actions & Navigation ──────────────────────────────────────────────┘

  const setSearchParam = (key: string, value: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value === null) next.delete(key); else next.set(key, value);
      return next;
    }, { replace: true });
  };

  const toggleLectureSelection = (lectureId: string) => {
    const ids = new Set(viewLectureIds);
    if (ids.has(lectureId)) ids.delete(lectureId); else ids.add(lectureId);
    setSearchParam('lectureIds', ids.size > 0 ? Array.from(ids).join(',') : null);
    setSearchParam('lectureId', null);
  };

  const selectAllLectures = () => setSearchParam('lectureIds', allLectures.map(l => l.id).join(','));
  const clearLectureSelection = () => setSearchParam('lectureIds', null);
  const goBackToLectureList = () => setSearchParam('view', null);

  const openGridView = (lectureId: string) => {
    const ids = new Set(viewLectureIds);
    ids.add(lectureId);
    setSearchParam('lectureIds', Array.from(ids).join(','));
    setSearchParam('view', 'grid');
  };

  const openReportingForLecture = async (lecture: Lecture, forceRefresh = false) => {
    if (!currentInstituteId || !currentClassId) return;
    setLoadingReportLectureId(lecture.id);
    try {
      const grid = await lectureTrackingApi.getAttendanceGrid({ lectureIds: [lecture.id], classId: currentClassId, instituteId: currentInstituteId, includeSubjectLectures: !!currentSubjectId }, forceRefresh);
      setReportGrid(grid);
      setReportLectures([lecture]);
      setReportOpen(true);
    } catch {
      toast.error('Failed to prepare report data.');
    } finally {
      setLoadingReportLectureId(null);
    }
  };

  const openGridReport = () => {
    if (!viewGrid) {
      toast.error('Attendance data not loaded.');
      return;
    }
    setReportGrid(viewGrid);
    setReportLectures(selectedLectures);
    setReportOpen(true);
  };

  const goBack = () => navigate(buildSidebarUrl('dashboard', { instituteId: currentInstituteId, classId: currentClassId, subjectId: currentSubjectId }));

  const openSessionViewer = (sessions: { joinTime?: string }[], studentName: string, lectureTitle: string) => {
    setSelectedSessions(sessions);
    setSelectedStudentName(studentName);
    setSelectedLectureTitle(lectureTitle);
    setSessionViewerOpen(true);
  };

  // ─── Grid View Data Processing ────────────────────────────────────────────┘

  const enrolledStudentsForView = useMemo(() => {
    return Object.values(studentDirectoryById)
      .map(student => ({ id: student.id, name: student.name, instituteUserId: student.userIdByInstitute || student.id, imageUrl: student.imageUrl || '' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [studentDirectoryById]);

  const attendanceRows = useMemo(() => {
    if (!viewGrid) return [];
    return enrolledStudentsForView.map(student => {
      const cells = selectedLectures.map(lecture => {
        const cell = viewGrid.grid?.[student.id]?.[lecture.id];
        const sessionList = Array.isArray(cell?.sessions) ? cell.sessions : [];
        const fallbackSessions = cell && sessionList.length === 0 ? [cell] : [];
        const sessions = sessionList.length > 0 ? sessionList : fallbackSessions;
        const sortedSessions = [...sessions].sort((a, b) => (a.joinTime || '').localeCompare(b.joinTime || ''));
        const attended = !!cell?.attended || sortedSessions.length > 0;
        const joinTime = cell?.joinTime ?? sortedSessions[0]?.joinTime;
        const durationSum = sortedSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
        const durationMinutes = cell?.durationMinutes ?? durationSum;
        const joinCount = cell?.joinCount ?? sortedSessions.length;
        return {
          lectureId: lecture.id,
          attended,
          joinTime,
          durationMinutes,
          sessions: sortedSessions,
          joinCount,
        };
      });
      const presentCount = cells.filter(c => c.attended).length;
      const total = selectedLectures.length;
      const percentage = total > 0 ? Math.round((presentCount / total) * 100) : 0;
      return { ...student, cells, summary: { present: presentCount, absent: total - presentCount, total, percentage } };
    });
  }, [enrolledStudentsForView, selectedLectures, viewGrid]);

  // ─── Render Logic ───────────────────────────────────────────────────────────┘

  if (!selectedInstitute || !selectedClass) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Calendar className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Select a class to view live lecture attendance.</p>
      </div>
    );
  }

  if (viewMode === 'grid') {
    const overallPresent = attendanceRows.reduce((sum, row) => sum + row.summary.present, 0);
    const overallTotal = attendanceRows.length * selectedLectures.length;
    const overallAbsent = overallTotal - overallPresent;
    const overallPercentage = overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 0;

    const getProgressColor = (p: number) => p > 75 ? 'bg-green-600' : p > 40 ? 'bg-yellow-500' : 'bg-red-600';

    return (
      <PageContainer maxWidth="full" className="h-full">
        <SessionViewerDialog
          open={sessionViewerOpen}
          onOpenChange={setSessionViewerOpen}
          sessions={selectedSessions}
          studentName={selectedStudentName}
          lectureTitle={selectedLectureTitle}
        />
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={goBackToLectureList} className="rounded-full shrink-0 h-8 w-8 hover:bg-primary/10"><ArrowLeft className="h-4 w-4" /></Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Attendance Overview</h1>
              <p className="text-sm text-muted-foreground mt-1">{selectedLectures.length} lectures • {selectedClass.name}{selectedSubject ? ` • ${selectedSubject.name}` : ''}</p>
            </div>
            {selectedLectures.length > 0 && <Button variant="outline" size="sm" className="h-9 gap-2 hover:bg-primary/10" onClick={() => openGridReport(true)}><FileDown className="h-4 w-4" /><span className="text-xs">Export Report</span></Button>}
          </div>

          <LiveAttendanceReportingDialog open={reportOpen} onOpenChange={setReportOpen} grid={reportGrid} selectedLectures={reportLectures} className={selectedClass.name} studentDirectoryById={studentDirectoryById} />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-green-500/10 to-green-500/5 hover:shadow-md"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Present</p><p className="text-2xl font-bold text-green-600 mt-1">{overallPresent}</p></div><CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" /></div></CardContent></Card>
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-red-500/10 to-red-500/5 hover:shadow-md"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Absent</p><p className="text-2xl font-bold text-red-600 mt-1">{overallAbsent}</p></div><XCircle className="h-8 w-8 text-red-500 opacity-50" /></div></CardContent></Card>
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-blue-500/10 to-blue-500/5 hover:shadow-md"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Attendance Rate</p><p className="text-2xl font-bold text-blue-600 mt-1">{overallPercentage}%</p></div><div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center"><span className="text-xs font-bold text-blue-600">{overallPercentage}%</span></div></div></CardContent></Card>
            <Card className="overflow-hidden border-0 bg-gradient-to-br from-purple-500/10 to-purple-500/5 hover:shadow-md"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Slots</p><p className="text-2xl font-bold text-purple-600 mt-1">{overallTotal}</p></div><Users className="h-8 w-8 text-purple-500 opacity-50" /></div></CardContent></Card>
          </div>

          <Card className="overflow-hidden border-0 shadow-md">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-b pb-4">
              <CardTitle className="text-base flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Student Attendance Details</CardTitle>
              <CardDescription className="text-xs mt-2">{attendanceRows.length} students across {selectedLectures.length} lectures</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingViewGrid ? <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : attendanceRows.length === 0 ? <div className="py-12 px-4 text-center"><Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-sm text-muted-foreground">No enrolled students found.</p></div> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow className="bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-50"><TableHead className="sticky left-0 bg-slate-50 dark:bg-slate-900/50 z-10 w-[280px]">Student</TableHead><TableHead className="w-[180px]">Summary</TableHead>{selectedLectures.map(lecture => <TableHead key={lecture.id} className="text-center min-w-[140px]"><div className="truncate max-w-[130px] mx-auto font-semibold" title={lecture.title}>{lecture.title}</div>{lecture.startTime && <div className="text-[10px] text-muted-foreground/70 font-normal mt-0.5">{new Date(lecture.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>}</TableHead>)}</TableRow></TableHeader>
                    <TableBody>
                      {attendanceRows.map((row, idx) => (
                        <TableRow key={row.id} className={`hover:bg-slate-50 dark:hover:bg-slate-900/30 ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900/10' : ''}`}>
                          <TableCell className="sticky left-0 z-10 font-medium text-xs bg-white dark:bg-slate-900/30"><div className="flex items-center gap-3"><Avatar className="h-8 w-8 ring-2 ring-primary/20"><AvatarImage src={getImageUrl(row.imageUrl)} alt={row.name} /><AvatarFallback className="text-[10px]">{row.name.split(' ').filter(Boolean).map(p => p[0]).slice(0, 2).join('').toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><div className="truncate font-semibold text-foreground">{row.name}</div><div className="text-[10px] text-muted-foreground/60 truncate">ID: {row.id.slice(0, 8)}</div></div></div></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs font-semibold">{row.summary.percentage}%</span>
                                  <span className="text-[10px] text-muted-foreground">P: {row.summary.present} / A: {row.summary.absent}</span>
                                </div>
                                <Progress value={row.summary.percentage} className={`h-1.5 ${getProgressColor(row.summary.percentage)}`} />
                              </div>
                            </div>
                          </TableCell>
                          {row.cells.map((cell, cellIdx) => (
                            <TableCell key={cell.lectureId} className="text-center p-2" onClick={() => cell.attended && openSessionViewer(cell.sessions, row.name, selectedLectures[cellIdx].title)}>
                              <div className={`inline-flex flex-col items-center justify-center gap-1 min-h-[50px] px-2 py-1 rounded-lg w-[100px] transition-all ${cell.attended ? 'bg-green-500/15 border border-green-500/30' : 'bg-red-500/10 border border-red-500/20'}`}>
                                {cell.attended ? <><CheckCircle2 className="h-4 w-4 text-green-600" /><span className="text-[10px] font-semibold text-green-700">{cell.joinTime ? new Date(cell.joinTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Present'}</span>{cell.joinCount > 1 && <Badge variant="secondary" className="mt-1">{cell.joinCount} joins</Badge>}</> : <><XCircle className="h-4 w-4 text-red-500" /><span className="text-[10px] font-semibold text-red-600">Absent</span></>}
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
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border border-primary/10">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={goBack} className="rounded-full shrink-0 h-9 w-9 hover:bg-primary/10"><ArrowLeft className="h-4 w-4" /></Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">Live Session Attendance</h1>
              <p className="text-sm text-muted-foreground mt-2">Track attendance for {selectedClass.name}{selectedSubject ? ` • ${selectedSubject.name}` : ''}</p>
            </div>
            <Button variant="outline" size="sm" className="h-9 gap-2 hover:bg-primary/10" onClick={() => fetchLectures(true)} disabled={loadingLectures}><RefreshCw className={`h-4 w-4 ${loadingLectures ? 'animate-spin' : ''}`} /><span className="hidden sm:inline text-xs">Refresh</span></Button>
          </div>
        </div>

        <LiveAttendanceReportingDialog open={reportOpen} onOpenChange={setReportOpen} grid={reportGrid} selectedLectures={reportLectures} className={selectedClass.name} studentDirectoryById={studentDirectoryById} />

        <Card className="overflow-hidden border-0 shadow-md bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" />Lecture Selection</CardTitle><CardDescription className="text-xs">{allLectures.length} total lectures • {viewLectureIds.length} selected</CardDescription></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant={viewLectureIds.length === allLectures.length && allLectures.length > 0 ? 'default' : 'outline'} size="sm" className="h-8 text-xs" onClick={selectAllLectures} disabled={allLectures.length === 0}>Select All</Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={clearLectureSelection} disabled={viewLectureIds.length === 0}>Clear Selection</Button>
              <Button variant="default" size="sm" className="h-8 text-xs gap-1 ml-auto" onClick={() => setSearchParam('view', 'grid')} disabled={viewLectureIds.length === 0}><Users className="h-3.5 w-3.5" />Compare Grid {viewLectureIds.length > 1 && `(${viewLectureIds.length})`}</Button>
            </div>
            {viewLectureIds.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{selectedLectures.map(lecture => <Badge key={lecture.id} variant="secondary" className="text-xs py-1 px-3 cursor-pointer" onClick={() => toggleLectureSelection(lecture.id)}>{lecture.title}<span className="ml-1.5 opacity-70">✕</span></Badge>)}</div>}
          </CardContent>
        </Card>

        {sortedDates.length === 0 && !loadingLectures ? (
          <Card className="overflow-hidden border-0 shadow-md"><CardContent className="py-16 px-4 text-center"><Calendar className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" /><p className="text-sm font-medium">No lectures yet</p><p className="text-xs text-muted-foreground">No live-tracked lectures found for this context.</p></CardContent></Card>
        ) : (
          <div className="space-y-6">
            {sortedDates.map(date => (
              <div key={date}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1"><div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/10"><Calendar className="h-4 w-4 text-primary" /><span className="text-sm font-semibold text-foreground">{date === 'No Date' ? 'No Date' : new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div></div>
                  <span className="text-xs text-muted-foreground font-medium">{lecturesByDate[date].length} lecture{lecturesByDate[date].length === 1 ? '' : 's'}</span>
                </div>
                <div className="space-y-2">
                  {lecturesByDate[date].map(lecture => {
                    const selected = viewLectureIds.includes(lecture.id);
                    return (
                      <Card key={lecture.id} onClick={() => toggleLectureSelection(lecture.id)} className={`overflow-hidden transition-all duration-200 cursor-pointer border-0 shadow-md hover:shadow-lg ${selected ? 'ring-2 ring-primary bg-gradient-to-br from-primary/10 to-primary/5' : 'bg-white dark:bg-slate-900'}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Checkbox checked={selected} onCheckedChange={() => toggleLectureSelection(lecture.id)} onClick={e => e.stopPropagation()} className="h-5 w-5 shrink-0" />
                              <div className="min-w-0 flex-1"><div className="font-semibold text-sm truncate">{lecture.title}</div></div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-lg shrink-0"><Clock className="h-3.5 w-3.5" /><span>{lecture.startTime ? new Date(lecture.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No time'}</span></div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={e => { e.stopPropagation(); openGridView(lecture.id); }}><Users className="h-3.5 w-3.5" />View</Button>
                              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={e => { e.stopPropagation(); openReportingForLecture(lecture, true); }} disabled={loadingReportLectureId === lecture.id}>{loadingReportLectureId === lecture.id ? <Loader2 className="h-3.5 w-3.s h-3.5 w-3.5 animate-spin" /> : <><FileDown className="h-3.5 w-3.5" />Export</>}</Button>
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
