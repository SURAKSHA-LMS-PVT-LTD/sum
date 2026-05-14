import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { homeworkSubmissionsApi } from '@/api/homeworkSubmissions.api';
import { Upload, Loader2 } from 'lucide-react';
import FileUploadZone, { type UploadResult } from '@/components/common/FileUploadZone';
import { getErrorMessage } from '@/api/apiError';
import { useAuth } from '@/contexts/AuthContext';

export interface HomeworkSubmission {
  id: string;
  homeworkId: string;
  studentId: string;
  submissionDate: string;
  fileUrl?: string;
  teacherCorrectionFileUrl?: string;
  remarks?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface UploadCorrectionDialogProps {
  submissionId: string;
  studentName: string;
  submission?: HomeworkSubmission;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const UploadCorrectionDialog = ({
  submissionId,
  studentName,
  submission,
  isOpen,
  onClose,
  onSuccess
}: UploadCorrectionDialogProps) => {
  const { toast } = useToast();
  const { selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (isOpen) {
      setUploadResult(null);
      setRemarks('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!uploadResult) {
      toast({ title: 'Error', description: 'Please upload a correction file', variant: 'destructive' });
      return;
    }

    const effectiveId = submissionId || submission?.id;
    if (!effectiveId) {
      toast({ title: 'Error', description: 'Submission ID is missing', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (uploadResult.method === 'institute-drive' && uploadResult.driveFileId && uploadResult.accessToken) {
        // Institute Drive upload - use Drive endpoint with institute token
        await homeworkSubmissionsApi.uploadCorrectionFileDrive(effectiveId, uploadResult.driveFileId, uploadResult.accessToken);
      } else if (uploadResult.method === 'google-drive' && uploadResult.driveFileId) {
        // Google Drive upload - use dedicated Drive endpoint with access token
        const token = uploadResult.accessToken || (await import('@/lib/driveTokenCache').then(m => m.getValidDriveToken())).accessToken;
        await homeworkSubmissionsApi.uploadCorrectionFileDrive(effectiveId, uploadResult.driveFileId, token);
      } else if (uploadResult.relativePath) {
        // Cloud storage upload - use the correction file endpoint
        await homeworkSubmissionsApi.uploadCorrectionFile(effectiveId, uploadResult.relativePath);
      }

      // Add remarks if provided
      if (remarks.trim()) {
        await homeworkSubmissionsApi.reviewSubmission(effectiveId, { remarks });
      }

      toast({ title: 'Success', description: 'Correction uploaded successfully' });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error uploading correction:', error);
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to upload correction'), variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Upload className="h-4 w-4" />
            Upload Correction for {studentName}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Reusable File Upload Zone - same component as homework submission */}
          <FileUploadZone
            folder={"correction-files" as any}
            drivePurpose="HOMEWORK_CORRECTION"
            driveReferenceType="homework_submission"
            driveReferenceId={submissionId || submission?.id}
            showDriveTab={true}
            maxFileSize={20 * 1024 * 1024}
            acceptedTypes=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
            onUploadComplete={setUploadResult}
            onClear={() => setUploadResult(null)}
            disabled={isSubmitting}
            label="Select correction file"
            instituteId={selectedInstitute?.id}
            instituteDrivePurpose="HOMEWORK_CORRECTION"
            instituteFolderParams={{
              subjectName: selectedSubject?.name,
              className: selectedClass?.name,
              grade: selectedClass?.grade ? Number(selectedClass.grade) : undefined,
            }}
          />

          {/* Remarks */}
          <div className="space-y-1">
            <Label htmlFor="correction-remarks" className="text-xs">Remarks (Optional)</Label>
            <Textarea
              id="correction-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add feedback for the student..."
              rows={3}
              disabled={isSubmitting}
              className="text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!uploadResult || isSubmitting}>
              {isSubmitting ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="h-3 w-3 mr-1" /> Upload Correction</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UploadCorrectionDialog;
