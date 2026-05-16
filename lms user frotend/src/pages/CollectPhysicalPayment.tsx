/**
 * CollectPhysicalPayment — POS-style payment collection page
 *
 * Desktop: 3-column single-screen layout (Payments | Find Student | Attendance)
 * Mobile:  2-step flow (Search → Collect+Attendance)
 *
 * Features:
 *  - Class payments + 30-day attendance in one load per student
 *  - Post-collect dialog: SMS / Print / Both / Skip
 *  - Thermal receipt print (window.print) — no dialog, direct
 *  - Printer settings panel (size selector, stored in localStorage)
 *  - SMS via /sms/send-custom — fetches phone lazily on click
 *  - Custom SMS recipient option
 *  - Finance account mandatory (no skip)
 *  - Date always = today (server-side, no frontend date picker)
 *  - Attendance enable-toggle per session (only unmarked, selectable)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import PageContainer from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Banknote, Search, CheckCircle, Loader2, User, XCircle, Clock,
  AlertCircle, RefreshCw, School, Phone, Mail, Hash, IdCard,
  MessageSquare, Printer, CalendarDays, ChevronLeft, Settings2,
  Monitor,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { classPaymentsApi, ClassPayment } from '@/api/classPayments.api';
import { institutePaymentsApi, InstitutePayment } from '@/api/institutePayments.api';
import { instituteClassesApi } from '@/api/instituteClasses.api';
import { usersApi } from '@/api/users.api';
import { useAuth } from '@/contexts/AuthContext';
import { financeApi } from '@/api/finance.api';
import classAttendanceSessionsApi from '@/api/classAttendanceSessions.api';
import { useIsMobile } from '@/hooks/use-mobile';
import { isNativePlatform } from '@/services/tokenStorageService';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { instituteSettingsApi, InstitutePrintSettings, PrinterSettings } from '@/api/instituteSettings.api';

// ─── Types ─────────────────────────────────────────────────────────────────────

type SearchMode = 'id' | 'instituteId' | 'phone' | 'email' | 'cardId' | 'name';
type PaymentMode = 'class' | 'institute';
type PaymentTier = 'full' | 'half' | 'quarter';
type PrintSize = '2inch' | '3inch' | '4inch' | 'a4'; // keep local alias for convenience
type PostAction = 'sms' | 'print' | 'both' | 'skip' | null;

interface StudentInfo {
  uuid: string;
  nameWithInitials: string;
  image?: string;
  instituteUserId?: string;
  phone?: string;
}

interface ClassOption { id: string; name: string; code: string; }

interface AttendanceRow {
  sessionId: string;
  sessionName: string;
  date: string;
  startTime: string;
  statusCode: number | null;
  statusLabel: string;
  markedAt: string | null;
}

type SubMap = Record<string, { status: string; submittedAmount: string; id: string }[]>;

interface CollectedItem { title: string; amount: number; submissionId?: string; }

interface SmsCredentials {
  availableCredits: number;
  activeMasks: Array<{ maskId: string; mask: string }>;
  isActive: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const TIER_LABEL: Record<PaymentTier, string> = { full: 'Full', half: 'Half (50%)', quarter: 'Quarter (25%)' };
const TIER_MULT: Record<PaymentTier, number> = { full: 1, half: 0.5, quarter: 0.25 };

const SEARCH_MODES: { id: SearchMode; label: string; icon: React.ElementType; placeholder: string }[] = [
  { id: 'id',          label: 'System ID',   icon: Hash,   placeholder: 'Student system ID…' },
  { id: 'instituteId', label: 'Institute ID', icon: IdCard, placeholder: 'Institute user ID…' },
  { id: 'cardId',      label: 'Card ID',      icon: IdCard, placeholder: 'Institute card ID…' },
  { id: 'name',        label: 'Name',         icon: User,   placeholder: 'Student name (min 3 chars)…' },
  { id: 'phone',       label: 'Phone',        icon: Phone,  placeholder: '07X XXXXXXX…' },
  { id: 'email',       label: 'Email',        icon: Mail,   placeholder: 'student@example.com…' },
];

const PRINT_SIZES: { id: PrintSize; label: string; widthMm: number }[] = [
  { id: '2inch', label: '2 inch (58mm)', widthMm: 58 },
  { id: '3inch', label: '3 inch (80mm)', widthMm: 80 },
  { id: '4inch', label: '4 inch (104mm)', widthMm: 104 },
  { id: 'a4',    label: 'A4 / Full Page', widthMm: 210 },
];

const LS_PRINT_SIZE = 'pos_print_size';

// ─── Utilities ──────────────────────────────────────────────────────────────────

function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysAgoStr(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}
function fmtTime(t: string) {
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr % 12 || 12}:${m} ${hr < 12 ? 'AM' : 'PM'}`;
}

// ─── Status Badges ──────────────────────────────────────────────────────────────

const PayBadge = ({ status }: { status?: string | null }) => {
  if (!status) return <Badge variant="outline" className="gap-1 text-[10px] py-0 text-gray-400"><AlertCircle className="h-2.5 w-2.5" />Not paid</Badge>;
  const map: Record<string, string> = {
    VERIFIED: 'bg-green-100 text-green-800 border-green-200',
    HALF_VERIFIED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    QUARTER_VERIFIED: 'bg-teal-100 text-teal-800 border-teal-200',
    PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    REJECTED: 'bg-red-100 text-red-800 border-red-200',
  };
  const labels: Record<string, string> = {
    VERIFIED: 'Verified', HALF_VERIFIED: 'Half paid', QUARTER_VERIFIED: 'Quarter',
    PENDING: 'Pending', REJECTED: 'Rejected',
  };
  const cls = map[status] || 'bg-gray-100 text-gray-600 border-gray-200';
  const Icon = status === 'VERIFIED' || status === 'HALF_VERIFIED' || status === 'QUARTER_VERIFIED'
    ? CheckCircle : status === 'PENDING' ? Clock : XCircle;
  return <Badge className={`gap-1 text-[10px] py-0 ${cls}`}><Icon className="h-2.5 w-2.5" />{labels[status] ?? status}</Badge>;
};

const AttBadge = ({ code }: { code: number | null }) => {
  if (code === null) return <Badge variant="outline" className="text-[10px] py-0 text-gray-400">Not marked</Badge>;
  if (code === 1) return <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px] py-0">Present</Badge>;
  if (code === 2) return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-[10px] py-0">Late</Badge>;
  if (code === 0) return <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px] py-0">Absent</Badge>;
  return <Badge variant="outline" className="text-[10px] py-0">Code {code}</Badge>;
};

// ─── Receipt HTML builder ───────────────────────────────────────────────────────

// Sinhala label map for receipt fields
const SI_LABELS: Record<string, string> = {
  'Physical Payment Receipt': 'භෞතික ගෙවීම් රිසිට්පත',
  'Student:': 'සිසුවා:',
  'ID:': 'හැඳුනුම:',
  'Class:': 'පන්තිය:',
  'Date:': 'දිනය:',
  'Collected by:': 'එකතු කළේ:',
  'Account:': 'ගිණුම:',
  'TOTAL': 'එකතුව',
  'Tier:': 'ශ්‍රේණිය:',
  'Notes:': 'සටහන:',
  'Ref:': 'Ref:',
  'If you face any issue related to this payment in the future, present this receipt to the administration. Keep it safe.':
    'මෙම ගෙවීම සම්බන්ධයෙන් ගැටලුවක් ඇත්නම් මෙම රිසිට්පත පරිපාලනයට ඉදිරිපත් කරන්න. ආරක්ෂා කර ගන්න.',
};

function lbl(key: string, lang: 'en' | 'si'): string {
  return lang === 'si' ? (SI_LABELS[key] ?? key) : key;
}

function buildReceiptHtml(opts: {
  studentName: string; instituteId?: string; instituteName: string; className: string;
  payments: CollectedItem[]; tier: PaymentTier; collectedBy: string; date: string;
  notes: string; account: string; widthMm: number;
  language?: 'en' | 'si';
  headerImageDataUrl?: string | null;
  footerImageDataUrl?: string | null;
  customHeaderText?: string | null;
  customFooterText?: string | null;
}) {
  const lang = opts.language ?? 'en';
  const total = opts.payments.reduce((s, p) => s + p.amount * TIER_MULT[opts.tier], 0);
  const imgStyle = `display:block;width:100%;max-width:${opts.widthMm - 8}mm;height:auto;margin-bottom:4px;`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title>
<style>
  @page { margin: 4mm; size: ${opts.widthMm}mm auto; }
  body { font-family: 'Courier New', monospace; font-size: ${opts.widthMm < 80 ? 10 : 11}px; margin: 0; padding: 8px; width: ${opts.widthMm - 8}mm; }
  h2  { text-align: center; margin: 0 0 2px; font-size: ${opts.widthMm < 80 ? 12 : 14}px; }
  .c  { text-align: center; }
  .d  { border-top: 1px dashed #000; margin: 5px 0; }
  .r  { display: flex; justify-content: space-between; margin: 2px 0; }
  .b  { font-weight: bold; }
  .s  { font-size: 9px; color: #555; }
  .pid { font-size: 8px; color: #777; margin: 1px 0 3px 0; }
  .notice { font-size: 8px; border: 1px dashed #999; padding: 4px; margin-top: 8px; text-align: center; }
  .custom-text { font-size: 9px; text-align: center; margin: 3px 0; }
</style></head><body>
${opts.headerImageDataUrl ? `<img src="${opts.headerImageDataUrl}" style="${imgStyle}" />` : ''}
${opts.customHeaderText ? `<p class="custom-text">${opts.customHeaderText}</p>` : ''}
${!opts.headerImageDataUrl ? `<h2>${opts.instituteName}</h2>` : ''}
<p class="c s">${lbl('Physical Payment Receipt', lang)}</p>
<div class="d"></div>
<div class="r"><span>${lbl('Student:', lang)}</span><span>${opts.studentName}</span></div>
${opts.instituteId ? `<div class="r"><span>${lbl('ID:', lang)}</span><span>${opts.instituteId}</span></div>` : ''}
<div class="r"><span>${lbl('Class:', lang)}</span><span>${opts.className}</span></div>
<div class="r"><span>${lbl('Date:', lang)}</span><span>${fmtDate(opts.date)}</span></div>
<div class="r"><span>${lbl('Collected by:', lang)}</span><span>${opts.collectedBy}</span></div>
<div class="r"><span>${lbl('Account:', lang)}</span><span>${opts.account}</span></div>
<div class="d"></div>
${opts.payments.map(p => `<div class="r"><span>${p.title}</span><span>Rs ${(p.amount * TIER_MULT[opts.tier]).toLocaleString()}</span></div>${p.submissionId ? `<div class="pid">${lbl('Ref:', lang)} ${p.submissionId}</div>` : ''}`).join('')}
<div class="d"></div>
<div class="r b"><span>${lbl('TOTAL', lang)}</span><span>Rs ${total.toLocaleString()}</span></div>
${opts.tier !== 'full' ? `<div class="r s"><span>${lbl('Tier:', lang)}</span><span>${TIER_LABEL[opts.tier]}</span></div>` : ''}
${opts.notes ? `<div class="r s"><span>${lbl('Notes:', lang)}</span><span>${opts.notes}</span></div>` : ''}
<div class="notice">${lbl('If you face any issue related to this payment in the future, present this receipt to the administration. Keep it safe.', lang)}</div>
${opts.customFooterText ? `<p class="custom-text">${opts.customFooterText}</p>` : ''}
${opts.footerImageDataUrl ? `<img src="${opts.footerImageDataUrl}" style="${imgStyle}margin-top:4px;" />` : ''}
</body></html>`;
}

function doPrint(html: string, widthMm = 80) {
  const existing = document.getElementById('__pos_print_frame') as HTMLIFrameElement | null;
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = '__pos_print_frame';
  // Set iframe to the exact paper width so the browser lays out content correctly
  // before printing. Off-screen but properly sized.
  const pxWidth = Math.round(widthMm * 3.7795); // mm → px at 96dpi
  iframe.style.cssText = `position:fixed;top:-9999px;left:0;width:${pxWidth}px;height:200px;border:0;opacity:0;pointer-events:none;`;
  document.body.appendChild(iframe);

  // Use srcdoc when available (avoids document.write deprecation warning)
  if ('srcdoc' in iframe) {
    iframe.srcdoc = html;
  } else {
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) { iframe.remove(); return; }
    doc.open(); doc.write(html); doc.close();
  }

  const doTrigger = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch { /* ignore — some browsers block cross-origin */ }
    // Remove after user closes the print dialog (allow 30s)
    setTimeout(() => { try { iframe.remove(); } catch { /* */ } }, 30000);
  };

  iframe.onload = doTrigger;
  // Fallback if onload already fired (srcdoc on some browsers)
  setTimeout(() => {
    if (document.getElementById('__pos_print_frame')) doTrigger();
  }, 600);
}

// ─── Main Component ─────────────────────────────────────────────────────────────

const CollectPhysicalPayment: React.FC = () => {
  const { toast } = useToast();
  const { selectedInstitute, selectedClass: ctxClass, user } = useAuth();
  const isMobile = useIsMobile();
  const isNative = isNativePlatform();
  const instituteId = selectedInstitute?.id ?? '';

  // Read ?studentId= from URL to pre-load student on redirect from attendance view
  const urlStudentId = React.useMemo(() => {
    try { return new URLSearchParams(window.location.search).get('studentId') ?? ''; } catch { return ''; }
  }, []);

  // ── class
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [pickedClassId, setPickedClassId] = useState(ctxClass?.id ?? '');
  const effectiveClassId = pickedClassId || ctxClass?.id || '';
  const effectiveClassName = classes.find(c => c.id === effectiveClassId)?.name ?? ctxClass?.name ?? '';

  // ── payment mode toggle
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('class');

  // ── class payments
  const [classPayments, setClassPayments] = useState<ClassPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
  const [subMap, setSubMap] = useState<SubMap>({});
  const [loadingSubMap, setLoadingSubMap] = useState(false);

  // ── institute payments
  const [institutePayments, setInstitutePayments] = useState<InstitutePayment[]>([]);
  const [loadingInstPayments, setLoadingInstPayments] = useState(false);
  const [selectedInstPaymentIds, setSelectedInstPaymentIds] = useState<Set<string>>(new Set());

  // ── attendance
  const ATT_START = daysAgoStr(30);
  const ATT_END   = todayStr();
  const [attSessions, setAttSessions] = useState<AttendanceRow[]>([]);
  const [loadingAtt, setLoadingAtt] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());

  // ── student search
  const [searchMode, setSearchMode] = useState<SearchMode>('id');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const searchCache = useRef<Record<string, StudentInfo>>({});
  // Name/card search can return multiple matches — show a picker
  const [nameResults, setNameResults] = useState<StudentInfo[]>([]);
  const [showNamePicker, setShowNamePicker] = useState(false);

  // ── finance
  const [financeAccounts, setFinanceAccounts] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [targetAccountId, setTargetAccountId] = useState('');

  // ── collect
  const [tier, setTier] = useState<PaymentTier>('full');
  const [notes, setNotes] = useState('');
  const [collecting, setCollecting] = useState(false);
  const [markingAtt, setMarkingAtt] = useState(false);

  // ── post-collect
  const [postOpen, setPostOpen] = useState(false);
  const [collectedItems, setCollectedItems] = useState<CollectedItem[]>([]);
  const [postActionLoading, setPostActionLoading] = useState<PostAction>(null);

  // ── SMS dialog
  const [smsOpen, setSmsOpen] = useState(false);
  const [smsPhone, setSmsPhone] = useState('');
  const [smsCustomPhone, setSmsCustomPhone] = useState('');
  const [smsCustomName, setSmsCustomName] = useState('');
  const [smsMaskId, setSmsMaskId] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [smsCreds, setSmsCreds] = useState<SmsCredentials | null>(null);
  const [loadingSmsCreds, setLoadingSmsCreds] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [fetchingPhone, setFetchingPhone] = useState(false);

  // ── printer settings
  const [printerOpen, setPrinterOpen] = useState(false);
  const [printSize, setPrintSize] = useState<PrintSize>(() =>
    (localStorage.getItem(LS_PRINT_SIZE) as PrintSize) ?? '3inch'
  );
  const [printSettings, setPrintSettings] = useState<InstitutePrintSettings | null>(null);
  const [printLang, setPrintLang] = useState<'en' | 'si'>('en');
  // Editable copies for the settings dialog
  const [editHeader, setEditHeader] = useState('');
  const [editFooter, setEditFooter] = useState('');
  const [savingPrintSettings, setSavingPrintSettings] = useState(false);

  // ── mobile step
  const [mobileStep, setMobileStep] = useState<'search' | 'collect'>('search');

  // ─────────────────────────────────────────────────────────────────
  // Loads
  // ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!instituteId || ctxClass) return;
    setLoadingClasses(true);
    instituteClassesApi.getByInstitute(instituteId, { page: 1, limit: 100 })
      .then(res => setClasses((Array.isArray(res) ? res : (res as any)?.data ?? []).filter((c: any) => c.isActive !== false)))
      .catch(() => setClasses([]))
      .finally(() => setLoadingClasses(false));
  }, [instituteId, ctxClass]);

  useEffect(() => {
    if (!instituteId) return;
    financeApi.getAccounts()
      .then(accs => { setFinanceAccounts(accs); if (accs.length > 0) setTargetAccountId(accs[0].id); })
      .catch(() => {});
  }, [instituteId]);

  // Load printer settings once — includes header/footer images as base64
  useEffect(() => {
    if (!instituteId) return;
    instituteSettingsApi.getPrintSettings(instituteId).then(s => {
      setPrintSettings(s);
      // Apply institute default size only if user has no localStorage override
      if (!localStorage.getItem(LS_PRINT_SIZE) && s.defaultSize) {
        setPrintSize(s.defaultSize as PrintSize);
      }
      setPrintLang(s.language ?? 'en');
      setEditHeader(s.receiptHeader ?? '');
      setEditFooter(s.receiptFooter ?? '');
    }).catch(() => {});
  }, [instituteId]);

  // Payments — force-refresh on class change
  useEffect(() => {
    if (!instituteId || !effectiveClassId) { setClassPayments([]); return; }
    setLoadingPayments(true);
    classPaymentsApi.getClassPayments(instituteId, effectiveClassId, 1, 100, true)
      .then((res: any) => {
        const raw = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setClassPayments(raw.filter((p: ClassPayment) => p.status === 'ACTIVE'));
      })
      .catch(() => setClassPayments([]))
      .finally(() => setLoadingPayments(false));
  }, [instituteId, effectiveClassId]);

  // ─────────────────────────────────────────────────────────────────
  // Per-student loads (payment status + attendance)
  // ─────────────────────────────────────────────────────────────────

  const loadStudentData = useCallback(async (s: StudentInfo) => {
    if (!instituteId) return;

    // 0. Institute payments for this student (always load regardless of class)
    setLoadingInstPayments(true);
    institutePaymentsApi.getInstitutePayments(instituteId, { status: 'ACTIVE', limit: 100 }, true)
      .then(res => setInstitutePayments(res.data?.payments ?? []))
      .catch(() => setInstitutePayments([]))
      .finally(() => setLoadingInstPayments(false));

    if (!effectiveClassId) return;

    // 1. Payment submission status
    setLoadingSubMap(true);
    classPaymentsApi.getStudentClassSubmissions(instituteId, effectiveClassId, s.uuid, { page: 1, limit: 200 })
      .then(res => {
        const map: SubMap = {};
        for (const sub of res.data ?? []) {
          if (!map[sub.paymentId]) map[sub.paymentId] = [];
          map[sub.paymentId].push({ status: sub.status, submittedAmount: sub.submittedAmount, id: sub.id });
        }
        setSubMap(map);
      })
      .catch(() => setSubMap({}))
      .finally(() => setLoadingSubMap(false));

    // 2. Attendance sessions + student status
    setLoadingAtt(true);
    try {
      const sessions = await classAttendanceSessionsApi.getSessions(instituteId, effectiveClassId, {
        startDate: ATT_START, endDate: ATT_END,
      });
      const sessionList = Array.isArray(sessions) ? sessions : [];
      let statusMap: Record<string, { statusCode: number | null; statusLabel: string; markedAt: string | null }> = {};
      if (sessionList.length > 0) {
        try {
          const grid = await classAttendanceSessionsApi.getSessionGrid(
            instituteId, effectiveClassId, sessionList.map(x => x.id)
          );
          const row = grid.students.find(r => r.studentId === s.uuid);
          if (row) statusMap = row.sessions as any;
        } catch { /* show sessions without status */ }
      }
      const rows: AttendanceRow[] = sessionList.map(x => ({
        sessionId: x.id, sessionName: x.name, date: x.date, startTime: x.startTime,
        statusCode: statusMap[x.id]?.statusCode ?? null,
        statusLabel: statusMap[x.id]?.statusLabel ?? 'Not Marked',
        markedAt: statusMap[x.id]?.markedAt ?? null,
      })).sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
      setAttSessions(rows);
      // auto-select today's unmarked sessions
      const todayUnmarked = rows.filter(r => r.date === todayStr() && r.statusCode === null);
      if (todayUnmarked.length > 0) setSelectedSessionIds(new Set(todayUnmarked.map(r => r.sessionId)));
    } catch {
      setAttSessions([]);
    } finally { setLoadingAtt(false); }
  }, [instituteId, effectiveClassId, ATT_START, ATT_END]);

  // Pre-load student from URL param (redirected from attendance view)
  useEffect(() => {
    if (!urlStudentId || !instituteId) return;
    setSearchMode('id');
    setSearchQuery(urlStudentId);
    (async () => {
      try {
        const res: any = await apiClient.get(
          `/institute-payments/institute/${instituteId}/search-student`,
          { studentId: urlStudentId }
        );
        if (res?.student) {
          const info: StudentInfo = {
            uuid: res.student.uuid,
            nameWithInitials: res.student.nameWithInitials,
            image: res.student.image,
            instituteUserId: res.student.instituteUserId,
            phone: res.student.phone ?? res.student.phoneNumber,
          };
          setStudent(info);
          setHasSearched(true);
          await loadStudentData(info);
          if (isMobile) setMobileStep('collect');
        }
      } catch { /* silent — user can search manually */ }
    })();
  }, [urlStudentId, instituteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────
  // Student search
  // ─────────────────────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!searchQuery.trim()) { toast({ title: 'Enter a search value', variant: 'destructive' }); return; }
    if (!effectiveClassId) { toast({ title: 'Select a class first', variant: 'destructive' }); return; }

    const cacheKey = `${instituteId}-${searchMode}-${searchQuery.trim()}`;
    if (searchCache.current[cacheKey]) {
      const cached = searchCache.current[cacheKey];
      setStudent(cached); setHasSearched(true);
      resetCollectState();
      await loadStudentData(cached);
      if (isMobile) setMobileStep('collect');
      return;
    }

    setSearching(true); setStudent(null); setHasSearched(true); resetCollectState();
    setShowNamePicker(false); setNameResults([]);
    try {
      let resolvedId = searchQuery.trim();

      if (searchMode === 'phone') {
        const lu = await usersApi.lookupByPhone(searchQuery.trim());
        if (!lu?.id) throw new Error('No user found with that phone number.');
        resolvedId = lu.id;
      } else if (searchMode === 'email') {
        const lu = await usersApi.lookupByEmail(searchQuery.trim().toLowerCase());
        if (!lu?.id) throw new Error('No user found with that email.');
        resolvedId = lu.id;
      } else if (searchMode === 'name' || searchMode === 'cardId') {
        // Search via institute users endpoint
        if (searchMode === 'name' && searchQuery.trim().length < 3) {
          throw new Error('Name search requires at least 3 characters.');
        }
        const res: any = await apiClient.get(
          `/institute-users/institute/${instituteId}/users/STUDENT`,
          { search: searchQuery.trim(), limit: 10, page: 1 }
        );
        const users: any[] = res?.data ?? res?.users ?? (Array.isArray(res) ? res : []);
        if (users.length === 0) throw new Error('No student found matching that search.');
        // For cardId, additionally filter by matching cardId field
        const matches = searchMode === 'cardId'
          ? users.filter((u: any) => (u.cardId ?? u.instituteCardId ?? '') === searchQuery.trim())
          : users;
        const finalMatches = matches.length > 0 ? matches : users;
        if (finalMatches.length === 1) {
          resolvedId = finalMatches[0].id ?? finalMatches[0].uuid;
        } else {
          // Show picker
          const options: StudentInfo[] = finalMatches.map((u: any) => ({
            uuid: u.id ?? u.uuid,
            nameWithInitials: u.nameWithInitials ?? u.name,
            image: u.imageUrl ?? u.image,
            instituteUserId: u.userIdInstitute ?? u.instituteUserId,
            phone: u.phone ?? u.phoneNumber,
          }));
          setNameResults(options);
          setShowNamePicker(true);
          setSearching(false);
          return;
        }
      }

      const res: any = await apiClient.get(
        `/institute-payments/institute/${instituteId}/search-student`,
        { studentId: resolvedId }
      );
      if (!res?.student) throw new Error('Student not found in this institute.');
      const info: StudentInfo = {
        uuid: res.student.uuid,
        nameWithInitials: res.student.nameWithInitials,
        image: res.student.image,
        instituteUserId: res.student.instituteUserId,
        phone: res.student.phone ?? res.student.phoneNumber,
      };
      searchCache.current[cacheKey] = info;
      setStudent(info);
      await loadStudentData(info);
      if (isMobile) setMobileStep('collect');
    } catch (err: any) {
      const st = err?.status ?? err?.statusCode;
      toast({
        title: st === 404 ? 'Not Found' : 'Search Error',
        description: st === 404 ? 'Student not found in this institute.' : err?.message || 'Search failed.',
        variant: 'destructive',
      });
    } finally { setSearching(false); }
  };

  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────

  const selectNameResult = async (info: StudentInfo) => {
    setShowNamePicker(false); setNameResults([]);
    setStudent(info);
    setHasSearched(true);
    await loadStudentData(info);
    if (isMobile) setMobileStep('collect');
  };

  function resetCollectState() {
    setSubMap({}); setSelectedPaymentIds(new Set());
    setInstitutePayments([]); setSelectedInstPaymentIds(new Set());
    setAttSessions([]); setSelectedSessionIds(new Set()); setNotes('');
  }

  const clearStudent = () => {
    setStudent(null); setHasSearched(false); setSearchQuery('');
    setShowNamePicker(false); setNameResults([]);
    resetCollectState();
    if (isMobile) setMobileStep('search');
  };

  const handleClassChange = (id: string) => { setPickedClassId(id); clearStudent(); };

  const getBestStatus = (paymentId: string): string | null => {
    const subs = subMap[paymentId];
    if (!subs?.length) return null;
    const order = ['VERIFIED', 'HALF_VERIFIED', 'QUARTER_VERIFIED', 'PENDING', 'REJECTED'];
    return [...subs].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))[0].status;
  };

  const getAlreadyPaid = (paymentId: string) =>
    (subMap[paymentId] ?? [])
      .filter(s => ['VERIFIED', 'HALF_VERIFIED', 'QUARTER_VERIFIED'].includes(s.status))
      .reduce((sum, s) => sum + Number(s.submittedAmount), 0);

  const getToCollect = (paymentId: string, originalAmount: number) => {
    const paid = getAlreadyPaid(paymentId);
    return Math.max(0, originalAmount * TIER_MULT[tier] - paid);
  };

  const activePayments = classPayments;
  const selectedPayments = activePayments.filter(p => selectedPaymentIds.has(p.id));
  const grandTotal = selectedPayments.reduce((sum, p) => sum + getToCollect(p.id, Number(p.amount)), 0);

  // Institute payments derived
  const selectedInstPayments = institutePayments.filter(p => selectedInstPaymentIds.has(p.id));
  // For institute payments use full amount (no tier system — institutes use fixed amounts)
  const instGrandTotal = selectedInstPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const selectedAccount = financeAccounts.find(a => a.id === targetAccountId);
  const unmarkedSessions = attSessions.filter(s => s.statusCode === null);
  const collectedBy = user?.name ?? user?.nameWithInitials ?? 'Staff';

  // ─────────────────────────────────────────────────────────────────
  // Collect payment
  // ─────────────────────────────────────────────────────────────────

  const handleCollect = async () => {
    if (!student?.uuid || selectedPaymentIds.size === 0) return;
    if (!targetAccountId) { toast({ title: 'Select a finance account', variant: 'destructive' }); return; }
    setCollecting(true);
    let ok = 0; const errors: string[] = [];
    const items: CollectedItem[] = [];

    for (const paymentId of selectedPaymentIds) {
      const p = activePayments.find(x => x.id === paymentId);
      if (!p) continue;
      const amt = getToCollect(paymentId, Number(p.amount));
      if (amt <= 0) { ok++; continue; }
      try {
        const res: any = await classPaymentsApi.adminVerifyStudentClassPayment(paymentId, student.uuid, {
          amount: amt, date: todayStr(), notes: notes || undefined, paymentTier: tier, targetAccountId,
        });
        ok++;
        const submissionId: string | undefined = res?.data?.submissionId ?? res?.submissionId;
        items.push({ title: p.title ?? p.description ?? paymentId, amount: Number(p.amount), submissionId });
      } catch (err: any) {
        const label = p.title ?? p.description ?? paymentId;
        errors.push(`${label}: ${err?.message || 'Failed'}`);
      }
    }

    // If sessions selected too, mark attendance simultaneously
    if (selectedSessionIds.size > 0) await doMarkAttendance(false);

    setCollecting(false);

    if (ok > 0) {
      setCollectedItems(items);
      setSelectedPaymentIds(new Set());
      // refresh submap
      classPaymentsApi.getStudentClassSubmissions(instituteId, effectiveClassId, student.uuid, { page: 1, limit: 200 })
        .then(res => {
          const map: SubMap = {};
          for (const sub of res.data ?? []) {
            if (!map[sub.paymentId]) map[sub.paymentId] = [];
            map[sub.paymentId].push({ status: sub.status, submittedAmount: sub.submittedAmount, id: sub.id });
          }
          setSubMap(map);
        }).catch(() => {});
      setPostOpen(true);
    }
    if (errors.length > 0) {
      toast({ title: `${errors.length} payment(s) failed`, description: errors.slice(0, 3).join(' · '), variant: 'destructive' });
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Collect institute payments
  // ─────────────────────────────────────────────────────────────────

  const handleCollectInstitute = async () => {
    if (!student?.uuid || selectedInstPaymentIds.size === 0) return;
    if (!targetAccountId) { toast({ title: 'Select a finance account', variant: 'destructive' }); return; }
    setCollecting(true);
    let ok = 0; const errors: string[] = [];
    const items: CollectedItem[] = [];

    for (const paymentId of selectedInstPaymentIds) {
      const p = institutePayments.find(x => x.id === paymentId);
      if (!p) continue;
      try {
        const res: any = await apiClient.post(
          `/institute-payments/institute/${instituteId}/payment/${paymentId}/admin-verify-student/${student.uuid}`,
          {
            amount: Number(p.amount),
            date: todayStr(),
            notes: notes || undefined,
            targetAccountId,
          }
        );
        ok++;
        const submissionId: string | undefined = res?.data?.submissionId ?? res?.submissionId;
        items.push({ title: p.description ?? paymentId, amount: Number(p.amount), submissionId });
      } catch (err: any) {
        const status = err?.status ?? err?.statusCode ?? err?.response?.status;
        if (status === 400 || status === 409) {
          // Already verified — count as success, don't block the receipt
          ok++;
          items.push({ title: p.description ?? paymentId, amount: Number(p.amount) });
        } else {
          errors.push(`${p.description ?? paymentId}: ${err?.message || 'Failed'}`);
        }
      }
    }

    if (selectedSessionIds.size > 0) await doMarkAttendance(false);

    setCollecting(false);

    if (ok > 0) {
      setCollectedItems(items);
      setSelectedInstPaymentIds(new Set());
      setPostOpen(true);
    }
    if (errors.length > 0) {
      toast({ title: `${errors.length} payment(s) failed`, description: errors.slice(0, 3).join(' · '), variant: 'destructive' });
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Mark attendance (standalone, also called from collect)
  // ─────────────────────────────────────────────────────────────────

  const doMarkAttendance = async (showToast = true) => {
    if (!student?.uuid || selectedSessionIds.size === 0) return;
    setMarkingAtt(true);
    let ok = 0; const errs: string[] = [];
    for (const sid of selectedSessionIds) {
      try {
        await classAttendanceSessionsApi.markAttendance(instituteId, effectiveClassId, sid, {
          studentId: student.uuid, status: 1,
        });
        ok++;
      } catch (err: any) { errs.push(err?.message || 'Failed'); }
    }
    setMarkingAtt(false);
    if (ok > 0) {
      if (showToast) toast({ title: `Marked present in ${ok} session${ok > 1 ? 's' : ''}` });
      // refresh attendance
      loadStudentData(student).catch(() => {});
      setSelectedSessionIds(new Set());
    }
    if (errs.length > 0 && showToast) {
      toast({ title: 'Some sessions failed', description: errs[0], variant: 'destructive' });
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // Print
  // ─────────────────────────────────────────────────────────────────

  const handlePrint = async () => {
    const widthMm = PRINT_SIZES.find(s => s.id === printSize)?.widthMm ?? 80;
    const html = buildReceiptHtml({
      studentName: student?.nameWithInitials ?? '',
      instituteId: student?.instituteUserId,
      instituteName: selectedInstitute?.name ?? '',
      className: effectiveClassName,
      payments: collectedItems,
      tier, collectedBy, date: todayStr(), notes,
      account: selectedAccount?.name ?? '',
      widthMm,
      language: printLang,
      headerImageDataUrl: printSettings?.headerImageDataUrl,
      footerImageDataUrl: printSettings?.footerImageDataUrl,
      customHeaderText: printSettings?.receiptHeader,
      customFooterText: printSettings?.receiptFooter,
    });

    if (isNative) {
      // Capacitor native: share the receipt HTML as a file so device can open
      // in a print-capable app (native print dialog, Bluetooth printer apps, etc.)
      try {
        const { Share } = await import('@capacitor/share');
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        await Share.share({
          title: 'Payment Receipt',
          url,
          dialogTitle: 'Print or Share Receipt',
        });
        URL.revokeObjectURL(url);
        return;
      } catch {
        // Share not available or user cancelled — fall through to web print
      }
    }

    doPrint(html, widthMm);
  };

  // ─────────────────────────────────────────────────────────────────
  // SMS — lazy: fetch phone + creds only when dialog opens
  // ─────────────────────────────────────────────────────────────────

  const openSmsDialog = async () => {
    setSmsOpen(true);
    // Build default message
    const total = collectedItems.reduce((s, p) => s + p.amount * TIER_MULT[tier], 0);
    const items = collectedItems.map(p => {
      const amt = `Rs ${(p.amount * TIER_MULT[tier]).toLocaleString()}`;
      return p.submissionId ? `${p.title}: ${amt} (Ref: ${p.submissionId})` : `${p.title}: ${amt}`;
    }).join(', ');
    setSmsMessage(
      `${selectedInstitute?.name ?? 'School'} - Payment collected for ${student?.nameWithInitials ?? ''} on ${fmtDate(todayStr())}. ${items}. Total: Rs ${total.toLocaleString()}. Thank you.`
    );

    // Set phone from student if available
    if (student?.phone) {
      setSmsPhone(student.phone);
    } else {
      // Fetch phone lazily
      setFetchingPhone(true);
      try {
        const res: any = await apiClient.get(
          `/institute-payments/institute/${instituteId}/search-student`,
          { studentId: student?.uuid }
        );
        const phone = res?.student?.phone ?? res?.student?.phoneNumber ?? '';
        setSmsPhone(phone);
      } catch { setSmsPhone(''); }
      finally { setFetchingPhone(false); }
    }

    // Load SMS credentials
    setLoadingSmsCreds(true);
    try {
      const res: any = await enhancedCachedClient.get(
        `/sms/credentials/status`,
        { instituteId },
        { ttl: 60000, forceRefresh: false }
      );
      setSmsCreds(res);
      if (res?.activeMasks?.length > 0) setSmsMaskId(res.activeMasks[0].maskId);
    } catch { setSmsCreds(null); }
    finally { setLoadingSmsCreds(false); }
  };

  const handleSendSms = async () => {
    const recipients: Array<{ name: string; phoneNumber: string }> = [];
    // Primary: student phone
    const primaryPhone = smsPhone.trim() || smsCustomPhone.trim();
    if (primaryPhone) recipients.push({ name: student?.nameWithInitials ?? 'Student', phoneNumber: primaryPhone });
    // Custom additional
    if (smsCustomPhone.trim() && smsCustomPhone.trim() !== smsPhone.trim() && smsCustomName.trim()) {
      recipients.push({ name: smsCustomName.trim(), phoneNumber: smsCustomPhone.trim() });
    }
    if (recipients.length === 0) { toast({ title: 'Enter a phone number', variant: 'destructive' }); return; }
    setSendingSms(true);
    try {
      await apiClient.post('/sms/send-custom', {
        messageTemplate: smsMessage,
        customRecipients: recipients,
        maskId: smsMaskId,
        isNow: true,
        scheduledAt: new Date().toISOString(),
        instituteId,
      });
      toast({ title: `SMS sent to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}` });
      setSmsOpen(false);
    } catch (err: any) {
      toast({ title: 'SMS failed', description: err?.message || 'Could not send SMS. Check SMS credits.', variant: 'destructive' });
    } finally { setSendingSms(false); }
  };

  // ─────────────────────────────────────────────────────────────────
  // Post-collect action handler
  // ─────────────────────────────────────────────────────────────────

  const handlePostAction = async (action: 'sms' | 'print' | 'both' | 'skip') => {
    if (action === 'skip') { setPostOpen(false); clearStudent(); return; }
    setPostActionLoading(action);
    try {
      if (action === 'print' || action === 'both') { handlePrint(); }
      if (action === 'sms' || action === 'both') {
        setPostOpen(false);
        await openSmsDialog();
      } else {
        setPostOpen(false);
        clearStudent();
      }
    } finally { setPostActionLoading(null); }
  };

  // ─────────────────────────────────────────────────────────────────
  // Guard
  // ─────────────────────────────────────────────────────────────────

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
  const postTotal = collectedItems.reduce((s, p) => s + p.amount * TIER_MULT[tier], 0);

  const dialogs = (
    <>
      {/* ── Post-collect dialog ── */}
      <Dialog open={postOpen} onOpenChange={v => { if (!v && !postActionLoading) { setPostOpen(false); clearStudent(); } }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-5 w-5 text-green-600" />Payment Recorded!
            </DialogTitle>
          </DialogHeader>
          <div className="px-5 py-4 space-y-4">
            <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-3 space-y-1.5">
              <p className="font-semibold text-sm text-green-900 dark:text-green-100">{student?.nameWithInitials}</p>
              {student?.instituteUserId && <p className="text-[11px] text-green-700 dark:text-green-300">ID: {student.instituteUserId}</p>}
              {collectedItems.map((p, i) => (
                <div key={i} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs text-green-800 dark:text-green-200">
                    <span className="truncate">{p.title}</span>
                    <span className="font-medium ml-2 shrink-0">Rs {(p.amount * TIER_MULT[tier]).toLocaleString()}</span>
                  </div>
                  {p.submissionId && (
                    <p className="text-[10px] text-green-600 dark:text-green-400 font-mono">Ref: {p.submissionId}</p>
                  )}
                </div>
              ))}
              <div className="flex items-center justify-between font-bold text-sm text-green-900 dark:text-green-100 border-t border-green-200 dark:border-green-700 pt-1.5 mt-1">
                <span>Total</span><span>Rs {postTotal.toLocaleString()}</span>
              </div>
              {selectedAccount && <p className="text-[10px] text-green-700 dark:text-green-400">Account: {selectedAccount.name}</p>}
              {notes && <p className="text-[10px] text-green-700 dark:text-green-400">Notes: {notes}</p>}
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2">
              If there is any payment-related issue in future, present this receipt to administration. Keep it safe.
            </p>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What would you like to do?</p>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => handlePostAction('sms')} disabled={!!postActionLoading} variant="outline"
                  className="h-12 flex-col gap-0.5 text-xs border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/30">
                  {postActionLoading === 'sms' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4 text-blue-600" />}
                  Send SMS
                </Button>
                <Button onClick={() => handlePostAction('print')} disabled={!!postActionLoading} variant="outline"
                  className="h-12 flex-col gap-0.5 text-xs border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-950/30">
                  {postActionLoading === 'print' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4 text-green-600" />}
                  Print
                </Button>
                <Button onClick={() => handlePostAction('both')} disabled={!!postActionLoading}
                  className="h-12 flex-col gap-0.5 text-xs bg-primary hover:bg-primary/90">
                  {postActionLoading === 'both' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  SMS + Print
                </Button>
                <Button onClick={() => handlePostAction('skip')} disabled={!!postActionLoading} variant="ghost"
                  className="h-12 flex-col gap-0.5 text-xs text-muted-foreground hover:text-foreground">
                  <XCircle className="h-4 w-4" />
                  Skip — Next
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── SMS dialog ── */}
      <Dialog open={smsOpen} onOpenChange={v => { if (!v && !sendingSms) { setSmsOpen(false); } }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg mx-auto p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-5 w-5 text-blue-600" />Send SMS Receipt
            </DialogTitle>
          </DialogHeader>
          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {loadingSmsCreds ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />Loading SMS info…
              </div>
            ) : smsCreds ? (
              <div className="flex items-center justify-between text-xs bg-muted/40 rounded-lg px-3 py-2">
                <span className="text-muted-foreground">SMS Credits</span>
                <span className={`font-semibold ${smsCreds.availableCredits < 10 ? 'text-red-600' : 'text-green-700 dark:text-green-400'}`}>
                  {smsCreds.availableCredits} remaining
                </span>
              </div>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2">
                SMS credentials not available. Contact admin.
              </p>
            )}
            {smsCreds?.activeMasks && smsCreds.activeMasks.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs font-medium">Sender ID</Label>
                <Select value={smsMaskId} onValueChange={setSmsMaskId}>
                  <SelectTrigger className="text-xs h-9 bg-muted/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {smsCreds.activeMasks.map(m => <SelectItem key={m.maskId} value={m.maskId} className="text-xs">{m.mask}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs font-medium">Student Phone</Label>
              <div className="relative">
                {fetchingPhone && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                <Input value={smsPhone} onChange={e => setSmsPhone(e.target.value)}
                  placeholder="Phone number…" className="text-sm h-9 bg-muted/20 border-border/60 pr-8" />
              </div>
              {!smsPhone && !fetchingPhone && (
                <p className="text-[10px] text-amber-600">No phone on file — enter manually or use custom below.</p>
              )}
            </div>
            <div className="rounded-lg border border-border/50 p-3 space-y-2 bg-muted/10">
              <p className="text-xs font-semibold text-muted-foreground">Custom / Additional Recipient</p>
              <Input value={smsCustomName} onChange={e => setSmsCustomName(e.target.value)}
                placeholder="Name (optional)…" className="text-xs h-8 bg-background border-border/60" />
              <Input value={smsCustomPhone} onChange={e => setSmsCustomPhone(e.target.value)}
                placeholder="Phone number…" className="text-xs h-8 bg-background border-border/60" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Message</Label>
              <Textarea value={smsMessage} onChange={e => setSmsMessage(e.target.value)}
                rows={4} className="text-xs bg-muted/20 border-border/60 resize-none" />
              <p className="text-[10px] text-muted-foreground text-right">{smsMessage.length} chars</p>
            </div>
          </div>
          <DialogFooter className="px-5 pb-5 pt-3 border-t border-border gap-2">
            <Button variant="outline" onClick={() => { setSmsOpen(false); clearStudent(); }} disabled={sendingSms} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSendSms} disabled={sendingSms || (!smsPhone && !smsCustomPhone)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
              {sendingSms ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
              {sendingSms ? 'Sending…' : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Printer settings ── */}
      <Dialog open={printerOpen} onOpenChange={setPrinterOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Printer className="h-5 w-5" />Printer Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">

            {/* Paper size */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Paper Size</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {PRINT_SIZES.map(s => (
                  <button key={s.id} type="button"
                    onClick={() => { setPrintSize(s.id); localStorage.setItem(LS_PRINT_SIZE, s.id); }}
                    className={`text-left px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      printSize === s.id ? 'border-primary bg-primary/8' : 'border-border hover:bg-muted/50'
                    }`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs">{s.label}</span>
                      {printSize === s.id && <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Receipt Language</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {([['en', 'English'], ['si', 'සිංහල (Sinhala)']] as const).map(([code, label]) => (
                  <button key={code} type="button"
                    onClick={() => setPrintLang(code)}
                    className={`text-left px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                      printLang === code ? 'border-primary bg-primary/8' : 'border-border hover:bg-muted/50'
                    }`}>
                    <div className="flex items-center justify-between gap-1">
                      <span>{label}</span>
                      {printLang === code && <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Student names, IDs and class names print as-is. Labels (Student:, Date:, etc.) switch to Sinhala.
              </p>
            </div>

            {/* Custom header / footer text */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Custom Receipt Header Text</Label>
              <Input
                value={editHeader}
                onChange={e => setEditHeader(e.target.value)}
                placeholder="e.g. Your trusted learning partner…"
                className="text-xs h-8"
                maxLength={200}
              />
              <p className="text-[10px] text-muted-foreground text-right">{editHeader.length}/200</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Custom Receipt Footer Text</Label>
              <Input
                value={editFooter}
                onChange={e => setEditFooter(e.target.value)}
                placeholder="e.g. Thank you for choosing us!"
                className="text-xs h-8"
                maxLength={300}
              />
              <p className="text-[10px] text-muted-foreground text-right">{editFooter.length}/300</p>
            </div>

            {/* Header/footer images status */}
            {(printSettings?.headerImageDataUrl || printSettings?.footerImageDataUrl) && (
              <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 px-3 py-2 space-y-1">
                <p className="text-xs font-semibold text-green-800 dark:text-green-300">Institute branding loaded</p>
                {printSettings.headerImageDataUrl && (
                  <p className="text-[10px] text-green-700 dark:text-green-400">✓ Header banner image will appear at top of receipt</p>
                )}
                {printSettings.footerImageDataUrl && (
                  <p className="text-[10px] text-green-700 dark:text-green-400">✓ Footer banner image will appear at bottom of receipt</p>
                )}
                <p className="text-[10px] text-muted-foreground">Upload/change banner images in Institute Settings → Report Branding.</p>
              </div>
            )}

            {isNative ? (
              <p className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-2">
                App mode: Print opens your device share/print sheet. Send to a Bluetooth printer app, AirPrint, or any print service on your device.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                Browser: Print dialog opens with the receipt sized to the selected paper width.
              </p>
            )}

            {/* Test print */}
            <Button onClick={() => {
              const widthMm = PRINT_SIZES.find(s => s.id === printSize)?.widthMm ?? 80;
              if (collectedItems.length > 0) {
                handlePrint();
              } else {
                doPrint(buildReceiptHtml({
                  studentName: 'Test Student', instituteId: 'TEST-001',
                  instituteName: selectedInstitute?.name ?? 'Institute',
                  className: effectiveClassName || 'Class',
                  payments: [{ title: 'Test Payment', amount: 1000 }],
                  tier: 'full', collectedBy, date: todayStr(),
                  notes: 'Test print', account: 'Cash', widthMm,
                  language: printLang,
                  headerImageDataUrl: printSettings?.headerImageDataUrl,
                  footerImageDataUrl: printSettings?.footerImageDataUrl,
                  customHeaderText: editHeader || null,
                  customFooterText: editFooter || null,
                }), widthMm);
              }
            }} variant="outline" className="w-full">
              <Printer className="h-4 w-4 mr-2" />Print Test Page
            </Button>

            {/* Save to institute (admin) */}
            <Button
              onClick={async () => {
                setSavingPrintSettings(true);
                try {
                  const updated = await instituteSettingsApi.updatePrinterSettings(instituteId, {
                    defaultSize: printSize,
                    language: printLang,
                    receiptHeader: editHeader || undefined,
                    receiptFooter: editFooter || undefined,
                  });
                  // Refresh print settings cache
                  const fresh = await instituteSettingsApi.getPrintSettings(instituteId, true);
                  setPrintSettings(fresh);
                  toast({ title: 'Printer settings saved for all staff' });
                } catch {
                  toast({ title: 'Could not save settings', description: 'Check your permissions', variant: 'destructive' });
                } finally {
                  setSavingPrintSettings(false);
                }
              }}
              disabled={savingPrintSettings}
              className="w-full"
            >
              {savingPrintSettings ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save as Institute Default
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );;

  // ═══════════════════════════════════════════════════════════════════
  // SHARED SUBCOMPONENTS
  // ═══════════════════════════════════════════════════════════════════

  // Payment list item
  const PaymentItem = ({ p }: { p: ClassPayment }) => {
    const bestStatus = getBestStatus(p.id);
    const isVerified = bestStatus === 'VERIFIED';
    const selected = selectedPaymentIds.has(p.id);
    const orig = Number(p.amount);
    const paid = getAlreadyPaid(p.id);
    const toCollect = getToCollect(p.id, orig);
    return (
      <button type="button"
        onClick={() => {
          if (isVerified) return;
          setSelectedPaymentIds(prev => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; });
        }}
        disabled={isVerified}
        className={`w-full text-left rounded-lg border-2 px-3 py-2.5 transition-all ${
          isVerified
            ? 'border-green-200 bg-green-50/40 dark:bg-green-950/20 opacity-60 cursor-default'
            : selected
            ? 'border-primary bg-primary/[0.06]'
            : 'border-border hover:border-primary/50 hover:bg-muted/40'
        }`}>
        <div className="flex items-start gap-2">
          {isVerified
            ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
            : selected
            ? <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0 mt-0.5" />
          }
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate leading-tight">{p.title ?? p.description}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="font-bold text-primary text-sm">Rs {orig.toLocaleString()}</span>
              {loadingSubMap ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : <PayBadge status={bestStatus} />}
            </div>
            {paid > 0 && !isVerified && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Paid: Rs {paid.toLocaleString()} · Balance: Rs {toCollect.toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </button>
    );
  };

  // Attendance row
  const AttRow = ({ s }: { s: AttendanceRow }) => {
    const notMarked = s.statusCode === null;
    const sel = selectedSessionIds.has(s.sessionId);
    return (
      <button type="button"
        onClick={() => {
          if (!notMarked) return;
          setSelectedSessionIds(prev => {
            const n = new Set(prev);
            n.has(s.sessionId) ? n.delete(s.sessionId) : n.add(s.sessionId);
            return n;
          });
        }}
        disabled={!notMarked}
        className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
          !notMarked ? 'opacity-60 cursor-default' : sel ? 'bg-blue-50/60 dark:bg-blue-950/20' : 'hover:bg-muted/40'
        }`}>
        {notMarked
          ? sel
            ? <CheckCircle className="h-4 w-4 text-blue-600 shrink-0" />
            : <div className="h-4 w-4 rounded-full border-2 border-blue-300 dark:border-blue-600 shrink-0" />
          : <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{s.sessionName}</p>
          <p className="text-[10px] text-muted-foreground">{fmtDate(s.date)} · {fmtTime(s.startTime)}</p>
        </div>
        <AttBadge code={s.statusCode} />
      </button>
    );
  };

  // Student avatar
  const Avatar = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
    const sz = size === 'sm' ? 'h-9 w-9 text-xs' : size === 'lg' ? 'h-14 w-14 text-base' : 'h-11 w-11 text-sm';
    const initials = student?.nameWithInitials?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';
    if (student?.image) return <img src={student.image} alt={student.nameWithInitials} className={`${sz} rounded-full object-cover ring-2 ring-primary/20 shrink-0`} />;
    return <div className={`${sz} rounded-full bg-primary/15 flex items-center justify-center ring-2 ring-primary/20 shrink-0 font-bold text-primary`}>{initials}</div>;
  };

  // Bottom footer for payment column
  const PaymentsFooter = () => {
    const isInst = paymentMode === 'institute';
    const selCount = isInst ? selectedInstPaymentIds.size : selectedPaymentIds.size;
    const total = isInst ? instGrandTotal : grandTotal;
    const onCollect = isInst ? handleCollectInstitute : handleCollect;
    return (
      <div className="px-4 py-3 border-t border-border shrink-0 space-y-2 bg-card">
        {/* Tier — only for class payments */}
        {!isInst && (
          <div className="grid grid-cols-3 gap-1.5">
            {(['full', 'half', 'quarter'] as PaymentTier[]).map(t => (
              <button key={t} type="button" onClick={() => setTier(t)}
                className={`rounded-md border py-1.5 text-xs font-semibold transition-all ${
                  tier === t ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'
                }`}>
                {TIER_LABEL[t]}
              </button>
            ))}
          </div>
        )}
        {/* Account */}
        {financeAccounts.length > 0 && (
          <Select value={targetAccountId} onValueChange={setTargetAccountId}>
            <SelectTrigger className="text-xs h-8 bg-muted/20 border-border/60">
              <SelectValue placeholder="Credit to account…" />
            </SelectTrigger>
            <SelectContent>
              {financeAccounts.map(a => (
                <SelectItem key={a.id} value={a.id} className="text-xs">{a.name} ({a.type})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {/* Notes */}
        <Textarea placeholder="Notes (receipt no., remarks…)" rows={2} value={notes}
          onChange={e => setNotes(e.target.value)}
          className="text-xs bg-muted/20 border-border/60 resize-none" />
        {/* Total */}
        {selCount > 0 && (
          <div className="flex items-center justify-between text-xs font-semibold px-0.5">
            <span className="text-muted-foreground">Total to collect</span>
            <span className="text-primary text-sm">Rs {total.toLocaleString()}</span>
          </div>
        )}
        {/* Collect button */}
        <Button onClick={onCollect}
          disabled={collecting || selCount === 0 || !student}
          className="w-full h-10 bg-green-600 hover:bg-green-700 text-white font-semibold">
          {collecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Banknote className="h-4 w-4 mr-2" />}
          {collecting ? 'Recording…'
            : selCount === 0 ? 'Select payments'
            : !student ? 'Find student first'
            : `Collect (${selCount})`}
        </Button>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════
  // MOBILE RENDER
  // ═══════════════════════════════════════════════════════════════════

  if (isMobile) {
    return (
      <PageContainer maxWidth="full" className="pb-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pt-1">
          {mobileStep === 'collect' && student && (
            <button onClick={() => setMobileStep('search')} className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Banknote className="h-5 w-5 text-primary shrink-0" />
            <div>
              <h1 className="font-bold text-base leading-tight">Collect Payment</h1>
              <p className="text-[11px] text-muted-foreground">{selectedInstitute.name}</p>
            </div>
          </div>
          <button onClick={() => setPrinterOpen(true)} className="p-2 rounded-lg hover:bg-muted transition-colors shrink-0">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Class selector */}
        {!ctxClass && (
          <div className="mb-3">
            {loadingClasses ? (
              <div className="flex items-center gap-2 h-10 text-sm text-muted-foreground px-3 rounded-lg border border-border/60 bg-muted/20">
                <Loader2 className="h-4 w-4 animate-spin" />Loading classes…
              </div>
            ) : (
              <Select value={pickedClassId} onValueChange={handleClassChange}>
                <SelectTrigger className="h-10 text-sm bg-muted/20 border-border/60">
                  <SelectValue placeholder="Select class…" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* STEP 1: Search */}
        {mobileStep === 'search' && (
          <div className="space-y-3">
            <Select value={searchMode} onValueChange={m => { setSearchMode(m as SearchMode); setSearchQuery(''); }}>
              <SelectTrigger className="h-9 text-sm bg-muted/20 border-border/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SEARCH_MODES.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center gap-2"><m.icon className="h-4 w-4" />{m.label}</div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <modeConfig.icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9 text-sm h-11 bg-muted/20 border-border/60"
                  placeholder={modeConfig.placeholder} value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()} />
              </div>
              <Button onClick={handleSearch} disabled={searching || !effectiveClassId} className="h-11 px-4">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {!effectiveClassId && (
              <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2">
                Select a class above first.
              </p>
            )}
            {showNamePicker && nameResults.length > 0 && (
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
                  <p className="text-xs font-semibold text-muted-foreground">{nameResults.length} students found — select one</p>
                  <button onClick={() => { setShowNamePicker(false); setNameResults([]); setHasSearched(false); }} className="text-muted-foreground hover:text-foreground">
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>
                {nameResults.map(r => (
                  <button key={r.uuid} onClick={() => selectNameResult(r)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-primary/5 border-b last:border-0 text-left transition-colors">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {r.nameWithInitials.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.nameWithInitials}</p>
                      {r.instituteUserId && <p className="text-[10px] text-muted-foreground">ID: {r.instituteUserId}</p>}
                    </div>
                    <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground rotate-180 shrink-0" />
                  </button>
                ))}
              </div>
            )}
            {hasSearched && !searching && !student && !showNamePicker && (
              <div className="text-center py-10 rounded-xl bg-muted/40 border border-border/50">
                <User className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm font-medium">No student found</p>
                <p className="text-xs text-muted-foreground mt-1">Try different search details</p>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Collect */}
        {mobileStep === 'collect' && student && (
          <div className="space-y-3">
            {/* Student card */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
              <Avatar size="md" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{student.nameWithInitials}</p>
                {student.instituteUserId && <p className="text-[11px] text-muted-foreground">ID: {student.instituteUserId}</p>}
                {effectiveClassName && <p className="text-[11px] text-muted-foreground">{effectiveClassName}</p>}
              </div>
              <button onClick={clearStudent} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Payments */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-3 py-2 bg-muted/40 flex items-center gap-2">
                <Banknote className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Payments</span>
                {(loadingPayments || loadingSubMap || loadingInstPayments) && <Loader2 className="h-3.5 w-3.5 animate-spin ml-auto" />}
              </div>
              {/* Mode toggle */}
              <div className="px-3 py-2 border-b border-border/50 bg-muted/20">
                <div className="grid grid-cols-2 gap-1 bg-muted/60 rounded-lg p-0.5">
                  <button type="button" onClick={() => setPaymentMode('class')}
                    className={`rounded-md py-1 text-xs font-semibold transition-all ${paymentMode === 'class' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground'}`}>
                    Class
                  </button>
                  <button type="button" onClick={() => setPaymentMode('institute')}
                    className={`rounded-md py-1 text-xs font-semibold transition-all ${paymentMode === 'institute' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground'}`}>
                    Institute
                  </button>
                </div>
              </div>
              {paymentMode === 'class' ? (
                loadingPayments ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">Loading…</div>
                ) : activePayments.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No active class payments</div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {activePayments.map(p => (
                      <div key={p.id} className="px-1 py-0.5"><PaymentItem p={p} /></div>
                    ))}
                  </div>
                )
              ) : (
                loadingInstPayments ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">Loading…</div>
                ) : institutePayments.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No active institute payments</div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {institutePayments.map(p => {
                      const sel = selectedInstPaymentIds.has(p.id);
                      const paid = p.mySubmissionStatus === 'VERIFIED';
                      return (
                        <button key={p.id} type="button" disabled={paid}
                          onClick={() => { if (!paid) setSelectedInstPaymentIds(prev => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; }); }}
                          className={`w-full text-left px-3 py-2.5 flex items-center gap-2 ${paid ? 'opacity-60' : sel ? 'bg-primary/5' : 'hover:bg-muted/40'}`}>
                          {paid ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                            : sel ? <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                            : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{p.description}</p>
                            <p className="text-xs text-primary font-bold">Rs {Number(p.amount).toLocaleString()}</p>
                          </div>
                          {p.mySubmissionStatus && <PayBadge status={p.mySubmissionStatus} />}
                        </button>
                      );
                    })}
                  </div>
                )
              )}
            </div>

            {/* Attendance */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-3 py-2 bg-muted/40 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-sm">Attendance (30 days)</span>
                {loadingAtt && <Loader2 className="h-3.5 w-3.5 animate-spin ml-auto" />}
                {selectedSessionIds.size > 0 && (
                  <Badge className="ml-auto bg-blue-100 text-blue-800 border-blue-200 text-[10px]">{selectedSessionIds.size} sel.</Badge>
                )}
              </div>
              {loadingAtt ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Loading…</div>
              ) : attSessions.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No sessions in range</div>
              ) : (
                <div className="max-h-52 overflow-y-auto divide-y divide-border/40">
                  {attSessions.map(s => <AttRow key={s.sessionId} s={s} />)}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="space-y-2">
              {paymentMode === 'class' && (
                <div className="grid grid-cols-3 gap-1.5">
                  {(['full', 'half', 'quarter'] as PaymentTier[]).map(t => (
                    <button key={t} type="button" onClick={() => setTier(t)}
                      className={`rounded-lg border py-2 text-xs font-semibold transition-all ${
                        tier === t ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted'
                      }`}>
                      {TIER_LABEL[t]}
                    </button>
                  ))}
                </div>
              )}
              {financeAccounts.length > 0 && (
                <Select value={targetAccountId} onValueChange={setTargetAccountId}>
                  <SelectTrigger className="text-sm h-10 bg-muted/20 border-border/60">
                    <SelectValue placeholder="Select account…" />
                  </SelectTrigger>
                  <SelectContent>
                    {financeAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.type})</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Textarea placeholder="Notes (optional)…" rows={2} value={notes}
                onChange={e => setNotes(e.target.value)}
                className="text-sm bg-muted/20 border-border/60 resize-none" />
            </div>

            {(paymentMode === 'class' ? selectedPaymentIds.size : selectedInstPaymentIds.size) > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="font-bold text-primary">Rs {(paymentMode === 'class' ? grandTotal : instGrandTotal).toLocaleString()}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={paymentMode === 'class' ? handleCollect : handleCollectInstitute}
                disabled={collecting || (paymentMode === 'class' ? selectedPaymentIds.size : selectedInstPaymentIds.size) === 0}
                className="h-12 bg-green-600 hover:bg-green-700 text-white font-semibold">
                {collecting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Banknote className="h-4 w-4 mr-1.5" />}
                {(() => { const c = paymentMode === 'class' ? selectedPaymentIds.size : selectedInstPaymentIds.size; return `Collect${c > 0 ? ` (${c})` : ''}`; })()}
              </Button>
              <Button onClick={() => doMarkAttendance(true)}
                disabled={markingAtt || selectedSessionIds.size === 0}
                variant="outline"
                className="h-12 border-blue-300 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-950/30 font-semibold">
                {markingAtt ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CalendarDays className="h-4 w-4 mr-1.5" />}
                Mark{selectedSessionIds.size > 0 ? ` (${selectedSessionIds.size})` : ''}
              </Button>
            </div>
          </div>
        )}

        {dialogs}
      </PageContainer>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // DESKTOP RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <PageContainer maxWidth="full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
            <Banknote className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-primary/70">Counter · Physical Collection</p>
            <h1 className="text-xl font-bold tracking-tight">Collect Payment</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {effectiveClassId && (
            <span className="text-[11px] text-muted-foreground bg-muted/50 border border-border/50 rounded-md px-2.5 py-1">
              <CalendarDays className="inline h-3 w-3 mr-1" />
              {fmtDate(ATT_START)} – {fmtDate(ATT_END)}
            </span>
          )}
          <button onClick={() => setPrinterOpen(true)}
            className="p-2 rounded-lg hover:bg-muted border border-border/60 transition-colors"
            title="Printer settings">
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </button>
          <Badge variant="outline" className="gap-1 text-xs">
            <Monitor className="h-3.5 w-3.5" />{selectedInstitute.name}
          </Badge>
        </div>
      </div>

      {/* Class selector */}
      {!ctxClass && (
        <div className="flex items-center gap-2 mb-4">
          <School className="h-4 w-4 text-muted-foreground shrink-0" />
          {loadingClasses ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Select value={pickedClassId} onValueChange={handleClassChange}>
              <SelectTrigger className="h-9 text-sm w-56 bg-muted/20 border-border/60">
                <SelectValue placeholder="Select class…" />
              </SelectTrigger>
              <SelectContent>
                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {effectiveClassName && <Badge variant="secondary" className="text-xs">{effectiveClassName}</Badge>}
        </div>
      )}
      {ctxClass && (
        <div className="flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 w-fit">
          <School className="h-3.5 w-3.5 text-blue-600" />
          <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">{ctxClass.name}</span>
        </div>
      )}

      {/* 3-column layout */}
      {effectiveClassId ? (
        <div className="grid grid-cols-[1fr_300px_1fr] gap-3 h-[calc(100vh-12rem)] min-h-0">

          {/* ═══ LEFT: Payments ═══ */}
          <div className="flex flex-col min-h-0 rounded-xl border border-border shadow-sm overflow-hidden bg-card">
            {/* Header + mode toggle */}
            <div className="px-3 py-2.5 border-b border-border bg-gradient-to-r from-primary/5 to-transparent shrink-0 space-y-2">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Select Payments</span>
                {(paymentMode === 'class' ? selectedPaymentIds.size : selectedInstPaymentIds.size) > 0 && (
                  <Badge className="ml-auto bg-primary/15 text-primary border-primary/25 text-xs">
                    {paymentMode === 'class' ? selectedPaymentIds.size : selectedInstPaymentIds.size} selected
                  </Badge>
                )}
              </div>
              {/* Class / Institute toggle */}
              <div className="grid grid-cols-2 gap-1 bg-muted/40 rounded-lg p-0.5">
                <button type="button"
                  onClick={() => setPaymentMode('class')}
                  className={`rounded-md py-1 text-xs font-semibold transition-all ${paymentMode === 'class' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                  Class Payments
                </button>
                <button type="button"
                  onClick={() => setPaymentMode('institute')}
                  className={`rounded-md py-1 text-xs font-semibold transition-all ${paymentMode === 'institute' ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                  Institute Payments
                </button>
              </div>
            </div>

            {/* Class payments list */}
            {paymentMode === 'class' && (
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
                {loadingPayments ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-10">
                    <Loader2 className="h-4 w-4 animate-spin" />Loading…
                  </div>
                ) : activePayments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                    <AlertCircle className="h-7 w-7 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">{student ? 'No active class payments' : 'Find a student first'}</p>
                  </div>
                ) : activePayments.map(p => <PaymentItem key={p.id} p={p} />)}
              </div>
            )}

            {/* Institute payments list */}
            {paymentMode === 'institute' && (
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
                {loadingInstPayments ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-10">
                    <Loader2 className="h-4 w-4 animate-spin" />Loading…
                  </div>
                ) : !student ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                    <AlertCircle className="h-7 w-7 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Find a student first</p>
                  </div>
                ) : institutePayments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                    <AlertCircle className="h-7 w-7 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">No active institute payments</p>
                  </div>
                ) : institutePayments.map(p => {
                  const sel = selectedInstPaymentIds.has(p.id);
                  const alreadyPaid = p.mySubmissionStatus === 'VERIFIED';
                  return (
                    <button key={p.id} type="button"
                      disabled={alreadyPaid}
                      onClick={() => {
                        if (alreadyPaid) return;
                        setSelectedInstPaymentIds(prev => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; });
                      }}
                      className={`w-full text-left rounded-lg border-2 px-3 py-2.5 transition-all ${
                        alreadyPaid ? 'border-green-200 bg-green-50/40 dark:bg-green-950/20 opacity-60 cursor-default'
                          : sel ? 'border-primary bg-primary/[0.06]'
                          : 'border-border hover:border-primary/50 hover:bg-muted/40'
                      }`}>
                      <div className="flex items-start gap-2">
                        {alreadyPaid
                          ? <CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                          : sel
                          ? <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0 mt-0.5" />
                        }
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate leading-tight">{p.description}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="font-bold text-primary text-sm">Rs {Number(p.amount).toLocaleString()}</span>
                            <Badge variant="outline" className="text-[10px] py-0">{p.priority}</Badge>
                            {p.mySubmissionStatus && <PayBadge status={p.mySubmissionStatus} />}
                          </div>
                          {p.dueDate && <p className="text-[10px] text-muted-foreground mt-0.5">Due: {fmtDate(p.dueDate)}</p>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <PaymentsFooter />
          </div>

          {/* ═══ CENTRE: Student Search ═══ */}
          <div className="flex flex-col min-h-0 rounded-xl border border-border shadow-sm overflow-hidden bg-card">
            <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-muted/60 to-transparent shrink-0 flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Find Student</span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
              <Select value={searchMode} onValueChange={m => { setSearchMode(m as SearchMode); setSearchQuery(''); }}>
                <SelectTrigger className="h-8 text-xs bg-muted/20 border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEARCH_MODES.map(m => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">
                      <div className="flex items-center gap-2"><m.icon className="h-3.5 w-3.5" />{m.label}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <modeConfig.icon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input className="pl-8 text-sm h-9 bg-muted/20 border-border/60"
                    placeholder={modeConfig.placeholder} value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()} />
                </div>
                <Button onClick={handleSearch} disabled={searching} size="sm" className="h-9 px-3">
                  {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                </Button>
              </div>

              {showNamePicker && nameResults.length > 0 && (
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border">
                    <p className="text-xs font-semibold text-muted-foreground">{nameResults.length} matches — pick one</p>
                    <button onClick={() => { setShowNamePicker(false); setNameResults([]); setHasSearched(false); }}>
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                  {nameResults.map(r => (
                    <button key={r.uuid} onClick={() => selectNameResult(r)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-primary/5 border-b last:border-0 text-left transition-colors">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                        {r.nameWithInitials.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{r.nameWithInitials}</p>
                        {r.instituteUserId && <p className="text-[9px] text-muted-foreground">ID: {r.instituteUserId}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {hasSearched && !searching && !student && !showNamePicker && (
                <div className="text-center py-6 rounded-xl bg-muted/40 border border-border/50">
                  <User className="h-7 w-7 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs font-medium text-muted-foreground">No student found</p>
                </div>
              )}

              {student && (
                <div className="rounded-xl bg-gradient-to-br from-primary/8 to-primary/5 border border-primary/20 p-3 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar size="md" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{student.nameWithInitials}</p>
                      {student.instituteUserId && <p className="text-[11px] text-muted-foreground">ID: {student.instituteUserId}</p>}
                    </div>
                    <button onClick={clearStudent} className="p-1 rounded-md hover:bg-muted/50 transition-colors">
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                  {/* Payment status mini-list */}
                  {activePayments.length > 0 && (
                    <div className="space-y-1">
                      {activePayments.slice(0, 5).map(p => (
                        <div key={p.id} className="flex items-center justify-between gap-1 text-[11px]">
                          <span className="truncate text-muted-foreground">{p.title ?? p.description}</span>
                          {loadingSubMap ? <Loader2 className="h-3 w-3 animate-spin" /> : <PayBadge status={getBestStatus(p.id)} />}
                        </div>
                      ))}
                      {activePayments.length > 5 && <p className="text-[10px] text-muted-foreground">+{activePayments.length - 5} more</p>}
                    </div>
                  )}
                  <button onClick={clearStudent}
                    className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 py-1.5 rounded-lg hover:bg-muted/40 transition-colors">
                    <RefreshCw className="h-3.5 w-3.5" />Clear & find new student
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ═══ RIGHT: Attendance ═══ */}
          <div className="flex flex-col min-h-0 rounded-xl border border-border shadow-sm overflow-hidden bg-card">
            <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-blue-500/5 to-transparent flex items-center gap-2 shrink-0">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-sm">Attendance</span>
              <span className="text-[10px] text-muted-foreground ml-0.5">30-day</span>
              {selectedSessionIds.size > 0 && (
                <Badge className="ml-auto bg-blue-100 text-blue-800 border-blue-200 text-xs">{selectedSessionIds.size} sel.</Badge>
              )}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {!student ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
                  <User className="h-8 w-8 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground">Find a student to see attendance</p>
                </div>
              ) : loadingAtt ? (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-10">
                  <Loader2 className="h-4 w-4 animate-spin" />Loading…
                </div>
              ) : attSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
                  <CalendarDays className="h-8 w-8 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground">No sessions in last 30 days</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {attSessions.map(s => <AttRow key={s.sessionId} s={s} />)}
                </div>
              )}
            </div>
            {/* Attendance footer */}
            <div className="px-4 py-3 border-t border-border shrink-0 space-y-2 bg-card">
              {student && unmarkedSessions.length > 0 && (
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedSessionIds(new Set(unmarkedSessions.map(s => s.sessionId)))}
                    className="text-[11px] text-blue-600 hover:underline">
                    Select all unmarked ({unmarkedSessions.length})
                  </button>
                  {selectedSessionIds.size > 0 && <>
                    <span className="text-muted-foreground text-[10px]">·</span>
                    <button onClick={() => setSelectedSessionIds(new Set())} className="text-[11px] text-muted-foreground hover:underline">Clear</button>
                  </>}
                </div>
              )}
              <Button onClick={() => doMarkAttendance(true)}
                disabled={markingAtt || selectedSessionIds.size === 0 || !student}
                variant="outline"
                className="w-full h-10 border-blue-300 text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-950/30 font-semibold text-sm">
                {markingAtt ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarDays className="h-4 w-4 mr-2" />}
                {markingAtt ? 'Marking…'
                  : selectedSessionIds.size === 0 ? 'Select sessions to mark'
                  : !student ? 'Find student first'
                  : `Mark Present (${selectedSessionIds.size})`}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
          <div className="h-20 w-20 rounded-2xl bg-muted/50 flex items-center justify-center">
            <School className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <p className="font-medium">No class selected</p>
          <p className="text-sm text-muted-foreground">Select a class above to start collecting payments</p>
        </div>
      )}

      {dialogs}
    </PageContainer>
  );
};

export default CollectPhysicalPayment;

