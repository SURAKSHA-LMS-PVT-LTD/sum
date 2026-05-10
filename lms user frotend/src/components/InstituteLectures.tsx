import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { lectureApi, Lecture } from '@/api/lecture.api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { ExternalLink, Plus, Edit, Trash2, Play, RefreshCw, BookOpen, ChevronDown, LayoutGrid, Table2, FileText, Cloud, HardDrive, Link2, Download, Clock, MapPin, Users, Video, ImageIcon } from 'lucide-react';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { format } from 'date-fns';
import CreateInstituteLectureForm from '@/components/forms/CreateInstituteLectureForm';
import UpdateInstituteLectureForm from '@/components/forms/UpdateInstituteLectureForm';
import DeleteLectureConfirmDialog from '@/components/forms/DeleteLectureConfirmDialog';
import VideoPreviewDialog from '@/components/VideoPreviewDialog';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/api/apiError';
import MUITable from '@/components/ui/mui-table';
import { useViewMode } from '@/hooks/useViewMode';
import { EmptyState } from '@/components/ui/EmptyState';

const InstituteLectures = () => {
  const { selectedInstitute, user } = useAuth();
  const effectiveRole = useInstituteRole();
  const { toast } = useToast();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [lectureToDelete, setLectureToDelete] = useState<Lecture | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showRecordingDialog, setShowRecordingDialog] = useState(false);
  const [recordingLecture, setRecordingLecture] = useState<Lecture | null>(null);

  const fetchLectures = async (pageNum: number = 1, forceRefresh: boolean = false) => {
    if (!selectedInstitute?.id) {
      toast({
        title: 'Institutes',
        description: 'Please select an institute first',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await lectureApi.getInstituteLectures({
        instituteId: selectedInstitute.id,
        page: pageNum,
        limit: 10,
        userId: user?.id,
        role: effectiveRole
      }, forceRefresh);

      let lecturesData: Lecture[] = [];
      if (Array.isArray(response)) {
        lecturesData = response;
      } else if (response.data && Array.isArray(response.data)) {
        lecturesData = response.data;
      } else if (response && Array.isArray((response as any).lectures)) {
        lecturesData = (response as any).lectures;
      }

      setLectures(lecturesData);
      setTotalPages(Math.ceil(lecturesData.length / 10));
    } catch (error: any) {
      console.error('Error fetching institute lectures:', error);
      toast({
        title: 'Failed to load lectures',
        description: getErrorMessage(error, 'Failed to load institute lectures.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedInstitute?.id) {
      fetchLectures(1);
    }
  }, [selectedInstitute?.id]);

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

  const handleJoinLecture = (lecture: Lecture) => {
    if (lecture.meetingLink) {
      window.open(lecture.meetingLink, '_blank');
    } else {
      toast({ title: 'Meeting link not available', description: 'This lecture does not have a meeting link.', variant: 'destructive' });
    }
  };

  const handleViewRecording = (lecture: Lecture) => {
    if (lecture.recAttendanceEnabled && lecture.recUrlId) {
      window.open(`${window.location.origin}/view-recording/${lecture.recUrlId}`, '_blank');
      return;
    }
    if (lecture.recordingUrl) {
      setRecordingLecture(lecture);
      setShowRecordingDialog(true);
    } else {
      toast({ title: 'Recording not available', description: 'This lecture does not have a recording.', variant: 'destructive' });
    }
  };

  const handleCreateSuccess = async () => { setShowCreateDialog(false); await fetchLectures(page); };
  const handleUpdateSuccess = async () => { setShowUpdateDialog(false); setSelectedLecture(null); await fetchLectures(page); };
  const handleUpdateClick = (lecture: Lecture) => { setSelectedLecture(lecture); setShowUpdateDialog(true); };
  const handleDeleteClick = (lecture: Lecture) => { setLectureToDelete(lecture); setShowDeleteDialog(true); };

  const handleDeleteConfirm = async () => {
    if (!lectureToDelete) return;
    setIsDeleting(true);
    try {
      await lectureApi.deleteInstituteLecturePermanent(lectureToDelete.id, { instituteId: selectedInstitute?.id });
      setLectures(prev => prev.filter(l => l.id !== lectureToDelete.id));
      toast({ title: 'Delete Success', description: `${lectureToDelete.title} has been deleted successfully.`, variant: 'success' });
      setShowDeleteDialog(false);
      setLectureToDelete(null);
    } catch (error: any) {
      console.error('Error deleting lecture:', error);
      toast({ title: 'Delete Failed', description: getErrorMessage(error, 'Failed to delete lecture.'), variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const isInstituteAdmin = effectiveRole === 'InstituteAdmin';
  const { viewMode } = useViewMode();
  const [pageViewMode, setPageViewMode] = useState<'card' | 'table'>(viewMode);
  const [expandedLectureId, setExpandedLectureId] = useState<string | null>(null);
  const scheduledCount = lectures.filter(l => l.status === 'scheduled').length;
  const ongoingCount = lectures.filter(l => l.status === 'ongoing').length;
  const completedCount = lectures.filter(l => l.status === 'completed').length;

  if (!selectedInstitute) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">Institute Lectures</h2>
          <p className="text-sm text-muted-foreground">Please select an institute to view lectures</p>
        </div>
      </div>
    );
  }

  if (!effectiveRole || !['InstituteAdmin', 'Teacher', 'Student'].includes(effectiveRole)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <BookOpen className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground">You don't have permission to view institute lectures</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:gap-3">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Institute Lectures</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
            Manage all lectures for {selectedInstitute.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Button
            onClick={() => fetchLectures(page, true)}
            disabled={loading}
            variant="outline"
            size="sm"
            className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
          >
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button onClick={() => setPageViewMode('card')} className={`p-1.5 transition-colors ${pageViewMode === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`} title="Card view"><LayoutGrid className="h-4 w-4" /></button>
            <button onClick={() => setPageViewMode('table')} className={`p-1.5 transition-colors ${pageViewMode === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`} title="Table view"><Table2 className="h-4 w-4" /></button>
          </div>
          {isInstituteAdmin && (
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3">
                    <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-1.5" />
                    New Lecture
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
                  <DialogTitle className="sr-only">Create Lecture</DialogTitle>
                  <DialogDescription className="sr-only">Form to create a new institute lecture</DialogDescription>
                  <CreateInstituteLectureForm onClose={() => setShowCreateDialog(false)} onSuccess={handleCreateSuccess} />
                </DialogContent>
              </Dialog>
            )}
        </div>
      </div>

      {/* Stats */}
      {lectures.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'Scheduled', value: scheduledCount },
            { label: 'Live Now', value: ongoingCount },
            { label: 'Completed', value: completedCount },
          ].map(({ label, value }) => (
            <Card key={label}>
              <CardContent className="p-2.5 sm:p-4">
                <div className="text-lg sm:text-xl font-bold">{value}</div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Content */}
      {loading && lectures.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl border border-border/50 p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-48 bg-muted rounded-lg" />
                  <div className="h-4 w-32 bg-muted rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : lectures.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No Lectures Yet"
          description={`No institute lectures available at the moment.${isInstituteAdmin ? ' Create your first lecture to get started.' : ''}`}
        />
      ) : (
        <>
          {pageViewMode === 'table' ? (
            <MUITable
              title=""
              data={lectures}
              columns={[
                { id: 'title', label: 'Title', minWidth: 200, format: (val: string, row: any) => <div className="flex items-center gap-2">{row.thumbnailUrl && <div className="h-8 aspect-video rounded overflow-hidden shrink-0 bg-muted"><img src={getImageUrl(row.thumbnailUrl)} alt={val} className="w-full h-full object-cover" /></div>}<div><div className="font-medium">{val}</div>{row.description && <div className="text-xs text-muted-foreground line-clamp-1">{row.description}</div>}</div></div> },
                { id: 'status', label: 'Status', minWidth: 120, format: (val: string) => { const cfg = getStatusConfig(val); return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>; } },
                { id: 'lectureType', label: 'Type', minWidth: 100, format: (val: string) => <Badge variant="secondary" className="capitalize">{val}</Badge> },
                { id: 'startTime', label: 'Start Time', minWidth: 170, format: (val: string) => val ? formatDateTime(val) : '—' },
                { id: 'endTime', label: 'End Time', minWidth: 110, format: (val: string) => val ? format(new Date(val), 'HH:mm') : '—' },
                { id: 'venue', label: 'Venue', minWidth: 120, format: (val: string) => val || '—' },
                { id: 'materials', label: 'Materials', minWidth: 130, format: (_: any, row: any) => {
                  const mats = row.materials || [];
                  if (mats.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
                  return (
                    <div className="space-y-0.5">
                      {mats.slice(0, 2).map((m: any, i: number) => {
                        const icon = m.source === 'S3' ? <Cloud className="h-3 w-3 text-emerald-500 shrink-0" />
                          : (m.source === 'GOOGLE_DRIVE' || m.source === 'GOOGLE_DRIVE_INSTITUTE') ? <HardDrive className="h-3 w-3 text-blue-500 shrink-0" />
                          : <Link2 className="h-3 w-3 text-orange-500 shrink-0" />;
                        return (
                          <a key={i} href={m.driveWebViewLink || m.documentUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
                            {icon}
                            <span className="truncate max-w-[100px]">{m.documentName}</span>
                          </a>
                        );
                      })}
                      {mats.length > 2 && <span className="text-[10px] text-muted-foreground">+{mats.length - 2} more</span>}
                    </div>
                  );
                }},
                { id: 'id', label: 'Actions', minWidth: 220, format: (_: any, row: any) => (
                  <div className="flex flex-wrap items-center gap-1">
                    {row.meetingLink && (row.status === 'scheduled' || row.status === 'ongoing') && (
                      <Button size="sm" onClick={() => handleJoinLecture(row)} className="h-7 text-xs rounded-lg gap-1">
                        <ExternalLink className="h-4 w-4" />Join
                      </Button>
                    )}
                    {row.recordingUrl && (
                      <Button size="sm" variant="outline" onClick={() => handleViewRecording(row)} className="h-7 text-xs rounded-lg gap-1">
                        <Play className="h-4 w-4" />Recording
                      </Button>
                    )}
                    {isInstituteAdmin && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => handleUpdateClick(row)} className="h-7 text-xs rounded-lg gap-1">
                          <Edit className="h-4 w-4" />Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(row)} className="h-7 text-xs rounded-lg gap-1 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />Delete
                        </Button>
                      </>
                    )}
                  </div>
                )},
              ]}
              page={0}
              rowsPerPage={lectures.length || 10}
              totalCount={lectures.length}
              onPageChange={() => {}}
              onRowsPerPageChange={() => {}}
              allowAdd={false}
              allowEdit={false}
              allowDelete={false}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-visible">
            {lectures.map((lecture) => {
              const statusConfig = getStatusConfig(lecture.status);
              const isExpanded = expandedLectureId === lecture.id;
              const thumbnailSrc = lecture.thumbnailUrl ? getImageUrl(lecture.thumbnailUrl) : '';
              return (
                <div key={lecture.id} className={`relative ${isExpanded ? 'z-40' : 'z-0'}`}>
                <Card
                  className="overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col cursor-pointer"
                  onClick={() => setExpandedLectureId(isExpanded ? null : lecture.id)}
                >
                  {/* Thumbnail Section */}
                  <div
                    className="relative aspect-video bg-muted group"
                  >
                    {thumbnailSrc ? (
                      <img
                        src={thumbnailSrc}
                        alt={lecture.title}
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
                      {lecture.lectureType === 'online' ? <Video className="h-3 w-3 mr-1" /> : <MapPin className="h-3 w-3 mr-1" />}
                      {lecture.lectureType}
                    </Badge>
                    {/* Bottom overlay info */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h3 className="font-semibold text-sm text-white line-clamp-2 drop-shadow-md">{lecture.title}</h3>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-3 flex-1 flex flex-col gap-2">
                    {/* Schedule info */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>{formatDateTime(lecture.startTime)}</span>
                      {lecture.endTime && <span>– {format(new Date(lecture.endTime), 'HH:mm')}</span>}
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {lecture.subject && (
                        <Badge variant="outline" className="text-[10px] font-medium text-primary border-primary/30 bg-primary/5 px-1.5 py-0">
                          {lecture.subject}
                        </Badge>
                      )}
                      {lecture.venue && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3" />{lecture.venue}
                        </span>
                      )}
                      {lecture.maxParticipants && (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Users className="h-3 w-3" />{lecture.maxParticipants}
                        </span>
                      )}
                      {lecture.materials && lecture.materials.length > 0 && (
                        <button
                          className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded px-1.5 py-0.5 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <FileText className="h-3 w-3" />{lecture.materials.length} file{lecture.materials.length > 1 ? 's' : ''}
                        </button>
                      )}
                    </div>

                    {lecture.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{lecture.description}</p>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-2 border-t border-border/50">
                      {lecture.meetingLink && (lecture.status === 'scheduled' || lecture.status === 'ongoing') && (
                        <Button
                          size="sm"
                          className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1"
                          onClick={(e) => { e.stopPropagation(); handleJoinLecture(lecture); }}
                        >
                          <ExternalLink className="h-3 w-3" />Join
                        </Button>
                      )}
                      {lecture.recordingUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2.5 rounded-lg gap-1"
                          onClick={(e) => { e.stopPropagation(); handleViewRecording(lecture); }}
                        >
                          <Play className="h-3 w-3" />Recording
                        </Button>
                      )}
                      <div className="ml-auto flex items-center gap-0.5">
                        {isInstituteAdmin && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 text-xs px-2 rounded-lg gap-1" onClick={(e) => { e.stopPropagation(); handleUpdateClick(lecture); }}>
                              <Edit className="h-3 w-3" />Edit
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs px-2 rounded-lg gap-1 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteClick(lecture); }}>
                              <Trash2 className="h-3 w-3" />Delete
                            </Button>
                          </>
                        )}
                        <span className="flex items-center text-muted-foreground/60 px-1">
                          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-primary' : ''}`} />
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expandable details */}
                </Card>
                {isExpanded && (
                  <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-background border rounded-xl shadow-2xl p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
                    {/* Small caret connecting to card */}
                    <div className="absolute -top-1.5 left-6 w-3 h-3 bg-background border-l border-t rotate-45 rounded-tl-sm" />
                      {/* Schedule detail cards */}
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-muted/60 border border-border/50">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Start</span>
                          <span className="text-xs font-medium">{formatDateTime(lecture.startTime)}</span>
                        </div>
                        {lecture.endTime && (
                          <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-muted/60 border border-border/50">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">End</span>
                            <span className="text-xs font-medium">{format(new Date(lecture.endTime), 'HH:mm')}</span>
                          </div>
                        )}
                      </div>
                      {/* Materials */}
                      {lecture.materials && lecture.materials.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Materials ({lecture.materials.length})</p>
                          <div className="space-y-1">
                            {lecture.materials.map((mat, idx) => {
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
                  </div>
                )}
                </div>
              );
            })}
          </div>
          )}

          {pageViewMode !== 'table' && totalPages > 1 && (
            <div className="flex justify-center items-center gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || loading} className="rounded-xl">
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || loading} className="rounded-xl">
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Update Dialog */}
      {selectedLecture && (
        <Dialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
          <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
            <DialogTitle className="sr-only">Update Lecture</DialogTitle>
            <DialogDescription className="sr-only">Form to update an existing institute lecture</DialogDescription>
            <UpdateInstituteLectureForm
              lecture={selectedLecture}
              onClose={() => { setShowUpdateDialog(false); setSelectedLecture(null); }}
              onSuccess={handleUpdateSuccess}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Dialog */}
      <DeleteLectureConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        lectureTitle={lectureToDelete?.title || ''}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />

      {/* Recording Dialog - draggable & resizable */}
      <VideoPreviewDialog
        open={showRecordingDialog}
        onOpenChange={setShowRecordingDialog}
        url={recordingLecture?.recordingUrl || ''}
        title={recordingLecture?.title ?? 'Lecture Recording'}
        description={recordingLecture?.description}
        materials={recordingLecture?.materials}
      />
    </div>
  );
};

export default InstituteLectures;
