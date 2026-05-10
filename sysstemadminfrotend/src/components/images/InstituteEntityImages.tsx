import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { uploadFile } from '@/lib/upload';
import {
  Upload,
  ImageIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  X,
  Plus,
} from 'lucide-react';

type ImageField = 'logoUrl' | 'imageUrl' | 'loadingGifUrl';

interface UploadJob {
  field: ImageField | 'gallery';
  status: 'idle' | 'uploading' | 'updating' | 'completed' | 'error';
  progress: number;
  message: string;
}

export function InstituteEntityImages() {
  const { toast } = useToast();
  const [instituteId, setInstituteId] = useState('');
  const [uploadJobs, setUploadJobs] = useState<Record<string, UploadJob>>({});

  // Gallery
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);

  const updateJob = (field: string, update: Partial<UploadJob>) => {
    setUploadJobs((prev) => ({
      ...prev,
      [field]: { ...prev[field], ...update } as UploadJob,
    }));
  };

  const handleSingleUpload = async (file: File, field: ImageField) => {
    if (!instituteId.trim()) {
      toast({ title: 'Error', description: 'Enter institute ID first', variant: 'destructive' });
      return;
    }

    updateJob(field, { field, status: 'uploading', progress: 30, message: 'Uploading...' });

    try {
      const result = await uploadFile(file, 'institute-images');
      updateJob(field, { status: 'updating', progress: 70, message: 'Updating institute...' });

      await api.updateInstitute(instituteId, { [field]: result.relativePath });

      updateJob(field, { status: 'completed', progress: 100, message: 'Updated successfully!' });
      toast({ title: 'Success', description: `Institute ${field} updated` });
    } catch (error: any) {
      updateJob(field, { status: 'error', progress: 0, message: error.message });
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleGalleryUpload = async () => {
    if (!instituteId.trim() || galleryFiles.length === 0) return;

    updateJob('gallery', { field: 'gallery', status: 'uploading', progress: 10, message: 'Uploading gallery images...' });

    try {
      const paths: string[] = [];
      for (let i = 0; i < galleryFiles.length; i++) {
        const result = await uploadFile(galleryFiles[i], 'institute-images');
        paths.push(result.relativePath);
        updateJob('gallery', {
          progress: 10 + Math.round((i + 1) / galleryFiles.length * 60),
          message: `Uploaded ${i + 1}/${galleryFiles.length}...`,
        });
      }

      updateJob('gallery', { status: 'updating', progress: 80, message: 'Updating institute gallery...' });
      await api.updateInstitute(instituteId, { imageUrls: paths });

      updateJob('gallery', { status: 'completed', progress: 100, message: `${paths.length} gallery images updated!` });
      setGalleryFiles([]);
      toast({ title: 'Gallery Updated', description: `${paths.length} images uploaded` });
    } catch (error: any) {
      updateJob('gallery', { status: 'error', progress: 0, message: error.message });
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const renderJobStatus = (field: string) => {
    const job = uploadJobs[field];
    if (!job || job.status === 'idle') return null;

    const icons: Record<string, JSX.Element> = {
      uploading: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
      updating: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
      completed: <CheckCircle2 className="h-4 w-4 text-success" />,
      error: <AlertCircle className="h-4 w-4 text-destructive" />,
    };

    return (
      <div className="space-y-2 mt-2">
        <div className="flex items-center gap-2 text-sm">
          {icons[job.status]}
          <span>{job.message}</span>
        </div>
        {!['completed', 'error'].includes(job.status) && (
          <Progress value={job.progress} className="h-1.5" />
        )}
      </div>
    );
  };

  const ImageUploadCard = ({
    title,
    description,
    field,
    accept,
  }: {
    title: string;
    description: string;
    field: ImageField;
    accept: string;
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          type="file"
          accept={accept}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleSingleUpload(file, field);
          }}
          disabled={!instituteId.trim() || uploadJobs[field]?.status === 'uploading'}
        />
        {renderJobStatus(field)}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Institute ID */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Institute ID
              </Label>
              <Input
                placeholder="Enter institute ID"
                value={instituteId}
                onChange={(e) => setInstituteId(e.target.value)}
              />
            </div>
          </div>
          {!instituteId.trim() && (
            <p className="text-sm text-muted-foreground mt-2">
              Enter an institute ID to enable image uploads. Changes take effect immediately.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Single Image Uploads */}
      <div className="grid gap-4 md:grid-cols-3">
        <ImageUploadCard
          title="Institute Logo"
          description="PNG, SVG, or WebP recommended"
          field="logoUrl"
          accept="image/png,image/svg+xml,image/webp,image/jpeg"
        />
        <ImageUploadCard
          title="Banner Image"
          description="Main institute image"
          field="imageUrl"
          accept="image/jpeg,image/png,image/webp"
        />
        <ImageUploadCard
          title="Loading GIF"
          description="Animated loading indicator"
          field="loadingGifUrl"
          accept="image/gif,image/webp"
        />
      </div>

      {/* Gallery Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Gallery Images
          </CardTitle>
          <CardDescription>
            Upload multiple images. This replaces the entire gallery array.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => {
              if (e.target.files) {
                setGalleryFiles(Array.from(e.target.files));
              }
            }}
            disabled={!instituteId.trim()}
          />

          {galleryFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{galleryFiles.length} files selected</Badge>
                <Button variant="ghost" size="sm" onClick={() => setGalleryFiles([])}>
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {galleryFiles.map((f, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {f.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {renderJobStatus('gallery')}

          <Button
            onClick={handleGalleryUpload}
            disabled={!instituteId.trim() || galleryFiles.length === 0 || uploadJobs['gallery']?.status === 'uploading'}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Gallery ({galleryFiles.length} images)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
