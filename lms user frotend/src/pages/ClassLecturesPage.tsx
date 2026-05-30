import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { lectureApi, Lecture } from '@/api/lecture.api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import {
  ExternalLink, Plus, Edit, Trash2, Play, RefreshCw, BookOpen,
  ChevronDown, LayoutGrid, Table2, FileText, Cloud, HardDrive, Link2,
  Clock, MapPin, Users, Video, ImageIcon, ArrowLeft, Maximize2, BarChart3,
} from 'lucide-react';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { format } from 'date-fns';
import CreateClassLectureForm from '@/components/forms/CreateClassLectureForm';
import UpdateClassLectureForm from '@/components/forms/UpdateClassLectureForm';
import VideoPreviewDialog from '@/components/VideoPreviewDialog';
import LectureUrlPanel from '@/components/common/LectureUrlPanel';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/api/apiError';
import MUITable from '@/components/ui/mui-table';
import { useViewMode } from '@/hooks/useViewMode';
import { EmptyState } from '@/components/ui/EmptyState';
import { buildSidebarUrl } from '@/utils/pageNavigation';

const ClassLecturesPage = () => {
  const navigate = useNavigate();
  const { user, selectedInstitute, selectedClass, currentInstituteId } = useAuth();
  const effectiveRole = useInstituteRole();
  const { toast } = useToast();
  const { viewMode } = useViewMode();

  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [showRecordingDialog, setShowRecordingDialog] = useState(false);
  const [recordingLecture, setRecordingLecture] = useState<Lecture | null>(null);
  const [recordingMode, setRecordingMode] = useState<'floating' | 'cinema'>('floating');
  const [pageViewMode, setPageViewMode] = useState<'card' | 'table'>(viewMode);
  const [expandedLectureId, setExpandedLectureId] = useState<string | null>(null);

  const instituteId = currentInstituteId ?? selectedInstitute?.id?.toString();
  const classId = selectedClass?.id?.toString();

  const canManage = effectiveRole === 'InstituteAdmin' || effectiveRole === 'Teacher';

  const fetchLectures = async (forceRefresh = false) => {
    if (!classId || !instituteId) return;
    setLoading(true);
    try {
      const response = await lectureApi.fetchLecturesWithCache({ classId, instituteId });
      const data = (response as any)?.data ?? response;
      setLectures(Array.isArray(data) ? data : []);
    } catch (error) {
      toast({
        title: 'Failed to load lectures',
        description: getErrorMessage(error, 'Could not load class lectures.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (classId && instituteId) fetchLectures();
  }, [classId, instituteId]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'scheduled': return { label: 'Scheduled', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
      case 'ongoing': return { label: 'Live Now', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 animate-pulse' };
      case 'completed': return { label: 'Completed', className: 'bg-primary/10 text-primary border-primary/20' };
      case 'cancelled': return { label: 'Cancelled', className: 'bg-destructive/10 text-destructive border-destructive/20' };
      default: return { label: status, className: 'bg-muted text-muted-foreground border-border' };
    }
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not scheduled';
    return format(new Date(dateString), 'MMM dd, yyyy • HH:mm');
  };

  const handleJoinLecture = (lecture: Lecture) => {
    if (lecture.liveAttendanceEnabled && lecture.liveUrlId) {
      window.open(`${window.location.origin}/live-lecture/${lecture.liveUrlId}`, '_blank');
      return;
    }
    if (lecture.meetingLink) {
      window.open(lecture.meetingLink, '_blank');
      return;
    }
    toast({ title: 'No meeting link', description: 'This lecture does not have a meeting link.', variant: 'destructive' });
  };

  const handleViewRecording = (lecture: Lecture, mode: 'floating' | 'cinema' = 'floating') => {
    if (lecture.recAttendanceEnabled && lecture.recUrlId) {
      window.open(`${window.location.origin}/view-recording/${lecture.recUrlId}`, '_blank');
      return;
    }
    if (lecture.recordingUrl) {
      setRecordingLecture(lecture);
      setRecordingMode(mode);
      setShowRecordingDialog(true);
    } else {
      toast({ title: 'No recording', description: 'This lecture does not have a recording.', variant: 'destructive' });
    }
  };

  const handleDeleteLecture = async (lecture: Lecture) => {
    if (!window.confirm(`Permanently delete "${lecture.title}"? This cannot be undone.`)) return;
    setIsDeletingId(lecture.id);
    try {
      await lectureApi.deleteLecture(lecture.id, { instituteId, classId });
      setLectures(prev => prev.filter(l => l.id !== lecture.id));
      toast({ title: 'Deleted', description: `${lecture.title} has been permanently deleted.`, variant: 'success' as any });
    } catch (error) {
      toast({ title: 'Delete failed', description: getErrorMessage(error, 'Could not delete the lecture.'), variant: 'destructive' });
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleCreateSuccess = async () => { setShowCreateDialog(false); await fetchLectures(true); };
  const handleUpdateClick = (lecture: Lecture) => { setSelectedLecture(lecture); setShowUpdateDialog(true); };

  const goBack = () => {
    if (instituteId && classId) {
      navigate(`/institute/${instituteId}/class/${classId}/dashboard`);
    } else {
      navigate(-1);
    }
  };

  const scheduledCount = lectures.filter(l => l.status === 'scheduled').length;
  const ongoingCount = lectures.filter(l => l.status === 'ongoing').length;
  const completedCount = lectures.filter(l => l.status === 'completed').length;

  if (!selectedClass) {
    return (
      <Card className="border-dashed border-slate-300 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Select a class first</h3>
            <p className="mt-1 text-sm text-muted-foreground">Class lectures require a class selection.</p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)} className="w-fit">Back</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={goBack} className="rounded-full shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground">Class Lectures</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedClass.name}{selectedInstitute ? ` · ${selectedInstitute.name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => fetchLectures(true)} disabled={loading} className="h-8 text-xs px-2.5">
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setPageViewMode('card')}
              className={`p-1.5 transition-colors ${pageViewMode === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPageViewMode('table')}
              className={`p-1.5 transition-colors ${pageViewMode === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
              title="Table view"
            >
              <Table2 className="h-4 w-4" />
            </button>
          </div>
          {canManage && (
            <>
              <Button
                variant="outline" size="sm" className="h-8 text-xs px-2.5"
                onClick={() => navigate(buildSidebarUrl('lecture-live-attendance', { instituteId, classId }))}
                title="Live Lecture Attendance"
              >
                <BarChart3 className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Live Att.</span>
              </Button>
              <Button
                variant="outline" size="sm" className="h-8 text-xs px-2.5"
                onClick={() => navigate(buildSidebarUrl('lecture-recording-attendance', { instituteId, classId }))}
                title="Recording Attendance"
              >
                <BarChart3 className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">Rec Att.</span>
              </Button>
            </>
          )}
          {!canManage && user && lectures.length > 0 && (
            <Button
              variant="outline" size="sm" className="h-8 text-xs px-2.5"
              onClick={() => {
                const ids = lectures.map(l => l.id).join(',');
                const base = buildSidebarUrl('lecture-recording-student', { instituteId, classId });
                navigate(`${base}?studentId=${user.id}&ids=${ids}&studentName=${encodeURIComponent((user as any).firstName || 'Me')}`);
              }}
              title="My Recording Activity"
            >
              <Video className="h-3.5 w-3.5 mr-1" /><span className="hidden sm:inline">My Activity</span>
            </Button>
          )}
          {canManage && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog} routeName="create-class-lecture-popup">
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 text-xs px-2.5">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New Lecture
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
                <DialogTitle className="sr-only">Create Class Lecture</DialogTitle>
                <DialogDescription className="sr-only">Form to create a new class lecture</DialogDescription>
                <CreateClassLectureForm onClose={() => setShowCreateDialog(false)} onSuccess={handleCreateSuccess} />
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
          title="No Class Lectures Yet"
          description={`No lectures for ${selectedClass.name} yet.${canManage ? ' Create the first one to get started.' : ''}`}
        />
      ) : pageViewMode === 'table' ? (
        <MUITable
          title=""
          data={lectures}
          columns={[
            {
              id: 'title', label: 'Title', minWidth: 200,
              format: (val: string, row: any) => (
                <div className="flex items-center gap-2">
                  {row.thumbnailUrl && (
                    <div className="h-8 aspect-video rounded overflow-hidden shrink-0 bg-muted">
                      <img src={getImageUrl(row.thumbnailUrl)} alt={val} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div>
                    <div className="font-medium">{val}</div>
                    {row.description && <div className="text-xs text-muted-foreground line-clamp-1">{row.description}</div>}
                  </div>
                </div>
              ),
            },
            {
              id: 'status', label: 'Status', minWidth: 120,
              format: (val: string) => {
                const cfg = getStatusConfig(val);
                return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
              },
            },
            {
              id: 'lectureType', label: 'Type', minWidth: 100,
              format: (val: string) => <Badge variant="secondary" className="capitalize">{val}</Badge>,
            },
            {
              id: 'subject', label: 'Subject', minWidth: 130,
              format: (val: string) => val ? <Badge variant="outline" className="text-xs text-primary border-primary/30 bg-primary/5">{val}</Badge> : <span className="text-muted-foreground text-xs">—</span>,
            },
            {
              id: 'startTime', label: 'Start Time', minWidth: 170,
              format: (val: string) => val ? formatDateTime(val) : '—',
            },
            {
              id: 'endTime', label: 'End Time', minWidth: 100,
              format: (val: string) => val ? format(new Date(val), 'HH:mm') : '—',
            },
            {
              id: 'venue', label: 'Venue', minWidth: 120,
              format: (val: string) => val || <span className="text-muted-foreground text-xs">—</span>,
            },
            {
              id: 'materials', label: 'Materials', minWidth: 130,
              format: (_: any, row: any) => {
                const mats = row.materials || [];
                if (mats.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
                return (
                  <div className="space-y-0.5">
                    {mats.slice(0, 2).map((m: any, i: number) => {
                      const icon = m.source === 'S3'
                        ? <Cloud className="h-3 w-3 text-emerald-500 shrink-0" />
                        : (m.source === 'GOOGLE_DRIVE' || m.source === 'GOOGLE_DRIVE_INSTITUTE')
                          ? <HardDrive className="h-3 w-3 text-blue-500 shrink-0" />
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
              },
            },
            {
              id: 'id', label: 'Actions', minWidth: 200,
              format: (_: any, row: any) => (
                <div className="flex flex-wrap items-center gap-1">
                  <LectureUrlPanel
                    liveAttendanceEnabled={row.liveAttendanceEnabled}
                    liveUrlId={row.liveUrlId}
                    recAttendanceEnabled={row.recAttendanceEnabled}
                    recUrlId={row.recUrlId}
                    compact
                  />
                  {row.meetingLink && (row.status === 'scheduled' || row.status === 'ongoing') && (
                    <Button size="sm" onClick={() => handleJoinLecture(row)} className="h-7 text-xs rounded-lg gap-1">
                      <ExternalLink className="h-3.5 w-3.5" />Join
                    </Button>
                  )}
                  {row.recordingUrl && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => handleViewRecording(row)} className="h-7 text-xs rounded-lg gap-1">
                        <Play className="h-3.5 w-3.5" />Recording
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleViewRecording(row, 'cinema')}
                        title="Open in full view" className="h-7 text-xs rounded-lg gap-1">
                        <Maximize2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {canManage && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => handleUpdateClick(row)} className="h-7 text-xs rounded-lg gap-1">
                        <Edit className="h-3.5 w-3.5" />Edit
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => handleDeleteLecture(row)}
                        disabled={isDeletingId === row.id}
                        className="h-7 text-xs rounded-lg gap-1 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />Delete
                      </Button>
                    </>
                  )}
                </div>
              ),
            },
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-muted group">
                    {thumbnailSrc ? (
                      <img src={thumbnailSrc} alt={lecture.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50 gap-2">
                        <ImageIcon className="h-10 w-10" />
                        <span className="text-xs font-medium">No Thumbnail</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <Badge variant="outline" className={`absolute top-2 left-2 ${statusConfig.className} text-[10px] font-semibold px-2 py-0.5 backdrop-blur-sm bg-background/80`}>
                      {statusConfig.label}
                    </Badge>
                    <Badge variant="secondary" className="absolute top-2 right-2 text-[10px] capitalize backdrop-blur-sm bg-background/80">
                      {lecture.lectureType === 'online' ? <Video className="h-3 w-3 mr-1" /> : <MapPin className="h-3 w-3 mr-1" />}
                      {lecture.lectureType}
                    </Badge>
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h3 className="font-semibold text-sm text-white line-clamp-2 drop-shadow-md">{lecture.title}</h3>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-3 flex-1 flex flex-col gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span>{formatDateTime(lecture.startTime)}</span>
                      {lecture.endTime && <span>– {format(new Date(lecture.endTime), 'HH:mm')}</span>}
                    </div>

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

                    {(lecture.liveAttendanceEnabled || lecture.recAttendanceEnabled) && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <LectureUrlPanel
                          liveAttendanceEnabled={lecture.liveAttendanceEnabled}
                          liveUrlId={lecture.liveUrlId}
                          recAttendanceEnabled={lecture.recAttendanceEnabled}
                          recUrlId={lecture.recUrlId}
                          compact
                        />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-2 border-t border-border/50">
                      {lecture.meetingLink && (lecture.status === 'scheduled' || lecture.status === 'ongoing') && (
                        <Button size="sm" className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1"
                          onClick={(e) => { e.stopPropagation(); handleJoinLecture(lecture); }}>
                          <ExternalLink className="h-3 w-3" />Join
                        </Button>
                      )}
                      {lecture.recordingUrl && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2.5 rounded-lg gap-1"
                            onClick={(e) => { e.stopPropagation(); handleViewRecording(lecture); }}>
                            <Play className="h-3 w-3" />Recording
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2 rounded-lg gap-1"
                            title="Open in full view"
                            onClick={(e) => { e.stopPropagation(); handleViewRecording(lecture, 'cinema'); }}>
                            <Maximize2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      <div className="ml-auto flex items-center gap-0.5">
                        {canManage && (
                          <>
                            <Button size="sm" variant="ghost" className="h-7 text-xs px-2 rounded-lg gap-1"
                              onClick={(e) => { e.stopPropagation(); handleUpdateClick(lecture); }}>
                              <Edit className="h-3 w-3" />Edit
                            </Button>
                            <Button size="sm" variant="ghost"
                              className="h-7 text-xs px-2 rounded-lg gap-1 text-destructive hover:text-destructive"
                              disabled={isDeletingId === lecture.id}
                              onClick={(e) => { e.stopPropagation(); handleDeleteLecture(lecture); }}>
                              <Trash2 className="h-3 w-3" />Delete
                            </Button>
                          </>
                        )}
                        <span className="flex items-center text-muted-foreground/60 px-1">
                          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-primary' : ''}`} />
                        </span>
                      </div>
                    </div>

                    {/* Expanded: shareable URLs */}
                    {isExpanded && (lecture.liveAttendanceEnabled || lecture.recAttendanceEnabled) && (
                      <div className="border-t border-border/50 pt-2" onClick={(e) => e.stopPropagation()}>
                        <LectureUrlPanel
                          liveAttendanceEnabled={lecture.liveAttendanceEnabled}
                          liveUrlId={lecture.liveUrlId}
                          recAttendanceEnabled={lecture.recAttendanceEnabled}
                          recUrlId={lecture.recUrlId}
                        />
                      </div>
                    )}

                    {/* Expanded materials */}
                    {isExpanded && lecture.materials && lecture.materials.length > 0 && (
                      <div className="border-t border-border/50 pt-2 space-y-1" onClick={(e) => e.stopPropagation()}>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Materials</p>
                        {lecture.materials.map((m, i) => {
                          const icon = m.source === 'S3'
                            ? <Cloud className="h-3 w-3 text-emerald-500 shrink-0" />
                            : (m.source === 'GOOGLE_DRIVE' || m.source === 'GOOGLE_DRIVE_INSTITUTE')
                              ? <HardDrive className="h-3 w-3 text-blue-500 shrink-0" />
                              : <Link2 className="h-3 w-3 text-orange-500 shrink-0" />;
                          return (
                            <a key={i} href={m.driveWebViewLink || m.documentUrl} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-0.5">
                              {icon}
                              <span className="truncate">{m.documentName}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Recording dialog */}
      {showRecordingDialog && recordingLecture && (
        <VideoPreviewDialog
          isOpen={showRecordingDialog}
          onClose={() => { setShowRecordingDialog(false); setRecordingLecture(null); }}
          title={recordingLecture.title}
          videoUrl={recordingLecture.recordingUrl || ''}
          videoType="application/x-mpegURL" // Assuming HLS format, adjust if needed
        />
      )}

      {/* Update dialog */}
      {showUpdateDialog && selectedLecture && (
        <Dialog open={showUpdateDialog} onOpenChange={(open) => { if (!open) { setShowUpdateDialog(false); setSelectedLecture(null); } }} routeName="edit-class-lecture-popup">
          <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
            <DialogTitle className="sr-only">Edit Class Lecture</DialogTitle>
            <DialogDescription className="sr-only">Form to update this class lecture</DialogDescription>
            <UpdateClassLectureForm
              lecture={selectedLecture}
              onClose={() => { setShowUpdateDialog(false); setSelectedLecture(null); }}
              onSuccess={async () => { setShowUpdateDialog(false); setSelectedLecture(null); await fetchLectures(true); }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ClassLecturesPage;
