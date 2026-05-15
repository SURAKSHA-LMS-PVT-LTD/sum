import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import PageContainer from '@/components/layout/PageContainer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft, User, Phone, Mail, Building2, Calendar,
  ChevronDown, ChevronUp, Loader2, AlertCircle, RefreshCw,
  CheckCircle, Clock, XCircle, Heart, Users, MapPin, Banknote, Hash,
  ShieldCheck, Upload, KeyRound, UserCog, UserMinus, Pencil, X, Plus,
  Eye, Building,
} from 'lucide-react';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { apiClient } from '@/api/client';
import { institutePaymentsApi } from '@/api/institutePayments.api';
import { instituteStudentsApi } from '@/api/instituteStudents.api';
import { instituteApi } from '@/api/institute.api';
import { instituteUsersApi } from '@/api/instituteUsers.api';
import { useAuth } from '@/contexts/AuthContext';
import { getBaseUrl, getApiHeadersAsync, setInstituteUserPassword } from '@/contexts/utils/auth.api';
import { uploadWithSignedUrl } from '@/utils/signedUploadHelper';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { useToast } from '@/hooks/use-toast';
import { useInstituteUserColumns } from '@/hooks/useInstituteUserColumns';
import { usersApi } from '@/api/users.api';
import AssignParentByPhoneForm from '@/components/forms/AssignParentByPhoneForm';
import UserOrganizationsDialog from '@/components/forms/UserOrganizationsDialog';
import UserInfoDialog from '@/components/forms/UserInfoDialog';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import { ExtraDataFields } from '@/components/users/ExtraDataFields';

const formatNameWithInitials = (name?: string) => {
  if (!name) return '';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length <= 1) return name;
  const lastName = parts.pop();
  const initials = parts.map(p => p[0].toUpperCase() + '.').join(' ');
  return `${initials} ${lastName}`;
};

const COLOMBO_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Colombo',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};

const formatColomboDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-GB', { timeZone: 'Asia/Colombo', day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatColomboTime = (value?: string | null) => {
  if (!value) return '—';
  const v = /^\d{2}:\d{2}(:\d{2})?$/.test(value) ? `2000-01-01T${value}` : value;
  try { return new Date(v).toLocaleTimeString('en-LK', COLOMBO_TIME_OPTIONS); } catch { return value; }
};
const resolveImageUrl = (value?: string | null) => (value ? getImageUrl(value) : undefined) ?? undefined;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParentInfo {
  id?: string;
  name?: string;
  nameWithInitials?: string;
  uuid?: string;
  email?: string;
  phoneNumber?: string;
  occupation?: string;
  workPlace?: string;
  imageUrl?: string;
}

interface StudentDetail {
  id: string;
  name: string;
  nameWithInitials?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  imageUrl?: string;
  dateOfBirth?: string;
  userIdByInstitute?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  district?: string;
  province?: string;
  nic?: string;
  gender?: string;
  father?: ParentInfo;
  mother?: ParentInfo;
  guardian?: ParentInfo;
  emergencyContact?: string;
  medicalConditions?: string;
  allergies?: string;
  extraData?: Record<string, any>;
  role?: string;
  instituteImageUrl?: string; // institute-specific image (from studentInstituteImageUrl)
}

interface AttendanceRecord {
  date: string;
  status: string;
  location?: string;
  markingMethod?: string;
  markedAt?: string | null;
  eventId?: string | null;
  eventTitle?: string | null;
  eventType?: string | null;
  eventStart?: string | null;
  eventEnd?: string | null;
  eventVenue?: string | null;
  isMandatory?: boolean;
}

interface PaymentRecord {
  id: string;
  paymentType?: string;
  source: 'INSTITUTE' | 'CLASS';
  description: string;
  amount: number;
  dueDate?: string;
  status: string;
  submissionStatus?: string | null;
  submittedAmount?: number;
  className?: string;
  grade?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Accordion Section ────────────────────────────────────────────────────────

interface SectionProps {
  id: string;
  icon: React.ElementType;
  title: string;
  badge?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ icon: Icon, title, badge, isOpen, onToggle, loading, error, onRetry, children }) => (
  <Card className="border-border/50 rounded-2xl shadow-sm overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
    >
      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <span className="flex-1 font-semibold text-sm text-foreground">{title}</span>
      {badge}
      {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" /> : isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
    </button>
    {isOpen && (
      <div className="border-t border-border/50">
        {error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center px-5">
            <AlertCircle className="h-8 w-8 text-destructive/50" />
            <p className="text-sm text-muted-foreground">{error}</p>
            {onRetry && <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Retry</Button>}
          </div>
        ) : (
          <div className="p-5">{children}</div>
        )}
      </div>
    )}
  </Card>
);

// ─── Skeletons ────────────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <div className="flex gap-3 items-center py-2">
    <div className="h-2.5 w-2.5 rounded-full bg-muted animate-pulse shrink-0" />
    <div className="flex-1 h-3 rounded bg-muted animate-pulse" />
    <div className="w-20 h-3 rounded bg-muted animate-pulse" />
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const StudentInstituteProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { instituteId } = useParams<{ instituteId: string }>();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab');

  const studentIdMatch = location.pathname.match(/\/student\/([^\/]+)\/profile/);
  const studentId = studentIdMatch ? studentIdMatch[1] : undefined;

  const openDialog = (tabName: string) => setSearchParams({ tab: tabName, status: 'pending' }, { replace: true });
  const closeDialog = () => setSearchParams({}, { replace: true });
  const { selectedInstitute } = useAuth();
  const { toast } = useToast();
  const { columns: extraColumns } = useInstituteUserColumns(instituteId || '');
  const PASSPORT_ASPECT_RATIO = 7 / 9;
  const imgRef = useRef<HTMLImageElement>(null);

  // ── Student detail ─────────────────────────────────────────────────────────
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loadingStudent, setLoadingStudent] = useState(true);
  const [studentError, setStudentError] = useState<string | null>(null);

  // ── Sections open/loaded state ─────────────────────────────────────────────
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['details']));
  const toggleSection = (id: string) => setOpenSections(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  // ── Attendance ─────────────────────────────────────────────────────────────
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);
  const [attendanceLimit, setAttendanceLimit] = useState<number>(50);
  const [attendanceStartDate, setAttendanceStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [attendanceEndDate, setAttendanceEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // ── Payments ──────────────────────────────────────────────────────────────
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  const [paymentsLimit, setPaymentsLimit] = useState<number>(50);
  const [includeClassPayments, setIncludeClassPayments] = useState(false);

  // ── Action dialogs ─────────────────────────────────────────────────────────
  const isChangeRoleDialogOpen = currentTab === 'change-role';
  const [newRoleValue, setNewRoleValue] = useState('STUDENT');
  const [changingRole, setChangingRole] = useState(false);

  const isSetPasswordDialogOpen = currentTab === 'change-password';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);

  const isOrgDialogOpen = currentTab === 'organizations';
  const isDeactivateDialogOpen = currentTab === 'deactivate';
  const [assignParentDialog, setAssignParentDialog] = useState(false);

  const isEditExtraDataDialogOpen = currentTab === 'edit-extra-data';
  const [extraDataRecord, setExtraDataRecord] = useState<Record<string, string>>({});
  const [extraDataRows, setExtraDataRows] = useState<{ key: string; value: string }[]>([]);
  const [savingExtraData, setSavingExtraData] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ isOpen: boolean; url: string; title: string }>({ isOpen: false, url: '', title: '' });
  const [uploadTarget, setUploadTarget] = useState<'GLOBAL' | 'INSTITUTE' | null>(null);
  const [cropImgSrc, setCropImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [uploading, setUploading] = useState(false);
  const [userInfoDialog, setUserInfoDialog] = useState<{ open: boolean; user: any | null }>({ open: false, user: null });

  // ── Load student details ───────────────────────────────────────────────────
  const loadStudent = useCallback(async (_forceRefresh = false) => {
    if (!instituteId || !studentId) return;
    setStudentError(null);
    try {
      // Use the aggregate profile endpoint — returns complete student object
      const profileRes: any = await apiClient.get(
        `/api/attendance/institute/${instituteId}/student/${studentId}/institute-profile`,
        { startDate: attendanceStartDate, endDate: attendanceEndDate, limit: attendanceLimit }
      );
      if (!profileRes?.student) throw new Error('Student not found');
      const s = profileRes.student;
      setStudent(prev => ({
        ...prev,
        id: s.id ?? studentId,
        fullName: s.fullName ?? null,
        name: s.nameWithInitials ?? s.fullName ?? s.name ?? 'Unknown',
        nameWithInitials: s.nameWithInitials ?? formatNameWithInitials(s.fullName ?? s.name) ?? prev?.nameWithInitials,
        email: s.email ?? prev?.email,
        phoneNumber: s.phoneNumber ?? prev?.phoneNumber,
        dateOfBirth: s.dateOfBirth ?? prev?.dateOfBirth,
        gender: s.gender ?? prev?.gender,
        nic: s.nic ?? prev?.nic,
        addressLine1: s.addressLine1 ?? prev?.addressLine1,
        addressLine2: s.addressLine2 ?? prev?.addressLine2,
        city: s.city ?? prev?.city,
        district: s.district ?? prev?.district,
        province: s.province ?? prev?.province,
        userIdByInstitute: s.userIdByInstitute ?? prev?.userIdByInstitute,
        imageUrl: s.imageUrl ?? prev?.imageUrl,
        instituteImageUrl: s.instituteImageUrl ?? s.imageUrl ?? prev?.instituteImageUrl,
        role: s.role ?? prev?.role,
        emergencyContact: s.emergencyContact ?? prev?.emergencyContact,
        medicalConditions: s.medicalConditions ?? prev?.medicalConditions,
        allergies: s.allergies ?? prev?.allergies,
        father: s.father ?? prev?.father,
        mother: s.mother ?? prev?.mother,
        guardian: s.guardian ?? prev?.guardian,
        extraData: s.extraData ? (typeof s.extraData === 'string' ? JSON.parse(s.extraData) : s.extraData) : prev?.extraData ?? {},
      }));
      // Pre-populate attendance from profile response
      if (profileRes.attendance) {
        setAttendance((profileRes.attendance ?? []).map((r: any) => ({
          date: r.date ?? '', status: r.status ?? 'absent',
          location: r.location, markingMethod: r.markingMethod,
          markedAt: r.markedAt ?? null,
          eventId: r.eventId ?? null, eventTitle: r.eventTitle ?? null,
          eventType: r.eventType ?? null, eventStart: r.eventStart ?? null,
          eventEnd: r.eventEnd ?? null, eventVenue: r.eventVenue ?? null, isMandatory: !!r.isMandatory,
        })));
        setAttendanceLoaded(true);
      }
    } catch (e: any) {
      // Fallback: direct user lookup for at least the name/image
      try {
        const res: any = await apiClient.get(`/institute-users/${instituteId}/${studentId}`);
        const u = res?.data ?? res;
        const freshImage = u?.studentInstituteImageUrl ?? u?.instituteImageUrl ?? u?.imageUrl ?? '';
        setStudent(prev => ({
          ...prev,
          ...u,
          id: studentId,
          name: u?.nameWithInitials ?? formatNameWithInitials(u?.name) ?? u?.name ?? 'Unknown',
          nameWithInitials: u?.nameWithInitials ?? formatNameWithInitials(u?.name) ?? prev?.nameWithInitials,
          userIdByInstitute: u?.userIdByInstitute ?? u?.user_id_institue ?? prev?.userIdByInstitute,
          instituteImageUrl: freshImage || undefined,
          imageUrl: freshImage || u?.imageUrl || prev?.imageUrl,
          extraData: u?.extraData ?? prev?.extraData ?? {},
        }));
      } catch (e2: any) {
        setStudentError(e?.message || e2?.message || 'Failed to load student details.');
      }
    } finally {
      setLoadingStudent(false);
    }
  }, [instituteId, studentId, attendanceStartDate, attendanceEndDate, attendanceLimit]);

  useEffect(() => { loadStudent(true); }, [loadStudent]);

  // ── Load attendance on section open ───────────────────────────────────────
  const loadAttendance = useCallback(async (force = false) => {
    if (!instituteId || !studentId) return;
    if (attendanceLoaded && !force) return;
    setLoadingAttendance(true);
    setAttendanceError(null);
    try {
      const res: any = await apiClient.get(
        `/api/attendance/institute/${instituteId}/student/${studentId}/institute-profile`,
        { startDate: attendanceStartDate, endDate: attendanceEndDate, limit: attendanceLimit }
      );
      setAttendance((res?.attendance ?? []).map((r: any) => ({
        date: r.date ?? '',
        status: r.status ?? 'absent',
        location: r.location,
        markingMethod: r.markingMethod,
        markedAt: r.markedAt ?? null,
        eventId: r.eventId ?? null,
        eventTitle: r.eventTitle ?? null,
        eventType: r.eventType ?? null,
        eventStart: r.eventStart ?? null,
        eventEnd: r.eventEnd ?? null,
        eventVenue: r.eventVenue ?? null,
        isMandatory: !!r.isMandatory,
      })));
      setAttendanceLoaded(true);
    } catch (e: any) {
      setAttendanceError(e?.message || 'Failed to load attendance.');
    } finally {
      setLoadingAttendance(false);
    }
  }, [instituteId, studentId, attendanceStartDate, attendanceEndDate, attendanceLimit, attendanceLoaded]);

  // ── Load payments on section open ─────────────────────────────────────────
  const loadPayments = useCallback(async (force = false) => {
    if (!instituteId || !studentId) return;
    if (paymentsLoaded && !force) return;
    setLoadingPayments(true);
    setPaymentsError(null);
    try {
      // 1. Fetch institute-level payments + this student's submissions in parallel
      const [paymentsRes, subsRes] = await Promise.all([
        institutePaymentsApi.getInstitutePayments(instituteId, { limit: paymentsLimit }, force),
        institutePaymentsApi.getStudentSubmissions(instituteId, studentId, { limit: paymentsLimit }, force),
      ]);
      const allPayments = paymentsRes?.data?.payments ?? [];
      const subs = subsRes?.data?.submissions ?? [];
      const subMap: Record<string, any> = {};
      for (const s of subs) { subMap[s.paymentId] = s; }
      const institutePayments: PaymentRecord[] = allPayments.map((p: any) => {
        const sub = subMap[p.id];
        return {
          id: p.id,
          source: 'INSTITUTE' as const,
          paymentType: p.paymentType,
          description: p.description,
          amount: p.amount,
          dueDate: p.dueDate,
          status: p.status,
          submissionStatus: sub?.status ?? null,
          submittedAmount: sub?.totalAmountPaid ?? sub?.paymentAmount,
        };
      });

      // 2. Fetch class payments — via single optimized endpoint
      let classPayments: PaymentRecord[] = [];
      if (includeClassPayments) {
        try {
          const cpRes: any = await apiClient.get(
            `/institute-class-payment-submissions/institute/${instituteId}/student/${studentId}/all-submissions?limit=${paymentsLimit}`
          );
          const cpSubs: any[] = cpRes?.data ?? cpRes ?? [];
          classPayments = cpSubs.map((s: any) => ({
            id: `cls-${s.id}`,
            source: 'CLASS' as const,
            paymentType: 'CLASS_PAYMENT',
            description: s.paymentTitle || s.description || 'Class Payment',
            amount: s.amount ?? s.paymentAmount ?? 0,
            dueDate: s.dueDate,
            status: s.status ?? 'ACTIVE',
            submissionStatus: s.status ?? null,
            submittedAmount: s.submittedAmount ?? s.amount,
            className: s.className ?? '',
            grade: s.grade ?? '',
          } as PaymentRecord));
        } catch { /* silently ignore — class payments are supplementary */ }
      }

      setPayments([...institutePayments, ...classPayments]);
      setPaymentsLoaded(true);
    } catch (e: any) {
      setPaymentsError(e?.message || 'Failed to load payment data.');
    } finally {
      setLoadingPayments(false);
    }
  }, [instituteId, studentId, paymentsLimit, paymentsLoaded, includeClassPayments]);

  // Trigger loads when sections open
  useEffect(() => {
    if (openSections.has('attendance') && !attendanceLoaded) loadAttendance(true);
  }, [openSections, attendanceLoaded, loadAttendance]);

  useEffect(() => {
    if (openSections.has('payments') && !paymentsLoaded) loadPayments(true);
  }, [openSections, paymentsLoaded, loadPayments]);

  useEffect(() => {
    if (openSections.has('payments')) {
      loadPayments(true);
    }
  }, [includeClassPayments]);

  const handleAttendanceLimitChange = (v: string) => { setAttendanceLimit(Number(v)); setAttendanceLoaded(false); };
  const handleAttendanceDateChange = (field: 'start' | 'end', v: string) => {
    if (field === 'start') setAttendanceStartDate(v); else setAttendanceEndDate(v);
    setAttendanceLoaded(false);
  };
  const handlePaymentsLimitChange = (v: string) => { setPaymentsLimit(Number(v)); setPaymentsLoaded(false); };

  // ── Image upload helpers ───────────────────────────────────────────────────
  const centerAspectCrop = useCallback((w: number, h: number, aspect: number) =>
    centerCrop(makeAspectCrop({ unit: '%', width: 70 }, aspect, w, h), w, h), []);
  const onCropImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, PASSPORT_ASPECT_RATIO));
  }, [centerAspectCrop, PASSPORT_ASPECT_RATIO]);
  const getCroppedImg = useCallback((image: HTMLImageElement, cropData: PixelCrop): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const px = window.devicePixelRatio;
    canvas.width = Math.floor(cropData.width * scaleX * px);
    canvas.height = Math.floor(cropData.height * scaleY * px);
    ctx.scale(px, px);
    ctx.imageSmoothingQuality = 'high';
    ctx.save();
    ctx.translate(-cropData.x * scaleX, -cropData.y * scaleY);
    ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight, 0, 0, image.naturalWidth, image.naturalHeight);
    ctx.restore();
    return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Empty canvas')), 'image/png'));
  }, []);
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCrop(undefined); setCompletedCrop(undefined);
    const reader = new FileReader();
    reader.addEventListener('load', () => setCropImgSrc(reader.result?.toString() || ''));
    reader.readAsDataURL(file);
  };
  const handleImageUpload = async () => {
    if (!completedCrop || !imgRef.current || !instituteId || !studentId || !uploadTarget) return;
    setUploading(true);
    try {
      const blob = await getCroppedImg(imgRef.current, completedCrop);
      const file = new File([blob], 'cropped.png', { type: 'image/png' });
      const folder = uploadTarget === 'GLOBAL' ? 'profile-images' : 'institute-user-images';
      const relativePath = await uploadWithSignedUrl(file, folder, () => { });
      if (uploadTarget === 'GLOBAL') {
        const { profileImageApi } = await import('@/api/profileImage.api');
        await profileImageApi.submitProfileImage(studentId, relativePath, 'GLOBAL');
      } else {
        const headers = await getApiHeadersAsync();
        const res = await fetch(`${getBaseUrl()}/institute-users/institute/${instituteId}/user/${studentId}/upload-image`, {
          method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: relativePath }),
        });
        if (!res.ok) throw new Error('Upload failed');
      }
      toast({ title: 'Image uploaded', description: 'Profile image updated successfully.', variant: 'success' });
      setUploadTarget(null); setCropImgSrc(''); setCrop(undefined); setCompletedCrop(undefined);
      loadStudent(true);
    } catch (e: any) {
      toast({ title: 'Upload failed', description: e?.message || 'Unknown error', variant: 'destructive' });
    } finally { setUploading(false); }
  };

  // ── Action handlers ─────────────────────────────────────────────────────────
  const handleChangeRole = async () => {
    if (!instituteId || !studentId || !newRoleValue) return;
    setChangingRole(true);
    try {
      const headers = await getApiHeadersAsync();
      const res = await fetch(`${getBaseUrl()}/institute-users/institute/${instituteId}/user/${studentId}/change-role`, {
        method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ newRole: newRoleValue }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed');
      toast({ title: 'Role changed', description: `Role updated to ${newRoleValue}` });
      closeDialog(); loadStudent(true);
    } catch (e: any) { toast({ title: 'Error', description: e?.message, variant: 'destructive' }); }
    finally { setChangingRole(false); }
  };
  const handleSetPassword = async () => {
    if (!instituteId || !studentId || newPassword.length < 8 || newPassword !== confirmPassword) return;
    setSettingPassword(true);
    try {
      await setInstituteUserPassword({ instituteId, targetUserId: studentId, newPassword });
      toast({ title: 'Password updated', description: 'Institute password has been set.', variant: 'success' });
      closeDialog();
    } catch (e: any) { toast({ title: 'Error', description: e?.message, variant: 'destructive' }); }
    finally { setSettingPassword(false); }
  };
  const handleOpenExtraData = () => {
    const existing: Record<string, string> = {};
    if (student?.extraData) for (const [k, v] of Object.entries(student.extraData)) existing[k] = String(v ?? '');
    if (extraColumns.length > 0) {
      for (const col of extraColumns) if (!(col.key in existing)) existing[col.key] = '';
      setExtraDataRecord(existing);
    } else {
      setExtraDataRows(Object.keys(existing).length > 0 ? Object.entries(existing).map(([k, v]) => ({ key: k, value: v })) : [{ key: '', value: '' }]);
    }
    openDialog('edit-extra-data');
  };
  const handleSaveExtraData = async () => {
    if (!instituteId || !studentId) return;
    setSavingExtraData(true);
    try {
      let extraData: Record<string, any> | null;
      if (extraColumns.length > 0) {
        extraData = Object.values(extraDataRecord).some(v => v !== '') ? extraDataRecord : null;
      } else {
        const filtered = extraDataRows.filter(r => r.key.trim() !== '');
        extraData = filtered.length > 0 ? Object.fromEntries(filtered.map(r => [r.key.trim(), r.value])) : null;
      }
      await instituteUsersApi.updateInstituteUserExtraData(instituteId, studentId, extraData);
      toast({ title: 'Saved', description: 'Extra data updated.', variant: 'success' });
      closeDialog(); loadStudent(true);
    } catch (e: any) { toast({ title: 'Error', description: e?.message, variant: 'destructive' }); }
    finally { setSavingExtraData(false); }
  };
  const handleDeactivate = async () => {
    if (!instituteId || !studentId) return;
    setDeactivating(true);
    try {
      const headers = await getApiHeadersAsync();
      const res = await fetch(`${getBaseUrl()}/institute-users/institute/${instituteId}/users/${studentId}/deactivate`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed');
      toast({ title: 'User Deactivated', description: 'User account has been deactivated.', variant: 'success' });
      closeDialog();
      navigate(`/institute/${instituteId}/students`);
    } catch (e: any) { toast({ title: 'Error', description: e?.message, variant: 'destructive' }); }
    finally { setDeactivating(false); }
  };
  const handleViewParent = async (id?: string | null) => {
    if (!id) return;
    try { const info = await usersApi.getBasicInfo(id); setUserInfoDialog({ open: true, user: info }); }
    catch (e: any) { toast({ title: 'Error', description: e?.message || 'Could not load user', variant: 'destructive' }); }
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const instituteName = selectedInstitute?.name ?? `Institute ${instituteId}`;
  const initials = (student?.name ?? '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const attendanceStats = { present: attendance.filter(r => r.status?.toLowerCase() === 'present').length, absent: attendance.filter(r => r.status?.toLowerCase() === 'absent').length, late: attendance.filter(r => r.status?.toLowerCase() === 'late').length };
  const paidCount = payments.filter(p => p.submissionStatus === 'VERIFIED').length;
  const pendingCount = payments.filter(p => p.submissionStatus === 'PENDING').length;

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loadingStudent) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading student profile…</p>
        </div>
      </PageContainer>
    );
  }

  if (studentError) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
          <AlertCircle className="h-10 w-10 text-destructive/50" />
          <p className="text-sm text-muted-foreground">{studentError}</p>
          <Button variant="outline" onClick={() => loadStudent(true)}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Retry</Button>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="full">
      {/* Back button + breadcrumb */}
      <div className="flex items-center gap-2 mb-5 text-sm text-muted-foreground flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" />Back
        </Button>
        <span>/</span>
        <span className="text-foreground font-medium">{instituteName}</span>
        <span>/</span>
        <span className="text-foreground font-semibold">{student?.name ?? 'Student'}</span>
        <Badge variant="outline" className="ml-1 text-[10px]">Institute Level</Badge>
      </div>

      {/* Hero card */}
      <Card className="border-border/50 rounded-2xl shadow-lg mb-6 overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-blue-500 via-blue-400 to-indigo-500" />
        <CardContent className="p-4 sm:p-5 md:p-6">
          <div className="flex gap-3 sm:gap-4 items-start flex-wrap">
            {/* Avatar */}
            <div className="shrink-0 relative group cursor-pointer" onClick={() => resolveImageUrl(student?.imageUrl) ? setImagePreview({ isOpen: true, url: resolveImageUrl(student?.imageUrl) || '', title: student.name }) : null}>
              {resolveImageUrl(student?.imageUrl) ? (
                <img src={resolveImageUrl(student?.imageUrl)} alt={student.name} className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl sm:rounded-2xl object-cover ring-2 ring-border shadow-md group-hover:opacity-90 transition-opacity" />
              ) : (
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center ring-2 ring-border shadow-md">
                  <span className="text-lg sm:text-2xl font-bold text-white">{initials}</span>
                </div>
              )}
              <button onClick={(e) => { e.stopPropagation(); setUploadTarget('GLOBAL'); }} className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground rounded-full p-1.5 shadow-md hover:bg-primary/90" title="Upload Global Image">
                <Upload className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">{student?.nameWithInitials || student?.fullName || student?.name || 'Student'}</h1>
                  {student?.fullName && <p className="text-sm font-medium text-muted-foreground mt-0.5 truncate">{student.fullName}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg sm:rounded-xl bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center">
                    <Building2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300 hidden sm:inline">{instituteName}</span>
                </div>
              </div>
              <div className="mt-2 sm:mt-3 flex flex-wrap gap-x-3 sm:gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {student?.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3 shrink-0" />{student.email}</span>}
                {student?.phoneNumber && <span className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{student.phoneNumber}</span>}
                {student?.dateOfBirth && <span className="flex items-center gap-1"><Calendar className="h-3 w-3 shrink-0" />{formatColomboDate(student.dateOfBirth)}</span>}
                {student?.gender && <span className="flex items-center gap-1"><User className="h-3 w-3 shrink-0" />{student.gender}</span>}
              </div>
              {(student?.addressLine1 || student?.city) && (
                <p className="mt-1.5 text-xs text-muted-foreground flex items-start gap-1">
                  <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                  <span className="truncate">{[student.addressLine1, student.city, student.district, student.province].filter(Boolean).join(', ')}</span>
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sections */}
      <div className="space-y-3">

        {/* Institute User Details */}
        <Section id="institute-details" icon={Building2} title="Institute User Details" isOpen={openSections.has('institute-details')} onToggle={() => toggleSection('institute-details')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-muted/10 border border-border/50 rounded-xl">
                <div className="relative group cursor-pointer" onClick={() => resolveImageUrl(student?.instituteImageUrl) ? setImagePreview({ isOpen: true, url: resolveImageUrl(student?.instituteImageUrl) || '', title: `${student.name} — Institute Photo` }) : null}>
                  {resolveImageUrl(student?.instituteImageUrl) ? (
                    <img src={resolveImageUrl(student?.instituteImageUrl)} alt={student.name} className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl object-cover ring-1 ring-border shadow-sm group-hover:opacity-90 transition-opacity" />
                  ) : (
                    <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-xl bg-muted flex items-center justify-center ring-1 ring-border shadow-sm">
                      <span className="text-xl font-bold text-muted-foreground">{initials}</span>
                    </div>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); setUploadTarget('INSTITUTE'); }} className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground rounded-full p-1.5 shadow-md hover:bg-primary/90" title="Upload Institute Image">
                    <Upload className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Institute User Image</p>
                  <p className="text-sm font-medium mt-1">ID: <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{student?.userIdByInstitute || 'N/A'}</span></p>
                </div>
              </div>

              <div className="p-3 bg-muted/30 border border-border rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">User Role</p>
                    <p className="text-sm font-semibold">{student?.role || 'STUDENT'}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setNewRoleValue(student?.role || 'STUDENT'); openDialog('change-role'); }} className="text-xs h-8">
                    <UserCog className="h-3 w-3 mr-1.5" />Change
                  </Button>
                </div>
                <div className="flex items-center justify-between border-t border-border/50 pt-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Organizations</p>
                    <p className="text-xs">Manage assigned organizations</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openDialog('organizations')} className="text-xs h-8">
                    <Building className="h-3 w-3 mr-1.5" />Manage
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-muted/30 border border-border rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" />Extra Information</p>
                  <Button size="sm" variant="ghost" onClick={handleOpenExtraData} className="h-7 w-7 p-0 rounded-full"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></Button>
                </div>
                <div className="space-y-1.5 text-sm">
                  {student?.nic && <div className="flex justify-between py-1 border-b border-border/10"><span className="text-muted-foreground text-xs">NIC</span><span className="font-mono text-xs">{student.nic}</span></div>}
                  {Object.entries(student?.extraData || {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1 border-b border-border/10">
                      <span className="text-muted-foreground text-xs">{k}</span><span className="text-xs font-medium">{String(v)}</span>
                    </div>
                  ))}
                  {!student?.nic && (!student?.extraData || Object.keys(student.extraData).length === 0) && <p className="text-xs text-muted-foreground">No extra data available.</p>}
                </div>
              </div>

              <div className="p-3 bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 rounded-xl space-y-2">
                <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5"><KeyRound className="h-4 w-4" />Institute Password</p>
                <p className="text-[11px] text-blue-600/80 dark:text-blue-400/80 leading-relaxed">
                  This does <strong>not</strong> affect the user's global password. If you have a custom login page (e.g. yourdomain.lk/login), you can change their password here to let them log into your institute portal.
                </p>
                <Button size="sm" variant="outline" className="w-full mt-1 text-xs border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50" onClick={() => { setNewPassword(''); setConfirmPassword(''); openDialog('change-password'); }}>
                  Set Institute Password
                </Button>
              </div>
            </div>
          </div>
        </Section>

        {/* Parents / Family */}
        <Section id="parents" icon={Users} title="Family & Parents" isOpen={openSections.has('parents')} onToggle={() => toggleSection('parents')}>
          <div className="flex justify-end mb-3">
            <Button size="sm" variant="outline" onClick={() => setAssignParentDialog(true)} className="text-xs h-8">
              <UserCog className="h-3.5 w-3.5 mr-1.5" />Assign Parent
            </Button>
          </div>
          {(student?.father || student?.mother || student?.guardian) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {([
                { label: 'Father', data: student?.father, icon: '👨' },
                { label: 'Mother', data: student?.mother, icon: '👩' },
                { label: 'Guardian', data: student?.guardian, icon: '🛡️' },
              ] as const).filter(f => f.data).map(({ label, data, icon }) => (
                <div key={label} className="rounded-xl border border-border bg-muted/30 p-3 sm:p-3.5 flex flex-col cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleViewParent(data?.id || data?.uuid)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {resolveImageUrl(data?.imageUrl) ? (
                        <img src={resolveImageUrl(data?.imageUrl)} alt={data.name} className="h-6 w-6 sm:h-8 sm:w-8 rounded-md sm:rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-md sm:rounded-lg bg-muted flex items-center justify-center text-xs sm:text-sm shrink-0">{icon}</div>
                      )}
                      <p className="text-xs sm:text-sm font-bold text-foreground truncate">{label}</p>
                    </div>
                  </div>
                  {data?.name && <p className="text-sm font-semibold truncate">{data.nameWithInitials || formatNameWithInitials(data.name) || data.name}</p>}
                  {data?.email && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 truncate"><Mail className="h-3 w-3 shrink-0" />{data.email}</p>}
                  {data?.phoneNumber && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3 shrink-0" />{data.phoneNumber}</p>}
                  {data?.occupation && <p className="text-xs text-muted-foreground truncate mt-0.5">{data.occupation}{data.workPlace ? ` @ ${data.workPlace}` : ''}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 bg-muted/20 border border-dashed border-border rounded-xl">
              <p className="text-sm text-muted-foreground">No family information added yet.</p>
            </div>
          )}

          {student?.emergencyContact && (
            <div className="mt-3 rounded-xl border border-orange-200/50 dark:border-orange-800/30 bg-orange-50/50 dark:bg-orange-950/10 p-3 flex items-center gap-2">
              <Heart className="h-4 w-4 text-orange-500 shrink-0" />
              <span className="text-xs text-orange-700 dark:text-orange-300">Emergency: {student.emergencyContact}</span>
            </div>
          )}
          {(student?.medicalConditions || student?.allergies) && (
            <div className="mt-2 rounded-xl border border-red-200/50 dark:border-red-800/30 bg-red-50/50 dark:bg-red-950/10 p-3 space-y-1">
              {student.medicalConditions && <p className="text-xs text-red-700 dark:text-red-300">⚕️ Medical: {student.medicalConditions}</p>}
              {student.allergies && <p className="text-xs text-red-700 dark:text-red-300">⚠️ Allergies: {student.allergies}</p>}
            </div>
          )}
        </Section>

        {/* Institute Attendance */}
        <Section
          id="attendance"
          icon={Calendar}
          title="Institute Attendance"
          badge={attendanceLoaded ? (
            <div className="flex flex-wrap items-center gap-1.5 mr-2">
              <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600"><AttendanceStatusDot status="present" />{attendanceStats.present}</span>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600"><AttendanceStatusDot status="absent" />{attendanceStats.absent}</span>
              {attendanceStats.late > 0 && <span className="flex items-center gap-1 text-[10px] font-semibold text-yellow-600"><AttendanceStatusDot status="late" />{attendanceStats.late}</span>}
            </div>
          ) : undefined}
          isOpen={openSections.has('attendance')}
          onToggle={() => toggleSection('attendance')}
          loading={loadingAttendance}
          error={attendanceError}
          onRetry={() => { setAttendanceLoaded(false); setAttendanceError(null); loadAttendance(true); }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input type="date" value={attendanceStartDate} onChange={e => handleAttendanceDateChange('start', e.target.value)}
                className="h-6 text-[10px] bg-muted/50 border border-border rounded px-1.5 outline-none focus:ring-1 focus:ring-primary" />
              <span>to</span>
              <input type="date" value={attendanceEndDate} onChange={e => handleAttendanceDateChange('end', e.target.value)}
                className="h-6 text-[10px] bg-muted/50 border border-border rounded px-1.5 outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <Select value={String(attendanceLimit)} onValueChange={handleAttendanceLimitChange}>
              <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 rows</SelectItem>
                <SelectItem value="50">50 rows</SelectItem>
                <SelectItem value="100">100 rows</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {loadingAttendance ? (
            <div className="space-y-2">{Array(5).fill(0).map((_, i) => <SkeletonRow key={i} />)}</div>
          ) : attendance.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No attendance records found for this period.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/50">
              <table className="w-full text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    {['Date', 'Event', 'Type', 'Event Start', 'Event End', 'Check-in', 'Status'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {attendance.map((r, i) => {
                    const s = r.status?.toLowerCase() ?? '';
                    return (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{formatColomboDate(r.date)}</td>
                        <td className="px-3 py-2 font-medium max-w-[180px]">
                          {r.eventTitle ? (
                            <span className="truncate block" title={r.eventTitle}>{r.eventTitle}</span>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{r.eventType ?? '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap font-mono">{r.eventStart ? formatColomboTime(r.eventStart) : '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap font-mono">{r.eventEnd ? formatColomboTime(r.eventEnd) : '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap font-mono">{r.markedAt ? formatColomboTime(r.markedAt) : '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded font-semibold ${s === 'present' ? 'bg-green-100 text-green-700' : s === 'absent' ? 'bg-red-100 text-red-700' : s === 'late' ? 'bg-yellow-100 text-yellow-700' : 'bg-muted text-muted-foreground'}`}>
                            {r.status?.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Institute Payments */}
        <Section
          id="payments"
          icon={Banknote}
          title="Institute Payments"
          badge={paymentsLoaded ? (
            <div className="flex gap-1.5 mr-2">
              <span className="text-[10px] font-semibold text-green-600">{paidCount} paid</span>
              {pendingCount > 0 && <span className="text-[10px] font-semibold text-yellow-600">{pendingCount} pending</span>}
            </div>
          ) : undefined}
          isOpen={openSections.has('payments')}
          onToggle={() => toggleSection('payments')}
          loading={loadingPayments}
          error={paymentsError}
          onRetry={() => { setPaymentsLoaded(false); setPaymentsError(null); loadPayments(true); }}
        >
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="include-class-payments"
                checked={includeClassPayments}
                onChange={(e) => setIncludeClassPayments(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <label htmlFor="include-class-payments" className="text-xs text-muted-foreground cursor-pointer">
                Include Class Payments
              </label>
            </div>
            <Select value={String(paymentsLimit)} onValueChange={handlePaymentsLimitChange}>
              <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 rows</SelectItem>
                <SelectItem value="50">50 rows</SelectItem>
                <SelectItem value="100">100 rows</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {loadingPayments ? (
            <div className="space-y-2">{Array(4).fill(0).map((_, i) => <SkeletonRow key={i} />)}</div>
          ) : payments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No institute payments found.</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${p.source === 'CLASS' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                          {p.source === 'CLASS' ? '🎓 Class' : '🏛 Institute'}
                        </span>
                        {p.className && <span className="text-[10px] text-muted-foreground font-medium">{p.className}{p.grade ? ` · ${p.grade}` : ''}</span>}
                      </div>
                      <p className="text-xs font-semibold truncate">{p.paymentType ?? p.description}</p>
                      {p.description && p.paymentType && <p className="text-[10px] text-muted-foreground truncate">{p.description}</p>}
                      {p.dueDate && <p className="text-[10px] text-muted-foreground mt-0.5">Due: {formatColomboDate(p.dueDate)}</p>}
                    </div>
                    <div className="shrink-0 text-right space-y-1">
                      <p className="text-xs font-bold">Rs {Number(p.amount).toLocaleString()}</p>
                      <StatusBadge status={p.submissionStatus} />
                      {p.submittedAmount && p.submittedAmount > 0 && (
                        <p className="text-[10px] text-green-700">Paid: Rs {Number(p.submittedAmount).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

      </div>

      {/* Danger Zone */}
      <div className="mt-8 pt-6 border-t border-destructive/20 flex flex-col items-center">
        <Button variant="destructive" className="w-full sm:w-auto min-w-[250px]" onClick={() => openDialog('deactivate')}>
          <UserMinus className="h-4 w-4 mr-2" />
          Deactivate User Account
        </Button>
      </div>

      {/* Upload Image Dialog */}
      <Dialog open={!!uploadTarget} onOpenChange={() => { setUploadTarget(null); setCropImgSrc(''); setCrop(undefined); setCompletedCrop(undefined); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{uploadTarget === 'GLOBAL' ? 'Upload Global Image' : 'Upload Institute Image'} (35mm × 45mm)</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input type="file" accept="image/*" onChange={handleFileSelect} />
            {cropImgSrc && (
              <div className="max-h-80 overflow-auto rounded-lg flex justify-center">
                <ReactCrop crop={crop} onChange={(_, p) => setCrop(p)} onComplete={c => setCompletedCrop(c)} aspect={PASSPORT_ASPECT_RATIO} minWidth={50} minHeight={50} keepSelection ruleOfThirds style={{ maxHeight: '300px' }}>
                  <img ref={imgRef} alt="Crop preview" src={cropImgSrc} onLoad={onCropImageLoad} style={{ maxHeight: '300px', maxWidth: '100%' }} />
                </ReactCrop>
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center">Passport photo size: 35mm × 45mm (7:9 aspect ratio)</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadTarget(null); setCropImgSrc(''); }}>Cancel</Button>
            <Button onClick={handleImageUpload} disabled={!completedCrop || uploading}>
              {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</> : <><Upload className="h-4 w-4 mr-2" />Upload</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Password Dialog */}
      <Dialog open={isSetPasswordDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Institute Password</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <Input type="password" placeholder="Enter new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm Password</label>
              <Input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-sm text-destructive font-medium">Passwords do not match</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSetPassword} disabled={settingPassword || !newPassword || newPassword !== confirmPassword}>
              {settingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation Dialog */}
      <Dialog open={isDeactivateDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md border-destructive/20">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Confirm Deactivation
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to completely deactivate <strong>{student?.name}</strong>?
            </p>
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-md leading-relaxed">
              This action will disable their access to this institute immediately. They will no longer be able to log in or access any institute resources.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={deactivating}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeactivate} disabled={deactivating}>
              {deactivating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : 'Deactivate User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={isChangeRoleDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change User Role</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Changing role for <strong>{student?.name}</strong></p>
            <Select value={newRoleValue} onValueChange={setNewRoleValue}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="STUDENT">Student</SelectItem>
                <SelectItem value="TEACHER">Teacher</SelectItem>
                <SelectItem value="INSTITUTE_ADMIN">Institute Admin</SelectItem>
                <SelectItem value="ATTENDANCE_MARKER">Attendance Marker</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleChangeRole} disabled={changingRole || !newRoleValue}>
              {changingRole ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Changing...</> : 'Change Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Parent Dialog */}
      <Dialog open={assignParentDialog} onOpenChange={setAssignParentDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Assign Parent to Student</DialogTitle></DialogHeader>
          {student && <div className="mb-3 p-3 bg-muted rounded-lg"><p className="text-sm text-muted-foreground">Assigning parent to:</p><p className="font-medium">{student.name}</p></div>}
          <AssignParentByPhoneForm
            studentId={studentId || ''}
            onSubmit={() => { setAssignParentDialog(false); loadStudent(); }}
            onCancel={() => setAssignParentDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Extra Data Dialog */}
      <Dialog open={isEditExtraDataDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Extra Data — {student?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {extraColumns.length > 0 ? (
              <ExtraDataFields columns={extraColumns} values={extraDataRecord} onChange={setExtraDataRecord} userType="Student" />
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Add custom key-value fields for this student.</p>
                <div className="space-y-2">
                  {extraDataRows.map((row, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input className="flex-1" placeholder="Key" value={row.key} onChange={e => { const n = [...extraDataRows]; n[idx] = { ...n[idx], key: e.target.value }; setExtraDataRows(n); }} />
                      <Input className="flex-1" placeholder="Value" value={row.value} onChange={e => { const n = [...extraDataRows]; n[idx] = { ...n[idx], value: e.target.value }; setExtraDataRows(n); }} />
                      <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive" onClick={() => setExtraDataRows(extraDataRows.filter((_, i) => i !== idx))}><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 mt-1" onClick={() => setExtraDataRows([...extraDataRows, { key: '', value: '' }])}><Plus className="h-4 w-4" />Add field</Button>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSaveExtraData} disabled={savingExtraData}>
              {savingExtraData ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Organizations Dialog */}
      {student && isOrgDialogOpen && (
        <UserOrganizationsDialog
          open={true}
          onOpenChange={(open) => !open && closeDialog()}
          userId={student.id}
          userName={student.name}
        />
      )}

      {/* Parent/User Info Dialog */}
      <UserInfoDialog open={userInfoDialog.open} onClose={() => setUserInfoDialog({ open: false, user: null })} user={userInfoDialog.user} />

      {/* Image Preview Modal */}
      <ImagePreviewModal isOpen={imagePreview.isOpen} onClose={() => setImagePreview({ isOpen: false, url: '', title: '' })} imageUrl={imagePreview.url} title={imagePreview.title} />

    </PageContainer>
  );
};

export default StudentInstituteProfilePage;
