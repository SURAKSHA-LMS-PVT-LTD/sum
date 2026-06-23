import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  FileDown, Calendar, CheckCircle2, XCircle, Users, PlayCircle,
  ChevronDown, ChevronRight, Clock, Loader2, Download,
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { useAuth } from '@/contexts/AuthContext';
import { lectureApi, Lecture } from '@/api/lecture.api';
import {
  lectureTrackingApi,
  AttendanceGridResult,
  LiveAttendanceRow,
  RecordingSessionRow,
} from '@/api/lectureTracking.api';

export default function LectureAttendanceReportPage() {
  const { selectedInstitute, selectedClass, selectedSubject } = useAuth();

  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingLectures, setLoadingLectures] = useState(false);

  // Grid
  const [grid, setGrid] = useState<AttendanceGridResult | null>(null);
  const [loadingGrid, setLoadingGrid] = useState(false);

  // Per-lecture live report
  const [liveReport, setLiveReport] = useState<Record<string, LiveAttendanceRow[]>>({});
  const [loadingLive, setLoadingLive] = useState<Record<string, boolean>>({});

  // Per-lecture recording report
  const [recReport, setRecReport] = useState<Record<string, RecordingSessionRow[]>>({});
  const [loadingRec, setLoadingRec] = useState<Record<string, boolean>>({});
  const [expandedRecSessions, setExpandedRecSessions] = useState<Record<string, boolean>>({});

  const [includeSubject, setIncludeSubject] = useState(() => !!selectedSubject?.id);

  // ── Load lectures ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedInstitute?.id || !selectedClass?.id) return;
    setLoadingLectures(true);
    setSelectedIds([]);
    setGrid(null);

    const fetchAll = async () => {
      try {
        const clsRes = await lectureApi.getLectures({
          classId: selectedClass.id.toString(), instituteId: selectedInstitute.id.toString(),
        });
        const classDat: Lecture[] = (clsRes as any)?.data ?? [];
        const tracked = classDat.filter(l => l.liveAttendanceEnabled || l.recAttendanceEnabled);

        if (includeSubject && selectedSubject?.id) {
          const subjRes = await lectureApi.getLectures({
            instituteId: selectedInstitute.id.toString(),
            classId: selectedClass.id.toString(),
            subjectId: selectedSubject.id.toString(),
          });
          const subjTracked = ((subjRes as any)?.data ?? []).filter(
            (l: Lecture) => l.liveAttendanceEnabled || l.recAttendanceEnabled,
          );
          setLectures([...tracked, ...subjTracked]);
        } else {
          setLectures(tracked);
        }
      } catch {
        setLectures([]);
      } finally {
        setLoadingLectures(false);
      }
    };
    fetchAll();
  }, [selectedInstitute, selectedClass, selectedSubject, includeSubject]);

  // ── Load attendance grid when selection changes ────────────────────────────

  const loadGrid = useCallback(async () => {
    if (!selectedInstitute?.id || !selectedClass?.id || selectedIds.length === 0) {
      setGrid(null);
      return;
    }
    setLoadingGrid(true);
    try {
      const data = await lectureTrackingApi.getAttendanceGrid({
        lectureIds: selectedIds,
        classId: selectedClass.id.toString(),
        instituteId: selectedInstitute.id.toString(),
        includeSubjectLectures: includeSubject,
      });
      setGrid(data);
    } catch {
      setGrid(null);
    } finally {
      setLoadingGrid(false);
    }
  }, [selectedIds, selectedInstitute, selectedClass, includeSubject]);

  useEffect(() => { loadGrid(); }, [loadGrid]);

  // ── Per-lecture live report ────────────────────────────────────────────────

  const loadLiveReport = async (lectureId: string) => {
    if (liveReport[lectureId] || loadingLive[lectureId]) return;
    setLoadingLive(p => ({ ...p, [lectureId]: true }));
    try {
      const rows = await lectureTrackingApi.getLiveAttendanceReport(lectureId);
      setLiveReport(p => ({ ...p, [lectureId]: rows }));
    } catch {
      setLiveReport(p => ({ ...p, [lectureId]: [] }));
    } finally {
      setLoadingLive(p => ({ ...p, [lectureId]: false }));
    }
  };

  // ── Per-lecture recording report ───────────────────────────────────────────

  const loadRecReport = async (lectureId: string) => {
    if (recReport[lectureId] || loadingRec[lectureId]) return;
    setLoadingRec(p => ({ ...p, [lectureId]: true }));
    try {
      const rows = await lectureTrackingApi.getRecordingActivityReport(lectureId);
      setRecReport(p => ({ ...p, [lectureId]: rows }));
    } catch {
      setRecReport(p => ({ ...p, [lectureId]: [] }));
    } finally {
      setLoadingRec(p => ({ ...p, [lectureId]: false }));
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const toggleLecture = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const selectAll = () => setSelectedIds(lectures.map(l => l.id));
  const clearAll  = () => setSelectedIds([]);

  const selectedLectures = lectures.filter(l => selectedIds.includes(l.id));

  const exportToExcel = async () => {
    if (!grid) return;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Lecture Attendance');

    const XLSX_BORDER_STYLE = {
      top: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin' as const, color: { argb: 'FFD1D5DB' } },
    };

    // Header row
    const headers = ['Student Name', ...selectedLectures.map(l => l.title), 'Attended', '%'];
    const hRow = worksheet.addRow(headers);
    hRow.height = 24;
    hRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = XLSX_BORDER_STYLE;
    });

    grid.students.forEach((s, idx) => {
      let attendedCount = 0;
      const statusValues = selectedLectures.map(l => {
        const hasAttended = grid.grid[s.id]?.[l.id]?.attended;
        if (hasAttended) attendedCount++;
        return hasAttended ? 'P' : 'A';
      });

      const pct = selectedLectures.length ? Math.round((attendedCount / selectedLectures.length) * 100) : 0;
      const row = worksheet.addRow([
        s.name,
        ...statusShorts(statusValues),
        attendedCount,
        `${pct}%`,
      ]);
      row.height = 20;
      row.eachCell(cell => {
        cell.border = XLSX_BORDER_STYLE;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };

      // Coloring
      statusValues.forEach((st, sIdx) => {
        const cell = row.getCell(2 + sIdx);
        if (st === 'P') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F7ED' } };
          cell.font = { bold: true, color: { argb: 'FF166534' } };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE8E8' } };
          cell.font = { bold: true, color: { argb: 'FFB91C1C' } };
        }
      });

      const rateCell = row.getCell(2 + selectedLectures.length + 1);
      const isGood = pct >= 75;
      const isMid = pct >= 50;
      rateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isGood ? 'FFE8F7ED' : isMid ? 'FFFFF4D6' : 'FFFDE8E8' } };
      rateCell.font = { bold: true, color: { argb: isGood ? 'FF166534' : isMid ? 'FF92400E' : 'FFB91C1C' } };
    });

    worksheet.columns = [
      { width: 30 },
      ...selectedLectures.map(() => ({ width: 15 })),
      { width: 10 },
      { width: 10 },
    ];
    worksheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lecture_attendance_${selectedClass?.name || 'report'}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusShorts = (vals: string[]) => vals;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!selectedInstitute?.id || !selectedClass?.id) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Select an institute and class to view lecture attendance.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lecture Attendance</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {selectedClass.name}{selectedSubject ? ` · ${selectedSubject.name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <Checkbox
              checked={includeSubject}
              onCheckedChange={v => setIncludeSubject(!!v)}
            />
            Include subject lectures
          </label>
          <Button variant="outline" size="sm" onClick={exportToExcel} disabled={!grid}>
            <Download className="h-4 w-4 mr-2" />Export Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: lecture list */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Lectures</CardTitle>
            <CardDescription className="text-xs">Select to include in grid</CardDescription>
            <div className="flex gap-2 mt-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>All</Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAll}>None</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[480px] overflow-y-auto pr-1">
            {loadingLectures ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : lectures.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No tracked lectures found.
              </p>
            ) : (
              lectures.map(lec => (
                <div
                  key={lec.id}
                  className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleLecture(lec.id)}
                >
                  <Checkbox
                    checked={selectedIds.includes(lec.id)}
                    onCheckedChange={() => toggleLecture(lec.id)}
                    onClick={e => e.stopPropagation()}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{lec.title}</p>
                    <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                      {lec.liveAttendanceEnabled && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">Live</Badge>
                      )}
                      {lec.recAttendanceEnabled && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1">Rec</Badge>
                      )}
                      {lec.startTime && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(lec.startTime).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Main content */}
        <div className="lg:col-span-3 space-y-6">
          <Tabs defaultValue="grid">
            <TabsList>
              <TabsTrigger value="grid">
                <Users className="h-4 w-4 mr-1.5" />Attendance Grid
              </TabsTrigger>
              <TabsTrigger value="live">
                <Calendar className="h-4 w-4 mr-1.5" />Live Reports
              </TabsTrigger>
              <TabsTrigger value="recording">
                <PlayCircle className="h-4 w-4 mr-1.5" />Recording Reports
              </TabsTrigger>
            </TabsList>

            {/* ── Attendance Grid ── */}
            <TabsContent value="grid">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Attendance Grid</CardTitle>
                  {grid && (
                    <CardDescription className="text-xs">
                      {grid.students.length} students · {selectedLectures.length} lectures
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {selectedIds.length === 0 ? (
                    <EmptyState icon={<Calendar className="h-8 w-8 opacity-20" />}
                      message="Select one or more lectures to view the grid" />
                  ) : loadingGrid ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : !grid ? (
                    <EmptyState icon={<XCircle className="h-8 w-8 opacity-20" />}
                      message="Could not load attendance data" />
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="sticky left-0 bg-muted/50 z-10 w-[180px] text-xs">Student</TableHead>
                            {selectedLectures.map(lec => (
                              <TableHead key={lec.id} className="text-center min-w-[100px] text-xs">
                                <div className="font-medium truncate max-w-[90px]" title={lec.title}>{lec.title}</div>
                                {lec.startTime && (
                                  <div className="text-[10px] text-muted-foreground font-normal">
                                    {new Date(lec.startTime).toLocaleDateString()}
                                  </div>
                                )}
                              </TableHead>
                            ))}
                            <TableHead className="text-center w-[60px] text-xs">%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {grid.students.map(s => {
                            const attended = selectedLectures.filter(
                              l => grid.grid[s.id]?.[l.id]?.attended,
                            ).length;
                            const pct = selectedLectures.length > 0
                              ? Math.round((attended / selectedLectures.length) * 100) : 0;
                            return (
                              <TableRow key={s.id}>
                                <TableCell className="sticky left-0 bg-background z-10 text-xs font-medium">
                                  {s.name}
                                </TableCell>
                                {selectedLectures.map(lec => {
                                  const cell = grid.grid[s.id]?.[lec.id];
                                  return (
                                    <TableCell key={lec.id} className="text-center p-1">
                                      <TooltipProvider delayDuration={300}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="inline-flex justify-center">
                                              {cell?.attended
                                                ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                : <XCircle className="h-4 w-4 text-muted-foreground/30" />}
                                            </span>
                                          </TooltipTrigger>
                                          {cell?.attended && (
                                            <TooltipContent className="text-xs">
                                              {(cell.loginCount ?? 1) > 1 && <div className="font-semibold text-amber-600">{cell.loginCount} logins</div>}
                                              {cell.joinTime && <div>First join: {new Date(cell.joinTime).toLocaleTimeString()}</div>}
                                              {cell.durationMinutes != null && <div>Total: {fmtMinutes(cell.durationMinutes)}</div>}
                                            </TooltipContent>
                                          )}
                                        </Tooltip>
                                      </TooltipProvider>
                                    </TableCell>
                                  );
                                })}
                                <TableCell className="text-center">
                                  <span className={`text-xs font-medium ${pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                                    {pct}%
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Live Attendance Reports ── */}
            <TabsContent value="live" className="space-y-4">
              {lectures.filter(l => l.liveAttendanceEnabled).length === 0 ? (
                <EmptyState icon={<Calendar className="h-8 w-8 opacity-20" />}
                  message="No live-tracked lectures in the current selection" />
              ) : (
                lectures.filter(l => l.liveAttendanceEnabled).map(lec => (
                  <Card key={lec.id}>
                    <CardHeader
                      className="cursor-pointer pb-2"
                      onClick={() => loadLiveReport(lec.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">{lec.title}</CardTitle>
                          {lec.startTime && (
                            <CardDescription className="text-xs">
                              {new Date(lec.startTime).toLocaleString()}
                            </CardDescription>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); loadLiveReport(lec.id); }}>
                          {loadingLive[lec.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Load'}
                        </Button>
                      </div>
                    </CardHeader>
                    {liveReport[lec.id] && (
                      <CardContent>
                        {liveReport[lec.id].length === 0 ? (
                          <p className="text-xs text-muted-foreground">No attendance recorded yet.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50">
                                  <TableHead className="text-xs">Name</TableHead>
                                  <TableHead className="text-xs">Type</TableHead>
                                  <TableHead className="text-xs text-center">Logins</TableHead>
                                  <TableHead className="text-xs">First Join</TableHead>
                                  <TableHead className="text-xs">Last Leave</TableHead>
                                  <TableHead className="text-xs text-right">Total Duration</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {liveReport[lec.id].map(row => (
                                  <React.Fragment key={row.id}>
                                    <TableRow>
                                      <TableCell className="text-xs font-medium">
                                        {row.name}
                                        {row.guestEmail && <span className="block text-[10px] text-muted-foreground">{row.guestEmail}</span>}
                                        {row.guestPhone && <span className="block text-[10px] text-muted-foreground">{row.guestPhone}</span>}
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant={row.isGuest ? 'outline' : 'secondary'} className="text-[10px] h-4">
                                          {row.isGuest ? 'Guest' : 'LMS'}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {(row.loginCount ?? 1) > 1 ? (
                                          <Badge variant="destructive" className="text-[10px] h-4">
                                            {row.loginCount}×
                                          </Badge>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">1</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-xs text-muted-foreground">
                                        {row.joinTime ? new Date(row.joinTime).toLocaleTimeString() : '—'}
                                      </TableCell>
                                      <TableCell className="text-xs text-muted-foreground">
                                        {row.leaveTime ? new Date(row.leaveTime).toLocaleTimeString() : '—'}
                                      </TableCell>
                                      <TableCell className="text-xs text-right">
                                        {fmtMinutes(row.durationMinutes)}
                                      </TableCell>
                                    </TableRow>
                                    {/* Expand individual visits if multiple logins */}
                                    {(row.loginCount ?? 1) > 1 && row.visits && row.visits.map((v, vi) => (
                                      <TableRow key={`${row.id}-v${vi}`} className="bg-muted/20">
                                        <TableCell className="text-[10px] text-muted-foreground pl-6" colSpan={2}>
                                          Visit {vi + 1}
                                        </TableCell>
                                        <TableCell />
                                        <TableCell className="text-[10px] text-muted-foreground">
                                          {v.joinTime ? new Date(v.joinTime).toLocaleTimeString() : '—'}
                                        </TableCell>
                                        <TableCell className="text-[10px] text-muted-foreground">
                                          {v.leaveTime ? new Date(v.leaveTime).toLocaleTimeString() : '—'}
                                        </TableCell>
                                        <TableCell className="text-[10px] text-muted-foreground text-right">
                                          {fmtMinutes(v.durationMinutes)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </React.Fragment>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                ))
              )}
            </TabsContent>

            {/* ── Recording Activity Reports ── */}
            <TabsContent value="recording" className="space-y-4">
              {lectures.filter(l => l.recAttendanceEnabled).length === 0 ? (
                <EmptyState icon={<PlayCircle className="h-8 w-8 opacity-20" />}
                  message="No recording-tracked lectures in the current selection" />
              ) : (
                lectures.filter(l => l.recAttendanceEnabled).map(lec => (
                  <Card key={lec.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm">{lec.title}</CardTitle>
                          {lec.startTime && (
                            <CardDescription className="text-xs">
                              {new Date(lec.startTime).toLocaleString()}
                            </CardDescription>
                          )}
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => loadRecReport(lec.id)}>
                          {loadingRec[lec.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Load'}
                        </Button>
                      </div>
                    </CardHeader>
                    {recReport[lec.id] && (
                      <CardContent className="space-y-3">
                        {recReport[lec.id].length === 0 ? (
                          <p className="text-xs text-muted-foreground">No recording sessions yet.</p>
                        ) : (
                          <>
                            {/* Summary row */}
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pb-2 border-b mb-1">
                              <span><b className="text-foreground">{recReport[lec.id].length}</b> viewer{recReport[lec.id].length !== 1 ? 's' : ''}</span>
                              <span>Avg watched: <b className="text-foreground">{formatSeconds(Math.round(recReport[lec.id].reduce((s, r) => s + r.totalWatchedSeconds, 0) / recReport[lec.id].length))}</b></span>
                              {(lec as any).recDurationSeconds > 0 && (
                                <span>Avg completion: <b className="text-foreground">{Math.min(100, Math.round(recReport[lec.id].reduce((s, r) => s + r.totalWatchedSeconds, 0) / recReport[lec.id].length / (lec as any).recDurationSeconds * 100))}%</b></span>
                              )}
                            </div>
                            {recReport[lec.id].map(session => {
                              const recDur = (lec as any).recDurationSeconds as number | undefined;
                              const pct = recDur && recDur > 0
                                ? Math.min(100, Math.round((session.totalWatchedSeconds / recDur) * 100))
                                : null;
                              return (
                                <div key={session.sessionId} className="border rounded-md overflow-hidden">
                                  <button
                                    className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 text-left"
                                    onClick={() => setExpandedRecSessions(p => ({
                                      ...p, [session.sessionId]: !p[session.sessionId],
                                    }))}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      {expandedRecSessions[session.sessionId]
                                        ? <ChevronDown className="h-3 w-3 shrink-0" />
                                        : <ChevronRight className="h-3 w-3 shrink-0" />}
                                      <span className="text-xs font-medium truncate">{session.name}</span>
                                      <Badge variant={session.isGuest ? 'outline' : 'secondary'} className="text-[10px] h-4 shrink-0">
                                        {session.isGuest ? 'Guest' : 'LMS'}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0 ml-2">
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatSeconds(session.totalWatchedSeconds)}
                                        {pct !== null && (
                                          <span className={`ml-1 font-semibold ${pct >= 80 ? 'text-green-600' : pct >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                                            {pct}%
                                          </span>
                                        )}
                                      </span>
                                      <span>{new Date(session.startTime).toLocaleDateString()}</span>
                                    </div>
                                  </button>

                                  {/* Completion bar */}
                                  {pct !== null && (
                                    <div className="h-0.5 bg-muted">
                                      <div
                                        className={`h-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  )}

                                  {expandedRecSessions[session.sessionId] && (
                                    <div className="px-3 py-3 space-y-3">
                                      <ActivityHeatmap activities={session.activities} />
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                                        <div>Started: <span className="text-foreground">{new Date(session.startTime).toLocaleString()}</span></div>
                                        {session.endTime && <div>Ended: <span className="text-foreground">{new Date(session.endTime).toLocaleString()}</span></div>}
                                        <div>Total watched: <span className="text-foreground font-medium">{formatSeconds(session.totalWatchedSeconds)}</span></div>
                                        <div>Last position: <span className="text-foreground">{formatSeconds(session.lastPositionSeconds)}</span></div>
                                        {recDur && <div>Video length: <span className="text-foreground">{formatSeconds(recDur)}</span></div>}
                                        {pct !== null && <div>Completion: <span className={`font-semibold ${pct >= 80 ? 'text-green-600' : pct >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{pct}%</span></div>}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        )}
                      </CardContent>
                    )}
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ── Activity Heatmap (GitHub commit-style) ─────────────────────────────────────

function ActivityHeatmap({ activities }: {
  activities: Array<{ type: string; videoTimestamp: number; at: string }>;
}) {
  if (activities.length === 0) {
    return <p className="text-xs text-muted-foreground">No activity events recorded.</p>;
  }

  // Group by 30-second buckets of video time
  const BUCKET_SECS = 30;
  const maxTs = Math.max(...activities.map(a => a.videoTimestamp));
  const bucketCount = Math.max(Math.ceil(maxTs / BUCKET_SECS), 1);

  const buckets = Array.from({ length: bucketCount }, (_, i) => {
    const from = i * BUCKET_SECS;
    const to   = from + BUCKET_SECS;
    const acts = activities.filter(a => a.videoTimestamp >= from && a.videoTimestamp < to);
    return { from, to, acts, count: acts.length };
  });

  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  const colorForType = (type: string) => {
    if (type === 'PLAY')      return 'bg-green-500';
    if (type === 'PAUSE')     return 'bg-amber-400';
    if (type === 'SEEK')      return 'bg-blue-500';
    if (type === 'HEARTBEAT') return 'bg-green-400';
    return 'bg-muted';
  };

  const intensityClass = (count: number) => {
    const ratio = count / maxCount;
    if (ratio === 0) return 'bg-muted/30';
    if (ratio < 0.25) return 'bg-green-200 dark:bg-green-900';
    if (ratio < 0.5)  return 'bg-green-300 dark:bg-green-700';
    if (ratio < 0.75) return 'bg-green-400 dark:bg-green-600';
    return 'bg-green-600 dark:bg-green-400';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-muted-foreground mr-1">Activity map</span>
        {(['PLAY','HEARTBEAT','PAUSE','SEEK'] as const).map(t => (
          <span key={t} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className={`inline-block w-2 h-2 rounded-sm ${colorForType(t)}`} />{t.toLowerCase()}
          </span>
        ))}
      </div>
      <TooltipProvider delayDuration={100}>
        <div className="flex flex-wrap gap-0.5">
          {buckets.map((b, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div
                  className={`w-3 h-3 rounded-sm cursor-default transition-colors ${intensityClass(b.count)}`}
                />
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                <div>{formatSeconds(b.from)}–{formatSeconds(b.to)}</div>
                {b.acts.length > 0 ? (
                  b.acts.slice(0, 5).map((a, j) => (
                    <div key={j} className="flex items-center gap-1 mt-0.5">
                      <span className={`inline-block w-2 h-2 rounded-sm ${colorForType(a.type)}`} />
                      {a.type}
                    </div>
                  ))
                ) : <div>No activity</div>}
                {b.acts.length > 5 && <div>+{b.acts.length - 5} more</div>}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
      {icon}
      <p className="text-sm">{message}</p>
    </div>
  );
}

function formatSeconds(s: number): string {
  if (!s || s < 0) return '0s';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function fmtMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
