import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { attendanceApi } from '@/api/attendance.api';
import { apiClient } from '@/api/client';
import type {
  ClassAttendanceSnapshot,
  InstituteAttendanceSnapshot,
  StudentClassStatusRecord,
  StudentInstituteStatusRecord,
  StudentsWithClassStatusSummary,
  StudentsWithInstituteStatusSummary,
} from '@/api/attendance.api';
import classAttendanceSessionsApi, { type Session, type SessionStudentRecord } from '@/api/classAttendanceSessions.api';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { getSriLankaDate } from '@/utils/timezone';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import Paper from '@mui/material/Paper';
import MuiTable from '@mui/material/Table';
import MuiTableBody from '@mui/material/TableBody';
import MuiTableCell from '@mui/material/TableCell';
import MuiTableContainer from '@mui/material/TableContainer';
import MuiTableHead from '@mui/material/TableHead';
import MuiTableRow from '@mui/material/TableRow';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  UserCheck,
  UserMinus,
  Users,
  XCircle,
  CalendarClock,
} from 'lucide-react';

type FilterMode = 'all' | 'needs-action' | 'already-marked' | 'present-at-source' | 'no-source-mark';
type PageMode = 'class' | 'subject'; // 'class' = institute→class, 'subject' = class→subject
type OverrideStatus = 'auto' | 'present' | 'absent' | 'late' | 'left' | 'left_early' | 'left_lately';

const OVERRIDE_OPTIONS: { value: OverrideStatus; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'late', label: 'Late' },
  { value: 'left', label: 'Left' },
  { value: 'left_early', label: 'Left Early' },
  { value: 'left_lately', label: 'Left Lately' },
];

const getTodayInputValue = () => getSriLankaDate();

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

const formatStatus = (value: string | null | undefined) => {
  if (!value) return 'Not Marked';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const isPresentAtInstitute = (attendance: InstituteAttendanceSnapshot | null) => (
  attendance !== null && attendance.statusCode !== null && attendance.statusCode !== 0
);

const getInstituteBadge = (attendance: InstituteAttendanceSnapshot | null) => {
  if (!attendance) {
    return {
      label: 'No Institute Mark',
      detail: 'No check-in record for this date',
      className: 'border-slate-200 bg-slate-100 text-slate-700',
      icon: Clock3,
    };
  }

  if (attendance.statusCode === 0) {
    return {
      label: 'Absent',
      detail: attendance.time ? `Marked at ${attendance.time}` : 'Marked absent at institute',
      className: 'border-rose-200 bg-rose-100 text-rose-700',
      icon: XCircle,
    };
  }

  if (attendance.statusCode === 2) {
    return {
      label: 'Late',
      detail: attendance.time ? `Checked in at ${attendance.time}` : 'Marked late at institute',
      className: 'border-amber-200 bg-amber-100 text-amber-700',
      icon: Clock3,
    };
  }

  return {
    label: formatStatus(attendance.status),
    detail: attendance.time ? `Checked in at ${attendance.time}` : 'Present at institute',
    className: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    icon: CheckCircle2,
  };
};

const getClassBadge = (record: StudentInstituteStatusRecord) => {
  if (!record.classAttendance) {
    return {
      label: 'Not Marked',
      detail: 'No class attendance yet',
      className: 'border-slate-200 bg-slate-100 text-slate-700',
    };
  }

  const status = record.classAttendance.status?.toLowerCase();
  if (status === 'absent') {
    return {
      label: 'Absent',
      detail: record.classAttendance.time ? `Marked at ${record.classAttendance.time}` : 'Marked absent in class',
      className: 'border-rose-200 bg-rose-100 text-rose-700',
    };
  }
  if (status === 'late') {
    return {
      label: 'Late',
      detail: record.classAttendance.time ? `Marked at ${record.classAttendance.time}` : 'Marked late in class',
      className: 'border-amber-200 bg-amber-100 text-amber-700',
    };
  }
  if (status === 'left' || status === 'left_early' || status === 'left_lately') {
    return {
      label: formatStatus(record.classAttendance.status),
      detail: record.classAttendance.time ? `Marked at ${record.classAttendance.time}` : 'Left class',
      className: 'border-orange-200 bg-orange-100 text-orange-700',
    };
  }

  return {
    label: formatStatus(record.classAttendance.status),
    detail: record.classAttendance.time ? `Marked at ${record.classAttendance.time}` : 'Already marked in class',
    className: 'border-emerald-200 bg-emerald-100 text-emerald-700',
  };
};

const getPreviewBadge = (
  record: StudentInstituteStatusRecord,
  markPresentFromInstitute: boolean,
  markAbsentForUnmarked: boolean,
  override?: OverrideStatus,
) => {
  if (record.classAttendance) {
    if (override && override !== 'auto') {
      return {
        label: `Change → ${formatStatus(override)}`,
        detail: 'Override will change existing status',
        className: 'border-violet-200 bg-violet-100 text-violet-700',
      };
    }
    return {
      label: 'Skip',
      detail: 'Already marked in class',
      className: 'border-slate-200 bg-slate-100 text-slate-700',
    };
  }

  if (override && override !== 'auto') {
    return {
      label: `Override → ${formatStatus(override)}`,
      detail: 'Manual override applied',
      className: 'border-violet-200 bg-violet-100 text-violet-700',
    };
  }

  if (isPresentAtInstitute(record.instituteAttendance) && markPresentFromInstitute) {
    return {
      label: 'Mark Present',
      detail: 'Student showed up at the institute',
      className: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    };
  }

  if (record.instituteAttendance && record.instituteAttendance.statusCode === 0) {
    return {
      label: 'Mark Absent',
      detail: 'Student was Absent in institute',
      className: 'border-rose-200 bg-rose-100 text-rose-700',
    };
  }

  if (!record.instituteAttendance && markAbsentForUnmarked) {
    return {
      label: 'Mark Absent',
      detail: 'Student was not marked in institute',
      className: 'border-amber-200 bg-amber-100 text-amber-700',
    };
  }

  return {
    label: 'No Action',
    detail: 'Current rules do not change this student',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
  };
};

// ─── Subject mode helpers (class → subject) ───────────────────────────────────────

const isPresentAtClass = (attendance: ClassAttendanceSnapshot | null) =>
  attendance !== null && attendance.statusCode !== null && attendance.statusCode !== 0;

const getClassSourceBadge = (attendance: ClassAttendanceSnapshot | null) => {
  if (!attendance) {
    return {
      label: 'No Class Mark',
      detail: 'No class record for this date',
      className: 'border-slate-200 bg-slate-100 text-slate-700',
      icon: Clock3,
    };
  }
  if (attendance.statusCode === 0) {
    return {
      label: 'Absent',
      detail: attendance.time ? `Marked at ${attendance.time}` : 'Marked absent in class',
      className: 'border-rose-200 bg-rose-100 text-rose-700',
      icon: XCircle,
    };
  }
  if (attendance.statusCode === 2) {
    return {
      label: 'Late',
      detail: attendance.time ? `Checked in at ${attendance.time}` : 'Marked late in class',
      className: 'border-amber-200 bg-amber-100 text-amber-700',
      icon: Clock3,
    };
  }
  return {
    label: formatStatus(attendance.status),
    detail: attendance.time ? `Checked in at ${attendance.time}` : 'Present in class',
    className: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    icon: CheckCircle2,
  };
};

const getSubjectTargetBadge = (record: StudentClassStatusRecord) => {
  if (!record.subjectAttendance) {
    return {
      label: 'Not Marked',
      detail: 'No subject attendance yet',
      className: 'border-slate-200 bg-slate-100 text-slate-700',
    };
  }

  const status = record.subjectAttendance.status?.toLowerCase();
  if (status === 'absent') {
    return {
      label: 'Absent',
      detail: record.subjectAttendance.time ? `Marked at ${record.subjectAttendance.time}` : 'Marked absent in subject',
      className: 'border-rose-200 bg-rose-100 text-rose-700',
    };
  }
  if (status === 'late') {
    return {
      label: 'Late',
      detail: record.subjectAttendance.time ? `Marked at ${record.subjectAttendance.time}` : 'Marked late in subject',
      className: 'border-amber-200 bg-amber-100 text-amber-700',
    };
  }
  if (status === 'left' || status === 'left_early' || status === 'left_lately') {
    return {
      label: formatStatus(record.subjectAttendance.status),
      detail: record.subjectAttendance.time ? `Marked at ${record.subjectAttendance.time}` : 'Left subject',
      className: 'border-orange-200 bg-orange-100 text-orange-700',
    };
  }

  return {
    label: formatStatus(record.subjectAttendance.status),
    detail: record.subjectAttendance.time ? `Marked at ${record.subjectAttendance.time}` : 'Already marked in subject',
    className: 'border-emerald-200 bg-emerald-100 text-emerald-700',
  };
};

const getSubjectPreviewBadge = (
  record: StudentClassStatusRecord,
  markPresentFromClass: boolean,
  markAbsentForUnmarked: boolean,
  override?: OverrideStatus,
) => {
  if (record.subjectAttendance) {
    if (override && override !== 'auto') {
      return { label: `Change → ${formatStatus(override)}`, detail: 'Override will change existing status', className: 'border-violet-200 bg-violet-100 text-violet-700' };
    }
    return { label: 'Skip', detail: 'Already marked in subject', className: 'border-slate-200 bg-slate-100 text-slate-700' };
  }
  if (override && override !== 'auto') {
    return { label: `Override → ${formatStatus(override)}`, detail: 'Manual override applied', className: 'border-violet-200 bg-violet-100 text-violet-700' };
  }
  if (isPresentAtClass(record.classAttendance) && markPresentFromClass) {
    return { label: 'Mark Present', detail: 'Student was present in class', className: 'border-emerald-200 bg-emerald-100 text-emerald-700' };
  }
  if (record.classAttendance && record.classAttendance.statusCode === 0) {
    return { label: 'Mark Absent', detail: 'Student was Absent in class', className: 'border-rose-200 bg-rose-100 text-rose-700' };
  }
  if (!record.classAttendance && markAbsentForUnmarked) {
    return { label: 'Mark Absent', detail: 'Student was not marked in class', className: 'border-amber-200 bg-amber-100 text-amber-700' };
  }
  return { label: 'No Action', detail: 'Current rules do not change this student', className: 'border-slate-200 bg-slate-100 text-slate-700' };
};

const FILTER_ORDER: FilterMode[] = [
  'all',
  'needs-action',
  'already-marked',
  'present-at-source',
  'no-source-mark',
];

const FILTER_COLORS: Record<FilterMode, { active: string; inactive: string }> = {
  'all': { active: 'bg-sky-600 text-white shadow-sm', inactive: 'text-sky-700 hover:bg-sky-100' },
  'needs-action': { active: 'bg-amber-500 text-white shadow-sm', inactive: 'text-amber-700 hover:bg-amber-100' },
  'already-marked': { active: 'bg-emerald-600 text-white shadow-sm', inactive: 'text-emerald-700 hover:bg-emerald-100' },
  'present-at-source': { active: 'bg-violet-600 text-white shadow-sm', inactive: 'text-violet-700 hover:bg-violet-100' },
  'no-source-mark': { active: 'bg-rose-500 text-white shadow-sm', inactive: 'text-rose-700 hover:bg-rose-100' },
};

const getFilterLabel = (mode: FilterMode, pageMode: PageMode) => {
  if (mode === 'all') return 'All';
  if (mode === 'needs-action') return 'Needs Action';
  if (mode === 'already-marked') return pageMode === 'subject' ? 'Already in Subject' : 'Already in Class';
  if (mode === 'present-at-source') return pageMode === 'subject' ? 'Present in Class' : 'Present at Institute';
  return pageMode === 'subject' ? 'No Class Mark' : 'No Institute Mark';
};

const ManualClassAttendance = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedInstitute, selectedClass, selectedSubject, currentInstituteId } = useAuth();

  const sessionId = new URLSearchParams(location.search).get('sessionId') ?? undefined;
  const sessionName = new URLSearchParams(location.search).get('sessionName') ?? undefined;

  // Normalize IDs to strings to avoid useCallback re-creating when URL placeholder
  // (string "1004") is replaced by the API-loaded class object (numeric 1004).
  const instituteId = (currentInstituteId ?? selectedInstitute?.id)?.toString() ?? null;
  const subjectId = selectedSubject?.id?.toString() ?? null;

  // Local class picker — used when no class is pre-selected in sidebar context
  const [localClassId, setLocalClassId] = useState('');
  const [localClassName, setLocalClassName] = useState('');
  const [availableClasses, setAvailableClasses] = useState<{ id: string; name: string }[]>([]);

  const classId = selectedClass?.id?.toString() ?? (localClassId || null);
  const effectiveClassName = selectedClass?.name ?? localClassName;

  // Dual mode: 'class' = institute→class, 'subject' = class→subject
  const mode: PageMode = subjectId ? 'subject' : 'class';

  const [date, setDate] = useState(getTodayInputValue);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [markPresent, setMarkPresent] = useState(true);
  const [markAbsentForUnmarked, setMarkAbsentForUnmarked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  // Class mode state
  const [students, setStudents] = useState<StudentInstituteStatusRecord[]>([]);
  const [classSummary, setClassSummary] = useState<StudentsWithInstituteStatusSummary | null>(null);
  // Subject mode state
  const [subjectStudents, setSubjectStudents] = useState<StudentClassStatusRecord[]>([]);
  const [subjectSummary, setSubjectSummary] = useState<StudentsWithClassStatusSummary | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  // Per-student override map: studentId → override status
  const [overrides, setOverrides] = useState<Record<string, OverrideStatus>>({});
  // Guard: prevent a stale in-flight request from overwriting state after deps change
  const abortControllerRef = useRef<AbortController | null>(null);

  // ── Session mode state ─────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [sessionStudents, setSessionStudents] = useState<SessionStudentRecord[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);
  // Local pending status map for session mode: studentId → statusCode (1=present,0=absent,2=late)
  const [sessionPending, setSessionPending] = useState<Record<string, number>>({});
  const [bulkSessionLoading, setBulkSessionLoading] = useState(false);

  // Auto-advance date state when Sri Lanka rolls past midnight (page open across midnight)
  useEffect(() => {
    const checkDate = () => {
      const sriLankaToday = getSriLankaDate();
      setDate(prev => prev < sriLankaToday ? sriLankaToday : prev);
    };
    // Check every minute
    const interval = setInterval(checkDate, 60_000);
    checkDate(); // also run immediately in case page was loaded stale
    return () => clearInterval(interval);
  }, []);

  // Load classes for the inline picker when no class is in sidebar context
  useEffect(() => {
    if (selectedClass || !instituteId) return;
    apiClient
      .get(`/institutes/${instituteId}/classes`)
      .then((res: any) => setAvailableClasses(Array.isArray(res) ? res : res?.data || []))
      .catch(() => {});
  }, [instituteId, selectedClass]);

  // Load sessions when class is selected (for session picker)
  useEffect(() => {
    if (!instituteId || !classId) { setSessions([]); return; }
    setLoadingSessions(true);
    setSelectedSessionId('');
    setSessionStudents([]);
    setSessionPending({});
    classAttendanceSessionsApi.getSessions(instituteId, classId, { includeClosed: false })
      .then(res => setSessions(Array.isArray(res) ? res : []))
      .catch(() => setSessions([]))
      .finally(() => setLoadingSessions(false));
  }, [instituteId, classId]);

  // Load session detail when session is selected
  useEffect(() => {
    if (!instituteId || !classId || !selectedSessionId) { setSessionStudents([]); setSessionPending({}); return; }
    setLoadingSession(true);
    classAttendanceSessionsApi.getSessionDetail(instituteId, classId, selectedSessionId)
      .then(detail => {
        setSessionStudents(detail.students || []);
        // Pre-fill pending with existing marks
        const pre: Record<string, number> = {};
        for (const s of detail.students) {
          if (s.statusCode !== null) pre[s.studentId] = s.statusCode;
        }
        setSessionPending(pre);
      })
      .catch(() => setSessionStudents([]))
      .finally(() => setLoadingSession(false));
  }, [instituteId, classId, selectedSessionId]);

  const today = getSriLankaDate();
  const isPastDate = date < today;
  const isFutureDate = date > today;
  const isNotToday = isPastDate || isFutureDate;

  const goBack = () => {
    if (!instituteId) {
      navigate('/dashboard');
      return;
    }
    let base = `/institute/${instituteId}`;
    if (selectedClass?.id) {
      base += `/class/${selectedClass.id}`;
      if (selectedSubject?.id) base += `/subject/${selectedSubject.id}`;
    }
    // If we came from a session, go back to the mark-type page (which has sessionId in URL)
    if (sessionId && selectedClass?.id) {
      const qs = new URLSearchParams({ sessionId });
      if (sessionName) qs.set('sessionName', sessionName);
      navigate(`${base}/select-attendance-mark-type?${qs}`);
      return;
    }
    navigate(`${base}/select-attendance-mark-type`);
  };

  const loadManualAttendance = useCallback(async () => {
    if (!instituteId || !classId) return;

    // Cancel any previous in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setLoadError(null);
    try {
      if (mode === 'subject' && subjectId) {
        const response = await attendanceApi.query.getStudentsWithClassStatus(instituteId, classId, subjectId, { date });
        if (controller.signal.aborted) return;
        setSubjectStudents(response.data || []);
        setSubjectSummary(response.summary || null);
      } else {
        const response = await attendanceApi.query.getStudentsWithInstituteStatus(instituteId, classId, { date });
        if (controller.signal.aborted) return;
        setStudents(response.data || []);
        setClassSummary(response.summary || null);
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setLoadError(error instanceof Error ? error.message : 'Failed to load attendance data');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [classId, date, instituteId, mode, subjectId]);

  useEffect(() => {
    void loadManualAttendance();
    return () => { abortControllerRef.current?.abort(); };
  }, [loadManualAttendance]);

  // Clear overrides when date changes
  useEffect(() => {
    setOverrides({});
  }, [date]);

  const filteredStudents = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    if (mode === 'subject') {
      return subjectStudents.filter((student) => {
        const searchMatch = !searchValue
          || (student.studentName || '').toLowerCase().includes(searchValue)
          || (student.studentId || '').toLowerCase().includes(searchValue);
        if (!searchMatch) return false;
        if (filterMode === 'already-marked') return Boolean(student.subjectAttendance);
        if (filterMode === 'present-at-source') return isPresentAtClass(student.classAttendance);
        if (filterMode === 'no-source-mark') return !student.classAttendance;
        if (filterMode === 'needs-action') {
          const preview = getSubjectPreviewBadge(student, markPresent, markAbsentForUnmarked, overrides[student.studentId]).label;
          return preview === 'Mark Present' || preview === 'Mark Absent';
        }
        return true;
      });
    }

    return students.filter((student) => {
      const searchMatch = !searchValue
        || (student.studentName || '').toLowerCase().includes(searchValue)
        || (student.studentId || '').toLowerCase().includes(searchValue);
      if (!searchMatch) return false;
      if (filterMode === 'already-marked') return Boolean(student.classAttendance);
      if (filterMode === 'present-at-source') return isPresentAtInstitute(student.instituteAttendance);
      if (filterMode === 'no-source-mark') return !student.instituteAttendance;
      if (filterMode === 'needs-action') {
        const preview = getPreviewBadge(student, markPresent, markAbsentForUnmarked, overrides[student.studentId]).label;
        return preview === 'Mark Present' || preview === 'Mark Absent';
      }
      return true;
    });
  }, [filterMode, markAbsentForUnmarked, markPresent, mode, overrides, search, students, subjectStudents]);

  const previewSummary = useMemo(() => {
    const acc = { markPresent: 0, markAbsent: 0, skipped: 0, noAction: 0, overrides: 0, statusChanged: 0 };
    const overrideCount = Object.values(overrides).filter((v) => v !== 'auto').length;
    acc.overrides = overrideCount;
    if (mode === 'subject') {
      for (const s of subjectStudents) {
        const label = getSubjectPreviewBadge(s, markPresent, markAbsentForUnmarked, overrides[s.studentId]).label;
        if (label.startsWith('Change')) acc.statusChanged += 1;
        else if (label.startsWith('Override')) acc.overrides += 0; // already counted
        else if (label === 'Mark Present') acc.markPresent += 1;
        else if (label === 'Mark Absent') acc.markAbsent += 1;
        else if (label === 'Skip') acc.skipped += 1;
        else acc.noAction += 1;
      }
    } else {
      for (const s of students) {
        const label = getPreviewBadge(s, markPresent, markAbsentForUnmarked, overrides[s.studentId]).label;
        if (label.startsWith('Change')) acc.statusChanged += 1;
        else if (label.startsWith('Override')) acc.overrides += 0; // already counted
        else if (label === 'Mark Present') acc.markPresent += 1;
        else if (label === 'Mark Absent') acc.markAbsent += 1;
        else if (label === 'Skip') acc.skipped += 1;
        else acc.noAction += 1;
      }
    }
    return acc;
  }, [markAbsentForUnmarked, markPresent, mode, overrides, students, subjectStudents]);

  // Compute summary counts directly from loaded student data — more reliable than
  // the API summary field which may return stale or 0 values (e.g. notMarkedInInstitute).
  const computedCounts = useMemo(() => {
    if (mode === 'subject') {
      const presentInClass = subjectStudents.filter((s) => isPresentAtClass(s.classAttendance)).length;
      const notMarkedInClass = subjectStudents.filter((s) => s.classAttendance === null).length;
      const alreadyMarkedInSubject = subjectStudents.filter((s) => s.subjectAttendance !== null).length;
      return { total: subjectStudents.length, presentInClass, notMarkedInClass, alreadyMarkedInSubject, presentInInstitute: 0, notMarkedInInstitute: 0, alreadyMarkedInClass: 0 };
    }
    const presentInInstitute = students.filter((s) => isPresentAtInstitute(s.instituteAttendance)).length;
    const notMarkedInInstitute = students.filter((s) => s.instituteAttendance === null).length;
    const alreadyMarkedInClass = students.filter((s) => s.classAttendance !== null).length;
    return { total: students.length, presentInInstitute, notMarkedInInstitute, alreadyMarkedInClass, presentInClass: 0, notMarkedInClass: 0, alreadyMarkedInSubject: 0 };
  }, [mode, students, subjectStudents]);

  const totalStudentsInMode = computedCounts.total;

  // Local-only override change — no API call; submitted together via bulk button
  const handleStatusChange = (studentId: string, value: string, _isAlreadyMarked: boolean) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (value === 'auto') delete next[studentId];
      else next[studentId] = value as OverrideStatus;
      return next;
    });
  };

  // Bulk submit for session mode — single API call for all pending changes
  const handleSessionBulkMark = async () => {
    if (!instituteId || !classId || !selectedSessionId) return;
    const records = sessionStudents.map(s => ({
      studentId: s.studentId,
      status: sessionPending[s.studentId] ?? s.statusCode ?? 0,
    }));
    if (records.length === 0) { toast.info('No students to mark'); return; }
    setBulkSessionLoading(true);
    try {
      const res = await classAttendanceSessionsApi.bulkMarkAttendance(
        instituteId, classId, selectedSessionId,
        { records }
      );
      toast.success(`Marked ${res.marked} students (${res.updated} updated)`);
      if (res.errors?.length) toast.error(`${res.errors.length} errors`);
      // Reload session detail to reflect saved state
      const detail = await classAttendanceSessionsApi.getSessionDetail(instituteId, classId, selectedSessionId);
      setSessionStudents(detail.students || []);
      const pre: Record<string, number> = {};
      for (const s of detail.students) {
        if (s.statusCode !== null) pre[s.studentId] = s.statusCode;
      }
      setSessionPending(pre);
    } catch (e: any) {
      toast.error(e.message || 'Failed to bulk mark session');
    } finally {
      setBulkSessionLoading(false);
    }
  };

  const handleBulkMark = async () => {
    if (!instituteId || !classId || !selectedInstitute || !effectiveClassName) {
      toast.error('Select an institute and class first');
      return;
    }
    // Build studentOverrides array from non-auto overrides
    const studentOverrides = Object.entries(overrides)
      .filter(([, status]) => status !== 'auto')
      .map(([studentId, status]) => ({ studentId, status }));

    if (!markPresent && !markAbsentForUnmarked && studentOverrides.length === 0) {
      toast.error('Enable at least one rule or set an override before bulk marking');
      return;
    }

    setBulkLoading(true);
    try {
      if (mode === 'subject' && subjectId && selectedSubject) {
        const result = await attendanceApi.bulkMarkFromClass(instituteId, classId, subjectId, {
          instituteName: selectedInstitute.name,
          className: effectiveClassName,
          subjectName: selectedSubject.name,
          date,
          markPresentFromClass: markPresent,
          markAbsentForUnmarked,
          markingMethod: 'manual',
          eventId: null,
          ...(studentOverrides.length > 0 && { studentOverrides }),
        });
        setLastMessage(result.message);
        toast.success(result.message || 'Subject attendance updated');
        if (result.summary.failed > 0) {
          toast.error(`${result.summary.failed} student records failed during bulk marking`);
        }
      } else {
        const result = await attendanceApi.bulkMarkFromInstitute(instituteId, classId, {
          instituteName: selectedInstitute.name,
          className: effectiveClassName,
          date,
          markPresentFromInstitute: markPresent,
          markAbsentForUnmarked,
          markingMethod: 'manual',
          eventId: null,
          ...(sessionId ? { sessionId } : {}),
          ...(studentOverrides.length > 0 && { studentOverrides }),
        });
        setLastMessage(result.message);
        toast.success(result.message || 'Class attendance updated');
        if (result.summary.failed > 0) {
          toast.error(`${result.summary.failed} student records failed during bulk marking`);
        }
      }
      setOverrides({});
      await loadManualAttendance();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to bulk mark attendance');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={goBack} className="rounded-full shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {mode === 'subject' ? 'Manual Subject Attendance' : 'Inherit from Institute'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'subject'
              ? 'View class check-ins and bulk mark subject attendance for the selected date'
              : sessionId
                ? `Bulk marking into session: ${sessionName || sessionId}`
                : 'View institute check-ins and bulk mark class attendance for the selected date'}
          </p>
        </div>
      </div>

      {/* Inline class picker — shown when no class is pre-selected in sidebar */}
      {!selectedClass && (
        <Card className="border-border/70">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1 space-y-1 min-w-0">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Class</Label>
              <Select
                value={localClassId}
                onValueChange={(id) => {
                  setLocalClassId(id);
                  const cls = availableClasses.find((c) => c.id === id);
                  setLocalClassName(cls?.name ?? '');
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choose a class to continue…" />
                </SelectTrigger>
                <SelectContent>
                  {availableClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session picker — shown when class is selected */}
      {classId && (
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Select Attendance Session
            </CardTitle>
            <CardDescription className="text-xs">
              Choose a session to manually mark attendance for all students at once.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingSessions ? (
              <Skeleton className="h-10 w-full" />
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open sessions found for this class.</p>
            ) : (
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choose a session…" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-medium">{s.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {s.date} · {s.startTime}{s.endTime ? `–${s.endTime}` : ''} · {s.totalStudents} students
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Session student grid */}
            {selectedSessionId && (
              <div className="space-y-3">
                {loadingSession ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : sessionStudents.length > 0 ? (
                  <>
                    {/* Quick-set all buttons */}
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs text-muted-foreground font-medium">Set all:</span>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => setSessionPending(Object.fromEntries(sessionStudents.map(s => [s.studentId, 1])))}>
                        All Present
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                        onClick={() => setSessionPending(Object.fromEntries(sessionStudents.map(s => [s.studentId, 0])))}>
                        All Absent
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                        onClick={() => setSessionPending(Object.fromEntries(sessionStudents.map(s => [s.studentId, 2])))}>
                        All Late
                      </Button>
                    </div>

                    {/* Summary pills */}
                    <div className="flex flex-wrap gap-2">
                      {[
                        { code: 1, label: 'Present', cls: 'bg-emerald-100 text-emerald-700' },
                        { code: 0, label: 'Absent',  cls: 'bg-red-100 text-red-700' },
                        { code: 2, label: 'Late',    cls: 'bg-amber-100 text-amber-700' },
                      ].map(({ code, label, cls }) => {
                        const count = Object.values(sessionPending).filter(v => v === code).length;
                        return (
                          <Badge key={code} className={cn('border-0', cls)}>
                            {label}: {count}
                          </Badge>
                        );
                      })}
                      {(() => {
                        const unmarked = sessionStudents.filter(s => sessionPending[s.studentId] === undefined).length;
                        return unmarked > 0 ? <Badge className="border-0 bg-slate-100 text-slate-600">Not set: {unmarked}</Badge> : null;
                      })()}
                    </div>

                    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                      <MuiTableContainer sx={{ maxHeight: 420 }}>
                        <MuiTable stickyHeader size="small">
                          <MuiTableHead>
                            <MuiTableRow>
                              <MuiTableCell sx={{ fontWeight: 600, width: 280 }}>Student</MuiTableCell>
                              <MuiTableCell sx={{ fontWeight: 600 }}>Current Status</MuiTableCell>
                              <MuiTableCell sx={{ fontWeight: 600, width: 180 }}>Mark As</MuiTableCell>
                            </MuiTableRow>
                          </MuiTableHead>
                          <MuiTableBody>
                            {sessionStudents.map(student => {
                              const pending = sessionPending[student.studentId];
                              const statusLabel = pending === 1 ? 'Present' : pending === 0 ? 'Absent' : pending === 2 ? 'Late' : '—';
                              const statusCls = pending === 1 ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                                : pending === 0 ? 'border-red-200 bg-red-100 text-red-700'
                                : pending === 2 ? 'border-amber-200 bg-amber-100 text-amber-700'
                                : 'border-slate-200 bg-slate-100 text-slate-500';
                              return (
                                <MuiTableRow hover key={student.studentId}>
                                  <MuiTableCell>
                                    <div className="flex items-center gap-2.5">
                                      <Avatar className="h-8 w-8 border border-border/50">
                                        <AvatarImage src={getImageUrl(student.imageUrl || '')} alt={student.studentName} />
                                        <AvatarFallback className="text-xs bg-sky-100 text-sky-800">{getInitials(student.studentName)}</AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <p className="text-sm font-medium">{student.studentName}</p>
                                        <p className="text-xs text-muted-foreground">{student.userIdInstitute || student.studentId}</p>
                                      </div>
                                    </div>
                                  </MuiTableCell>
                                  <MuiTableCell>
                                    <Badge className={cn('border text-xs', statusCls)}>{statusLabel}</Badge>
                                  </MuiTableCell>
                                  <MuiTableCell>
                                    <div className="flex gap-1">
                                      {[
                                        { code: 1, label: 'P', cls: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50' },
                                        { code: 0, label: 'A', cls: 'border-red-300 text-red-700 hover:bg-red-50' },
                                        { code: 2, label: 'L', cls: 'border-amber-300 text-amber-700 hover:bg-amber-50' },
                                      ].map(({ code, label, cls }) => (
                                        <Button
                                          key={code}
                                          size="sm"
                                          variant="outline"
                                          className={cn('h-7 w-8 p-0 text-xs font-bold', cls, pending === code && 'ring-2 ring-offset-1')}
                                          onClick={() => setSessionPending(prev => ({ ...prev, [student.studentId]: code }))}
                                        >
                                          {label}
                                        </Button>
                                      ))}
                                    </div>
                                  </MuiTableCell>
                                </MuiTableRow>
                              );
                            })}
                          </MuiTableBody>
                        </MuiTable>
                      </MuiTableContainer>
                    </Paper>

                    <Button
                      className="w-full bg-sky-600 text-white hover:bg-sky-700"
                      disabled={bulkSessionLoading || sessionStudents.length === 0}
                      onClick={handleSessionBulkMark}
                    >
                      {bulkSessionLoading
                        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                        : <><ClipboardCheck className="mr-2 h-4 w-4" />Save All ({sessionStudents.length} students)</>}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No students in this session.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rest of the page only when a class is selected */}
      {!classId ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">Select a class above to continue</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Choose a class from the dropdown to load students and mark attendance.
          </p>
        </div>
      ) : (<>

        <Card className="border-border/70 bg-white/90 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Filters and Summary</CardTitle>
            <CardDescription>
              {mode === 'subject'
                ? 'Choose a date, search students, and review the class attendance snapshot before bulk marking.'
                : 'Choose a date, search students, and review the institute attendance snapshot before bulk marking.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)_auto]">
              <div className="space-y-2">
                <Label htmlFor="manual-date">Date</Label>
                <Input id="manual-date" type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-search">Search Students</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="manual-search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by student name or ID"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={() => void loadManualAttendance()} disabled={loading}>
                  <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
                  Refresh
                </Button>
              </div>
            </div>

            {isNotToday && (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription>
                  Only today's date is allowed for marking attendance. You can view past data but not mark.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {mode === 'subject' ? (
                <>
                  <SummaryCard title="Students" value={computedCounts.total} description="Active verified students" tone="border-slate-200 bg-white" icon={Users} />
                  <SummaryCard title="Present in Class" value={computedCounts.presentInClass} description="Eligible for PRESENT" tone="border-emerald-200 bg-emerald-50" icon={UserCheck} />
                  <SummaryCard title="No Class Mark" value={computedCounts.notMarkedInClass} description="Eligible for ABSENT" tone="border-amber-200 bg-amber-50" icon={UserMinus} />
                  <SummaryCard title="Already in Subject" value={computedCounts.alreadyMarkedInSubject} description="Skipped automatically" tone="border-sky-200 bg-sky-50" icon={ClipboardCheck} />
                </>
              ) : (
                <>
                  <SummaryCard title="Students" value={computedCounts.total} description="Active verified students" tone="border-slate-200 bg-white" icon={Users} />
                  <SummaryCard title="Present at Institute" value={computedCounts.presentInInstitute} description="Eligible for PRESENT" tone="border-emerald-200 bg-emerald-50" icon={UserCheck} />
                  <SummaryCard title="No Institute Mark" value={computedCounts.notMarkedInInstitute} description="Eligible for ABSENT" tone="border-amber-200 bg-amber-50" icon={UserMinus} />
                  <SummaryCard title="Already in Class" value={computedCounts.alreadyMarkedInClass} description="Skipped automatically" tone="border-sky-200 bg-sky-50" icon={ClipboardCheck} />
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/70 bg-white/90 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Student Preview</CardTitle>
                  <CardDescription>
                    {mode === 'subject'
                      ? 'Class attendance, subject attendance, and the upcoming bulk-mark result side by side.'
                      : 'Institute attendance, class attendance, and the upcoming bulk-mark result side by side.'}
                  </CardDescription>
                </div>
              </div>
              <Tabs value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)} className="mt-3 w-full">
                <TabsList className="w-full h-auto grid gap-0 bg-slate-100/80 p-1 rounded-xl" style={{ gridTemplateColumns: `repeat(${FILTER_ORDER.length}, 1fr)` }}>
                  {FILTER_ORDER.map((value) => {
                    return (
                      <TabsTrigger
                        key={value}
                        value={value}
                        className="rounded-lg px-2 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
                      >
                        {getFilterLabel(value, mode)}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-sky-100 bg-sky-50/70 px-3 py-2">
                <Badge variant="outline" className="border-sky-300 text-sky-700">
                  Showing {filteredStudents.length} / {totalStudentsInMode}
                </Badge>
                <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700">Present: {previewSummary.markPresent}</Badge>
                <Badge className="border-amber-200 bg-amber-100 text-amber-700">Absent: {previewSummary.markAbsent}</Badge>
                <Badge className="border-slate-200 bg-slate-100 text-slate-700">Skipped: {previewSummary.skipped}</Badge>
                {previewSummary.overrides > 0 && (
                  <Badge className="border-violet-200 bg-violet-100 text-violet-700">Overrides: {previewSummary.overrides}</Badge>
                )}
                {previewSummary.statusChanged > 0 && (
                  <Badge className="border-violet-200 bg-violet-100 text-violet-700">Status Changed: {previewSummary.statusChanged}</Badge>
                )}
              </div>
              {loadError && (
                <Alert variant="destructive" className="mb-3 sm:mb-4 rounded-lg">
                  <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="text-sm">{loadError}</span>
                    <Button size="sm" variant="outline" onClick={() => void loadManualAttendance()} className="w-full sm:w-auto">Retry</Button>
                  </AlertDescription>
                </Alert>
              )}
              <div className="hidden md:block">
                <Paper sx={{ width: '100%', overflow: 'hidden' }}>
                  <MuiTableContainer sx={{ maxHeight: 'calc(100vh - 420px)', overflow: 'auto' }}>
                    <MuiTable stickyHeader aria-label="students table" sx={{ minWidth: 900 }}>
                      <MuiTableHead>
                        <MuiTableRow>
                          <MuiTableCell sx={{ fontWeight: 600, width: 260 }}>Student</MuiTableCell>
                          <MuiTableCell sx={{ fontWeight: 600 }}>{mode === 'subject' ? 'Class Attendance' : 'Institute Attendance'}</MuiTableCell>
                          <MuiTableCell sx={{ fontWeight: 600 }}>{mode === 'subject' ? 'Subject Attendance' : 'Class Attendance'}</MuiTableCell>
                          <MuiTableCell sx={{ fontWeight: 600 }}>Preview</MuiTableCell>
                          <MuiTableCell sx={{ fontWeight: 600, width: 160 }}>Override</MuiTableCell>
                        </MuiTableRow>
                      </MuiTableHead>
                      <MuiTableBody>
                        {loading ? (
                          Array.from({ length: 5 }).map((_, index) => (
                            <MuiTableRow key={`loading-${index}`}>
                              <MuiTableCell><Skeleton className="h-10 w-full" /></MuiTableCell>
                              <MuiTableCell><Skeleton className="h-10 w-full" /></MuiTableCell>
                              <MuiTableCell><Skeleton className="h-10 w-full" /></MuiTableCell>
                              <MuiTableCell><Skeleton className="h-10 w-full" /></MuiTableCell>
                              <MuiTableCell><Skeleton className="h-10 w-full" /></MuiTableCell>
                            </MuiTableRow>
                          ))
                        ) : filteredStudents.length > 0 ? (
                          filteredStudents.map((student) => {
                            const sourceBadge = mode === 'subject'
                              ? getClassSourceBadge((student as StudentClassStatusRecord).classAttendance)
                              : getInstituteBadge((student as StudentInstituteStatusRecord).instituteAttendance);
                            const targetBadge = mode === 'subject'
                              ? getSubjectTargetBadge(student as StudentClassStatusRecord)
                              : getClassBadge(student as StudentInstituteStatusRecord);
                            const studentOverride = overrides[student.studentId];
                            const previewBadge = mode === 'subject'
                              ? getSubjectPreviewBadge(student as StudentClassStatusRecord, markPresent, markAbsentForUnmarked, studentOverride)
                              : getPreviewBadge(student as StudentInstituteStatusRecord, markPresent, markAbsentForUnmarked, studentOverride);
                            const SourceIcon = sourceBadge.icon;
                            const isAlreadyMarked = mode === 'subject'
                              ? Boolean((student as StudentClassStatusRecord).subjectAttendance)
                              : Boolean((student as StudentInstituteStatusRecord).classAttendance);

                            return (
                              <MuiTableRow hover tabIndex={-1} key={student.studentId}>
                                <MuiTableCell>
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10 border border-border/60">
                                      <AvatarImage src={getImageUrl(student.studentImageUrl || '')} alt={student.studentName} />
                                      <AvatarFallback className="bg-sky-100 text-sky-800">{getInitials(student.studentName)}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-foreground">{student.studentName}</p>
                                      <p className="text-xs text-muted-foreground">ID: {student.studentId}</p>
                                    </div>
                                  </div>
                                </MuiTableCell>
                                <MuiTableCell>
                                  <div className="space-y-1">
                                    <Badge className={cn('border gap-1.5', sourceBadge.className)}>
                                      {SourceIcon && <SourceIcon className="h-3.5 w-3.5" />}
                                      {sourceBadge.label}
                                    </Badge>
                                    <p className="text-xs text-muted-foreground">{sourceBadge.detail}</p>
                                  </div>
                                </MuiTableCell>
                                <MuiTableCell>
                                  <div className="space-y-1">
                                    <Badge className={cn('border', targetBadge.className)}>{targetBadge.label}</Badge>
                                    <p className="text-xs text-muted-foreground">{targetBadge.detail}</p>
                                  </div>
                                </MuiTableCell>
                                <MuiTableCell>
                                  <div className="space-y-1">
                                    <Badge className={cn('border', previewBadge.className)}>{previewBadge.label}</Badge>
                                    <p className="text-xs text-muted-foreground">{previewBadge.detail}</p>
                                  </div>
                                </MuiTableCell>
                                <MuiTableCell>
                                  <Select
                                    value={overrides[student.studentId] || 'auto'}
                                    onValueChange={(value) =>
                                      handleStatusChange(student.studentId, value, isAlreadyMarked)
                                    }
                                    disabled={isNotToday}
                                  >
                                    <SelectTrigger className="h-8 w-full text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {OVERRIDE_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                          {opt.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </MuiTableCell>
                              </MuiTableRow>
                            );
                          })
                        ) : (
                          <MuiTableRow>
                            <MuiTableCell colSpan={5} sx={{ textAlign: 'center', py: 5, color: 'text.secondary', fontSize: '0.875rem' }}>
                              No students matched this filter. Try switching to All or clearing the search.
                            </MuiTableCell>
                          </MuiTableRow>
                        )}
                      </MuiTableBody>
                    </MuiTable>
                  </MuiTableContainer>
                </Paper>
              </div>

              <div className="grid gap-3 md:hidden">
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <Card key={`mobile-loading-${index}`} className="border-border/70 shadow-none">
                      <CardContent className="space-y-3 p-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                      </CardContent>
                    </Card>
                  ))
                ) : filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => {
                    const sourceBadge = mode === 'subject'
                      ? getClassSourceBadge((student as StudentClassStatusRecord).classAttendance)
                      : getInstituteBadge((student as StudentInstituteStatusRecord).instituteAttendance);
                    const targetBadge = mode === 'subject'
                      ? getSubjectTargetBadge(student as StudentClassStatusRecord)
                      : getClassBadge(student as StudentInstituteStatusRecord);
                    const mobileOverride = overrides[student.studentId];
                    const previewBadge = mode === 'subject'
                      ? getSubjectPreviewBadge(student as StudentClassStatusRecord, markPresent, markAbsentForUnmarked, mobileOverride)
                      : getPreviewBadge(student as StudentInstituteStatusRecord, markPresent, markAbsentForUnmarked, mobileOverride);

                    const isAlreadyMarkedMobile = mode === 'subject'
                      ? Boolean((student as StudentClassStatusRecord).subjectAttendance)
                      : Boolean((student as StudentInstituteStatusRecord).classAttendance);

                    return (
                      <Card key={student.studentId} className="border-border/70 shadow-none">
                        <CardContent className="space-y-4 p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-11 w-11 border border-border/60">
                              <AvatarImage src={getImageUrl(student.studentImageUrl || '')} alt={student.studentName} />
                              <AvatarFallback className="bg-sky-100 text-sky-800">{getInitials(student.studentName)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">{student.studentName}</p>
                              <p className="text-xs text-muted-foreground">ID: {student.studentId}</p>
                            </div>
                          </div>
                          <StatusPanel
                            title={mode === 'subject' ? 'Class' : 'Institute'}
                            badgeClass={sourceBadge.className}
                            label={sourceBadge.label}
                            detail={sourceBadge.detail}
                          />
                          <StatusPanel
                            title={mode === 'subject' ? 'Subject' : 'Class'}
                            badgeClass={targetBadge.className}
                            label={targetBadge.label}
                            detail={targetBadge.detail}
                          />
                          <StatusPanel title="Preview" badgeClass={previewBadge.className} label={previewBadge.label} detail={previewBadge.detail} />
                          <div className="space-y-2 rounded-2xl border border-border/70 bg-slate-50/60 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Override</p>
                            <Select
                                value={overrides[student.studentId] || 'auto'}
                                onValueChange={(value) =>
                                  handleStatusChange(student.studentId, value, isAlreadyMarkedMobile)
                                }
                                disabled={isNotToday}
                              >
                                <SelectTrigger className="h-8 w-full text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {OVERRIDE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <Card className="border-border/70 shadow-none">
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                      No students matched this filter. Try All or clear the search.
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-white/90 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Bulk Mark Controls</CardTitle>
              <CardDescription className="text-xs">
                {mode === 'subject'
                  ? 'Choose what should happen when subject attendance is derived from class attendance.'
                  : 'Choose what should be created when class attendance is derived from institute attendance.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <RuleRow
                title={mode === 'subject' ? 'Mark present from class' : 'Mark present from institute'}
                description={
                  mode === 'subject'
                    ? 'Students with class attendance other than absent become PRESENT in subject.'
                    : 'Students with institute attendance other than absent become PRESENT in class.'
                }
                checked={markPresent}
                onCheckedChange={setMarkPresent}
              />
              <RuleRow
                title="Mark absent for unmarked"
                description={
                  mode === 'subject'
                    ? 'Students with no class attendance become ABSENT in subject.'
                    : 'Students with no institute attendance become ABSENT in class.'
                }
                checked={markAbsentForUnmarked}
                onCheckedChange={setMarkAbsentForUnmarked}
              />

              <Separator />

              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <PreviewStat title="Will mark present" value={previewSummary.markPresent} tone="border-emerald-200 bg-emerald-50" />
                <PreviewStat title="Will mark absent" value={previewSummary.markAbsent} tone="border-amber-200 bg-amber-50" />
                <PreviewStat title="Skipped" value={previewSummary.skipped} tone="border-sky-200 bg-sky-50" />
                <PreviewStat title="No action" value={previewSummary.noAction} tone="border-slate-200 bg-slate-50" />
              </div>

              <Button
                className="h-9 w-full bg-sky-600 text-sm text-white hover:bg-sky-700"
                disabled={bulkLoading || loading || isNotToday || (!markPresent && !markAbsentForUnmarked && previewSummary.overrides === 0)}
                onClick={handleBulkMark}
              >
                {bulkLoading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="mr-2 h-3.5 w-3.5" />}
                {mode === 'subject' ? 'Bulk Mark From Class' : 'Bulk Mark From Institute'}
              </Button>

              {lastMessage && (
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                  <AlertDescription>{lastMessage}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </>)}
    </div>
  );
};

const SummaryCard = ({
  title,
  value,
  description,
  tone,
  icon: Icon,
}: {
  title: string;
  value: number;
  description: string;
  tone: string;
  icon: React.ComponentType<{ className?: string }>;
}) => (
  <Card className={cn('border shadow-none', tone)}>
    <CardContent className="flex items-start justify-between p-5">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="mt-3 text-3xl font-bold tracking-tight text-foreground">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-2xl bg-background/70 p-3">
        <Icon className="h-5 w-5" />
      </div>
    </CardContent>
  </Card>
);

const RuleRow = ({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => (
  <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-slate-50/80 p-3">
    <div>
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{description}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} />
  </div>
);

const PreviewStat = ({ title, value, tone }: { title: string; value: number; tone: string }) => (
  <div className={cn('rounded-xl border px-3 py-2', tone)}>
    <p className="text-[11px] font-medium leading-4 text-muted-foreground">{title}</p>
    <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
  </div>
);

const StatusPanel = ({
  title,
  badgeClass,
  label,
  detail,
}: {
  title: string;
  badgeClass: string;
  label: string;
  detail: string;
}) => (
  <div className="space-y-2 rounded-2xl border border-border/70 bg-slate-50/60 p-3">
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
    <Badge className={cn('border', badgeClass)}>{label}</Badge>
    <p className="text-xs text-muted-foreground">{detail}</p>
  </div>
);

export default ManualClassAttendance;