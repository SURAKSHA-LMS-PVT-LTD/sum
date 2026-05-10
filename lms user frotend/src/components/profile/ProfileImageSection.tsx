import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  profileImageApi,
  type ProfileImageStatus,
  type ImageHistoryEntry,
  type ProfileImageHistoryResponse,
} from '@/api/profileImage.api';
import { getImageUrl } from '@/utils/imageUrlHelper';
import {
  Camera, Clock, CheckCircle2, XCircle,
  History, ImageIcon, RefreshCw, ChevronDown, ChevronUp,
  Shield, Info,
} from 'lucide-react';
import ProfileImageUpload from '@/components/ProfileImageUpload';

interface ProfileImageSectionProps {
  currentImageUrl: string;
  onImageUpdate: (url: string) => void;
}

const STATUS_CONFIG = {
  PENDING: { icon: Clock, label: 'Under Review', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  VERIFIED: { icon: CheckCircle2, label: 'Verified', color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/30', badge: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  REJECTED: { icon: XCircle, label: 'Rejected', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

const ProfileImageSection: React.FC<ProfileImageSectionProps> = ({ currentImageUrl, onImageUpdate }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<ProfileImageStatus | null>(null);
  const [history, setHistory] = useState<ImageHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [statusError, setStatusError] = useState(false);

  const loadStatus = async () => {
    try {
      setLoading(true);
      setStatusError(false);
      const data = await profileImageApi.getImageStatus();
      setStatus(data);
    } catch (err) {
      console.log('Image status endpoint not available yet:', err);
      setStatusError(true);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const response = await profileImageApi.getImageHistory();
      setHistory(response.data);
      return response;
    } catch (err) {
      console.log('Image history endpoint not available yet:', err);
      toast({ title: 'Info', description: 'Image history is not available yet.', variant: 'default' });
      return null;
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (showHistory && !history) {
      loadHistory();
    }
  }, [showHistory]);

  // Pre-load history when status is REJECTED so we can show the rejection reason
  useEffect(() => {
    if (status?.imageVerificationStatus === 'REJECTED' && !history) {
      loadHistory();
    }
  }, [status?.imageVerificationStatus]);

  // Upload is blocked if there's already a pending submission
  const canChange = status
    ? status.imageVerificationStatus !== 'PENDING'
    : true;

  const handleImageUploaded = (newUrl: string) => {
    onImageUpdate(newUrl);
    setShowUploadDialog(false);
    // Reload status after upload
    setTimeout(() => loadStatus(), 1000);
  };

  // If the status API is not available, show a simpler version
  if (statusError) {
    return (
      <div className="space-y-4">
        {/* Simple Image Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" /> Profile Image
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 ring-2 ring-primary/20">
                <AvatarImage src={currentImageUrl} alt="Profile" className="object-cover" />
                <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                  {user?.firstName?.[0] || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {currentImageUrl ? 'Current profile image' : 'No image uploaded'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload a clear passport-style photo. Max 5MB (JPEG, PNG, WebP).
                </p>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowUploadDialog(true)}
                >
                  <Camera className="h-3.5 w-3.5 mr-1.5" />
                  {currentImageUrl ? 'Change Photo' : 'Upload Photo'}
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 border border-border/50">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Your image will be reviewed by an admin before it appears on your profile. You can change your image up to 3 times.
              </p>
            </div>
          </CardContent>
        </Card>

        <ProfileImageUpload
          currentImageUrl={currentImageUrl}
          onImageUpdate={handleImageUploaded}
          isOpen={showUploadDialog}
          onClose={() => setShowUploadDialog(false)}
          dialogOnly
        />
      </div>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" /> Profile Image
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={loadStatus} className="h-8">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Image + Change Counter */}
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20 ring-2 ring-primary/20 shrink-0">
              <AvatarImage
                src={status?.imageUrl ? getImageUrl(status.imageUrl) : currentImageUrl}
                alt="Profile"
                className="object-cover"
              />
              <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                {user?.firstName?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 space-y-2">
              {status?.imageVerificationStatus && (
                <div className="flex items-center gap-2 flex-wrap">
                  {(() => {
                    const cfg = STATUS_CONFIG[status.imageVerificationStatus];
                    const Icon = cfg.icon;
                    return (
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${cfg.badge}`}>
                        <Icon className="h-3 w-3" /> {cfg.label}
                      </span>
                    );
                  })()}
                </div>
              )}

              <Button
                size="sm"
                onClick={() => setShowUploadDialog(true)}
                disabled={!canChange}
                className="mt-1"
              >
                <Camera className="h-3.5 w-3.5 mr-1.5" />
                {currentImageUrl ? 'Change Photo' : 'Upload Photo'}
              </Button>
            </div>
          </div>

          {/* Pending Image Banner */}
          {status?.imageVerificationStatus === 'PENDING' && (
            <div className={`flex items-start gap-3 p-3 rounded-xl border ${STATUS_CONFIG.PENDING.border} ${STATUS_CONFIG.PENDING.bg}`}>
              {status.pendingImageUrl ? (
                <Avatar className="h-12 w-12 shrink-0 rounded-lg">
                  <AvatarImage src={getImageUrl(status.pendingImageUrl)} alt="Pending" className="object-cover" />
                  <AvatarFallback className="rounded-lg bg-muted text-xs">?</AvatarFallback>
                </Avatar>
              ) : (
                <Clock className={`h-5 w-5 shrink-0 mt-0.5 ${STATUS_CONFIG.PENDING.color}`} />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">New image under review</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your current verified image will remain visible until the new one is approved.
                </p>
              </div>
            </div>
          )}

          {/* Rejected Banner */}
          {status?.imageVerificationStatus === 'REJECTED' && (
            <div className={`flex items-start gap-3 p-3 rounded-xl border ${STATUS_CONFIG.REJECTED.border} ${STATUS_CONFIG.REJECTED.bg}`}>
              <XCircle className={`h-5 w-5 shrink-0 mt-0.5 ${STATUS_CONFIG.REJECTED.color}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Last image was rejected</p>
                {history?.[0]?.rejectionReason ? (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Reason: {history[0].rejectionReason}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Upload a new photo to replace it.
                  </p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 h-7 text-xs border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={() => setShowUploadDialog(true)}
                >
                  <Camera className="h-3 w-3 mr-1" />
                  Re-upload Photo
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Info */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 border border-border/50">
            <Shield className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Images are reviewed by an admin before appearing on your profile.</p>
              <p>Accepted formats: JPEG, PNG, WebP · Max size: 5MB</p>
              <p>Rejected images can be re-uploaded without using a change slot.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Image History Toggle */}
      <Card>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors rounded-lg"
        >
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Image History</span>
            {history && (
              <Badge variant="secondary" className="text-xs">
                {history.length} {history.length === 1 ? 'entry' : 'entries'}
              </Badge>
            )}
          </div>
          {showHistory ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {showHistory && (
          <CardContent className="pt-0 pb-4">
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !history || history.length === 0 ? (
              <div className="text-center py-8">
                <ImageIcon className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No image history yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((entry, idx) => {
                  const cfg = STATUS_CONFIG[entry.status];
                  const StatusIcon = cfg.icon;
                  const isRejected = entry.status === 'REJECTED';
                  return (
                    <div
                      key={entry.imageId}
                      className={`flex items-start gap-3 p-3 rounded-xl border ${idx === 0 ? cfg.border : 'border-border/50'} ${idx === 0 ? cfg.bg : 'bg-background'} transition-colors`}
                    >
                      {isRejected ? (
                        <div className="h-12 w-12 shrink-0 rounded-lg bg-muted flex items-center justify-center" title="File deleted on rejection">
                          <XCircle className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                      ) : (
                        <Avatar className="h-12 w-12 shrink-0 rounded-lg">
                          <AvatarImage src={getImageUrl(entry.imageUrl)} alt={`Submission ${idx + 1}`} className="object-cover" />
                          <AvatarFallback className="rounded-lg bg-muted text-xs">#{idx + 1}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">
                            {idx === history.length - 1 ? 'Initial Upload' : `Submission #${history.length - idx}`}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${cfg.badge}`}>
                            <StatusIcon className="h-3 w-3" />
                            {cfg.label}
                          </span>
                          {idx === 0 && entry.status === 'VERIFIED' && (
                            <Badge variant="secondary" className="text-[10px]">Current</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Uploaded: {new Date(entry.uploadedAt).toLocaleDateString()}
                          {entry.verifiedAt && ` · Verified: ${new Date(entry.verifiedAt).toLocaleDateString()}`}
                        </p>
                        {entry.rejectionReason && (
                          <p className="text-xs text-red-500 mt-1 flex items-start gap-1">
                            <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                            {entry.rejectionReason}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Upload Dialog */}
      <ProfileImageUpload
        currentImageUrl={currentImageUrl}
        onImageUpdate={handleImageUploaded}
        isOpen={showUploadDialog}
        onClose={() => setShowUploadDialog(false)}
        dialogOnly
      />
    </div>
  );
};

export default ProfileImageSection;
