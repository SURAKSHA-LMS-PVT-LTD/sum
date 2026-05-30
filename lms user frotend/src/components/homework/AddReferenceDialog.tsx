import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Link as LinkIcon, 
  HardDrive,
  Cloud,
  Video,
  Image,
  FileText,
  File,
  Music,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  Paperclip
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  homeworkReferencesApi, 
  ReferenceType, 
  HomeworkReference,
  formatFileSize,
  getAcceptedFileTypes,
  getMaxFileSize,
  detectReferenceType
} from '@/api/homeworkReferences.api';
import { checkDriveConnection, getDriveConnectUrl, getDriveAccessToken } from '@/services/driveService';
import { useAuth } from '@/contexts/AuthContext';
import { instituteDriveApi, InstituteDriveStatus } from '@/api/instituteDriveAccess.api';
import { uploadToInstituteDrive } from '@/lib/instituteDriveUpload';
import { getErrorMessage } from '@/api/apiError';

type DriveDestination = 'institute' | 'personal';

interface AddReferenceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  homeworkId: string;
  onSuccess: (reference: HomeworkReference) => void;
}

const REFERENCE_TYPES: { value: ReferenceType; label: string; icon: React.ElementType }[] = [
  { value: 'VIDEO', label: 'Video', icon: Video },
  { value: 'IMAGE', label: 'Image', icon: Image },
  { value: 'PDF', label: 'PDF', icon: FileText },
  { value: 'DOCUMENT', label: 'Document', icon: File },
  { value: 'AUDIO', label: 'Audio', icon: Music },
  { value: 'LINK', label: 'Link', icon: LinkIcon },
  { value: 'OTHER', label: 'Other', icon: File },
];

const AddReferenceDialog: React.FC<AddReferenceDialogProps> = ({
  isOpen,
  onClose,
  homeworkId,
  onSuccess,
}) => {
  const { toast } = useToast();
  const { selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const driveFileRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState<'link' | 'drive'>('drive');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Common fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [referenceType, setReferenceType] = useState<ReferenceType>('OTHER');
  
  // File upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Link
  const [externalUrl, setExternalUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  
  // Google Drive — personal
  const [driveFileId, setDriveFileId] = useState('');
  const [driveAccessToken, setDriveAccessToken] = useState('');
  const [isDriveConnected, setIsDriveConnected] = useState<boolean | null>(null);
  const [isDriveChecking, setIsDriveChecking] = useState(false);

  // Google Drive — institute
  const [driveDestination, setDriveDestination] = useState<DriveDestination>('institute');
  const [instituteDriveStatus, setInstituteDriveStatus] = useState<InstituteDriveStatus | null>(null);
  const [instituteDriveChecked, setInstituteDriveChecked] = useState(false);
  const [driveUploading, setDriveUploading] = useState(false);
  const [driveUploadProgress, setDriveUploadProgress] = useState('');

  const checkDriveStatus = async () => {
    setIsDriveChecking(true);
    try {
      const status = await checkDriveConnection();
      setIsDriveConnected(status.isConnected);
      if (status.isConnected) {
        const tokenData = await getDriveAccessToken();
        setDriveAccessToken(tokenData.accessToken);
      }
    } catch {
      setIsDriveConnected(false);
    } finally {
      setIsDriveChecking(false);
    }
  };

  const checkInstituteDriveStatus = async () => {
    if (!selectedInstitute?.id) return;
    try {
      const status = await instituteDriveApi.getStatus(selectedInstitute.id);
      setInstituteDriveStatus(status);
      if (status.isConnected) setDriveDestination('institute');
    } catch {
      setInstituteDriveStatus(null);
    } finally {
      setInstituteDriveChecked(true);
    }
  };

  useEffect(() => {
    if (!isOpen || activeTab !== 'drive') return;
    checkDriveStatus();
    if (!instituteDriveChecked) checkInstituteDriveStatus();
  }, [isOpen, activeTab]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setReferenceType('OTHER');
    setSelectedFile(null);
    setExternalUrl('');
    setLinkTitle('');
    setDriveFileId('');
    setDriveAccessToken('');
    setUploadProgress(0);
    setActiveTab('drive');
    setDriveUploading(false);
    setDriveUploadProgress('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const detectedType = detectReferenceType(file);
    const maxSize = getMaxFileSize(detectedType);

    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: `Maximum size for ${detectedType} is ${formatFileSize(maxSize)}`,
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
    setReferenceType(detectedType);
    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, '')); // Remove extension for title
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile || !title) {
      toast({
        title: 'Missing information',
        description: 'Please select a file and enter a title',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const reference = await homeworkReferencesApi.uploadFileToS3(
        homeworkId,
        selectedFile,
        title,
        referenceType,
        description,
        setUploadProgress
      );

      toast({
        title: 'Reference added',
        description: `"${title}" has been uploaded successfully`,
      });

      onSuccess(reference);
      handleClose();
    } catch (error: any) {
      console.error('Upload failed:', error);
      toast({
        title: 'Upload failed',
        description: getErrorMessage(error, 'Failed to upload file'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const handleLinkSubmit = async () => {
    if (!externalUrl || !title) {
      toast({
        title: 'Missing information',
        description: 'Please enter a URL and title',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const reference = await homeworkReferencesApi.createFromLink({
        homeworkId,
        title,
        description,
        referenceType,
        externalUrl,
        linkTitle,
      });

      toast({
        title: 'Reference added',
        description: `"${title}" has been added successfully`,
      });

      onSuccess(reference);
      handleClose();
    } catch (error: any) {
      console.error('Link creation failed:', error);
      toast({
        title: 'Failed to add link',
        description: getErrorMessage(error, 'Failed to add link reference'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleDriveAuth = async () => {
    try {
      const { authUrl } = await getDriveConnectUrl();
      const popup = window.open(authUrl, 'Google OAuth', 'width=600,height=700,left=200,top=100');

      if (!popup) {
        toast({
          title: 'Popup blocked',
          description: 'Please allow popups for Google Drive authentication',
          variant: 'destructive',
        });
        return;
      }

      const interval = setInterval(() => {
        if (popup.closed) {
          clearInterval(interval);
          checkDriveStatus();
        }
      }, 1000);
    } catch (error: any) {
      toast({
        title: 'Authentication failed',
        description: getErrorMessage(error, 'Failed to connect to Google Drive'),
        variant: 'destructive',
      });
    }
  };

  const handleDriveSubmit = async () => {
    if (!driveFileId || !title || !driveAccessToken) {
      toast({
        title: 'Missing information',
        description: 'Please authenticate with Google Drive and enter the file ID',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const reference = await homeworkReferencesApi.createFromGoogleDrive({
        homeworkId,
        title,
        description,
        referenceType,
        driveFileId,
        accessToken: driveAccessToken,
      });

      toast({
        title: 'Reference added',
        description: `"${title}" has been added from Google Drive`,
      });

      onSuccess(reference);
      handleClose();
    } catch (error: any) {
      console.error('Drive reference creation failed:', error);
      toast({
        title: 'Failed to add Drive file',
        description: getErrorMessage(error, 'Failed to add Google Drive reference'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInstituteDriveFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedInstitute?.id) return;
    e.target.value = '';

    const detectedType = detectReferenceType(file);
    const fileTitle = title || file.name.replace(/\.[^/.]+$/, '');

    setDriveUploading(true);
    setDriveUploadProgress('Preparing…');
    try {
      const registered = await uploadToInstituteDrive({
        file,
        instituteId: selectedInstitute.id,
        purpose: 'HOMEWORK_REFERENCE',
        folderParams: {
          subjectName: selectedSubject?.name,
          className: selectedClass?.name,
          grade: selectedClass?.grade ? Number(selectedClass.grade) : undefined,
        },
        referenceType: 'HOMEWORK_REFERENCE',
        referenceId: homeworkId,
        onProgress: (p) => setDriveUploadProgress(`Uploading ${p}%`),
      });

      // Create the homework reference from the uploaded file
      const reference = await homeworkReferencesApi.createFromLink({
        homeworkId,
        title: fileTitle,
        description,
        referenceType: detectedType,
        externalUrl: registered.driveWebViewLink || registered.viewUrl,
        linkTitle: `Institute Drive: ${file.name}`,
      });

      toast({ title: 'Reference added', description: `"${fileTitle}" uploaded to Institute Drive` });
      onSuccess(reference);
      handleClose();
    } catch (err: any) {
      console.error('Institute Drive upload failed:', err);
      toast({
        title: 'Upload failed',
        description: getErrorMessage(err, 'Failed to upload to Institute Drive'),
        variant: 'destructive',
      });
    } finally {
      setDriveUploading(false);
      setDriveUploadProgress('');
    }
  };

  const handleSubmit = () => {
    switch (activeTab) {
      case 'link':
        handleLinkSubmit();
        break;
      case 'drive':
        handleDriveSubmit();
        break;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose} routeName="add-homework-reference-popup">
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Reference Material</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="drive" className="flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Drive
            </TabsTrigger>
            <TabsTrigger value="link" className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              Link
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            {/* Common Fields */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter reference title"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description (optional)"
                  rows={2}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Type</Label>
                <Select value={referenceType} onValueChange={(v) => setReferenceType(v as ReferenceType)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REFERENCE_TYPES.map(({ value, label, icon: Icon }) => (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tab-specific content */}
            <TabsContent value="link" className="mt-0 space-y-3">
              <div>
                <Label htmlFor="externalUrl">URL *</Label>
                <Input
                  id="externalUrl"
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://example.com/resource"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="linkTitle">Link Button Text</Label>
                <Input
                  id="linkTitle"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="e.g., Watch on YouTube"
                  className="mt-1"
                />
              </div>
            </TabsContent>

            <TabsContent value="drive" className="mt-0 space-y-3">
              {/* Drive destination selector */}
              {instituteDriveChecked && instituteDriveStatus?.isConnected && (
                <div className="flex items-center bg-muted rounded-xl p-1 gap-1 w-fit">
                  <button
                    type="button"
                    onClick={() => setDriveDestination('institute')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      driveDestination === 'institute' ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <HardDrive className="h-3 w-3" /> Institute Drive
                  </button>
                  <button
                    type="button"
                    onClick={() => setDriveDestination('personal')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      driveDestination === 'personal' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Cloud className="h-3 w-3" /> Personal Drive
                  </button>
                </div>
              )}

              {/* Institute Drive section */}
              {driveDestination === 'institute' && instituteDriveStatus?.isConnected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded-xl px-3 py-2 border border-blue-200 dark:border-blue-800">
                    <HardDrive className="h-4 w-4 shrink-0" />
                    <span>Institute Drive <strong>{instituteDriveStatus.googleEmail}</strong></span>
                  </div>
                  <div>
                    <input
                      ref={driveFileRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*,.mp4,.mp3,.wav"
                      className="hidden"
                      onChange={handleInstituteDriveFileSelect}
                      disabled={driveUploading}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => driveFileRef.current?.click()}
                      disabled={driveUploading}
                      className="gap-2"
                    >
                      {driveUploading ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />{driveUploadProgress || 'Uploading…'}</>
                      ) : (
                        <><Paperclip className="h-4 w-4" />Upload to Institute Drive</>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">File uploads directly to the institute's shared Google Drive</p>
                  </div>
                </div>
              ) : (
                /* Personal Drive section */
                <>
                  {isDriveChecking ? (
                    <div className="text-center py-4">
                      <Loader2 className="h-8 w-8 mx-auto text-muted-foreground mb-3 animate-spin" />
                      <p className="text-sm text-muted-foreground">Checking Google Drive connection...</p>
                    </div>
                  ) : isDriveConnected !== true ? (
                    <div className="text-center py-4">
                      <HardDrive className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground mb-4">
                        Connect your Google Drive to add files
                      </p>
                      <Button onClick={handleGoogleDriveAuth}>
                        <HardDrive className="h-4 w-4 mr-2" />
                        Connect Google Drive
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="text-sm text-green-700 dark:text-green-400">
                          Connected to Google Drive
                        </span>
                      </div>
                      <div>
                        <Label htmlFor="driveFileId">File ID *</Label>
                        <Input
                          id="driveFileId"
                          value={driveFileId}
                          onChange={(e) => setDriveFileId(e.target.value)}
                          placeholder="Enter Google Drive file ID"
                          className="mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          You can find this in the file's sharing URL
                        </p>
                      </div>
                    </>
                  )}
                </>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Done
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || driveUploading || (activeTab === 'drive' && driveDestination === 'personal' && isDriveConnected !== true)}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              'Add Reference'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddReferenceDialog;
