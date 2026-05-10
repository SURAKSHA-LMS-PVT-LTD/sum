
import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getImageUrl } from '@/utils/imageUrlHelper';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { 
  Camera, 
  Upload,
  Edit,
  Save,
  X,
  Crop as CropIcon
} from 'lucide-react';

interface OrganizationHeaderProps {
  title: string;
}

const OrganizationHeader = ({ title }: OrganizationHeaderProps) => {
  const { user, selectedOrganization } = useAuth();
  const { toast } = useToast();
  
  // State management
  const [backgroundImage, setBackgroundImage] = useState<string>('/placeholder.svg');
  const [profileImage, setProfileImage] = useState<string>('');
  const [showCoverDialog, setShowCoverDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [tempImage, setTempImage] = useState<string>('');
  const [currentEditType, setCurrentEditType] = useState<'cover' | 'profile'>('cover');
  const [isUploading, setIsUploading] = useState(false);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const coverUploadRef = useRef<HTMLInputElement>(null);
  const profileUploadRef = useRef<HTMLInputElement>(null);

  // File validation
  const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const validateFile = (file: File): boolean => {
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description: "Please select a valid image file (JPEG, PNG, WebP, or GIF)",
        variant: "destructive"
      });
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive"
      });
      return false;
    }

    return true;
  };

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'profile') => {
    const file = event.target.files?.[0];
    
    if (!file) return;

    if (!validateFile(file)) {
      event.target.value = '';
      return;
    }

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const imageUrl = e.target?.result as string;
      setTempImage(imageUrl);
      setCurrentEditType(type);
      setCrop(undefined);
      setCompletedCrop(undefined);
      
      if (type === 'cover') {
        setShowCoverDialog(true);
      } else {
        setShowProfileDialog(true);
      }
      setIsUploading(false);
    };
    reader.onerror = () => {
      toast({
        title: "Upload failed",
        description: "Failed to read the image file",
        variant: "destructive"
      });
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }, [toast]);

  const handleCoverUpload = () => {
    coverUploadRef.current?.click();
  };

  const handleProfileUpload = () => {
    profileUploadRef.current?.click();
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    
    const cropSize = currentEditType === 'cover' ? 
      { width: 80, height: 40 } : 
      { width: 50, height: 50 };
    
    setCrop({
      unit: '%',
      x: 10,
      y: 10,
      ...cropSize
    });
  }, [currentEditType]);

  const getCroppedImage = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const canvas = previewCanvasRef.current;
      const image = imgRef.current;
      
      if (!canvas || !image || !completedCrop) {
        resolve('');
        return;
      }

      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve('');
        return;
      }

      const pixelRatio = window.devicePixelRatio;
      canvas.width = completedCrop.width * pixelRatio;
      canvas.height = completedCrop.height * pixelRatio;
      
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.imageSmoothingQuality = 'high';

      ctx.drawImage(
        image,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        completedCrop.width,
        completedCrop.height
      );

      canvas.toBlob((blob) => {
        if (!blob) {
          resolve('');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      }, 'image/jpeg', 0.95);
    });
  }, [completedCrop]);

  const handleSaveImage = async () => {
    try {
      setIsUploading(true);
      
      if (!completedCrop) {
        toast({
          title: "No crop area selected",
          description: "Please select an area to crop",
          variant: "destructive"
        });
        setIsUploading(false);
        return;
      }

      const croppedImageUrl = await getCroppedImage();
      
      if (!croppedImageUrl) {
        toast({
          title: "Error processing image",
          description: "Failed to process the cropped image",
          variant: "destructive"
        });
        setIsUploading(false);
        return;
      }

      if (currentEditType === 'cover') {
        setBackgroundImage(croppedImageUrl);
        setShowCoverDialog(false);
        toast({
          title: "Cover photo updated",
          description: "Your cover photo has been successfully updated"
        });
      } else {
        setProfileImage(croppedImageUrl);
        setShowProfileDialog(false);
        toast({
          title: "Profile photo updated", 
          description: "Your profile photo has been successfully updated"
        });
      }

      setTempImage('');
      setCrop(undefined);
      setCompletedCrop(undefined);
      setIsUploading(false);

    } catch (error: any) {
      console.error('Error saving image:', error);
      toast({
        title: "Error saving image",
        description: "An error occurred while saving the image",
        variant: "destructive"
      });
      setIsUploading(false);
    }
  };

  const handleCancelEdit = () => {
    setShowCoverDialog(false);
    setShowProfileDialog(false);
    setTempImage('');
    setCrop(undefined);
    setCompletedCrop(undefined);
    setIsUploading(false);
  };

  if (user?.role !== 'OrganizationManager' || !selectedOrganization) {
    return null;
  }

  return (
    <div className="relative mb-6">
      {/* Background Image Section - Responsive */}
      <div 
        className="relative h-32 sm:h-40 md:h-48 lg:h-56 w-full bg-cover bg-center bg-no-repeat rounded-lg overflow-hidden"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/40" />
        
        {/* Background Image Upload Button - Responsive */}
        <div className="absolute top-2 sm:top-4 right-2 sm:right-4">
          <Button 
            size="sm" 
            className="bg-white/90 text-black hover:bg-white text-xs sm:text-sm px-2 sm:px-4 py-1 sm:py-2"
            onClick={handleCoverUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 animate-spin" />
                <span className="hidden xs:inline">Uploading...</span>
                <span className="xs:hidden">...</span>
              </>
            ) : (
              <>
                <Camera className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline">Edit Cover</span>
                <span className="xs:hidden">Cover</span>
              </>
            )}
          </Button>
          <input
            ref={coverUploadRef}
            type="file"
            accept={ALLOWED_FILE_TYPES.join(',')}
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'cover')}
          />
        </div>

        {/* Content Overlay - Responsive */}
        <div className="absolute bottom-2 sm:bottom-4 lg:bottom-6 left-2 sm:left-4 lg:left-6 text-white">
          <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2 leading-tight">
            {title}
          </h1>
          <p className="text-sm sm:text-base lg:text-lg opacity-90">
            {selectedOrganization?.name || 'Organization Management'}
          </p>
        </div>
      </div>

      {/* Profile Section - Responsive */}
      <div className="absolute -bottom-8 sm:-bottom-10 lg:-bottom-12 left-2 sm:left-4 lg:left-6">
        <div className="relative">
          <Avatar className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 border-2 sm:border-4 border-white shadow-lg">
            <AvatarImage src={getImageUrl(profileImage || user?.imageUrl)} />
            <AvatarFallback className="text-lg sm:text-xl lg:text-2xl font-bold bg-primary text-primary-foreground">
              {user?.name?.charAt(0) || selectedOrganization?.name?.charAt(0) || 'O'}
            </AvatarFallback>
          </Avatar>
          
          {/* Profile Image Upload Button - Responsive */}
          <Button 
            size="sm" 
            className="absolute -bottom-1 sm:-bottom-2 -right-1 sm:-right-2 h-6 w-6 sm:h-8 sm:w-8 p-0 rounded-full"
            onClick={handleProfileUpload}
            disabled={isUploading}
          >
            {isUploading ? (
              <Upload className="h-2 w-2 sm:h-3 sm:w-3 animate-spin" />
            ) : (
              <Edit className="h-2 w-2 sm:h-3 sm:w-3" />
            )}
          </Button>
          <input
            ref={profileUploadRef}
            type="file"
            accept={ALLOWED_FILE_TYPES.join(',')}
            className="hidden"
            onChange={(e) => handleFileSelect(e, 'profile')}
          />
        </div>
      </div>

      {/* Add space for profile avatar - Responsive */}
      <div className="h-8 sm:h-10 lg:h-12" />

      {/* Cover Photo Edit Dialog - Responsive */}
      <Dialog open={showCoverDialog} onOpenChange={setShowCoverDialog}>
        <DialogContent className="max-w-xs sm:max-w-2xl lg:max-w-4xl max-h-[95vh] overflow-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <CropIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              Edit Cover Photo
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {tempImage && (
              <div className="flex flex-col items-center space-y-4">
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={2.4}
                  className="max-w-full"
                >
                  <img
                    ref={imgRef}
                    alt="Crop preview"
                    src={tempImage}
                    onLoad={onImageLoad}
                    className="max-w-full max-h-64 sm:max-h-96 object-contain"
                  />
                </ReactCrop>
                
                <canvas
                  ref={previewCanvasRef}
                  className="hidden"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={handleCancelEdit} className="w-full sm:w-auto" disabled={isUploading}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSaveImage} className="w-full sm:w-auto" disabled={isUploading}>
              {isUploading ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Cover Photo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Photo Edit Dialog - Responsive */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-xs sm:max-w-lg lg:max-w-2xl max-h-[95vh] overflow-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <CropIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              Edit Profile Photo
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {tempImage && (
              <div className="flex flex-col items-center space-y-4">
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={1}
                  className="max-w-full"
                >
                  <img
                    ref={imgRef}
                    alt="Crop preview"
                    src={tempImage}
                    onLoad={onImageLoad}
                    className="max-w-full max-h-64 sm:max-h-96 object-contain"
                  />
                </ReactCrop>
                
                <canvas
                  ref={previewCanvasRef}
                  className="hidden"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={handleCancelEdit} className="w-full sm:w-auto" disabled={isUploading}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSaveImage} className="w-full sm:w-auto" disabled={isUploading}>
              {isUploading ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Profile Photo
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrganizationHeader;
