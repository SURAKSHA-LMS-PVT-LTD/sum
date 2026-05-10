import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ReactCrop, { 
  type Crop, 
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { getSignedUrl, uploadToSignedUrl, verifyAndPublish } from '@/utils/imageUploadHelper';
import { getImageUrl } from '@/utils/imageUrlHelper';

interface SubjectImageUploadProps {
  value?: string;
  onChange: (imageUrl: string) => void;
  onRemove?: () => void;
  /** When true, image is uploaded to cloud immediately on crop. When false (default), only a local preview is shown and getPendingUpload() must be called to upload later. */
  uploadImmediately?: boolean;
  /** Ref to expose the pending upload function for deferred uploads */
  uploadRef?: React.MutableRefObject<(() => Promise<string | null>) | null>;
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
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

const SubjectImageUpload: React.FC<SubjectImageUploadProps> = ({ value, onChange, onRemove, uploadImmediately = true, uploadRef }) => {
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string>(value ? getImageUrl(value) : '');
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isUploading, setIsUploading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pendingBlob, setPendingBlob] = useState<{ blob: Blob; fileName: string } | null>(null);

  // Expose deferred upload function via ref
  React.useEffect(() => {
    if (uploadRef) {
      uploadRef.current = async () => {
        if (!pendingBlob) return null;
        try {
          const signedUrlData = await getSignedUrl(
            'subject-images',
            pendingBlob.fileName,
            'image/png',
            pendingBlob.blob.size
          );
          await uploadToSignedUrl(signedUrlData.uploadUrl, pendingBlob.blob, signedUrlData.fields);
          await verifyAndPublish(signedUrlData.relativePath);
          setPendingBlob(null);
          return signedUrlData.publicUrl;
        } catch (error) {
          console.error('Deferred image upload failed:', error);
          throw error;
        }
      };
    }
  }, [pendingBlob, uploadRef]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (PNG, JPG, etc.)",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Image must be less than 5MB",
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
    setCrop(undefined);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImageToCrop(reader.result as string);
      setShowCropDialog(true);
    };
    reader.readAsDataURL(file);
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 4 / 3));
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
      const fileName = selectedFile.name.replace(/\.[^/.]+$/, "") + '.png';

      if (!uploadImmediately) {
        // Deferred mode: save blob locally, show preview, don't upload yet
        const localPreviewUrl = URL.createObjectURL(croppedImageBlob);
        setPreviewUrl(localPreviewUrl);
        setPendingBlob({ blob: croppedImageBlob, fileName });
        onChange('__pending__'); // Signal that there's a pending image
        toast({
          title: "Image Ready",
          description: "Image will be uploaded when you submit the form.",
        });
        handleCloseDialog();
        return;
      }
      
      // Immediate mode: upload to cloud storage right away
      const signedUrlData = await getSignedUrl(
        'subject-images',
        fileName,
        'image/png',
        croppedImageBlob.size
      );

      await uploadToSignedUrl(
        signedUrlData.uploadUrl,
        croppedImageBlob,
        signedUrlData.fields
      );

      await verifyAndPublish(signedUrlData.relativePath);

      setPreviewUrl(getImageUrl(signedUrlData.publicUrl));
      onChange(signedUrlData.publicUrl);
      
      toast({
        title: "Success",
        description: "Subject image uploaded successfully!",
      });
      
      handleCloseDialog();
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCloseDialog = () => {
    setShowCropDialog(false);
    setImageToCrop('');
    setCrop(undefined);
    setCompletedCrop(undefined);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    setPreviewUrl('');
    setPendingBlob(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onRemove?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          {previewUrl ? 'Change Image' : 'Upload Image'}
        </Button>

        {previewUrl && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleRemove}
          >
            <X className="h-4 w-4 mr-2" />
            Remove
          </Button>
        )}
      </div>

      {previewUrl && (
        <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden border">
          <img
            src={previewUrl}
            alt="Subject preview"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <Dialog open={showCropDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Crop Subject Image (4:3)</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto flex justify-center">
            {imageToCrop && (
              <ReactCrop
                crop={crop}
                onChange={(pixelCrop, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                minWidth={30}
                minHeight={30}
                keepSelection
                ruleOfThirds
                style={{ maxHeight: '55vh' }}
              >
                <img
                  ref={imgRef}
                  src={imageToCrop}
                  alt="Crop preview"
                  style={{ maxHeight: '55vh', maxWidth: '100%' }}
                  onLoad={onImageLoad}
                />
              </ReactCrop>
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
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubjectImageUpload;
