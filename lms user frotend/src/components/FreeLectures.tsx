import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteLabels } from '@/hooks/useInstituteLabels';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Video, User, Calendar, ChevronDown, ChevronRight, Play, Plus, Pencil, Trash2, RefreshCw, BookOpen, FileText, Layers } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import VideoPreviewDialog from '@/components/VideoPreviewDialog';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import CreateStructuredLectureForm from '@/components/forms/CreateStructuredLectureForm';
import UpdateStructuredLectureForm from '@/components/forms/UpdateStructuredLectureForm';
import DeleteStructuredLectureDialog from '@/components/forms/DeleteStructuredLectureDialog';
import { structuredLecturesApi, StructuredLecture } from '@/api/structuredLectures.api';

interface Attachment {
  documentName: string;
  documentUrl: string;
}

interface Lecture {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  grade: number;
  lessonNumber?: number;
  lectureNumber?: number;
  videoUrl: string | null;
  lectureVideoUrl?: string | null;
  thumbnailUrl: string | null;
  coverImageUrl?: string | null;
  attachments: Attachment[] | null;
  documentUrls?: string[] | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  provider?: string;
}

const FreeLectures = () => {
  const { selectedInstitute, selectedClass, selectedSubject, selectedClassGrade } = useAuth();
  const { subjectLabel } = useInstituteLabels();
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedLessons, setExpandedLessons] = useState<Record<string, boolean>>({});
  const [expandedLectures, setExpandedLectures] = useState<Record<string, boolean>>({});
  const [videoPreview, setVideoPreview] = useState<{ open: boolean; url: string; title: string }>({ open: false, url: '', title: '' });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null);
  const [deletingLecture, setDeletingLecture] = useState<Lecture | null>(null);

  const instituteUserType = selectedInstitute?.instituteUserType || (selectedInstitute as any)?.userRole;
  const isInstituteAdmin = instituteUserType === 'INSTITUTEADMIN' || instituteUserType === 'INSTITUTE_ADMIN';
  const isTeacher = instituteUserType === 'TEACHER';
  const canManageLectures = isInstituteAdmin || isTeacher;

  const contextKey = `${selectedInstitute?.id}-${selectedSubject?.id}-${selectedClassGrade ?? ''}`;
  const [lastLoadedContext, setLastLoadedContext] = useState<string>('');

  const lecturesByLesson = React.useMemo(() => {
    const grouped = new Map<string, Lecture[]>();
    const unassigned: Lecture[] = [];
    lectures.forEach(lecture => {
      const lessonKey = lecture.lessonNumber ? `Lesson ${lecture.lessonNumber}` : (lecture.title || '').trim() || 'Untitled Topic';
      const existing = grouped.get(lessonKey) || [];
      grouped.set(lessonKey, [...existing, lecture]);
    });
    return { grouped, unassigned };
  }, [lectures]);

  const availableLessons = React.useMemo(() => {
    return Array.from(lecturesByLesson.grouped.keys()).sort((a, b) => {
      const numA = a.match(/Lesson (\d+)/)?.[1];
      const numB = b.match(/Lesson (\d+)/)?.[1];
      if (numA && numB) return parseInt(numA) - parseInt(numB);
      return a.localeCompare(b);
    });
  }, [lecturesByLesson]);
  
  const totalLessons = availableLessons.length;

  useEffect(() => {
    if (selectedInstitute && selectedSubject && contextKey !== lastLoadedContext) {
      setLastLoadedContext(contextKey);
      fetchFreeLectures(false);
    }
  }, [contextKey]);

  const handleLoadLectures = () => {
    if (selectedInstitute && selectedSubject) {
      fetchFreeLectures(true);
    }
  };

  const fetchFreeLectures = async (forceRefresh = false) => {
    if (!selectedInstitute || !selectedSubject) return;
    setLoading(true);
    setError(null);
    try {
      const grade = selectedClassGrade || selectedClass?.grade || undefined;
      const result = await structuredLecturesApi.getByInstituteAndSubject(selectedInstitute.id, selectedSubject.id, grade);
      const fetchedLectures: Lecture[] = result.lectures.map(sl => ({
        id: sl._id,
        title: sl.title,
        description: sl.description,
        subjectId: sl.subjectId,
        grade: sl.grade,
        lessonNumber: sl.lessonNumber,
        lectureNumber: sl.lectureNumber,
        videoUrl: sl.lectureLink || null,
        lectureVideoUrl: sl.lectureLink || null,
        thumbnailUrl: sl.coverImageUrl || null,
        coverImageUrl: sl.coverImageUrl || null,
        attachments: sl.documents.map(d => ({ documentName: d.documentName, documentUrl: d.documentUrl })),
        documentUrls: null,
        isActive: sl.isActive,
        createdBy: sl.createdBy || '',
        createdAt: sl.createdAt,
        updatedAt: sl.updatedAt,
        provider: sl.provider,
      }));
      setLectures(fetchedLectures);
    } catch (err: any) {
      console.error('Error fetching lectures:', err);
      if (err?.status === 404 || err?.message?.includes('404')) {
        setLectures([]);
        setError(null);
        return;
      }
      if (err?.status === 401) { setError('Authentication required. Please log in again.'); return; }
      setError('Error loading lectures. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinLecture = (videoUrl: string, title: string) => {
    if (videoUrl) setVideoPreview({ open: true, url: videoUrl, title });
  };

  const toggleLessonExpansion = (lessonKey: string) => {
    setExpandedLessons(prev => ({ ...prev, [lessonKey]: !prev[lessonKey] }));
  };

  const toggleLectureExpansion = (lectureId: string) => {
    setExpandedLectures(prev => ({ ...prev, [lectureId]: !prev[lectureId] }));
  };

  const handleCreateSuccess = () => { setShowCreateDialog(false); fetchFreeLectures(true); };
  const handleUpdateSuccess = () => { setEditingLecture(null); fetchFreeLectures(true); };
  const handleDeleteSuccess = () => { setDeletingLecture(null); fetchFreeLectures(true); };

  const toStructuredLecture = (lecture: Lecture): StructuredLecture => ({
    _id: lecture.id,
    instituteId: selectedInstitute?.id || '',
    subjectId: lecture.subjectId,
    grade: lecture.grade,
    lessonNumber: lecture.lessonNumber || 1,
    lectureNumber: lecture.lectureNumber || 1,
    title: lecture.title,
    description: lecture.description,
    lectureLink: lecture.videoUrl || lecture.lectureVideoUrl || undefined,
    coverImageUrl: lecture.thumbnailUrl || lecture.coverImageUrl || undefined,
    documents: (lecture.attachments || []).map(a => ({
      documentName: a.documentName,
      documentUrl: a.documentUrl,
      name: a.documentName,
      url: a.documentUrl,
    })),
    provider: lecture.provider,
    isActive: lecture.isActive,
    createdBy: lecture.createdBy,
    createdAt: lecture.createdAt,
    updatedAt: lecture.updatedAt,
  });

  if (!selectedInstitute || !selectedSubject) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">Select a {subjectLabel}</h2>
          <p className="text-sm text-muted-foreground">Please select a {subjectLabel.toLowerCase()} to view lectures</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
        <div className="rounded-2xl border border-border/50 p-6 sm:p-8 space-y-4">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-4 w-96 rounded-lg" />
          <div className="grid grid-cols-4 gap-3 pt-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl border border-border/50 p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-40 bg-muted rounded-lg" />
                  <div className="h-4 w-24 bg-muted rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <Alert variant="destructive" className="rounded-2xl">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border border-border/50 p-6 sm:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Lectures</h1>
                <p className="text-sm text-muted-foreground">
                  {selectedInstitute?.name} → {selectedClass?.name} → {selectedSubject.name}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleLoadLectures} disabled={loading} className="rounded-xl gap-2 border-border/50 backdrop-blur-sm">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canManageLectures && (
              <Button onClick={() => setShowCreateDialog(true)} size="sm" className="rounded-xl gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                Add Lecture
              </Button>
            )}
          </div>
        </div>

        {/* Stats Row */}
        {lectures.length > 0 && (
          <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { label: 'Lectures', value: lectures.length, icon: Video },
              { label: 'Lessons', value: totalLessons, icon: Layers },
              { label: 'Active', value: lectures.filter(l => l.isActive).length, icon: Play },
              { label: 'Grade', value: selectedClassGrade, icon: BookOpen },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-background/60 backdrop-blur-sm border border-border/30">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold leading-none">{value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lectures Content */}
      {lectures.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Video className="h-10 w-10 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No Lectures Available</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            There are no lectures for this subject yet.
          </p>
          {canManageLectures && (
            <Button onClick={() => setShowCreateDialog(true)} className="mt-4 rounded-xl gap-2" size="sm">
              <Plus className="h-4 w-4" />
              Create First Lecture
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {availableLessons.map((lessonKey) => {
            const lessonLectures = lecturesByLesson.grouped.get(lessonKey) || [];
            const activeCount = lessonLectures.filter(l => l.isActive).length;
            const isExpanded = expandedLessons[lessonKey];

            return (
              <div key={lessonKey} className="rounded-2xl border border-border/50 overflow-hidden transition-all duration-300 hover:border-primary/20">
                {/* Lesson Header */}
                <button
                  onClick={() => toggleLessonExpansion(lessonKey)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {lessonLectures.length}
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-base">{lessonKey}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {activeCount} active lecture{activeCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-border/30 p-4 sm:p-5 bg-muted/5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {lessonLectures.map((lecture, index) => (
                        <LectureCard
                          key={lecture.id}
                          lecture={lecture}
                          index={index}
                          isExpanded={!!expandedLectures[lecture.id]}
                          onToggleExpand={() => toggleLectureExpansion(lecture.id)}
                          onWatch={() => handleJoinLecture(lecture.videoUrl || lecture.lectureVideoUrl || '', lecture.title)}
                          onEdit={canManageLectures ? () => setEditingLecture(lecture) : undefined}
                          onDelete={canManageLectures ? () => setDeletingLecture(lecture) : undefined}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <VideoPreviewDialog
        open={videoPreview.open}
        onOpenChange={(open) => { if (!open) setVideoPreview({ open: false, url: '', title: '' }); }}
        url={videoPreview.url}
        title={videoPreview.title}
      />
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogTitle className="sr-only">Create Lecture</DialogTitle>
          <DialogDescription className="sr-only">Form to create a new structured lecture</DialogDescription>
          <CreateStructuredLectureForm onClose={() => setShowCreateDialog(false)} onSuccess={handleCreateSuccess} />
        </DialogContent>
      </Dialog>
      <Dialog open={!!editingLecture} onOpenChange={(open) => !open && setEditingLecture(null)}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogTitle className="sr-only">Edit Lecture</DialogTitle>
          <DialogDescription className="sr-only">Form to update an existing structured lecture</DialogDescription>
          {editingLecture && (
            <UpdateStructuredLectureForm lecture={toStructuredLecture(editingLecture)} onClose={() => setEditingLecture(null)} onSuccess={handleUpdateSuccess} />
          )}
        </DialogContent>
      </Dialog>
      {deletingLecture && (
        <DeleteStructuredLectureDialog lecture={toStructuredLecture(deletingLecture)} open={!!deletingLecture} onOpenChange={(open) => !open && setDeletingLecture(null)} onSuccess={handleDeleteSuccess} />
      )}
    </div>
  );
};

/* Extracted Lecture Card Component */
interface LectureCardProps {
  lecture: {
    id: string;
    title: string;
    description: string;
    lectureNumber?: number;
    thumbnailUrl: string | null;
    coverImageUrl?: string | null;
    videoUrl: string | null;
    lectureVideoUrl?: string | null;
    isActive: boolean;
    createdBy: string;
    createdAt: string;
    attachments: { documentName: string; documentUrl: string }[] | null;
    documentUrls?: string[] | null;
  };
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onWatch: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const LectureCard = ({ lecture, index, isExpanded, onToggleExpand, onWatch, onEdit, onDelete }: LectureCardProps) => (
  <Card className="overflow-hidden rounded-xl border-border/50 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group">
    {/* Thumbnail */}
    <div className="relative aspect-video bg-muted/50">
      {(lecture.thumbnailUrl || lecture.coverImageUrl) ? (
        <img
          src={lecture.thumbnailUrl || lecture.coverImageUrl || ''}
          alt={lecture.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
          <Video className="h-10 w-10 text-muted-foreground/30" />
        </div>
      )}
      <Badge variant="outline" className="absolute top-2.5 left-2.5 bg-background/80 backdrop-blur-sm text-xs rounded-lg">
        #{lecture.lectureNumber || index + 1}
      </Badge>
      <Badge
        variant={lecture.isActive ? "default" : "secondary"}
        className="absolute top-2.5 right-2.5 bg-background/80 backdrop-blur-sm text-xs rounded-lg"
      >
        {lecture.isActive ? 'Active' : 'Inactive'}
      </Badge>
      {/* Play overlay */}
      {(lecture.videoUrl || lecture.lectureVideoUrl) && lecture.isActive && (
        <button
          onClick={onWatch}
          className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors group/play"
        >
          <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center opacity-0 group-hover/play:opacity-100 scale-75 group-hover/play:scale-100 transition-all duration-200 shadow-lg">
            <Play className="h-5 w-5 text-primary-foreground ml-0.5" />
          </div>
        </button>
      )}
    </div>

    <CardContent className="p-4 space-y-3">
      <div>
        <h4 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">{lecture.title}</h4>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1.5">
          <span className="flex items-center gap-1">
            <User className="h-4 w-4" />
            {lecture.createdBy}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {lecture.createdAt ? format(new Date(lecture.createdAt), 'MMM dd, yyyy') : '—'}
          </span>
        </div>
      </div>

      {lecture.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{lecture.description}</p>
      )}

      {/* Expanded details */}
      {isExpanded && (
        <div className="space-y-3 pt-2 border-t border-border/30 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {lecture.description && (
            <p className="text-xs text-muted-foreground whitespace-pre-line">{lecture.description}</p>
          )}
          {(lecture.attachments || lecture.documentUrls) && (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                Documents
              </h5>
              {(lecture.attachments || []).map((att, idx) => (
                <a
                  key={idx}
                  href={att.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-accent text-xs transition-colors"
                >
                  <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">{att.documentName}</span>
                </a>
              ))}
              {(lecture.documentUrls || []).map((url, idx) => (
                <a key={`doc-${idx}`} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  Document {idx + 1}
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" className="flex-1 rounded-xl h-8 text-xs" onClick={onToggleExpand}>
          {isExpanded ? 'Less' : 'More'}
        </Button>
        <Button
          size="sm"
          className="flex-1 rounded-xl h-8 text-xs gap-1.5 shadow-sm"
          onClick={onWatch}
          disabled={!lecture.isActive || !(lecture.videoUrl || lecture.lectureVideoUrl)}
        >
          <Play className="h-4 w-4" />
          Watch
        </Button>
      </div>

      {/* Admin Actions */}
      {(onEdit || onDelete) && (
        <div className="flex gap-2 pt-1.5 border-t border-border/30">
          {onEdit && (
            <Button variant="ghost" size="sm" className="flex-1 rounded-xl h-8 text-xs gap-1.5" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
          {onDelete && (
            <Button variant="ghost" size="sm" className="flex-1 rounded-xl h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      )}
    </CardContent>
  </Card>
);

export default FreeLectures;
