import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { homeworkSubmissionsApi, type HomeworkSubmission } from '@/api/homeworkSubmissions.api';
import { instituteStudentsApi } from '@/api/instituteStudents.api';
import { AccessControl, UserRole } from '@/utils/permissions';
import {
  FileText, Calendar, ExternalLink, RefreshCw, ArrowLeft, BookOpen,
  Lock, Edit, Eye, User, CheckCircle2, Clock, ChevronDown, ChevronUp,
  Upload, MessageSquare, Hash
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import UploadCorrectionDialog from '@/components/forms/UploadCorrectionDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import ImagePreviewModal from '@/components/ImagePreviewModal';
import { cn } from '@/lib/utils';

const HomeworkSubmissions = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const {
    user, selectedInstitute, selectedClass, selectedSubject,
    currentInstituteId, currentClassId, currentSubjectId
  } = useAuth();

  const homeworkIdFromPath = React.useMemo(() => {
    const match = location.pathname.match(/\/homework\/([^\/]+)\/submissions/);
    return match?.[1];
  }, [location.pathname]);

  const instituteRole = useInstituteRole();
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const itemsPerPage = 10;
  const contextKey = `${currentInstituteId}-${currentClassId}-${currentSubjectId}`;
  const [lastLoadedContext, setLastLoadedContext] = useState<string>('');
  const [selectedSubmission, setSelectedSubmission] = useState<HomeworkSubmission | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewImageTitle, setPreviewImageTitle] = useState<string>('');
  const [studentImageById, setStudentImageById] = useState<Record<string, string>>({});
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const canEdit = instituteRole === 'Teacher' || instituteRole === 'InstituteAdmin';

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleImageClick = (resolvedImageUrl: string, studentName: string) => {
    if (!resolvedImageUrl) return;
    setPreviewImageUrl(resolvedImageUrl);
    setPreviewImageTitle(`${studentName}'s Photo`);
  };

  const getStudentName = (submission: HomeworkSubmission) => {
    const nameFromApi = submission.studentName?.trim();
    if (nameFromApi) return nameFromApi;
    const nameFromStudent = [submission.student?.firstName, submission.student?.lastName]
      .filter(Boolean).join(' ').trim();
    return nameFromStudent || 'Student';
  };

  const getStudentEmail = (submission: HomeworkSubmission) => {
    return submission.studentEmail?.trim() || submission.student?.email || 'No email';
  };

  const getStudentResolvedImageUrl = (submission: HomeworkSubmission) => {
    const rawUrl = submission.studentImageUrl || studentImageById[submission.studentId];
    return getImageUrl(rawUrl);
  };

  const loadStudentImagesForSubmissions = async (submissionsList: HomeworkSubmission[]) => {
    const uniqueStudentIds = Array.from(new Set(submissionsList.map(s => s.studentId).filter(Boolean)));
    if (!uniqueStudentIds.length || !currentInstituteId || !currentClassId) return;
    const remainingIds = new Set(uniqueStudentIds);
    try {
      const map: Record<string, string> = {};
      const maxPages = 10;
      for (let page = 1; page <= maxPages && remainingIds.size > 0; page++) {
        const res = await instituteStudentsApi.getStudentsByClass(String(currentInstituteId), String(currentClassId), { page, limit: 50 });
        for (const student of res.data || []) {
          remainingIds.delete(student.id);
          if (student.studentId) remainingIds.delete(student.studentId);
          if (student.imageUrl) {
            map[student.id] = student.imageUrl;
            if (student.studentId) map[student.studentId] = student.imageUrl;
          }
        }
        if (!res.meta?.totalPages || page >= res.meta.totalPages) break;
      }
      setStudentImageById(map);
    } catch (e) {
      console.warn('Failed to load student images for submissions', e);
    }
  };

  const loadSubmissions = async (page = 1) => {
    if (!homeworkIdFromPath) {
      toast({ title: 'Missing Homework', description: 'Homework ID not found in the URL.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const response = await homeworkSubmissionsApi.getSubmissions({ page, limit: itemsPerPage, homeworkId: homeworkIdFromPath }, true);
      const submissionsList = Array.isArray(response) ? response : response.data || [];
      const meta = Array.isArray(response) ? { total: submissionsList.length } : response.meta || { total: submissionsList.length };
      setSubmissions(submissionsList);
      void loadStudentImagesForSubmissions(submissionsList);
      setTotalSubmissions(meta.total || submissionsList.length);
      setCurrentPage(page);
      setLastRefresh(new Date());
    } catch (error: any) {
      console.error('Error loading submissions:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to load homework submissions', variant: 'destructive' });
      setSubmissions([]);
      setTotalSubmissions(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (homeworkIdFromPath && contextKey !== lastLoadedContext) {
      setLastLoadedContext(contextKey);
      void loadSubmissions(1);
    }
  }, [contextKey, homeworkIdFromPath]);

  const formatDate = (dateString: string | Date | any) => {
    try {
      if (!dateString || typeof dateString === 'object' && Object.keys(dateString).length === 0) return 'Not submitted';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return 'Invalid date'; }
  };

  const handleGoBack = () => {
    if (currentInstituteId && currentClassId && currentSubjectId) {
      navigate(`/institute/${currentInstituteId}/class/${currentClassId}/subject/${currentSubjectId}/homework`);
    } else {
      navigate('/homework');
    }
  };

  if (!AccessControl.hasPermission(instituteRole as UserRole, 'view-homework-submissions')) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Access Denied</h3>
            <p className="text-muted-foreground mb-4">Only teachers and institute administrators can access this feature.</p>
            <Button onClick={() => navigate('/homework')}>Back to Homework</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalPages = Math.ceil(totalSubmissions / itemsPerPage);

  return (
    <>
      <div className="w-full min-h-full">
        <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">

          {/* Hero Header */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-4 sm:p-6">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10">
              <Button variant="ghost" size="sm" onClick={handleGoBack} className="mb-3 -ml-2 hover:bg-primary/10">
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="text-sm">Back to Homework</span>
              </Button>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 items-center justify-center shadow-lg shadow-primary/25">
                    <FileText className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-2xl font-bold">Homework Submissions</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      {selectedSubject?.name && selectedClass?.name
                        ? `${selectedClass.name} • ${selectedSubject.name}`
                        : 'View student submissions'}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => loadSubmissions(currentPage)} disabled={isLoading} className="self-start bg-background/80 backdrop-blur-sm">
                  <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
                  {isLoading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>

              {/* Stats Row */}
              {submissions.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-4">
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm bg-background/60 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-border/50">
                    <User className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">{totalSubmissions}</span>
                    <span className="text-muted-foreground">submissions</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm bg-background/60 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-border/50">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    <span className="font-medium">{submissions.filter(s => s.teacherCorrectionFileUrl).length}</span>
                    <span className="text-muted-foreground">corrected</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm bg-background/60 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-border/50">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                    <span className="font-medium">{submissions.filter(s => !s.teacherCorrectionFileUrl).length}</span>
                    <span className="text-muted-foreground">pending</span>
                  </div>
                </div>
              )}

              {lastRefresh && (
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>

          {/* Content */}
          {!homeworkIdFromPath ? (
            <EmptyState
              icon={BookOpen}
              title="Missing Homework"
              description="Homework ID not found in the URL."
            >
              <Button onClick={() => navigate('/homework')}>Go to Homework</Button>
            </EmptyState>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <RefreshCw className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading submissions...</p>
            </div>
          ) : submissions.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No Submissions Found"
              description="No homework submissions found for this homework."
            >
              <Button onClick={() => loadSubmissions(1)} variant="outline">Refresh Data</Button>
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {submissions.map((submission, index) => {
                const studentName = getStudentName(submission);
                const studentEmail = getStudentEmail(submission);
                const studentImageUrl = getStudentResolvedImageUrl(submission);
                const isExpanded = expandedCards.has(submission.id);
                const isCorrected = !!submission.teacherCorrectionFileUrl;

                return (
                  <Card
                    key={submission.id}
                    className={cn(
                      "overflow-hidden border-border/50 transition-all duration-200",
                      isCorrected ? "border-l-4 border-l-green-500" : "border-l-4 border-l-amber-500",
                      "hover:shadow-md"
                    )}
                  >
                    <CardContent className="p-0">
                      {/* Main Row - Always visible */}
                      <div
                        className="flex items-center gap-3 p-3 sm:p-4 cursor-pointer"
                        onClick={() => toggleCard(submission.id)}
                      >
                        {/* Index */}
                        <div className="hidden sm:flex h-8 w-8 rounded-lg bg-muted/50 items-center justify-center text-xs font-mono text-muted-foreground shrink-0">
                          {(currentPage - 1) * itemsPerPage + index + 1}
                        </div>

                        {/* Avatar */}
                        <Avatar
                          className={cn(
                            "h-10 w-10 shrink-0",
                            studentImageUrl && "cursor-pointer hover:ring-2 hover:ring-primary"
                          )}
                          onClick={(e) => {
                            if (studentImageUrl) {
                              e.stopPropagation();
                              handleImageClick(studentImageUrl, studentName);
                            }
                          }}
                        >
                          {studentImageUrl ? <AvatarImage src={studentImageUrl} alt={studentName} /> : null}
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                            {studentName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        {/* Student Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">{studentName}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0",
                                isCorrected
                                  ? "bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400"
                                  : "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400"
                              )}
                            >
                              {isCorrected ? 'Corrected' : 'Pending'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{studentEmail}</p>
                        </div>

                        {/* Date - Desktop */}
                        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(submission.submissionDate)}
                        </div>

                        {/* Expand Arrow */}
                        <div className="shrink-0 text-muted-foreground">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="border-t border-border/50 bg-muted/20 p-3 sm:p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
                          {/* Date - Mobile */}
                          <div className="flex md:hidden items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            Submitted: {formatDate(submission.submissionDate)}
                          </div>

                          {/* Homework Title */}
                          {submission.homework?.title && (
                            <div className="flex items-start gap-2 text-sm">
                              <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div>
                                <span className="text-muted-foreground">Assignment: </span>
                                <span className="font-medium">{submission.homework.title}</span>
                              </div>
                            </div>
                          )}

                          {/* Remarks */}
                          {submission.remarks && (
                            <div className="flex items-start gap-2 text-sm">
                              <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <div>
                                <span className="text-muted-foreground">Notes: </span>
                                <span>{submission.remarks}</span>
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex flex-wrap gap-2 pt-1">
                            {submission.fileUrl && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={() => window.open(submission.fileUrl, '_blank')}
                              >
                                <ExternalLink className="h-3 w-3 mr-1.5" />
                                View Submission
                              </Button>
                            )}
                            {submission.teacherCorrectionFileUrl && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs text-green-700 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950"
                                onClick={() => window.open(submission.teacherCorrectionFileUrl, '_blank')}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1.5" />
                                View Correction
                              </Button>
                            )}
                            {canEdit && !isCorrected && (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-8 text-xs"
                                onClick={() => {
                                  setSelectedSubmission(submission);
                                  setIsUploadDialogOpen(true);
                                }}
                              >
                                <Upload className="h-3 w-3 mr-1.5" />
                                Upload Correction
                              </Button>
                            )}
                          </div>

                          {/* Metadata */}
                          <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/30">
                            Created: {formatDate(submission.createdAt)}
                            {submission.updatedAt !== submission.createdAt && (
                              <> • Updated: {formatDate(submission.updatedAt)}</>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center pt-2">
                  <Pagination>
                    <PaginationContent>
                      {currentPage > 1 && (
                        <PaginationItem>
                          <PaginationPrevious onClick={() => loadSubmissions(currentPage - 1)} className="cursor-pointer" />
                        </PaginationItem>
                      )}
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                        const shouldShow = page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2;
                        if (!shouldShow) return null;
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink onClick={() => loadSubmissions(page)} isActive={currentPage === page} className="cursor-pointer">
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      {currentPage < totalPages && (
                        <PaginationItem>
                          <PaginationNext onClick={() => loadSubmissions(currentPage + 1)} className="cursor-pointer" />
                        </PaginationItem>
                      )}
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload Correction Dialog */}
      {selectedSubmission && (
        <UploadCorrectionDialog
          isOpen={isUploadDialogOpen}
          onClose={() => { setIsUploadDialogOpen(false); setSelectedSubmission(null); }}
          submissionId={selectedSubmission.id}
          studentName={getStudentName(selectedSubmission)}
          submission={selectedSubmission}
          onSuccess={() => { setIsUploadDialogOpen(false); setSelectedSubmission(null); loadSubmissions(currentPage); }}
        />
      )}

      {/* Image Preview Modal */}
      <ImagePreviewModal
        isOpen={!!previewImageUrl}
        onClose={() => { setPreviewImageUrl(null); setPreviewImageTitle(''); }}
        imageUrl={previewImageUrl || ''}
        title={previewImageTitle}
      />
    </>
  );
};

export default HomeworkSubmissions;
