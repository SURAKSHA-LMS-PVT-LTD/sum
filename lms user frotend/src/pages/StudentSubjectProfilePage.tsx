import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import PageContainer from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, User, Phone, Mail, Building2, Calendar, BookOpen,
  ChevronDown, ChevronUp, Loader2, AlertCircle, RefreshCw,
  CheckCircle, Clock, XCircle, Users, Banknote, Hash, MapPin, Video, PlayCircle
} from 'lucide-react';
import { apiClient } from '@/api/client';
import { lectureApi } from '@/api/lecture.api';
import { subjectRecordingsApi } from '@/api/subjectRecordings.api';
import { useAuth } from '@/contexts/AuthContext';
import { formatNameToInitials } from '@/utils/nameFormatters';

interface ParentInfo { name?: string; email?: string; phoneNumber?: string; occupation?: string; workPlace?: string; }
interface StudentDetail {
  id: string; name: string; nameWithInitials?: string; fullName?: string; email?: string; phoneNumber?: string; imageUrl?: string;
  instituteImageUrl?: string; role?: string; dateOfBirth?: string; gender?: string; nic?: string;
  userIdByInstitute?: string; city?: string; district?: string; province?: string; addressLine1?: string;
  father?: ParentInfo; mother?: ParentInfo; guardian?: ParentInfo;
  emergencyContact?: string; medicalConditions?: string; allergies?: string; extraData?: Record<string, any>;
}
interface AttendanceRecord { date: string; status: string; }
interface PaymentRecord { id: string; title: string; amount: string; status: string; submissionStatus?: string | null; }

const formatColomboDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('en-GB', { timeZone: 'Asia/Colombo', day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const getParentDisplayName = (parent?: ParentInfo & { nameWithInitials?: string }) =>
  parent?.nameWithInitials || parent?.name || 'N/A';

const StatusBadge = ({ status }: { status?: string | null }) => {
  if (!status) return <Badge variant="outline" className="text-gray-400 gap-1 text-[10px]">Not paid</Badge>;
  if (status === 'VERIFIED') return <Badge className="bg-green-100 text-green-800 gap-1 text-[10px]">Verified</Badge>;
  if (status === 'HALF_VERIFIED') return <Badge className="bg-emerald-100 text-emerald-800 gap-1 text-[10px]">Half paid</Badge>;
  if (status === 'QUARTER_VERIFIED') return <Badge className="bg-teal-100 text-teal-800 gap-1 text-[10px]">Quarter paid</Badge>;
  if (status === 'PENDING') return <Badge className="bg-yellow-100 text-yellow-800 gap-1 text-[10px]">Pending</Badge>;
  if (status === 'REJECTED') return <Badge className="bg-red-100 text-red-800 gap-1 text-[10px]">Rejected</Badge>;
  return <Badge variant="outline" className="text-gray-400 gap-1 text-[10px]">Not paid</Badge>;
};

const Section: React.FC<{ id: string; icon: React.ElementType; title: string; isOpen: boolean; onToggle: () => void; loading?: boolean; error?: string | null; onRetry?: () => void; children: React.ReactNode; }> = ({ icon: Icon, title, isOpen, onToggle, loading, error, onRetry, children }) => (
  <Card className="border-border/50 rounded-2xl shadow-sm overflow-hidden">
    <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors">
      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Icon className="h-4 w-4 text-primary" /></div>
      <span className="flex-1 font-semibold text-sm text-foreground">{title}</span>
      {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" /> : isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
    </button>
    {isOpen && (
      <div className="border-t border-border/50">
        {error ? <div className="flex flex-col items-center gap-3 py-8 text-center px-5"><AlertCircle className="h-8 w-8 text-destructive/50" /><p className="text-sm text-muted-foreground">{error}</p>{onRetry && <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Retry</Button>}</div> : <div className="p-5">{children}</div>}
      </div>
    )}
  </Card>
);

const StudentSubjectProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { instituteId } = useParams<{ instituteId: string }>();
  const location = useLocation();
  const classIdMatch = location.pathname.match(/\/class\/([^/]+)/);
  const classId = classIdMatch ? classIdMatch[1] : undefined;
  const subjectIdMatch = location.pathname.match(/\/subject\/([^/]+)/);
  const subjectId = subjectIdMatch ? subjectIdMatch[1] : undefined;
  const studentIdMatch = location.pathname.match(/\/student\/([^/]+)\/profile/);
  const studentId = studentIdMatch ? studentIdMatch[1] : undefined;
  const { selectedInstitute, selectedClass, selectedSubject } = useAuth();

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(true);
  const [studentError, setStudentError] = useState<string | null>(null);

  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['details']));
  const toggleSection = (id: string) => setOpenSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);


  const loadStudent = useCallback(async () => {
    if (!instituteId || !studentId) return;
    setLoadingStudent(true);
    setStudentError(null);
    try {
      // Use class-profile aggregate endpoint if classId is available — returns full student object
      if (classId) {
        const threeMonthsAgo = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]; })();
        const today = new Date().toISOString().split('T')[0];
        const profileRes: any = await apiClient.get(
          `/api/attendance/institute/${instituteId}/student/${studentId}/class-profile`,
          { classId, startDate: threeMonthsAgo, endDate: today, limit: 1 }
        ).catch(() => null);
        if (profileRes?.student) {
          const s = profileRes.student;
          setStudent({
            id: s.id ?? studentId,
            name: s.nameWithInitials ?? s.fullName ?? s.name ?? 'Unknown',
            nameWithInitials: s.nameWithInitials ?? undefined,
            fullName: s.fullName ?? undefined,
            email: s.email, phoneNumber: s.phoneNumber,
            dateOfBirth: s.dateOfBirth, gender: s.gender, nic: s.nic,
            imageUrl: s.imageUrl, instituteImageUrl: s.instituteImageUrl ?? s.imageUrl,
            userIdByInstitute: s.userIdByInstitute, role: s.role,
            city: s.city, district: s.district, province: s.province, addressLine1: s.addressLine1,
            emergencyContact: s.emergencyContact, medicalConditions: s.medicalConditions, allergies: s.allergies,
            father: s.father, mother: s.mother, guardian: s.guardian,
            extraData: s.extraData ? (typeof s.extraData === 'string' ? JSON.parse(s.extraData) : s.extraData) : undefined,
          });
          return;
        }
      }
      // Fallback: direct institute user lookup (fixed route)
      const [searchRes, detailRes] = await Promise.all([
        apiClient.get(`/institute-payments/institute/${instituteId}/search-student`, { studentId }).catch(() => null),
        apiClient.get(`/institute-users/${instituteId}/${studentId}`).catch(() => null),
      ]);
      const s: any = (searchRes as any)?.student ?? null;
      const u: any = (detailRes as any)?.data ?? detailRes ?? null;
      if (!s && !u) throw new Error('Student not found');
      const nameWithInitials = s?.nameWithInitials ?? u?.nameWithInitials ?? undefined;
      setStudent(prev => ({
        ...prev,
        ...(u || {}),
        ...(s || {}),
        id: s?.uuid ?? u?.id ?? studentId,
        name: nameWithInitials ?? s?.name ?? u?.name ?? 'Unknown',
        nameWithInitials,
        userIdByInstitute: s?.userIdByInstitute ?? u?.userIdByInstitute ?? u?.user_id_institue,
        instituteImageUrl: s?.studentInstituteImageUrl ?? u?.studentInstituteImageUrl ?? u?.instituteImageUrl ?? s?.imageUrl ?? u?.imageUrl ?? prev?.instituteImageUrl,
        role: s?.instituteUserType ?? u?.instituteUserType ?? prev?.role,
        father: u?.father ?? s?.father ?? prev?.father,
        mother: u?.mother ?? s?.mother ?? prev?.mother,
        guardian: u?.guardian ?? s?.guardian ?? prev?.guardian,
      }));
    } catch (e: any) {
      // BUG-16: surface the error so the UI shows a retry instead of a blank page
      setStudentError(e?.message || 'Failed to load student profile.');
    } finally {
      setLoadingStudent(false);
    }
  }, [instituteId, classId, studentId]);

  useEffect(() => { loadStudent(); }, [loadStudent]);

  const loadActivities = useCallback(async () => {
    if (!instituteId || !classId || !subjectId || !studentId) return;
    setLoadingActivities(true);
    setActivitiesError(null);
    try {
      const acts = await lectureApi.getStudentLectureActivities(studentId, instituteId, classId, subjectId);
      setActivities(acts);
      setActivitiesLoaded(true);
    } catch (e: any) {
      setActivitiesError(e?.response?.data?.message || 'Failed to load lecture activities');
    } finally { setLoadingActivities(false); }
  }, [instituteId, classId, subjectId, studentId]);

  useEffect(() => {
    if (openSections.has('activities') && !activitiesLoaded) loadActivities();
  }, [openSections, activitiesLoaded, loadActivities]);

  const [recActivities, setRecActivities] = useState<any[]>([]);
  const [loadingRecActivities, setLoadingRecActivities] = useState(false);
  const [recActivitiesError, setRecActivitiesError] = useState<string | null>(null);
  const [recActivitiesLoaded, setRecActivitiesLoaded] = useState(false);

  const loadRecActivities = useCallback(async () => {
    if (!instituteId || !classId || !subjectId || !studentId) return;
    setLoadingRecActivities(true);
    setRecActivitiesError(null);
    try {
      const acts = await subjectRecordingsApi.getStudentActivities(studentId, instituteId, classId, subjectId);
      setRecActivities(acts);
      setRecActivitiesLoaded(true);
    } catch (e: any) {
      setRecActivitiesError(e?.response?.data?.message || 'Failed to load recording activities');
    } finally { setLoadingRecActivities(false); }
  }, [instituteId, classId, subjectId, studentId]);

  useEffect(() => {
    if (openSections.has('rec-activities') && !recActivitiesLoaded) loadRecActivities();
  }, [openSections, recActivitiesLoaded, loadRecActivities]);


  const initials = (student?.nameWithInitials ?? student?.name ?? '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const [imagePreviewOpen, setImagePreviewOpen] = React.useState<{url:string;title:string}|null>(null);

  if (loadingStudent) return <PageContainer><div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></PageContainer>;
  // BUG-16: show error state instead of blank page when loadStudent fails
  if (studentError) return <PageContainer><div className="flex flex-col items-center justify-center py-32 gap-4 text-center"><AlertCircle className="h-10 w-10 text-destructive/50" /><p className="text-sm text-muted-foreground">{studentError}</p><Button variant="outline" onClick={loadStudent}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Retry</Button></div></PageContainer>;

  return (
    <PageContainer maxWidth="full">
      <div className="flex items-center gap-2 mb-5 text-sm text-muted-foreground flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 -ml-2"><ArrowLeft className="h-4 w-4" />Back</Button>
        <span>/</span><span className="text-foreground">{selectedInstitute?.name ?? `Institute`}</span>
        <span>/</span><span className="text-foreground">{selectedClass?.name ?? `Class ${classId ?? ''}`}</span>
        <span>/</span><span className="text-foreground">{selectedSubject?.name ?? `Subject ${subjectId ?? ''}`}</span>
        <span>/</span><span className="text-foreground font-semibold">{student?.name ?? 'Student'}</span>
      </div>

      <Card className="border-border/50 rounded-2xl shadow-lg mb-6 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-500" />
        <CardContent className="p-4 sm:p-5">
          <div className="flex gap-3 sm:gap-4 items-start flex-wrap">
            <div className="shrink-0 cursor-pointer" onClick={() => student?.instituteImageUrl ? setImagePreviewOpen({url:student.instituteImageUrl,title:student.name??''}) : undefined}>
              {student?.instituteImageUrl
                ? <img src={student.instituteImageUrl} alt={student.name} className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl sm:rounded-2xl object-cover ring-2 ring-border shadow-md hover:opacity-90 transition-opacity" />
                : <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white ring-2 ring-border shadow-md"><span className="text-lg sm:text-2xl font-bold">{initials}</span></div>}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">{student?.nameWithInitials || student?.fullName || student?.name || 'Student'}</h1>
              {student?.fullName && <p className="text-sm font-medium text-muted-foreground truncate">{student.fullName}</p>}
              {student?.userIdByInstitute && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Hash className="h-3 w-3" />ID: <span className="font-mono">{student.userIdByInstitute}</span></p>}
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {student?.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{student.email}</span>}
                {student?.phoneNumber && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{student.phoneNumber}</span>}
                {student?.dateOfBirth && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatColomboDate(student.dateOfBirth)}</span>}
                {student?.gender && <span className="flex items-center gap-1"><User className="h-3 w-3" />{student.gender}</span>}
              </div>
              {(student?.addressLine1 || student?.city) && <p className="mt-1 text-xs text-muted-foreground flex items-start gap-1"><MapPin className="h-3 w-3 shrink-0 mt-0.5" /><span className="truncate">{[student.addressLine1,student.city,student.district].filter(Boolean).join(', ')}</span></p>}
            </div>
          </div>
        </CardContent>
      </Card>
      {imagePreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setImagePreviewOpen(null)}>
          <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <img src={imagePreviewOpen.url} alt={imagePreviewOpen.title} className="w-full rounded-2xl shadow-2xl" />
            <button onClick={() => setImagePreviewOpen(null)} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5"><XCircle className="h-5 w-5" /></button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {/* Institute User Details */}
        <Section id="institute-details" icon={Building2} title="Institute User Details" isOpen={openSections.has('institute-details')} onToggle={() => toggleSection('institute-details')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-4 p-3 bg-muted/10 border border-border/50 rounded-xl">
              <div className="cursor-pointer" onClick={() => student?.instituteImageUrl ? setImagePreviewOpen({url:student.instituteImageUrl,title:`${student.name} — Institute Photo`}) : undefined}>
                {student?.instituteImageUrl
                  ? <img src={student.instituteImageUrl} alt={student.name??''} className="h-16 w-16 rounded-xl object-cover ring-1 ring-border shadow-sm hover:opacity-90 transition-opacity" />
                  : <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center ring-1 ring-border"><span className="text-xl font-bold text-muted-foreground">{initials}</span></div>}
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
                  {Object.entries(student.extraData).map(([k,v]) => (
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
              {([{label:'Father',data:student?.father,icon:'👨'},{label:'Mother',data:student?.mother,icon:'👩'},{label:'Guardian',data:student?.guardian,icon:'🛡️'}] as const).filter(f => f.data).map(({label,data,icon}) => (
                <div key={label} className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold flex items-center gap-1.5">{icon} {label}</p>
                      {(data as any)?.imageUrl ? (
                        <img src={(data as any).imageUrl} alt={data?.name || label} className="h-6 w-6 sm:h-8 sm:w-8 rounded-md sm:rounded-lg object-cover shrink-0 ring-1 ring-border" />
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

        <Section id="activities" icon={Video} title="Lecture Activities" isOpen={openSections.has('activities')} onToggle={() => toggleSection('activities')} loading={loadingActivities} error={activitiesError} onRetry={() => { setActivitiesLoaded(false); loadActivities(); }}>
          {loadingActivities ? <div className="space-y-2"><div className="h-10 bg-muted/50 rounded animate-pulse"/><div className="h-10 bg-muted/50 rounded animate-pulse"/></div> : activities.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No lecture activities found.</p> : (
            <div className="space-y-2">
              {activities.map((a: any) => (
                <div key={a.lecture.id} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold truncate">{a.lecture.title}</p>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">{new Date(a.lecture.startTime).toLocaleString()}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] items-center">
                    {a.lecture.liveAttendanceEnabled && (
                      <span className={`px-1.5 py-0.5 rounded font-medium flex items-center gap-1 ${a.live ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                        {a.live ? `Present (${a.live.totalDurationMinutes}m)` : 'Absent (Live)'}
                      </span>
                    )}
                    {a.lecture.recAttendanceEnabled && (
                      <span className={`px-1.5 py-0.5 rounded font-medium flex items-center gap-1 ${a.recording ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                        <PlayCircle className="h-3 w-3" />
                        {a.recording ? `Watched ${Math.floor(a.recording.totalWatchedSeconds / 60)}m` : 'Not Watched'}
                      </span>
                    )}
                  </div>
                  {/* BUG-17: null-guard on sessions array before accessing length/map */}
                  {(a.live?.sessions?.length ?? 0) > 0 && (
                    <div className="text-[10px] text-muted-foreground">
                      <strong>Live Joins:</strong> {(a.live?.sessions ?? []).map((s: any, i: number) => (
                        <span key={i} className="ml-1">
                          {s.joinTime ? new Date(s.joinTime).toLocaleTimeString() : '?'} - {s.leaveTime ? new Date(s.leaveTime).toLocaleTimeString() : '...'}
                          {i < (a.live?.sessions?.length ?? 0) - 1 ? ',' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                  {(a.recording?.sessions?.length ?? 0) > 0 && (
                    <div className="text-[10px] text-muted-foreground mt-1">
                      <strong>Rec Sessions ({a.recording?.sessionCount ?? 0}):</strong> {(a.recording?.sessions ?? []).map((s: any, i: number) => (
                        <span key={i} className="ml-1">
                          {s.startTime ? new Date(s.startTime).toLocaleTimeString() : '?'} ({Math.floor((s.watchedSeconds ?? 0) / 60)}m)
                          {i < (a.recording?.sessions?.length ?? 0) - 1 ? ',' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section id="rec-activities" icon={PlayCircle} title="Recording Activities" isOpen={openSections.has('rec-activities')} onToggle={() => toggleSection('rec-activities')} loading={loadingRecActivities} error={recActivitiesError} onRetry={() => { setRecActivitiesLoaded(false); loadRecActivities(); }}>
          {loadingRecActivities ? <div className="space-y-2"><div className="h-10 bg-muted/50 rounded animate-pulse"/><div className="h-10 bg-muted/50 rounded animate-pulse"/></div> : recActivities.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No recording activities found.</p> : (
            <div className="space-y-3">
              {recActivities.map((a: any) => (
                <div key={a.recording.id} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-3 flex flex-col gap-2">
                  {/* Recording header */}
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-xs font-semibold truncate">{a.recording.title}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/50">{a.recording.platform}</span>
                      {a.recording.durationSeconds && (
                        <span className="text-[10px] text-muted-foreground">{Math.floor(a.recording.durationSeconds / 60)}m</span>
                      )}
                    </div>
                  </div>

                  {a.watching ? (
                    <>
                      {/* Aggregate badges */}
                      <div className="flex flex-wrap gap-1.5 text-[10px] items-center">
                        <span className="px-1.5 py-0.5 rounded font-medium flex items-center gap-1 bg-blue-100 text-blue-700">
                          <PlayCircle className="h-3 w-3" />
                          {a.watching.totalWatchedMinutes}m video
                        </span>
                        {a.watching.totalEffectiveMinutes !== undefined && a.watching.totalEffectiveMinutes !== a.watching.totalWatchedMinutes && (
                          <span className="px-1.5 py-0.5 rounded font-medium bg-sky-100 text-sky-700">
                            {a.watching.totalEffectiveMinutes}m actual
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded font-medium bg-violet-100 text-violet-700">
                          {a.watching.sessionCount} visit{a.watching.sessionCount > 1 ? 's' : ''}
                        </span>
                        {a.watching.avgPlaybackSpeed && a.watching.avgPlaybackSpeed > 1 && (
                          <span className={`px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5 ${a.watching.avgPlaybackSpeed >= 2 ? 'bg-red-100 text-red-700' : a.watching.avgPlaybackSpeed >= 1.5 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                            avg {a.watching.avgPlaybackSpeed}x
                          </span>
                        )}
                        {a.watching.maxPlaybackSpeed && a.watching.maxPlaybackSpeed > a.watching.avgPlaybackSpeed && (
                          <span className="px-1.5 py-0.5 rounded font-medium bg-red-50 text-red-600">
                            max {a.watching.maxPlaybackSpeed}x
                          </span>
                        )}
                        {a.watching.completionPercent !== null && (
                          <span className={`px-1.5 py-0.5 rounded font-medium ${a.watching.completionPercent >= 80 ? 'bg-green-100 text-green-700' : a.watching.completionPercent >= 40 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                            {a.watching.completionPercent}% complete
                          </span>
                        )}
                      </div>
                      {/* First / last visit */}
                      <div className="flex gap-3 text-[10px] text-muted-foreground">
                        {a.watching.firstWatchedAt && <span>First: <span className="font-medium text-foreground">{new Date(a.watching.firstWatchedAt).toLocaleString()}</span></span>}
                        {(a.watching.sessionCount ?? 0) > 1 && a.watching.lastWatchedAt && (
                          <span>Last: <span className="font-medium text-foreground">{new Date(a.watching.lastWatchedAt).toLocaleString()}</span></span>
                        )}
                      </div>
                      {/* Per-visit breakdown */}
                      {/* BUG-17: null-guard on sessions before length check */}
                      {(a.watching.sessions?.length ?? 0) > 0 && (
                        <div className="mt-0.5 space-y-1">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Visit History</p>
                          {(a.watching.sessions ?? []).map((s: any) => (
                            <div key={s.sessionId} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] bg-background/60 rounded-lg px-2 py-1.5 border border-border/40">
                              <span className="font-semibold text-muted-foreground">#{s.visitNumber}</span>
                              <span className="text-foreground">{new Date(s.startTime).toLocaleString()}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="text-foreground">{s.endTime ? new Date(s.endTime).toLocaleTimeString() : <span className="italic">ongoing</span>}</span>
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">{s.watchedMinutes}m {s.watchedSeconds % 60}s</span>
                              {s.effectiveSeconds !== undefined && s.effectiveSeconds !== s.watchedSeconds && (
                                <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-600">{s.effectiveMinutes}m actual</span>
                              )}
                              {s.playbackSpeed && s.playbackSpeed !== 1 && (
                                <span className={`px-1.5 py-0.5 rounded font-medium ${s.playbackSpeed >= 2 ? 'bg-red-100 text-red-700' : s.playbackSpeed >= 1.5 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {s.playbackSpeed}x
                                </span>
                              )}
                              {s.durationSeconds && <span className="text-muted-foreground">({Math.floor(s.durationSeconds / 60)}m session)</span>}
                              <span className="text-muted-foreground">pos: {s.lastPosition}s</span>
                              {!s.isCompleted && <span className="text-amber-600 italic">no end</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-500 flex items-center gap-1 w-fit">
                      <PlayCircle className="h-3 w-3" />Not Watched
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </PageContainer>
  );
};
export default StudentSubjectProfilePage;

