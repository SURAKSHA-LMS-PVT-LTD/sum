import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/api/apiError';
import {
  instituteDriveApi,
  InstituteDriveStatus,
  InstituteDrivePurpose,
  InstituteDriveRegisteredFile,
  GetInstituteFolderParams,
} from '@/api/instituteDriveAccess.api';
import { getValidInstituteToken } from '@/lib/instituteTokenCache';
import { uploadToInstituteDrive } from '@/lib/instituteDriveUpload';
import {
  Building2,
  Cloud,
  CloudUpload,
  File,
  X,
  CheckCircle2,
  Loader2,
  User,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type UploadDestination = 'institute' | 'personal';

interface InstituteDriveUploaderProps {
  /** Institute context */
  instituteId: string;
  instituteName: string;
  /** Upload classification */
  purpose: InstituteDrivePurpose;
  folderParams?: Omit<GetInstituteFolderParams, 'purpose'>;
  referenceType?: string;
  referenceId?: string;
  /** Required when destination = 'personal'. Caller handles the personal-drive upload. */
  onPersonalSelected?: (file: File) => void;
  /** Called after a successful institute-drive upload */
  onInstituteUploaded?: (file: InstituteDriveRegisteredFile) => void;
  onClear?: () => void;
  uploadedFile?: InstituteDriveRegisteredFile | null;
  disabled?: boolean;
  /** Whether to show the personal-drive option at all */
  showPersonalOption?: boolean;
}

const InstituteDriveUploader: React.FC<InstituteDriveUploaderProps> = ({
  instituteId,
  instituteName,
  purpose,
  folderParams,
  referenceType,
  referenceId,
  onPersonalSelected,
  onInstituteUploaded,
  onClear,
  uploadedFile,
  disabled = false,
  showPersonalOption = true,
}) => {
  const { toast } = useToast();
  const [driveStatus, setDriveStatus] = useState<InstituteDriveStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [destination, setDestination] = useState<UploadDestination>('institute');
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    instituteDriveApi
      .getStatus(instituteId)
      .then(setDriveStatus)
      .catch(() => setDriveStatus({ isConnected: false }))
      .finally(() => setCheckingStatus(false));
  }, [instituteId]);

  // If institute drive is not connected, default to personal
  useEffect(() => {
    if (!checkingStatus && driveStatus && !driveStatus.isConnected) {
      setDestination('personal');
    }
  }, [checkingStatus, driveStatus]);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.size > 100 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select a file smaller than 100MB.',
          variant: 'destructive',
        });
        return;
      }

      setLocalFile(file);

      // Immediately hand off to personal handler if that's the destination
      if (destination === 'personal' && onPersonalSelected) {
        onPersonalSelected(file);
        setLocalFile(null);
      }
    },
    [destination, onPersonalSelected, toast],
  );

  const handleInstituteUpload = useCallback(async () => {
    if (!localFile || !driveStatus?.isConnected) return;
    setIsUploading(true);
    setProgress(0);

    try {
      const result = await uploadToInstituteDrive({
        file: localFile,
        instituteId,
        purpose,
        folderParams,
        referenceType,
        referenceId,
        onProgress: setProgress,
      });

      toast({
        title: 'Uploaded to Institute Drive',
        description: `${result.fileName} saved to ${instituteName}'s Google Drive.`,
      });

      onInstituteUploaded?.(result);
      setLocalFile(null);
    } catch (err: any) {
      toast({
        title: 'Upload Failed',
        description: getErrorMessage(err, 'Failed to upload to institute Drive'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  }, [
    localFile,
    driveStatus,
    instituteId,
    purpose,
    folderParams,
    referenceType,
    referenceId,
    instituteName,
    onInstituteUploaded,
    toast,
  ]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  if (checkingStatus) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground ml-2">Checking institute Drive...</span>
      </div>
    );
  }

  // Success: show uploaded file info
  if (uploadedFile) {
    return (
      <div className="space-y-2">
        <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <div>
                  <p className="text-xs font-medium truncate max-w-[200px]">{uploadedFile.fileName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Saved to Institute Drive
                  </p>
                </div>
              </div>
              {onClear && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClear}
                  disabled={disabled}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const instituteConnected = driveStatus?.isConnected === true;

  return (
    <div className="space-y-3">
      {/* Destination selector */}
      {showPersonalOption && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">Upload destination</p>
          <RadioGroup
            value={destination}
            onValueChange={(v) => setDestination(v as UploadDestination)}
            className="flex flex-col gap-2"
            disabled={disabled}
          >
            {/* Institute Drive option */}
            <div
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                destination === 'institute'
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-card hover:bg-accent/30',
                !instituteConnected && 'opacity-50 cursor-not-allowed',
              )}
            >
              <RadioGroupItem
                value="institute"
                id="dest-institute"
                disabled={!instituteConnected || disabled}
                className="mt-0.5"
              />
              <Label
                htmlFor="dest-institute"
                className={cn(
                  'flex-1 cursor-pointer space-y-0.5',
                  (!instituteConnected || disabled) && 'cursor-not-allowed',
                )}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-semibold">Institute Drive</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] h-4 px-1.5',
                      instituteConnected
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {instituteConnected ? (
                      <>
                        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                        Connected
                      </>
                    ) : (
                      'Not connected'
                    )}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {instituteConnected
                    ? `Stored in ${instituteName}'s shared Drive — persists even if you leave.`
                    : 'Admin must connect an institute Google Drive first.'}
                </p>
              </Label>
            </div>

            {/* Personal Drive option */}
            <div
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                destination === 'personal'
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-card hover:bg-accent/30',
              )}
            >
              <RadioGroupItem
                value="personal"
                id="dest-personal"
                disabled={disabled}
                className="mt-0.5"
              />
              <Label
                htmlFor="dest-personal"
                className={cn('flex-1 cursor-pointer space-y-0.5', disabled && 'cursor-not-allowed')}
              >
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold">My Personal Drive</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <AlertTriangle className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-tight">
                    Files may become inaccessible if you leave this institute.
                  </p>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {/* File picker + upload button */}
      {destination === 'institute' && instituteConnected && (
        <div className="space-y-2">
          {!localFile ? (
            <div className="flex items-center gap-2">
              <label
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 h-9 rounded-md border border-dashed text-xs text-muted-foreground cursor-pointer transition-colors hover:bg-accent/50',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <Cloud className="h-3.5 w-3.5" />
                Choose file for Institute Drive
                <input
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={disabled}
                />
              </label>
            </div>
          ) : (
            <Card className="border-primary/20 bg-accent/50">
              <CardContent className="py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <File className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs font-medium truncate max-w-[180px]">{localFile.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatFileSize(localFile.size)}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLocalFile(null)}
                    disabled={isUploading}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                {isUploading && (
                  <div className="w-full bg-muted rounded-full h-1.5 mb-2 overflow-hidden">
                    <div
                      className="h-1.5 bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}

                <Button
                  type="button"
                  onClick={handleInstituteUpload}
                  disabled={isUploading || disabled}
                  className="w-full h-8 text-xs"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      {progress < 85 ? `Uploading ${progress}%…` : 'Registering…'}
                    </>
                  ) : (
                    <>
                      <CloudUpload className="h-3 w-3 mr-1" />
                      Upload to Institute Drive
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Personal drive: just show file picker — parent handles the actual upload */}
      {destination === 'personal' && !localFile && (
        <div className="flex items-center gap-2">
          <label
            className={cn(
              'flex-1 flex items-center justify-center gap-2 h-9 rounded-md border border-dashed text-xs text-muted-foreground cursor-pointer transition-colors hover:bg-accent/50',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <User className="h-3.5 w-3.5" />
            Choose file for Personal Drive
            <input
              type="file"
              className="hidden"
              onChange={handleFileSelect}
              disabled={disabled}
            />
          </label>
        </div>
      )}
    </div>
  );
};

export default InstituteDriveUploader;
