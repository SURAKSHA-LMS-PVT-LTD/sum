import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { fileUploader, UploadProgress } from '@/utils/uploadHelper';
import { profileImageApi } from '@/api/profileImage.api';
import {
  CreditCard, Upload, FileText, CheckCircle2,
  AlertCircle, Loader2, ImageIcon, Lock,
} from 'lucide-react';

const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
const ALLOWED_EXT  = '.jpg,.jpeg,.png,.pdf';
const MAX_BYTES    = 10 * 1024 * 1024; // 10 MB

interface Props {
  /** If the user already has an ID document URL saved */
  currentIdUrl?: string | null;
  onUpdate?: (newIdUrl: string) => void;
}

export default function IdDocumentUpload({ currentIdUrl, onUpdate }: Props) {
  const { user, selectedInstitute } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [progress, setProgress] = useState<UploadProgress>({ stage: 'idle', message: '', progress: 0 });
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(currentIdUrl ?? null);

  const isUploading = progress.stage !== 'idle' && progress.stage !== 'complete' && progress.stage !== 'error';

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Client-side validation
    if (!ALLOWED_MIME.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Only JPEG, PNG, or PDF files are allowed.', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: 'File too large', description: 'Maximum file size for ID documents is 10 MB.', variant: 'destructive' });
      return;
    }

    // Check for double extensions (security guard)
    const parts = file.name.split('.');
    if (parts.length > 2) {
      toast({ title: 'Invalid filename', description: 'Files with double extensions are not allowed.', variant: 'destructive' });
      return;
    }

    try {
      // Steps 1–3: signed URL upload
      const publicUrl = await fileUploader.uploadFile(file, 'id-documents', (p) => setProgress(p));

      // Step 4: register with backend
      await profileImageApi.uploadIdDocument(user.id, publicUrl);

      setUploadedUrl(publicUrl);
      onUpdate?.(publicUrl);
      toast({ title: 'ID document saved', description: 'Your document has been uploaded successfully.' });
      setProgress({ stage: 'complete', message: 'Upload complete!', progress: 100 });
    } catch (err: any) {
      setProgress({ stage: 'error', message: err.message, progress: 0, error: err });
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isPdf = uploadedUrl?.toLowerCase().includes('.pdf');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" /> ID Document
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Current document preview / status */}
        {uploadedUrl ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/30">
            {isPdf ? (
              <FileText className="h-8 w-8 text-green-600 shrink-0" />
            ) : (
              <img
                src={uploadedUrl}
                alt="ID document"
                className="h-16 w-24 rounded-lg object-cover border border-border shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">Document saved</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{uploadedUrl.split('/').pop()}</p>
              {isPdf && (
                <a
                  href={uploadedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline mt-0.5 inline-block"
                >
                  View PDF
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 border border-border/50">
            <ImageIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">No ID document uploaded yet.</p>
          </div>
        )}

        {/* Upload progress */}
        {isUploading && (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{progress.message}</span>
              <span className="text-xs font-medium">{Math.round(progress.progress)}%</span>
            </div>
            <Progress value={progress.progress} className="h-1.5" />
          </div>
        )}

        {/* Error */}
        {progress.stage === 'error' && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-600 dark:text-red-400">{progress.message}</p>
          </div>
        )}

        {/* Info note */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 border border-border/50">
          <CreditCard className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>Accepted formats: JPEG, PNG, PDF · Max size: 10 MB</p>
            <p>ID documents are saved immediately without admin review.</p>
          </div>
        </div>

        {/* Upload button */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_EXT}
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={true}
          title="This feature is not available yet"
          className="cursor-not-allowed opacity-50"
        >
          <Lock className="h-3.5 w-3.5 mr-1.5" />
          {uploadedUrl ? 'Replace Document' : 'Upload Document'}
        </Button>

      </CardContent>
    </Card>
  );
}
