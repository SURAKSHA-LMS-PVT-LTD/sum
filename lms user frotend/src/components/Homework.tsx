import React, { useState, useEffect, useMemo } from 'react';
import { useResizableColumns, ResizeHandle } from '@/hooks/useResizableColumns';
import { useColumnConfig, type ColumnDef } from '@/hooks/useColumnConfig';
import ColumnConfigurator from '@/components/ui/column-configurator';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { usePermission } from '@/hooks/usePermission';
import { useRefreshWithCooldown } from '@/hooks/useRefreshWithCooldown';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, Filter, Plus, Calendar, Clock, BookOpen, FileText, Upload, ExternalLink, BarChart3, Eye, Edit, Pencil, Trash2, Users, CheckCircle, AlertCircle, MessageSquare, Download, ChevronDown, ChevronUp, LayoutGrid, Table2 } from 'lucide-react';
import Paper from '@mui/material/Paper';
import MuiTable from '@mui/material/Table';
import MuiTableBody from '@mui/material/TableBody';
import MuiTableCell from '@mui/material/TableCell';
import MuiTableContainer from '@mui/material/TableContainer';
import MuiTableHead from '@mui/material/TableHead';
import MuiTablePagination from '@mui/material/TablePagination';
import MuiTableRow from '@mui/material/TableRow';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { AccessControl } from '@/utils/permissions';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import CreateHomeworkForm from '@/components/forms/CreateHomeworkForm';
import UpdateHomeworkForm from '@/components/forms/UpdateHomeworkForm';
import SubmitHomeworkForm from '@/components/forms/SubmitHomeworkForm';
import HomeworkDetailsDialog from '@/components/forms/HomeworkDetailsDialog';
import HomeworkReferenceList from '@/components/homework/HomeworkReferenceList';
import { useNavigate } from 'react-router-dom';
import { homeworkApi } from '@/api/homework.api';
import { buildSidebarUrl } from '@/utils/pageNavigation';
import { cn } from '@/lib/utils';
import { CustomToggle } from '@/components/ui/custom-toggle';
import DeleteConfirmDialog from '@/components/forms/DeleteConfirmDialog';
import { useViewMode } from '@/hooks/useViewMode';
import { EmptyState } from '@/components/ui/EmptyState';

interface HomeworkProps {
  apiLevel?: 'institute' | 'class' | 'subject';
}

const Homework = ({ apiLevel = 'institute' }: HomeworkProps) => {
  const navigate = useNavigate();
  const { user, selectedInstitute, selectedClass, selectedSubject, currentInstituteId, currentClassId, currentSubjectId, isViewingAsParent, selectedChild } = useAuth();
  const instituteRole = useInstituteRole();
  const { toast } = useToast();
  const { refresh, isRefreshing, canRefresh, cooldownRemaining } = useRefreshWithCooldown(10);
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editHomeworkData, setEditHomeworkData] = useState<any>(null);
  
  const [selectedHomeworkData, setSelectedHomeworkData] = useState<any>(null);
  const [homeworkData, setHomeworkData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: any }>({ open: false, item: null });
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination states
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const { viewMode } = useViewMode();
  const [pageViewMode, setPageViewMode] = useState<'card' | 'table'>(viewMode);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Track current context to prevent unnecessary reloads
  const contextKey = `${currentInstituteId}-${currentClassId}-${currentSubjectId}`;
  const [lastLoadedContext, setLastLoadedContext] = useState<string>('');

  // Auto-load homework when subject is selected
  useEffect(() => {
    if (currentInstituteId && currentClassId && currentSubjectId && contextKey !== lastLoadedContext) {
      setLastLoadedContext(contextKey);
      handleLoadData(false); // Auto-load from cache
    }
  }, [contextKey]);

  const buildQueryParams = () => {
    const userRole = instituteRole;
    // When parent is viewing as child, use the child's student ID
    const effectiveUserId = isViewingAsParent && selectedChild ? selectedChild.id : user?.id;
    const params: Record<string, any> = {
      page: page + 1, // MUI pagination is 0-based, API is 1-based
      limit: rowsPerPage,
      userId: effectiveUserId,
      role: userRole
    };
    // Pass studentId directly in query params so backend can load child's submissions
    if (isViewingAsParent && selectedChild) {
      params.studentId = selectedChild.id;
    }

    // Add context-aware filtering
    if (currentInstituteId) {
      params.instituteId = currentInstituteId;
    }

    if (currentClassId) {
      params.classId = currentClassId;
    }

    if (currentSubjectId) {
      params.subjectId = currentSubjectId;
    }

    // For Teachers, add teacherId parameter
    if (userRole === 'Teacher' && user?.id) {
      params.teacherId = user.id;
    }

    // For students, include submissions and references in one call
    if (userRole === 'Student') {
      params.includeSubmissions = true;
      params.includeReferences = true;
    } else if (userRole === 'InstituteAdmin' || userRole === 'Teacher') {
      params.includeReferences = true;
    }

    // Add filter parameters
    if (searchTerm.trim()) {
      params.search = searchTerm.trim();
    }

    if (statusFilter !== 'all') {
      params.status = statusFilter;
    }

    return params;
  };

  const handleLoadData = async (forceRefresh = false) => {
    const userRole = instituteRole;
    const params = buildQueryParams();
    
    if (userRole === 'Student') {
      // For students: require all context
      if (!currentInstituteId || !currentClassId || !currentSubjectId) {
        toast({
          title: "Missing Selection",
          description: "Please select institute, class, and subject to view homework.",
          variant: "destructive"
        });
        return;
      }
    } else if (userRole === 'InstituteAdmin' || userRole === 'Teacher') {
      // For InstituteAdmin and Teacher: require context
      if (!currentInstituteId || !currentClassId || !currentSubjectId) {
        toast({
          title: "Missing Selection",
          description: "Please select institute, class, and subject to view homework.",
          variant: "destructive"
        });
        return;
      }
    }

    setIsLoading(true);
    console.log(`📚 Loading homework with secure caching - Role: ${userRole}`, { forceRefresh, context: params });
    console.log(`Current context - Institute: ${selectedInstitute?.name}, Class: ${selectedClass?.name}, Subject: ${selectedSubject?.name}`);
    
    try {
      // Use enhanced homework API with automatic caching
      const result = await homeworkApi.getHomework(params, forceRefresh);

      console.log('✅ Homework loaded successfully:', result);
      
      // Handle both array response and paginated response
      const homework = Array.isArray(result) ? result : (result as any)?.data || [];
      const total = Array.isArray(result) ? result.length : (result as any)?.meta?.total || homework.length;
      
      setHomeworkData(homework);
      setTotalCount(total);
      setDataLoaded(true);
      setLastRefresh(new Date());
      
      if (forceRefresh) {
        toast({
          title: "Data Refreshed",
          description: `Successfully refreshed ${homework.length} homework assignments.`
        });
      }
    } catch (error: any) {
      console.error('❌ Failed to load homework:', error);
      toast({
        title: "Load Failed",
        description: "Failed to load homework data.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshData = async () => {
    console.log('Force refreshing homework data...');
    await refresh(async () => {
      await handleLoadData(true);
    }, {
      successMessage: 'Homework data refreshed successfully'
    });
  };

  const handleCreateHomework = async () => {
    setIsCreateDialogOpen(false);
    // Force refresh after creating new homework
    await handleLoadData(true);
  };

  const handleEditHomework = (hw: any) => {
    setEditHomeworkData(hw);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = async () => {
    setIsEditDialogOpen(false);
    setEditHomeworkData(null);
    await handleLoadData(true);
  };

  const handleDeleteHomework = (homeworkData: any) => {
    setDeleteDialog({ open: true, item: homeworkData });
  };
  const confirmDeleteHomework = async () => {
    if (!deleteDialog.item) return;
    setIsDeleting(true);
    try {
      await homeworkApi.deleteHomework(deleteDialog.item.id, {
        instituteId: currentInstituteId,
        classId: currentClassId,
        subjectId: currentSubjectId
      });
      toast({ title: "Homework Deleted", description: `Homework ${deleteDialog.item.title} has been deleted successfully.` });
      setDeleteDialog({ open: false, item: null });
      await handleLoadData(true);
    } catch (error: any) {
      toast({ title: "Delete Failed", description: "Failed to delete homework. Please try again.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewHomework = (homeworkData: any) => {
    console.log('View homework:', homeworkData);
    setSelectedHomeworkData(homeworkData);
    setIsViewDialogOpen(true);
  };

  const handleSubmitHomework = (homeworkData: any) => {
    console.log('Submit homework:', homeworkData);
    setSelectedHomeworkData(homeworkData);
    setIsSubmitDialogOpen(true);
  };

  const handleViewSubmissions = (homeworkData: any) => {
    console.log('View homework submissions:', homeworkData);
    
    // 🛡️ SECURE: Use full hierarchical URL
    if (!currentInstituteId || !currentClassId || !currentSubjectId) {
      toast({
        title: "Missing Context",
        description: "Please select institute, class, and subject first",
        variant: "destructive"
      });
      return;
    }
    
    navigate(`/institute/${currentInstituteId}/class/${currentClassId}/subject/${currentSubjectId}/homework/${homeworkData.id}/submissions`);
  };

  const handleSubmissionSuccess = async () => {
    setIsSubmitDialogOpen(false);
    setSelectedHomeworkData(null);
    toast({
      title: "Submission Successful",
      description: "Your homework has been submitted successfully!"
    });
    // Force refresh after successful submission
    await handleLoadData(true);
  };

  const { hasCustomType, canCreate: rbacCanCreate, canUpdate: rbacCanUpdate, canDelete: rbacCanDelete, canSubmit: rbacCanSubmit } = usePermission('homework');
  const canAdd = hasCustomType ? rbacCanCreate : AccessControl.hasPermission(instituteRole, 'create-homework');
  const canEdit = hasCustomType ? rbacCanUpdate : (instituteRole === 'Teacher' ? true : AccessControl.hasPermission(instituteRole, 'edit-homework'));
  const canDelete = hasCustomType ? rbacCanDelete : (instituteRole === 'Teacher' ? true : AccessControl.hasPermission(instituteRole, 'delete-homework'));
  const isStudent = hasCustomType ? rbacCanSubmit : instituteRole === 'Student';
  const canViewSubmissions = hasCustomType ? (rbacCanCreate || rbacCanUpdate) : (instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const getTitle = () => {
    const contexts = [];
    if (selectedInstitute) contexts.push(selectedInstitute.name);
    if (selectedClass) contexts.push(selectedClass.name);
    if (selectedSubject) contexts.push(selectedSubject.name);
    let title = 'Homework';
    if (contexts.length > 0) title += ` (${contexts.join(' → ')})`;
    return title;
  };

  const filteredHomework = homeworkData.filter(homework => {
    const matchesSearch = !searchTerm || 
      Object.values(homework).some(value => 
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      );
    const isActive = homework.isActive !== undefined ? homework.isActive : true;
    // Students should only see active homework
    if (isStudent && !isActive) return false;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && isActive) ||
      (statusFilter === 'inactive' && !isActive);
    return matchesSearch && matchesStatus;
  });

  const getSubmissionStatus = (hw: any) => {
    const submissions = hw.mySubmissions || [];
    if (submissions.length === 0) return 'not_submitted';
    const latest = submissions[0];
    if (latest.isCorrected || latest.teacherCorrectionFileUrl || latest.remarks) return 'corrected';
    return 'submitted';
  };

  const { getWidth: getHWColWidth, totalWidth: totalHWTableWidth, setHoveredCol: setHWHoveredCol, hoveredCol: HWHoveredCol, activeCol: HWActiveCol, startResize: HWStartResize } = useResizableColumns(
    ['title', 'startDate', 'dueDate', 'teacher', 'status', 'active', 'references', 'submissions', '_view', '_edit', 'actions'],
    { title: 200, startDate: 130, dueDate: 130, teacher: 140, status: 120, active: 100, references: 180, submissions: 140, _view: 90, _edit: 90, actions: 110 }
  );

  const hwColDefs = useMemo<ColumnDef[]>(() => [
    { key: 'title', header: 'Title', locked: true, defaultWidth: 200, minWidth: 120 },
    { key: 'startDate', header: 'Start Date', defaultVisible: true, defaultWidth: 130, minWidth: 80 },
    { key: 'dueDate', header: 'Due Date', defaultVisible: true, defaultWidth: 130, minWidth: 80 },
    { key: 'teacher', header: 'Teacher', defaultVisible: true, defaultWidth: 140, minWidth: 80 },
    ...(isStudent ? [{ key: 'status', header: 'Status', defaultVisible: true, defaultWidth: 120, minWidth: 80 } as ColumnDef] : []),
    { key: 'active', header: 'Active', defaultVisible: true, defaultWidth: 100, minWidth: 60 },
    { key: 'references', header: 'References', defaultVisible: true, defaultWidth: 180, minWidth: 100 },
    ...(canViewSubmissions ? [{ key: 'submissions', header: 'Submissions', defaultVisible: true, defaultWidth: 140, minWidth: 80 } as ColumnDef] : []),
    { key: '_view', header: 'View', defaultVisible: true, defaultWidth: 90, minWidth: 60 },
    ...(isStudent ? [{ key: '_edit', header: 'Submit', defaultVisible: true, defaultWidth: 90, minWidth: 60 } as ColumnDef] : []),
    ...((canEdit || canDelete) ? [{ key: 'actions', header: 'Actions', defaultVisible: true, defaultWidth: 110, minWidth: 80, locked: true } as ColumnDef] : []),
  ], [isStudent, canViewSubmissions, canEdit, canDelete]);

  const { colState: hwColState, visibleColumns: visHWDefs, toggleColumn: toggleHWCol, resetColumns: resetHWCols } = useColumnConfig(hwColDefs, 'homework');

  const renderHWCell = (colKey: string, hw: any): React.ReactNode => {
    switch (colKey) {
      case 'title':
        return <span style={{ fontWeight: 500 }}>{hw.title}</span>;
      case 'startDate':
        return hw.startDate ? new Date(hw.startDate).toLocaleDateString() : '-';
      case 'dueDate':
        return hw.endDate ? new Date(hw.endDate).toLocaleDateString() : '-';
      case 'teacher':
        return hw.teacher?.name || '-';
      case 'status': {
        const s = getSubmissionStatus(hw);
        return (
          <>
            {s === 'not_submitted' && <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-xs">Pending</Badge>}
            {s === 'submitted' && <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950/30 text-xs">Submitted</Badge>}
            {s === 'corrected' && <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30 text-xs">Corrected</Badge>}
          </>
        );
      }
      case 'active':
        return <Badge variant={hw.isActive ? 'default' : 'secondary'} className="text-xs">{hw.isActive ? 'Active' : 'Inactive'}</Badge>;
      case 'references': {
        const refs = hw.references && hw.references.length > 0 ? hw.references : null;
        const hasAny = refs || hw.referenceLink;
        if (!hasAny) return <span className="text-sm text-muted-foreground">—</span>;
        const count = refs ? refs.length : 1;
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="destructive" className="h-8 px-3 text-xs">
                <FileText className="h-3 w-3 mr-1" />
                References {count > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{count}</Badge>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <p className="text-sm font-semibold text-muted-foreground mb-2 px-1">References</p>
              <div className="flex flex-col gap-1">
                {refs ? refs.map((ref: any) => {
                  const url = ref.viewUrl || ref.driveViewUrl || ref.externalUrl || ref.fileUrl;
                  return url ? (
                    <Button key={ref.id} size="sm" variant="outline" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')} className="h-7 px-2 text-xs w-full justify-start">
                      <ExternalLink className="h-3 w-3 shrink-0 mr-1" />
                      <span className="truncate">{ref.title || 'Open Link'}</span>
                    </Button>
                  ) : (
                    <span key={ref.id} className="text-[13px] text-muted-foreground px-1">{ref.title}</span>
                  );
                }) : (
                  <Button size="sm" variant="outline" onClick={() => window.open(hw.referenceLink, '_blank', 'noopener,noreferrer')} className="h-7 px-2 text-xs w-full justify-start">
                    <ExternalLink className="h-3 w-3 shrink-0 mr-1" />
                    <span>Reference Link</span>
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        );
      }
      case 'submissions':
        return (
          <Button size="sm" variant="outline" onClick={() => handleViewSubmissions(hw)} title="View Submissions" className="h-8 px-2 text-xs max-w-full">
            <Users className="h-3 w-3 shrink-0" />
            <span className="ml-1 truncate">Submissions</span>
          </Button>
        );
      case '_view':
        return (
          <Button size="sm" variant="outline" onClick={() => handleViewHomework(hw)} title="View" className="h-8 px-3 text-xs">
            <Eye className="h-3 w-3 mr-1" />View
          </Button>
        );
      case '_edit':
        if (isStudent) {
          return (
            <Button size="sm" variant="ghost" onClick={() => handleSubmitHomework(hw)} title="Submit" className="h-8 px-3 text-xs">
              <Upload className="h-3 w-3 mr-1" />Submit
            </Button>
          );
        }
        return null;
      case 'actions':
        return (
          <div className="flex items-center justify-center gap-1">
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => handleEditHomework(hw)} title="Edit" className="h-8 w-8 p-0">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button size="sm" variant="destructive" onClick={() => handleDeleteHomework(hw)} title="Delete" className="h-8 w-8 p-0">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  // Payment gate: If student (or custom submit-role user) hasn't paid, block access to homework
  if (isStudent && selectedSubject?.verificationStatus &&
      !['verified', 'enrolled_free_card'].includes(selectedSubject.verificationStatus)) {
    const statusLabels: Record<string, { label: string; color: string; desc: string }> = {
      pending_payment: { label: 'Payment Required', color: 'text-orange-600', desc: 'You need to submit payment to access homework. Please go to Fees & Payments to submit your payment.' },
      pending: { label: 'Payment Under Review', color: 'text-amber-600', desc: 'Your payment has been submitted and is awaiting admin approval. You can access Free Lectures in the meantime.' },
      payment_rejected: { label: 'Payment Rejected', color: 'text-red-600', desc: 'Your payment was rejected. Please resubmit a valid payment to access homework.' },
      rejected: { label: 'Enrollment Rejected', color: 'text-red-600', desc: 'Your enrollment was rejected. Please contact your institute admin.' },
      not_enrolled: { label: 'Not Enrolled', color: 'text-muted-foreground', desc: 'You are not enrolled in this subject. Please enroll first.' },
    };
    const info = statusLabels[selectedSubject.verificationStatus] || statusLabels['not_enrolled'];
    return (
      <div className="container mx-auto px-3 py-8 sm:p-6">
        <div className="max-w-md mx-auto text-center space-y-4">
          <div className="h-16 w-16 mx-auto rounded-full bg-muted flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Homework Locked</h2>
          <p className={`text-sm font-medium ${info.color}`}>{info.label}</p>
          <p className="text-sm text-muted-foreground">{info.desc}</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>← Go Back</Button>
            <Button size="sm" onClick={() => navigate(buildSidebarUrl('free-lectures', { instituteId: currentInstituteId, classId: currentClassId, subjectId: currentSubjectId }))}>
              View Free Lectures
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 sm:p-6 space-y-4 sm:space-y-6">
      {!dataLoaded ? (
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">{getTitle()}</h2>
          <p className="text-muted-foreground mb-6">
            {isStudent && (!currentInstituteId || !currentClassId || !currentSubjectId)
              ? 'Please select institute, class, and subject to view homework.'
              : 'Click the button below to load homework data'}
          </p>
          <Button
            onClick={() => handleLoadData(false)}
            disabled={isLoading || (isStudent && (!currentInstituteId || !currentClassId || !currentSubjectId))}
          >
            {isLoading ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Loading Data...</>
            ) : (
              <><RefreshCw className="h-4 w-4 mr-2" /> Load Data</>
            )}
          </Button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold">{getTitle()}</h1>
              {lastRefresh && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Last refreshed: {lastRefresh.toLocaleTimeString()}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="h-4 w-4 mr-1" /> Filters
              </Button>
              <Button 
                onClick={handleRefreshData} 
                disabled={isLoading || isRefreshing || !canRefresh}
                variant="outline"
                size="sm"
                title={!canRefresh ? `Please wait ${cooldownRemaining} seconds` : 'Refresh data'}
              >
                {isLoading || isRefreshing ? (
                  <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Refreshing...</>
                ) : !canRefresh ? (
                  <><RefreshCw className="h-4 w-4 mr-1" /> Wait ({cooldownRemaining}s)</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-1" /> Refresh</>
                )}
              </Button>
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <button onClick={() => setPageViewMode('card')} className={`p-1.5 transition-colors ${pageViewMode === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`} title="Card view"><LayoutGrid className="h-4 w-4" /></button>
                <button onClick={() => setPageViewMode('table')} className={`p-1.5 transition-colors ${pageViewMode === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`} title="Table view"><Table2 className="h-4 w-4" /></button>
              </div>
              {pageViewMode === 'table' && (
                <ColumnConfigurator allColumns={hwColDefs} colState={hwColState} onToggle={toggleHWCol} onReset={resetHWCols} />
              )}
            </div>
          </div>

          {/* Filter Controls */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-xl border">
              <div>
                <label className="text-sm font-medium mb-1 block">Search Homework</label>
                <Input placeholder="Search homework..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              {!isStudent && (
              <div>
                <label className="text-sm font-medium mb-1 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              )}
              <div className="flex items-end col-span-1 sm:col-span-2">
                <Button variant="outline" onClick={() => { setSearchTerm(''); setStatusFilter('all'); }} className="w-full">
                  Clear Filters
                </Button>
              </div>
            </div>
          )}

          {/* Create Button */}
          {canAdd && (
            <div className="flex justify-end">
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Create Homework
              </Button>
            </div>
          )}

          {/* Homework List */}
          {filteredHomework.length === 0 ? (
            <EmptyState icon={BookOpen} title="No Homework Found" description="No homework assignments match your criteria." />
          ) : pageViewMode === 'table' ? (
            <Paper sx={{ width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 96px)' }}>
              <MuiTableContainer sx={{ flex: 1, overflow: 'auto' }}>
                <MuiTable stickyHeader aria-label="homework table" sx={{ tableLayout: 'fixed', minWidth: visHWDefs.reduce((sum, col) => sum + getHWColWidth(col.key), 0) }}>
                  <MuiTableHead>
                    <MuiTableRow>
                      {visHWDefs.map((col) => (
                        <MuiTableCell
                          key={col.key}
                          align={col.key === 'actions' || col.key === 'submissions' ? 'center' : undefined}
                          onMouseEnter={() => setHWHoveredCol(col.key)}
                          onMouseLeave={() => setHWHoveredCol(null)}
                          style={{ position: 'relative', width: getHWColWidth(col.key), userSelect: 'none' }}
                          sx={{ fontWeight: 'bold', backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', borderBottom: '1px solid hsl(var(--border))' }}
                        >
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.header}</div>
                          <ResizeHandle colId={col.key} hoveredCol={HWHoveredCol} activeCol={HWActiveCol} onMouseDown={HWStartResize} />
                        </MuiTableCell>
                      ))}
                    </MuiTableRow>
                  </MuiTableHead>
                  <MuiTableBody>
                    {filteredHomework
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((hw) => {
                      return (
                        <MuiTableRow hover key={hw.id}>
                          {visHWDefs.map(col => (
                            <MuiTableCell
                              key={col.key}
                              align={col.key === 'submissions' || col.key === '_view' || col.key === '_edit' || col.key === 'actions' ? 'center' : undefined}
                              style={{ width: getHWColWidth(col.key), maxWidth: getHWColWidth(col.key), overflow: 'hidden' }}
                            >
                              {renderHWCell(col.key, hw)}
                            </MuiTableCell>
                          ))}
                        </MuiTableRow>
                      );
                    })}
                    {filteredHomework.length === 0 && (
                      <MuiTableRow>
                        <MuiTableCell colSpan={visHWDefs.length} align="center">
                          <div className="py-8 text-muted-foreground text-sm">No records found</div>
                        </MuiTableCell>
                      </MuiTableRow>
                    )}
                  </MuiTableBody>
                </MuiTable>
              </MuiTableContainer>
              <MuiTablePagination
                rowsPerPageOptions={[25, 50, 100]}
                component="div"
                count={filteredHomework.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                sx={{ flexShrink: 0, borderTop: '1px solid hsl(var(--border))' }}
              />
            </Paper>
          ) : (
            <div className="space-y-2">
              {filteredHomework.map((hw) => {
                const isExpanded = expandedId === hw.id;
                const status = isStudent ? getSubmissionStatus(hw) : null;
                
                return (
                  <Card 
                    key={hw.id} 
                    className={cn(
                      "rounded-xl border transition-all duration-200 overflow-hidden",
                      isExpanded && "ring-1 ring-primary/20 shadow-md"
                    )}
                  >
                    <div
                      onClick={() => toggleExpand(hw.id)}
                      className="cursor-pointer w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                          <BookOpen className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm sm:text-base truncate">{hw.title}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            {hw.endDate && (
                              <span className="text-[13px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                Due: {new Date(hw.endDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {isStudent && (
                          status === 'not_submitted' ? (
                            <Button
                              size="sm"
                              className="h-7 text-xs px-2.5"
                              onClick={(e) => { e.stopPropagation(); handleSubmitHomework(hw); }}
                            >
                              <Upload className="h-3 w-3 mr-1" />Submit
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs px-2.5 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700"
                              onClick={(e) => { e.stopPropagation(); handleSubmitHomework(hw); }}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {status === 'corrected' ? 'Corrected' : 'Submitted'}
                            </Button>
                          )
                        )}
                        {canViewSubmissions && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2.5"
                            onClick={(e) => { e.stopPropagation(); handleViewSubmissions(hw); }}
                          >
                            <Users className="h-3 w-3 mr-1" />Submissions
                          </Button>
                        )}
                        {!hw.isActive && (
                          <Badge variant="secondary" className="text-xs hidden sm:flex">Inactive</Badge>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <CardContent className="px-4 pb-5 pt-0 space-y-4 border-t">
                        {hw.description && (
                          <p className="text-sm text-muted-foreground leading-relaxed pt-3">{hw.description}</p>
                        )}

                        {/* Dates & Info */}
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Details <span className="flex-1 h-px bg-border/40" /></p>
                          <div className="divide-y divide-border/40">
                            {hw.startDate && (
                              <div className="flex items-center justify-between py-3.5">
                                <span className="text-[13px] text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" />Start Date</span>
                                <span className="text-sm font-medium">{new Date(hw.startDate).toLocaleDateString()}</span>
                              </div>
                            )}
                            {hw.endDate && (
                              <div className="flex items-center justify-between py-3.5">
                                <span className="text-[13px] text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" />Due Date</span>
                                <span className="text-sm font-semibold">{new Date(hw.endDate).toLocaleDateString()}</span>
                              </div>
                            )}
                            {hw.teacher && (
                              <div className="flex items-center justify-between py-3.5">
                                <span className="text-sm text-muted-foreground">Teacher</span>
                                <span className="text-sm font-medium">{hw.teacher.name || 'N/A'}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* My Submission (Student) */}
                        {isStudent && (hw.mySubmissions || []).length > 0 && (() => {
                          const latest = hw.mySubmissions[0];
                          return (
                            <div className="space-y-2">
                              <p className="text-sm font-semibold text-muted-foreground">My Submission</p>
                              <div className="p-3 rounded-xl bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-800 space-y-2">
                                <div className="flex flex-wrap gap-2">
                                  {(latest.fileUrl || latest.driveViewUrl) && (
                                    <Button size="sm" variant="outline" className="text-xs h-7 border-green-500 text-green-700 hover:bg-green-100 dark:text-green-400 dark:border-green-700" onClick={() => window.open(latest.fileUrl || latest.driveViewUrl, '_blank')}>
                                      <Eye className="h-3 w-3 mr-1" />My File
                                    </Button>
                                  )}
                                  {latest.teacherCorrectionFileUrl && (
                                    <Button size="sm" variant="outline" className="text-xs h-7 border-red-400 text-red-700 hover:bg-red-50 dark:text-red-400 dark:border-red-700" onClick={() => window.open(latest.teacherCorrectionFileUrl, '_blank')}>
                                      <Download className="h-3 w-3 mr-1" />Correction
                                    </Button>
                                  )}
                                </div>
                                {latest.remarks && (
                                  <p className="text-[13px] text-muted-foreground flex items-start gap-1">
                                    <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />{latest.remarks}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* References */}
                        {((hw.references && hw.references.length > 0) || hw.referenceLink) && (
                          <div className="space-y-2">
                            <p className="text-sm font-semibold text-muted-foreground">References</p>
                            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
                              {hw.references && hw.references.length > 0 ? (
                                <HomeworkReferenceList references={hw.references} />
                              ) : (
                                <Button size="sm" variant="outline" className="border-blue-500 text-blue-700 hover:bg-blue-100 dark:text-blue-400 dark:border-blue-700" onClick={() => window.open(hw.referenceLink, '_blank', 'noopener,noreferrer')}>
                                  <ExternalLink className="h-3 w-3 mr-1" />Reference Link
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                          <Button size="sm" variant="outline" onClick={() => handleViewHomework(hw)}>
                            <Eye className="h-3 w-3 mr-1" />Details
                          </Button>
                          {(canEdit || canDelete) && (
                            <>
                              {canEdit && (
                                <Button size="sm" variant="outline" onClick={() => handleEditHomework(hw)}>
                                  <Edit className="h-3 w-3 mr-1" />Edit
                                </Button>
                              )}
                              {canDelete && (
                                <Button size="sm" variant="destructive" onClick={() => handleDeleteHomework(hw)}>
                                  Delete
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { if (!open) { setIsEditDialogOpen(false); setEditHomeworkData(null); } }} routeName="edit-homework-popup">
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Homework</DialogTitle>
          </DialogHeader>
          {editHomeworkData && (
            <UpdateHomeworkForm
              homework={editHomeworkData}
              onSuccess={handleEditSuccess}
              onClose={() => { setIsEditDialogOpen(false); setEditHomeworkData(null); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} routeName="create-homework-popup">
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Homework</DialogTitle>
          </DialogHeader>
          <CreateHomeworkForm 
            onSuccess={handleCreateHomework}
            onClose={() => setIsCreateDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Submit Dialog */}
      <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen} routeName="submit-homework-popup">
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit Homework</DialogTitle>
          </DialogHeader>
          {selectedHomeworkData && (
            <SubmitHomeworkForm 
              homework={selectedHomeworkData}
              onSuccess={handleSubmissionSuccess}
              onClose={() => setIsSubmitDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Homework Details Dialog */}
      <HomeworkDetailsDialog
        isOpen={isViewDialogOpen}
        onClose={() => {
          setIsViewDialogOpen(false);
          setSelectedHomeworkData(null);
        }}
        homework={selectedHomeworkData}
      />

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        itemName={deleteDialog.item?.title || ''}
        itemType="homework"
        onConfirm={confirmDeleteHomework}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default Homework;
