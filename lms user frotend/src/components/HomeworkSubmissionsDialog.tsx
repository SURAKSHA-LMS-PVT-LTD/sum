import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { AccessControl } from '@/utils/permissions';
import { homeworkSubmissionsApi, type HomeworkSubmission } from '@/api/homeworkSubmissions.api';
import { 
  FileText, 
  Calendar, 
  User, 
  ExternalLink, 
  RefreshCw, 
  Lock, 
  Cloud,
  HardDrive,
  Download,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HomeworkSubmissionsDialogProps {
  homework: any;
  isOpen: boolean;
  onClose: () => void;
}

const HomeworkSubmissionsDialog = ({ homework, isOpen, onClose }: HomeworkSubmissionsDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const userRole = useInstituteRole();
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadSubmissions = async () => {
    if (!homework?.id) return;

    setIsLoading(true);
    try {
      const response = await homeworkSubmissionsApi.getSubmissions({
        homeworkId: homework.id,
        page: 1,
        limit: 50,
        userId: user?.id,
        role: userRole,
        instituteId: homework.instituteId,
        classId: homework.classId,
        subjectId: homework.subjectId
      }, true);

      const submissionsList = Array.isArray(response) ? response : response.data || [];
      setSubmissions(submissionsList);
    } catch (error: any) {
      console.error('Error loading submissions:', error);
      toast({
        title: "Error",
        description: "Failed to load homework submissions",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && homework?.id) {
      loadSubmissions();
    }
  }, [isOpen, homework?.id]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileUrl = (submission: HomeworkSubmission) => {
    if (submission.submissionType === 'GOOGLE_DRIVE' && submission.driveFileId) {
      return submission.driveViewUrl || `https://drive.google.com/file/d/${submission.driveFileId}/view`;
    }
    return submission.fileUrl;
  };

  const getSubmissionTypeIcon = (submission: HomeworkSubmission) => {
    if (submission.submissionType === 'GOOGLE_DRIVE') {
      return <Cloud className="h-4 w-4 text-primary" />;
    }
    return <HardDrive className="h-4 w-4 text-muted-foreground" />;
  };

  const getSubmissionTypeBadge = (submission: HomeworkSubmission) => {
    if (submission.submissionType === 'GOOGLE_DRIVE') {
      return (
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
          <Cloud className="h-3 w-3 mr-1" />
          Google Drive
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-muted">
        <HardDrive className="h-3 w-3 mr-1" />
        Uploaded
      </Badge>
    );
  };

  // Check if user has permission to view homework submissions
  if (!AccessControl.hasPermission(userRole, 'view-homework-submissions')) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Access Denied
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              You don't have permission to view homework submissions.
            </p>
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Homework Submissions
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Homework Info */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-4">
              <h3 className="font-semibold mb-2">{homework?.title}</h3>
              <p className="text-muted-foreground text-sm mb-2">{homework?.description}</p>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {homework?.startDate && (
                  <Badge variant="outline">
                    Start: {new Date(homework.startDate).toLocaleDateString()}
                  </Badge>
                )}
                {homework?.endDate && (
                  <Badge variant="outline">
                    Due: {new Date(homework.endDate).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Refresh Button */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-lg font-semibold">
                Submissions ({submissions.length})
              </h3>
              <p className="text-sm text-muted-foreground">
                {submissions.filter(s => s.submissionType === 'GOOGLE_DRIVE').length} via Google Drive
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadSubmissions}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
          </div>

          {/* Submissions List */}
          {isLoading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loading submissions...</p>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Submissions Yet</h3>
              <p className="text-muted-foreground">No students have submitted this homework yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((submission) => (
                <Card key={submission.id} className="overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {submission.student?.firstName} {submission.student?.lastName}
                          </span>
                          <Badge variant={submission.isActive ? 'default' : 'secondary'}>
                            {submission.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          {getSubmissionTypeBadge(submission)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          Submitted: {formatDate(submission.submissionDate)}
                        </div>
                      </div>
                    </div>

                    {/* Google Drive File Info */}
                    {submission.submissionType === 'GOOGLE_DRIVE' && (
                      <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Cloud className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {submission.driveFileName || 'Google Drive File'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {submission.driveMimeType && (
                              <span className="mr-2">{submission.driveMimeType}</span>
                            )}
                            {submission.driveFileSize && (
                              <span>
                                {(submission.driveFileSize / 1024 / 1024).toFixed(2)} MB
                              </span>
                            )}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(getFileUrl(submission), '_blank')}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Open
                        </Button>
                      </div>
                    )}

                    {/* Remarks */}
                    {submission.remarks && (
                      <div>
                        <h4 className="text-sm font-medium mb-1">Notes:</h4>
                        <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                          {submission.remarks}
                        </p>
                      </div>
                    )}

                    {/* File Actions */}
                    <div className="flex flex-wrap gap-2">
                      {submission.fileUrl && submission.submissionType !== 'GOOGLE_DRIVE' && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => window.open(submission.fileUrl, '_blank')}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          View File
                        </Button>
                      )}

                      {submission.teacherCorrectionFileUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(submission.teacherCorrectionFileUrl, '_blank')}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          View Correction
                        </Button>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      Created: {formatDate(submission.createdAt)}
                      {submission.updatedAt !== submission.createdAt && (
                        <> • Updated: {formatDate(submission.updatedAt)}</>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HomeworkSubmissionsDialog;
