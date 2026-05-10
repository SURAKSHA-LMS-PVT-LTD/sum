import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { imageManagementApi, UserLookupResponse } from '@/api/imageManagement.api';
import { uploadFile } from '@/lib/upload';
import {
  Search,
  Upload,
  User,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ImageIcon,
} from 'lucide-react';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

type UploadMode = 'global' | 'institute';

interface UploadState {
  status: 'idle' | 'generating' | 'uploading' | 'assigning' | 'completed' | 'error';
  progress: number;
  message: string;
}

export function AdminUploadForUser() {
  const { toast } = useToast();
  const [lookupType, setLookupType] = useState<'student' | 'user'>('user');
  const [lookupId, setLookupId] = useState('');
  const [userInfo, setUserInfo] = useState<UserLookupResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Upload mode
  const [uploadMode, setUploadMode] = useState<UploadMode>('global');
  const [instituteId, setInstituteId] = useState('');

  // File
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle', progress: 0, message: '',
  });

  const resetUpload = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadState({ status: 'idle', progress: 0, message: '' });
  }, []);

  const handleLookup = async () => {
    if (!lookupId.trim()) return;
    setIsSearching(true);
    resetUpload();
    try {
      const result = lookupType === 'student'
        ? await imageManagementApi.lookupStudent(lookupId.trim())
        : await imageManagementApi.lookupUser(lookupId.trim());
      setUserInfo(result);
      toast({ title: 'User Found', description: `Found: ${result.name}` });
    } catch (error: any) {
      setUserInfo(null);
      toast({ title: 'Not Found', description: error.message, variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({ title: 'Invalid Type', description: 'Accepted: JPEG, PNG, GIF, WebP', variant: 'destructive' });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: 'Too Large', description: 'Max 5MB', variant: 'destructive' });
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadState({ status: 'idle', progress: 0, message: '' });
  };

  const handleUpload = async () => {
    if (!selectedFile || !userInfo) return;

    try {
      if (uploadMode === 'global') {
        // Step 1: Generate URL
        setUploadState({ status: 'generating', progress: 15, message: 'Generating upload URL...' });
        const { uploadUrl, relativePath } = await imageManagementApi.generateProfileImageUrl({
          userId: userInfo.userId,
          fileName: selectedFile.name,
          contentType: selectedFile.type,
        });

        // Step 2: Upload
        setUploadState({ status: 'uploading', progress: 50, message: 'Uploading image...' });
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: selectedFile,
          headers: { 'Content-Type': selectedFile.type },
        });
        if (!uploadRes.ok) throw new Error('Upload to storage failed');

        // Step 3: Assign
        setUploadState({ status: 'assigning', progress: 80, message: 'Assigning to profile...' });
        await imageManagementApi.assignProfileImage({
          userId: userInfo.userId,
          imageUrl: relativePath,
        });
      } else {
        // Institute image upload
        if (!instituteId.trim()) {
          toast({ title: 'Error', description: 'Enter an institute ID', variant: 'destructive' });
          return;
        }
        setUploadState({ status: 'uploading', progress: 30, message: 'Uploading institute image...' });
        const result = await uploadFile(selectedFile, 'institute-user-images');

        setUploadState({ status: 'assigning', progress: 70, message: 'Registering image...' });
        await imageManagementApi.uploadInstituteUserImage(
          instituteId,
          userInfo.userId,
          result.relativePath
        );
      }

      setUploadState({ status: 'completed', progress: 100, message: 'Image uploaded & assigned successfully!' });
      toast({ title: 'Success', description: 'Profile image updated (auto-approved for admin uploads)' });
    } catch (error: any) {
      setUploadState({ status: 'error', progress: 0, message: error.message });
      toast({ title: 'Upload Failed', description: error.message, variant: 'destructive' });
    }
  };

  const statusIcon = () => {
    const icons: Record<string, any> = {
      generating: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
      uploading: <Upload className="h-4 w-4 animate-pulse text-primary" />,
      assigning: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
      completed: <CheckCircle2 className="h-4 w-4 text-success" />,
      error: <AlertCircle className="h-4 w-4 text-destructive" />,
    };
    return icons[uploadState.status] || null;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Lookup */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Find User
          </CardTitle>
          <CardDescription>Look up user before uploading</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={lookupType} onValueChange={(v) => { setLookupType(v as any); setUserInfo(null); resetUpload(); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="user"><User className="h-4 w-4 mr-2" />By User ID</TabsTrigger>
              <TabsTrigger value="student"><GraduationCap className="h-4 w-4 mr-2" />By Student ID</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-2">
            <Input
              placeholder={lookupType === 'student' ? 'Enter Student ID' : 'Enter User ID'}
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            />
            <Button onClick={handleLookup} disabled={isSearching || !lookupId.trim()}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {userInfo && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={userInfo.imageUrl || undefined} />
                  <AvatarFallback>{userInfo.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <p className="font-semibold">{userInfo.name}</p>
                  <p className="text-sm text-muted-foreground">{userInfo.email}</p>
                  <div className="flex gap-2">
                    <Badge variant="outline">{userInfo.userType}</Badge>
                    <Badge variant={userInfo.imageStatus === 'VERIFIED' ? 'secondary' : 'outline'}>
                      {userInfo.imageStatus || 'No Image'}
                    </Badge>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setUserInfo(null); resetUpload(); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Upload Image
          </CardTitle>
          <CardDescription>Admin uploads are auto-approved</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={uploadMode} onValueChange={(v) => { setUploadMode(v as UploadMode); resetUpload(); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="global">Global Profile</TabsTrigger>
              <TabsTrigger value="institute">Institute Image</TabsTrigger>
            </TabsList>
          </Tabs>

          {uploadMode === 'institute' && (
            <div className="space-y-2">
              <Label>Institute ID</Label>
              <Input
                placeholder="Enter institute ID"
                value={instituteId}
                onChange={(e) => setInstituteId(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Select Image</Label>
            <Input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleFileSelect} />
          </div>

          {previewUrl && (
            <div className="relative">
              <img src={previewUrl} alt="Preview" className="w-full max-h-48 object-contain rounded-lg border" />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2"
                onClick={resetUpload}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {uploadState.status !== 'idle' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {statusIcon()}
                <span className="text-sm">{uploadState.message}</span>
              </div>
              {!['error', 'completed'].includes(uploadState.status) && (
                <Progress value={uploadState.progress} className="h-2" />
              )}
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleUpload}
            disabled={!selectedFile || !userInfo || uploadState.status === 'completed' || ['generating', 'uploading', 'assigning'].includes(uploadState.status)}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload & Assign
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
