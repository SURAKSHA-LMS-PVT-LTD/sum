import React, { useState, useEffect, useRef, useCallback } from 'react';
import PageContainer from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Banknote, Search, CheckCircle, Loader2, User, XCircle, Clock,
  AlertCircle, RefreshCw, BookOpen, School, Phone, Mail,
  Hash, IdCard, BarChart3, ArrowRight, ExternalLink,
  Building2, Layers,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { subjectPaymentsApi, SubjectPayment } from '@/api/subjectPayments.api';
import { classPaymentsApi, ClassPayment } from '@/api/classPayments.api';
import { instituteClassesApi } from '@/api/instituteClasses.api';
import { instituteApi } from '@/api/institute.api';
import { usersApi } from '@/api/users.api';
import { subjectsApi } from '@/api/subjects.api';
import { useAuth } from '@/contexts/AuthContext';
import { buildSidebarUrl } from '@/utils/pageNavigation';
import { financeApi } from '@/api/finance.api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentInfo {
  uuid: string;
  nameWithInitials: string;
  image?: string;
  instituteUserId: string;
  paymentHistory?: Array<{ status: string; amount: number; date: string; note: string | null }>;
}
type PaymentScope = 'subject' | 'class' | 'institute';
type SearchMode = 'id' | 'instituteId' | 'phone' | 'email';
type PaymentTier = 'full' | 'half' | 'quarter';

interface CollectDialogState {
  date: string;
  notes: string;
  tier: PaymentTier;
  targetAccountId?: string;
}
interface ClassOption { id: string; name: string; code: string; }
interface SubjectOption { id: string; name: string; code: string; }

interface InstPayment {
  id: string;
  paymentType: string;
  title?: string;
  description: string;
  amount: string | number;
  dueDate?: string;
  status: string;
}

// paymentId → array of submissions for the current student
type StudentSubMap = Record<string, Array<{ status: string; submittedAmount: string; paymentId: string; id: string }>>;

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_LABEL: Record<PaymentTier, string> = { full: 'Full', half: 'Half (50%)', quarter: 'Quarter (25%)' };
const TIER_MULT: Record<PaymentTier, number> = { full: 1, half: 0.5, quarter: 0.25 };
const SEARCH_MODES: { id: SearchMode; label: string; icon: React.ElementType; placeholder: string }[] = [
  { id: 'id',          label: 'System ID',   icon: Hash,   placeholder: 'Student system ID…' },
  { id: 'instituteId', label: 'Institute ID', icon: IdCard, placeholder: 'Institute user ID…' },
  { id: 'phone',       label: 'Phone',        icon: Phone,  placeholder: '07X XXXXXXX…' },
  { id: 'email',       label: 'Email',        icon: Mail,   placeholder: 'student@example.com…' },
];

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status?: string | null }) => {
  if (!status) return <Badge variant="outline" className="text-gray-400 gap-1 text-[10px]"><AlertCircle className="h-3 w-3" />Not paid</Badge>;
  if (status === 'VERIFIED')        return <Badge className="bg-green-100 text-green-800 border-green-200 gap-1 text-[10px]"><CheckCircle className="h-3 w-3" />Verified</Badge>;
  if (status === 'HALF_VERIFIED')   return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1 text-[10px]"><CheckCircle className="h-3 w-3" />Half paid</Badge>;
  if (status === 'QUARTER_VERIFIED') return <Badge className="bg-teal-100 text-teal-800 border-teal-200 gap-1 text-[10px]"><CheckCircle className="h-3 w-3" />Quarter paid</Badge>;
  if (status === 'PENDING')         return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 gap-1 text-[10px]"><Clock className="h-3 w-3" />Pending verify</Badge>;
  if (status === 'REJECTED')        return <Badge className="bg-red-100 text-red-800 border-red-200 gap-1 text-[10px]"><XCircle className="h-3 w-3" />Rejected</Badge>;
  return <Badge variant="outline" className="text-gray-400 gap-1 text-[10px]"><AlertCircle className="h-3 w-3" />Not paid</Badge>;
};

// ─── Main Component ───────────────────────────────────────────────────────────

const CollectPhysicalPayment: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { selectedInstitute, selectedClass: ctxClass, selectedSubject: ctxSubject } = useAuth();
  const instituteId = selectedInstitute?.id;

  // ── URL-driven tab / scope / popup ────────────────────────────────────────
  // ?tab=overview           (default: collect)
  // ?scope=institute        (default: subject)
  // ?popup=collect          (collect dialog open)
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as 'collect' | 'overview') || 'collect';
  const paymentScope = (searchParams.get('scope') as PaymentScope) || 'class';

  const setActiveTab = (tab: 'collect' | 'overview') =>
    setSearchParams(p => { p.set('tab', tab); return p; }, { replace: true });

  const setPaymentScope = (scope: PaymentScope) => {
    setSelectedPaymentIds(new Set());
    setStudent(null); setHasSearched(false); setSearchQuery(''); setStudentSubMap({});
    setSearchParams(p => { p.set('scope', scope); if (scope === 'institute') p.delete('tab'); return p; }, { replace: true });
  };

  // Close collect dialog and remove popup param from URL
  const closeCollectDialog = () => {
    setCollectDialog(null);
    setSearchParams(p => { p.delete('popup'); return p; }, { replace: true });
  };

  // ── Class / Subject selection ──────────────────────────────────────────────
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [pickedClassId, setPickedClassId] = useState<string>(ctxClass?.id || '');
  const effectiveClassId = pickedClassId || ctxClass?.id || '';

  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [pickedSubjectId, setPickedSubjectId] = useState<string>(ctxSubject?.id || '');
  const effectiveSubjectId = pickedSubjectId || ctxSubject?.id || '';

  const effectiveClassName = classes.find(c => c.id === effectiveClassId)?.name || ctxClass?.name || '';
  const effectiveSubjectName = subjects.find(s => s.id === effectiveSubjectId)?.name || ctxSubject?.name || '';

  // ── Subject payments list ──────────────────────────────────────────────────
  const [payments, setPayments] = useState<SubjectPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());

  // ── Institute-level payments ───────────────────────────────────────────────
  const [instPayments, setInstPayments] = useState<InstPayment[]>([]);
  const [loadingInstPayments, setLoadingInstPayments] = useState(false);

  // ── Class-level payments ────────────────────────────────────────────────────
  const [classPayments, setClassPayments] = useState<ClassPayment[]>([]);
  const [loadingClassPayments, setLoadingClassPayments] = useState(false);
  const [classStudentSubMap, setClassStudentSubMap] = useState<StudentSubMap>({});
  const [loadingClassSubStatus, setLoadingClassSubStatus] = useState(false);

  // ── Student submission status map (subjectMode) ───────────────────────────
  const [studentSubMap, setStudentSubMap] = useState<StudentSubMap>({});
  const [loadingSubStatus, setLoadingSubStatus] = useState(false);

  // ── Overview tab state ─────────────────────────────────────────────────────
  const [overviewSubjects, setOverviewSubjects] = useState<SubjectOption[]>([]);
  const [overviewPayments, setOverviewPayments] = useState<SubjectPayment[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // ── Student search ─────────────────────────────────────────────────────────
  const [searchMode, setSearchMode] = useState<SearchMode>('id');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const searchCache = useRef<Record<string, StudentInfo>>({});

  // ── Collect dialog ─────────────────────────────────────────────────────────
  const [collectDialog, setCollectDialog] = useState<CollectDialogState | null>(null);
  const [collecting, setCollecting] = useState(false);

  // ── Right panel tabs (Find Student vs Student Details) ──────────────────────
  const [rightPanelTab, setRightPanelTab] = useState<'find' | 'details'>('find');

  // ── Finance accounts (for ledger routing) ─────────────────────────────────
  const [financeAccounts, setFinanceAccounts] = useState<Array<{ id: string; name: string; type: string }>>([]);

  // ── Institute-scope student submission status ──────────────────────────────
  const [instStudentSubMap, setInstStudentSubMap] = useState<Record<string, string>>({});
  const [loadingInstSubStatus, setLoadingInstSubStatus] = useState(false);

  // ── Summary dialog ─────────────────────────────────────────────────────────
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryData, setSummaryData] = useState<Array<{
    subject: SubjectOption;
    payments: SubjectPayment[];
    subMap: StudentSubMap;
  }>>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Load finance accounts for ledger routing
  useEffect(() => {
    if (!instituteId) return;
    financeApi.getAccounts().then(accs => setFinanceAccounts(accs)).catch(() => {});
  }, [instituteId]);

  // Data loading
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!instituteId || ctxClass) return;
    setLoadingClasses(true);
    instituteClassesApi.getByInstitute(instituteId, { page: 1, limit: 100 })
      .then(res => setClasses((Array.isArray(res) ? res : (res as any)?.data ?? []).filter((c: any) => c.isActive !== false)))
      .catch(() => setClasses([]))
      .finally(() => setLoadingClasses(false));
  }, [instituteId, ctxClass]);

  // Load subjects — fix: ClassSubject shape has subjectId + subject.name
  useEffect(() => {
    if (!instituteId || !effectiveClassId || ctxSubject || paymentScope !== 'subject') return;
    setSubjects([]); setPickedSubjectId('');
    setLoadingSubjects(true);
    subjectsApi.getAll(instituteId, { classId: effectiveClassId })
      .then((res: any) => {
        const list: SubjectOption[] = ((res as any)?.data ?? res ?? []).map((s: any) => ({
          id: s.subjectId ?? s.subject?.id ?? s.id,
          name: s.subject?.name ?? s.name ?? s.subjectName ?? s.subjectId,
          code: s.subject?.code ?? s.code ?? '',
        }));
        setSubjects(list);
      })
      .catch(() => setSubjects([]))
      .finally(() => setLoadingSubjects(false));
  }, [instituteId, effectiveClassId, ctxSubject, paymentScope]);

  // Load subject payments
  useEffect(() => {
    if (paymentScope !== 'subject' || !instituteId || !effectiveClassId || !effectiveSubjectId) {
      setPayments([]); setSelectedPaymentIds(new Set()); return;
    }
    setLoadingPayments(true);
    subjectPaymentsApi.getSubjectPayments(instituteId, effectiveClassId, effectiveSubjectId, 1, 100)
      .then((res: any) => {
        const raw = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setPayments(raw.filter((p: SubjectPayment) => p.status === 'ACTIVE'));
      })
      .catch(() => setPayments([]))
      .finally(() => setLoadingPayments(false));
  }, [paymentScope, instituteId, effectiveClassId, effectiveSubjectId]);

  // Load institute-level payments
  useEffect(() => {
    if (paymentScope !== 'institute' || !instituteId) return;
    setLoadingInstPayments(true);
    apiClient.get(`/institute-payments/institute/${instituteId}/payments`, { page: 1, limit: 100, status: 'ACTIVE' })
      .then((res: any) => {
        // Response shape: { data: { payments: [...], pagination: {} } }
        // Also handles: { data: [...] } | { payments: [...] } | direct array
        const arr = Array.isArray(res) ? res
          : Array.isArray(res?.data?.payments) ? res.data.payments
          : Array.isArray(res?.data) ? res.data
          : Array.isArray(res?.payments) ? res.payments
          : Array.isArray(res?.items) ? res.items
          : [];
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
        setInstPayments(arr.filter((p: any) => {
          if (!p.dueDate) return true;
          return new Date(p.dueDate) >= todayStart;
        }));
      })
      .catch(() => setInstPayments([]))
      .finally(() => setLoadingInstPayments(false));
  }, [paymentScope, instituteId]);

  // Load class-level payments
  useEffect(() => {
    if (paymentScope !== 'class' || !instituteId || !effectiveClassId) return;
    setLoadingClassPayments(true);
    classPaymentsApi.getClassPayments(instituteId, effectiveClassId, 1, 100)
      .then((res: any) => {
        const raw = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setClassPayments(raw.filter((p: ClassPayment) => p.status === 'ACTIVE'));
      })
      .catch(() => setClassPayments([]))
      .finally(() => setLoadingClassPayments(false));
  }, [paymentScope, instituteId, effectiveClassId]);

  // Load student's submission status for current subject
  const loadStudentSubjectStatus = useCallback(async (studentUuid: string) => {
    if (!instituteId || !effectiveClassId || !effectiveSubjectId || paymentScope !== 'subject') return;
    setLoadingSubStatus(true);
    try {
      const res = await subjectPaymentsApi.getAllSubmissions(
        instituteId, effectiveClassId, effectiveSubjectId,
        { page: 1, limit: 100 }
      );
      const map: StudentSubMap = {};
      for (const sub of res.data || []) {
        if (sub.userId === studentUuid) {
          if (!map[sub.paymentId]) map[sub.paymentId] = [];
          map[sub.paymentId].push({ status: sub.status, submittedAmount: sub.submittedAmount, paymentId: sub.paymentId, id: sub.id });
        }
      }
      setStudentSubMap(map);
    } catch { setStudentSubMap({}); }
    finally { setLoadingSubStatus(false); }
  }, [instituteId, effectiveClassId, effectiveSubjectId, paymentScope]);

  // Load institute-payment submission status for a student
  const loadStudentInstituteStatus = useCallback(async (studentUuid: string) => {
    if (!instituteId || paymentScope !== 'institute') return;
    setLoadingInstSubStatus(true);
    const map: Record<string, string> = {};
    try {
      const res: any = await apiClient.get(
        `/institute-payment-submissions/institute/${instituteId}/student/${studentUuid}/submissions`,
        { page: 1, limit: 100 }
      );
      const subs: any[] = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      const order = ['VERIFIED', 'HALF_VERIFIED', 'QUARTER_VERIFIED', 'PENDING', 'REJECTED'];
      for (const s of subs) {
        const pid = s.paymentId ?? s.payment_id;
        if (!pid) continue;
        if (!map[pid] || order.indexOf(s.status) < order.indexOf(map[pid])) {
          map[pid] = s.status;
        }
      }
    } catch { /* non-critical */ }
    setInstStudentSubMap(map);
    setLoadingInstSubStatus(false);
  }, [instituteId, paymentScope]);

  // Load student's submission status for class-level payments
  const loadStudentClassStatus = useCallback(async (studentUuid: string) => {
    if (!instituteId || !effectiveClassId || paymentScope !== 'class') return;
    setLoadingClassSubStatus(true);
    try {
      const res = await classPaymentsApi.getStudentClassSubmissions(
        instituteId, effectiveClassId, studentUuid,
        { page: 1, limit: 100 }
      );
      const map: StudentSubMap = {};
      for (const sub of res.data || []) {
        if (!map[sub.paymentId]) map[sub.paymentId] = [];
        map[sub.paymentId].push({ status: sub.status, submittedAmount: sub.submittedAmount, paymentId: sub.paymentId, id: sub.id });
      }
      setClassStudentSubMap(map);
    } catch { setClassStudentSubMap({}); }
    finally { setLoadingClassSubStatus(false); }
  }, [instituteId, effectiveClassId, paymentScope]);

  useEffect(() => {
    if (student?.uuid) {
      loadStudentSubjectStatus(student.uuid);
      if (paymentScope === 'institute') loadStudentInstituteStatus(student.uuid);
      if (paymentScope === 'class') loadStudentClassStatus(student.uuid);
    } else {
      setStudentSubMap({});
      setInstStudentSubMap({});
      setClassStudentSubMap({});
    }
  }, [student?.uuid, effectiveSubjectId, paymentScope]);

  // Load overview when tab switches
  useEffect(() => {
    if (activeTab !== 'overview' || !instituteId || !effectiveClassId) return;
    setLoadingOverview(true);
    Promise.all([
      subjectsApi.getAll(instituteId, { classId: effectiveClassId }).catch(() => null),
      subjectPaymentsApi.getPaymentsByClass(instituteId, effectiveClassId, 1, 200).catch(() => null),
      classPaymentsApi.getClassPayments(instituteId, effectiveClassId, 1, 200).catch(() => null),
    ]).then(([subjectsRes, paymentsRes, classPaymentsRes]) => {
      const subjectList: SubjectOption[] = ((subjectsRes as any)?.data ?? subjectsRes ?? []).map((s: any) => ({
        id: s.subjectId ?? s.subject?.id ?? s.id,
        name: s.subject?.name ?? s.name ?? s.subjectName ?? s.subjectId,
        code: s.subject?.code ?? s.code ?? '',
      }));
      setOverviewSubjects([
        { id: 'class-level', name: 'Class Level Payments', code: 'CLASS' },
        ...subjectList
      ]);
      const praw: any = paymentsRes;
      const parsedSubj = Array.isArray(praw) ? praw : Array.isArray(praw?.data) ? praw.data : [];
      
      const craw: any = classPaymentsRes;
      const parsedClass = Array.isArray(craw) ? craw : Array.isArray(craw?.data) ? craw.data : [];
      const classMapped = parsedClass.map((cp: any) => ({
        ...cp,
        subjectId: 'class-level',
      }));
      setOverviewPayments([...parsedSubj, ...classMapped]);
    }).finally(() => setLoadingOverview(false));
  }, [activeTab, instituteId, effectiveClassId]);

  // Close collect dialog when browser back removes ?popup=collect
  useEffect(() => {
    if (!searchParams.has('popup') && collectDialog) setCollectDialog(null);
   
  }, [searchParams.get('popup')]);

  // Reset student when class/subject context changes
  useEffect(() => {
    setStudent(null); setHasSearched(false); setSearchQuery('');
    setStudentSubMap({}); setInstStudentSubMap({}); setSelectedPaymentIds(new Set());
  }, [effectiveClassId, effectiveSubjectId]);

  // ─────────────────────────────────────────────────────────────────────────
  // Reload payments lists after collection
  // ─────────────────────────────────────────────────────────────────────────
  const reloadPayments = useCallback(async () => {
    if (!instituteId) return;
    if (paymentScope === 'subject' && effectiveClassId && effectiveSubjectId) {
      try {
        const res: any = await subjectPaymentsApi.getSubjectPayments(instituteId, effectiveClassId, effectiveSubjectId, 1, 100);
        const raw = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setPayments(raw.filter((p: SubjectPayment) => p.status === 'ACTIVE'));
      } catch { setPayments([]); }
    } else if (paymentScope === 'class' && effectiveClassId) {
      try {
        const res: any = await classPaymentsApi.getClassPayments(instituteId, effectiveClassId, 1, 100);
        const raw = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setClassPayments(raw.filter((p: ClassPayment) => p.status === 'ACTIVE'));
      } catch { setClassPayments([]); }
    } else if (paymentScope === 'institute') {
      try {
        const res: any = await apiClient.get(`/institute-payments/institute/${instituteId}/payments`, { page: 1, limit: 100, status: 'ACTIVE' });
        const arr: any[] = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setInstPayments(arr.filter((p: any) => {
          const due = p.dueDate ? new Date(p.dueDate) : null;
          return !due || due >= new Date(new Date().toISOString().slice(0, 10));
        }));
      } catch { setInstPayments([]); }
    }
  }, [paymentScope, instituteId, effectiveClassId, effectiveSubjectId]);

  // Summary loading — per subject, get student submissions
  // ─────────────────────────────────────────────────────────────────────────
  const openSummary = async () => {
    if (!student) return;
    setSummaryOpen(true);
    if (!effectiveClassId) return;
    setLoadingSummary(true);
    try {
      const [subjectsRes, paymentsRes] = await Promise.all([
        subjectsApi.getAll(instituteId!, { classId: effectiveClassId }).catch(() => null),
        subjectPaymentsApi.getPaymentsByClass(instituteId!, effectiveClassId, 1, 200).catch(() => null),
      ]);
      const allSubjects: SubjectOption[] = ((subjectsRes as any)?.data ?? subjectsRes ?? []).map((s: any) => ({
        id: s.subjectId ?? s.subject?.id ?? s.id,
        name: s.subject?.name ?? s.name ?? s.subjectName ?? s.subjectId,
        code: s.subject?.code ?? s.code ?? '',
      }));
      const allPayments: SubjectPayment[] = (paymentsRes as any)?.data ?? [];

      // Load submissions per subject
      const result: typeof summaryData = [];
      const uniqueSubjectIds = [...new Set(allPayments.map(p => p.subjectId))];
      await Promise.all(
        uniqueSubjectIds.map(async (subId) => {
          try {
            const res = await subjectPaymentsApi.getAllSubmissions(
              instituteId!, effectiveClassId, subId, { page: 1, limit: 100 }
            );
            const subMap: StudentSubMap = {};
            for (const sub of res.data || []) {
              if (sub.userId === student.uuid) {
                if (!subMap[sub.paymentId]) subMap[sub.paymentId] = [];
                subMap[sub.paymentId].push({ status: sub.status, submittedAmount: sub.submittedAmount, paymentId: sub.paymentId, id: sub.id });
              }
            }
            const subject = allSubjects.find(s => s.id === subId) ?? { id: subId, name: subId, code: '' };
            const subjPayments = allPayments.filter(p => p.subjectId === subId);
            result.push({ subject, payments: subjPayments, subMap });
          } catch { /* skip subject */ }
        })
      );
      setSummaryData(result.sort((a, b) => a.subject.name.localeCompare(b.subject.name)));
    } catch { /* ignore */ }
    finally { setLoadingSummary(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Navigation
  // ─────────────────────────────────────────────────────────────────────────
  const goToSubmissions = (_subjectId: string) => {
    // Subject-level submissions page is disabled; go back to the physical payments list
    navigate('/payment-submissions-physical');
  };

  const goToStudents = () => {
    navigate(buildSidebarUrl('students', { instituteId, classId: effectiveClassId }));
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Search
  // ─────────────────────────────────────────────────────────────────────────
  const handleSearch = async (bypass = false) => {
    if (!searchQuery.trim()) { toast({ title: 'Enter a search value', variant: 'destructive' }); return; }
    if (!instituteId) { toast({ title: 'No institute selected', variant: 'destructive' }); return; }

    const cacheKey = `${instituteId}-${searchMode}-${searchQuery.trim()}`;
    if (!bypass && searchCache.current[cacheKey]) {
      setStudent(searchCache.current[cacheKey]); setHasSearched(true); return;
    }

    setSearching(true); setStudent(null); setHasSearched(true); setStudentSubMap({});
    try {
      let resolvedStudentId = searchQuery.trim();
      if (searchMode === 'phone') {
        const lu = await usersApi.lookupByPhone(searchQuery.trim());
        if (!lu?.id) throw new Error('No user found with that phone number.');
        resolvedStudentId = lu.id;
      } else if (searchMode === 'email') {
        const lu = await usersApi.lookupByEmail(searchQuery.trim().toLowerCase());
        if (!lu?.id) throw new Error('No user found with that email.');
        resolvedStudentId = lu.id;
      }
      const params: Record<string, any> = { studentId: resolvedStudentId };
      if (bypass) params._t = Date.now();
      const res: any = await apiClient.get(`/institute-payments/institute/${instituteId}/search-student`, params);
      if (!res?.student) throw new Error('Student not found in this institute.');
      const info: StudentInfo = {
        ...res.student,
        paymentHistory: res.paymentHistory ?? [],
      };
      searchCache.current[cacheKey] = info;
      setStudent(info);
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode;
      toast({
        title: status === 404 ? 'Not Found' : 'Error',
        description: status === 404 ? 'Student not found in this institute.' : err?.message || 'Search failed.',
        variant: 'destructive',
      });
    } finally { setSearching(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Payment toggle helper
  // ─────────────────────────────────────────────────────────────────────────
  const togglePayment = (id: string) => {
    setSelectedPaymentIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const rawActive = paymentScope === 'subject' ? payments : paymentScope === 'class' ? classPayments : instPayments;
  const activePayments: any[] = Array.isArray(rawActive) ? rawActive : [];
  const selectedPayments = activePayments.filter((p: any) => selectedPaymentIds.has(p.id));
  const totalSelected = selectedPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

  // Best student status for a payment (pick most favorable)
  const getBestStatus = (paymentId: string) => {
    const subs = paymentScope === 'class' ? classStudentSubMap[paymentId] : studentSubMap[paymentId];
    if (!subs || subs.length === 0) return null;
    const order = ['VERIFIED', 'HALF_VERIFIED', 'QUARTER_VERIFIED', 'PENDING', 'REJECTED'];
    return subs.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))[0];
  };

  // Sum of already verified/partially-verified amounts for a payment
  const getAlreadyPaid = (paymentId: string) => {
    const map = paymentScope === 'class' ? classStudentSubMap : studentSubMap;
    return (map[paymentId] ?? [])
      .filter(s => ['VERIFIED', 'HALF_VERIFIED', 'QUARTER_VERIFIED'].includes(s.status))
      .reduce((sum, s) => sum + Number(s.submittedAmount), 0);
  };

  // Amount remaining to collect, given a tier target
  // e.g. original 3500, paid 1500, tier full → 3500 - 1500 = 2000
  const getToCollect = (paymentId: string, originalAmount: number, tier: PaymentTier) => {
    const paid = paymentScope === 'subject' || paymentScope === 'class' ? getAlreadyPaid(paymentId) : 0;
    const target = originalAmount * TIER_MULT[tier];
    return Math.max(0, target - paid);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Collect
  // ─────────────────────────────────────────────────────────────────────────
  const openCollectDialog = () => {
    if (selectedPaymentIds.size === 0) { toast({ title: 'Select at least one payment', variant: 'destructive' }); return; }
    if (!student) { toast({ title: 'Search for a student first', variant: 'destructive' }); return; }
    setCollectDialog({ date: new Date().toISOString().slice(0, 10), notes: '', tier: 'full' });
    setSearchParams(p => { p.set('popup', 'collect'); return p; }, { replace: false });
  };

  const handleCollect = async () => {
    if (!collectDialog || !student?.uuid || selectedPaymentIds.size === 0) return;
    setCollecting(true);
    let successCount = 0;
    const errors: string[] = [];

    for (const paymentId of selectedPaymentIds) {
      const p: any = activePayments.find((x: any) => x.id === paymentId);
      if (!p) continue;
      const amt = getToCollect(paymentId, Number(p.amount), collectDialog.tier);
      if (amt <= 0) {
        // Already fully covered by prior payments — skip silently
        successCount++;
        continue;
      }
      try {
        if (paymentScope === 'subject') {
          await subjectPaymentsApi.adminVerifyStudentCspPayment(paymentId, student.uuid, {
            amount: amt, date: collectDialog.date, notes: collectDialog.notes || undefined, paymentTier: collectDialog.tier,
            targetAccountId: collectDialog.targetAccountId || undefined,
          });
        } else if (paymentScope === 'class') {
          await classPaymentsApi.adminVerifyStudentClassPayment(paymentId, student.uuid, {
            amount: amt, date: collectDialog.date, notes: collectDialog.notes || undefined, paymentTier: collectDialog.tier,
            targetAccountId: collectDialog.targetAccountId || undefined,
          });
        } else {
          await apiClient.post(
            `/institute-payments/institute/${instituteId}/payment/${paymentId}/admin-verify-student/${student.uuid}`,
            { amount: amt, date: collectDialog.date, notes: collectDialog.notes || undefined }
          );
        }
        successCount++;
      } catch (err: any) {
        const label = p.title ?? p.paymentType ?? p.description ?? paymentId;
        const errorMsg = 
          err?.status === 409 ? 'Already recorded' :
          err?.status === 400 && err?.message?.includes('already has a verified payment') ? 'Student already has verified payment' :
          err?.message || 'Failed';
        errors.push(`${label}: ${errorMsg}`);
      }
    }

    if (successCount > 0) {
      toast({ title: `${successCount} payment${successCount > 1 ? 's' : ''} collected`, description: `For ${student.nameWithInitials}.` });
    }
    if (errors.length > 0) {
      toast({ title: 'Some failed', description: errors.slice(0, 3).join(' · '), variant: 'destructive' });
    }

    closeCollectDialog();
    if (successCount > 0) {
      setSelectedPaymentIds(new Set());
      Object.keys(searchCache.current).forEach(k => { if (k.includes(student.uuid)) delete searchCache.current[k]; });
      if (paymentScope === 'subject') await loadStudentSubjectStatus(student.uuid);
      if (paymentScope === 'class') await loadStudentClassStatus(student.uuid);
      await reloadPayments();
    }
    setCollecting(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Guards & computed
  // ─────────────────────────────────────────────────────────────────────────
  if (!selectedInstitute) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <School className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Select an institute to collect payments.</p>
        </div>
      </PageContainer>
    );
  }

  const modeConfig = SEARCH_MODES.find(m => m.id === searchMode)!;

  const overviewGrouped = overviewSubjects.map(subj => ({
    subject: subj,
    payments: overviewPayments.filter(p => p.subjectId === subj.id),
  })).filter(g => g.payments.length > 0);

  const knownSubjectIds = new Set(overviewSubjects.map(s => s.id));
  const orphanPayments = overviewPayments.filter(p => !knownSubjectIds.has(p.subjectId));

  const needsClass = paymentScope === 'class';
  const needsSubject = paymentScope === 'subject';
  const canSearch = paymentScope === 'institute' || (paymentScope === 'class' && !!effectiveClassId) || (paymentScope === 'subject' && !!effectiveClassId && !!effectiveSubjectId);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <PageContainer maxWidth="full">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="relative mb-7">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-6 h-40 bg-gradient-to-b from-primary/5 via-transparent to-transparent blur-2xl -z-10" />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shrink-0 shadow-xl shadow-primary/30 ring-1 ring-white/20">
              <Banknote className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-primary/80 mb-1">
                Counter · Physical Collection
              </p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground leading-tight">
                Collect Payment
              </h1>
              <p className="text-xs text-muted-foreground mt-1">{selectedInstitute.name}</p>
            </div>
          </div>

          <div className="flex rounded-2xl border border-border/60 bg-background/60 backdrop-blur-md p-1 gap-1 shadow-sm">
            <button type="button" onClick={() => setActiveTab('collect')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'collect' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30' : 'text-muted-foreground hover:text-foreground'}`}>
              <Banknote className="h-4 w-4" />Collect
            </button>
            <button type="button" onClick={() => setActiveTab('overview')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'overview' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30' : 'text-muted-foreground hover:text-foreground'}`}>
              <BarChart3 className="h-4 w-4" />Overview
            </button>
          </div>
        </div>
        <div className="mt-5 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* ── COLLECT TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'collect' && (
        <div className="space-y-4">

          {/* Header with Tabs + Payment Type Selector + Class Selector */}
          <div className="space-y-4">
            {/* Top Row: Tabs + Payment Scope */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Tabs + Payment Type */}
              <div className="flex gap-2 items-center flex-wrap">
                {/* Payment Scope Selector */}
                <div className="flex rounded-xl border border-border bg-muted/40 p-1 gap-1">
                  <button type="button" onClick={() => setPaymentScope('class')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      paymentScope === 'class' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-muted-foreground hover:text-foreground'}`}>
                    <School className="h-4 w-4" />Class
                  </button>
                  <button type="button" onClick={() => setPaymentScope('institute')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      paymentScope === 'institute' ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-muted-foreground hover:text-foreground'}`}>
                    <Building2 className="h-4 w-4" />Institute
                  </button>
                </div>
              </div>
            </div>

            {/* Class & Subject Selectors - Bigger Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Class Selector */}
              {(needsSubject || needsClass) && !ctxClass && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Select Class</label>
                  {loadingClasses ? (
                    <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground px-3 rounded-lg border border-border/60 bg-muted/20">
                      <Loader2 className="h-4 w-4 animate-spin" />Loading
                    </div>
                  ) : (
                    <Select value={pickedClassId} onValueChange={v => { setPickedClassId(v); setPickedSubjectId(''); }}>
                      <SelectTrigger className="h-10 text-sm rounded-lg border-border/60 bg-muted/20 font-medium">
                        <SelectValue placeholder="Choose a class…" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map(c => <SelectItem key={c.id} value={c.id} className="text-sm">{c.name} ({c.code})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Subject Selector */}
              {needsSubject && effectiveClassId && !ctxSubject && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Select Subject</label>
                  {loadingSubjects ? (
                    <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground px-3 rounded-lg border border-border/60 bg-muted/20">
                      <Loader2 className="h-4 w-4 animate-spin" />Loading
                    </div>
                  ) : (
                    <Select value={pickedSubjectId} onValueChange={setPickedSubjectId}>
                      <SelectTrigger className="h-10 text-sm rounded-lg border-border/60 bg-muted/20 font-medium">
                        <SelectValue placeholder="Choose a subject…" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map(s => <SelectItem key={s.id} value={s.id} className="text-sm">{s.name} ({s.code})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Context badges */}
              {ctxClass && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Class Selected</label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/50 h-10">
                    <School className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-semibold text-sm text-blue-900 dark:text-blue-100 truncate">{ctxClass.name}</span>
                  </div>
                </div>
              )}
              {ctxSubject && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-muted-foreground">Subject Selected</label>
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200/50 dark:border-purple-800/50 h-10">
                    <BookOpen className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <span className="font-semibold text-sm text-purple-900 dark:text-purple-100 truncate">{ctxSubject.name}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─────────────────────────────────────────────────────────────────────────── */}
          {/* TWO-COLUMN LAYOUT: Select Payments (LEFT 2/3) | Find Student (RIGHT 1/3) */}
          {/* ─────────────────────────────────────────────────────────────────────────── */}
          {((needsSubject ? (!!effectiveClassId && !!effectiveSubjectId) : needsClass ? !!effectiveClassId : true)) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* ═══════════════════════════════════════════════════════════════════ */}
              {/* LEFT COLUMN: Select Payments (2/3) */}
              {/* ═══════════════════════════════════════════════════════════════════ */}
              <div className="space-y-4">

                {/* Select Payments Card */}
                {((needsSubject ? (!!effectiveClassId && !!effectiveSubjectId) : needsClass ? !!effectiveClassId : true)) && (
                  <Card className="rounded-xl shadow-md border border-border/60 flex flex-col h-full">
                    <CardHeader className="p-5 pb-3 border-b border-border/40 bg-gradient-to-r from-primary/5 to-transparent">
                      <CardTitle className="text-base font-bold flex items-center gap-2.5">
                        <Banknote className="h-5 w-5 text-primary" />
                        Select Payments
                        {selectedPaymentIds.size > 0 && (
                          <Badge className="ml-auto bg-primary/20 text-primary border-primary/30 text-sm px-3 py-1 font-semibold">
                            {selectedPaymentIds.size} selected
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 pt-4 flex-1 overflow-hidden flex flex-col">
                      {(loadingPayments || loadingInstPayments || loadingClassPayments) ? (
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-8">
                          <Loader2 className="h-4 w-4 animate-spin" />Loading…
                        </div>
                      ) : activePayments.length === 0 ? (
                        <div className="flex items-center justify-center text-center py-12">
                          <div>
                            <AlertCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No active payments</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 overflow-y-auto flex-1 pr-2">
                          {activePayments.map((p: any) => {
                            const selected = selectedPaymentIds.has(p.id);
                            const bestSub = (paymentScope === 'subject' || paymentScope === 'class') ? getBestStatus(p.id) : null;
                            const isVerified = bestSub?.status === 'VERIFIED';
                            return (
                              <button key={p.id} type="button" onClick={() => togglePayment(p.id)}
                                disabled={isVerified}
                                className={`w-full text-left rounded-lg border-2 px-4 py-3 transition-all text-sm font-medium ${
                                  isVerified ? 'border-green-200 bg-green-50/60 dark:bg-green-950/20 opacity-60 cursor-default text-green-900 dark:text-green-100' :
                                  selected ? 'border-primary bg-primary/10 text-foreground' : 'border-border hover:border-primary/60 hover:bg-muted/50 text-foreground'
                                }`}>
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    {selected && !isVerified && <CheckCircle className="h-5 w-5 text-primary shrink-0" />}
                                    {isVerified && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />}
                                    <span className="font-semibold truncate text-sm">{p.title ?? p.paymentType ?? p.description}</span>
                                  </div>
                                  <span className="font-bold shrink-0 text-base text-primary">Rs {Number(p.amount).toLocaleString()}</span>
                                </div>
                                {bestSub && bestSub.status !== 'VERIFIED' && (
                                  <div className="mt-2 ml-7">
                                    <StatusBadge status={bestSub.status} />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

              {/* ═══════════════════════════════════════════════════════════════════ */}
              {/* RIGHT COLUMN: Tabbed Interface (Find Student | Student Details) */}
              {/* ═══════════════════════════════════════════════════════════════════ */}
              </div>
              {canSearch && (
                <Card className="rounded-xl shadow-md border border-border/40 h-full flex flex-col">
                  {/* Modern Tab Header */}
                  <div className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent p-4">
                    <div className="flex items-center gap-3 mb-4">
                      {/* Tab Buttons */}
                      <div className="flex rounded-lg border border-border/60 bg-muted/30 p-1 gap-1">
                        <button
                          type="button"
                          onClick={() => setRightPanelTab('find')}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold transition-all ${
                            rightPanelTab === 'find'
                              ? 'bg-white dark:bg-slate-800 text-primary shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}>
                          <Search className="h-4 w-4" />
                          Find Student
                        </button>
                        <button
                          type="button"
                          onClick={() => setRightPanelTab('details')}
                          disabled={!student}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold transition-all ${
                            rightPanelTab === 'details' && student
                              ? 'bg-white dark:bg-slate-800 text-primary shadow-sm'
                              : !student
                              ? 'text-muted-foreground/40 cursor-not-allowed'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}>
                          <User className="h-4 w-4" />
                          Student Details
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Tab Content */}
                  <CardContent className="p-5 flex-1 overflow-y-auto space-y-4">
                    {/* Find Student Tab */}
                    {rightPanelTab === 'find' && (
                      <div className="space-y-4 animate-in fade-in-50 duration-200">
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Search Mode</label>
                          <Select value={searchMode} onValueChange={m => { setSearchMode(m as SearchMode); setSearchQuery(''); setStudent(null); setHasSearched(false); }}>
                            <SelectTrigger className="h-9 text-sm rounded-lg border-border/60 bg-muted/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {SEARCH_MODES.map(m => (
                                <SelectItem key={m.id} value={m.id} className="text-sm">
                                  <div className="flex items-center gap-2">
                                    <m.icon className="h-4 w-4" />
                                    {m.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-muted-foreground mb-2 block">Enter Details</label>
                          <div className="relative">
                            <modeConfig.icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              className="pl-10 text-sm h-10 rounded-lg border-border/60 bg-muted/20"
                              placeholder={modeConfig.placeholder}
                              value={searchQuery}
                              onChange={e => setSearchQuery(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            />
                          </div>
                          {searchMode === 'phone' && (
                            <p className="text-[11px] text-muted-foreground mt-1.5">Format: 0771234567 or +94771234567</p>
                          )}
                        </div>

                        <Button
                          onClick={() => handleSearch()}
                          disabled={searching}
                          size="lg"
                          className="w-full h-10 text-sm font-semibold rounded-lg bg-primary hover:bg-primary/90">
                          {searching ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Searching…
                            </>
                          ) : (
                            <>
                              <Search className="h-4 w-4 mr-2" />
                              Find Student
                            </>
                          )}
                        </Button>

                        {/* No result state */}
                        {hasSearched && !searching && !student && (
                          <div className="text-center py-8 px-4 rounded-lg bg-muted/40 border border-border/50">
                            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mx-auto mb-3">
                              <User className="h-6 w-6 text-muted-foreground/40" />
                            </div>
                            <p className="text-sm font-medium text-foreground">No student found</p>
                            <p className="text-xs text-muted-foreground mt-1">Try searching with different details</p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3 h-8"
                              onClick={() => {
                                setHasSearched(false);
                                setSearchQuery('');
                              }}>
                              Try Again
                            </Button>
                          </div>
                        )}

                        {/* Student found summary */}
                        {student && (
                          <div className="rounded-lg bg-gradient-to-br from-green-50/80 to-emerald-50/60 dark:from-green-950/30 dark:to-emerald-950/20 border border-green-200/60 dark:border-green-800/40 p-4 space-y-2">
                            <div className="flex items-center gap-3">
                              {student.image ? (
                                <img
                                  src={student.image}
                                  alt={student.nameWithInitials}
                                  className="h-12 w-12 rounded-full object-cover ring-2 ring-green-200/40 dark:ring-green-800/40"
                                />
                              ) : (
                                <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center ring-2 ring-green-200/40 dark:ring-green-800/40">
                                  <span className="text-sm font-bold text-green-700 dark:text-green-300">
                                    {(student.nameWithInitials?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()) || '?'}
                                  </span>
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm text-green-900 dark:text-green-100 truncate">
                                  {student.nameWithInitials}
                                </p>
                                {student.instituteUserId && (
                                  <p className="text-[11px] text-green-700 dark:text-green-200 truncate">
                                    ID: {student.instituteUserId}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-8 text-xs rounded-lg border-green-200/40 dark:border-green-800/40"
                              onClick={() => setRightPanelTab('details')}>
                              View Details
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Student Details Tab */}
                    {rightPanelTab === 'details' && student && (
                      <div className="space-y-4 animate-in fade-in-50 duration-200">
                        {/* Student Header */}
                        <div className="rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-4 space-y-3">
                          <div className="flex items-center gap-3">
                            {student.image ? (
                              <img
                                src={student.image}
                                alt={student.nameWithInitials}
                                className="h-14 w-14 rounded-lg object-cover ring-2 ring-primary/30"
                              />
                            ) : (
                              <div className="h-14 w-14 rounded-lg bg-primary/20 flex items-center justify-center ring-2 ring-primary/30">
                                <span className="text-base font-bold text-primary">
                                  {(student.nameWithInitials?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()) || '?'}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-foreground truncate">{student.nameWithInitials}</p>
                              {student.instituteUserId && (
                                <p className="text-[11px] text-muted-foreground truncate">ID: {student.instituteUserId}</p>
                              )}
                              <p className="text-[10px] text-muted-foreground font-mono mt-1 truncate">{student.uuid}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-8 text-xs rounded-lg"
                            onClick={goToStudents}>
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            View Full Profile
                          </Button>
                        </div>

                        {/* Selected Payments Summary */}
                        {selectedPayments.length > 0 && (
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground mb-2 block flex items-center gap-1.5">
                              <Banknote className="h-3.5 w-3.5" />
                              Selected Payments
                              <Badge className="ml-auto bg-primary/20 text-primary border-primary/30 text-[10px] px-2 py-0.5">
                                {selectedPayments.length}
                              </Badge>
                            </label>
                            <div className="rounded-lg border border-border/50 divide-y divide-border/50 bg-muted/15 max-h-48 overflow-y-auto">
                              {selectedPayments.map((p: any) => {
                                const original = Number(p.amount);
                                const paid =
                                  paymentScope === 'subject' || paymentScope === 'class' ? getAlreadyPaid(p.id) : 0;
                                const balance = Math.max(0, original - paid);
                                return (
                                  <div key={p.id} className="px-3 py-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="truncate font-medium text-xs flex-1">
                                        {p.title ?? p.paymentType ?? p.description}
                                      </span>
                                      <span className="font-bold text-xs shrink-0 text-primary">
                                        Rs {original.toLocaleString()}
                                      </span>
                                    </div>
                                    {paid > 0 && (
                                      <div className="flex items-center justify-between text-[10px] mt-1.5 text-muted-foreground gap-2">
                                        <span className="text-green-700 dark:text-green-300 font-medium">
                                          Paid: Rs {paid.toLocaleString()}
                                        </span>
                                        <span className="text-amber-700 dark:text-amber-300 font-semibold">
                                          Bal: Rs {balance.toLocaleString()}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-2.5 pt-2">
                          {(() => {
                            const hasVerified =
                              selectedPaymentIds.size > 0 &&
                              selectedPayments.some((p: any) => {
                                if (paymentScope === 'subject' || paymentScope === 'class') {
                                  const best = getBestStatus(p.id);
                                  return best?.status &&
                                    ['VERIFIED', 'HALF_VERIFIED', 'QUARTER_VERIFIED'].includes(best.status);
                                } else {
                                  const status = instStudentSubMap[p.id];
                                  return status && ['VERIFIED', 'HALF_VERIFIED', 'QUARTER_VERIFIED'].includes(status);
                                }
                              });

                            return (
                              <Button
                                className={`w-full h-10 text-sm font-semibold rounded-lg transition-all ${
                                  hasVerified
                                    ? 'bg-gray-400 text-white cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg'
                                }`}
                                onClick={hasVerified ? undefined : openCollectDialog}
                                disabled={selectedPaymentIds.size === 0 || hasVerified}>
                                {hasVerified ? (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Already Verified
                                  </>
                                ) : (
                                  <>
                                    <Banknote className="h-4 w-4 mr-2" />
                                    Collect Payment
                                  </>
                                )}
                              </Button>
                            );
                          })()}

                          {effectiveClassId && (
                            <Button
                              variant="outline"
                              size="lg"
                              className="w-full h-10 text-sm font-semibold rounded-lg border-primary/30 hover:bg-primary/10"
                              onClick={openSummary}>
                              <BarChart3 className="h-4 w-4 mr-2" />
                              View Summary
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="lg"
                            className="w-full h-10 text-sm text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setStudent(null);
                              setHasSearched(false);
                              setSearchQuery('');
                              setStudentSubMap({});
                              setRightPanelTab('find');
                            }}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Clear & Search New
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Class selector for overview */}
          {!ctxClass && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="max-w-xs">
                  <Label className="text-xs mb-1.5 block font-medium">Class</Label>
                  {loadingClasses ? (
                    <div className="flex items-center gap-2 h-9 text-xs text-muted-foreground px-3 rounded-md border">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />Loading…
                    </div>
                  ) : (
                    <Select value={pickedClassId} onValueChange={v => { setPickedClassId(v); }}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select class…" /></SelectTrigger>
                      <SelectContent>
                        {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {!effectiveClassId ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <div className="h-20 w-20 rounded-2xl bg-muted/50 flex items-center justify-center">
                <School className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <div>
                <p className="font-medium text-foreground">No class selected</p>
                <p className="text-sm text-muted-foreground mt-1">Select a class to view the payment overview</p>
              </div>
            </div>
          ) : loadingOverview ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading payment overview…</p>
            </div>
          ) : overviewGrouped.length === 0 && orphanPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <div className="h-20 w-20 rounded-2xl bg-muted/50 flex items-center justify-center">
                <BarChart3 className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <div>
                <p className="font-medium text-foreground">No payments found</p>
                <p className="text-sm text-muted-foreground mt-1">No payments have been created for this class yet</p>
              </div>
            </div>
          ) : (() => {
            // Compute summary stats
            const allPmts = [...overviewGrouped.flatMap(g => g.payments), ...orphanPayments];
            const totalAmount = allPmts.reduce((s, p) => s + Number(p.amount), 0);
            const totalVerified = allPmts.reduce((s, p) => s + (p.verifiedSubmissionsCount ?? 0), 0);
            const totalPending = allPmts.reduce((s, p) => s + (p.pendingSubmissionsCount ?? 0), 0);
            const totalSubs = allPmts.reduce((s, p) => s + (p.submissionsCount ?? 0), 0);
            return (
              <>
                {/* ── Stat Cards ── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-2xl border bg-gradient-to-br from-blue-50 to-blue-100/60 dark:from-blue-950/40 dark:to-blue-900/20 p-4 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <BarChart3 className="h-4 w-4" />
                      <span className="text-xs font-medium">Total Payments</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{allPmts.length}</p>
                    <p className="text-xs text-blue-600/70 dark:text-blue-400/70">{overviewGrouped.length} subject{overviewGrouped.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="rounded-2xl border bg-gradient-to-br from-emerald-50 to-emerald-100/60 dark:from-emerald-950/40 dark:to-emerald-900/20 p-4 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Banknote className="h-4 w-4" />
                      <span className="text-xs font-medium">Total Amount</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">Rs {totalAmount.toLocaleString()}</p>
                    <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70">{totalSubs} submission{totalSubs !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="rounded-2xl border bg-gradient-to-br from-green-50 to-green-100/60 dark:from-green-950/40 dark:to-green-900/20 p-4 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-xs font-medium">Verified</span>
                    </div>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">{totalVerified}</p>
                    <p className="text-xs text-green-600/70 dark:text-green-400/70">
                      {totalSubs > 0 ? Math.round(totalVerified / totalSubs * 100) : 0}% of submissions
                    </p>
                  </div>
                  <div className="rounded-2xl border bg-gradient-to-br from-amber-50 to-amber-100/60 dark:from-amber-950/40 dark:to-amber-900/20 p-4 flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <Clock className="h-4 w-4" />
                      <span className="text-xs font-medium">Pending</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{totalPending}</p>
                    <p className="text-xs text-amber-600/70 dark:text-amber-400/70">awaiting verification</p>
                  </div>
                </div>

                {/* ── Payment Groups ── */}
                <div className="space-y-4">
                  {overviewGrouped.map(({ subject, payments: sPayments }) => (
                    <div key={subject.id} className="rounded-2xl border border-border shadow-sm overflow-hidden">
                      {/* Subject header */}
                      <div className="px-5 py-3.5 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border-b border-border flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <BookOpen className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{subject.name}</span>
                            {subject.code && <Badge variant="outline" className="text-[10px] px-1.5">{subject.code}</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{sPayments.length} payment{sPayments.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div className="shrink-0 text-right hidden sm:block">
                          <p className="text-sm font-bold text-foreground">
                            Rs {sPayments.reduce((s, p) => s + Number(p.amount), 0).toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">total</p>
                        </div>
                      </div>
                      {/* Payment rows */}
                      <div className="divide-y divide-border/60">
                        {sPayments.map(p => (
                          <PaymentRow key={p.id} payment={p} onViewSubmissions={() => goToSubmissions(subject.id)} />
                        ))}
                      </div>
                    </div>
                  ))}

                  {orphanPayments.length > 0 && (
                    <div className="rounded-2xl border border-border shadow-sm overflow-hidden">
                      <div className="px-5 py-3.5 bg-muted/40 border-b border-border flex items-center gap-3">
                        <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="font-semibold text-muted-foreground">Other Payments</span>
                      </div>
                      <div className="divide-y divide-border/60">
                        {orphanPayments.map(p => (
                          <PaymentRow key={p.id} payment={p} onViewSubmissions={() => goToSubmissions(p.subjectId)} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── Collect Dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!collectDialog} onOpenChange={open => { if (!open) closeCollectDialog(); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:max-w-sm mx-auto max-h-[90dvh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Banknote className="h-5 w-5 text-green-600" />Collect Payment
            </DialogTitle>
          </DialogHeader>
          {student && collectDialog && (
            <div className="flex-1 overflow-y-auto px-4 pb-1 space-y-3">
              <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs space-y-1">
                <p className="font-semibold">{student.nameWithInitials}</p>
                {student.instituteUserId && <p className="text-muted-foreground">Institute ID: {student.instituteUserId}</p>}
              </div>

              {/* Selected payments — balance breakdown */}
              <div className="rounded-lg border border-border divide-y divide-border text-xs overflow-hidden">
                {selectedPayments.map((p: any) => {
                  const original = Number(p.amount);
                  const paid = paymentScope === 'subject' || paymentScope === 'class' ? getAlreadyPaid(p.id) : 0;
                  const toCollect = getToCollect(p.id, original, collectDialog.tier);
                  const hasPrior = paid > 0;
                  return (
                    <div key={p.id} className="px-3 py-2 space-y-1.5">
                      <p className="font-medium truncate">{p.title ?? p.paymentType ?? p.description}</p>
                      {hasPrior ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span>Total</span>
                            <span>Rs {original.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between text-green-700 dark:text-green-400">
                            <span>Already paid</span>
                            <span>− Rs {paid.toLocaleString()}</span>
                          </div>
                          <div className="h-px bg-border my-0.5" />
                          <div className="flex items-center justify-between font-semibold">
                            <span>{toCollect === 0 ? 'Balance (fully paid)' : 'Balance'}</span>
                            <span className={toCollect === 0 ? 'text-green-600' : 'text-foreground'}>
                              {toCollect === 0 ? '✓ Covered' : `Rs ${toCollect.toLocaleString()}`}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-muted-foreground font-normal">Amount</span>
                          <span>Rs {toCollect.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Grand total row */}
                {(() => {
                  const grandTotal = selectedPayments.reduce(
                    (sum: number, p: any) => sum + getToCollect(p.id, Number(p.amount), collectDialog.tier), 0
                  );
                  const hasPriorAny = (paymentScope === 'subject' || paymentScope === 'class') && selectedPayments.some((p: any) => getAlreadyPaid(p.id) > 0);
                  return selectedPayments.length > 1 || hasPriorAny ? (
                    <div className="px-3 py-2 flex items-center justify-between bg-primary/5">
                      <span className="font-semibold text-primary">
                        {selectedPayments.length > 1 ? 'Total to collect' : 'To collect'}
                      </span>
                      <span className="font-bold text-primary text-sm">Rs {grandTotal.toLocaleString()}</span>
                    </div>
                  ) : null;
                })()}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Payment Tier</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['full', 'half', 'quarter'] as PaymentTier[]).map(t => (
                    <button key={t} type="button"
                      onClick={() => setCollectDialog(d => d ? { ...d, tier: t } : d)}
                      className={`rounded-lg border py-2 text-xs font-medium transition-all ${
                        collectDialog.tier === t ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border hover:bg-muted'
                      }`}>
                      {TIER_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Payment Date</Label>
                <Input type="date" value={collectDialog.date}
                  onChange={e => setCollectDialog(d => d ? { ...d, date: e.target.value } : d)} />
              </div>
              {financeAccounts.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Credit to Account (Finance)</Label>
                  <Select
                    value={collectDialog.targetAccountId || 'skip'}
                    onValueChange={v => setCollectDialog(d => d ? { ...d, targetAccountId: v === 'skip' ? undefined : v } : d)}
                  >
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Skip — don't record in ledger</SelectItem>
                      {financeAccounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.name} ({a.type})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1 pb-1">
                <Label className="text-xs font-medium">Notes (optional)</Label>
                <Textarea placeholder="Receipt no., remarks…" rows={2} value={collectDialog.notes}
                  onChange={e => setCollectDialog(d => d ? { ...d, notes: e.target.value } : d)} />
              </div>
            </div>
          )}
          <DialogFooter className="px-4 py-3 border-t border-border shrink-0 flex-col-reverse gap-2 sm:flex-row sm:gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={closeCollectDialog} disabled={collecting}>Cancel</Button>
            <Button onClick={handleCollect} disabled={collecting} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
              {collecting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle className="h-4 w-4 mr-1.5" />}
              {collecting ? 'Recording…' : `Confirm${selectedPaymentIds.size > 1 ? ` (${selectedPaymentIds.size})` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Summary Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={summaryOpen} onOpenChange={v => { setSummaryOpen(v); if (!v) setSummaryData([]); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Layers className="h-5 w-5 text-primary" />Payment Summary
            </DialogTitle>
          </DialogHeader>
          {student && (
            <div className="space-y-4">
              {/* Student header */}
              <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5">
                {student.image ? (
                  <img src={student.image} alt={student.nameWithInitials} className="h-10 w-10 rounded-full object-cover ring-2 ring-border shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-border shrink-0">
                    <span className="text-sm font-bold text-primary">
                      {(student.nameWithInitials?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()) || '?'}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm">{student.nameWithInitials}</p>
                  {student.instituteUserId && <p className="text-xs text-muted-foreground">Institute: <span className="font-mono">{student.instituteUserId}</span></p>}
                  {(effectiveClassName || effectiveSubjectName) && (
                    <p className="text-xs text-muted-foreground">
                      {effectiveClassName}{effectiveClassName && effectiveSubjectName ? ' · ' : ''}{effectiveSubjectName}
                    </p>
                  )}
                </div>
              </div>

              {loadingSummary ? (
                <div className="flex items-center gap-3 py-6 justify-center text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />Loading payment history…
                </div>
              ) : summaryData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No payment data available.</p>
              ) : (
                <div className="space-y-3">
                  {summaryData.map(({ subject, payments: sPayments, subMap }) => (
                    <div key={subject.id}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <BookOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-xs font-semibold">{subject.name}</span>
                        {subject.code && <Badge variant="outline" className="text-[10px] px-1">{subject.code}</Badge>}
                      </div>
                      <div className="space-y-1 pl-5">
                        {sPayments.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground">No payments</p>
                        ) : sPayments.map(p => {
                          const subs = subMap[p.id] ?? [];
                          const best = subs.sort((a, b) => {
                            const order = ['VERIFIED', 'HALF_VERIFIED', 'QUARTER_VERIFIED', 'PENDING', 'REJECTED'];
                            return order.indexOf(a.status) - order.indexOf(b.status);
                          })[0];
                          return (
                            <div key={p.id} className="rounded-lg border border-border px-3 py-2 text-xs">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{p.title}</p>
                                  <p className="text-muted-foreground text-[10px]">
                                    Rs {Number(p.amount).toLocaleString()} · Due {new Date(p.lastDate).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <StatusBadge status={best?.status} />
                                  {best && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      Rs {Number(best.submittedAmount).toLocaleString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {/* All submissions for this payment */}
                              {subs.length > 1 && (
                                <div className="mt-1 pt-1 border-t border-border/50 space-y-0.5">
                                  {subs.map((sub, i) => (
                                    <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                      <StatusBadge status={sub.status} />
                                      <span>Rs {Number(sub.submittedAmount).toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Institute-level payment history if any */}
              {student.paymentHistory && student.paymentHistory.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-semibold text-muted-foreground">Institute Payments</span>
                  </div>
                  <div className="space-y-1 pl-5">
                    {student.paymentHistory.map((h, i) => (
                      <div key={i} className="rounded-lg border border-border px-3 py-2 text-xs flex items-center justify-between">
                        <div>
                          <StatusBadge status={h.status} />
                          {h.note && <p className="text-[10px] text-muted-foreground mt-0.5">{h.note}</p>}
                        </div>
                        <div className="text-right">
                          <p className="font-medium">Rs {Number(h.amount).toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(h.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSummaryOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
};

// ─── Payment Row (Overview tab) ───────────────────────────────────────────────

const PaymentRow = ({
  payment: p,
  onViewSubmissions,
}: {
  payment: SubjectPayment;
  onViewSubmissions: () => void;
}) => {
  const verified = p.verifiedSubmissionsCount ?? 0;
  const pending = p.pendingSubmissionsCount ?? 0;
  const total = p.submissionsCount ?? (verified + pending);
  const verifiedPct = total > 0 ? Math.round((verified / total) * 100) : 0;
  const pendingPct  = total > 0 ? Math.round((pending  / total) * 100) : 0;
  const isOverdue   = p.lastDate ? new Date(p.lastDate) < new Date() : false;

  return (
    <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-muted/20 transition-colors group">
      {/* Left: title + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm text-foreground truncate">{p.title}</p>
          {p.priority === 'MANDATORY' && (
            <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 py-0">Mandatory</Badge>
          )}
          {p.priority === 'OPTIONAL' && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">Optional</Badge>
          )}
          {p.status === 'INACTIVE' && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Inactive</Badge>
          )}
        </div>
        {p.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.description}</p>
        )}
        {/* Progress bar */}
        {total > 0 && (
          <div className="mt-2 space-y-1">
            <div className="h-1.5 w-full max-w-[260px] rounded-full bg-muted overflow-hidden flex">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${verifiedPct}%` }}
              />
              <div
                className="h-full bg-amber-400 transition-all"
                style={{ width: `${pendingPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Right: stats */}
      <div className="flex items-center gap-5 shrink-0">
        {/* Amount */}
        <div className="text-right">
          <p className="font-bold text-sm text-foreground">Rs {Number(p.amount).toLocaleString()}</p>
          <p className={`text-[10px] mt-0.5 ${
            isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'
          }`}>
            {p.lastDate
              ? (isOverdue ? 'Overdue · ' : 'Due · ') + new Date(p.lastDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : '—'}
          </p>
        </div>

        {/* Submission counts */}
        <div className="text-right min-w-[72px]">
          <div className="flex items-center gap-2 justify-end">
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
              <CheckCircle className="h-3.5 w-3.5" />{verified}
            </span>
            {pending > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                <Clock className="h-3.5 w-3.5" />{pending}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">of {total} total</p>
        </div>

        {/* Action */}
        <div className="min-w-[80px] flex justify-end">
          {pending > 0 ? (
            <button
              onClick={onViewSubmissions}
              className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              {pending} pending <ArrowRight className="h-3 w-3" />
            </button>
          ) : total > 0 ? (
            <button
              onClick={onViewSubmissions}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              View <ArrowRight className="h-3 w-3" />
            </button>
          ) : (
            <span className="text-xs text-muted-foreground/50 px-2.5">No submissions</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollectPhysicalPayment;
