import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage } from '@/api/apiError';
import {
  checkDriveConnection,
  getDriveConnectUrl,
  DriveConnectionStatus,
} from '@/services/driveService';
import { getValidDriveToken } from '@/lib/driveTokenCache';
import { Cloud, CloudUpload, File, X, CheckCircle2, Loader2, ExternalLink, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
}

interface GoogleDriveUploaderProps {
  onFileSelected: (file: GoogleDriveFile, accessToken: string) => void;
  onClear: () => void;
  selectedFile: GoogleDriveFile | null;
  disabled?: boolean;
  acceptedTypes?: string;
}

const GoogleDriveUploader: React.FC<GoogleDriveUploaderProps> = ({
  onFileSelected,
  onClear,
  selectedFile,
  disabled = false,
  acceptedTypes = '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.zip'
}) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [connectionStatus, setConnectionStatus] = useState<DriveConnectionStatus | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    const check = async () => {
      setCheckingConnection(true);
      try {
        const status = await checkDriveConnection();
        setConnectionStatus(status);
      } catch {
        setConnectionStatus({ isConnected: false });
      } finally {
        setCheckingConnection(false);
      }
    };
    check();
  }, []);

  const isConnected = connectionStatus?.isConnected === true;

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      const { authUrl } = await getDriveConnectUrl(window.location.pathname);
      window.location.href = authUrl;
    } catch {
      toast({
        title: 'Connect Google Drive',
        description: 'Please connect Google Drive from your Profile > Apps tab.',
      });
      navigate('/profile?tab=apps');
      setConnecting(false);
    }
  }, [navigate, toast]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: "Please select a file smaller than 10MB", variant: "destructive" });
        return;
      }
      setLocalFile(file);
    }
  }, [toast]);

  const uploadToGoogleDrive = useCallback(async () => {
    if (!localFile) return;
    setIsUploading(true);
    try {
      const tokenData = await getValidDriveToken();
      const metadata = { name: localFile.name, mimeType: localFile.type || 'application/octet-stream' };
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', localFile);

      const response = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size',
        { method: 'POST', headers: { Authorization: `Bearer ${tokenData.accessToken}` }, body: formData }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 401) throw new Error('Google Drive session expired. Please reconnect from Profile > Apps.');
        throw new Error(errorData.error?.message || 'Upload failed');
      }

      const data = await response.json();
      const driveFile: GoogleDriveFile = { id: data.id, name: data.name, mimeType: data.mimeType, size: parseInt(data.size) || localFile.size };
      onFileSelected(driveFile, tokenData.accessToken);
      setLocalFile(null);
      toast({ title: "Uploaded to Google Drive", description: `${driveFile.name} uploaded successfully` });
    } catch (error: any) {
      console.error('Google Drive upload error:', error);
      toast({ title: "Upload Failed", description: getErrorMessage(error, 'Failed to upload'), variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  }, [localFile, onFileSelected, toast]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  if (checkingConnection) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground ml-2">Checking connection...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cloud className={cn("h-4 w-4", isConnected ? "text-green-600" : "text-muted-foreground")} />
          <span className="text-xs font-medium">Google Drive</span>
          {isConnected && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-green-50 text-green-700 border-green-200">
              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Connected
            </Badge>
          )}
        </div>
        {!isConnected && (
          <Button type="button" variant="outline" size="sm" onClick={handleConnect} disabled={disabled || connecting} className="h-7 text-xs">
            {connecting ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Link2 className="h-3 w-3 mr-1" />}
            Connect
          </Button>
        )}
      </div>

      {/* Not Connected */}
      {!isConnected && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center">
            <Cloud className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <h3 className="font-medium text-sm mb-1">Connect Google Drive</h3>
            <p className="text-xs text-muted-foreground mb-3">Upload homework to your Google Drive storage.</p>
            <Button type="button" size="sm" onClick={handleConnect} disabled={disabled} className="text-xs">
              <Cloud className="h-3 w-3 mr-1" /> Connect Google Drive
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Connected - file picker or file ready to upload */}
      {isConnected && !selectedFile && (
        <>
          {localFile ? (
            <Card className="border-primary/20 bg-accent/50">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <File className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-medium text-xs truncate max-w-[180px]">{localFile.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatFileSize(localFile.size)}</p>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setLocalFile(null)} disabled={isUploading} className="h-6 w-6 p-0">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                <Button type="button" onClick={uploadToGoogleDrive} disabled={isUploading} className="w-full mt-2 h-8 text-xs">
                  {isUploading ? (
                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Uploading...</>
                  ) : (
                    <><CloudUpload className="h-3 w-3 mr-1" />Upload to Drive</>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div>
              <input type="file" id="google-drive-file-upload" onChange={handleFileSelect} accept={acceptedTypes} className="hidden" disabled={disabled || isUploading} />
              <label
                htmlFor="google-drive-file-upload"
                className={cn(
                  "flex flex-col items-center justify-center w-full py-4 border-2 border-dashed rounded-lg transition-all cursor-pointer",
                  disabled || isUploading ? "border-muted bg-muted/50 cursor-not-allowed" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5"
                )}
              >
                <CloudUpload className="h-5 w-5 mb-1 text-muted-foreground" />
                <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">Select file for Google Drive</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground/70 mt-0.5">PDF, DOC, JPG, PNG (max 10MB)</p>
              </label>
            </div>
          )}
        </>
      )}

      {/* File uploaded to Drive */}
      {isConnected && selectedFile && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/50 border border-primary/20">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-[10px] sm:text-xs truncate">{selectedFile.name}</p>
            <p className="text-[9px] text-muted-foreground">{formatFileSize(selectedFile.size)} • On Google Drive</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => window.open(`https://drive.google.com/file/d/${selectedFile.id}/view`, '_blank')} className="h-6 w-6 p-0 shrink-0">
            <ExternalLink className="h-3 w-3" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={disabled} className="h-6 w-6 p-0 hover:text-destructive shrink-0">
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default GoogleDriveUploader;
