import React, { useState, useMemo, useRef, useEffect } from 'react';
import MUITable from '@/components/ui/mui-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { RefreshCw, Filter, UserPlus, UserMinus, Settings, Copy, Lock, Unlock, KeyRound, ChevronDown, BookOpen, ChevronsDownUp, ChevronsUpDown, LayoutGrid, Table2, Search, X, Link2, CreditCard, Key, MoreVertical } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useViewMode } from '@/hooks/useViewMode';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useTableData } from '@/hooks/useTableData';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { TeacherSelectorDialog } from '@/components/dialogs/TeacherSelectorDialog';
import { instituteApi } from '@/api/institute.api';
import { SUBJECT_TYPE_OPTIONS, BASKET_CATEGORY_OPTIONS } from '@/api/subjects.api';
import { getErrorMessage } from '@/api/apiError';
import { useNavigate } from 'react-router-dom';
import AssignSubjectToClassForm from '@/components/forms/AssignSubjectToClassForm';
import { enrollmentApi } from '@/api/enrollment.api';
import { subjectPaymentsApi, SubjectPayment } from '@/api/subjectPayments.api';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface TeacherInfo {
  id: string;
  firstName: string;
  lastName: string;
  nameWithInitials?: string;
  email: string;
  imageUrl?: string;
}

interface SubjectData {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  creditHours: number;
  isActive: boolean;
  subjectType: string;
  basketCategory: string;
  instituteId: string;
  imgUrl: string | null;
  createdAt: string;
  updatedAt: string;
  teacherId?: string;
  teacher?: TeacherInfo | null;
  classId?: string;
  subjectId?: string;
  enrollmentEnabled?: boolean;
  enrollmentKey?: string;
}

const ClassSubjects = () => {
  const { subjectsLabel } = useInstituteLabels();
  const {
    user,
    selectedInstitute,
    selectedClass,
    currentInstituteId,
    currentClassId
  } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [subjectTypeFilter, setSubjectTypeFilter] = useState('all');
  const [basketCategoryFilter, setBasketCategoryFilter] = useState('all');
  const userRole = useInstituteRole();

  // Image preview state
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Teacher assignment state
  const [isTeacherSelectorOpen, setIsTeacherSelectorOpen] = useState(false);
  const [selectedSubjectForTeacher, setSelectedSubjectForTeacher] = useState<{
    subjectId: string;
    instituteId: string;
    classId: string;
  } | null>(null);
  const [isAssigningTeacher, setIsAssigningTeacher] = useState(false);
  const [isUnassigningTeacher, setIsUnassigningTeacher] = useState(false);
  const [showUnassignConfirm, setShowUnassignConfirm] = useState(false);
  const [subjectToUnassign, setSubjectToUnassign] = useState<SubjectData | null>(null);
  // Assign Subject to Class dialog
  const [isAssignSubjectDialogOpen, setIsAssignSubjectDialogOpen] = useState(false);

  // Fetch class subjects - only when class is selected
  const endpoint = currentInstituteId && currentClassId
    ? `/institutes/${currentInstituteId}/classes/${currentClassId}/subjects`
    : '';

  const tableData = useTableData<SubjectData>({
    endpoint,
    defaultParams: {
      ...(currentInstituteId && { instituteId: currentInstituteId }),
    },
    cacheOptions: {
      ttl: 15,
      userId: user?.id,
      role: userRole || 'User',
      instituteId: currentInstituteId || undefined,
      classId: currentClassId || undefined
    },
    dependencies: [currentInstituteId, currentClassId],
    pagination: {
      defaultLimit: 10,
      availableLimits: [10, 25, 50, 100]
    },
    autoLoad: !!(currentInstituteId && currentClassId),
  });

  const {
    state: { data: subjectsData, loading: isLoading },
    pagination,
    actions
  } = tableData;
  
  // Transform nested API response to flattened structure for table
  const transformedData = useMemo(() => subjectsData.map((item: any) => {
    if (item.subject) {
      return {
        ...item.subject,
        teacher: item.teacher,
        teacherId: item.teacherId,
        instituteId: item.instituteId,
        classId: item.classId,
        subjectId: item.subjectId || item.subject?.id,
        enrollmentEnabled: item.enrollmentEnabled,
        enrollmentKey: item.enrollmentKey
      };
    }
    return {
      ...item,
      teacher: item.teacher || null,
      teacherId: item.teacherId || null,
      subjectId: item.id,
      enrollmentEnabled: item.enrollmentEnabled || false,
      enrollmentKey: item.enrollmentKey || null
    };
  }), [subjectsData]);
  
  const isInstituteAdmin = userRole === 'InstituteAdmin';
  const isTeacher = userRole === 'Teacher';
  const { viewMode, setViewMode } = useViewMode();

  // Client-side filtering â€” all filtering is done here, no server re-fetch on filter change
  const filteredSubjects = useMemo(() => {
    return transformedData.filter((subject: SubjectData) => {
      // Search filter
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        const matches =
          subject.name?.toLowerCase().includes(s) ||
          subject.code?.toLowerCase().includes(s) ||
          subject.description?.toLowerCase().includes(s);
        if (!matches) return false;
      }
      // Status filter â€” coerce to boolean in case API returns string
      if (statusFilter !== 'all') {
        const active = subject.isActive === true || (subject.isActive as any) === 'true';
        if (statusFilter === 'active' && !active) return false;
        if (statusFilter === 'inactive' && active) return false;
      }
      // Category filter â€” case-insensitive match
      if (categoryFilter !== 'all') {
        if (!subject.category || subject.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
      }
      // Subject type filter
      if (subjectTypeFilter !== 'all') {
        if (subject.subjectType !== subjectTypeFilter) return false;
      }
      // Basket category filter
      if (basketCategoryFilter !== 'all') {
        if (subject.basketCategory !== basketCategoryFilter) return false;
      }
      return true;
    });
  }, [transformedData, searchTerm, statusFilter, categoryFilter, subjectTypeFilter, basketCategoryFilter]);
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
  const CARD_INITIAL_SHOW = 6;
  const [showAllCards, setShowAllCards] = useState(false);

  const resolveImageUrl = (url?: string | null) => {
    if (!url) return '/placeholder.svg';
    return getImageUrl(url);
  };

  const handleAssignTeacher = (subject: SubjectData) => {
    if (!currentInstituteId || !currentClassId) {
      toast({
        title: "Error",
        description: "Please select a class first to assign teachers to subjects",
        variant: "destructive"
      });
      return;
    }
    setSelectedSubjectForTeacher({
      subjectId: subject.subjectId || subject.id,
      instituteId: subject.instituteId || currentInstituteId,
      classId: subject.classId || currentClassId
    });
    setIsTeacherSelectorOpen(true);
  };

  const handleUnassignTeacher = (subject: SubjectData) => {
    if (!currentInstituteId || !currentClassId) {
      toast({
        title: "Error",
        description: "Please select a class first to manage subject teachers",
        variant: "destructive"
      });
      return;
    }
    setSubjectToUnassign(subject);
    setShowUnassignConfirm(true);
  };

  const confirmUnassignTeacher = async () => {
    if (!subjectToUnassign || isUnassigningTeacher) return;

    try {
      setIsUnassigningTeacher(true);
      await instituteApi.unassignTeacherFromSubject(
        subjectToUnassign.instituteId || currentInstituteId || '',
        subjectToUnassign.classId || currentClassId || '',
        subjectToUnassign.subjectId || subjectToUnassign.id
      );
      toast({
        title: "Success",
        description: "Teacher unassigned successfully"
      });
      setShowUnassignConfirm(false);
      setSubjectToUnassign(null);
      actions.refresh();
    } catch (error: any) {
      console.error('Error unassigning teacher:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error, 'Failed to unassign teacher'),
        variant: "destructive"
      });
    } finally {
      setIsUnassigningTeacher(false);
    }
  };

  const handleTeacherSelect = async (teacherId: string) => {
    if (!selectedSubjectForTeacher || isAssigningTeacher) return;

    try {
      setIsAssigningTeacher(true);
      await instituteApi.assignTeacherToSubject(
        selectedSubjectForTeacher.instituteId,
        selectedSubjectForTeacher.classId,
        selectedSubjectForTeacher.subjectId,
        teacherId
      );
      toast({
        title: "Success",
        description: "Teacher assigned successfully"
      });
      actions.refresh();
    } catch (error: any) {
      console.error('Error assigning teacher:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error, 'Failed to assign teacher'),
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsAssigningTeacher(false);
    }
  };

  const handleManageEnrollment = (subject: SubjectData) => {
    const params = new URLSearchParams({
      instituteId: subject.instituteId || currentInstituteId || '',
      classId: subject.classId || currentClassId || '',
      subjectId: subject.subjectId || subject.id,
      subjectName: subject.name,
      className: selectedClass?.name || ''
    });
    navigate(`/enrollment-management?${params.toString()}`);
  };

  const copyEnrollmentKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      toast({
        title: "Copied",
        description: "Enrollment key copied to clipboard"
      });
    } catch (error: any) {
      toast({
        title: "Copy Failed",
        description: getErrorMessage(error, 'Failed to copy enrollment key'),
        variant: "destructive"
      });
    }
  };

  // Unified enrollment settings dialog — key and payment are INDEPENDENT
  const [enrollSettingsDialog, setEnrollSettingsDialog] = useState<{
    open: boolean; loading: boolean; saving: boolean;
    subjectName: string; iId: string; cId: string; sId: string;
    // Independent toggles
    keyEnabled: boolean; key: string;
    paymentEnabled: boolean; paymentRefId: string; allowedStatuses: string[];
    classPayments: SubjectPayment[];
  }>({ open: false, loading: false, saving: false, subjectName: '', iId: '', cId: '', sId: '', keyEnabled: false, key: '', paymentEnabled: false, paymentRefId: '', allowedStatuses: ['VERIFIED'], classPayments: [] });

  const PAYMENT_STATUS_OPTIONS = [
    { value: 'VERIFIED', label: 'Full Paid' },
    { value: 'HALF_VERIFIED', label: 'Half Paid' },
    { value: 'QUARTER_VERIFIED', label: 'Quarter Paid' },
  ];

  const handleOpenEnrollSettings = async (subject: SubjectData) => {
    const iId = subject.instituteId || currentInstituteId || '';
    const cId = subject.classId || currentClassId || '';
    const sId = subject.subjectId || subject.id;
    setEnrollSettingsDialog(prev => ({ ...prev, open: true, loading: true, subjectName: subject.name, iId, cId, sId, classPayments: [] }));
    try {
      // Check if user has institute role (Teacher, InstituteAdmin, etc.) - only they can view full settings
      const hasInstituteRole = userRole && ['Teacher', 'InstituteAdmin', 'AttendanceMarker'].includes(userRole);
      
      if (!hasInstituteRole) {
        // Skip enrollment-settings call for students/parents - go directly to fallback
        throw new Error('User does not have institute role');
      }
      
      // Primary: full enrollment settings (includes payment gate config)
      const [settings, paymentsRes] = await Promise.all([
        enrollmentApi.getEnrollmentSettings(iId, cId, sId, { userId: user?.id, role: userRole || 'User' }, true),
        subjectPaymentsApi.getPaymentsByClass(iId, cId, 1, 100, true)
      ]);
      setEnrollSettingsDialog(prev => ({
        ...prev, loading: false,
        keyEnabled: !!(settings.enrollmentEnabled && settings.enrollmentKey),
        key: settings.enrollmentKey || '',
        paymentEnabled: !!(settings.enrollmentFeeRequired || settings.enrollmentPaymentRefId),
        paymentRefId: settings.enrollmentPaymentRefId || '',
        allowedStatuses: settings.enrollmentPaymentStatuses?.length ? settings.enrollmentPaymentStatuses : ['VERIFIED'],
        classPayments: paymentsRes?.data || []
      }));
    } catch (err: any) {
      // Fallback: try the enrollment-key endpoint if enrollment-settings fails (403/410/deprecated or no institute role)
      try {
        const [keySettings, paymentsRes] = await Promise.all([
          enrollmentApi.getSubjectEnrollmentKey(iId, cId, sId, true),
          subjectPaymentsApi.getPaymentsByClass(iId, cId, 1, 100, true)
        ]);
        setEnrollSettingsDialog(prev => ({
          ...prev, loading: false,
          keyEnabled: keySettings.enrollmentType === 'KEY_REQUIRED',
          key: keySettings.enrollmentKey || '',
          classPayments: paymentsRes?.data || []
        }));
      } catch {
        // Both failed — open with defaults
        setEnrollSettingsDialog(prev => ({
          ...prev, loading: false,
          keyEnabled: false, key: '',
          classPayments: []
        }));
      }
    }
  };

  const handleSaveEnrollSettings = async () => {
    const { iId, cId, sId, keyEnabled, key, paymentEnabled, paymentRefId, allowedStatuses } = enrollSettingsDialog;
    if (!iId || !cId || !sId) return;
    const enrollmentEnabled = keyEnabled || paymentEnabled;
    setEnrollSettingsDialog(prev => ({ ...prev, saving: true }));
    try {
      // Send explicit enrollmentKey: null to clear when key is disabled
      const explicitKey = keyEnabled ? (key.trim() || undefined) : null;
      await enrollmentApi.updateEnrollmentSettings(
        iId, cId, sId, enrollmentEnabled, explicitKey as any,
        { userId: user?.id, role: userRole || 'User' },
        {
          enrollmentFeeRequired: paymentEnabled,
          enrollmentPaymentRefId: paymentEnabled && paymentRefId ? paymentRefId : undefined,
          enrollmentPaymentStatuses: paymentEnabled && paymentRefId ? allowedStatuses : undefined,
        }
      );
      toast({ title: 'Saved', description: 'Enrollment settings updated successfully' });
      setEnrollSettingsDialog(prev => ({ ...prev, open: false, saving: false }));
      actions.refresh();
    } catch (err: any) {
      toast({ title: 'Error', description: getErrorMessage(err, 'Failed to save enrollment settings'), variant: 'destructive' });
      setEnrollSettingsDialog(prev => ({ ...prev, saving: false }));
    }
  };



  const subjectsColumns = [
    {
      id: 'imgUrl',
      key: 'imgUrl',
      header: 'Image',
      format: (value: string | null, row: any) => (
        <div 
          className="w-16 h-16 rounded-lg overflow-hidden bg-muted cursor-pointer hover:ring-2 hover:ring-primary transition-all"
          onClick={() => {
            const imgUrl = row?.imgUrl || value;
            if (imgUrl) {
              setPreviewImage({ url: resolveImageUrl(imgUrl), title: `${row?.name || 'Subject'} - Subject Image` });
            }
          }}
        >
          <img
            src={resolveImageUrl(row?.imgUrl || value)}
            alt={row?.name ? `Subject ${row.name}` : 'Subject image'}
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }}
          />
        </div>
      )
    },
    {
      key: 'code',
      header: 'Code'
    },
    {
      key: 'name',
      header: 'Name',
      format: (value: string | null) => value || <span className="text-muted-foreground italic">No name</span>
    },
    {
      key: 'description',
      header: 'Description',
      format: (value: string | null) => value || <span className="text-muted-foreground italic">No description</span>
    },
    {
      key: 'category',
      header: 'Category',
      format: (value: string | null) => value || <span className="text-muted-foreground italic">N/A</span>
    },
    {
      key: 'creditHours',
      header: 'Credit Hours',
      format: (value: number | null) => value !== null && value !== undefined ? value : <span className="text-muted-foreground italic">N/A</span>
    },
    {
      key: 'subjectType',
      header: 'Type',
      format: (value: string | null) => {
        if (!value) return <span className="text-muted-foreground italic">N/A</span>;
        const option = SUBJECT_TYPE_OPTIONS.find(o => o.value === value);
        const isBasket = value.includes('BASKET');
        return (
          <Badge variant={isBasket ? 'outline' : 'secondary'} className={isBasket ? 'border-purple-500 text-purple-700 dark:text-purple-300' : ''}>
            {option?.label || value}
          </Badge>
        );
      }
    },
    {
      key: 'basketCategory',
      header: 'Basket',
      format: (value: string | null, row: SubjectData) => {
        if (!value || !row.subjectType?.includes('BASKET')) {
          return <span className="text-muted-foreground italic">â€”</span>;
        }
        const option = BASKET_CATEGORY_OPTIONS.find(o => o.value === value);
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-300">
            {option?.label || value}
          </Badge>
        );
      }
    },
    {
      key: 'teacher',
      header: 'Teacher',
      format: (value: TeacherInfo | null) => (
        <div className="min-w-[180px]">
          {value ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={getImageUrl(value.imageUrl)} alt={value.firstName ? `${value.firstName} ${value.lastName}` : 'Teacher'} />
                <AvatarFallback className="bg-blue-100 text-blue-600 text-xs">
                  {value.firstName?.[0] || 'T'}{value.lastName?.[0] || 'R'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">
                  {value.nameWithInitials || `${value.firstName} ${value.lastName}`}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {value.email}
                </div>
              </div>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">No teacher assigned</span>
          )}
        </div>
      )
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (value: boolean) => (
        <Badge variant={value ? 'default' : 'secondary'}>
          {value ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      format: (value: any, row: SubjectData) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {(isInstituteAdmin || isTeacher) && (
              <DropdownMenuItem onClick={() => handleOpenEnrollSettings(row)} className="gap-2">
                <Settings className="h-4 w-4" />Enrollment Settings
              </DropdownMenuItem>
            )}
            {isInstituteAdmin && <DropdownMenuSeparator />}
            {isInstituteAdmin && (
              row.teacher ? (
                <DropdownMenuItem
                  onClick={() => handleUnassignTeacher(row)}
                  disabled={isUnassigningTeacher || isAssigningTeacher}
                  className="gap-2 text-destructive focus:text-destructive"
                >
                  <UserMinus className="h-4 w-4" />Remove Teacher
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => handleAssignTeacher(row)}
                  disabled={isUnassigningTeacher || isAssigningTeacher}
                  className="gap-2"
                >
                  <UserPlus className="h-4 w-4" />Assign Teacher
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const getContextTitle = () => {
    const contexts = [];
    if (selectedInstitute) {
      contexts.push(selectedInstitute.name);
    }
    if (selectedClass) {
      contexts.push(selectedClass.name);
    }
    let title = 'Class Subjects';
    if (contexts.length > 0) {
      title += ` (${contexts.join(' â†’ ')})`;
    }
    return title;
  };

  // Show message if no class is selected
  if (!currentClassId) {
    return (
      <div className="space-y-6">
        <div className="text-center sm:text-left flex-1">
          <h1 className="text-3xl font-bold text-foreground mb-2">Class Subjects</h1>
          <p className="text-muted-foreground">Please select a class first to view and manage class subjects.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center sm:text-left flex-1">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {getContextTitle()}
        </h1>
        <p className="text-muted-foreground">
          View and manage subjects assigned to this class. Assign or unassign teachers for each subject.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Persistent search bar */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search subjects..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-8 h-9"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 relative"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {(statusFilter !== 'all' || categoryFilter !== 'all' || subjectTypeFilter !== 'all' || basketCategoryFilter !== 'all') && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-bold">
                {[statusFilter !== 'all', categoryFilter !== 'all', subjectTypeFilter !== 'all', basketCategoryFilter !== 'all'].filter(Boolean).length}
              </span>
            )}
          </Button>

          <Button variant="outline" size="sm" onClick={() => actions.refresh()} disabled={isLoading} className="flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* Assign Subject button â€” Admin & Teacher */}
          {(isInstituteAdmin || isTeacher) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAssignSubjectDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Link2 className="h-4 w-4" />
              <span className="hidden sm:inline">Assign Subject</span>
              <span className="sm:hidden">Assign</span>
            </Button>
          )}

          {/* Active filter chips */}
          {statusFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              {statusFilter === 'active' ? 'Active' : 'Inactive'}
              <button onClick={() => setStatusFilter('all')}><X className="h-3 w-3" /></button>
            </span>
          )}
          {categoryFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              {categoryFilter}
              <button onClick={() => setCategoryFilter('all')}><X className="h-3 w-3" /></button>
            </span>
          )}
          {subjectTypeFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              {subjectTypeFilter}
              <button onClick={() => setSubjectTypeFilter('all')}><X className="h-3 w-3" /></button>
            </span>
          )}
          {basketCategoryFilter !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
              {basketCategoryFilter}
              <button onClick={() => setBasketCategoryFilter('all')}><X className="h-3 w-3" /></button>
            </span>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 shrink-0">
          <button onClick={() => setViewMode('card')} className={`p-2 rounded-md transition-colors ${viewMode === 'card' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Card View"><LayoutGrid className="h-4 w-4" /></button>
          <button onClick={() => setViewMode('table')} className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} title="Table View"><Table2 className="h-4 w-4" /></button>
        </div>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg border mb-6">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Status
            </label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Category
            </label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Science">Science</SelectItem>
                <SelectItem value="Mathematics">Mathematics</SelectItem>
                <SelectItem value="Languages">Languages</SelectItem>
                <SelectItem value="Arts">Arts</SelectItem>
                <SelectItem value="Commerce">Commerce</SelectItem>
                <SelectItem value="Technology">Technology</SelectItem>
                <SelectItem value="Humanities">Humanities</SelectItem>
                <SelectItem value="Religion">Religion</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Subject Type
            </label>
            <Select value={subjectTypeFilter} onValueChange={setSubjectTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Subject Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {SUBJECT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">
              Basket Category
            </label>
            <Select value={basketCategoryFilter} onValueChange={setBasketCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Basket Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Baskets</SelectItem>
                {BASKET_CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Card / Table View */}
      {viewMode === 'card' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSubjects.length === 0 ? (
              <div className="col-span-full">
                {isLoading ? (
                  <div className="flex justify-center py-16"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : (
                  <EmptyState icon={BookOpen} title={`No ${subjectsLabel} Found`} description={`No ${subjectsLabel.toLowerCase()} match your current filters.`} />
                )}
              </div>
            ) : (showAllCards ? filteredSubjects : filteredSubjects.slice(0, CARD_INITIAL_SHOW)).map((subject: SubjectData) => {
              const sid = subject.subjectId || subject.id;
              const imgUrl = resolveImageUrl(subject.imgUrl);
              const isBasket = subject.subjectType?.includes('BASKET');
              const typeOption = SUBJECT_TYPE_OPTIONS.find(o => o.value === subject.subjectType);
              const basketOption = BASKET_CATEGORY_OPTIONS.find(o => o.value === subject.basketCategory);
              const hasLongDesc = (subject.description?.length || 0) > 120;
              const isDescExpanded = expandedSubjectId === sid;

              return (
                <Card key={sid} className="overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col">
                  {/* Image banner */}
                  <div
                    className="relative h-32 bg-muted overflow-hidden cursor-pointer"
                    onClick={() => { if (subject.imgUrl) setPreviewImage({ url: imgUrl, title: `${subject.name} - Subject Image` }); }}
                  >
                    <img src={imgUrl} alt={subject.name} className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg'; }} />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Badge variant={subject.isActive ? 'default' : 'secondary'} className={`text-xs ${subject.isActive ? 'bg-green-600' : 'bg-gray-500'}`}>
                        {subject.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>

                  {/* Card body â€” always visible */}
                  <div className="p-4 flex-1 flex flex-col gap-2">
                    <div>
                      <h3 className="font-semibold text-base truncate">{subject.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono">{subject.code}</p>
                    </div>

                    {/* Badges row */}
                    <div className="flex flex-wrap gap-1">
                      {subject.category && <Badge variant="outline" className="text-[10px]">{subject.category}</Badge>}
                      {subject.subjectType && (
                        <Badge variant={isBasket ? 'outline' : 'secondary'} className={`text-[10px] ${isBasket ? 'border-purple-500 text-purple-700 dark:text-purple-300' : ''}`}>
                          {typeOption?.label || subject.subjectType}
                        </Badge>
                      )}
                      {subject.basketCategory && (
                        <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-700 dark:text-blue-300">
                          {basketOption?.label || subject.basketCategory}
                        </Badge>
                      )}
                    </div>

                    {/* Info grid â€” always visible */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-1">
                      {subject.creditHours != null && <div className="text-muted-foreground">Credits: <span className="text-foreground font-medium">{subject.creditHours}</span></div>}
                      <div className="text-muted-foreground">Type: <span className="text-foreground font-medium">{typeOption?.label || subject.subjectType || 'N/A'}</span></div>
                    </div>

                    {/* Description â€” with expand/collapse for long text */}
                    {subject.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        <p className={!isDescExpanded && hasLongDesc ? 'line-clamp-2' : ''}>
                          {subject.description}
                        </p>
                        {hasLongDesc && (
                          <button
                            className="text-primary text-[10px] font-medium mt-0.5 hover:underline"
                            onClick={() => setExpandedSubjectId(isDescExpanded ? null : sid)}
                          >
                            {isDescExpanded ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Teacher â€” always visible */}
                    <div className="flex items-center gap-2 py-2 px-3 bg-muted/40 rounded-lg mt-1">
                      {subject.teacher ? (
                        <>
                          <Avatar className="h-7 w-7 shrink-0">
                            <AvatarImage src={getImageUrl(subject.teacher.imageUrl)} />
                            <AvatarFallback className="text-[10px]">{subject.teacher.firstName?.[0]}{subject.teacher.lastName?.[0]}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{subject.teacher.nameWithInitials || `${subject.teacher.firstName} ${subject.teacher.lastName}`}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{subject.teacher.email}</p>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No teacher assigned</p>
                      )}
                    </div>

                    {/* Action dropdown - three dots menu */}
                    <div className="flex justify-end mt-auto pt-2 border-t">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5">
                            <MoreVertical className="h-3.5 w-3.5" />Actions
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {(isInstituteAdmin || isTeacher) && (
                            <DropdownMenuItem onClick={() => handleOpenEnrollSettings(subject)} className="gap-2">
                              <Settings className="h-4 w-4" />Enrollment Settings
                            </DropdownMenuItem>
                          )}
                          {isInstituteAdmin && <DropdownMenuSeparator />}
                          {isInstituteAdmin && (
                            subject.teacher ? (
                              <DropdownMenuItem
                                onClick={() => handleUnassignTeacher(subject)}
                                disabled={isUnassigningTeacher}
                                className="gap-2 text-destructive focus:text-destructive"
                              >
                                <UserMinus className="h-4 w-4" />Remove Teacher
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => handleAssignTeacher(subject)}
                                disabled={isAssigningTeacher}
                                className="gap-2"
                              >
                                <UserPlus className="h-4 w-4" />Assign Teacher
                              </DropdownMenuItem>
                            )
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Show More / Show Less toggle */}
          {filteredSubjects.length > CARD_INITIAL_SHOW && (
            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllCards(!showAllCards)}
                className="gap-1.5"
              >
                {showAllCards ? (
                  <><ChevronsDownUp className="h-4 w-4" />Show Less ({CARD_INITIAL_SHOW} of {filteredSubjects.length})</>
                ) : (
                  <><ChevronsUpDown className="h-4 w-4" />Show All ({filteredSubjects.length} subjects)</>
                )}
              </Button>
            </div>
          )}
        </>
      ) : (
      <div className="w-full overflow-x-auto">
        <MUITable
          title="Class Subjects"
          data={filteredSubjects}
          columns={subjectsColumns.map(col => ({
            id: col.key,
            label: col.header,
            minWidth: 170,
            format: col.render || col.format
          }))}
          page={pagination.page}
          rowsPerPage={pagination.limit}
          totalCount={pagination.totalCount}
          onPageChange={(newPage: number) => actions.setPage(newPage)}
          onRowsPerPageChange={(newLimit: number) => actions.setLimit(newLimit)}
          sectionType="class-subjects"
        />
      </div>
      )}

      {/* Teacher Selector Dialog */}
      <TeacherSelectorDialog
        isOpen={isTeacherSelectorOpen}
        onClose={() => {
          if (!isAssigningTeacher) {
            setIsTeacherSelectorOpen(false);
            setSelectedSubjectForTeacher(null);
          }
        }}
        onSelect={handleTeacherSelect}
        title="Assign Subject Teacher"
        description="Select a teacher to assign to this subject"
      />

      {/* Unassign Teacher Confirmation Dialog */}
      <AlertDialog open={showUnassignConfirm} onOpenChange={(open) => !isUnassigningTeacher && setShowUnassignConfirm(open)} routeName="unassign-teacher-confirmation-popup">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Teacher Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{subjectToUnassign?.teacher?.nameWithInitials || `${subjectToUnassign?.teacher?.firstName} ${subjectToUnassign?.teacher?.lastName}`}</strong> from teaching <strong>{subjectToUnassign?.name}</strong>?
              <br /><br />
              This will unassign the teacher from this subject but will not delete any related data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUnassigningTeacher}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmUnassignTeacher}
              disabled={isUnassigningTeacher}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUnassigningTeacher ? 'Removing...' : 'Remove Teacher'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)} routeName="subject-image-preview-popup">
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{previewImage?.title}</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            {previewImage && (
              <img 
                src={previewImage.url} 
                alt={previewImage.title}
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Unified Enrollment Settings Dialog — independent key + payment toggles */}
      <Dialog open={enrollSettingsDialog.open} onOpenChange={(open) => !open && setEnrollSettingsDialog(prev => ({ ...prev, open: false }))} routeName="enrollment-settings-popup">
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Settings className="h-5 w-5 text-primary" />
              Enrollment Settings
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{enrollSettingsDialog.subjectName}</p>
          </DialogHeader>

          {enrollSettingsDialog.loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading settings…</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-2">

              {/* Status summary */}
              <div className="text-xs text-muted-foreground px-1">
                {!enrollSettingsDialog.keyEnabled && !enrollSettingsDialog.paymentEnabled
                  ? '⛔ Enrollment is disabled. Enable at least one method below.'
                  : `✅ Enrollment active via: ${[enrollSettingsDialog.keyEnabled && 'Key', enrollSettingsDialog.paymentEnabled && 'Payment'].filter(Boolean).join(' + ')}`}
              </div>

              {/* === KEY ENROLLMENT CARD === */}
              <div className={`rounded-xl border-2 transition-colors ${enrollSettingsDialog.keyEnabled ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/10'}`}>
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${enrollSettingsDialog.keyEnabled ? 'bg-primary/10' : 'bg-muted'}`}>
                      <Key className={`h-5 w-5 ${enrollSettingsDialog.keyEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Key Enrollment</p>
                      <p className="text-xs text-muted-foreground">Students enroll using an enrollment key code</p>
                    </div>
                  </div>
                  <Switch
                    checked={enrollSettingsDialog.keyEnabled}
                    onCheckedChange={(v) => setEnrollSettingsDialog(prev => ({ ...prev, keyEnabled: v }))}
                    className="scale-110"
                  />
                </div>
                {enrollSettingsDialog.keyEnabled && (
                  <div className="px-4 pb-4 space-y-2 border-t pt-3">
                    <Label className="text-xs font-medium text-muted-foreground">
                      ENROLLMENT KEY <span className="font-normal">(leave empty for open/keyless)</span>
                    </Label>
                    <Input
                      value={enrollSettingsDialog.key}
                      onChange={(e) => setEnrollSettingsDialog(prev => ({ ...prev, key: e.target.value.toUpperCase() }))}
                      placeholder="e.g. MATH2026"
                      className="font-mono text-lg tracking-widest h-12 text-center uppercase placeholder:normal-case placeholder:tracking-normal placeholder:text-sm"
                      maxLength={50}
                    />
                    {enrollSettingsDialog.key && (
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mt-1"
                        onClick={() => copyEnrollmentKey(enrollSettingsDialog.key)}
                      >
                        <Copy className="h-3 w-3" />Copy key to clipboard
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* === PAYMENT GATE CARD — Admin only === */}
              {isInstituteAdmin && (
                <div className={`rounded-xl border-2 transition-colors ${enrollSettingsDialog.paymentEnabled ? 'border-green-500/40 bg-green-500/5' : 'border-border bg-muted/10'}`}>
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${enrollSettingsDialog.paymentEnabled ? 'bg-green-500/10' : 'bg-muted'}`}>
                        <CreditCard className={`h-5 w-5 ${enrollSettingsDialog.paymentEnabled ? 'text-green-600' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm flex items-center gap-1.5">
                          Payment Gate
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500 text-amber-600">Admin Only</Badge>
                        </p>
                        <p className="text-xs text-muted-foreground">Enroll students who have paid a specific payment</p>
                      </div>
                    </div>
                    <Switch
                      checked={enrollSettingsDialog.paymentEnabled}
                      onCheckedChange={(v) => setEnrollSettingsDialog(prev => ({ ...prev, paymentEnabled: v }))}
                      className="scale-110"
                    />
                  </div>
                  {enrollSettingsDialog.paymentEnabled && (
                    <div className="px-4 pb-4 space-y-3 border-t pt-3">
                      {enrollSettingsDialog.classPayments.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No payments found for this class. Create a payment first.</p>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <Label className="text-xs font-medium text-muted-foreground">SELECT PAYMENT</Label>
                            <Select
                              value={enrollSettingsDialog.paymentRefId || '__none'}
                              onValueChange={(v) => setEnrollSettingsDialog(prev => ({ ...prev, paymentRefId: v === '__none' ? '' : v }))}
                            >
                              <SelectTrigger className="h-10 text-sm">
                                <SelectValue placeholder="Select payment…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none">No payment gate</SelectItem>
                                {enrollSettingsDialog.classPayments.map(p => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.title} · Rs {Number(p.amount).toLocaleString()}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {enrollSettingsDialog.paymentRefId && (
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium text-muted-foreground">ACCEPTED PAYMENT TIERS</Label>
                              <div className="flex flex-wrap gap-3 mt-1">
                                {PAYMENT_STATUS_OPTIONS.map(opt => (
                                  <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer text-sm">
                                    <Checkbox
                                      checked={enrollSettingsDialog.allowedStatuses.includes(opt.value)}
                                      onCheckedChange={() => {
                                        const cur = enrollSettingsDialog.allowedStatuses;
                                        setEnrollSettingsDialog(prev => ({
                                          ...prev,
                                          allowedStatuses: cur.includes(opt.value) ? cur.filter(s => s !== opt.value) : [...cur, opt.value]
                                        }));
                                      }}
                                    />
                                    {opt.label}
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!enrollSettingsDialog.loading && (
            <div className="shrink-0 flex gap-3 pt-4 border-t bg-background">
              <Button variant="outline" className="flex-1 h-11" onClick={() => setEnrollSettingsDialog(prev => ({ ...prev, open: false }))} disabled={enrollSettingsDialog.saving}>Cancel</Button>
              <Button onClick={handleSaveEnrollSettings} disabled={enrollSettingsDialog.saving} className="flex-1 h-11 font-semibold">
                {enrollSettingsDialog.saving ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Saving…</> : <><Settings className="h-4 w-4 mr-2" />Save Settings</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Subject to Class Dialog */}
      <Dialog open={isAssignSubjectDialogOpen} onOpenChange={setIsAssignSubjectDialogOpen} routeName="assign-subject-to-class-popup">
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Assign Subject to Class
            </DialogTitle>
          </DialogHeader>
          <AssignSubjectToClassForm
            preselectedClassId={currentClassId || undefined}
            onSuccess={() => { setIsAssignSubjectDialogOpen(false); actions.refresh(); }}
            onCancel={() => setIsAssignSubjectDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClassSubjects;
