import React, { useState, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { instituteSettingsApi, InstituteSettingsResponse } from '@/api/instituteSettings.api';
import { uploadWithSignedUrl } from '@/utils/signedUploadHelper';
import { SafeImage } from '@/components/ui/SafeImage';
import { Plus, Trash2, Loader2, ImageIcon, Images } from 'lucide-react';
import { getErrorMessage } from '@/api/apiError';

interface GalleryManagerProps {
  instituteId: string;
  imageUrls: string[];
  onUpdate: (updated: InstituteSettingsResponse) => void;
}

export const GalleryManager: React.FC<GalleryManagerProps> = ({
  instituteId, imageUrls, onUpdate,
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (imageUrls.length >= 10) {
      toast({ title: 'Gallery Full', description: 'Maximum 10 images allowed.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const relativePath = await uploadWithSignedUrl(file, 'institute-images');
      const updated = await instituteSettingsApi.addGalleryImage(instituteId, relativePath);
      onUpdate(updated);
      toast({ title: 'Added', description: 'Image added to gallery.' });
    } catch (error: any) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to add image'), variant: 'destructive' });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = async (index: number) => {
    setRemovingIndex(index);
    try {
      const updated = await instituteSettingsApi.removeGalleryImage(instituteId, index);
      onUpdate(updated);
      toast({ title: 'Removed', description: 'Image removed from gallery.' });
    } catch (error: any) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to remove image'), variant: 'destructive' });
    } finally {
      setRemovingIndex(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Images className="h-4 w-4" /> Gallery ({imageUrls.length}/10)
        </Label>
        {imageUrls.length < 10 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Add Image
          </Button>
        )}
      </div>

      {imageUrls.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center text-muted-foreground">
          <ImageIcon className="h-10 w-10 mb-2" />
          <span className="text-sm">No gallery images yet</span>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => fileInputRef.current?.click()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Add First Image
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {imageUrls.map((url, index) => (
            <div key={`${url}-${index}`} className="relative group rounded-lg overflow-hidden border border-border aspect-square">
              <SafeImage
                src={url}
                alt={`Gallery ${index + 1}`}
                className="w-full h-full object-cover"
                fallback={
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                }
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <Button
                  variant="destructive"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemoveImage(index)}
                  disabled={removingIndex === index}
                >
                  {removingIndex === index ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAddImage} />
    </div>
  );
};
