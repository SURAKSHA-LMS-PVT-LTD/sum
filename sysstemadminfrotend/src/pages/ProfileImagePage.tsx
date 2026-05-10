import { useState, useCallback, useRef } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  Upload, 
  User, 
  GraduationCap, 
  ImageIcon, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  RefreshCw,
  X,
  Crop as CropIcon
} from "lucide-react";

// Types
interface UserProfile {
  userId: string;
  studentId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  profileImage?: string;
  gender?: string;
  isVerified?: boolean;
}

interface UploadState {
  status: 'idle' | 'generating' | 'uploading' | 'assigning' | 'completed' | 'error';
  progress: number;
  message: string;
}

// Constants
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export default function ProfileImagePage() {
  const { toast } = useToast();
  
  // Lookup states
  const [studentId, setStudentId] = useState("");
  const [userId, setUserId] = useState("");
  const [lookupType, setLookupType] = useState<'student' | 'user'>('student');
  
  // User profile state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    message: ''
  });

  // Crop states
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset states
  const resetAll = useCallback(() => {
    setUserProfile(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadState({ status: 'idle', progress: 0, message: '' });
    setStudentId("");
    setUserId("");
  }, []);

  const resetUpload = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setRawImageSrc(null);
    setCrop(undefined);
    setCompletedCrop(null);
    setUploadState({ status: 'idle', progress: 0, message: '' });
  }, []);

  // Lookup user by Student ID
  const handleStudentLookup = async () => {
    if (!studentId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a Student ID",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    resetUpload();
    
    try {
      const response = await api.lookupStudentUser(studentId.trim());
      setUserProfile({
        ...response.user,
        studentId: studentId.trim()
      });
      toast({
        title: "User Found",
        description: `Found profile for ${response.user.firstName} ${response.user.lastName}`,
      });
    } catch (error: any) {
      console.error("Student lookup error:", error);
      setUserProfile(null);
      toast({
        title: "Not Found",
        description: error.message || "No user found with this Student ID",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Lookup user by User ID
  const handleUserLookup = async () => {
    if (!userId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a User ID",
        variant: "destructive",
      });
      return;
    }

    setIsSearching(true);
    resetUpload();
    
    try {
      const response = await api.lookupUser(userId.trim());
      setUserProfile(response.user);
      toast({
        title: "User Found",
        description: `Found profile for ${response.user.firstName} ${response.user.lastName}`,
      });
    } catch (error: any) {
      console.error("User lookup error:", error);
      setUserProfile(null);
      toast({
        title: "Not Found",
        description: error.message || "No user found with this User ID",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Handle file selection — open crop modal
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please select a JPEG, PNG, GIF, or WebP image",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File Too Large",
        description: "Maximum file size is 5MB",
        variant: "destructive",
      });
      return;
    }

    setCrop(undefined);
    setCompletedCrop(null);
    // Use FileReader for broad compatibility (avoids blob URL issues)
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawImageSrc(ev.target?.result as string);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  // When crop image loads — set default centered square crop
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    imgRef.current = e.currentTarget;
    const { naturalWidth: width, naturalHeight: height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop({ unit: "%", width: 80 }, 1, width, height),
      width,
      height
    );
    setCrop(initialCrop);
    setCompletedCrop(initialCrop); // ensure Apply Crop is enabled immediately
  };

  // Apply crop — produce a cropped File and preview URL
  const applyCrop = useCallback(async () => {
    if (!imgRef.current || !completedCrop) return;

    const image = imgRef.current;
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const pixelCrop = {
      x: completedCrop.x * (completedCrop.unit === "%" ? image.width / 100 : 1),
      y: completedCrop.y * (completedCrop.unit === "%" ? image.height / 100 : 1),
      width: completedCrop.width * (completedCrop.unit === "%" ? image.width / 100 : 1),
      height: completedCrop.height * (completedCrop.unit === "%" ? image.height / 100 : 1),
    };

    canvas.width = pixelCrop.width * scaleX;
    canvas.height = pixelCrop.height * scaleY;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      image,
      pixelCrop.x * scaleX,
      pixelCrop.y * scaleY,
      pixelCrop.width * scaleX,
      pixelCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92)
    );

    const croppedFile = new File([blob], "cropped-profile.jpg", { type: "image/jpeg" });
    setSelectedFile(croppedFile);
    setPreviewUrl(URL.createObjectURL(blob));
    setCropModalOpen(false);
    setUploadState({ status: 'idle', progress: 0, message: '' });
  }, [completedCrop]);

  // Get the current ID to use for upload
  const getCurrentId = () => {
    if (userProfile) {
      return lookupType === 'student' ? userProfile.studentId : userProfile.userId;
    }
    return lookupType === 'student' ? studentId.trim() : userId.trim();
  };

  // Upload profile image
  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    const currentId = getCurrentId();
    if (!currentId) {
      toast({
        title: "Error",
        description: `Please enter a ${lookupType === 'student' ? 'Student' : 'User'} ID`,
        variant: "destructive",
      });
      return;
    }

    try {
      // Step 1: Generate signed URL
      setUploadState({ 
        status: 'generating', 
        progress: 10, 
        message: 'Generating upload URL...' 
      });

      let signedUrlResponse;
      
      if (lookupType === 'student') {
        signedUrlResponse = await api.generateStudentProfileImageUrl({
          studentId: currentId,
          fileName: selectedFile.name,
          contentType: selectedFile.type,
          fileSize: selectedFile.size,
        });
      } else {
        signedUrlResponse = await api.generateUserProfileImageUrl({
          userId: currentId,
          fileName: selectedFile.name,
          contentType: selectedFile.type,
          fileSize: selectedFile.size,
        });
      }

      const { uploadUrl, relativePath } = signedUrlResponse;

      // Step 2: Upload to cloud storage
      setUploadState({ 
        status: 'uploading', 
        progress: 40, 
        message: 'Uploading image...' 
      });

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image to cloud storage');
      }

      // Step 3: Assign image to user profile
      setUploadState({ 
        status: 'assigning', 
        progress: 75, 
        message: 'Assigning image to profile...' 
      });

      if (lookupType === 'student') {
        await api.assignStudentProfileImage({
          studentId: currentId,
          relativePath: relativePath,
        });
      } else {
        await api.assignUserProfileImage({
          userId: currentId,
          relativePath: relativePath,
        });
      }

      // Success
      setUploadState({ 
        status: 'completed', 
        progress: 100, 
        message: 'Profile image updated successfully!' 
      });

      // Update user profile with new image if we have one
      if (userProfile) {
        setUserProfile(prev => prev ? { ...prev, profileImage: relativePath } : null);
      }

      toast({
        title: "Success",
        description: `Profile image assigned to ${lookupType === 'student' ? 'Student' : 'User'} ID: ${currentId}`,
      });

    } catch (error: any) {
      console.error("Upload error:", error);
      setUploadState({ 
        status: 'error', 
        progress: 0, 
        message: error.message || 'Failed to upload image' 
      });
      toast({
        title: "Upload Failed",
        description: error.message || "An error occurred during upload",
        variant: "destructive",
      });
    }
  };

  // Render progress status
  const renderUploadStatus = () => {
    if (uploadState.status === 'idle') return null;

    const statusConfig = {
      generating: { icon: Loader2, color: 'text-blue-500', iconClass: 'animate-spin' },
      uploading: { icon: Upload, color: 'text-blue-500', iconClass: 'animate-pulse' },
      assigning: { icon: Loader2, color: 'text-blue-500', iconClass: 'animate-spin' },
      completed: { icon: CheckCircle2, color: 'text-green-500', iconClass: '' },
      error: { icon: AlertCircle, color: 'text-red-500', iconClass: '' },
    };

    const config = statusConfig[uploadState.status as keyof typeof statusConfig];
    if (!config) return null;

    const Icon = config.icon;

    return (
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${config.color} ${config.iconClass}`} />
          <span className={config.color}>{uploadState.message}</span>
        </div>
        {uploadState.status !== 'error' && uploadState.status !== 'completed' && (
          <Progress value={uploadState.progress} className="h-2" />
        )}
      </div>
    );
  };

  return (
    <>
    <DashboardLayout>
      <PageHeader
        title="Profile Image Management"
        description="Upload and manage user profile images"
        icon={ImageIcon}
      />
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Lookup Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                User Lookup
              </CardTitle>
              <CardDescription>
                Search for a user (optional) or enter ID directly to upload
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={lookupType} onValueChange={(v) => {
                setLookupType(v as 'student' | 'user');
                resetAll();
              }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="student" className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4" />
                    By Student ID
                  </TabsTrigger>
                  <TabsTrigger value="user" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    By User ID
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="student" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="studentId">Student ID</Label>
                    <div className="flex gap-2">
                      <Input
                        id="studentId"
                        placeholder="Enter student ID (e.g., STU-2024-001)"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleStudentLookup()}
                      />
                      <Button 
                        onClick={handleStudentLookup} 
                        disabled={isSearching}
                      >
                        {isSearching ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="user" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="userId">User ID</Label>
                    <div className="flex gap-2">
                      <Input
                        id="userId"
                        placeholder="Enter user ID (e.g., 12345)"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUserLookup()}
                      />
                      <Button 
                        onClick={handleUserLookup} 
                        disabled={isSearching}
                      >
                        {isSearching ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* User Profile Display */}
              {userProfile && (
                <div className="mt-6 p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage 
                        src={userProfile.profileImage || undefined} 
                        alt={`${userProfile.firstName} ${userProfile.lastName}`}
                      />
                      <AvatarFallback className="text-lg">
                        {userProfile.firstName?.charAt(0)}{userProfile.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">
                          {userProfile.firstName} {userProfile.lastName}
                        </h3>
                        {userProfile.isVerified && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{userProfile.email}</p>
                      {userProfile.phone && (
                        <p className="text-sm text-muted-foreground">{userProfile.phone}</p>
                      )}
                      {userProfile.studentId && (
                        <Badge variant="outline">Student ID: {userProfile.studentId}</Badge>
                      )}
                      <Badge variant="outline">User ID: {userProfile.userId}</Badge>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={resetAll}
                      title="Clear"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Upload Profile Image
              </CardTitle>
              <CardDescription>
                Upload image directly or after searching for a user
              </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                  {/* Show current target */}
                  {(userProfile || (lookupType === 'student' ? studentId : userId)) && (
                    <div className="p-3 border rounded-lg bg-muted/30">
                      <p className="text-sm">
                        <span className="text-muted-foreground">Target: </span>
                        <span className="font-medium">
                          {userProfile 
                            ? `${userProfile.firstName} ${userProfile.lastName}` 
                            : `${lookupType === 'student' ? 'Student' : 'User'} ID: ${lookupType === 'student' ? studentId : userId}`
                          }
                        </span>
                      </p>
                    </div>
                  )}
                  {/* File Input */}
                  <div className="space-y-2">
                    <Label>Select Image</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleFileSelect}
                      disabled={uploadState.status !== 'idle' && uploadState.status !== 'error' && uploadState.status !== 'completed'}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={uploadState.status !== 'idle' && uploadState.status !== 'error' && uploadState.status !== 'completed'}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Choose Image File
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Supported formats: JPEG, PNG, GIF, WebP. Max size: 5MB
                    </p>
                  </div>

                  {/* Preview */}
                  {previewUrl && (
                    <div className="space-y-2">
                      <Label>Preview (Cropped)</Label>
                      <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
                        <div className="relative">
                          <img
                            src={previewUrl}
                            alt="Preview"
                            className="h-24 w-24 rounded-full object-cover border-2"
                          />
                          {uploadState.status === 'completed' && (
                            <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                              <CheckCircle2 className="h-4 w-4 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{selectedFile?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {selectedFile && (selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                          {uploadState.status === 'idle' && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() => { if (rawImageSrc) { setCrop(undefined); setCropModalOpen(true); } }}
                            >
                              <CropIcon className="h-3 w-3 mr-1" />
                              Re-crop
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Upload Status */}
                  {renderUploadStatus()}

                  {/* Actions */}
                  <div className="flex gap-2 pt-4">
                    {uploadState.status === 'completed' ? (
                      <>
                        <Button 
                          variant="outline" 
                          onClick={resetUpload}
                          className="flex-1"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Upload Another
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          onClick={handleUpload}
                          disabled={
                            !selectedFile || 
                            (uploadState.status !== 'idle' && uploadState.status !== 'error')
                          }
                          className="flex-1"
                        >
                          {uploadState.status === 'generating' || 
                           uploadState.status === 'uploading' || 
                           uploadState.status === 'assigning' ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Image
                            </>
                          )}
                        </Button>
                        {selectedFile && uploadState.status === 'idle' && (
                          <Button variant="outline" onClick={resetUpload}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
            </CardContent>
          </Card>
        </div>

        {/* Instructions Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  1
                </div>
                <div>
                  <h4 className="font-medium">Enter ID</h4>
                  <p className="text-sm text-muted-foreground">
                    Enter Student ID or User ID (search is optional)
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  2
                </div>
                <div>
                  <h4 className="font-medium">Select Image</h4>
                  <p className="text-sm text-muted-foreground">
                    Choose a profile image (max 5MB, JPEG/PNG/GIF/WebP)
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  3
                </div>
                <div>
                  <h4 className="font-medium">Upload</h4>
                  <p className="text-sm text-muted-foreground">
                    Click upload to save the image to the user's profile
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>

      {/* Crop Modal */}
      <Dialog open={cropModalOpen} onOpenChange={(open) => { if (!open) { setCropModalOpen(false); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CropIcon className="h-5 w-5" />
              Crop Profile Image
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center overflow-auto max-h-[60vh] bg-muted/20 rounded-lg p-2">
            {rawImageSrc && (
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop
                minWidth={60}
                minHeight={60}
              >
                <img
                  src={rawImageSrc}
                  alt="Crop source"
                  onLoad={onImageLoad}
                  style={{ maxHeight: "55vh", maxWidth: "100%" }}
                />
              </ReactCrop>
            )}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Drag to reposition. Resize handles to adjust crop area.
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCropModalOpen(false);
                if (!selectedFile) setRawImageSrc(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={applyCrop} disabled={!completedCrop}>
              <CropIcon className="h-4 w-4 mr-2" />
              Apply Crop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
