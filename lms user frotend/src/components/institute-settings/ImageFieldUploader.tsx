import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { instituteSettingsApi, InstituteSettingsResponse } from '@/api/instituteSettings.api';
import { uploadWithSignedUrl } from '@/utils/signedUploadHelper';
import { deleteUploadedFile } from '@/utils/imageUploadHelper';
import { SafeImage } from '@/components/ui/SafeImage';
import { Upload, Trash2, Loader2, ImageIcon } from 'lucide-react';
import { getErrorMessage } from '@/api/apiError';
import { getImageUrl } from '@/utils/imageUrlHelper';

interface ImageFieldUploaderProps {
  instituteId: string;
  field: 'logo' | 'loading-gif' | 'cover-image' | 'report-header' | 'report-footer';
  settingsField: 'logoUrl' | 'loadingGifUrl' | 'imageUrl' | 'reportHeaderUrl' | 'reportFooterUrl';
  currentDisplayUrl: string | null;
  label: string;
  accept?: string;
  onUpdate: (updated: InstituteSettingsResponse) => void;
}

export const ImageFieldUploader: React.FC<ImageFieldUploaderProps> = ({
  instituteId, field, settingsField, currentDisplayUrl, label, accept = 'image/*', onUpdate,
}) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentDisplayUrl);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setPreview(currentDisplayUrl);
  }, [currentDisplayUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const relativePath = await uploadWithSignedUrl(file, 'institute-images');
      if (currentDisplayUrl) deleteUploadedFile(currentDisplayUrl);
      const updated = await instituteSettingsApi.updateSettings(instituteId, {
        [settingsField]: relativePath,
      });
      setPreview(updated[settingsField] as string | null);
      onUpdate(updated);
      toast({ title: 'Uploaded', description: `${label} updated successfully.` });
    } catch (error: any) {
      toast({ title: 'Upload Failed', description: getErrorMessage(error, 'Failed to upload'), variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    setUploading(true);
    try {
      if (currentDisplayUrl) deleteUploadedFile(currentDisplayUrl);
      let result: InstituteSettingsResponse;
      if (field === 'logo') result = await instituteSettingsApi.deleteLogo(instituteId);
      else if (field === 'loading-gif') result = await instituteSettingsApi.deleteLoadingGif(instituteId);
      else if (field === 'cover-image') result = await instituteSettingsApi.deleteCoverImage(instituteId);
      // Report branding: clear by setting field to null via PATCH settings
      else result = await instituteSettingsApi.updateSettings(instituteId, { [settingsField]: null } as any);

      setPreview(null);
      onUpdate(result);
      toast({ title: 'Removed', description: `${label} removed.` });
    } catch (error: any) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to remove'), variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="border border-dashed border-border rounded-lg p-4 space-y-3">
        {preview ? (
          <div className="relative">
            <SafeImage
              src={preview.startsWith('blob:') ? preview : getImageUrl(preview)}
              alt={label}
              className="max-h-32 rounded-md object-contain mx-auto"
              fallback={
                <div className="h-32 flex items-center justify-center bg-muted rounded-md">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
              }
            />
          </div>
        ) : (
          <div className="h-24 flex flex-col items-center justify-center text-muted-foreground">
            <ImageIcon className="h-8 w-8 mb-1" />
            <span className="text-xs">No image set</span>
          </div>
        )}
        <div className="flex items-center gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            {preview ? 'Replace' : 'Upload'}
          </Button>
          {preview && (
            <Button variant="outline" size="sm" onClick={handleDelete} disabled={uploading}>
              <Trash2 className="h-4 w-4 mr-1" /> Remove
            </Button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept={accept} className="hidden" onChange={handleFileChange} />
      </div>
    </div>
  );
};
