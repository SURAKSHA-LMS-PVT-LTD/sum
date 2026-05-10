import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  RefreshCw, Search, Plus, LayoutGrid, List, Video, Eye, EyeOff, Pencil,
  Trash2, Play, FileText, AlertCircle, BookOpen, Users, TrendingUp, Filter,
  ChevronDown, ChevronRight, RotateCcw, ExternalLink, Cloud, HardDrive, Link2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useToast } from '@/hooks/use-toast';
import { structuredLecturesApi, StructuredLecture, StructuredLecturesResponse } from '@/api/structuredLectures.api';
import CreateStructuredLectureForm from '@/components/forms/CreateStructuredLectureForm';
import UpdateStructuredLectureForm from '@/components/forms/UpdateStructuredLectureForm';
import VideoPreviewDialog from '@/components/VideoPreviewDialog';
import DeleteConfirmDialog from '@/components/forms/DeleteConfirmDialog';
import { format } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatsData {
  total: number;
  active: number;
  inactive: number;
  grades: { grade: number; total: number; active: number }[];
}

// ─── Permission helper ────────────────────────────────────────────────────────

const MANAGE_ROLES = ['InstituteAdmin', 'Teacher', 'SuperAdmin'];

// ─── LectureCard ─────────────────────────────────────────────────────────────

interface LectureCardProps {
  lecture: StructuredLecture;
  canManage: boolean;
  onEdit: (l: StructuredLecture) => void;
  onDelete: (l: StructuredLecture) => void;
  onRestore: (l: StructuredLecture) => void;
  onWatch: (l: StructuredLecture) => void;
  onOpenExternal: (l: StructuredLecture) => void;
}

const LectureCard = ({ lecture, canManage, onEdit, onDelete, onRestore, onWatch, onOpenExternal }: LectureCardProps) => {
  const hasRecording = !!lecture.lectureVideoUrl;
  const hasMeeting = !!lecture.lectureLink;
  const docsCount = lecture.documents?.length ?? 0;

  return (
    <Card className="overflow-hidden rounded-2xl border-border/50 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-muted/50">
        {lecture.coverImageUrl ? (
          <img
            src={lecture.coverImageUrl}
            alt={lecture.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary/10">
            <Video className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        <Badge
          variant={lecture.isActive ? 'default' : 'secondary'}
          className="absolute top-2 right-2 text-[10px] rounded-lg"
        >
          {lecture.isActive ? 'Active' : 'Inactive'}
        </Badge>
        <Badge variant="outline" className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm text-[10px] rounded-lg">
          Grade {lecture.grade}
        </Badge>
        {hasRecording && lecture.isActive && (
          <button
            onClick={() => onWatch(lecture)}
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
          <h4 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
            {lecture.title}
          </h4>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
            {lecture.lessonNumber && (
              <span>Lesson {lecture.lessonNumber} #{lecture.lectureNumber}</span>
            )}
            {lecture.provider && (
              <span className="truncate">by {lecture.provider}</span>
            )}
          </div>
        </div>

        {lecture.description && (
          <p className="text-[13px] text-muted-foreground line-clamp-2">{lecture.description}</p>
        )}

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {hasRecording && (
            <span className="flex items-center gap-1 text-primary">
              <Play className="h-4 w-4" /> Recording
            </span>
          )}
          {hasMeeting && (
            <span className="flex items-center gap-1 text-blue-500">
              <Users className="h-4 w-4" /> Meeting
            </span>
          )}
          {docsCount > 0 && (
            <span className="flex items-center gap-1">
              <FileText className="h-4 w-4" /> {docsCount} doc{docsCount > 1 ? 's' : ''}
            </span>
          )}
          <span className="ml-auto">{lecture.createdAt ? format(new Date(lecture.createdAt), 'MMM d, yyyy') : '—'}</span>
        </div>

        {/* Documents list */}
        {docsCount > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-semibold text-muted-foreground">Materials</p>
            <ul className="space-y-1">
              {lecture.documents.slice(0, 3).map((doc, idx) => {
                const src = doc.source;
                const icon = src === 'S3'
                  ? <Cloud className="h-3 w-3 text-emerald-500 shrink-0" />
                  : (src === 'GOOGLE_DRIVE' || src === 'GOOGLE_DRIVE_INSTITUTE')
                    ? <HardDrive className="h-3 w-3 text-blue-500 shrink-0" />
                    : <Link2 className="h-3 w-3 text-orange-500 shrink-0" />;
                return (
                  <li key={idx}>
                    <a
                      href={doc.documentUrl || doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors py-0.5"
                    >
                      {icon}
                      <span className="truncate">{doc.documentName || doc.name}</span>
                      <ExternalLink className="h-2.5 w-2.5 shrink-0 ml-auto" />
                    </a>
                  </li>
                );
              })}
              {docsCount > 3 && (
                <p className="text-[10px] text-muted-foreground">+{docsCount - 3} more</p>
              )}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {hasRecording && (
            <Button
              size="sm"
              className="flex-1 rounded-xl h-8 text-xs gap-1.5"
              onClick={() => onWatch(lecture)}
              disabled={!lecture.isActive}
              title="Watch recording"
            >
              <Play className="h-4 w-4" />
              Watch
            </Button>
          )}
          {hasMeeting && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl h-8 px-3 text-xs gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950/30"
              onClick={() => onOpenExternal(lecture)}
              disabled={!lecture.isActive}
              title="Join live meeting"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Join Meeting</span>
            </Button>
          )}
          {canManage && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl h-8 px-3 text-xs gap-1"
                onClick={() => onEdit(lecture)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {lecture.isActive ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl h-8 px-3 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => onDelete(lecture)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl h-8 px-3 text-xs text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950/30"
                  onClick={() => onRestore(lecture)}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ─── TableRow ────────────────────────────────────────────────────────────────

const LectureRow = ({
  lecture, canManage, onEdit, onDelete, onRestore, onWatch, onOpenExternal,
}: LectureCardProps) => (
  <tr className="border-b border-border/30 hover:bg-accent/30 transition-colors">
    <td className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted shrink-0 flex items-center justify-center">
          {lecture.coverImageUrl ? (
            <img src={lecture.coverImageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Video className="h-5 w-5 text-muted-foreground/40" />
          )}
        </div>
        <div>
          <p className="font-medium text-sm line-clamp-1">{lecture.title}</p>
          <p className="text-[11px] text-muted-foreground">{lecture.provider || '—'}</p>
        </div>
      </div>
    </td>
    <td className="px-4 py-3 text-sm text-center">{lecture.grade}</td>
    <td className="px-4 py-3 text-sm text-center">
      {lecture.lessonNumber ?? '—'} / {lecture.lectureNumber ?? '—'}
    </td>
    <td className="px-4 py-3 text-center">
      <Badge variant={lecture.isActive ? 'default' : 'secondary'} className="text-[10px] rounded-lg">
        {lecture.isActive ? 'Active' : 'Inactive'}
      </Badge>
    </td>
    <td className="px-4 py-3 text-sm text-muted-foreground text-center">
      {lecture.documents?.length ?? 0}
    </td>
    <td className="px-4 py-3 text-[11px] text-muted-foreground">
      {lecture.createdAt ? format(new Date(lecture.createdAt), 'MMM d, yyyy') : '—'}
    </td>
    <td className="px-4 py-3">
      <div className="flex items-center gap-1.5 justify-end">
        {lecture.lectureVideoUrl && (
          <Button size="sm" variant="ghost" className="h-7 px-2 rounded-lg gap-1 text-xs" onClick={() => onWatch(lecture)} disabled={!lecture.isActive} title="Watch recording">
            <Play className="h-4 w-4" />
            <span className="hidden md:inline">Watch</span>
          </Button>
        )}
        {lecture.lectureLink && (
          <Button size="sm" variant="ghost" className="h-7 px-2 rounded-lg gap-1 text-xs text-blue-600 hover:text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30" onClick={() => onOpenExternal(lecture)} disabled={!lecture.isActive} title="Join live meeting">
            <Users className="h-4 w-4" />
            <span className="hidden md:inline">Join Meeting</span>
          </Button>
        )}
        {canManage && (
          <>
            <Button size="sm" variant="ghost" className="h-7 px-2 rounded-lg" onClick={() => onEdit(lecture)}>
              <Pencil className="h-4 w-4" />
            </Button>
            {lecture.isActive ? (
              <Button size="sm" variant="ghost" className="h-7 px-2 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(lecture)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 px-2 rounded-lg text-green-600 hover:bg-green-100 dark:hover:bg-green-950/30" onClick={() => onRestore(lecture)}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </div>
    </td>
  </tr>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const StructuredLectures = () => {
  const { selectedInstitute, selectedSubject, selectedClassGrade } = useAuth();
  const userRole = useInstituteRole();
  const { toast } = useToast();

  const canManage = MANAGE_ROLES.includes(userRole);

  // View state
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() =>
    (localStorage.getItem('viewMode') as 'card' | 'table') || 'card'
  );

  // Data state
  const [lectures, setLectures] = useState<StructuredLecture[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;

  // Filters
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Dialogs
  const [showCreate, setShowCreate] = useState(false);
  const [editLecture, setEditLecture] = useState<StructuredLecture | null>(null);
  const [deleteLecture, setDeleteLecture] = useState<StructuredLecture | null>(null);
  const [videoPreview, setVideoPreview] = useState<{ url: string; title: string } | null>(null);

  const contextKey = `${selectedInstitute?.id}-${selectedSubject?.id}`;

  // Handle Google Drive OAuth return — show toast and clean up URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('drive_connected');
    if (!connected) return;

    if (connected === 'true') {
      const email = params.get('google_email') || '';
      toast({
        title: 'Google Drive Connected',
        description: email ? `Connected as ${email}. You can now upload lecture documents.` : 'Your Google Drive is now connected.',
      });
    } else {
      const errMsg = params.get('error') || 'Authorization was cancelled or failed.';
      toast({ title: 'Drive Connection Failed', description: errMsg, variant: 'destructive' });
    }

    // Clean query params without reloading
    const clean = new URL(window.location.href);
    clean.searchParams.delete('drive_connected');
    clean.searchParams.delete('google_email');
    clean.searchParams.delete('error');
    window.history.replaceState({}, '', clean.toString());
  }, []);

  const fetchLectures = useCallback(async (forceRefresh = false) => {
    if (!selectedInstitute?.id) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        page,
        limit: LIMIT,
        instituteId: selectedInstitute.id,
      };
      if (selectedSubject?.id) params.subjectId = selectedSubject.id;
      if (gradeFilter !== 'all') params.grade = Number(gradeFilter);
      if (statusFilter !== 'all') params.isActive = statusFilter === 'active';
      if (search.trim()) params.search = search.trim();
      params.sortBy = 'grade';
      params.sortOrder = 'ASC';

      const res: StructuredLecturesResponse = await structuredLecturesApi.getAll(params);
      setLectures(res.lectures);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setHasLoaded(true);
    } catch (err: any) {
      setError('Failed to load lectures. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedInstitute?.id, selectedSubject?.id, gradeFilter, statusFilter, search, page]);

  const fetchStats = useCallback(async () => {
    if (!selectedSubject?.id) return;
    try {
      const grade = selectedClassGrade || undefined;
      const res: any = await structuredLecturesApi.getStatistics(selectedSubject.id, grade);
      setStats(res);
    } catch { /* stats are supplementary, ignore */ }
  }, [selectedSubject?.id, selectedClassGrade]);

  // Auto-load when context key changes
  useEffect(() => {
    if (selectedInstitute?.id) {
      setPage(1);
      setHasLoaded(false);
      fetchLectures(false);
      fetchStats();
    }
  }, [contextKey]);

  // Re-fetch when page or filters change
  useEffect(() => {
    if (hasLoaded) fetchLectures(false);
  }, [page, gradeFilter, statusFilter]);

  const handleSearch = () => {
    setPage(1);
    fetchLectures(false);
  };

  const handleRefresh = () => {
    setPage(1);
    fetchLectures(true);
    fetchStats();
  };

  const handleCreateSuccess = () => {
    setShowCreate(false);
    fetchLectures(true);
    fetchStats();
    toast({ title: 'Success', description: 'Lecture created successfully' });
  };

  const handleUpdateSuccess = () => {
    setEditLecture(null);
    fetchLectures(true);
    toast({ title: 'Success', description: 'Lecture updated successfully' });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteLecture) return;
    try {
      await structuredLecturesApi.delete(deleteLecture._id);
      setDeleteLecture(null);
      fetchLectures(true);
      fetchStats();
      toast({ title: 'Success', description: 'Lecture deactivated (soft-deleted)' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete lecture', variant: 'destructive' });
    }
  };

  const handleRestore = async (lecture: StructuredLecture) => {
    try {
      await structuredLecturesApi.update(lecture._id, { isActive: true });
      fetchLectures(true);
      fetchStats();
      toast({ title: 'Restored', description: `"${lecture.title}" is now active` });
    } catch {
      toast({ title: 'Error', description: 'Failed to restore lecture', variant: 'destructive' });
    }
  };

  const handleOpenExternal = (lecture: StructuredLecture) => {
    if (lecture.lectureLink) {
      window.open(lecture.lectureLink, '_blank', 'noopener,noreferrer');
    }
  };

  // ─── Empty state ──────────────────────────────────────────────────────────

  if (!selectedInstitute) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">Select an Institute</h2>
          <p className="text-sm text-muted-foreground">Please select an institute to manage structured lectures.</p>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border border-border/50 p-5 sm:p-7">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Structured Lectures</h1>
                <p className="text-sm text-muted-foreground">
                  {selectedInstitute.name}{selectedSubject ? ` → ${selectedSubject.name}` : ''}
                  {selectedClassGrade ? ` · Grade ${selectedClassGrade}` : ''}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading} className="rounded-xl gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canManage && (
              <Button size="sm" className="rounded-xl gap-2 shadow-sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />
                Add Lecture
              </Button>
            )}
          </div>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label: 'Total', value: stats.total, icon: Video },
              { label: 'Active', value: stats.active, icon: Eye },
              { label: 'Inactive', value: stats.inactive, icon: EyeOff },
              { label: 'Grades', value: stats.grades?.length ?? '—', icon: Users },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-background/60 backdrop-blur-sm border border-border/30">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold leading-none">{value}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Search & filters ── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search lectures..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 rounded-xl"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleSearch} className="rounded-xl">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Search</span>
          </Button>
          <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="md:hidden rounded-xl gap-1.5"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="md:hidden flex flex-col max-h-[80vh] rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Filter Lectures</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto py-4">
                <div className="space-y-4 px-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block text-muted-foreground">Grade</label>
                    <Select value={gradeFilter} onValueChange={(v) => { setGradeFilter(v); setPage(1); }}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="All Grades" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Grades</SelectItem>
                        {Array.from({ length: 13 }, (_, i) => i + 1).map(g => (
                          <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block text-muted-foreground">Status</label>
                    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setPage(1); }}>
                      <SelectTrigger className="rounded-xl"><SelectValue placeholder="All" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => { 
                      setGradeFilter('all'); 
                      setStatusFilter('all'); 
                      setSearch(''); 
                      setPage(1);
                      setIsFilterSheetOpen(false);
                    }} 
                    className="rounded-xl w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`hidden md:flex rounded-xl gap-1.5 ${showFilters ? 'bg-accent' : ''}`}
          >
            <Filter className="h-4 w-4" />
            Filters
            <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant={viewMode === 'card' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setViewMode('card'); localStorage.setItem('viewMode', 'card'); }}
              className="rounded-xl"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setViewMode('table'); localStorage.setItem('viewMode', 'table'); }}
              className="rounded-xl"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-muted/40 rounded-xl border border-border/40">
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">Grade</label>
              <Select value={gradeFilter} onValueChange={(v) => { setGradeFilter(v); setPage(1); }}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="All Grades" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grades</SelectItem>
                  {Array.from({ length: 13 }, (_, i) => i + 1).map(g => (
                    <SelectItem key={g} value={String(g)}>Grade {g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={() => { setGradeFilter('all'); setStatusFilter('all'); setSearch(''); setPage(1); }} className="rounded-xl w-full">
                Clear Filters
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-8 w-8 animate-spin text-primary/60" />
        </div>
      )}

      {/* ── Content ── */}
      {!loading && !error && (
        <>
          {lectures.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <Video className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No Lectures Found</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {hasLoaded
                  ? 'Try adjusting your filters or search term.'
                  : selectedSubject
                    ? `No lectures for ${selectedSubject.name} yet.`
                    : 'Select a subject or click Add Lecture to get started.'}
              </p>
              {canManage && (
                <Button onClick={() => setShowCreate(true)} className="mt-4 rounded-xl gap-2" size="sm">
                  <Plus className="h-4 w-4" />
                  Create First Lecture
                </Button>
              )}
            </div>
          ) : viewMode === 'card' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {lectures.map((lecture) => (
                <LectureCard
                  key={lecture._id}
                  lecture={lecture}
                  canManage={canManage}
                  onEdit={setEditLecture}
                  onDelete={setDeleteLecture}
                  onRestore={handleRestore}
                  onWatch={(l) => l.lectureVideoUrl && setVideoPreview({ url: l.lectureVideoUrl, title: l.title })}
                  onOpenExternal={handleOpenExternal}
                />
              ))}
            </div>
          ) : (
            <Card className="rounded-2xl overflow-hidden border-border/50">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Lecture</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Grade</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Lesson / #</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground">Docs</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground">Created</th>
                      <th className="px-4 py-3 text-xs font-semibold text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lectures.map((lecture) => (
                      <LectureRow
                        key={lecture._id}
                        lecture={lecture}
                        canManage={canManage}
                        onEdit={setEditLecture}
                        onDelete={setDeleteLecture}
                        onRestore={handleRestore}
                        onWatch={(l) => l.lectureVideoUrl && setVideoPreview({ url: l.lectureVideoUrl, title: l.title })}
                        onOpenExternal={handleOpenExternal}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Showing {lectures.length} of {total} lectures
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-xl"
                >
                  Previous
                </Button>
                <span className="text-muted-foreground px-2">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="rounded-xl"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Dialogs ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogTitle className="sr-only">Create Lecture</DialogTitle>
          <DialogDescription className="sr-only">Form to create a new structured lecture</DialogDescription>
          <CreateStructuredLectureForm
            onClose={() => setShowCreate(false)}
            onSuccess={handleCreateSuccess}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editLecture} onOpenChange={(open) => !open && setEditLecture(null)}>
        <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogTitle className="sr-only">Update Lecture</DialogTitle>
          <DialogDescription className="sr-only">Form to update an existing structured lecture</DialogDescription>
          {editLecture && (
            <UpdateStructuredLectureForm
              lecture={editLecture}
              onClose={() => setEditLecture(null)}
              onSuccess={handleUpdateSuccess}
            />
          )}
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteLecture}
        onOpenChange={(open) => !open && setDeleteLecture(null)}
        itemName={deleteLecture?.title || ''}
        itemType="lecture"
        bullets={['Lecture will be deactivated and hidden from students', 'You can restore it later by toggling Active status']}
        onConfirm={handleDeleteConfirm}
      />

      <VideoPreviewDialog
        open={!!videoPreview}
        onOpenChange={(open) => !open && setVideoPreview(null)}
        url={videoPreview?.url ?? ''}
        title={videoPreview?.title ?? ''}
      />
    </div>
  );
};

export default StructuredLectures;
