import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { uploadWithSignedUrl } from '@/utils/signedUploadHelper';
import { SafeImage } from '@/components/ui/SafeImage';
import { Upload, Trash2, Loader2, ImageIcon } from 'lucide-react';
import { getErrorMessage } from '@/api/apiError';
import { getImageUrl } from '@/utils/imageUrlHelper';

interface BrandingImageUploaderProps {
  currentUrl: string | null | undefined;
  label: string;
  description?: string;
  accept?: string;
  disabled?: boolean;
  onUploaded: (url: string) => void;
  onRemoved: () => void;
}

export const BrandingImageUploader: React.FC<BrandingImageUploaderProps> = ({
  currentUrl, label, description, accept = 'image/*', disabled, onUploaded, onRemoved,
}) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const blobUrlRef = React.useRef<string | null>(null);

  // Revoke previous blob URL to avoid memory leaks
  const revokeBlobUrl = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

  React.useEffect(() => {
    setPreview(currentUrl || null);
    // When currentUrl changes (e.g. external reset), revoke any pending blob
    revokeBlobUrl();
  }, [currentUrl]);

  React.useEffect(() => {
    return () => { revokeBlobUrl(); };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local blob preview immediately so the user sees the image right away,
    // before the signed-URL upload + verify round-trip completes.
    revokeBlobUrl();
    const localUrl = URL.createObjectURL(file);
    blobUrlRef.current = localUrl;
    setPreview(localUrl);

    setUploading(true);
    try {
      const relativePath = await uploadWithSignedUrl(file, 'institute-images');
      // Keep the local blob preview (already visible); notify parent with the
      // relativePath so it can persist it to the backend on save.
      onUploaded(relativePath);
      toast({ title: 'Uploaded', description: `${label} uploaded successfully.` });
    } catch (error: any) {
      // Revert preview on failure
      revokeBlobUrl();
      setPreview(currentUrl || null);
      toast({ title: 'Upload Failed', description: getErrorMessage(error, 'Failed to upload'), variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onRemoved();
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="border border-dashed border-border rounded-lg p-3 space-y-2">
        {preview ? (
          <SafeImage
            src={preview.startsWith('blob:') ? preview : getImageUrl(preview)}
            alt={label}
            className="max-h-24 rounded-md object-contain mx-auto"
            fallback={
              <div className="h-20 flex items-center justify-center bg-muted rounded-md">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </div>
            }
          />
        ) : (
          <div className="h-16 flex flex-col items-center justify-center text-muted-foreground">
            <ImageIcon className="h-6 w-6 mb-1" />
            <span className="text-xs">No image set</span>
          </div>
        )}
        <div className="flex items-center gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || disabled}
          >
            {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            {preview ? 'Replace' : 'Upload'}
          </Button>
          {preview && (
            <Button variant="outline" size="sm" onClick={handleRemove} disabled={uploading || disabled}>
              <Trash2 className="h-4 w-4 mr-1" /> Remove
            </Button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept={accept} className="hidden" onChange={handleFileChange} />
      </div>
    </div>
  );
};
