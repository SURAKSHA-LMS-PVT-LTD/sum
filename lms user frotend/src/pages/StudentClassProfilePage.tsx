import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import PageContainer from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, User, Phone, Mail, Building2, Calendar, BookOpen,
  ChevronDown, ChevronUp, Loader2, AlertCircle, RefreshCw,
  CheckCircle, Clock, XCircle, Users, MapPin, Banknote, Hash,
  ShieldCheck, Heart, Video, PlayCircle, Upload, Info, FileText
} from 'lucide-react';
import { apiClient } from '@/api/client';
import { classPaymentsApi } from '@/api/classPayments.api';
import { lectureApi } from '@/api/lecture.api';
import { useAuth } from '@/contexts/AuthContext';
import { formatNameToInitials } from '@/utils/nameFormatters';
import { generateStudentClassReport } from '@/utils/studentClassReport';
import ReportDialog, { type ReportDialogResult } from '@/components/ReportDialog';
import { fetchInstituteReportBranding } from '@/utils/instituteReportBranding';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParentInfo { name?: string; email?: string; phoneNumber?: string; occupation?: string; workPlace?: string; imageUrl?: string; }
interface StudentDetail {
  id: string; name: string; nameWithInitials?: string; fullName?: string; email?: string; phoneNumber?: string; imageUrl?: string;
  instituteImageUrl?: string; role?: string;
  dateOfBirth?: string; userIdByInstitute?: string; addressLine1?: string; city?: string;
  district?: string; province?: string; nic?: string; gender?: string;
  father?: ParentInfo; mother?: ParentInfo; guardian?: ParentInfo;
  emergencyContact?: string; medicalConditions?: string; allergies?: string; extraData?: Record<string, any>;
}
interface AttendanceRecord {
  date: string; status: string; location?: string; markingMethod?: string;
  sessionId?: string | null; markedAt?: string | null;
  sessionName?: string | null; sessionStart?: string | null; sessionEnd?: string | null;
  groupId?: string | null; groupName?: string | null; groupColor?: string | null;
}
interface PaymentRecord { id: string; title: string; amount: string; status: string; submissionStatus?: string | null; submittedAmount?: string; }
interface ClassSubject { id: string; name: string; code: string; imageUrl?: string | null; teacher?: { name: string; imageUrl?: string | null } | null; }

const COLOMBO_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Colombo',
  hour: '2-digit',
  minute: '2-digit',
};
const formatColomboDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('en-GB', { timeZone: 'Asia/Colombo', day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatColomboTime = (value?: string | null) => {
  if (!value) return '—';
  const v = /^\d{2}:\d{2}(:\d{2})?$/.test(value) ? `2000-01-01T${value}` : value;
  try { return new Date(v).toLocaleTimeString('en-LK', COLOMBO_TIME_OPTIONS); } catch { return value; }
};
const getParentDisplayName = (parent?: ParentInfo & { nameWithInitials?: string }) =>
  parent?.nameWithInitials || parent?.name || 'N/A';

const StatusBadge = ({ status }: { status?: string | null }) => {
  if (!status) return <Badge variant="outline" className="text-gray-400 gap-1 text-[10px]"><AlertCircle className="h-3 w-3" />Not paid</Badge>;
  if (status === 'VERIFIED') return <Badge className="bg-green-100 text-green-800 border-green-200 gap-1 text-[10px]"><CheckCircle className="h-3 w-3" />Verified</Badge>;
  if (status === 'HALF_VERIFIED') return <Badge className="bg-emerald-100 text-emerald-800 gap-1 text-[10px]"><CheckCircle className="h-3 w-3" />Half paid</Badge>;
  if (status === 'QUARTER_VERIFIED') return <Badge className="bg-teal-100 text-teal-800 gap-1 text-[10px]"><CheckCircle className="h-3 w-3" />Quarter paid</Badge>;
  if (status === 'PENDING') return <Badge className="bg-yellow-100 text-yellow-800 gap-1 text-[10px]"><Clock className="h-3 w-3" />Pending</Badge>;
  if (status === 'REJECTED') return <Badge className="bg-red-100 text-red-800 gap-1 text-[10px]"><XCircle className="h-3 w-3" />Rejected</Badge>;
  return <Badge variant="outline" className="text-gray-400 gap-1 text-[10px]"><AlertCircle className="h-3 w-3" />Not paid</Badge>;
};

const AttendanceStatusDot = ({ status }: { status: string }) => {
  const s = (status ?? '').toLowerCase();
  const c = s === 'present' ? 'bg-green-500' : s === 'absent' ? 'bg-red-500' : s === 'late' ? 'bg-yellow-500' : 'bg-gray-300';
  return <span className={`inline-block h-2 w-2 rounded-full ${c} shrink-0`} />;
};

const Section: React.FC<{ id: string; icon: React.ElementType; title: string; badge?: React.ReactNode; isOpen: boolean; onToggle: () => void; loading?: boolean; error?: string | null; onRetry?: () => void; children: React.ReactNode; }> = ({ icon: Icon, title, badge, isOpen, onToggle, loading, error, onRetry, children }) => (
  <Card className="border-border/50 rounded-2xl shadow-sm overflow-hidden">
    <div role="button" tabIndex={0} onClick={onToggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle(); }} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset">
      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Icon className="h-4 w-4 text-primary" /></div>
      <span className="flex-1 font-semibold text-sm text-foreground">{title}</span>
      {badge}
      {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" /> : isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
    </div>
    {isOpen && (
      <div className="border-t border-border/50">
        {error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center px-5">
            <AlertCircle className="h-8 w-8 text-destructive/50" />
            <p className="text-sm text-muted-foreground">{error}</p>
            {onRetry && <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Retry</Button>}
          </div>
        ) : <div className="p-5">{children}</div>}
      </div>
    )}
  </Card>
);

const SkeletonRow = () => (
  <div className="flex gap-3 items-center py-2">
    <div className="h-2.5 w-2.5 rounded-full bg-muted animate-pulse shrink-0" />
    <div className="flex-1 h-3 rounded bg-muted animate-pulse" />
    <div className="w-20 h-3 rounded bg-muted animate-pulse" />
  </div>
);

const StudentClassProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { instituteId } = useParams<{ instituteId: string }>();
  const location = useLocation();
  const classIdMatch = location.pathname.match(/\/class\/([^\/]+)/);
  const classId = classIdMatch ? classIdMatch[1] : undefined;
  const studentIdMatch = location.pathname.match(/\/student\/([^\/]+)\/profile/);
  const studentId = studentIdMatch ? studentIdMatch[1] : undefined;
  const { selectedInstitute, selectedClass } = useAuth();

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(true);
  const [studentError, setStudentError] = useState<string | null>(null);

  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['details']));
  const toggleSection = (id: string) => setOpenSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);
  const [attendanceLimit, setAttendanceLimit] = useState(10);
  const [attendanceStartDate, setAttendanceStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [attendanceEndDate, setAttendanceEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  const [paymentsLimit, setPaymentsLimit] = useState(10);

  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);
  const [showActivityMap, setShowActivityMap] = useState<Record<string, boolean>>({});
  const [activityTab, setActivityTab] = useState<'live' | 'recording' | 'summary'>('live');

  const [subjects, setSubjects] = useState<ClassSubject[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [subjectsLoaded, setSubjectsLoaded] = useState(false);

  // Profile lectures — populated from class-profile API response, used for report generation.
  // Avoids requiring the user to open the Activities section before generating a report.
  const [profileLectures, setProfileLectures] = useState<any[]>([]);
  // Profile payments — same reason: populated from class-profile response
  const [profilePayments, setProfilePayments] = useState<any[]>([]);

  const [showReportDialog, setShowReportDialog] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!instituteId || !classId || !studentId) return;
    setStudentError(null);
    setAttendanceError(null);
    setLoadingStudent(true);
    setLoadingAttendance(true);
    try {
      const res: any = await apiClient.get(
        `/api/attendance/institute/${instituteId}/student/${studentId}/class-profile`,
        { classId, startDate: attendanceStartDate, endDate: attendanceEndDate, limit: attendanceLimit }
      );
      if (!res?.student) throw new Error('Student not found');
      const s = res.student;
      setStudent({
        id: s.id ?? studentId,
        name: s.fullName ?? s.nameWithInitials ?? s.name ?? 'Unknown',
        nameWithInitials: s.nameWithInitials,
        fullName: s.fullName ?? null,
        email: s.email, phoneNumber: s.phoneNumber,
        imageUrl: s.imageUrl, instituteImageUrl: s.instituteImageUrl ?? s.imageUrl,
        userIdByInstitute: s.userIdByInstitute,
        dateOfBirth: s.dateOfBirth, gender: s.gender, nic: s.nic,
        addressLine1: s.addressLine1, city: s.city, district: s.district, province: s.province,
        role: s.role,
        father: s.father, mother: s.mother, guardian: s.guardian,
        emergencyContact: s.emergencyContact, medicalConditions: s.medicalConditions, allergies: s.allergies,
        extraData: s.extraData ? (typeof s.extraData === 'string' ? JSON.parse(s.extraData) : s.extraData) : undefined,
      });
      setAttendance((res?.attendance ?? []).map((r: any) => ({
        date: r.date ?? '',
        status: r.status ?? 'absent',
        markingMethod: r.markingMethod,
        location: r.location,
        markedAt: r.markedAt ?? null,
        sessionId: r.sessionId ?? null,
        sessionName: r.sessionName ?? null,
        sessionStart: r.sessionStart ?? null,
        sessionEnd: r.sessionEnd ?? null,
        groupId: r.groupId ?? null,
        groupName: r.groupName ?? null,
        groupColor: r.groupColor ?? null,
      })));
      setAttendanceLoaded(true);

      // Store lectures from profile response so report generation works without
      // requiring the user to open the Activities section first.
      setProfileLectures(res?.lectures ?? []);

      // Store payments from profile response (class-profile endpoint returns them).
      // The separate loadPayments() function is still used for the payments UI section
      // (with pagination), but profilePayments is used for report generation.
      setProfilePayments((res?.payments ?? []).map((p: any) => ({
        id: p.id, title: p.title, amount: p.amount, status: p.status,
        submissionStatus: p.submissionStatus ?? null, submittedAmount: p.submittedAmount,
      })));
    } catch (e: any) {
      setStudentError(e?.message || 'Failed to load student profile.');
    } finally {
      setLoadingStudent(false);
      setLoadingAttendance(false);
    }
  }, [instituteId, classId, studentId, attendanceStartDate, attendanceEndDate, attendanceLimit]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const loadPayments = useCallback(async () => {
    if (!instituteId || !classId || !studentId) return;
    setLoadingPayments(true); setPaymentsError(null);
    try {
      const [paymentsRes, subsRes] = await Promise.all([
        classPaymentsApi.getClassPayments(instituteId, classId, 1, paymentsLimit),
        classPaymentsApi.getStudentClassSubmissions(instituteId, classId, studentId, { limit: paymentsLimit }),
      ]);
      const allPayments = paymentsRes?.data ?? [];
      const subs = subsRes?.data ?? [];
      const subMap: Record<string, any> = {};
      for (const s of subs) { subMap[s.paymentId] = s; }
      setPayments(allPayments.map((p: any) => {
        const sub = subMap[p.id];
        return {
          id: p.id, title: p.title, amount: p.amount, status: p.status,
          submissionStatus: sub?.status ?? null, submittedAmount: sub?.submittedAmount,
        };
      }));
      setPaymentsLoaded(true);
    } catch (e: any) { setPaymentsError(e?.message || 'Failed to load payment data.'); }
    finally { setLoadingPayments(false); }
  }, [instituteId, classId, studentId, paymentsLoaded]);

  const loadActivities = useCallback(async () => {
    if (!instituteId || !classId || !studentId) return;
    setLoadingActivities(true);
    setActivitiesError(null);
    try {
      const acts = await lectureApi.getStudentLectureActivities(studentId, instituteId, classId);
      setActivities(acts);
      setActivitiesLoaded(true);
    } catch (e: any) {
      setActivitiesError(e?.response?.data?.message || 'Failed to load lecture activities');
    } finally { setLoadingActivities(false); }
  }, [instituteId, classId, studentId]);

  const loadSubjects = useCallback(async () => {
    if (!instituteId || !classId || subjectsLoaded) return;
    setLoadingSubjects(true); setSubjectsError(null);
    try {
      const res: any = await apiClient.get(`/institutes/${instituteId}/classes/${classId}/subjects`);
      setSubjects((res?.data ?? []).map((s: any) => ({
        id: s.subject.id,
        name: s.subject.name,
        code: s.subject.code,
        imageUrl: s.subject.imageUrl || s.subject.image_url || null,
        teacher: s.teacher ? { name: s.teacher.name, imageUrl: s.teacher.imageUrl || s.teacher.image_url || null } : null,
      })));
      setSubjectsLoaded(true);
    } catch (e: any) { setSubjectsError(e?.message || 'Failed to load subjects.'); }
    finally { setLoadingSubjects(false); }
  }, [instituteId, classId, subjectsLoaded]);

  // ── Categorize attendance by markingMethod ────────────────────────────────
  const categorizeAttendance = () => {
    const live = attendance.filter(r => r.markingMethod === 'LIVE_LECTURE_ATTENDANCE' || r.markingMethod?.includes('LIVE'));
    const recording = attendance.filter(r => r.markingMethod === 'RECORDING_ATTENDANCE' || r.markingMethod?.includes('RECORDING'));
    const manual = attendance.filter(r => !r.markingMethod || r.markingMethod === 'MANUAL' || (!r.markingMethod?.includes('LIVE') && !r.markingMethod?.includes('RECORDING')));
    return { live, recording, manual };
  };

  useEffect(() => {
    if (openSections.has('payments') && !paymentsLoaded) loadPayments();
    if (openSections.has('subjects') && !subjectsLoaded) loadSubjects();
    if (openSections.has('activities') && !activitiesLoaded) loadActivities();
  }, [openSections, paymentsLoaded, subjectsLoaded, activitiesLoaded, loadPayments, loadSubjects, loadActivities]);

  useEffect(() => { if (paymentsLoaded) loadPayments(); }, [paymentsLimit]);

  const instName = selectedInstitute?.name ?? `Institute ${instituteId}`;
  const className = selectedClass?.name ?? `Class ${classId ?? ''}`;
  const initials = (student?.nameWithInitials ?? student?.name ?? '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const [imagePreviewOpen, setImagePreviewOpen] = React.useState<{ url: string; title: string } | null>(null);
  const attStats = { present: attendance.filter(r => r.status?.toLowerCase() === 'present').length, absent: attendance.filter(r => r.status?.toLowerCase() === 'absent').length, late: attendance.filter(r => r.status?.toLowerCase() === 'late').length };

  const handleGenerateReport = async ({ options, printOptions }: ReportDialogResult) => {
    if (!student) return;
    setGeneratingReport(true);
    try {
      const { manual } = categorizeAttendance();

      // Use branding fetched once for this institute (module-level cached)
      const branding = instituteId ? await fetchInstituteReportBranding(instituteId) : {};

      // Build live attendance from profileLectures (pre-loaded by loadProfile via class-profile
      // endpoint). Falls back to empty if lectures haven't loaded yet.
      // NOTE: profileLectures uses class-profile endpoint format: l.liveEnabled / l.liveAttendance
      const liveAttendance = profileLectures
        .filter((l: any) => l.liveEnabled)
        .map((l: any) => ({
          title: l.title ?? '',
          date: l.startTime ?? '',
          subjectName: l.subjectName ?? undefined,
          totalDurationMinutes: Math.round((l.liveAttendance?.totalSeconds ?? 0) / 60),
          sessions: (l.liveAttendance?.sessions ?? []).map((s: any) => ({
            joinTime: s.joinTime,
            leaveTime: s.leaveTime ?? undefined,
            durationMinutes: s.leaveTime && s.joinTime
              ? Math.round((new Date(s.leaveTime).getTime() - new Date(s.joinTime).getTime()) / 60000)
              : 0,
          })),
        }));

      const recordingAttendance = profileLectures
        .filter((l: any) => l.recEnabled)
        .map((l: any) => ({
          title: l.title ?? '',
          date: l.startTime ?? '',
          subjectName: l.subjectName ?? undefined,
          totalWatchedSeconds: l.recordingActivity?.totalWatchedSeconds ?? 0,
          sessionCount: l.recordingActivity?.sessionCount ?? 0,
        }));

      // Payments: prefer profilePayments (from class-profile response) so we don't
      // require the user to open the payments section first. Fall back to loaded payments state.
      const paymentsData = profilePayments.length > 0 ? profilePayments : payments;

      await generateStudentClassReport({
        student: {
          name: student.nameWithInitials ?? student.name,
          fullName: student.fullName,
          email: student.email,
          phoneNumber: student.phoneNumber,
          userIdByInstitute: student.userIdByInstitute,
          surakshaUserId: student.id ? String(student.id) : null,
          dateOfBirth: student.dateOfBirth,
          gender: student.gender,
          // addressLine1/city/district/province come from the StudentDetail interface
          address: [student.addressLine1, student.city, student.district, student.province].filter(Boolean).join(', ') || null,
          // instituteImageUrl = institute-specific; imageUrl = global Suraksha profile image
          imageUrl: student.instituteImageUrl ?? null,
          globalImageUrl: student.imageUrl ?? null,
        },
        instituteName: instName,
        className,
        dateRange: { start: attendanceStartDate, end: attendanceEndDate },
        physicalAttendance: manual.map(r => ({
          date: r.date, session: r.sessionName ?? '', group: r.groupName ?? '',
          groupColor: r.groupColor ?? undefined,
          sessionStart: r.sessionStart ?? undefined, sessionEnd: r.sessionEnd ?? undefined,
          checkIn: r.markedAt ?? undefined, status: r.status,
        })),
        liveAttendance,
        recordingAttendance,
        payments: paymentsData.map(p => ({
          title: p.title, amount: Number(p.amount),
          status: p.status ?? '', submissionStatus: p.submissionStatus ?? undefined,
        })),
      }, options, { ...branding, ...printOptions });
    } finally {
      setGeneratingReport(false);
      setShowReportDialog(false);
    }
  };

  if (loadingStudent) return <PageContainer><div className="flex flex-col items-center justify-center py-32 gap-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Loading student profile…</p></div></PageContainer>;
  if (studentError) return <PageContainer><div className="flex flex-col items-center justify-center py-32 gap-4 text-center"><AlertCircle className="h-10 w-10 text-destructive/50" /><p className="text-sm text-muted-foreground">{studentError}</p><Button variant="outline" onClick={loadProfile}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Retry</Button></div></PageContainer>;

  return (
    <PageContainer maxWidth="full">
      {/* Shared report dialog — date ranges hidden here because profile page uses its own attendance date filter */}
      <ReportDialog
        open={showReportDialog}
        onClose={() => setShowReportDialog(false)}
        onGenerate={handleGenerateReport}
        generating={generatingReport}
        title="Generate Class Report"
        showDateRanges={false}
      />

      <div className="flex items-center gap-2 mb-5 text-sm text-muted-foreground flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 -ml-2"><ArrowLeft className="h-4 w-4" />Back</Button>
        <span>/</span><span className="text-foreground font-medium">{instName}</span>
        <span>/</span><span className="text-foreground font-medium">{className}</span>
        <span>/</span><span className="text-foreground font-semibold">{student?.nameWithInitials ?? student?.name ?? 'Student'}</span>
        <Badge variant="outline" className="ml-1 text-[10px]">Class Level</Badge>
        <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={() => setShowReportDialog(true)}>
          <FileText className="h-3.5 w-3.5" />Report
        </Button>
      </div>

      <Card className="border-border/50 rounded-2xl shadow-lg mb-6 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-blue-500 via-blue-400 to-indigo-500" />
        <CardContent className="p-4 sm:p-5">
          <div className="flex gap-3 sm:gap-4 items-start flex-wrap">
            <div className="shrink-0 relative cursor-pointer" onClick={() => student?.instituteImageUrl ? setImagePreviewOpen({ url: student.instituteImageUrl, title: student.nameWithInitials ?? student.name ?? '' }) : undefined}>
              {student?.instituteImageUrl
                ? <img src={student.instituteImageUrl} alt={student.nameWithInitials ?? student.name} className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl sm:rounded-3xl object-cover ring-4 ring-white shadow-lg hover:scale-[1.01] transition-transform" />
                : <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center ring-4 ring-white shadow-lg"><span className="text-xl sm:text-3xl font-bold text-white">{initials}</span></div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">{student?.nameWithInitials || student?.fullName || student?.name}</h1>
              </div>
              {student?.fullName && <p className="text-sm text-muted-foreground truncate font-medium">{student.fullName}</p>}
              {student?.userIdByInstitute && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Hash className="h-3 w-3" />ID: <span className="font-mono">{student.userIdByInstitute}</span></p>}
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {student?.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{student.email}</span>}
                {student?.phoneNumber && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{student.phoneNumber}</span>}
                {student?.dateOfBirth && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatColomboDate(student.dateOfBirth)}</span>}
                {student?.gender && <span className="flex items-center gap-1"><User className="h-3 w-3" />{student.gender}</span>}
              </div>
              {(student?.addressLine1 || student?.city) && <p className="mt-1 text-xs text-muted-foreground flex items-start gap-1"><MapPin className="h-3 w-3 shrink-0 mt-0.5" /><span className="truncate">{[student.addressLine1, student.city, student.district].filter(Boolean).join(', ')}</span></p>}
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Image preview modal */}
      {imagePreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setImagePreviewOpen(null)}>
          <div className="relative w-full max-w-5xl" onClick={e => e.stopPropagation()}>
            <div className="rounded-3xl overflow-hidden bg-black shadow-2xl border border-white/10">
              <img src={imagePreviewOpen.url} alt={imagePreviewOpen.title} className="w-full max-h-[82vh] object-contain bg-neutral-950" />
            </div>
            <div className="absolute top-3 right-3 flex items-center gap-2">
              <a href={imagePreviewOpen.url} download className="rounded-full bg-black/70 text-white px-3 py-2 text-xs font-medium hover:bg-black">Download</a>
              <button onClick={() => setImagePreviewOpen(null)} className="bg-black/70 text-white rounded-full p-2 hover:bg-black"><XCircle className="h-5 w-5" /></button>
            </div>
            <div className="mt-3 text-center text-sm text-white/90 font-medium">{imagePreviewOpen.title}</div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {/* Institute User Details */}
        <Section id="institute-details" icon={Building2} title="Institute User Details" isOpen={openSections.has('institute-details')} onToggle={() => toggleSection('institute-details')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-4 p-4 bg-muted/10 border border-border/50 rounded-2xl">
              <div className="relative cursor-pointer" onClick={() => student?.instituteImageUrl ? setImagePreviewOpen({ url: student.instituteImageUrl, title: `${student.name} — Institute Photo` }) : undefined}>
                {student?.instituteImageUrl
                  ? <img src={student.instituteImageUrl} alt={student.name} className="h-20 w-20 rounded-2xl object-cover ring-1 ring-border shadow-md hover:opacity-90 transition-opacity" />
                  : <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center ring-1 ring-border"><span className="text-2xl font-bold text-muted-foreground">{initials}</span></div>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Institute User Image</p>
                <p className="text-sm font-medium mt-1">ID: <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{student?.userIdByInstitute || 'N/A'}</span></p>
                {student?.role && <p className="text-xs mt-1 text-muted-foreground">Role: <span className="font-semibold text-foreground">{student.role}</span></p>}
              </div>
            </div>
            {student?.extraData && Object.keys(student.extraData).length > 0 && (
              <div className="p-3 bg-muted/10 border border-border/50 rounded-xl">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Extra Data</p>
                <div className="space-y-1">
                  {Object.entries(student.extraData).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground capitalize">{k}</span>
                      <span className="text-xs font-medium bg-muted px-1.5 py-0.5 rounded font-mono">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>

        {(student?.father || student?.mother || student?.guardian) && (
          <Section id="parents" icon={Users} title="Family & Parents" isOpen={openSections.has('parents')} onToggle={() => toggleSection('parents')}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {([{ label: 'Father', data: student?.father, icon: '👨' }, { label: 'Mother', data: student?.mother, icon: '👩' }, { label: 'Guardian', data: student?.guardian, icon: '🛡️' }] as const).filter(f => f.data).map(({ label, data, icon }) => (
                <div key={label} className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold flex items-center gap-1.5">{icon} {label}</p>
                      {data?.imageUrl ? (
                        <img src={data.imageUrl} alt={data?.name || label} className="h-6 w-6 sm:h-8 sm:w-8 rounded-md sm:rounded-lg object-cover shrink-0 ring-1 ring-border" />
                      ) : (
                        <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-md sm:rounded-lg bg-muted flex items-center justify-center text-xs sm:text-sm shrink-0 ring-1 ring-border">{icon}</div>
                      )}
                    </div>
                    {(data?.name || (data as any)?.nameWithInitials) && <p className="text-sm font-semibold truncate" title={getParentDisplayName(data as any)}>{getParentDisplayName(data as any)}</p>}
                    {data?.email && <p className="text-xs text-muted-foreground flex items-center gap-1 truncate" title={data.email}><Mail className="h-3 w-3 shrink-0" />{data.email}</p>}
                    {data?.phoneNumber && <p className="text-xs text-muted-foreground flex items-center gap-1 truncate"><Phone className="h-3 w-3 shrink-0" />{data.phoneNumber}</p>}
                    {data?.occupation && <p className="text-xs text-muted-foreground truncate">{data.occupation}{data.workPlace ? ` · ${data.workPlace}` : ''}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section id="attendance" icon={Calendar} title="Class Attendance" badge={
          <div className="flex flex-wrap items-center gap-2">
            {attendanceLoaded && <div className="flex gap-1.5"><span className="flex items-center gap-1 text-[10px] font-semibold text-green-600"><AttendanceStatusDot status="PRESENT" />{attStats.present}</span><span className="flex items-center gap-1 text-[10px] font-semibold text-red-600"><AttendanceStatusDot status="ABSENT" />{attStats.absent}</span></div>}
            <input
              type="date"
              value={attendanceStartDate}
              onChange={(e) => { e.stopPropagation(); setAttendanceLoaded(false); setAttendanceStartDate(e.target.value); }}
              onClick={(e) => e.stopPropagation()}
              className="h-6 text-[10px] bg-muted/50 border-border rounded px-1.5 focus:ring-1 focus:ring-primary outline-none"
            />
            <span className="text-[10px] text-muted-foreground">to</span>
            <input
              type="date"
              value={attendanceEndDate}
              onChange={(e) => { e.stopPropagation(); setAttendanceLoaded(false); setAttendanceEndDate(e.target.value); }}
              onClick={(e) => e.stopPropagation()}
              className="h-6 text-[10px] bg-muted/50 border-border rounded px-1.5 focus:ring-1 focus:ring-primary outline-none"
            />
            <select
              value={attendanceLimit}
              onChange={(e) => { e.stopPropagation(); setAttendanceLoaded(false); setAttendanceLimit(Number(e.target.value)); }}
              onClick={(e) => e.stopPropagation()}
              className="h-6 text-xs bg-muted/50 border-border rounded px-1.5 focus:ring-1 focus:ring-primary outline-none"
            >
              <option value={10}>10 records</option>
              <option value={50}>50 records</option>
              <option value={100}>100 records</option>
            </select>
          </div>
        } isOpen={openSections.has('attendance')} onToggle={() => toggleSection('attendance')} loading={loadingAttendance} error={attendanceError} onRetry={() => { loadProfile(); }}>
          {loadingAttendance ? <div className="space-y-2">{Array(3).fill(0).map((_, i) => <SkeletonRow key={i} />)}</div> : attendance.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No attendance records found.</p> : (
            <div className="space-y-4">
              {(() => {
                const { live, recording, manual } = categorizeAttendance();
                return (
                  <>
                    {live.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Live Lecture Attendance</p>
                        <div className="space-y-0 divide-y divide-border/40">
                          {live.map((r, i) => (
                            <div key={i} className="flex items-center justify-between py-2 text-xs">
                              <div className="flex items-center gap-2"><AttendanceStatusDot status={r.status} /><span className="text-muted-foreground">{formatColomboDate(r.date)}</span></div>
                              <div className="flex items-center gap-2">
                                {r.markedAt && <span className="text-[10px] text-muted-foreground font-mono">{formatColomboTime(r.markedAt)}</span>}
                                <Badge className={`text-[10px] px-1.5 ${r.status === 'present' ? 'bg-green-100 text-green-700 border-green-200' : r.status === 'late' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-red-100 text-red-700 border-red-200'}`}>{r.status?.toUpperCase()}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {recording.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recording Attendance</p>
                        <div className="space-y-0 divide-y divide-border/40">
                          {recording.map((r, i) => (
                            <div key={i} className="flex items-center justify-between py-2 text-xs">
                              <div className="flex items-center gap-2"><AttendanceStatusDot status={r.status} /><span className="text-muted-foreground">{formatColomboDate(r.date)}</span></div>
                              <div className="flex items-center gap-2">
                                {r.markedAt && <span className="text-[10px] text-muted-foreground font-mono">{formatColomboTime(r.markedAt)}</span>}
                                <Badge className={`text-[10px] px-1.5 ${r.status === 'present' ? 'bg-green-100 text-green-700 border-green-200' : r.status === 'late' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-red-100 text-red-700 border-red-200'}`}>{r.status?.toUpperCase()}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {manual.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">General Class Attendance</p>
                        <div className="overflow-x-auto rounded-xl border border-border/50 bg-white">
                          <table className="w-full text-xs">
                            <thead className="bg-muted/30">
                              <tr>
                                {['Group', 'Session', 'Date', 'Check-in', 'Status', 'Start', 'End'].map(h => <th key={h} className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">{h}</th>)}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20">
                              {manual.map((r, i) => {
                                const isPresent = r.status === 'present' || r.status === 'late';
                                return (
                                  <tr key={i} className={i % 2 === 0 ? 'bg-gray-50 hover:bg-gray-100' : 'bg-white hover:bg-gray-100'}>
                                    <td className="px-3 py-2">
                                      {r.groupName ? <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: r.groupColor ? `${r.groupColor}22` : undefined, color: r.groupColor ?? undefined }}>{r.groupName}</span> : <span className="text-muted-foreground/40">—</span>}
                                    </td>
                                    <td className="px-3 py-2 font-medium whitespace-nowrap">{r.sessionName ?? <span className="text-muted-foreground/40">—</span>}</td>
                                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatColomboDate(r.date)}</td>
                                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap font-mono">{isPresent && r.markedAt ? formatColomboTime(r.markedAt) : '—'}</td>
                                    <td className="px-3 py-2 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full font-semibold border ${r.status === 'present' ? 'bg-green-100 text-green-700 border-green-200' : r.status === 'absent' ? 'bg-red-100 text-red-700 border-red-200' : r.status === 'late' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-muted text-muted-foreground border-border'}`}>{r.status?.toUpperCase()}</span></td>
                                    <td className="px-3 py-2 text-muted-foreground font-mono">{r.sessionStart ? formatColomboTime(r.sessionStart) : '—'}</td>
                                    <td className="px-3 py-2 text-muted-foreground font-mono">{r.sessionEnd ? formatColomboTime(r.sessionEnd) : '—'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </Section>

        <Section id="payments" icon={Banknote} title="Class Payments" badge={
          <select
            value={paymentsLimit}
            onChange={(e) => { e.stopPropagation(); setPaymentsLoaded(false); setPaymentsLimit(Number(e.target.value)); }}
            onClick={(e) => e.stopPropagation()}
            className="h-6 text-xs bg-muted/50 border-border rounded px-1.5 focus:ring-1 focus:ring-primary outline-none mr-2"
          >
            <option value={10}>10 records</option>
            <option value={50}>50 records</option>
            <option value={100}>100 records</option>
          </select>
        } isOpen={openSections.has('payments')} onToggle={() => toggleSection('payments')} loading={loadingPayments} error={paymentsError} onRetry={() => { setPaymentsLoaded(false); loadPayments(); }}>
          {loadingPayments ? <div className="space-y-2">{Array(3).fill(0).map((_, i) => <SkeletonRow key={i} />)}</div> : payments.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No class payments found.</p> : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="text-xs font-semibold truncate">{p.title}</p></div>
                  <div className="shrink-0 text-right space-y-1"><p className="text-xs font-bold">Rs {Number(p.amount).toLocaleString()}</p><StatusBadge status={p.submissionStatus} /></div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section id="activities" icon={Video} title="Lecture Activities" badge={
          <div className="flex items-center gap-1.5">
            {(['live', 'recording', 'summary'] as const).map(tab => (
              <button key={tab} type="button" onClick={e => { e.stopPropagation(); setActivityTab(tab); }}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${activityTab === tab ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                {tab === 'live' ? 'Live' : tab === 'recording' ? 'Recording' : 'Summary'}
              </button>
            ))}
          </div>
        } isOpen={openSections.has('activities')} onToggle={() => toggleSection('activities')} loading={loadingActivities} error={activitiesError} onRetry={() => { setActivitiesLoaded(false); loadActivities(); }}>
          {activityTab === 'summary' ? (() => {
            // Read from pre-computed lectureSummary on completed lectures — zero extra API calls
            const summaryRows = profileLectures
              .filter((l: any) => l.status === 'completed' && l.lectureSummary && l.liveAttendanceEnabled)
              .map((l: any) => {
                const s = l.lectureSummary;
                // studentId from URL params matches studentId in attendace marks (same user.id)
                const sa = (s.studentAttendance ?? []).find((r: any) => String(r.studentId) === String(studentId));
                const rec = (s.recPerStudentWatch ?? []).find((r: any) => String(r.userId) === String(studentId));
                return { lecture: l, summary: s, sa, rec };
              })
              .sort((a: any, b: any) => new Date(b.lecture.startTime ?? 0).getTime() - new Date(a.lecture.startTime ?? 0).getTime());
            if (summaryRows.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">No completed lectures with attendance summaries.</p>;
            return (
              <div className="space-y-2">
                {summaryRows.map(({ lecture: l, summary: s, sa, rec }) => {
                  const pct = sa ? sa.attendPercent : 0;
                  const status = !sa ? 'Absent' : pct === 100 ? 'Present' : pct >= 50 ? 'Partial' : 'Low';
                  const statusCls = !sa ? 'bg-rose-100 text-rose-700' : pct === 100 ? 'bg-emerald-100 text-emerald-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-orange-100 text-orange-700';
                  return (
                    <div key={l.id} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 flex flex-col gap-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{l.title}</p>
                          <p className="text-[10px] text-muted-foreground">{l.startTime ? new Date(l.startTime).toLocaleDateString() : '—'} · {s.totalAttendanceSessions} link{s.totalAttendanceSessions !== 1 ? 's' : ''}</p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusCls}`}>{status}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[10px]">
                        <div className="rounded-lg bg-background/60 px-2 py-1.5">
                          <p className="text-muted-foreground">Attended</p>
                          <p className="font-bold text-xs mt-0.5">{sa ? `${sa.attendCount}/${s.totalAttendanceSessions}` : `0/${s.totalAttendanceSessions}`}</p>
                        </div>
                        <div className="rounded-lg bg-background/60 px-2 py-1.5">
                          <p className="text-muted-foreground">Percentage</p>
                          <p className={`font-bold text-xs mt-0.5 ${pct === 100 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{pct}%</p>
                        </div>
                        <div className="rounded-lg bg-background/60 px-2 py-1.5">
                          <p className="text-muted-foreground">Recording</p>
                          <p className="font-bold text-xs mt-0.5">{rec ? `${rec.watchedMinutes}m` : '—'}</p>
                        </div>
                      </div>
                      {sa && (
                        <div className="flex gap-3 text-[10px] text-muted-foreground">
                          <span>First: <span className="text-foreground font-medium">{sa.firstAt ? new Date(sa.firstAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span></span>
                          <span>Last: <span className="text-foreground font-medium">{sa.lastAt ? new Date(sa.lastAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span></span>
                          {rec?.completionPercent !== null && rec?.completionPercent !== undefined && (
                            <span>Completion: <span className={`font-medium ${rec.completionPercent >= 80 ? 'text-emerald-600' : rec.completionPercent >= 40 ? 'text-amber-600' : 'text-rose-600'}`}>{rec.completionPercent}%</span></span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })() : loadingActivities ? <div className="space-y-2">{Array(3).fill(0).map((_, i) => <SkeletonRow key={i} />)}</div> : (() => {
            const filtered = activities.filter((a: any) => activityTab === 'live' ? a.lecture.liveAttendanceEnabled : a.lecture.recAttendanceEnabled);
            if (filtered.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">No {activityTab === 'live' ? 'live lecture' : 'recording'} activities found.</p>;
            return (
              <div className="space-y-2">
                {filtered.map((a: any) => {
                  const lid = a.lecture.id;
                  const showAct = !!showActivityMap[lid];
                  return (
                    <div key={lid} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 flex flex-col gap-2">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{a.lecture.title}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(a.lecture.startTime).toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {activityTab === 'live' && a.live && <Badge variant="secondary" className="text-[9px] bg-green-100 text-green-700 border-none">{a.live.totalDurationMinutes}m</Badge>}
                          {activityTab === 'recording' && a.recording?.totalWatchedSeconds > 0 && <Badge variant="secondary" className="text-[9px] bg-blue-100 text-blue-700 border-none">{Math.floor(a.recording.totalWatchedSeconds / 60)}m watched</Badge>}
                          {activityTab === 'recording' && (
                            <button type="button" onClick={() => setShowActivityMap(m => ({ ...m, [lid]: !m[lid] }))}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${showAct ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                              {showAct ? 'Summary' : 'Activities'}
                            </button>
                          )}
                        </div>
                      </div>

                      {activityTab === 'live' && (
                        <div className="text-[10px]">
                          <span className={`px-1.5 py-0.5 rounded font-medium flex items-center gap-1 w-fit ${a.live ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {a.live ? `Present — ${a.live.totalDurationMinutes}m` : 'Absent'}
                          </span>
                          {a.live?.sessions?.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {a.live.sessions.map((s: any, i: number) => (
                                <div key={i} className="flex justify-between bg-background/50 rounded px-2 py-1">
                                  <span>{formatColomboTime(s.joinTime)} – {s.leaveTime ? formatColomboTime(s.leaveTime) : '…'}</span>
                                  <span className="text-muted-foreground">{s.durationMinutes}m</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {activityTab === 'recording' && !showAct && (
                        <div className="text-[10px] space-y-1">
                          {a.recording ? (
                            <div className="flex flex-wrap gap-3 text-muted-foreground">
                              <span>Sessions: <b className="text-foreground">{a.recording.sessionCount}</b></span>
                              <span>Total watched: <b className="text-foreground">{Math.floor(a.recording.totalWatchedSeconds / 60)}m {a.recording.totalWatchedSeconds % 60}s</b></span>
                              {a.recording.sessions?.[0]?.totalVideoDurationSeconds > 0 && <span>Video: <b className="text-foreground">{Math.floor(a.recording.sessions[0].totalVideoDurationSeconds / 60)}m</b></span>}
                            </div>
                          ) : <span className="text-muted-foreground italic">Not watched</span>}
                        </div>
                      )}

                      {activityTab === 'recording' && showAct && (
                        <div className="mt-1 space-y-1 pt-2 border-t border-border/40">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight mb-1">Playback Events</p>
                          {a.recording?.sessions?.length > 0 ? a.recording.sessions.map((s: any, i: number) => (
                            <div key={i} className="flex justify-between text-[10px] bg-background/50 rounded px-2 py-1">
                              <div className="flex items-center gap-2">
                                <span>{formatColomboTime(s.startTime)}</span>
                                <span className="text-muted-foreground/50">|</span>
                                <span>{Math.floor(s.watchedSeconds / 60)}m {s.watchedSeconds % 60}s</span>
                                {s.seekCount > 0 && <span className="text-muted-foreground">· {s.seekCount} seeks</span>}
                              </div>
                              {s.totalVideoDurationSeconds > 0 && <span className="text-muted-foreground">{Math.round((s.watchedSeconds / s.totalVideoDurationSeconds) * 100)}%</span>}
                            </div>
                          )) : <p className="text-[10px] text-muted-foreground italic">No playback events recorded.</p>}
                          {a.recording && (
                            <div className="flex justify-between text-[9px] text-muted-foreground pt-1 px-1 border-t border-border/30">
                              <span>Sessions: {a.recording.sessionCount}</span>
                              <span>Total: {Math.floor(a.recording.totalWatchedSeconds / 60)}m {a.recording.totalWatchedSeconds % 60}s</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </Section>

        <Section id="subjects" icon={BookOpen} title="Enrolled Subjects" isOpen={openSections.has('subjects')} onToggle={() => toggleSection('subjects')} loading={loadingSubjects} error={subjectsError} onRetry={() => { setSubjectsLoaded(false); loadSubjects(); }}>
          {loadingSubjects ? <div className="space-y-2">{Array(3).fill(0).map((_, i) => <SkeletonRow key={i} />)}</div> : subjects.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No subjects found for this class.</p> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {subjects.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                  {s.imageUrl ? (
                    <img src={s.imageUrl} alt={s.name} className="h-10 w-10 rounded-lg object-cover shrink-0 ring-1 ring-border" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 ring-1 ring-border"><BookOpen className="h-5 w-5 text-primary" /></div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" title={s.name}>{s.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{s.code}</p>
                    {s.teacher?.name && s.teacher.name !== s.name && <p className="text-xs text-muted-foreground truncate mt-0.5">{s.teacher.name}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </PageContainer>
  );
};
export default StudentClassProfilePage;
