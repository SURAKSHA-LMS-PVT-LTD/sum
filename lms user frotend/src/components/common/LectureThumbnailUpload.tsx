import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Image, Upload, Link2, Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getSignedUrl, uploadToSignedUrl, verifyAndPublish, deleteUploadedFile } from '@/utils/imageUploadHelper';
import { getImageUrl } from '@/utils/imageUrlHelper';
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

// 16:9 — standard video thumbnail aspect ratio (matches StructuredLectures cards)
const THUMBNAIL_ASPECT = 16 / 9;

function centerAspectCrop(w: number, h: number): Crop {
  return centerCrop(makeAspectCrop({ unit: '%', width: 80 }, THUMBNAIL_ASPECT, w, h), w, h);
}

interface LectureThumbnailUploadProps {
  thumbnailUrl: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

const LectureThumbnailUpload: React.FC<LectureThumbnailUploadProps> = ({
  thumbnailUrl,
  onChange,
  disabled = false,
}) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  // Crop dialog state
  const [cropOpen, setCropOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [uploading, setUploading] = useState(false);
  // Local blob URL for immediate preview after upload (avoids CDN propagation delay)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string>('');

  // Revoke blob URL on unmount or when it changes
  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = '';

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5 MB for thumbnails.', variant: 'destructive' });
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file.', variant: 'destructive' });
      return;
    }

    setSelectedFile(file);
    setCrop(undefined);
    const reader = new FileReader();
    reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
    reader.readAsDataURL(file);
    setCropOpen(true);
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height));
  };

  const getCroppedBlob = useCallback(async (image: HTMLImageElement, cropPx: PixelCrop): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const dpr = window.devicePixelRatio;
    canvas.width = Math.floor(cropPx.width * scaleX * dpr);
    canvas.height = Math.floor(cropPx.height * scaleY * dpr);
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      image,
      cropPx.x * scaleX, cropPx.y * scaleY,
      cropPx.width * scaleX, cropPx.height * scaleY,
      0, 0,
      cropPx.width * scaleX, cropPx.height * scaleY,
    );
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Canvas empty')), 'image/jpeg', 0.92);
    });
  }, []);

  const handleCropUpload = async () => {
    if (!imgRef.current || !completedCrop || !selectedFile) return;
    setUploading(true);
    try {
      const blob = await getCroppedBlob(imgRef.current, completedCrop);
      const fileName = selectedFile.name.replace(/\.[^/.]+$/, '') + '.jpg';
      const signed = await getSignedUrl('lecture-thumbnails', fileName, 'image/jpeg', blob.size);
      await uploadToSignedUrl(signed.uploadUrl, blob, signed.fields);
      await verifyAndPublish(signed.relativePath);
      // Delete old thumbnail if it was a managed storage path
      if (thumbnailUrl) deleteUploadedFile(thumbnailUrl);
      // Create a local blob URL for immediate preview (avoids CDN propagation delay)
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(URL.createObjectURL(blob));
      onChange(signed.relativePath);
      toast({ title: 'Thumbnail uploaded', description: fileName });
      handleCloseCrop();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err?.message || 'Unknown error', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleCloseCrop = () => {
    setCropOpen(false);
    setImgSrc('');
    setCrop(undefined);
    setCompletedCrop(undefined);
    setSelectedFile(null);
  };

  const handleUrlAdd = () => {
    const url = urlInput.trim();
    if (!url) return;
    try { new URL(url); } catch {
      toast({ title: 'Invalid URL', description: 'Please enter a valid URL.', variant: 'destructive' });
      return;
    }
    onChange(url);
    setUrlInput('');
  };

  const handleRemove = () => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setLocalPreviewUrl('');
    if (thumbnailUrl) deleteUploadedFile(thumbnailUrl);
    onChange('');
  };

  // Use local blob preview if available (just uploaded), otherwise resolve via getImageUrl
  const previewSrc = localPreviewUrl || (thumbnailUrl ? getImageUrl(thumbnailUrl) : '');

  return (
    <>
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Image className="h-4 w-4 text-muted-foreground" />
          Thumbnail Image <span className="text-[10px] font-normal text-muted-foreground">(16:9)</span>
        </Label>

        {thumbnailUrl ? (
          <div className="space-y-2">
            {/* 16:9 preview */}
            <div className="relative aspect-video w-full max-w-xs rounded-lg overflow-hidden border bg-muted">
              <img
                src={previewSrc}
                alt="Thumbnail preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled}
                className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground truncate max-w-xs">{thumbnailUrl}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5 w-fit">
              <button
                type="button"
                onClick={() => setMode('upload')}
                disabled={disabled}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  mode === 'upload' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Upload className="h-3 w-3" /> Upload
              </button>
              <button
                type="button"
                onClick={() => setMode('url')}
                disabled={disabled}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  mode === 'url' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Link2 className="h-3 w-3" /> URL
              </button>
            </div>

            {mode === 'upload' && (
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={disabled}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={disabled} className="gap-2">
                  <Upload className="h-3.5 w-3.5" /> Choose Image
                </Button>
                <p className="text-[10px] text-muted-foreground mt-1">JPG, PNG, WebP — max 5 MB · will crop to 16:9</p>
              </div>
            )}

            {mode === 'url' && (
              <div className="flex gap-2">
                <Input
                  placeholder="https://… (image URL)"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={disabled}
                  className="text-sm flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleUrlAdd())}
                />
                <Button type="button" variant="outline" size="sm" onClick={handleUrlAdd} disabled={disabled || !urlInput.trim()}>
                  Add
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Crop Dialog */}
      <Dialog open={cropOpen} onOpenChange={(open) => { if (!open) handleCloseCrop(); }} routeName="crop-lecture-thumbnail-popup">
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crop Thumbnail (16:9)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Adjust the selection to crop your thumbnail to the correct 16:9 ratio.</p>
            {imgSrc && (
              <div className="max-h-96 overflow-auto rounded-lg flex justify-center bg-muted/40">
                <ReactCrop
                  crop={crop}
                  onChange={(_, pct) => setCrop(pct)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={THUMBNAIL_ASPECT}
                  minWidth={80}
                  keepSelection
                  ruleOfThirds
                  style={{ maxHeight: '360px' }}
                >
                  <img
                    ref={imgRef}
                    alt="Crop preview"
                    src={imgSrc}
                    onLoad={onImageLoad}
                    style={{ maxHeight: '360px', maxWidth: '100%' }}
                  />
                </ReactCrop>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCloseCrop} disabled={uploading}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCropUpload} disabled={!completedCrop || uploading}>
              {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</> : 'Crop & Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LectureThumbnailUpload;
