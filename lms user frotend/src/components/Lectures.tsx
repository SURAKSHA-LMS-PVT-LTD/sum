import React, { useState, useMemo } from 'react';
import MUITable from '@/components/ui/mui-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CustomToggle } from '@/components/ui/custom-toggle';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Filter, Plus, Calendar, Clock, MapPin, Video, Users, ExternalLink, CheckCircle, ChevronDown, LayoutList, LayoutGrid, Table2, FileText, HardDrive, Cloud, Link2, Edit, Trash2, ImageIcon, Play, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { buildSidebarUrl } from '@/utils/pageNavigation';
import { AccessControl } from '@/utils/permissions';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import CreateLectureForm from '@/components/forms/CreateLectureForm';
import CreateClassLectureForm from '@/components/forms/CreateClassLectureForm';
import UpdateLectureForm from '@/components/forms/UpdateLectureForm';
import UpdateClassLectureForm from '@/components/forms/UpdateClassLectureForm';
import { DataCardView } from '@/components/ui/data-card-view';
import { useTableData } from '@/hooks/useTableData';
import { useViewMode } from '@/hooks/useViewMode';
import { EmptyState } from '@/components/ui/EmptyState';
import { cachedApiClient } from '@/api/cachedClient';
import VideoPreviewDialog from '@/components/VideoPreviewDialog';
import DeleteConfirmDialog from '@/components/forms/DeleteConfirmDialog';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { format } from 'date-fns';

interface LecturesProps {
  apiLevel?: 'institute' | 'class' | 'subject';
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'scheduled': return { label: 'Scheduled', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
    case 'ongoing': return { label: 'Live Now', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 animate-pulse' };
    case 'completed': return { label: 'Completed', className: 'bg-primary/10 text-primary border-primary/20' };
    case 'cancelled': return { label: 'Cancelled', className: 'bg-destructive/10 text-destructive border-destructive/20' };
    case 'postponed': return { label: 'Postponed', className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' };
    default: return { label: status, className: 'bg-muted text-muted-foreground border-border' };
  }
};

const formatDateTime = (dateString: string | null | undefined) => {
  if (!dateString) return 'Not scheduled';
  return format(new Date(dateString), 'MMM dd, yyyy • HH:mm');
};

const Lectures = ({ apiLevel = 'institute' }: LecturesProps) => {
  const navigate = useNavigate();
  const { user, selectedInstitute, selectedClass, selectedSubject, currentInstituteId, currentClassId, currentSubjectId } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedLectureData, setSelectedLectureData] = useState<any>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoPreviewTitle, setVideoPreviewTitle] = useState<string>('');
  const [videoPreviewLecture, setVideoPreviewLecture] = useState<any>(null);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const { viewMode } = useViewMode();
  const [pageViewMode, setPageViewMode] = useState<'card' | 'table'>(viewMode);
  const [expandedLecture, setExpandedLecture] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: any }>({ open: false, item: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const userRole = useInstituteRole();
  
  // Memoize endpoint to prevent unnecessary re-renders
  const endpoint = useMemo(() => {
    if (userRole === 'Student') {
      // Student with subject selected → subject-level lectures
      if (currentInstituteId && currentClassId && currentSubjectId) {
        return '/institute-class-subject-lectures';
      }
      // Student with class but no subject → class-level lectures (all class members)
      if (currentInstituteId && currentClassId) {
        return '/institute-class-lectures';
      }
      return '/institute-class-subject-lectures';
    } else if (userRole === 'InstituteAdmin' || userRole === 'Teacher') {
      if (currentInstituteId && currentClassId && currentSubjectId) {
        return '/institute-class-subject-lectures';
      }
      // Class selected but no subject → class-level lectures (all class members)
      if (currentInstituteId && currentClassId) {
        return '/institute-class-lectures';
      }
    }
    return '/lectures';
  }, [userRole, currentInstituteId, currentClassId, currentSubjectId]);

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
      params.instructorId = user.id;
    }
    
    return params;
  }, [currentInstituteId, currentClassId, currentSubjectId, userRole, user?.id]);
  
  // Enhanced pagination with useTableData hook - AUTO-LOAD when subject selected
  const tableData = useTableData({
    endpoint,
    defaultParams,
    dependencies: [currentInstituteId, currentClassId, currentSubjectId], // Auto-reload on context changes
    pagination: {
      defaultLimit: 50,
      availableLimits: [25, 50, 100]
    },
    autoLoad: true // Enable auto-loading from cache
  });

  const { 
    state: { data: lecturesData, loading: isLoading },
    pagination,
    actions
  } = tableData;

  // Track if we've attempted to load data at least once - auto-load when subject is selected
  const [hasAttemptedLoad, setHasAttemptedLoad] = React.useState(false);

  // Auto-load when context is ready (class OR subject level)
  React.useEffect(() => {
    if (currentInstituteId && currentClassId && !hasAttemptedLoad) {
      setHasAttemptedLoad(true);
      actions.loadData(false);
    }
  }, [currentInstituteId, currentClassId, currentSubjectId]);

  const handleLoadData = async (forceRefresh = false) => {
    if (userRole === 'Student') {
      if (!currentInstituteId || !currentClassId) {
        toast({
          title: "Missing Selection",
          description: "Please select institute and class to view lectures.",
          variant: "destructive"
        });
        return;
      }
    } else if (userRole === 'InstituteAdmin' || userRole === 'Teacher') {
      if (!currentInstituteId || !currentClassId) {
        toast({
          title: "Missing Selection",
          description: "Please select institute and class to view lectures.",
          variant: "destructive"
        });
        return;
      }
    }

    setHasAttemptedLoad(true);
    
    // Update filters and load data
    actions.updateFilters(defaultParams);
    
    // Always trigger data loading
    actions.loadData(forceRefresh);
  };

  const handleRefreshData = async () => {
    console.log('Force refreshing lectures data...');
    actions.refresh();
    setLastRefresh(new Date());
  };

  const handleCreateLecture = async () => {
    setIsCreateDialogOpen(false);
    // Force refresh after creating new lecture
    actions.refresh();
  };

  const handleEditLecture = async (lectureData: any) => {
    console.log('Opening update lecture dialog:', lectureData);
    setSelectedLectureData(lectureData);
    setIsEditDialogOpen(true);
  };

  const handleUpdateLecture = async () => {
    setIsEditDialogOpen(false);
    setSelectedLectureData(null);
    // Force refresh after updating lecture
    actions.refresh();
  };


  const handleDeleteLecture = (lectureData: any) => {
    setDeleteDialog({ open: true, item: lectureData });
  };
  const confirmDeleteLecture = async () => {
    if (!deleteDialog.item) return;
    setIsDeleting(true);
    try {
      // Use PATCH soft-deactivate on the same endpoint as data source (DELETE may be SUPERADMIN-only)
      await cachedApiClient.patch(`${endpoint}/${deleteDialog.item.id}`, { isActive: false });
      toast({ title: "Lecture Deleted", description: `Lecture ${deleteDialog.item.title} has been deleted successfully.` });
      setDeleteDialog({ open: false, item: null });
      actions.refresh();
    } catch (error: any) {
      toast({ title: "Delete Failed", description: "Failed to delete lecture. Please try again.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewLecture = (lectureData: any) => {
    console.log('View lecture:', lectureData);
    toast({
      title: "Lecture Viewed",
      description: `Viewing lecture: ${lectureData.title}`
    });
  };

  const getRecordingUrl = (lecture: any) => {
    return lecture.recordingUrl || lecture.recording_url || lecture.recUrl || lecture.videoUrl || lecture.video_url || '';
  };

  const isYouTubeOrDrive = (url: string) => {
    return url.includes('youtube.com') ||
      url.includes('youtu.be') ||
      url.includes('drive.google.com');
  };

  const handleRecordingClick = (lecture: any) => {
    const recAttEnabled = lecture.recAttendanceEnabled || lecture.rec_attendance_enabled;
    const recUrlId = lecture.recUrlId || lecture.rec_url_id;

    if (recAttEnabled && recUrlId) {
      window.open(`${window.location.origin}/view-recording/${recUrlId}`, '_blank');
      return;
    }

    const recordingUrl = getRecordingUrl(lecture);
    if (!recordingUrl) return;

    if (isYouTubeOrDrive(recordingUrl)) {
      setVideoPreviewUrl(recordingUrl);
      setVideoPreviewTitle(lecture.title || 'Lecture Recording');
      setVideoPreviewLecture(lecture);
      return;
    }

    window.open(recordingUrl, '_blank');
  };


  const lecturesColumns = [
    { key: 'title', header: 'Title' },
    { key: 'description', header: 'Description' },
    { key: 'lectureType', header: 'Type', render: (value: string) => <Badge variant="outline">{value}</Badge> },
    { key: 'venue', header: 'Venue' },
    { key: 'startTime', header: 'Start Time', render: (value: string) => new Date(value).toLocaleString() },
    { key: 'endTime', header: 'End Time', render: (value: string) => new Date(value).toLocaleString() },
    { 
      key: 'status', 
      header: 'Status',
      render: (value: string) => (
        <Badge variant={value === 'scheduled' ? 'default' : value === 'completed' ? 'secondary' : 'destructive'}>
          {value}
        </Badge>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_value: unknown, row: any) => {
        const recordingUrl = getRecordingUrl(row);
        const hasJoin = Boolean(row.meetingLink) && (row.status === 'scheduled' || row.status === 'ongoing');
        const hasRecording = Boolean(recordingUrl);

        return (
          <div className="min-w-[240px] space-y-2">
            {(hasJoin || hasRecording) && (
              <div className="grid grid-cols-2 gap-2">
                {hasJoin ? (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-8 w-full justify-center bg-green-600 px-2 text-white hover:bg-green-700"
                    onClick={() => window.open(row.meetingLink, '_blank')}
                  >
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    Join
                  </Button>
                ) : <div />}
                {hasRecording ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-full justify-center border-primary/30 px-2 hover:bg-primary/5"
                    onClick={() => handleRecordingClick(row)}
                  >
                    <Video className="mr-1 h-3.5 w-3.5" />
                    Recording
                  </Button>
                ) : <div />}
              </div>
            )}
            {(canEdit || canDelete) && (
              <div className="grid grid-cols-2 gap-2">
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-full justify-center"
                    onClick={() => handleEditLecture(row)}
                  >
                    <Edit className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                ) : <div />}
                {canDelete ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 w-full justify-center border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
                    onClick={() => handleDeleteLecture(row)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Delete
                  </Button>
                ) : <div />}
              </div>
            )}
          </div>
        );
      }
    }
  ];

  const canAdd = AccessControl.hasPermission(userRole, 'create-lecture');
  const canEdit = userRole === 'Teacher' ? true : AccessControl.hasPermission(userRole, 'edit-lecture');
  const canDelete = userRole === 'Teacher' ? true : AccessControl.hasPermission(userRole, 'delete-lecture');

  // DEBUG: Log role and institute information
  console.log('🔍 LECTURES DEBUG:', {
    userRole,
    selectedInstitute,
    'selectedInstitute.userRole': selectedInstitute?.userRole,
    'selectedInstitute.instituteUserType': (selectedInstitute as any)?.instituteUserType,
    canEdit,
    canDelete,
    canAdd
  });

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
    
    let title = 'Lectures';
    if (contexts.length > 0) {
      title += ` (${contexts.join(' → ')})`;
    }
    
    return title;
  };

  // Filter the lectures based on local filters for mobile view
  const filteredLectures = lecturesData.filter(lecture => {
    const matchesSearch = !searchTerm || 
      Object.values(lecture).some(value => 
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      );
    
    const matchesStatus = statusFilter === 'all' || 
      lecture.status === statusFilter;
    
    const matchesType = typeFilter === 'all' || 
      lecture.lectureType === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  // Payment gate: If student hasn't paid (pending_payment, payment_rejected, pending), block access to paid lectures
  if (userRole === 'Student' && selectedSubject?.verificationStatus && 
      !['verified', 'enrolled_free_card'].includes(selectedSubject.verificationStatus)) {
    const statusLabels: Record<string, { label: string; color: string; desc: string }> = {
      pending_payment: { label: 'Payment Required', color: 'text-orange-600', desc: 'You need to submit payment to access lectures. Please go to Fees & Payments to submit your payment.' },
      pending: { label: 'Payment Under Review', color: 'text-amber-600', desc: 'Your payment has been submitted and is awaiting admin approval. You can access Free Lectures in the meantime.' },
      payment_rejected: { label: 'Payment Rejected', color: 'text-red-600', desc: 'Your payment was rejected. Please resubmit a valid payment to access lectures.' },
      rejected: { label: 'Enrollment Rejected', color: 'text-red-600', desc: 'Your enrollment was rejected. Please contact your institute admin.' },
      not_enrolled: { label: 'Not Enrolled', color: 'text-muted-foreground', desc: 'You are not enrolled in this subject. Please enroll first.' },
    };
    const info = statusLabels[selectedSubject.verificationStatus] || statusLabels['not_enrolled'];
    return (
      <div className="container mx-auto px-3 py-8 sm:p-6">
        <div className="max-w-md mx-auto text-center space-y-4">
          <div className="h-16 w-16 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Video className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Lectures Locked</h2>
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
    <div className="w-full px-3 py-4 sm:p-6 space-y-4 sm:space-y-6">
      {!hasAttemptedLoad ? (
        <div className="text-center py-8 sm:py-12">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 sm:mb-4">
            {getTitle()}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 px-2">
            {userRole === 'Student' && (!currentInstituteId || !currentClassId || !currentSubjectId)
              ? 'Please select institute, class, and subject to view lectures.'
              : 'Click the button below to load lectures data'
            }
          </p>
          <Button 
            onClick={() => handleLoadData(false)} 
            disabled={isLoading || (userRole === 'Student' && (!currentInstituteId || !currentClassId || !currentSubjectId))}
            size="lg"
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Load Data
              </>
            )}
          </Button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-3xl font-bold text-foreground truncate">
                  Lectures
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                  {selectedInstitute?.name}{selectedClass ? ` → ${selectedClass.name}` : ''}{selectedSubject ? ` → ${selectedSubject.name}` : ''}
                </p>
                {lastRefresh && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                    Updated: {lastRefresh.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
            
            {/* Action bar */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="h-8 px-2.5 text-xs sm:text-sm sm:h-9 sm:px-3"
              >
                <Filter className="h-3.5 w-3.5 mr-1" />
                Filters
              </Button>
              <Button 
                onClick={handleRefreshData} 
                disabled={isLoading}
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs sm:text-sm sm:h-9 sm:px-3"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? 'Loading...' : 'Refresh'}
              </Button>
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <button onClick={() => setPageViewMode('card')} className={`p-1.5 transition-colors ${pageViewMode === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`} title="Card view"><LayoutGrid className="h-4 w-4" /></button>
                <button onClick={() => setPageViewMode('table')} className={`p-1.5 transition-colors ${pageViewMode === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`} title="Table view"><Table2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>

          {/* Filter Controls */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 p-3 sm:p-4 bg-muted/50 rounded-xl border border-border">
              <div>
                <label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1 block">
                  Search
                </label>
                <Input
                  placeholder="Search lectures..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Type
                </label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="physical">Physical</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setTypeFilter('all');
                  }}
                  className="w-full"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          )}

          {/* Add Create Button for InstituteAdmin and Teacher */}
          {['InstituteAdmin', 'Teacher'].includes(userRole) && canAdd && (
            <div className="flex justify-end">
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                size="sm"
                className="h-8 text-xs sm:h-9 sm:text-sm"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create Lecture
              </Button>
            </div>
          )}

           {/* View Content */}
          {filteredLectures.length === 0 ? (
            <EmptyState icon={Video} title="No Lectures Found" description="No lectures match your current filters." />
          ) : pageViewMode === 'card' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-visible">
              {filteredLectures.map((item: any) => {
                  const isOpen = expandedLecture === (item.id || item._id);
                  const recUrl = item.recordingUrl || item.recording_url;
                  const statusConfig = getStatusConfig(item.status);
                  const rawThumbUrl = item.thumbnailUrl || item.thumbnail_url;
                  const thumbnailSrc = rawThumbUrl ? getImageUrl(rawThumbUrl) : '';
                  return (
                    <div key={item.id || item._id} className={`relative ${isOpen ? 'z-40' : 'z-0'}`}>
                      <Card
                        className="overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col cursor-pointer"
                        onClick={() => setExpandedLecture(isOpen ? null : (item.id || item._id))}
                      >
                        {/* Thumbnail Section */}
                        <div className="relative aspect-video bg-muted group">
                          {thumbnailSrc ? (
                            <img
                              src={thumbnailSrc}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50 gap-2">
                              <ImageIcon className="h-10 w-10" />
                              <span className="text-xs font-medium">No Thumbnail</span>
                            </div>
                          )}
                          {/* Gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                          {/* Status badge */}
                          <Badge variant="outline" className={`absolute top-2 left-2 ${statusConfig.className} text-[10px] font-semibold px-2 py-0.5 backdrop-blur-sm bg-background/80`}>
                            {statusConfig.label}
                          </Badge>
                          {/* Type badge */}
                          <Badge variant="secondary" className="absolute top-2 right-2 text-[10px] capitalize backdrop-blur-sm bg-background/80">
                            {item.lectureType === 'online' ? <Video className="h-3 w-3 mr-1" /> : <MapPin className="h-3 w-3 mr-1" />}
                            {item.lectureType}
                          </Badge>
                          {/* Bottom overlay info */}
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <h3 className="font-semibold text-sm text-white line-clamp-2 drop-shadow-md">{item.title}</h3>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-3 flex-1 flex flex-col gap-2">
                          {/* Schedule info */}
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span>{formatDateTime(item.startTime)}</span>
                            {item.endTime && <span>– {format(new Date(item.endTime), 'HH:mm')}</span>}
                          </div>

                          {/* Meta row */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.venue && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <MapPin className="h-3 w-3" />{item.venue}
                              </span>
                            )}
                            {item.maxParticipants && (
                              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <Users className="h-3 w-3" />{item.maxParticipants}
                              </span>
                            )}
                            {Array.isArray(item.materials) && item.materials.length > 0 && (
                              <button
                                className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded px-1.5 py-0.5 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <FileText className="h-3 w-3" />{item.materials.length} file{item.materials.length > 1 ? 's' : ''}
                              </button>
                            )}
                          </div>

                          {item.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{item.description}</p>
                          )}

                          {/* Action buttons */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-2 border-t border-border/50">
                            {item.meetingLink && (item.status === 'scheduled' || item.status === 'ongoing') && (
                              <Button
                                size="sm"
                                className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1"
                                onClick={(e) => { e.stopPropagation(); window.open(item.meetingLink, '_blank'); }}
                              >
                                <ExternalLink className="h-3 w-3" />Join
                              </Button>
                            )}
                            {recUrl && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2.5 rounded-lg gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRecordingClick(item);
                                }}
                              >
                                <Play className="h-3 w-3" />Recording
                              </Button>
                            )}
                            <div className="ml-auto flex items-center gap-0.5">
                              {canEdit && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs px-2 rounded-lg gap-1" onClick={(e) => { e.stopPropagation(); handleEditLecture(item); }}>
                                  <Edit className="h-3 w-3" />Edit
                                </Button>
                              )}
                              {canDelete && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs px-2 rounded-lg gap-1 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteLecture(item); }}>
                                  <Trash2 className="h-3 w-3" />Delete
                                </Button>
                              )}
                              <span className="flex items-center text-muted-foreground/60 px-1">
                                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
                              </span>
                            </div>
                          </div>
                        </div>
                      </Card>
                      {isOpen && (
                        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-background border rounded-xl shadow-2xl p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                          <div className="absolute -top-1.5 left-6 w-3 h-3 bg-background border-l border-t rotate-45 rounded-tl-sm" />
                          {/* Schedule detail cards */}
                          <div className="grid grid-cols-2 gap-1.5">
                            <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-muted/60 border border-border/50">
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Start</span>
                              <span className="text-xs font-medium">{formatDateTime(item.startTime)}</span>
                            </div>
                            {item.endTime && (
                              <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-muted/60 border border-border/50">
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">End</span>
                                <span className="text-xs font-medium">{format(new Date(item.endTime), 'HH:mm')}</span>
                              </div>
                            )}
                          </div>
                          {/* Materials */}
                          {Array.isArray(item.materials) && item.materials.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Materials ({item.materials.length})</p>
                              <div className="space-y-1">
                                {item.materials.map((mat: any, idx: number) => {
                                  const icon = mat.source === 'S3'
                                    ? <Cloud className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                                    : (mat.source === 'GOOGLE_DRIVE' || mat.source === 'GOOGLE_DRIVE_INSTITUTE')
                                      ? <HardDrive className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                      : <Link2 className="h-3.5 w-3.5 text-orange-500 shrink-0" />;
                                  const viewUrl = mat.driveWebViewLink || mat.documentUrl;
                                  return (
                                    <div key={idx} className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/60 border border-border/50">
                                      {icon}
                                      <span className="text-xs font-medium truncate flex-1">{mat.documentName}</span>
                                      <div className="flex items-center gap-1 shrink-0">
                                        {viewUrl && (
                                          <a href={viewUrl} target="_blank" rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                                            <ExternalLink className="h-3 w-3" /> View
                                          </a>
                                        )}
                                        {mat.documentUrl && mat.source === 'S3' && (
                                          <a href={mat.documentUrl} download className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary ml-1">
                                            <Download className="h-3 w-3" /> DL
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {(canEdit || canDelete) && (
                            <div className="flex gap-2 pt-1 border-t">
                              {canEdit && (
                                <Button size="sm" variant="outline" className="h-8" onClick={() => handleEditLecture(item)}>Edit</Button>
                              )}
                              {canDelete && (
                                <Button size="sm" variant="outline" className="h-8 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => handleDeleteLecture(item)}>Delete</Button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
           <MUITable
            title=""
            data={lecturesData}
            columns={lecturesColumns.map(col => ({
              id: col.key,
              label: col.header,
              minWidth: col.key === 'actions' ? 260 : 170,
              format: col.render
            }))}
            onAdd={canAdd ? () => setIsCreateDialogOpen(true) : undefined}
            page={pagination.page}
            rowsPerPage={pagination.limit}
            totalCount={pagination.totalCount}
            onPageChange={(newPage: number) => actions.setPage(newPage)}
            onRowsPerPageChange={(newLimit: number) => actions.setLimit(newLimit)}
            sectionType="lectures"
              allowEdit={false}
              allowDelete={false}
          />
          )}
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} routeName="create-lecture-popup">
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{endpoint === '/institute-class-lectures' ? 'Create Class Lecture' : 'Create New Lecture'}</DialogTitle>
          </DialogHeader>
          {endpoint === '/institute-class-lectures' ? (
            <CreateClassLectureForm
              onClose={() => setIsCreateDialogOpen(false)}
              onSuccess={handleCreateLecture}
            />
          ) : (
            <CreateLectureForm
              onClose={() => setIsCreateDialogOpen(false)}
              onSuccess={handleCreateLecture}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Update Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} routeName="update-lecture-popup">
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{endpoint === '/institute-class-lectures' ? 'Update Class Lecture' : 'Update Lecture'}</DialogTitle>
          </DialogHeader>
          {selectedLectureData && (
            endpoint === '/institute-class-lectures' ? (
              <UpdateClassLectureForm
                lecture={selectedLectureData}
                onClose={() => setIsEditDialogOpen(false)}
                onSuccess={handleUpdateLecture}
              />
            ) : (
              <UpdateLectureForm
                lecture={selectedLectureData}
                onClose={() => setIsEditDialogOpen(false)}
                onSuccess={handleUpdateLecture}
              />
            )
          )}
        </DialogContent>
      </Dialog>

      {/* Video Preview Dialog */}
      <VideoPreviewDialog
        open={!!videoPreviewUrl}
        onOpenChange={(open) => { if (!open) { setVideoPreviewUrl(null); setVideoPreviewLecture(null); } }}
        url={videoPreviewUrl || ''}
        title={videoPreviewTitle}
        description={videoPreviewLecture?.description}
        materials={videoPreviewLecture?.materials}
      />

      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        itemName={deleteDialog.item?.title || ''}
        itemType="lecture"
        onConfirm={confirmDeleteLecture}
        isDeleting={isDeleting}
      />
    </div>
  );
};

export default Lectures;
