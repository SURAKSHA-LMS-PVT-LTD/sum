import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { generateStudentClassReport } from '@/utils/studentClassReport';
import { fetchInstituteReportBranding } from '@/utils/instituteReportBranding';
import JSZip from 'jszip';
import ReportDialog, { type ReportDialogResult } from '@/components/ReportDialog';
import { getImageUrl } from '@/utils/imageUrlHelper';
import AppLayout from '@/components/layout/AppLayout';
import PageContainer from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  FileText, Users, CheckCircle2, AlertCircle, Loader2, 
  Search, ArrowLeft, Download, Check, X, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentRow {
  id: string;
  name: string;
  nameWithInitials?: string | null;
  imageUrl?: string | null;
  studentId?: string | null;
  userIdByInstitute?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

const StudentReportsPage: React.FC = () => {
  const { instituteId, classId } = useParams<{ instituteId: string; classId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedInstitute, selectedClass } = useAuth();

  // ── Student list ─────────────────────────────────────────────────────────
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // ── Selection ────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Dialog ───────────────────────────────────────────────────────────────
  const [showDialog, setShowDialog] = useState(false);

  // ── Generation state ─────────────────────────────────────────────────────
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentStudentName, setCurrentStudentName] = useState('');
  const [done, setDone] = useState<{ success: number; failed: string[] } | null>(null);

  // ── Load student list ────────────────────────────────────────────────────
  useEffect(() => {
    if (!instituteId || !classId) return;
    setLoadingStudents(true);
    apiClient
      .get(`/institute-users/${instituteId}`, {
        classId,
        limit: '500',
        page: '1',
      })
      .then((res: any) => {
        const rows: StudentRow[] = (res?.data ?? []).map((s: any) => ({
          id: s.id,
          name: s.nameWithInitials ?? s.name ?? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim(),
          nameWithInitials: s.nameWithInitials ?? null,
          imageUrl: s.imageUrl ?? s.instituteUserImageUrl ?? null,
          studentId: s.studentId ?? null,
          userIdByInstitute: s.userIdByInstitute ?? null,
        }));
        setStudents(rows);
      })
      .catch((err) => {
        console.error('Failed to load students:', err);
        setStudents([]);
        toast.error('Failed to load student list');
      })
      .finally(() => setLoadingStudents(false));
  }, [instituteId, classId]);

  // Pre-select student ids from query string
  useEffect(() => {
    const preselect = searchParams.get('studentIds');
    if (preselect) {
      setSelectedIds(new Set(preselect.split(',').filter(Boolean)));
    }
  }, [searchParams]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const filtered = useMemo(() => students.filter(s => {
    if (!studentSearch) return true;
    const q = studentSearch.toLowerCase();
    return (s.nameWithInitials ?? s.name).toLowerCase().includes(q) || 
           (s.userIdByInstitute ?? '').toLowerCase().includes(q);
  }), [students, studentSearch]);

  const toggle = (id: string) =>
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const selectAll = () => setSelectedIds(new Set(filtered.map(s => s.id)));
  const clearAll = () => setSelectedIds(new Set());

  // ── Generate reports ─────────────────────────────────────────────────────

  const handleGenerate = async ({ options, dateRanges, printOptions }: ReportDialogResult) => {
    if (!instituteId || !classId || !selectedIds.size) return;

    setShowDialog(false);
    setGenerating(true);
    setDone(null);
    const ids = Array.from(selectedIds);
    setProgress({ current: 0, total: ids.length });

    const failed: string[] = [];

    try {
      // Fetch institute branding once
      const branding = await fetchInstituteReportBranding(instituteId);

      // Single API call for all selected students
      const res: any = await apiClient.post(
        `/api/attendance/institute/${instituteId}/class-report`,
        {
          classId,
          studentIds: ids,
          attendanceStart: dateRanges.attendanceStart,
          attendanceEnd: dateRanges.attendanceEnd,
          paymentsStart: dateRanges.paymentsStart,
          paymentsEnd: dateRanges.paymentsEnd,
          liveStart: dateRanges.liveStart,
          liveEnd: dateRanges.liveEnd,
          recordingStart: dateRanges.recordingStart,
          recordingEnd: dateRanges.recordingEnd,
          withActivities: false,
          attendanceLimit: 500,
        },
      );

      const reportStudents: any[] = res?.students ?? [];

      let runningPageOffset = printOptions.pageNumberOffset ?? 0;

      // Shared cache for banners/logos so we only convert them once for the whole batch
      const assetCache: Record<string, string | null> = {};
      const zip = new JSZip();

      for (let i = 0; i < reportStudents.length; i++) {
        const row = reportStudents[i];
        if (!row?.student) {
          failed.push(ids[i]);
          continue;
        }

        const s = row.student;
        setCurrentStudentName(s.nameWithInitials ?? s.fullName ?? s.name);
        setProgress({ current: i + 1, total: reportStudents.length });

        const attendance: any[] = row.attendance ?? [];
        const payments: any[] = row.payments ?? [];
        const lectures: any[] = row.lectures ?? [];

        const physical = attendance.filter(
          (r: any) => !r.markingMethod?.includes('LIVE') && !r.markingMethod?.includes('RECORDING'),
        );

        const liveAttendance = lectures
          .filter((l: any) => l.liveEnabled)
          .map((l: any) => ({
            title: l.title ?? '',
            date: l.startTime ?? '',
            subjectName: l.subjectName ?? undefined,
            totalDurationMinutes: Math.round((l.liveAttendance?.totalSeconds ?? 0) / 60),
            sessions: (l.liveAttendance?.sessions ?? []).map((ss: any) => ({
              joinTime: ss.joinTime,
              leaveTime: ss.leaveTime ?? undefined,
              durationMinutes:
                ss.leaveTime && ss.joinTime
                  ? Math.round(
                      (new Date(ss.leaveTime).getTime() - new Date(ss.joinTime).getTime()) / 60000,
                    )
                  : 0,
            })),
          }));

        const recordingAttendance = lectures
          .filter((l: any) => l.recEnabled)
          .map((l: any) => ({
            title: l.title ?? '',
            date: l.startTime ?? '',
            subjectName: l.subjectName ?? undefined,
            totalWatchedSeconds: l.recordingActivity?.totalWatchedSeconds ?? 0,
            sessionCount: l.recordingActivity?.sessionCount ?? 0,
          }));

        try {
          const pdfData = await generateStudentClassReport(
            {
              student: {
                name: s.nameWithInitials ?? s.fullName ?? s.name,
                fullName: s.fullName ?? null,
                email: s.email ?? null,
                phoneNumber: s.phoneNumber ?? null,
                userIdByInstitute: s.userIdByInstitute ?? null,
                surakshaUserId: s.id ? String(s.id) : null,
                dateOfBirth: s.dateOfBirth ?? null,
                gender: s.gender ?? null,
                address: s.address ?? null,
                imageUrl: s.imageUrl ?? null,
                globalImageUrl: s.profileImageUrl ?? s.globalImageUrl ?? null,
              },
              instituteName: selectedInstitute?.name ?? '',
              className: row.classInfo?.name ?? selectedClass?.name ?? '',
              dateRange: { start: dateRanges.attendanceStart, end: dateRanges.attendanceEnd },
              physicalAttendance: physical.map((r: any) => ({
                date: r.date ?? '',
                session: r.sessionName ?? '',
                group: r.groupName ?? '',
                sessionStart: r.sessionStart ?? undefined,
                sessionEnd: r.sessionEnd ?? undefined,
                checkIn: r.markedAt ?? undefined,
                status: r.status ?? 'absent',
              })),
              liveAttendance,
              recordingAttendance,
              payments: payments.map((p: any) => ({
                title: p.title ?? '',
                amount: Number(p.amount ?? 0),
                status: p.status ?? '',
                submissionStatus: p.submissionStatus ?? null,
              })),
            },
            options,
            {
              ...branding,
              ...printOptions,
              pageNumberOffset: runningPageOffset,
              assetCache,
              returnUint8Array: true,
            },
          );

            if (pdfData instanceof Uint8Array) {
              const fileName = `${s.nameWithInitials || s.fullName || s.name}_report.pdf`.replace(/[^a-z0-9._-]/gi, '_');
              zip.file(fileName, pdfData);
            }
          } catch (err) {
            console.error(`Failed to generate report for ${s.name}:`, err);
            failed.push(ids[i]);
          }
        }

        // ── Download the final ZIP ───────────────────────────────────────────
        if (ids.length - failed.length > 0) {
          setCurrentStudentName('Compressing into ZIP...');
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          const zipName = `Class_Reports_${selectedClass?.name || 'Batch'}_${new Date().toISOString().split('T')[0]}.zip`;
          
          const url = window.URL.createObjectURL(zipBlob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', zipName);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }
    } catch (err: any) {
      console.error('Bulk report API failed:', err);
      toast.error(err?.message ?? 'Failed to fetch report data from server');
      ids.forEach(id => failed.push(id));
    }

    setGenerating(false);
    setDone({ success: ids.length - failed.length, failed });
    if (failed.length > 0) {
      toast.warning(`${failed.length} reports failed to generate`);
    } else {
      toast.success('All reports generated successfully');
    }
  };

  const isAllSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  return (
    <AppLayout>
      <PageContainer maxWidth="full" className="pb-32">
        
        {/* ── Header Section ── */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between mb-8">
          <div className="space-y-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="pl-0 text-muted-foreground hover:text-foreground"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Class
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Student Reports</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <Badge variant="outline" className="font-normal">
                {selectedInstitute?.name || 'Institute'}
              </Badge>
              <span className="text-muted-foreground/30">/</span>
              <span className="font-medium text-foreground">{selectedClass?.name || 'Class'}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search students..." 
                className="pl-9 bg-card"
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
              />
            </div>
            <Button 
              onClick={() => setShowDialog(true)}
              disabled={selectedIds.size === 0 || generating}
              className="shadow-lg shadow-primary/20"
            >
              <FileText className="h-4 w-4 mr-2" />
              Generate ({selectedIds.size})
            </Button>
          </div>
        </div>

        {/* ── Selection Controls ── */}
        <div className="flex items-center justify-between bg-muted/30 p-3 rounded-xl border border-border/50 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox 
                id="select-all" 
                checked={isAllSelected}
                onCheckedChange={(checked) => checked ? selectAll() : clearAll()}
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Select All
              </label>
            </div>
            <div className="h-4 w-px bg-border" />
            <span className="text-xs font-medium text-muted-foreground">
              {selectedIds.size} of {students.length} students selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearAll} disabled={selectedIds.size === 0}>
              Clear Selection
            </Button>
          </div>
        </div>

        {/* ── Student Grid ── */}
        {loadingStudents ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <Card key={i} className="animate-pulse bg-muted/20">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="space-y-2 flex-1">
                    <div className="h-3 w-2/3 bg-muted rounded" />
                    <div className="h-2 w-1/3 bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(s => {
              const isSelected = selectedIds.has(s.id);
              return (
                <Card 
                  key={s.id} 
                  className={cn(
                    "cursor-pointer transition-all duration-200 hover:shadow-md border-2",
                    isSelected ? "border-primary bg-primary/[0.02]" : "border-transparent hover:border-border"
                  )}
                  onClick={() => toggle(s.id)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <Checkbox 
                      checked={isSelected}
                      onCheckedChange={() => toggle(s.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarImage src={s.imageUrl ? getImageUrl(s.imageUrl) : undefined} />
                      <AvatarFallback className="bg-primary/5 text-primary text-xs font-bold">
                        {s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate leading-tight">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {s.userIdByInstitute || s.studentId || 'No ID'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold">No students found</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {studentSearch ? `No results for "${studentSearch}" in this class.` : 'This class has no students enrolled yet.'}
            </p>
            {studentSearch && (
              <Button variant="link" onClick={() => setStudentSearch('')}>Clear search</Button>
            )}
          </div>
        )}

        {/* ── Generation Progress Overlay ── */}
        {generating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6">
            <Card className="w-full max-w-md shadow-2xl border-primary/20">
              <CardContent className="p-8 space-y-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="relative h-24 w-24">
                    <div className="absolute inset-0 rounded-full border-4 border-muted" />
                    <svg className="h-24 w-24 -rotate-90">
                      <circle
                        cx="48"
                        cy="48"
                        r="44"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        strokeDasharray={276}
                        strokeDashoffset={276 - (276 * (progress.current / progress.total))}
                        className="text-primary transition-all duration-500 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold">{Math.round((progress.current / progress.total) * 100)}%</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Generating Reports</h3>
                    <p className="text-sm text-muted-foreground">Please keep this tab open</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-muted-foreground">Processing...</span>
                    <span>{progress.current} of {progress.total}</span>
                  </div>
                  <Progress value={(progress.current / progress.total) * 100} className="h-2" />
                  <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                    <p className="text-sm font-medium truncate">{currentStudentName}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Done State Summary ── */}
        {done && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6">
            <Card className="w-full max-w-md shadow-2xl overflow-hidden">
              <div className={cn(
                "h-2 w-full",
                done.failed.length === 0 ? "bg-green-500" : "bg-amber-500"
              )} />
              <CardContent className="p-8 space-y-6">
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center mb-2",
                    done.failed.length === 0 ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
                  )}>
                    {done.failed.length === 0 ? <CheckCircle2 className="h-10 w-10" /> : <Info className="h-10 w-10" />}
                  </div>
                  <h3 className="text-xl font-bold">Generation Complete</h3>
                  <p className="text-sm text-muted-foreground">
                    Successfully generated {done.success} student report{done.success !== 1 ? 's' : ''}.
                  </p>
                </div>

                {done.failed.length > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5 uppercase tracking-wider">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {done.failed.length} Failed
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1 pr-2">
                      {done.failed.map(id => {
                        const s = students.find(x => x.id === id);
                        return (
                          <p key={id} className="text-xs text-amber-700 truncate font-medium">
                            • {s?.name || id}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setDone(null)}>
                    Close
                  </Button>
                  {done.failed.length > 0 && (
                    <Button 
                      className="flex-1" 
                      onClick={() => {
                        const failedIds = new Set(done.failed);
                        setSelectedIds(failedIds);
                        setShowDialog(true);
                        setDone(null);
                      }}
                    >
                      Retry Failed
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Sticky Action Bar ── */}
        {!generating && !done && selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-8 duration-500">
            <div className="bg-slate-900 text-white rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-6 border border-white/10 backdrop-blur-md">
              <div className="hidden sm:flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary border border-primary/20 font-bold">
                  {selectedIds.size}
                </div>
                <div>
                  <p className="text-xs font-bold text-white/90">Students Selected</p>
                  <p className="text-[10px] text-white/50 leading-none">Ready for export</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={clearAll} className="text-white hover:bg-white/10">
                  Deselect All
                </Button>
                <Button 
                  onClick={() => setShowDialog(true)}
                  className="bg-primary hover:bg-primary/90 text-white font-bold"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Generate PDFs
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Report Config Dialog ── */}
        <ReportDialog
          open={showDialog}
          onClose={() => setShowDialog(false)}
          onGenerate={handleGenerate}
          generating={generating}
          progress={generating ? progress : undefined}
          title={`Report Configuration`}
          showDateRanges={true}
        />
      </PageContainer>
    </AppLayout>
  );
};

export default StudentReportsPage;
