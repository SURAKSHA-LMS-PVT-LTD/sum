import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Upload, ImageIcon, Loader2, Camera as CameraIcon } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraDirection, CameraResultType, CameraSource } from '@capacitor/camera';
import { useToast } from '@/hooks/use-toast';
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
  convertToPixelCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { getSignedUrl, uploadToSignedUrl, verifyAndPublish } from '@/utils/imageUploadHelper';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { getErrorMessage } from '@/api/apiError';

interface PassportImageCropUploadProps {
  currentImageUrl?: string | null;
  onImageUpdate: (publicUrl: string) => void;
  folder: string;
  label?: string;
  className?: string;
  showCamera?: boolean;
}

// 35mm x 45mm = 7:9 aspect ratio (portrait)
const PASSPORT_ASPECT_RATIO = 7 / 9;

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

const PassportImageCropUpload: React.FC<PassportImageCropUploadProps> = ({
  currentImageUrl,
  onImageUpdate,
  folder,
  label = "Profile Image",
  className = "",
  showCamera = true
}) => {
  const [open, setOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const hiddenFileInput = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

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
    reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
    reader.readAsDataURL(file);
    setOpen(true);
  }, [toast]);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleSelectedFile(file);
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const crop = centerAspectCrop(width, height, PASSPORT_ASPECT_RATIO);
    setCrop(crop);
    setCompletedCrop(convertToPixelCrop(crop, width, height));
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

  const handleUploadClick = () => {
    hiddenFileInput.current?.click();
  };

  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      throw new Error('Camera not supported in this browser/context');
    }

    stopCamera();
    setIsStartingCamera(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });

      cameraStreamRef.current = stream;

      // Wait a tick for Dialog to render
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 50);
    } finally {
      setIsStartingCamera(false);
    }
  }, [stopCamera]);

  const takeNativePhoto = useCallback(async () => {
    try {
      const photo = await CapCamera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Uri,
        quality: 90,
        direction: CameraDirection.Front,
      });

      if (!photo.webPath) throw new Error('No photo webPath');

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
  }, [handleSelectedFile, toast]);

  const handleCameraClick = async () => {
    // Camera button should open camera (not a folder picker)
    if (Capacitor.isNativePlatform()) {
      await takeNativePhoto();
      return;
    }

    try {
      setCameraOpen(true);
      await startCamera();
    } catch (error: any) {
      console.error('Failed to start camera:', error);
      toast({
        title: 'Camera unavailable',
        description: 'Please allow camera permission (and use HTTPS) to take a photo.',
        variant: 'destructive',
      });
      setCameraOpen(false);
    }
  };

  const handleCapture = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to capture photo'))),
          'image/jpeg',
          0.92,
        );
      });

      const file = new File([blob], `camera-${Date.now()}.jpg`, { type: blob.type });

      stopCamera();
      setCameraOpen(false);
      handleSelectedFile(file);
    } catch (error: any) {
      console.error('Failed to capture photo:', error);
      toast({
        title: 'Capture failed',
        description: 'Please try again or upload a photo instead.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <div className={`space-y-4 ${className}`}>
        {/* Preview area - 35mm x 45mm aspect ratio */}
        <div 
          className="relative mx-auto bg-muted rounded-lg border-2 border-dashed border-border overflow-hidden"
          style={{ width: '105px', height: '135px' }} // 35mm x 45mm scaled
        >
          {currentImageUrl ? (
            <img
              src={getImageUrl(currentImageUrl)}
              alt={label}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ImageIcon className="h-8 w-8 mb-1" />
              <p className="text-xs text-center px-1">35×45mm</p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button 
            type="button"
            variant="outline"
            size="sm"
            onClick={handleUploadClick}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            {currentImageUrl ? 'Change' : 'Upload'}
          </Button>
          
          {showCamera && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCameraClick}
              className="flex items-center gap-2"
            >
              <CameraIcon className="h-4 w-4" />
              Camera
            </Button>
          )}
          
          {currentImageUrl && (
            <Button 
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onImageUpdate('')}
            >
              Remove
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

      <Dialog
        open={cameraOpen}
        onOpenChange={(nextOpen) => {
          setCameraOpen(nextOpen);
          if (!nextOpen) stopCamera();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Take photo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-lg border bg-muted">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-[360px] w-full object-cover"
              />
              {isStartingCamera && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                  <div className="text-sm text-muted-foreground">Starting camera…</div>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Tip: allow camera permission when prompted.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                stopCamera();
                setCameraOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleCapture} disabled={isStartingCamera}>
              Capture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crop {label} (35mm × 45mm)</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {imgSrc && (
              <div className="max-h-96 overflow-auto rounded-lg flex justify-center">
                <ReactCrop
                  crop={crop}
                  onChange={(pixelCrop, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={PASSPORT_ASPECT_RATIO}
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
            
            <p className="text-xs text-muted-foreground text-center">
              Passport photo size: 35mm × 45mm (7:9 aspect ratio)
            </p>
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

export default PassportImageCropUpload;
