import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { homeworkSubmissionsApi } from '@/api/homeworkSubmissions.api';
import { FileText, Upload, Loader2, ExternalLink } from 'lucide-react';
import FileUploadZone, { type UploadResult } from '@/components/common/FileUploadZone';

const submissionSchema = z.object({
  submissionDate: z.string().min(1, 'Submission date is required'),
  remarks: z.string().optional()
});

type SubmissionFormData = z.infer<typeof submissionSchema>;

interface SubmitHomeworkFormProps {
  homework: any;
  onClose: () => void;
  onSuccess: () => void;
}

const SubmitHomeworkForm = ({ homework, onClose, onSuccess }: SubmitHomeworkFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<SubmissionFormData>({
    resolver: zodResolver(submissionSchema) as any,
    defaultValues: {
      submissionDate: new Date().toISOString().split('T')[0],
      remarks: ''
    }
  });

  if (!homework) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No homework selected</p>
      </div>
    );
  }

  const onSubmit = async (data: SubmissionFormData) => {
    if (!user?.id) {
      toast({ title: "Error", description: "User not authenticated", variant: "destructive" });
      return;
    }

    if (!uploadResult) {
      toast({ title: "Error", description: "Please upload a file first", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      if (uploadResult.method === 'google-drive' && uploadResult.driveFileId && uploadResult.accessToken) {
        // Send driveFileId + accessToken to backend — no direct Google API calls
        await homeworkSubmissionsApi.submitViaGoogleDrive({
          homeworkId: homework.id,
          fileId: uploadResult.driveFileId,
          accessToken: uploadResult.accessToken,
          fileName: uploadResult.fileName,
          mimeType: uploadResult.mimeType,
        });
      } else if (uploadResult.relativePath) {
        await homeworkSubmissionsApi.submitHomework(homework.id, uploadResult.relativePath, {
          submissionDate: data.submissionDate,
          remarks: data.remarks,
        });
      }

      toast({ title: "Success", description: "Homework submitted successfully!" });
      onSuccess();
    } catch (error: any) {
      console.error('Error submitting homework:', error);
      let errorMessage = "Failed to submit homework. Please try again.";
      if (error.message?.includes("not found")) errorMessage = "This homework assignment is not available for submission.";
      else if (error.message?.includes("period")) errorMessage = "The submission period has ended.";
      else if (error.message) errorMessage = error.message;
      toast({ title: "Submission Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3 w-full">
      {/* Compact Homework Info */}
      <div className="flex items-start gap-2 p-2 sm:p-3 rounded-lg bg-muted/50 border">
        <FileText className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-xs sm:text-sm truncate">{homework.title}</h3>
          <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1 mt-0.5">{homework.description}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {homework.endDate && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                Due: {new Date(homework.endDate).toLocaleDateString()}
              </Badge>
            )}
            {homework.referenceLink && (
              <Button
                type="button" size="sm" variant="ghost"
                onClick={() => window.open(homework.referenceLink, '_blank')}
                className="h-4 px-1 text-[10px] text-primary hover:text-primary"
              >
                <ExternalLink className="h-2.5 w-2.5 mr-0.5" /> Ref
              </Button>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        {/* Reusable File Upload Zone */}
        <FileUploadZone
          drivePurpose="HOMEWORK_SUBMISSION"
          driveReferenceType="homework"
          driveReferenceId={homework.id}
          showDriveTab={true}
          maxFileSize={20 * 1024 * 1024}
          acceptedTypes=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.zip"
          onUploadComplete={setUploadResult}
          onClear={() => setUploadResult(null)}
          disabled={isSubmitting}
        />

        {/* Remarks */}
        <div className="space-y-1">
          <Label htmlFor="remarks" className="text-[10px] sm:text-xs">Notes (Optional)</Label>
          <Textarea
            id="remarks"
            placeholder="Any comments..."
            {...register('remarks')}
            rows={2}
            className="text-xs sm:text-sm resize-none min-h-[50px]"
          />
        </div>

        <input type="hidden" {...register('submissionDate')} />

        {/* Submit Buttons */}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="flex-1 h-8 text-xs">
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting || !uploadResult} className="flex-1 h-8 text-xs">
            {isSubmitting ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" /><span>Submitting...</span></>
            ) : (
              <><Upload className="h-3 w-3 mr-1" /><span>Submit</span></>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default SubmitHomeworkForm;
