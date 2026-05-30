import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getAuthHeadersSync } from '@/services/tokenStorageService';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, RefreshCw, Users, Search, Filter, UserPlus, ChevronRight, ChevronDown, User, Eye, Phone, MapPin, Briefcase, Mail, Home, LayoutGrid, Table2, Gift, CreditCard, BadgePercent, CircleDollarSign, Pencil, X, Save, PlusCircle, FileText, Loader2, Calendar } from 'lucide-react';
import { generateStudentClassReport } from '@/utils/studentClassReport';
import { fetchInstituteReportBranding } from '@/utils/instituteReportBranding';
import ReportDialog, { type ReportDialogResult } from '@/components/ReportDialog';
import { apiClient } from '@/api/client';
import JSZip from 'jszip';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import MUITable from '@/components/ui/mui-table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AssignUsersDialog from '@/components/forms/AssignUsersDialog';
import AssignSubjectStudentsDialog from '@/components/forms/AssignSubjectStudentsDialog';
import EnrollByPaymentDialog from '@/components/forms/EnrollByPaymentDialog';
import { cachedApiClient } from '@/api/cachedClient';
import { useApiRequest } from '@/hooks/useApiRequest';
import { useTableData } from '@/hooks/useTableData';
import { getBaseUrl } from '@/contexts/utils/auth.api';
import { getImageUrl } from '@/utils/imageUrlHelper';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { enrollmentApi, type ClassEnrollmentSummaryItem } from '@/api/enrollment.api';
import { CACHE_TTL } from '@/config/cacheTTL';
import { instituteApi } from '@/api/institute.api';
import { useNavigate } from 'react-router-dom';
import { buildStudentProfileUrl } from '@/utils/pageNavigation';
import { getErrorMessage } from '@/api/apiError';
import { useViewMode } from '@/hooks/useViewMode';
import { EmptyState } from '@/components/ui/EmptyState';
import ScrollAnimationWrapper from '@/components/ScrollAnimationWrapper';
import { useColumnConfig, type ColumnDef } from '@/hooks/useColumnConfig';
import ColumnConfigurator from '@/components/ui/column-configurator';
import { useInstituteUserColumns } from '@/hooks/useInstituteUserColumns';
import { useModalRouting } from '@/utils/modalRouting';

interface InstituteStudent {
  id: string;
  name: string;
  nameWithInitials?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  phoneNumber?: string;
  imageUrl?: string;
  dateOfBirth?: string;
  userIdByInstitute?: string | null;
  fatherId?: string | null;
  motherId?: string | null;
  guardianId?: string | null;
  studentId?: string;
  emergencyContact?: string;
  medicalConditions?: string;
  allergies?: string;
  studentType?: 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid';
  extraData?: Record<string, any> | null;
  father?: {
    id: string;
    name: string;
    email?: string;
    occupation?: string;
    workPlace?: string;
    children?: any[];
  };
}

interface InstituteStudentsResponse {
  data: InstituteStudent[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface Student {
  userId: string;
  fatherId: string | null;
  motherId: string | null;
  guardianId: string | null;
  studentId: string;
  emergencyContact: string;
  medicalConditions?: string;
  allergies?: string;
  bloodGroup?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    userType: string;
    dateOfBirth: string;
    gender: string;
    imageUrl?: string;
    isActive: boolean;
    subscriptionPlan: string;
    createdAt: string;
  };
}

interface StudentsResponse {
  data: Student[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
    previousPage: number | null;
    nextPage: number | null;
  };
}

const Students = () => {
  const { toast } = useToast();
  const { user, selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const userRole = useInstituteRole();
  const effectiveRole = useInstituteRole();
  const { columns: extraColumns } = useInstituteUserColumns(selectedInstitute?.id || '');
  const navigate = useNavigate();
  const { openModal } = useModalRouting();

  // State for both types of student data
  const [students, setStudents] = useState<Student[]>([]);
  const [instituteStudents, setInstituteStudents] = useState<InstituteStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showSubjectAssignDialog, setShowSubjectAssignDialog] = useState(false);
  const [showEnrollByPaymentDialog, setShowEnrollByPaymentDialog] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Enrollment type state
  const [studentTypeMap, setStudentTypeMap] = useState<Record<string, 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid'>>({});
  const [classSummary, setClassSummary] = useState<ClassEnrollmentSummaryItem[]>([]);
  const [updatingTypeFor, setUpdatingTypeFor] = useState<string | null>(null);
  // Give Free Card / Update Type dialog
  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [typeDialogSearch, setTypeDialogSearch] = useState('');
  const [typeDialogSearchCommitted, setTypeDialogSearchCommitted] = useState('');
  const [typeDialogStudentId, setTypeDialogStudentId] = useState('');
  const [typeDialogType, setTypeDialogType] = useState<'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid'>('free_card');
  const [typeDialogLoading, setTypeDialogLoading] = useState(false);
  const [studentTypeFilter, setStudentTypeFilter] = useState<'all' | 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid'>('all');

  // Batch report state
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [showBatchReportDialog, setShowBatchReportDialog] = useState(false);
  // Date ranges and section options are now managed by ReportDialog — no local state needed

  const [generatingBatchReport, setGeneratingBatchReport] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  // Use ref to track if we're currently fetching to prevent duplicate calls
  const isFetchingRef = useRef(false);

  // Track current context to prevent unnecessary reloads
  // Build contextKey based on selection level to match cache context
  const contextKey = useMemo(() => {
    if (selectedSubject?.id && selectedClass?.id && selectedInstitute?.id) {
      // Subject level: institute + class + subject
      return `subject-${selectedInstitute.id}-${selectedClass.id}-${selectedSubject.id}`;
    } else if (selectedClass?.id && selectedInstitute?.id) {
      // Class level: institute + class only
      return `class-${selectedInstitute.id}-${selectedClass.id}`;
    } else if (selectedInstitute?.id) {
      // Institute level: institute only
      return `institute-${selectedInstitute.id}`;
    }
    return 'global'; // Global students (non-institute users)
  }, [selectedInstitute?.id, selectedClass?.id, selectedSubject?.id]);

  const [lastLoadedContext, setLastLoadedContext] = useState<string>('');

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [includeParentInfo, setIncludeParentInfo] = useState(true);
  const [parentDetailsDialog, setParentDetailsDialog] = useState<{ open: boolean; parent: any }>({
    open: false,
    parent: null
  });
  const [imagePreview, setImagePreview] = useState<{ isOpen: boolean; url: string; title: string }>({
    isOpen: false,
    url: '',
    title: ''
  });
  const { viewMode } = useViewMode();
  const [pageViewMode, setPageViewMode] = useState<'card' | 'table'>(viewMode);
  const [showAllStudentCards, setShowAllStudentCards] = useState(false);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [editExtraDataDialog, setEditExtraDataDialog] = useState<{ open: boolean; student: InstituteStudent | null }>({ open: false, student: null });
  const [extraDataRows, setExtraDataRows] = useState<{ key: string; value: string }[]>([]);
  const [savingExtraData, setSavingExtraData] = useState(false);
  const {
    state: { data: paginatedStudents, loading: tableLoading },
    pagination,
    actions,
    filters
  } = useTableData<Student>({
    endpoint: '/students',
    defaultParams: {},
    dependencies: [],
    pagination: {
      defaultLimit: 50,
      availableLimits: [25, 50, 100]
    },
    autoLoad: false // Disable auto-loading - only load on explicit refresh
  });

  // Check if user should use new institute-based API (memoized to prevent re-renders)
  const shouldUseInstituteApi = useMemo(() => {
    return ['InstituteAdmin', 'Teacher'].includes(userRole) && !!selectedInstitute;
  }, [userRole, selectedInstitute]);

  const getApiHeaders = () => getAuthHeadersSync();

  // Use API request hook for fetching students (original API)
  const fetchStudentsRequest = useApiRequest(
    async (page: number) => {
      console.log(`Fetching students with params: page=${page}&limit=${pagination.limit}`);
      const response = await cachedApiClient.get<StudentsResponse>(
        '/students',
        { page: page.toString(), limit: pagination.limit.toString() },
        { ttl: 15, useStaleWhileRevalidate: true }
      );
      return response;
    },
    { preventDuplicates: true }
  );

  // Original fetch function for Student users
  const fetchStudents = async (page = 1) => {
    try {
      const data = await fetchStudentsRequest.execute(page);
      console.log('Students data received:', data);

      setStudents(data.data);
      // Note: pagination is managed by the hook automatically
      setDataLoaded(true);

      toast({
        title: "Students Loaded",
        description: `Successfully loaded ${data.data.length} students.`
      });
    } catch (error: any) {
      console.error('Error fetching students:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error, 'Failed to load students'),
        variant: "destructive"
      });
    }
  };

  // New fetch function for institute-based students (class only)
  const fetchInstituteClassStudents = async (forceRefresh = false) => {
    if (!selectedInstitute?.id || !selectedClass?.id) return;

    console.log('[Students] Fetching CLASS students:', {
      forceRefresh,
      instituteId: selectedInstitute.id,
      classId: selectedClass.id,
      contextKey
    });

    // Only show loading spinner when force refreshing (user clicked button)
    if (forceRefresh) {
      setLoading(true);
    }

    try {
      const queryParams: Record<string, string> = {
        parent: String(includeParentInfo)
      };

      const data: InstituteStudentsResponse = await enhancedCachedClient.get(
        `/institute-users/institute/${selectedInstitute.id}/users/STUDENT/class/${selectedClass.id}`,
        queryParams,
        {
          ttl: CACHE_TTL.STUDENTS,
          forceRefresh,
          userId: user?.id,
          role: userRole,
          instituteId: selectedInstitute.id,
          classId: selectedClass.id
        }
      );

      // Deduplicate by student ID to prevent duplicate React keys
      const uniqueStudents = Array.from(new Map(data.data.map(s => [s.id, s])).values());
      setInstituteStudents(uniqueStudents);
      setDataLoaded(true);

      // Build type map directly from the student data (API now returns studentType)
      const typeMap: Record<string, 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid'> = {};
      uniqueStudents.forEach(s => {
        typeMap[s.id] = s.studentType ?? 'normal';
      });
      setStudentTypeMap(typeMap);
      setClassSummary([]);

      // Only show toast when force refreshing
      if (forceRefresh) {
        toast({
          title: "Class Students Loaded",
          description: `Successfully loaded ${data.data.length} students.`
        });
      }
    } catch (error: any) {
      console.error('Error fetching class students:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error, 'Failed to load class students'),
        variant: "destructive"
      });
    } finally {
      if (forceRefresh) {
        setLoading(false);
      }
    }
  };

  // New fetch function for institute-based students (class + subject)
  const fetchInstituteSubjectStudents = async (forceRefresh = false) => {
    if (!selectedInstitute?.id || !selectedClass?.id || !selectedSubject?.id) return;

    console.log('[Students] Fetching SUBJECT students:', {
      forceRefresh,
      instituteId: selectedInstitute.id,
      classId: selectedClass.id,
      subjectId: selectedSubject.id,
      contextKey
    });

    // Only show loading spinner when force refreshing (user clicked button)
    if (forceRefresh) {
      setLoading(true);
    }

    try {
      const queryParams: Record<string, string> = {
        parent: String(includeParentInfo)
      };

      const data: InstituteStudentsResponse = await enhancedCachedClient.get(
        `/institute-users/institute/${selectedInstitute.id}/users/STUDENT/class/${selectedClass.id}/subject/${selectedSubject.id}`,
        queryParams,
        {
          ttl: CACHE_TTL.STUDENTS,
          forceRefresh,
          userId: user?.id,
          role: userRole,
          instituteId: selectedInstitute.id,
          classId: selectedClass.id,
          subjectId: selectedSubject.id
        }
      );

      // Deduplicate by student ID to prevent duplicate React keys
      const uniqueSubjectStudents = Array.from(new Map(data.data.map(s => [s.id, s])).values());
      setInstituteStudents(uniqueSubjectStudents);
      setDataLoaded(true);

      // Build type map directly from the student data (API now returns studentType from subject enrollment)
      const typeMap: Record<string, 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid'> = {};
      uniqueSubjectStudents.forEach(s => {
        typeMap[s.id] = s.studentType ?? 'normal';
      });
      setStudentTypeMap(typeMap);
      setClassSummary([]);

      // Only show toast when force refreshing
      if (forceRefresh) {
        toast({
          title: "Subject Students Loaded",
          description: `Successfully loaded ${data.data.length} students.`
        });
      }
    } catch (error: any) {
      console.error('Error fetching subject students:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error, 'Failed to load subject students'),
        variant: "destructive"
      });
    } finally {
      if (forceRefresh) {
        setLoading(false);
      }
    }
  };

  // Auto-load data when context changes (uses cache if available)
  useEffect(() => {
    console.log('[Students] useEffect triggered:', {
      shouldUseInstituteApi,
      contextKey,
      lastLoadedContext,
      needsLoad: contextKey !== lastLoadedContext,
      isFetching: isFetchingRef.current,
      selectedInstitute: selectedInstitute?.id,
      selectedClass: selectedClass?.id,
      selectedSubject: selectedSubject?.id
    });

    // Prevent duplicate calls if already fetching or context hasn't changed
    if (isFetchingRef.current || !shouldUseInstituteApi || contextKey === lastLoadedContext) {
      return;
    }

    setLastLoadedContext(contextKey);
    isFetchingRef.current = true;

    const loadData = async () => {
      try {
        if (selectedSubject && selectedClass && selectedInstitute) {
          // Load subject students automatically from cache (no loading indicator)
          console.log('[Students] Auto-loading SUBJECT students from cache...');
          await fetchInstituteSubjectStudents(false);
        } else if (selectedClass && selectedInstitute) {
          // Load class students automatically from cache (no loading indicator)
          console.log('[Students] Auto-loading CLASS students from cache...');
          await fetchInstituteClassStudents(false);
        }
      } finally {
        isFetchingRef.current = false;
      }
    };

    loadData();
  }, [contextKey, shouldUseInstituteApi]);

  // Refetch when parent filter changes
  useEffect(() => {
    if (!shouldUseInstituteApi || !selectedClass || !dataLoaded) return;

    // Trigger refresh with the new filter
    if (selectedSubject) {
      fetchInstituteSubjectStudents(true);
    } else {
      fetchInstituteClassStudents(true);
    }
  }, [includeParentInfo]);

  // Determine which fetch function to use (for refresh button - forces backend call)
  const getLoadFunction = () => {
    if (!shouldUseInstituteApi) {
      // Use the table data loading function for global students
      return () => actions.loadData(true); // Force refresh
    }

    if (selectedSubject) {
      return () => fetchInstituteSubjectStudents(true); // Force refresh
    } else if (selectedClass) {
      return () => fetchInstituteClassStudents(true); // Force refresh
    }

    // Fallback to table data loading
    return () => actions.loadData(true);
  };

  const getLoadButtonText = () => {
    if (!shouldUseInstituteApi) {
      return tableLoading || loading ? 'Loading Students...' : 'Load Students';
    }

    if (selectedSubject) {
      return loading ? 'Loading Subject Students...' : 'Load Subject Students';
    } else if (selectedClass) {
      return loading ? 'Loading Class Students...' : 'Load Class Students';
    }

    return tableLoading || loading ? 'Loading Students...' : 'Load Students';
  };

  const getCurrentSelection = () => {
    if (!shouldUseInstituteApi) return '';

    const parts = [];
    if (selectedInstitute) parts.push(`Institute: ${selectedInstitute.name}`);
    if (selectedClass) parts.push(`Class: ${selectedClass.name}`);
    if (selectedSubject) parts.push(`Subject: ${selectedSubject.name}`);
    return parts.join(' → ');
  };

  const canManageType = ['InstituteAdmin', 'Teacher'].includes(userRole || '');

  const handleStudentTypeChange = async (studentId: string, newType: 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid') => {
    if (!selectedInstitute?.id || !selectedClass?.id || !selectedSubject?.id) return;
    setUpdatingTypeFor(studentId);
    try {
      await enrollmentApi.updateStudentType(
        selectedInstitute.id, selectedClass.id, selectedSubject.id, studentId, newType,
        { userId: user?.id, role: userRole }
      );
      setStudentTypeMap(prev => ({ ...prev, [studentId]: newType }));
      toast({ title: 'Student Type Updated', description: `Changed to ${newType === 'free_card' ? 'Free Card' : newType === 'half_paid' ? 'Half Paid' : newType === 'quarter_paid' ? 'Quarter Paid' : newType.charAt(0).toUpperCase() + newType.slice(1)}` });
    } catch (e: any) {
      toast({ title: 'Update Failed', description: getErrorMessage(e, 'Failed to update student type'), variant: 'destructive' });
    } finally {
      setUpdatingTypeFor(null);
    }
  };

  const dialogFilteredStudents = useMemo(() => {
    const source = instituteStudents.length > 0 ? instituteStudents : classSummary.map(s => ({
      id: s.studentId, name: s.name, email: s.email, imageUrl: s.imageUrl
    } as InstituteStudent));
    if (!typeDialogSearchCommitted.trim()) return [];
    const q = typeDialogSearchCommitted.toLowerCase();
    return source
      .filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        s.id.includes(q)
      )
      .slice(0, 20);
  }, [instituteStudents, classSummary, typeDialogSearchCommitted]);

  const handleClassTypeDialogSubmit = async () => {
    if (!selectedInstitute?.id || !selectedClass?.id || !typeDialogStudentId.trim()) return;
    setTypeDialogLoading(true);
    try {
      await enrollmentApi.updateClassEnrollmentStudentType(
        selectedInstitute.id, selectedClass.id, typeDialogStudentId.trim(), typeDialogType,
        { userId: user?.id, role: userRole }
      );
      setStudentTypeMap(prev => ({ ...prev, [typeDialogStudentId.trim()]: typeDialogType }));
      setInstituteStudents(prev => prev.map(s =>
        s.id === typeDialogStudentId.trim() ? { ...s, studentType: typeDialogType } : s
      ));
      toast({ title: 'Student Type Updated', description: `Set to ${typeDialogType === 'free_card' ? 'Free Card' : typeDialogType === 'half_paid' ? 'Half Paid' : typeDialogType === 'quarter_paid' ? 'Quarter Paid' : typeDialogType.charAt(0).toUpperCase() + typeDialogType.slice(1)} for all subjects` });
      setShowTypeDialog(false);
    } catch (e: any) {
      toast({ title: 'Update Failed', description: getErrorMessage(e, 'Failed to update student type'), variant: 'destructive' });
    } finally {
      setTypeDialogLoading(false);
    }
  };

  // --- Batch Report Handlers ---
  const toggleStudentSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedStudentIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // --- Extra Data Edit Handlers ---
  const handleOpenEditExtraData = (student: InstituteStudent) => {
    const rows = student.extraData && Object.keys(student.extraData).length > 0
      ? Object.entries(student.extraData).map(([key, value]) => ({ key, value: String(value) }))
      : [{ key: '', value: '' }];
    setExtraDataRows(rows);
    setEditExtraDataDialog({ open: true, student });
  };

  const handleSaveExtraData = async () => {
    if (!selectedInstitute?.id || !editExtraDataDialog.student) return;
    setSavingExtraData(true);
    try {
      const filtered = extraDataRows.filter(r => r.key.trim() !== '');
      const extraData = filtered.length > 0
        ? Object.fromEntries(filtered.map(r => [r.key.trim(), r.value]))
        : null;
      await instituteApi.updateInstituteUserExtraData(
        selectedInstitute.id,
        editExtraDataDialog.student.id,
        extraData,
      );
      // Update local state
      setInstituteStudents(prev => prev.map(s =>
        s.id === editExtraDataDialog.student!.id ? { ...s, extraData } : s
      ));
      toast({ title: 'Extra Data Updated', description: 'Custom data saved successfully.', variant: 'success' });
      setEditExtraDataDialog({ open: false, student: null });
    } catch (e: any) {
      toast({ title: 'Update Failed', description: getErrorMessage(e, 'Failed to update extra data'), variant: 'destructive' });
    } finally {
      setSavingExtraData(false);
    }
  };

  // --- Batch report generation — called by ReportDialog.onGenerate ---
  const handleBatchReport = async ({ options, dateRanges, printOptions }: ReportDialogResult) => {
    if (!selectedInstitute?.id || !selectedClass?.id || selectedStudentIds.size === 0) return;
    setGeneratingBatchReport(true);
    setShowBatchReportDialog(false);

    const studentIdList = Array.from(selectedStudentIds);
    setBatchProgress({ current: 0, total: studentIdList.length });

    const zip = new JSZip();
    let hasAddedFiles = false;

    try {
      // Fetch institute branding once — module-level cached across the batch
      const branding = await fetchInstituteReportBranding(selectedInstitute.id);

      // One round-trip for all students with separate date ranges per section
      const res: any = await apiClient.post(
        `/api/attendance/institute/${selectedInstitute.id}/class-report`,
        {
          classId: selectedClass.id,
          studentIds: studentIdList,
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

      const rows: any[] = res?.students ?? [];

      for (let i = 0; i < rows.length; i++) {
        setBatchProgress({ current: i + 1, total: rows.length });
        const row = rows[i];
        if (!row?.student) continue;

        const s = row.student;
        const attendance: any[] = row.attendance ?? [];
        const payments: any[] = row.payments ?? [];
        const lectures: any[] = row.lectures ?? [];

        const physical = attendance.filter((r: any) => !r.markingMethod?.includes('LIVE') && !r.markingMethod?.includes('RECORDING'));

        const liveAtt = lectures.filter((l: any) => l.liveEnabled).map((l: any) => ({
          title: l.title, date: l.startTime, subjectName: l.subjectName,
          totalDurationMinutes: Math.round((l.liveAttendance?.totalSeconds ?? 0) / 60),
          sessions: (l.liveAttendance?.sessions ?? []).map((ss: any) => ({
            joinTime: ss.joinTime, leaveTime: ss.leaveTime,
            durationMinutes: ss.leaveTime && ss.joinTime ? Math.round((new Date(ss.leaveTime).getTime() - new Date(ss.joinTime).getTime()) / 60000) : 0,
          })),
        }));

        const recAtt = lectures.filter((l: any) => l.recEnabled).map((l: any) => ({
          title: l.title, date: l.startTime, subjectName: l.subjectName,
          totalWatchedSeconds: l.recordingActivity?.totalWatchedSeconds ?? 0,
          sessionCount: l.recordingActivity?.sessionCount ?? 0,
        }));

        try {
          // Programmatic PDF generation (returns Uint8Array)
          const pdfData = await generateStudentClassReport({
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
            instituteName: selectedInstitute.name,
            className: selectedClass.name,
            dateRange: { start: dateRanges.attendanceStart, end: dateRanges.attendanceEnd },
            physicalAttendance: physical.map((r: any) => ({ date: r.date, session: r.sessionName ?? '', group: r.groupName ?? '', sessionStart: r.sessionStart, sessionEnd: r.sessionEnd, checkIn: r.markedAt, status: r.status })),
            liveAttendance: liveAtt,
            recordingAttendance: recAtt,
            payments: payments.map((p: any) => ({ title: p.title ?? '', amount: Number(p.amount ?? 0), status: p.status ?? '', submissionStatus: p.submissionStatus ?? null })),
          }, options, { ...branding, ...printOptions, returnUint8Array: true });

          if (pdfData instanceof Uint8Array) {
            const fileName = `${(s.nameWithInitials ?? s.name).replace(/[^a-z0-9]/gi, '_').toLowerCase()}_report.pdf`;
            zip.file(fileName, pdfData);
            hasAddedFiles = true;
          }
        } catch (err) {
          console.error(`PDF failed for ${row.id}:`, err);
        }
      }

      if (hasAddedFiles) {
        toast({ title: 'Generating ZIP...', description: 'Compiling all reports into a single archive.' });
        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `Reports_${selectedClass.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.zip`;
        link.click();
        URL.revokeObjectURL(link.href);
        toast({ title: 'Batch Export Complete', description: `Successfully archived ${studentIdList.length} reports.` });
      } else {
        toast({ title: 'Export Failed', description: 'No reports were generated successfully.', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Batch report API failed:', err);
      toast({ title: 'Batch Failed', description: 'A network error occurred during batch processing.', variant: 'destructive' });
    }
    setGeneratingBatchReport(false);
  };

  const getCurrentStudentData = () => {
    if (!shouldUseInstituteApi) {
      // Use table data for global students
      return paginatedStudents;
    }
    // Use institute students for institute-based views
    return instituteStudents;
  };

  const filteredStudents = useMemo(() => {
    return getCurrentStudentData().filter((student: Student | InstituteStudent) => {
      // Handle different data structures for search
      let name, email, studentId;

      if ('user' in student) {
        // Original Student structure
        name = `${student.user.firstName} ${student.user.lastName}`;
        email = student.user.email;
        studentId = student.studentId;
      } else {
        // InstituteStudent structure
        name = student.name;
        email = student.email || '';
        studentId = student.userIdByInstitute || student.id;
      }

      const matchesSearch = !searchTerm ||
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        studentId.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter only applies to original Student structure
      const matchesStatus = statusFilter === 'all' ||
        ('user' in student && statusFilter === 'active' && student.isActive) ||
        ('user' in student && statusFilter === 'inactive' && !student.isActive) ||
        !('user' in student); // Institute students don't have status filter

      // Student type filter
      const sid = 'user' in student ? (student as any).userId : (student as InstituteStudent).id;
      const matchesType = studentTypeFilter === 'all' || (studentTypeMap[sid] || 'normal') === studentTypeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [paginatedStudents, instituteStudents, searchTerm, statusFilter, studentTypeFilter, studentTypeMap, shouldUseInstituteApi]);

  const selectAllFiltered = () => setSelectedStudentIds(new Set((filteredStudents as InstituteStudent[]).map(s => s.id)));
  const clearSelection = () => setSelectedStudentIds(new Set());

  // --- Configurable column definitions ---
  const allColumnDefs: ColumnDef[] = useMemo(() => {
    const baseCols: ColumnDef[] = [
      // Checkbox selection — only shown at class level for institute students
      ...(selectedInstitute && selectedClass && !selectedSubject ? [{
        key: 'select',
        header: (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={filteredStudents.length > 0 && selectedStudentIds.size === filteredStudents.length}
              onCheckedChange={(checked) => checked ? selectAllFiltered() : clearSelection()}
              className="h-4 w-4 rounded border-border accent-primary cursor-pointer bg-background"
            />
          </div>
        ),
        locked: true,
        defaultVisible: true,
        defaultWidth: 44,
        minWidth: 40,
        render: (_: any, row: Student | InstituteStudent) => {
          if ('user' in row) return null;
          const st = row as InstituteStudent;
          return (
            <div className="flex items-center justify-center">
              <Checkbox
                checked={selectedStudentIds.has(st.id)}
                onCheckedChange={(checked) => {
                  setSelectedStudentIds(prev => {
                    const n = new Set(prev);
                    checked ? n.add(st.id) : n.delete(st.id);
                    return n;
                  });
                }}
                className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
              />
            </div>
          );
        }
      }] as ColumnDef[] : []),
      {
        key: 'student',
        header: 'Student',
        locked: true,
        defaultVisible: true,
        defaultWidth: 220,
        minWidth: 160,
        render: (value: any, row: Student | InstituteStudent) => {
          const name = 'user' in row ? `${row.user.firstName} ${row.user.lastName}` : ((row as InstituteStudent).nameWithInitials || row.name);
          const imageUrl = 'user' in row ? row.user.imageUrl : (row as InstituteStudent).imageUrl;
          return (
            <div className="flex items-center space-x-3">
              <div className="cursor-pointer flex-shrink-0" onClick={() => { if (imageUrl) { setImagePreview({ isOpen: true, url: imageUrl, title: name }); } }}>
                <Avatar className="h-8 w-8 sm:h-10 sm:w-10 hover:opacity-80 transition-opacity">
                  <AvatarImage src={getImageUrl(imageUrl)} alt={name} />
                  <AvatarFallback className="text-xs">{name.split(' ').map(n => n.charAt(0)).join('')}</AvatarFallback>
                </Avatar>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{name}</p>
              </div>
            </div>
          );
        }
      },
      {
        key: 'studentId',
        header: 'Student ID',
        defaultVisible: true,
        defaultWidth: 130,
        minWidth: 90,
        render: (_: any, row: Student | InstituteStudent) => {
          const userIdByInstitute = 'user' in row ? 'N/A' : (row as InstituteStudent).userIdByInstitute || row.id;
          return <span className="text-sm">{userIdByInstitute}</span>;
        }
      },
      {
        key: 'uuid',
        header: 'UUID',
        defaultVisible: false,
        defaultWidth: 160,
        minWidth: 100,
        render: (_: any, row: Student | InstituteStudent) => {
          const uuid = 'user' in row ? row.userId : (row as InstituteStudent).id;
          return <span className="font-mono text-sm break-all select-all">{uuid || 'N/A'}</span>;
        }
      },
      {
        key: 'email',
        header: 'Email',
        defaultVisible: false,
        defaultWidth: 200,
        minWidth: 140,
        render: (_: any, row: Student | InstituteStudent) => {
          const email = 'user' in row ? row.user.email : (row as InstituteStudent).email;
          return <span className="text-sm truncate">{email || 'N/A'}</span>;
        }
      },
      {
        key: 'phone',
        header: 'Phone',
        defaultVisible: true,
        defaultWidth: 150,
        minWidth: 110,
        render: (_: any, row: Student | InstituteStudent) => {
          const phone = 'user' in row ? row.user.phoneNumber : (row as InstituteStudent).phoneNumber;
          return <span className="text-sm">{phone || 'N/A'}</span>;
        }
      },
      {
        key: 'address',
        header: 'Address',
        defaultVisible: false,
        defaultWidth: 200,
        minWidth: 120,
        render: (_: any, row: Student | InstituteStudent) => {
          if ('user' in row) return <span className="text-sm text-muted-foreground">N/A</span>;
          const student = row as InstituteStudent;
          return (
            <div className="space-y-1 text-sm">
              <p className="truncate">{student.addressLine1 || 'N/A'}</p>
              {student.addressLine2 && <p className="text-muted-foreground truncate">{student.addressLine2}</p>}
            </div>
          );
        }
      },
      {
        key: 'dateOfBirth',
        header: 'Date of Birth',
        defaultVisible: false,
        defaultWidth: 140,
        minWidth: 100,
        render: (_: any, row: Student | InstituteStudent) => {
          const dob = 'user' in row ? row.user.dateOfBirth : (row as InstituteStudent).dateOfBirth;
          return <div className="text-sm">{dob ? new Date(dob).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}</div>;
        }
      },
      {
        key: 'guardians',
        header: 'Parent/Guardian',
        defaultVisible: false,
        defaultWidth: 180,
        minWidth: 120,
        render: (_: any, row: Student | InstituteStudent) => {
          const student = row as InstituteStudent;
          if ('user' in row) {
            return (
              <div className="space-y-1">
                {row.fatherId && <Badge variant="outline" className="text-xs">Father: {row.fatherId}</Badge>}
                {row.motherId && <Badge variant="outline" className="text-xs">Mother: {row.motherId}</Badge>}
                {row.guardianId && <Badge variant="outline" className="text-xs">Guardian: {row.guardianId}</Badge>}
                {!row.fatherId && !row.motherId && !row.guardianId && <span className="text-sm text-muted-foreground">N/A</span>}
              </div>
            );
          }
          return (
            <div className="space-y-1">
              {student.fatherId && <Badge variant="outline" className="text-xs">Father</Badge>}
              {student.motherId && <Badge variant="outline" className="text-xs">Mother</Badge>}
              {student.guardianId && <Badge variant="outline" className="text-xs">Guardian</Badge>}
              {!student.fatherId && !student.motherId && !student.guardianId && <span className="text-sm text-muted-foreground">N/A</span>}
            </div>
          );
        }
      },
      {
        key: 'studentType',
        header: 'Type',
        defaultVisible: true,
        defaultWidth: 140,
        minWidth: 100,
        render: (_: any, row: Student | InstituteStudent) => {
          if ('user' in row) return <span className="text-xs text-muted-foreground">N/A</span>;
          const student = row as InstituteStudent;
          const studentId = student.id;
          const type = studentTypeMap[studentId] ?? student.studentType ?? 'normal';
          const typeColors: Record<string, string> = {
            free_card: 'bg-purple-100 text-purple-800 border-purple-300',
            paid: 'bg-green-100 text-green-800 border-green-300',
            half_paid: 'bg-amber-100 text-amber-800 border-amber-300',
            quarter_paid: 'bg-sky-100 text-sky-800 border-sky-300',
            normal: 'bg-gray-100 text-gray-700 border-gray-300',
          };

          // Subject-level: inline dropdown for canManageType
          if (selectedSubject && canManageType) {
            return (
              <div className="flex items-center gap-1">
                {updatingTypeFor === studentId ? (
                  <span className="text-xs text-muted-foreground">Updating...</span>
                ) : (
                  <select
                    value={type}
                    onChange={e => handleStudentTypeChange(studentId, e.target.value as 'normal' | 'paid' | 'free_card' | 'half_paid' | 'quarter_paid')}
                    className="text-xs border rounded px-1 py-0.5 bg-background"
                  >
                    <option value="normal">Normal</option>
                    <option value="paid">Paid</option>
                    <option value="free_card">Free Card</option>
                    <option value="half_paid">Half Paid</option>
                    <option value="quarter_paid">Quarter Paid</option>
                  </select>
                )}
              </div>
            );
          }

          // Class-level or read-only: plain badge
          return (
            <span className={`text-xs px-2 py-1 rounded border ${typeColors[type] || typeColors.normal}`}>
              {type === 'free_card' ? 'Free Card' : type === 'half_paid' ? 'Half Paid' : type === 'quarter_paid' ? 'Quarter Paid' : type.charAt(0).toUpperCase() + type.slice(1)}
            </span>
          );
        }
      },
      {
        key: 'extraData',
        header: 'Extra Data',
        defaultVisible: false,
        defaultWidth: 200,
        minWidth: 140,
        render: (_: any, row: Student | InstituteStudent) => {
          if ('user' in row) return <span className="text-xs text-muted-foreground">N/A</span>;
          const student = row as InstituteStudent;
          if (!student.extraData || Object.keys(student.extraData).length === 0) {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <div className="space-y-0.5">
              {Object.entries(student.extraData).slice(0, 3).map(([key, value]) => (
                <div key={key} className="text-xs">
                  <span className="font-medium text-muted-foreground">{key}:</span>{' '}
                  <span>{String(value)}</span>
                </div>
              ))}
              {Object.keys(student.extraData).length > 3 && (
                <span className="text-[10px] text-muted-foreground">+{Object.keys(student.extraData).length - 3} more</span>
              )}
            </div>
          );
        }
      },
      {
        key: 'actions',
        header: 'Actions',
        defaultVisible: true,
        defaultWidth: 120,
        minWidth: 80,
        render: (_: any, row: Student | InstituteStudent) => {
          if ('user' in row) {
            const globalStudent = row as Student;
            return (
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => openModal('student', { studentId: globalStudent.userId })}>
                  <Eye className="h-3 w-3" />
                </Button>
              </div>
            );
          }
          const student = row as InstituteStudent;
          return (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => {
                navigate(buildStudentProfileUrl(student.id, {
                  instituteId: selectedInstitute?.id as string,
                  classId: selectedClass?.id,
                  subjectId: selectedSubject?.id
                }), { state: { student } });
              }}>
                <Eye className="h-3 w-3" />
              </Button>
              {shouldUseInstituteApi && canManageType && (
                <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => handleOpenEditExtraData(student)} title="Edit Extra Data">
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          );
        }
      }
    ];

    // Add schema-driven extra data columns right before the "actions" column
    extraColumns.forEach(col => {
      baseCols.splice(baseCols.length - 1, 0, {
        key: `extra_${col.key}`,
        header: col.label,
        defaultVisible: false,
        minWidth: 120,
        render: (_: any, row: Student | InstituteStudent) => {
          if ('user' in row) return <span className="text-xs text-muted-foreground">N/A</span>;
          const val = (row as InstituteStudent).extraData?.[col.key];
          return <span className="text-sm">{val !== undefined && val !== null && val !== '' ? String(val) : '-'}</span>;
        }
      });
    });

    return baseCols;
  }, [studentTypeMap, selectedSubject, canManageType, updatingTypeFor, handleStudentTypeChange, shouldUseInstituteApi, extraColumns]);

  const { colState, visibleColumns: visColDefs, toggleColumn, resetColumns } = useColumnConfig(allColumnDefs, 'students');

  // Map FULL column list to MUITable format — MUITable manages visibility + ColumnConfigurator internally
  const muiColumns = useMemo(() =>
    allColumnDefs.map(col => ({
      id: col.key,
      label: col.header,
      minWidth: col.minWidth || 170,
      format: col.render,
    })),
    [allColumnDefs]
  );


  if (!user) {
    return (
      <EmptyState
        icon={Users}
        title="Not Logged In"
        description="Please log in to view students."
      />
    );
  }

  // Special handling for InstituteAdmin and Teacher users requiring selections
  // Only show "please select" if no class is selected AND we don't have any data yet
  if (shouldUseInstituteApi && !selectedClass) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        {/* Current Selection Display */}

        <div className="flex flex-col gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Students</h1>
            {/* Breadcrumb Display */}
            {(selectedInstitute || selectedClass) && (
              <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground mt-1">
                {selectedInstitute && (
                  <>
                    <span>Institute: {selectedInstitute.name}</span>
                    {selectedClass && <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />}
                  </>
                )}
                {selectedClass && (
                  <>
                    <span>Class: {selectedClass.name}</span>
                    {selectedSubject && <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />}
                  </>
                )}
                {selectedSubject && <span>Subject: {selectedSubject.name}</span>}
              </div>
            )}
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {getCurrentSelection() || 'Select institute and class to view students'}
            </p>
          </div>
        </div>

        <EmptyState
          icon={Users}
          title="Select a Class"
          description="Please select an institute and class to view students."
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Current Selection Display */}

      <div className="flex flex-col gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Students</h1>
          {/* Breadcrumb Display */}
          {shouldUseInstituteApi && (selectedInstitute || selectedClass) && (
            <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground mt-1">
              {selectedInstitute && (
                <>
                  <span>Institute: {selectedInstitute.name}</span>
                  {selectedClass && <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />}
                </>
              )}
              {selectedClass && (
                <>
                  <span>Class: {selectedClass.name}</span>
                  {selectedSubject && <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />}
                </>
              )}
              {selectedSubject && <span>Subject: {selectedSubject.name}</span>}
            </div>
          )}
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {shouldUseInstituteApi && getCurrentSelection()
              ? 'Manage students for your selection'
              : 'Manage student records and information'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {filteredStudents.length} Students
          </Badge>
          {/* Batch Report Button — shown at class level with institute API */}
          {shouldUseInstituteApi && selectedClass && !selectedSubject && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectedStudentIds.size > 0 ? clearSelection : selectAllFiltered}
                className={`flex items-center gap-2 border-indigo-200 ${selectedStudentIds.size > 0 ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-muted-foreground'}`}
              >
                {selectedStudentIds.size > 0 ? <X className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                <span>{selectedStudentIds.size > 0 ? `Clear (${selectedStudentIds.size})` : 'Select All'}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950"
                onClick={() => {
                  if (selectedStudentIds.size === 0) {
                    toast({
                      title: "No Students Selected",
                      description: "Please select at least one student to generate reports.",
                      variant: "default"
                    });
                    return;
                  }
                  setShowBatchReportDialog(true);
                }}
              >
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Generate Reports</span>
                <span className="sm:hidden">Reports</span>
                {selectedStudentIds.size > 0 && (
                  <Badge className="ml-1 h-4 px-1 text-[9px] bg-indigo-600 text-white border-none">
                    {selectedStudentIds.size}
                  </Badge>
                )}
              </Button>
            </div>
          )}
          {/* Assign User Buttons - Only for InstituteAdmin and Teacher */}
          {shouldUseInstituteApi && selectedClass && (userRole === 'InstituteAdmin' || userRole === 'Teacher') && (
            <>
              {selectedSubject ? (
                <Button
                  onClick={() => setShowSubjectAssignDialog(true)}
                  className="flex items-center gap-2 flex-1 sm:flex-none"
                  size="sm"
                >
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Assign User</span>
                  <span className="sm:hidden">Assign</span>
                </Button>
              ) : (
                <Button
                  onClick={() => setShowAssignDialog(true)}
                  className="flex items-center gap-2 flex-1 sm:flex-none"
                  size="sm"
                >
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Assign User</span>
                  <span className="sm:hidden">Assign</span>
                </Button>
              )}

            </>
          )}
          {/* Enroll by Payment Button - Only at subject level for admins/teachers */}
          {shouldUseInstituteApi && selectedClass && selectedSubject && canManageType && (
            <Button
              variant="outline"
              onClick={() => setShowEnrollByPaymentDialog(true)}
              className="flex items-center gap-2 flex-1 sm:flex-none border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950"
              size="sm"
            >
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Enroll by Payment</span>
              <span className="sm:hidden">Enroll</span>
            </Button>
          )}
          {/* Give Free Card Button - Only at class level for admins/teachers */}
          {shouldUseInstituteApi && selectedClass && !selectedSubject && canManageType && (
            <Button
              variant="outline"
              onClick={() => { setTypeDialogSearch(''); setTypeDialogSearchCommitted(''); setTypeDialogStudentId(''); setTypeDialogType('free_card'); setShowTypeDialog(true); }}
              className="flex items-center gap-2 flex-1 sm:flex-none"
              size="sm"
            >
              <Gift className="h-4 w-4" />
              <span className="hidden sm:inline">Give Free Card</span>
              <span className="sm:hidden">Free Card</span>
            </Button>
          )}
          <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen} routeName="students-filter-sheet">
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="md:hidden flex items-center gap-2 flex-1 sm:flex-none"
                size="sm"
              >
                <Filter className="h-4 w-4" />
                <span>Filters</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="md:hidden flex flex-col max-h-[80vh] rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Filter Students</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto py-4">
                <div className="grid grid-cols-1 gap-4 px-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search students..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {!shouldUseInstituteApi && (
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {shouldUseInstituteApi && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="includeParentInfo"
                        checked={includeParentInfo}
                        onCheckedChange={(checked) => setIncludeParentInfo(checked === true)}
                      />
                      <Label htmlFor="includeParentInfo" className="text-sm font-medium cursor-pointer">
                        Include Parent Info
                      </Label>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('');
                      setStatusFilter('all');
                      setIncludeParentInfo(false);
                      setIsFilterSheetOpen(false);
                    }}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="hidden md:flex items-center gap-2 flex-1 sm:flex-none"
            size="sm"
          >
            <Filter className="h-4 w-4" />
            <span>Filters</span>
          </Button>
          <Button
            onClick={getLoadFunction()}
            disabled={tableLoading || loading}
            variant="outline"
            size="sm"
            className="flex-1 sm:flex-none"
          >
            {tableLoading || loading ? (
              <>
                <RefreshCw className="h-4 w-4 sm:mr-2 animate-spin" />
                <span className="hidden sm:inline">Loading...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Refresh</span>
              </>
            )}
          </Button>
          <ColumnConfigurator
            allColumns={allColumnDefs}
            colState={colState}
            onToggle={toggleColumn}
            onReset={resetColumns}
          />
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button onClick={() => setPageViewMode('card')} className={`p-1.5 transition-colors ${pageViewMode === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`} title="Card view"><LayoutGrid className="h-4 w-4" /></button>
            <button onClick={() => setPageViewMode('table')} className={`p-1.5 transition-colors ${pageViewMode === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`} title="Table view"><Table2 className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* Filter Controls - Desktop Only */}
      {showFilters && (
        <ScrollAnimationWrapper animationType="slide-up" className="hidden md:block">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Filter className="h-5 w-5" />
                Filter Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search students..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                {!shouldUseInstituteApi && (
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {shouldUseInstituteApi && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeParentInfo"
                      checked={includeParentInfo}
                      onCheckedChange={(checked) => setIncludeParentInfo(checked === true)}
                    />
                    <Label htmlFor="includeParentInfo" className="text-sm font-medium cursor-pointer">
                      Include Parent Info
                    </Label>
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setIncludeParentInfo(false);
                  }}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        </ScrollAnimationWrapper>
      )}

      {/* Students Table/Cards */}
      {filteredStudents.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Students Found"
          description={searchTerm || statusFilter !== 'all' ? 'No students match your current filters.' : 'No students have been created yet.'}
        />
      ) : (
        <>
          {pageViewMode === 'card' ? (
            <div className="grid grid-cols-1 gap-4">
              {(showAllStudentCards ? (filteredStudents as InstituteStudent[]) : (filteredStudents as InstituteStudent[]).slice(0, 8)).map(student => {
                const isExpanded = expandedStudentId === student.id;
                const sType = (studentTypeMap[student.id] ?? student.studentType ?? 'normal') as string;
                const cardTypeBadge: Record<string, string> = {
                  free_card: 'text-purple-700 border-purple-300 bg-purple-50 dark:bg-purple-950 dark:text-purple-300',
                  paid: 'text-green-700 border-green-300 bg-green-50 dark:bg-green-950 dark:text-green-300',
                  half_paid: 'text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950 dark:text-amber-300',
                  quarter_paid: 'text-sky-700 border-sky-300 bg-sky-50 dark:bg-sky-950 dark:text-sky-300',
                };
                const cardTypeLabel: Record<string, string> = {
                  free_card: 'Free Card', paid: 'Paid', half_paid: 'Half Paid', quarter_paid: 'Quarter Paid',
                };
                const isSelected = selectedStudentIds.has(student.id);
                return (
                  <Card
                    key={student.id}
                    className={`hover:shadow-md transition-shadow cursor-pointer ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-300' : ''}`}
                    onClick={() => {
                      navigate(buildStudentProfileUrl(student.id, {
                        instituteId: selectedInstitute?.id,
                        classId: selectedClass?.id,
                        subjectId: selectedSubject?.id
                      }), { state: { student } });
                    }}
                  >
                    <div className="p-4 flex items-center gap-3">
                      {shouldUseInstituteApi && selectedClass && !selectedSubject && (
                        <Checkbox
                          checked={isSelected}
                          onClick={(e) => toggleStudentSelect(student.id, e as unknown as React.MouseEvent)}
                          className="shrink-0 h-4 w-4"
                        />
                      )}
                      <Avatar
                        className="h-12 w-12 shrink-0 border-2 border-border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (student.imageUrl) setImagePreview({ isOpen: true, url: getImageUrl(student.imageUrl), title: student.name });
                        }}
                      >
                        <AvatarImage src={getImageUrl(student.imageUrl)} />
                        <AvatarFallback>{student.name?.[0] || 'S'}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-sm truncate">{student.name}</p>
                          {shouldUseInstituteApi && cardTypeBadge[sType] && (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${cardTypeBadge[sType]}`}>
                              {sType === 'free_card' && <Gift className="h-2.5 w-2.5" />}
                              {sType === 'paid' && <CreditCard className="h-2.5 w-2.5" />}
                              {sType === 'half_paid' && <BadgePercent className="h-2.5 w-2.5" />}
                              {sType === 'quarter_paid' && <CircleDollarSign className="h-2.5 w-2.5" />}
                              {cardTypeLabel[sType]}
                            </span>
                          )}
                        </div>
                        {student.userIdByInstitute && <p className="text-xs text-muted-foreground font-mono">Institute ID: {student.userIdByInstitute}</p>}
                        {student.studentId && <p className="text-xs text-muted-foreground font-mono">Student ID: {student.studentId}</p>}
                        <p className="text-xs text-muted-foreground font-mono">ID: {student.id}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        <Button size="sm" variant="outline" onClick={(e) => {
                          e.stopPropagation();
                          navigate(buildStudentProfileUrl(student.id, {
                            instituteId: selectedInstitute?.id,
                            classId: selectedClass?.id,
                            subjectId: selectedSubject?.id
                          }), { state: { student } });
                        }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedStudentId(isExpanded ? null : student.id);
                          }}
                          className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t pt-3 space-y-2">
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {student.email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{student.email}</span></div>}
                          {student.phoneNumber && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" /><span>{student.phoneNumber}</span></div>}
                          {student.dateOfBirth && <div className="flex items-center gap-2"><span className="font-medium text-foreground">DOB:</span><span>{new Date(student.dateOfBirth).toLocaleDateString()}</span></div>}
                          {student.addressLine1 && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{student.addressLine1}</span></div>}
                          {student.addressLine2 && <div className="flex items-center gap-2"><Home className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{student.addressLine2}</span></div>}
                        </div>
                        {/* Extra Data */}
                        {student.extraData && Object.keys(student.extraData).length > 0 && (
                          <div className="pt-1">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Custom Data</p>
                            <div className="grid grid-cols-2 gap-1">
                              {Object.entries(student.extraData).map(([key, value]) => (
                                <div key={key} className="text-xs p-1.5 rounded bg-muted/60 border border-border/50">
                                  <span className="font-medium text-muted-foreground">{key}:</span>{' '}
                                  <span>{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Edit Extra Data button */}
                        {shouldUseInstituteApi && canManageType && (
                          <div className="pt-1">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditExtraData(student);
                            }}>
                              <Pencil className="h-3 w-3" /> Edit Extra Data
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
              {filteredStudents.length > 8 && (
                <Button variant="outline" onClick={() => setShowAllStudentCards((prev) => !prev)} className="w-full">
                  {showAllStudentCards ? 'Show less' : `Show all ${filteredStudents.length} students`}
                </Button>
              )}
            </div>
          ) : (
            <MUITable
              title=""
              data={filteredStudents}
              columns={muiColumns}
              storageKey="students"
              onAdd={undefined}
              onEdit={undefined}
              onDelete={undefined}
              onView={(row: InstituteStudent) => {
                navigate(buildStudentProfileUrl(row.id, {
                  instituteId: selectedInstitute?.id,
                  classId: selectedClass?.id,
                  subjectId: selectedSubject?.id
                }), { state: { student: row } });
              }}
              onRowClick={(row: InstituteStudent) => {
                navigate(buildStudentProfileUrl(row.id, {
                  instituteId: selectedInstitute?.id,
                  classId: selectedClass?.id,
                  subjectId: selectedSubject?.id
                }), { state: { student: row } });
              }}
              page={pagination.page}
              rowsPerPage={pagination.limit}
              totalCount={filteredStudents.length}
              onPageChange={actions.setPage}
              onRowsPerPageChange={actions.setLimit}
              sectionType="students"
              allowAdd={false}
              allowEdit={false}
              allowDelete={false}
            />
          )}
        </>
      )}

      {/* Pagination - Only show for paginated data */}
      {shouldUseInstituteApi && pagination.totalCount > pagination.limit && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {(pagination.page * pagination.limit) + 1} to {Math.min((pagination.page + 1) * pagination.limit, pagination.totalCount)} of {pagination.totalCount} students
          </p>
        </div>
      )}

      {/* Create Student Form Dialog - Only for non-institute users */}

      {/* Shared report dialog — section toggles + date ranges + advanced print options */}
      <ReportDialog
        open={showBatchReportDialog}
        onClose={() => setShowBatchReportDialog(false)}
        onGenerate={handleBatchReport}
        generating={generatingBatchReport}
        progress={generatingBatchReport ? batchProgress : undefined}
        title={`Generate Reports (${selectedStudentIds.size} student${selectedStudentIds.size !== 1 ? 's' : ''})`}
        showDateRanges={true}
      />

      {/* Assign Students Dialog - Only for InstituteAdmin and Teacher (Class level) */}
      {shouldUseInstituteApi && selectedClass && !selectedSubject && (
        <AssignUsersDialog
          open={showAssignDialog}
          onOpenChange={setShowAssignDialog}
          onAssignmentComplete={() => {
            // Refresh the students list using the correct load function
            getLoadFunction()();
          }}
        />
      )}

      {/* Assign Subject Students Dialog - Only for InstituteAdmin and Teacher (Subject level) */}
      {shouldUseInstituteApi && selectedClass && selectedSubject && (
        <AssignSubjectStudentsDialog
          open={showSubjectAssignDialog}
          onOpenChange={setShowSubjectAssignDialog}
          onAssignmentComplete={() => {
            // Refresh the students list using the correct load function  
            getLoadFunction()();
          }}
        />
      )}

      <ImagePreviewModal
        isOpen={imagePreview.isOpen}
        onClose={() => setImagePreview({ isOpen: false, url: '', title: '' })}
        imageUrl={imagePreview.url}
        title={imagePreview.title}
      />

      {/* Parent Details Dialog */}
      <Dialog open={parentDetailsDialog.open} onOpenChange={(open) => !open && setParentDetailsDialog({ open: false, parent: null })} routeName="parent-details-popup">
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {parentDetailsDialog.parent?.name || 'Parent Details'}
            </DialogTitle>
          </DialogHeader>

          {parentDetailsDialog.parent && (
            <div className="space-y-6">
              {/* Parent Avatar and Info */}
              <div className="flex items-center gap-4 pb-4 border-b">
                <Avatar className="h-16 w-16 border-2 border-primary/20">
                  <AvatarImage src={getImageUrl(parentDetailsDialog.parent.imageUrl)} alt={parentDetailsDialog.parent.name} className="object-cover" />
                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-lg">
                    {parentDetailsDialog.parent.name?.split(' ').map((n: string) => n.charAt(0)).join('') || 'P'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{parentDetailsDialog.parent.name || 'N/A'}</h3>
                  <p className="text-sm text-muted-foreground">{parentDetailsDialog.parent.email || 'N/A'}</p>
                </div>
              </div>

              {/* Parent Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Parent ID:</span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {parentDetailsDialog.parent.id || 'N/A'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Occupation:</span>
                  <span>{parentDetailsDialog.parent.occupation || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Workplace:</span>
                  <span>{parentDetailsDialog.parent.workPlace || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Phone:</span>
                  <span>{parentDetailsDialog.parent.phoneNumber || 'N/A'}</span>
                </div>
              </div>

              {/* Children List */}
              {parentDetailsDialog.parent.children && parentDetailsDialog.parent.children.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Children ({parentDetailsDialog.parent.children.length})
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Avatar</TableHead>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Relationship</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parentDetailsDialog.parent.children.map((child: any, index: number) => (
                        <TableRow key={child.userId || index}>
                          <TableCell>
                            <Avatar className="h-12 w-12 border-2 border-primary/20">
                              <AvatarImage src={getImageUrl(child.imageUrl)} alt={child.name} className="object-cover" />
                              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/40 text-xs">
                                {child.name?.charAt(0) || 'C'}
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-xs">
                              {child.studentId || 'N/A'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{child.name || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {child.relationshipType || 'N/A'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Give Free Card Dialog */}
      <Dialog open={showTypeDialog} onOpenChange={setShowTypeDialog} routeName="give-free-card-popup">
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Give Free Card / Set Student Type
            </DialogTitle>
            <DialogDescription>
              Search and select a student to update their enrollment type for all subjects in this class.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  className="w-full pl-9 pr-3 py-2 border rounded text-sm bg-background"
                  placeholder="Search by name, email, or ID..."
                  value={typeDialogSearch}
                  onChange={e => { setTypeDialogSearch(e.target.value); setTypeDialogStudentId(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') { setTypeDialogSearchCommitted(typeDialogSearch); setTypeDialogStudentId(''); } }}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="shrink-0"
                onClick={() => { setTypeDialogSearchCommitted(typeDialogSearch); setTypeDialogStudentId(''); }}
                disabled={!typeDialogSearch.trim()}
              >
                Search
              </Button>
            </div>
            {typeDialogSearchCommitted && dialogFilteredStudents.length === 0 && !typeDialogStudentId && (
              <p className="text-sm text-muted-foreground text-center py-2">No students found.</p>
            )}
            {typeDialogSearchCommitted && dialogFilteredStudents.length > 0 && !typeDialogStudentId && (
              <div className="border rounded max-h-48 overflow-y-auto divide-y">
                {dialogFilteredStudents.map(s => (
                  <button
                    key={s.id}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => { setTypeDialogStudentId(s.id); setTypeDialogSearch(s.name); }}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={getImageUrl(s.imageUrl)} alt={s.name} />
                      <AvatarFallback className="text-xs">{s.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {typeDialogStudentId && (
              <div className="flex items-center gap-2 p-2 bg-muted/40 rounded border text-sm">
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="font-medium">Selected:</span>
                <span>{typeDialogSearch}</span>
                <button className="ml-auto text-xs text-muted-foreground hover:text-destructive" onClick={() => { setTypeDialogStudentId(''); setTypeDialogSearch(''); setTypeDialogSearchCommitted(''); }}>Clear</button>
              </div>
            )}
            <div>
              <label className="text-sm font-medium block mb-1">Enrollment Type</label>
              <div className="flex flex-wrap gap-2">
                {(['free_card', 'paid', 'half_paid', 'quarter_paid', 'normal'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTypeDialogType(t)}
                    className={`flex-1 min-w-[80px] py-2 rounded border text-sm font-medium transition-colors ${typeDialogType === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted/50'}`}
                  >
                    {t === 'free_card' ? 'Free Card' : t === 'half_paid' ? 'Half Paid' : t === 'quarter_paid' ? 'Quarter Paid' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTypeDialog(false)} disabled={typeDialogLoading}>Cancel</Button>
            <Button onClick={handleClassTypeDialogSubmit} disabled={!typeDialogStudentId || typeDialogLoading}>
              {typeDialogLoading ? 'Updating...' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Extra Data Dialog */}
      <Dialog open={editExtraDataDialog.open} onOpenChange={(open) => !open && setEditExtraDataDialog({ open: false, student: null })} routeName="edit-extra-data-popup">
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Extra Data — {editExtraDataDialog.student?.name}
            </DialogTitle>
            <DialogDescription>
              Add or edit custom key-value data for this student.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {extraDataRows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  placeholder="Key"
                  value={row.key}
                  onChange={(e) => {
                    const updated = [...extraDataRows];
                    updated[idx] = { ...updated[idx], key: e.target.value };
                    setExtraDataRows(updated);
                  }}
                  className="flex-1"
                />
                <Input
                  placeholder="Value"
                  value={row.value}
                  onChange={(e) => {
                    const updated = [...extraDataRows];
                    updated[idx] = { ...updated[idx], value: e.target.value };
                    setExtraDataRows(updated);
                  }}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={() => {
                    const updated = extraDataRows.filter((_, i) => i !== idx);
                    setExtraDataRows(updated.length === 0 ? [{ key: '', value: '' }] : updated);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1"
              onClick={() => setExtraDataRows([...extraDataRows, { key: '', value: '' }])}
            >
              <PlusCircle className="h-3.5 w-3.5" /> Add Field
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditExtraDataDialog({ open: false, student: null })} disabled={savingExtraData}>Cancel</Button>
            <Button onClick={handleSaveExtraData} disabled={savingExtraData}>
              {savingExtraData ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enroll by Payment Dialog */}
      {selectedInstitute && selectedClass && selectedSubject && (
        <EnrollByPaymentDialog
          open={showEnrollByPaymentDialog}
          onOpenChange={setShowEnrollByPaymentDialog}
          instituteId={selectedInstitute.id}
          classId={selectedClass.id}
          subjectId={selectedSubject.id}
          subjectName={selectedSubject.name}
          onSuccess={() => fetchInstituteSubjectStudents(true)}
        />
      )}
    </div>
  );
};

export default Students;
