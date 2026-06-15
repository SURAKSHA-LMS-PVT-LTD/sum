import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import MUITable from '@/components/ui/mui-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomToggle } from '@/components/ui/custom-toggle';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Filter, Plus, Calendar, Clock, FileText, CheckCircle, ExternalLink, BarChart3, Eye, ChevronDown, LayoutList, LayoutGrid, Table2, Award, Edit, Trash2 } from 'lucide-react';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { buildSidebarUrl } from '@/utils/pageNavigation';
import { AccessControl } from '@/utils/permissions';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import CreateExamForm from '@/components/forms/CreateExamForm';
import { UpdateExamForm } from '@/components/forms/UpdateExamForm';
import CreateResultsForm from '@/components/forms/CreateResultsForm';
import { DataCardView } from '@/components/ui/data-card-view';
import { useViewMode } from '@/hooks/useViewMode';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/PageState';
import { usePermission } from '@/hooks/usePermission';
import { useTableData } from '@/hooks/useTableData';
import { cachedApiClient } from '@/api/cachedClient';
import DeleteConfirmDialog from '@/components/forms/DeleteConfirmDialog';
interface ExamsProps {
  apiLevel?: 'institute' | 'class' | 'subject';
}
const Exams = ({
  apiLevel = 'institute'
}: ExamsProps) => {
  const navigate = useNavigate();
  const {
    user,
    selectedInstitute,
    selectedClass,
    selectedSubject,
    currentInstituteId,
    currentClassId,
    currentSubjectId
  } = useAuth();
  const {
    toast
  } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isCreateResultsDialogOpen, setIsCreateResultsDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const { viewMode } = useViewMode();
  const [pageViewMode, setPageViewMode] = useState<'card' | 'table'>(viewMode);
  const [expandedExam, setExpandedExam] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: any }>({ open: false, item: null });
  const [isDeleting, setIsDeleting] = useState(false);
  const userRole = useInstituteRole();

  // Memoize default params to prevent unnecessary re-renders
  const defaultParams = useMemo(() => {
    const params: Record<string, any> = {};

    if (currentInstituteId) {
      params.instituteId = currentInstituteId;
    }
    if (currentClassId) {
      params.classId = currentClassId;
    }
    if (currentSubjectId) {
      params.subjectId = currentSubjectId;
    }

    if (userRole === 'Teacher' && user?.id) {
      params.teacherId = user.id;
    }
    return params;
  }, [currentInstituteId, currentClassId, currentSubjectId, userRole, user?.id]);

  // Enhanced pagination with useTableData hook
  const {
    state: {
      data: examsData,
      loading: isLoading,
      error: dataError,
    },
    pagination,
    actions: {
      refresh,
      updateFilters,
      setPage,
      setLimit
    },
    filters
  } = useTableData({
    endpoint: '/institute-class-subject-exams',
    defaultParams,
    dependencies: [currentInstituteId, currentClassId, currentSubjectId], // Auto-reload on context changes
    pagination: {
      defaultLimit: 50,
      availableLimits: [25, 50, 100]
    },
    autoLoad: true // Enable auto-loading from cache
  });

  // Track if we've attempted to load data at least once - auto-load when context is ready
  const [hasAttemptedLoad, setHasAttemptedLoad] = React.useState(false);

  // Auto-load when context is ready
  React.useEffect(() => {
    if (currentInstituteId && currentClassId && currentSubjectId && !hasAttemptedLoad) {
      setHasAttemptedLoad(true);
      refresh();
    }
  }, [currentInstituteId, currentClassId, currentSubjectId]);

  const handleLoadData = async (forceRefresh = false) => {
    // For students: require all context selections
    if (userRole === 'Student') {
      if (!currentInstituteId || !currentClassId || !currentSubjectId) {
        toast({
          title: "Missing Selection",
          description: "Please select institute, class, and subject to view exams.",
          variant: "destructive"
        });
        return;
      }
    }

    // For InstituteAdmin and Teacher: require at least institute selection
    if (userRole === 'InstituteAdmin' || userRole === 'Teacher') {
      if (!currentInstituteId) {
        toast({
          title: "Selection Required",
          description: "Please select an institute to view exams.",
          variant: "destructive"
        });
        return;
      }
    }
    setHasAttemptedLoad(true);
    
    // Update filters and load data
    updateFilters(defaultParams);    // Trigger data loading using the actions from useTableData
    refresh();
  };
  const handleRefreshData = async () => {
    console.log('Force refreshing exams data...');
    refresh();
    setLastRefresh(new Date());
  };
  const handleCreateExam = async () => {
    setIsCreateDialogOpen(false);
    // Force refresh after creating new exam
    refresh();
  };
  const handleEditExam = (examData: any) => {
    setSelectedExam(examData);
    setIsUpdateDialogOpen(true);
  };
  const handleUpdateExam = () => {
    handleRefreshData();
    setIsUpdateDialogOpen(false);
    setSelectedExam(null);
  };
  const handleViewResults = (examData: any) => {
    // Use context from exam data if available, otherwise use current context
    const instId = examData.instituteId || examData.institute?.id || currentInstituteId;
    const clsId = examData.classId || examData.class?.id || currentClassId;
    const subId = examData.subjectId || examData.subject?.id || currentSubjectId;
    const examId = examData.id;
    
    console.log('View Results clicked:', { examData, instId, clsId, subId, examId });
    
    if (!instId || !clsId || !subId || !examId) {
      toast({
        title: "Missing Context",
        description: "Please select institute, class, and subject first",
        variant: "destructive"
      });
      return;
    }
    
    const url = `/institute/${instId}/class/${clsId}/subject/${subId}/exam/${examId}/results`;
    console.log('Navigating to:', url);
    navigate(url);
  };
  const handleDeleteExam = (examData: any) => {
    setDeleteDialog({ open: true, item: examData });
  };
  const confirmDeleteExam = async () => {
    if (!deleteDialog.item) return;
    setIsDeleting(true);
    try {
      await cachedApiClient.delete(`/institute-class-subject-exams/${deleteDialog.item.id}`);
      toast({ title: "Exam Deleted", description: `Exam ${deleteDialog.item.title} has been deleted successfully.` });
      setDeleteDialog({ open: false, item: null });
      refresh();
    } catch (error: any) {
      toast({ title: "Delete Failed", description: "Failed to delete exam. Please try again.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };
  const handleCreateResults = () => {
    console.log('Create results clicked');
    setIsCreateResultsDialogOpen(true);
  };
  const examsColumns = [{
    key: 'title',
    header: 'Title'
  }, {
    key: 'description',
    header: 'Description'
  }, {
    key: 'examType',
    header: 'Type',
    render: (value: string) => <Badge variant={value === 'online' ? 'default' : 'secondary'}>
          {value}
        </Badge>
  }, {
    key: 'durationMinutes',
    header: 'Duration (min)',
    render: (value: number) => `${value} minutes`
  }, {
    key: 'totalMarks',
    header: 'Total Marks'
  }, {
    key: 'passingMarks',
    header: 'Passing Marks'
  }, {
    key: 'scheduleDate',
    header: 'Schedule Date',
    render: (value: string) => value ? new Date(value).toLocaleDateString() : 'Not set'
  }, {
    key: 'startTime',
    header: 'Start Time',
    render: (value: string) => value ? new Date(value).toLocaleString() : 'Not set'
  }, {
    key: 'endTime',
    header: 'End Time',
    render: (value: string) => value ? new Date(value).toLocaleString() : 'Not set'
  }, {
    key: 'venue',
    header: 'Venue'
  }, ...((['InstituteAdmin', 'Teacher', 'Student'] as UserRole[]).includes(userRole) ? [{
    key: 'examLink',
    header: 'Exam Link',
    render: (value: string, row: any) => value ? <Button size="sm" variant="destructive" className="h-8 w-8 p-0 sm:w-auto sm:px-3" onClick={() => window.open(value, '_blank')} title="Open exam" aria-label="Open exam">
          <ExternalLink className="h-3 w-3 sm:mr-1" />
          <span className="hidden sm:inline">Exam Link</span>
        </Button> : <span className="text-gray-400">No link</span>
  }] : []), {
    key: 'status',
    header: 'Status',
    render: (value: string) => <Badge variant={value === 'scheduled' ? 'default' : value === 'draft' ? 'secondary' : value === 'completed' ? 'outline' : 'destructive'}>
          {value}
        </Badge>
  }, ...((['InstituteAdmin', 'Teacher'] as UserRole[]).includes(userRole) ? [{
    key: 'createResults',
    header: 'Create Results',
    render: (value: any, row: any) => <Button size="sm" variant="outline" onClick={(e) => {
      e.stopPropagation();
      if (!currentInstituteId || !currentClassId || !currentSubjectId) {
        toast({
          title: "Missing Context",
          description: "Please select institute, class, and subject first",
          variant: "destructive"
        });
        return;
      }
      navigate(`/institute/${currentInstituteId}/class/${currentClassId}/subject/${currentSubjectId}/exam/${row.id}/create-results`);
    }} className="h-8 w-8 p-0 sm:w-auto sm:px-3 flex items-center justify-center gap-2" title="Create results" aria-label="Create results">
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">Create</span>
        </Button>
  }] : []), {
    key: 'results',
    header: 'View Results',
    render: (value: any, row: any) => <Button size="sm" variant="default" onClick={(e) => {
      e.stopPropagation();
      handleViewResults(row);
    }} className="h-8 w-8 p-0 sm:w-auto sm:px-3 flex items-center justify-center gap-2" title="View results" aria-label="View results">
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">View</span>
        </Button>
  }];
  const { hasCustomType, canCreate: rbacCanCreate, canUpdate: rbacCanUpdate, canDelete: rbacCanDelete } = usePermission('exams');
  const canAdd = hasCustomType ? rbacCanCreate : AccessControl.hasPermission(userRole, 'create-exam');
  const canEdit = hasCustomType ? rbacCanUpdate : (userRole === 'Teacher' ? true : AccessControl.hasPermission(userRole, 'edit-exam'));
  const canDelete = hasCustomType ? rbacCanDelete : (userRole === 'Teacher' ? true : AccessControl.hasPermission(userRole, 'delete-exam'));
  const canView = true; // All users can view exams

  const getTitle = () => {
    const contexts = [];
    if (selectedInstitute) {
      contexts.push(selectedInstitute.name);
    }
    if (selectedClass) {
      contexts.push(selectedClass.name);
    }
    if (selectedSubject) {
      contexts.push(selectedSubject.name);
    }
    let title = 'Exams';
    if (contexts.length > 0) {
      title += ` (${contexts.join(' → ')})`;
    }
    return title;
  };

  // Filter the exams based on local filters for mobile view
  const filteredExams = examsData.filter(exam => {
    const matchesSearch = !searchTerm || Object.values(exam).some(value => String(value).toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || exam.status === statusFilter;
    const matchesType = typeFilter === 'all' || exam.examType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });
  const shouldShowLoadButton = () => {
    if (userRole === 'Student') {
      return currentInstituteId && currentClassId && currentSubjectId;
    }
    if (userRole === 'InstituteAdmin' || userRole === 'Teacher') {
      return currentInstituteId;
    }
    return true;
  };
  const getLoadButtonMessage = () => {
    if (userRole === 'Student' && (!currentInstituteId || !currentClassId || !currentSubjectId)) {
      return 'Please select institute, class, and subject to view exams.';
    }
    if ((userRole === 'InstituteAdmin' || userRole === 'Teacher') && !currentInstituteId) {
      return 'Please select institute to view exams.';
    }
    return 'Click the button below to load exams data';
  };

  // Payment gate: If student hasn't paid, block access to exams
  if (userRole === 'Student' && selectedSubject?.verificationStatus && 
      !['verified', 'enrolled_free_card'].includes(selectedSubject.verificationStatus)) {
    const statusLabels: Record<string, { label: string; color: string; desc: string }> = {
      pending_payment: { label: 'Payment Required', color: 'text-orange-600', desc: 'You need to submit payment to access exams. Please go to Fees & Payments to submit your payment.' },
      pending: { label: 'Payment Under Review', color: 'text-amber-600', desc: 'Your payment has been submitted and is awaiting admin approval. You can access Free Lectures in the meantime.' },
      payment_rejected: { label: 'Payment Rejected', color: 'text-red-600', desc: 'Your payment was rejected. Please resubmit a valid payment to access exams.' },
      rejected: { label: 'Enrollment Rejected', color: 'text-red-600', desc: 'Your enrollment was rejected. Please contact your institute admin.' },
      not_enrolled: { label: 'Not Enrolled', color: 'text-muted-foreground', desc: 'You are not enrolled in this subject. Please enroll first.' },
    };
    const info = statusLabels[selectedSubject.verificationStatus] || statusLabels['not_enrolled'];
    return (
      <div className="container mx-auto px-3 py-8 sm:p-6">
        <div className="max-w-md mx-auto text-center space-y-4">
          <div className="h-16 w-16 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Award className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Exams Locked</h2>
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

  return <div className="w-full px-3 py-4 sm:p-6 space-y-4 sm:space-y-6">
      {!hasAttemptedLoad ? <div className="text-center py-8 sm:py-12">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">
            {getTitle()}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 px-2">
            {getLoadButtonMessage()}
          </p>
          <Button
            onClick={() => handleLoadData(false)}
            disabled={isLoading || !shouldShowLoadButton()}
            size="lg"
            className="w-full sm:w-auto gap-2"
          >
            {isLoading ? <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </> : <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Load Data
              </>}
          </Button>
        </div> : <>
          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-3xl font-bold text-foreground">
                  Exams
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2 sm:truncate">
                  {selectedInstitute?.name}{selectedClass ? ` → ${selectedClass.name}` : ''}{selectedSubject ? ` → ${selectedSubject.name}` : ''}
                </p>
                {lastRefresh && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                    Updated: {lastRefresh.toLocaleTimeString()}
                  </p>}
              </div>
            </div>
            
            {/* Action bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
              <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="h-9 w-9 shrink-0 p-0 sm:w-auto sm:px-3 sm:text-sm" title="Filters" aria-label="Filters">
                <Filter className="h-3.5 w-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Filters</span>
              </Button>
              <Button onClick={handleRefreshData} disabled={isLoading} variant="outline" size="sm" className="h-9 w-9 shrink-0 p-0 sm:w-auto sm:px-3 sm:text-sm" title="Refresh" aria-label="Refresh exams">
                <RefreshCw className={`h-3.5 w-3.5 sm:mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isLoading ? 'Loading...' : 'Refresh'}</span>
              </Button>
              <div className="flex shrink-0 items-center border border-border rounded-lg overflow-hidden">
                <button onClick={() => setPageViewMode('card')} className={`p-1.5 transition-colors ${pageViewMode === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`} title="Card view"><LayoutGrid className="h-4 w-4" /></button>
                <button onClick={() => setPageViewMode('table')} className={`p-1.5 transition-colors ${pageViewMode === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`} title="Table view"><Table2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>

          {/* Filter Controls */}
          {showFilters && <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-4 bg-muted/50 rounded-xl border border-border">
              <div>
                <label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 block">
                  Search
                </label>
                <Input placeholder="Search exams..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full h-8 sm:h-9 text-sm" />
              </div>
              
              <div>
                <label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 block">
                  Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 sm:h-9 text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 block">
                  Type
                </label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-8 sm:h-9 text-sm">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="physical">Physical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button variant="outline" onClick={() => {
            setSearchTerm('');
            setStatusFilter('all');
            setTypeFilter('all');
          }} className="w-full">
                  Clear Filters
                </Button>
              </div>
            </div>}

           {/* Create button — visible to any role with canCreate permission */}
           {canAdd && <div className="flex justify-end">
                 <Button onClick={() => setIsCreateDialogOpen(true)} size="sm" className="h-9 w-9 p-0 sm:w-auto sm:px-3 sm:text-sm" title="Create Exam" aria-label="Create Exam">
                   <Plus className="h-3.5 w-3.5 sm:mr-1" />
                   <span className="hidden sm:inline">Create Exam</span>
                </Button>
              </div>}

           {/* View Content */}
          {dataError ? (
            <ErrorState error={dataError} onRetry={handleRefreshData} />
          ) : filteredExams.length === 0 ? (
            <EmptyState icon={FileText} title="No Exams Found" description="No exams match your current filters." />
          ) : pageViewMode === 'card' ? (
            <div className="space-y-2">
              {filteredExams.map((item: any) => {
                  const isOpen = expandedExam === (item.id || item._id);
                  return (
                    <Collapsible key={item.id || item._id} open={isOpen} onOpenChange={() => setExpandedExam(isOpen ? null : (item.id || item._id))}>
                      <CollapsibleTrigger asChild>
                        <Card className="cursor-pointer hover:shadow-md transition-shadow">
                          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm line-clamp-2 sm:truncate">{item.title}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
                                <span>{item.scheduleDate ? new Date(item.scheduleDate).toLocaleDateString() : 'No date'}</span>
                                <Badge variant={item.examType === 'online' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">{item.examType}</Badge>
                                <Badge variant={item.status === 'scheduled' ? 'default' : item.status === 'completed' ? 'outline' : 'destructive'} className="text-[10px] px-1.5 py-0">{item.status}</Badge>
                              </div>
                            </div>
                            <div className="flex w-full items-center gap-1.5 overflow-x-auto pb-1 sm:w-auto sm:shrink-0 sm:overflow-visible sm:pb-0">
                              {item.examLink && (
                                <Button size="sm" variant="destructive" className="h-8 w-8 shrink-0 p-0 sm:h-7 sm:w-auto sm:px-2.5 text-xs" onClick={(e) => { e.stopPropagation(); window.open(item.examLink, '_blank'); }} title="Open exam" aria-label="Open exam">
                                  <ExternalLink className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Exam</span>
                                </Button>
                              )}
                              <Button size="sm" variant="outline" className="h-8 w-8 shrink-0 p-0 sm:h-7 sm:w-auto sm:px-2.5 text-xs" onClick={(e) => { e.stopPropagation(); handleViewResults(item); }} title="Results" aria-label="View results">
                                <Eye className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Results</span>
                              </Button>
                              {canAdd && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 w-8 shrink-0 p-0 sm:h-7 sm:w-auto sm:px-2.5 text-xs text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700"
                                  title="Create results"
                                  aria-label="Create results"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!currentInstituteId || !currentClassId || !currentSubjectId) {
                                      toast({ title: 'Missing Context', description: 'Please select institute, class, and subject first', variant: 'destructive' });
                                      return;
                                    }
                                    navigate(`/institute/${currentInstituteId}/class/${currentClassId}/subject/${currentSubjectId}/exam/${item.id}/create-results`);
                                  }}
                                >
                                  <BarChart3 className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline">Create Results</span>
                                </Button>
                              )}
                              <ChevronDown className={`ml-auto h-4 w-4 text-muted-foreground shrink-0 transition-transform sm:ml-0 ${isOpen ? 'rotate-180' : ''}`} />
                            </div>
                          </CardContent>
                        </Card>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mx-0.5 mb-1 rounded-b-2xl border-x border-b overflow-hidden">
                          <div className="p-4 space-y-3 bg-muted/20">
                            {item.description && (
                              <p className="text-[13px] text-muted-foreground leading-relaxed">{item.description}</p>
                            )}
                            {/* Scoring */}
                            <div>
                              <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Scoring <span className="flex-1 h-px bg-border/40" /></p>
                              <div className="divide-y divide-border/40">
                                <div className="flex items-center justify-between py-3.5">
                                  <span className="text-sm text-muted-foreground">Total Marks</span>
                                  <span className="text-sm font-semibold">{item.totalMarks ?? '—'}</span>
                                </div>
                                <div className="flex items-center justify-between py-3.5">
                                  <span className="text-sm text-muted-foreground">Pass Marks</span>
                                  <span className="text-sm font-semibold text-green-700 dark:text-green-300">{item.passingMarks ?? '—'}</span>
                                </div>
                                <div className="flex items-center justify-between py-3.5">
                                  <span className="text-sm text-muted-foreground">Duration</span>
                                  <span className="text-sm font-semibold">{item.durationMinutes ? `${item.durationMinutes}m` : '—'}</span>
                                </div>
                              </div>
                            </div>
                            {/* Schedule */}
                            <div>
                              <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-3">Schedule <span className="flex-1 h-px bg-border/40" /></p>
                              <div className="divide-y divide-border/40">
                                <div className="flex items-center justify-between py-3.5">
                                  <span className="text-[13px] text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4" />Start Time</span>
                                  <span className="text-sm font-medium">{item.startTime ? new Date(item.startTime).toLocaleString() : 'N/A'}</span>
                                </div>
                                {item.venue && (
                                  <div className="flex items-center justify-between py-3.5">
                                    <span className="text-sm text-muted-foreground">Venue</span>
                                    <span className="text-sm font-medium">{item.venue}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            {(canEdit || canDelete) && (
                              <div className="flex gap-2 pt-1 border-t">
                                {canEdit && (
                                  <Button size="sm" variant="outline" className="h-8 w-8 p-0 sm:w-auto sm:px-3" onClick={() => handleEditExam(item)} title="Edit" aria-label="Edit exam">
                                    <Edit className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Edit</span>
                                  </Button>
                                )}
                                {canDelete && (
                                  <Button size="sm" variant="outline" className="h-8 w-8 p-0 sm:w-auto sm:px-3 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => handleDeleteExam(item)} title="Delete" aria-label="Delete exam">
                                    <Trash2 className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Delete</span>
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
            </div>
          ) : (
          <MUITable title="" data={examsData} columns={examsColumns.map(col => ({
        id: col.key,
        label: col.header,
        minWidth: 170,
        format: col.render
      }))} onAdd={canAdd ? () => setIsCreateDialogOpen(true) : undefined} onEdit={userRole === 'InstituteAdmin' || userRole === 'Teacher' ? handleEditExam : undefined} onDelete={canDelete ? handleDeleteExam : undefined} onView={undefined} page={pagination.page} rowsPerPage={pagination.limit} totalCount={pagination.totalCount} onPageChange={setPage} onRowsPerPageChange={setLimit} rowsPerPageOptions={[25, 50, 100]} sectionType="exams" allowEdit={userRole === 'InstituteAdmin' || userRole === 'Teacher'} allowDelete={canDelete} />
          )}
        </>}

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} routeName="create-exam-popup">
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Exam</DialogTitle>
          </DialogHeader>
          <CreateExamForm onClose={() => setIsCreateDialogOpen(false)} onSuccess={handleCreateExam} />
        </DialogContent>
      </Dialog>

      {/* Update Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen} routeName="edit-exam-popup">
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update Exam</DialogTitle>
          </DialogHeader>
          {selectedExam && <UpdateExamForm exam={selectedExam} onClose={() => setIsUpdateDialogOpen(false)} onSuccess={handleUpdateExam} />}
        </DialogContent>
      </Dialog>

      {/* Create Results Dialog */}
      <Dialog open={isCreateResultsDialogOpen} onOpenChange={setIsCreateResultsDialogOpen} routeName="create-exam-results-popup">
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Results</DialogTitle>
          </DialogHeader>
          <CreateResultsForm onClose={() => setIsCreateResultsDialogOpen(false)} onSuccess={() => {
          setIsCreateResultsDialogOpen(false);
          toast({
            title: "Results Created",
            description: "Exam results have been created successfully."
          });
        }} />
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        itemName={deleteDialog.item?.title || ''}
        itemType="exam"
        onConfirm={confirmDeleteExam}
        isDeleting={isDeleting}
      />
    </div>;
};
export default Exams;