import React, { useState, useMemo } from 'react';
import { ErrorState } from '@/components/ui/PageState';
import { useNavigate } from 'react-router-dom';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useToast } from '@/hooks/use-toast';
import { useTableData } from '@/hooks/useTableData';
import { cachedApiClient } from '@/api/cachedClient';
import { AccessControl } from '@/utils/permissions';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardSubjectCards from '@/components/dashboard/DashboardSubjectCards';
import FeaturesSection from '@/components/dashboard/FeaturesSection';
import { AttendanceFeedWidget } from '@/components/dashboard/DashboardWidgets';
import LectureUrlPanel from '@/components/common/LectureUrlPanel';
import CreateLectureForm from '@/components/forms/CreateLectureForm';
import UpdateLectureForm from '@/components/forms/UpdateLectureForm';
import CreateExamForm from '@/components/forms/CreateExamForm';
import { UpdateExamForm } from '@/components/forms/UpdateExamForm';
import VideoPreviewDialog from '@/components/VideoPreviewDialog';
import DeleteConfirmDialog from '@/components/forms/DeleteConfirmDialog';
import MUITable from '@/components/ui/mui-table';
import {
  Video, FileText, RefreshCw, Plus, ExternalLink,
  ChevronDown, BarChart3, Eye, Calendar, Loader2,
  ChevronLeft, ChevronRight, BookOpen, School, Building2,
  LayoutGrid, Table2, Cloud, HardDrive, Link2, Clock, MapPin, ImageIcon } from
'lucide-react';
import { buildSidebarUrl } from '@/utils/pageNavigation';

const SubjectDashboard = () => {
  const navigate = useNavigate();
  const { user, selectedInstitute, selectedClass, selectedSubject, setSelectedSubject, setSelectedClass, currentInstituteId, currentClassId, currentSubjectId } = useAuth();
  const userRole = useInstituteRole();
  const { toast } = useToast();

  // View mode toggles — read from global setting
  const [lecturesViewMode, setLecturesViewMode] = useState<'card' | 'table'>(() =>
    (localStorage.getItem('viewMode') as 'card' | 'table') || 'card'
  );
  const [examsViewMode, setExamsViewMode] = useState<'card' | 'table'>(() =>
    (localStorage.getItem('viewMode') as 'card' | 'table') || 'card'
  );

  // Lecture dialogs
  const [isCreateLectureOpen, setIsCreateLectureOpen] = useState(false);
  const [isEditLectureOpen, setIsEditLectureOpen] = useState(false);
  const [selectedLecture, setSelectedLecture] = useState<any>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [videoPreviewTitle, setVideoPreviewTitle] = useState('');
  const [videoPreviewLecture, setVideoPreviewLecture] = useState<any>(null);

  // Exam dialogs
  const [isCreateExamOpen, setIsCreateExamOpen] = useState(false);
  const [isEditExamOpen, setIsEditExamOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<any>(null);

  // Expanded card tracking
  const [expandedLecture, setExpandedLecture] = useState<string | null>(null);
  const [expandedExam, setExpandedExam] = useState<string | null>(null);

  // Scroll ref for horizontal lecture row
  const lectureScrollRef = React.useRef<HTMLDivElement>(null);
  const scrollLectures = (dir: 'left' | 'right') => {
    if (!lectureScrollRef.current) return;
    const amount = lectureScrollRef.current.clientWidth * 0.7;
    lectureScrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: any; type: string }>({ open: false, item: null, type: '' });
  const [isDeleting, setIsDeleting] = useState(false);

  const lectureParams = useMemo(() => {
    const params: Record<string, any> = {};
    if (currentInstituteId) params.instituteId = currentInstituteId;
    if (currentClassId) params.classId = currentClassId;
    if (currentSubjectId) params.subjectId = currentSubjectId;
    if (userRole === 'Teacher' && user?.id) params.instructorId = user.id;
    return params;
  }, [currentInstituteId, currentClassId, currentSubjectId, userRole, user?.id]);

  const examParams = useMemo(() => {
    const params: Record<string, any> = {};
    if (currentInstituteId) params.instituteId = currentInstituteId;
    if (currentClassId) params.classId = currentClassId;
    if (currentSubjectId) params.subjectId = currentSubjectId;
    if (userRole === 'Teacher' && user?.id) params.teacherId = user.id;
    return params;
  }, [currentInstituteId, currentClassId, currentSubjectId, userRole, user?.id]);

  // Lectures data
  const lecturesTable = useTableData({
    endpoint: '/institute-class-subject-lectures',
    defaultParams: lectureParams,
    dependencies: [currentInstituteId, currentClassId, currentSubjectId],
    pagination: { defaultLimit: 50, availableLimits: [25, 50, 100] },
    autoLoad: true
  });

  // Exams data
  const examsTable = useTableData({
    endpoint: '/institute-class-subject-exams',
    defaultParams: examParams,
    dependencies: [currentInstituteId, currentClassId, currentSubjectId],
    pagination: { defaultLimit: 50, availableLimits: [25, 50, 100] },
    autoLoad: true
  });

  const lectures = lecturesTable.state.data;
  const exams = examsTable.state.data;

  const canAdd = ['InstituteAdmin', 'Teacher'].includes(userRole);
  const canEdit = userRole === 'Teacher' || AccessControl.hasPermission(userRole, 'edit-lecture');
  const canDelete = userRole === 'Teacher' || AccessControl.hasPermission(userRole, 'delete-lecture');

  const getContextTitle = () => {
    const parts = [];
    if (selectedInstitute) parts.push(selectedInstitute.name);
    if (selectedClass) parts.push(selectedClass.name);
    if (selectedSubject) parts.push(selectedSubject.name);
    return parts.length > 0 ? `(${parts.join(' → ')})` : '';
  };

  // ── Lecture handlers ──
  const handleEditLecture = (l: any) => {setSelectedLecture(l);setIsEditLectureOpen(true);};
  const handleDeleteLecture = (l: any) => {
    setDeleteDialog({ open: true, item: l, type: 'lecture' });
  };
  const confirmDelete = async () => {
    if (!deleteDialog.item) return;
    setIsDeleting(true);
    try {
      // Data loaded from /institute-class-subject-lectures — use PATCH to soft-deactivate (DELETE is SUPERADMIN-only)
      await cachedApiClient.patch(`/institute-class-subject-lectures/${deleteDialog.item.id}`, { isActive: false });
      toast({ title: "Deleted", description: `Lecture "${deleteDialog.item.title}" deleted.`, variant: "destructive" });
      setDeleteDialog({ open: false, item: null, type: '' });
      lecturesTable.actions.refresh();
    } catch {
      toast({ title: "Failed", description: "Could not delete lecture.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRecordingClick = (url: string, title: string, lecture?: any) => {
    if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('drive.google.com')) {
      setVideoPreviewUrl(url); setVideoPreviewTitle(title); setVideoPreviewLecture(lecture || null);
    } else {window.open(url, '_blank');}
  };

  // ── Exam handlers ──
  const handleEditExam = (e: any) => {setSelectedExam(e);setIsEditExamOpen(true);};
  const handleViewResults = (exam: any) => {
    const instId = exam.instituteId || currentInstituteId;
    const clsId = exam.classId || currentClassId;
    const subId = exam.subjectId || currentSubjectId;
    if (!instId || !clsId || !subId) {toast({ title: "Missing Context", description: "Select institute, class, and subject first", variant: "destructive" });return;}
    navigate(`/institute/${instId}/class/${clsId}/subject/${subId}/exam/${exam.id}/results`);
  };
  const handleCreateResults = (exam: any) => {
    if (!currentInstituteId || !currentClassId || !currentSubjectId) {toast({ title: "Missing Context", description: "Select institute, class, and subject first", variant: "destructive" });return;}
    navigate(`/institute/${currentInstituteId}/class/${currentClassId}/subject/${currentSubjectId}/exam/${exam.id}/create-results`);
  };

  // ── Table columns (MUITable format) ──
  const lectureColumns = [
    { id: 'title', label: 'Title', minWidth: 180, format: (val: string, row: any) => (
      <div className="flex items-center gap-2">
        {(row.thumbnailUrl || row.thumbnail_url) && <div className="h-8 aspect-video rounded overflow-hidden shrink-0 bg-muted"><img src={getImageUrl(row.thumbnailUrl || row.thumbnail_url)} alt={val} className="w-full h-full object-cover" /></div>}
        <div><div className="font-medium text-sm">{val}</div>{row.description && <div className="text-xs text-muted-foreground line-clamp-1">{row.description}</div>}</div>
      </div>
    )},
    { id: 'lectureType', label: 'Type', minWidth: 90, format: (v: string) => <Badge variant="outline" className="capitalize">{v}</Badge> },
    { id: 'startTime', label: 'Start', minWidth: 150, format: (v: string) => v ? new Date(v).toLocaleString() : '—' },
    { id: 'status', label: 'Status', minWidth: 110, format: (v: string) => <Badge variant={v === 'scheduled' ? 'default' : v === 'completed' ? 'secondary' : 'destructive'}>{v}</Badge> },
    { id: 'materials', label: 'Materials', minWidth: 130, format: (_: any, row: any) => {
      const mats = Array.isArray(row.materials) ? row.materials : [];
      if (mats.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <div className="space-y-0.5">
          {mats.slice(0, 2).map((m: any, i: number) => {
            const icon = m.source === 'S3' ? <Cloud className="h-3 w-3 text-emerald-500 shrink-0" />
              : (m.source === 'GOOGLE_DRIVE' || m.source === 'GOOGLE_DRIVE_INSTITUTE') ? <HardDrive className="h-3 w-3 text-blue-500 shrink-0" />
              : <Link2 className="h-3 w-3 text-orange-500 shrink-0" />;
            return (
              <a key={i} href={m.driveWebViewLink || m.documentUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                {icon}<span className="truncate max-w-[100px]">{m.documentName}</span>
              </a>
            );
          })}
          {mats.length > 2 && <span className="text-[10px] text-muted-foreground">+{mats.length - 2} more</span>}
        </div>
      );
    }},
    { id: 'meetingLink', label: 'Join', minWidth: 80, format: (v: string, row: any) => v && (row.status === 'scheduled' || row.status === 'ongoing') ? (
      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs" onClick={() => window.open(v, '_blank')}>
        <ExternalLink className="h-3 w-3 mr-1" />Join
      </Button>
    ) : <span className="text-muted-foreground text-xs">—</span> },
    { id: 'recordingUrl', label: 'Recording', minWidth: 100, format: (v: string, row: any) => {
      const url = v || row.recording_url;
      return url ? <Button size="sm" className="h-7 text-xs" onClick={() => handleRecordingClick(url, row.title, row)}><Video className="h-3 w-3 mr-1" />View</Button> : <span className="text-muted-foreground text-xs">—</span>;
    }},
    ...(canEdit || canDelete ? [{ id: 'id', label: 'Actions', minWidth: 120, format: (_: any, row: any) => (
      <div className="flex gap-1">
        {canEdit && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleEditLecture(row)}>Edit</Button>}
        {canDelete && <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleDeleteLecture(row)}>Delete</Button>}
      </div>
    )}] : []),
  ];


  const examColumns = [
  { key: 'title', header: 'Title' },
  { key: 'examType', header: 'Type', render: (v: string) => <Badge variant={v === 'online' ? 'default' : 'secondary'}>{v}</Badge> },
  { key: 'scheduleDate', header: 'Date', render: (v: string) => v ? new Date(v).toLocaleDateString() : 'N/A' },
  { key: 'totalMarks', header: 'Total Marks' },
  { key: 'status', header: 'Status', render: (v: string) => <Badge variant={v === 'scheduled' ? 'default' : v === 'completed' ? 'outline' : v === 'draft' ? 'secondary' : 'destructive'}>{v}</Badge> },
  ...(canAdd ? [{ key: 'createResults', header: 'Create Results', render: (_: any, row: any) => <Button size="sm" variant="outline" onClick={() => handleCreateResults(row)}><BarChart3 className="h-3 w-3 mr-1" />Create</Button> }] : []),
  { key: 'results', header: 'Results', render: (_: any, row: any) => <Button size="sm" variant="default" onClick={() => handleViewResults(row)}><Eye className="h-3 w-3 mr-1" />View</Button> }];


  if (!selectedInstitute || !selectedClass || !selectedSubject) {
    return (
      <div className="container mx-auto p-4 sm:p-6 text-center py-8 sm:py-12">
        <Calendar className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-2xl font-bold mb-4">Subject Dashboard</h2>
        <p className="text-muted-foreground">Please select an institute, class, and subject to view the dashboard.</p>
      </div>);

  }

  const contextTitle = getContextTitle();

  // ── Expandable Card Item — thumbnail grid style matching Lectures page ──
  const LectureCard = ({ item }: {item: any;}) => {
    const isOpen = expandedLecture === item.id;
    const recUrl = item.recordingUrl || item.recording_url;
    const rawThumbUrl = item.thumbnailUrl || item.thumbnail_url;
    const thumbSrc = rawThumbUrl ? getImageUrl(rawThumbUrl) : '';
    return (
      <Card className={`overflow-hidden transition-all duration-200 flex flex-col cursor-pointer w-[260px] sm:w-[280px] shrink-0 snap-start ${isOpen ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'}`} onClick={() => setExpandedLecture(isOpen ? null : item.id)}>
        {/* Thumbnail */}
        <div className="relative aspect-video bg-muted group">
          {thumbSrc ? (
            <img src={thumbSrc} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40 gap-1">
              <ImageIcon className="h-8 w-8" />
              <span className="text-[10px] font-medium">No Thumbnail</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <Badge variant={item.status === 'scheduled' ? 'default' : item.status === 'completed' ? 'secondary' : 'destructive'} className="absolute top-2 left-2 text-[10px] px-1.5 py-0 backdrop-blur-sm bg-background/80">{item.status}</Badge>
          <Badge variant="secondary" className="absolute top-2 right-2 text-[10px] capitalize backdrop-blur-sm bg-background/80">{item.lectureType}</Badge>
          <div className="absolute bottom-0 left-0 right-0 p-2.5">
            <p className="font-semibold text-sm text-white line-clamp-2 drop-shadow-md">{item.title}</p>
          </div>
        </div>
        {/* Card body */}
        <div className="p-2.5 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span>{item.startTime ? new Date(item.startTime).toLocaleDateString() : 'No date'}</span>
          </div>
          {item.venue && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" />{item.venue}
            </span>
          )}
          {(item.liveAttendanceEnabled || item.recAttendanceEnabled) && (
            <div onClick={(e) => e.stopPropagation()}>
              <LectureUrlPanel
                liveAttendanceEnabled={item.liveAttendanceEnabled}
                liveUrlId={item.liveUrlId}
                recAttendanceEnabled={item.recAttendanceEnabled}
                recUrlId={item.recUrlId}
                compact
              />
            </div>
          )}
          <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/50">
            {item.meetingLink && (
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs rounded-lg gap-1" onClick={(e) => { e.stopPropagation(); window.open(item.meetingLink, '_blank'); }}>
                <ExternalLink className="h-3 w-3" />Join
              </Button>
            )}
            {recUrl && (
              <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg gap-1" onClick={(e) => { e.stopPropagation(); handleRecordingClick(recUrl, item.title, item); }}>
                <Video className="h-3 w-3" />Rec
              </Button>
            )}
            {canEdit && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); handleEditLecture(item); }}>Edit</Button>
            )}
            <span className="ml-auto flex items-center text-muted-foreground/60">
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
            </span>
          </div>
        </div>
        {/* Expanded details */}
        {isOpen && (
          <div className="px-2.5 pb-3 pt-0 flex flex-col gap-2 border-t border-border/60 bg-muted/30" onClick={(e) => e.stopPropagation()}>
            {item.description && <p className="text-xs text-muted-foreground pt-2">{item.description}</p>}
            <LectureUrlPanel
              liveAttendanceEnabled={item.liveAttendanceEnabled}
              liveUrlId={item.liveUrlId}
              recAttendanceEnabled={item.recAttendanceEnabled}
              recUrlId={item.recUrlId}
            />
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-background border border-border/50">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Start</span>
                <span className="text-xs font-medium">{item.startTime ? new Date(item.startTime).toLocaleString() : 'N/A'}</span>
              </div>
              {item.endTime && (
                <div className="flex flex-col gap-0.5 p-2 rounded-lg bg-background border border-border/50">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">End</span>
                  <span className="text-xs font-medium">{new Date(item.endTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                </div>
              )}
            </div>
            {Array.isArray(item.materials) && item.materials.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Materials</p>
                {item.materials.map((mat: any, idx: number) => {
                  const icon = mat.source === 'S3' ? <Cloud className="h-3 w-3 text-emerald-500 shrink-0" />
                    : (mat.source === 'GOOGLE_DRIVE' || mat.source === 'GOOGLE_DRIVE_INSTITUTE') ? <HardDrive className="h-3 w-3 text-blue-500 shrink-0" />
                    : <Link2 className="h-3 w-3 text-orange-500 shrink-0" />;
                  return (
                    <a key={idx} href={mat.driveWebViewLink || mat.documentUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 p-1.5 rounded-lg bg-background border border-border/50 text-xs text-muted-foreground hover:text-primary">
                      {icon}<span className="truncate flex-1">{mat.documentName}</span><ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  );
                })}
              </div>
            )}
            {canDelete && (
              <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30 w-fit" onClick={() => handleDeleteLecture(item)}>Delete</Button>
            )}
          </div>
        )}
      </Card>
    );
  };

  const ExamCard = ({ item }: {item: any;}) => {
    const isOpen = expandedExam === item.id;
    return (
      <Collapsible open={isOpen} onOpenChange={() => setExpandedExam(isOpen ? null : item.id)}>
        <CollapsibleTrigger asChild>
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.title}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <span>{item.scheduleDate ? new Date(item.scheduleDate).toLocaleDateString() : 'No date'}</span>
                  <span>•</span>
                  <Badge variant={item.examType === 'online' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">{item.examType}</Badge>
                  <Badge variant={item.status === 'scheduled' ? 'default' : item.status === 'completed' ? 'outline' : 'destructive'} className="text-[10px] px-1.5 py-0">{item.status}</Badge>
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </CardContent>
          </Card>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 space-y-2 border-x border-b rounded-b-2xl bg-muted/30">
            {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
            <p className="text-xs"><span className="font-medium">Total Marks:</span> {item.totalMarks || 'N/A'}</p>
            <p className="text-xs"><span className="font-medium">Passing Marks:</span> {item.passingMarks || 'N/A'}</p>
            <p className="text-xs"><span className="font-medium">Duration:</span> {item.durationMinutes ? `${item.durationMinutes} min` : 'N/A'}</p>
            {item.venue && <p className="text-xs"><span className="font-medium">Venue:</span> {item.venue}</p>}
            <p className="text-xs"><span className="font-medium">Start:</span> {item.startTime ? new Date(item.startTime).toLocaleString() : 'N/A'}</p>
            <div className="flex flex-wrap gap-2 pt-2">
              {item.examLink &&
              <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => window.open(item.examLink, '_blank')}>
                  <ExternalLink className="h-3 w-3 mr-1" />Exam Link
                </Button>
              }
              <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => handleViewResults(item)}>
                <Eye className="h-3 w-3 mr-1" />Results
              </Button>
              {canAdd &&
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleCreateResults(item)}>
                  <BarChart3 className="h-3 w-3 mr-1" />Create Results
                </Button>
              }
              {canEdit &&
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleEditExam(item)}>Edit</Button>
              }
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>);

  };

  const firstName = user?.name?.split(' ')[0] || '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="space-y-3 sm:space-y-4 pb-24 sm:pb-12 px-3 sm:px-4">
      {/* Greeting Section */}
      <div className="pt-2 pb-1">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
          {greeting}, <span className="text-primary">{firstName}</span>!
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          You are exploring <span className="font-semibold text-foreground">{selectedSubject.name}</span> in <span className="text-foreground">{selectedClass.name}</span>.
        </p>
      </div>
      {/* Breadcrumb */}
      <div className="pt-2 flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm text-muted-foreground overflow-x-auto">
        <button
          onClick={() => { setSelectedSubject(null); setSelectedClass(null); if (selectedInstitute) navigate(`/institute/${selectedInstitute.id}/dashboard`); }}
          className="hover:text-foreground transition-colors flex items-center gap-1 shrink-0 active:scale-95 p-1 rounded hover:bg-muted/50"
        >
          <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-[80px] sm:max-w-[120px]">{selectedInstitute?.shortName || selectedInstitute?.name}</span>
        </button>
        <span className="shrink-0">/</span>
        <button
          onClick={() => { setSelectedSubject(null); if (selectedInstitute && selectedClass) navigate(`/institute/${selectedInstitute.id}/class/${selectedClass.id}/dashboard`); }}
          className="hover:text-foreground transition-colors flex items-center gap-1 truncate active:scale-95 p-1 rounded hover:bg-muted/50"
        >
          <School className="h-3 w-3 shrink-0" />
          <span className="truncate">{selectedClass?.name}</span>
        </button>
      </div>

      {/* Subject header */}
      <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl shrink-0 overflow-hidden">
            {((selectedSubject as any).imgUrl || (selectedSubject as any).image || (selectedSubject as any).thumbnail) ? (
              <img
                src={getImageUrl((selectedSubject as any).imgUrl || (selectedSubject as any).image || (selectedSubject as any).thumbnail)}
                alt={selectedSubject.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-violet-500/10 flex items-center justify-center">
                <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-violet-500" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-foreground truncate">{selectedSubject.name}</h2>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground truncate">{selectedClass?.name}</span>
              {(selectedSubject as any).code && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono shrink-0">
                  {(selectedSubject as any).code}
                </span>
              )}
              {(selectedSubject as any).type && (
                <span className="text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded shrink-0">
                  {(selectedSubject as any).type}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Subject switcher */}
      <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm">
        <DashboardSubjectCards />
      </div>

      {/* Quick Access Features */}
      <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm">
        <FeaturesSection level="subject" />
      </div>

      {/* Lectures */}
      <div className="bg-card border border-border rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 sm:p-4 pb-2 sm:pb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 flex-shrink-0">
            <Video className="h-4 w-4 text-blue-500" />
            Lectures
            {lectures.length > 0 && <span className="text-xs font-normal text-muted-foreground">({lectures.length})</span>}
          </h3>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button onClick={() => setLecturesViewMode('card')} className={`p-1.5 transition-colors ${lecturesViewMode === 'card' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`} title="Card view"><LayoutGrid className="h-3.5 w-3.5" /></button>
              <button onClick={() => setLecturesViewMode('table')} className={`p-1.5 transition-colors ${lecturesViewMode === 'table' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`} title="Table view"><Table2 className="h-3.5 w-3.5" /></button>
            </div>
            <button onClick={lecturesTable.actions.refresh} className="p-1.5 rounded-lg hover:bg-muted transition-colors active:scale-95">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <Button
              size="sm" variant="outline" className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
              onClick={() => navigate(buildSidebarUrl('lecture-live-attendance', {
                instituteId: currentInstituteId,
                classId: currentClassId,
                subjectId: currentSubjectId,
              }))}
            >
              <BarChart3 className="h-3 w-3 mr-1" />Live
            </Button>
            <Button
              size="sm" variant="outline" className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
              onClick={() => navigate(buildSidebarUrl('lecture-recording-attendance', {
                instituteId: currentInstituteId,
                classId: currentClassId,
                subjectId: currentSubjectId,
              }))}
            >
              <BarChart3 className="h-3 w-3 mr-1" />Rec
            </Button>
            {canAdd && (
              <Button size="sm" className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3" onClick={() => setIsCreateLectureOpen(true)}>
                <Plus className="h-3 w-3 mr-1" />Add
              </Button>
            )}
          </div>
        </div>
        {lectures.length > 0 && (
          <div className="px-3 sm:px-4 pb-2 sm:pb-3 grid grid-cols-3 gap-2">
            {[
              { label: 'Scheduled', value: lectures.filter((l: any) => l.status === 'scheduled').length },
              { label: 'Live Now', value: lectures.filter((l: any) => l.status === 'ongoing' || l.status === 'in_progress').length },
              { label: 'Completed', value: lectures.filter((l: any) => l.status === 'completed').length },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg sm:rounded-xl bg-muted/60 border border-border/50 p-2 text-center">
                <div className="text-base sm:text-lg font-bold">{value}</div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        )}
        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
          {lecturesTable.state.loading ? (
            <div className="flex justify-center py-6 sm:py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : lecturesTable.state.error ? (
            <ErrorState error={lecturesTable.state.error} onRetry={() => lecturesTable.actions.refresh()} />
          ) : lectures.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-muted-foreground">
              <Video className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No lectures yet</p>
              {canAdd && (
                <Button size="sm" variant="outline" className="mt-2 sm:mt-3 h-7 sm:h-8 text-xs sm:text-sm" onClick={() => setIsCreateLectureOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" />Add Lecture
                </Button>
              )}
            </div>
          ) : lecturesViewMode === 'table' ? (
            <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
              <MUITable
                title=""
                data={lectures}
                columns={lectureColumns}
                page={0}
                rowsPerPage={lectures.length || 50}
                totalCount={lectures.length}
                onPageChange={() => {}}
                onRowsPerPageChange={() => {}}
                allowAdd={false}
                allowEdit={false}
                allowDelete={false}
              />
            </div>
          ) : (
            <div className="relative -mx-3 sm:mx-0">
              {lectures.length > 1 && (
                <>
                  <button onClick={() => scrollLectures('left')} className="absolute -left-1 sm:-left-2 top-1/2 -translate-y-1/2 z-10 h-7 sm:h-8 w-7 sm:w-8 rounded-full bg-background border border-border shadow-md flex items-center justify-center hover:bg-muted transition-colors active:scale-95">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => scrollLectures('right')} className="absolute -right-1 sm:-right-2 top-1/2 -translate-y-1/2 z-10 h-7 sm:h-8 w-7 sm:w-8 rounded-full bg-background border border-border shadow-md flex items-center justify-center hover:bg-muted transition-colors active:scale-95">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
              <div ref={lectureScrollRef} className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide px-6 sm:px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {lectures.map((l: any) => <LectureCard key={l.id} item={l} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Exams */}
      <div className="bg-card border border-border rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 sm:p-4 pb-2 sm:pb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-rose-500" />
            Exams
            {exams.length > 0 && <span className="text-xs font-normal text-muted-foreground">({exams.length})</span>}
          </h3>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button onClick={examsTable.actions.refresh} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {canAdd && (
              <Button size="sm" className="h-7 text-xs" onClick={() => setIsCreateExamOpen(true)}>
                <Plus className="h-3 w-3 mr-1" />Add
              </Button>
            )}
          </div>
        </div>
        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
          {examsTable.state.loading ? (
            <div className="flex justify-center py-6 sm:py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : examsTable.state.error ? (
            <ErrorState error={examsTable.state.error} onRetry={() => examsTable.actions.refresh()} />
          ) : exams.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No exams yet</p>
              {canAdd && (
                <Button size="sm" variant="outline" className="mt-2 sm:mt-3 h-7 sm:h-8 text-xs sm:text-sm" onClick={() => setIsCreateExamOpen(true)}>
                  <Plus className="h-3 w-3 mr-1" />Add Exam
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {exams.map((e: any) => <ExamCard key={e.id} item={e} />)}
            </div>
          )}
        </div>
      </div>

      {/* My Attendance */}
      <AttendanceFeedWidget filterInstituteId={selectedInstitute.id} />

      {/* Create Lecture Dialog */}
      <Dialog open={isCreateLectureOpen} onOpenChange={setIsCreateLectureOpen} routeName="create-subject-lecture-popup">
        <DialogContent className="w-[95vw] sm:w-full max-w-xl sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Lecture</DialogTitle>
          </DialogHeader>
          <CreateLectureForm
            onClose={() => setIsCreateLectureOpen(false)}
            onSuccess={() => { setIsCreateLectureOpen(false); lecturesTable.actions.refresh(); }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Lecture Dialog */}
      <Dialog open={isEditLectureOpen} onOpenChange={setIsEditLectureOpen} routeName="edit-subject-lecture-popup">
        <DialogContent className="w-[95vw] sm:w-full max-w-xl sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lecture</DialogTitle>
          </DialogHeader>
          {selectedLecture && (
            <UpdateLectureForm
              lecture={selectedLecture}
              onClose={() => setIsEditLectureOpen(false)}
              onSuccess={() => { setIsEditLectureOpen(false); lecturesTable.actions.refresh(); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create Exam Dialog */}
      <Dialog open={isCreateExamOpen} onOpenChange={setIsCreateExamOpen} routeName="create-subject-exam-popup">
        <DialogContent className="w-[95vw] sm:w-full max-w-xl sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Exam</DialogTitle>
          </DialogHeader>
          <CreateExamForm
            onClose={() => setIsCreateExamOpen(false)}
            onSuccess={() => { setIsCreateExamOpen(false); examsTable.actions.refresh(); }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Exam Dialog */}
      <Dialog open={isEditExamOpen} onOpenChange={setIsEditExamOpen} routeName="edit-subject-exam-popup">
        <DialogContent className="w-[95vw] sm:w-full max-w-xl sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Exam</DialogTitle>
          </DialogHeader>
          {selectedExam && (
            <UpdateExamForm
              exam={selectedExam}
              onClose={() => setIsEditExamOpen(false)}
              onSuccess={() => { setIsEditExamOpen(false); examsTable.actions.refresh(); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Video Preview */}
      <VideoPreviewDialog
        open={!!videoPreviewUrl}
        onOpenChange={(open) => { if (!open) { setVideoPreviewUrl(null); setVideoPreviewTitle(''); setVideoPreviewLecture(null); } }}
        url={videoPreviewUrl || ''}
        title={videoPreviewTitle}
        description={videoPreviewLecture?.description}
        materials={videoPreviewLecture?.materials}
      />
      <DeleteConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog(prev => ({ ...prev, open }))}
        itemName={deleteDialog.item?.title || ''}
        itemType={deleteDialog.type}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );







































































































































};

export default SubjectDashboard;