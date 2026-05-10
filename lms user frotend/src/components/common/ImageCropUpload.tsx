import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Upload, ImageIcon, Loader2, Camera as CameraIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import ReactCrop, { 
  type Crop, 
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { getSignedUrl, uploadToSignedUrl, verifyAndPublish } from '@/utils/imageUploadHelper';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { getErrorMessage } from '@/api/apiError';

interface ImageCropUploadProps {
  currentImageUrl?: string | null;
  onImageUpdate: (publicUrl: string) => void;
  folder: string;
  aspectRatio?: number;
  label?: string;
  className?: string;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 70,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

const ImageCropUpload: React.FC<ImageCropUploadProps> = ({
  currentImageUrl,
  onImageUpdate,
  folder,
  aspectRatio = 1,
  label = "Image",
  className = ""
}) => {
  const [open, setOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const hiddenFileInput = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSelectedFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (PNG, JPG, etc.)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setCrop(undefined);
    const reader = new FileReader();
    reader.addEventListener('load', () =>
      setImgSrc(reader.result?.toString() || ''),
    );
    reader.readAsDataURL(file);
    setOpen(true);
  }, [toast]);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleSelectedFile(e.target.files[0]);
    }
  };

  const handleNativeCamera = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const photo = await CapCamera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Uri,
        quality: 90,
      });
      if (!photo.webPath) throw new Error('No photo captured');
      const resp = await fetch(photo.webPath);
      const blob = await resp.blob();
      const ext = blob.type?.includes('png') ? 'png' : 'jpg';
      const file = new File([blob], `camera-${Date.now()}.${ext}`, {
        type: blob.type || 'image/jpeg',
      });
      handleSelectedFile(file);
    } catch (error: any) {
      console.error('Native camera failed:', error);
      toast({
        title: 'Camera unavailable',
        description: 'Please allow camera permission and try again.',
        variant: 'destructive',
      });
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, aspectRatio));
  };

  const getCroppedImg = useCallback(
    (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('No 2d context');
      }

      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      const pixelRatio = window.devicePixelRatio;

      canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
      canvas.height = Math.floor(crop.height * scaleY * pixelRatio);

      ctx.scale(pixelRatio, pixelRatio);
      ctx.imageSmoothingQuality = 'high';

      const cropX = crop.x * scaleX;
      const cropY = crop.y * scaleY;

      const centerX = image.naturalWidth / 2;
      const centerY = image.naturalHeight / 2;

      ctx.save();

      ctx.translate(-cropX, -cropY);
      ctx.translate(centerX, centerY);
      ctx.translate(-centerX, -centerY);
      ctx.drawImage(
        image,
        0,
        0,
        image.naturalWidth,
        image.naturalHeight,
        0,
        0,
        image.naturalWidth,
        image.naturalHeight,
      );

      ctx.restore();

      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'));
            return;
          }
          resolve(blob);
        }, 'image/png');
      });
    },
    [],
  );

  const handleUpload = async () => {
    if (!imgRef.current || !completedCrop || !selectedFile) return;

    setIsUploading(true);
    
    try {
      // Get cropped image blob
      const croppedImageBlob = await getCroppedImg(imgRef.current, completedCrop);
      
      // Step 1: Get signed URL
      const fileName = selectedFile.name.replace(/\.[^/.]+$/, "") + '.png';
      const signedUrlData = await getSignedUrl(
        folder,
        fileName,
        'image/png',
        croppedImageBlob.size
      );

      // Step 2: Upload to signed URL
      await uploadToSignedUrl(
        signedUrlData.uploadUrl,
        croppedImageBlob,
        signedUrlData.fields
      );

      // Step 3: Verify and publish
      await verifyAndPublish(signedUrlData.relativePath);

      // Step 4: Return relative path
      onImageUpdate(signedUrlData.relativePath);
      
      toast({
        title: "Success",
        description: `${label} uploaded successfully!`,
      });
      
      handleCloseDialog();
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload failed",
        description: getErrorMessage(error, 'Failed to upload image. Please try again.'),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setImgSrc('');
    setCrop(undefined);
    setCompletedCrop(undefined);
    setSelectedFile(null);
    if (hiddenFileInput.current) {
      hiddenFileInput.current.value = '';
    }
  };

  const handleChangePhoto = () => {
    hiddenFileInput.current?.click();
  };

  return (
    <>
      <div className={`space-y-4 ${className}`}>
        <div className="relative w-full h-48 sm:h-56 md:h-64 bg-muted rounded-lg border-2 border-dashed border-border overflow-hidden">
          {currentImageUrl ? (
            <img
              src={getImageUrl(currentImageUrl)}
              alt={label}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ImageIcon className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 mb-2" />
              <p className="text-sm">No image uploaded</p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button 
            type="button"
            onClick={handleChangePhoto}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <Upload className="h-4 w-4" />
            {currentImageUrl ? 'Change Image' : 'Upload Image'}
          </Button>
          
          {Capacitor.isNativePlatform() && (
            <Button 
              type="button"
              variant="outline"
              onClick={handleNativeCamera}
              className="flex items-center gap-2 w-full sm:w-auto"
            >
              <CameraIcon className="h-4 w-4" />
              Camera
            </Button>
          )}
          
          {currentImageUrl && (
            <Button 
              type="button"
              variant="outline"
              onClick={() => onImageUpdate('')}
              className="w-full sm:w-auto"
            >
              Remove Image
            </Button>
          )}
        </div>

        <input
          ref={hiddenFileInput}
          type="file"
          accept="image/*"
          onChange={onSelectFile}
          className="hidden"
        />
      </div>

      <Dialog open={open} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crop {label}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {imgSrc && (
              <div className="max-h-96 overflow-auto rounded-lg flex justify-center">
                <ReactCrop
                  crop={crop}
                  onChange={(pixelCrop, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  minWidth={30}
                  minHeight={30}
                  keepSelection
                  ruleOfThirds
                  style={{ maxHeight: '380px' }}
                >
                  <img
                    ref={imgRef}
                    alt="Crop me"
                    src={imgSrc}
                    onLoad={onImageLoad}
                    style={{ maxHeight: '380px', maxWidth: '100%' }}
                  />
                </ReactCrop>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={isUploading}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={!completedCrop || isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Upload'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImageCropUpload;
