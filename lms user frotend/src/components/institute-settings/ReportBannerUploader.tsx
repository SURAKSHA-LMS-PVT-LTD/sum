import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Upload, Trash2, Loader2, ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { uploadWithSignedUrl } from '@/utils/signedUploadHelper';
import { instituteSettingsApi, type InstituteSettingsResponse } from '@/api/instituteSettings.api';
import { SafeImage } from '@/components/ui/SafeImage';
import { getImageUrl } from '@/utils/imageUrlHelper';
import { getErrorMessage } from '@/api/apiError';

interface ReportBannerUploaderProps {
  instituteId: string;
  settingsField: 'reportHeaderUrl' | 'reportFooterUrl' | 'receiptHeaderUrl' | 'receiptFooterUrl';
  currentDisplayUrl: string | null;
  label: string;
  aspectRatio: number;
  recommendedSize: string;
  onUpdate: (updated: InstituteSettingsResponse) => void;
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
}

export const ReportBannerUploader: React.FC<ReportBannerUploaderProps> = ({
  instituteId,
  settingsField,
  currentDisplayUrl,
  label,
  aspectRatio,
  recommendedSize,
  onUpdate,
}) => {
  const { toast } = useToast();
  const [cropOpen, setCropOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file type', description: 'Please select an image file.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Please select an image under 5MB.', variant: 'destructive' });
      return;
    }
    setSelectedFile(file);
    setCrop(undefined);
    const reader = new FileReader();
    reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
    reader.readAsDataURL(file);
    setCropOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, aspectRatio));
  };

  const getCroppedBlob = useCallback((image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2d context');

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const pixelRatio = window.devicePixelRatio;

    canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
    canvas.height = Math.floor(crop.height * scaleY * pixelRatio);
    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width * scaleX,
      crop.height * scaleY,
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('Canvas is empty')); return; }
        resolve(blob);
      }, 'image/png');
    });
  }, []);

  const handleUpload = async () => {
    if (!imgRef.current || !completedCrop || !selectedFile) return;
    setUploading(true);
    try {
      const blob = await getCroppedBlob(imgRef.current, completedCrop);
      const fileName = selectedFile.name.replace(/\.[^/.]+$/, '') + '.png';
      const croppedFile = new File([blob], fileName, { type: 'image/png' });
      const relativePath = await uploadWithSignedUrl(croppedFile, 'institute-images');
      const updated = await instituteSettingsApi.updateSettings(instituteId, { [settingsField]: relativePath });
      onUpdate(updated);
      toast({ title: 'Saved', description: `${label} updated successfully.` });
      closeCropDialog();
    } catch (error: any) {
      toast({ title: 'Upload failed', description: getErrorMessage(error, 'Failed to upload banner'), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const updated = await instituteSettingsApi.updateSettings(instituteId, { [settingsField]: null });
      onUpdate(updated);
      toast({ title: 'Removed', description: `${label} removed.` });
    } catch (error: any) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to remove banner'), variant: 'destructive' });
    } finally {
      setRemoving(false);
    }
  };

  const closeCropDialog = () => {
    setCropOpen(false);
    setImgSrc('');
    setCrop(undefined);
    setCompletedCrop(undefined);
    setSelectedFile(null);
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <p className="text-xs text-muted-foreground">Recommended size: {recommendedSize}</p>
      <div className="border border-dashed border-border rounded-lg p-3 space-y-3">
        {currentDisplayUrl ? (
          <SafeImage
            src={getImageUrl(currentDisplayUrl)}
            alt={label}
            className="w-full max-h-24 rounded-md object-contain"
            fallback={
              <div className="h-20 flex items-center justify-center bg-muted rounded-md">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </div>
            }
          />
        ) : (
          <div className="h-16 flex flex-col items-center justify-center text-muted-foreground">
            <ImageIcon className="h-6 w-6 mb-1" />
            <span className="text-xs">No banner set</span>
          </div>
        )}
        <div className="flex items-center gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={removing}
          >
            <Upload className="h-4 w-4 mr-1" />
            {currentDisplayUrl ? 'Replace' : 'Upload'}
          </Button>
          {currentDisplayUrl && (
            <Button variant="outline" size="sm" onClick={handleRemove} disabled={removing}>
              {removing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Remove
            </Button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onSelectFile} />
      </div>

      <Dialog open={cropOpen} onOpenChange={closeCropDialog} routeName="crop-report-banner-popup">
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crop {label}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Drag to adjust the crop area. Aspect ratio is locked ({aspectRatio}:1).
          </p>
          {imgSrc && (
            <div className="overflow-auto rounded-lg flex justify-center bg-muted" style={{ maxHeight: '320px' }}>
              <ReactCrop
                crop={crop}
                onChange={(_, pct) => setCrop(pct)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={aspectRatio}
                keepSelection
              >
                <img
                  ref={imgRef}
                  alt="Crop preview"
                  src={imgSrc}
                  onLoad={onImageLoad}
                  style={{ maxHeight: '320px', maxWidth: '100%', display: 'block' }}
                />
              </ReactCrop>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeCropDialog} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!completedCrop || uploading}>
              {uploading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...</>
              ) : (
                'Crop & Upload'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
