import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { X, Save, Video, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getBaseUrl2 } from '@/contexts/utils/auth.api';
import { uploadWithSignedUrl } from '@/utils/signedUploadHelper';

interface UpdateOrganizationLectureFormProps {
  lecture: any;
  onClose: () => void;
  onSuccess: () => void;
}

interface LectureUpdateData {
  title: string;
  description: string;
  content?: string;
  venue: string;
  mode: 'online' | 'physical';
  timeStart: string;
  timeEnd: string;
  liveLink?: string;
  liveMode?: string;
  recordingUrl?: string;
  isPublic: boolean;
}

const UpdateOrganizationLectureForm = ({ lecture, onClose, onSuccess }: UpdateOrganizationLectureFormProps) => {
  const [formData, setFormData] = useState<LectureUpdateData>({
    title: lecture.title || '',
    description: lecture.description || '',
    content: lecture.content || '',
    venue: lecture.venue || '',
    mode: lecture.mode || 'online',
    timeStart: lecture.timeStart ? new Date(lecture.timeStart).toISOString().slice(0, 16) : '',
    timeEnd: lecture.timeEnd ? new Date(lecture.timeEnd).toISOString().slice(0, 16) : '',
    liveLink: lecture.liveLink || '',
    liveMode: lecture.liveMode || '',
    recordingUrl: lecture.recordingUrl || '',
    isPublic: lecture.isPublic ?? true
  });
  const [documents, setDocuments] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.description.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

        const errors: Record<string, string> = {};
    if (!formData.title) errors.title = 'Title is required';
    if (!formData.description) errors.description = 'Description is required';
    if (!formData.venue) errors.venue = 'Venue is required';
    if (!formData.timeStart) errors.timeStart = 'Time Start is required';
    if (!formData.timeEnd) errors.timeEnd = 'Time End is required';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const baseUrl2 = getBaseUrl2();
      if (!baseUrl2) {
        throw new Error('Organization base URL not configured');
      }

      // Step 1: Upload documents using signed URL
      const documentPaths: string[] = [];
      if (documents.length > 0) {
        for (const file of documents) {
          const relativePath = await uploadWithSignedUrl(
            file,
            'homework-files' // or appropriate folder
          );
          documentPaths.push(relativePath);
        }
      }

      // Step 2: Build lecture update data
      const updateData: any = {
        title: formData.title,
        description: formData.description,
        venue: formData.venue,
        mode: formData.mode,
        isPublic: formData.isPublic
      };
      
      if (formData.content) updateData.content = formData.content;
      if (formData.timeStart) updateData.timeStart = new Date(formData.timeStart).toISOString();
      if (formData.timeEnd) updateData.timeEnd = new Date(formData.timeEnd).toISOString();
      if (formData.liveLink) updateData.liveLink = formData.liveLink;
      if (formData.liveMode) updateData.liveMode = formData.liveMode;
      if (formData.recordingUrl) updateData.recordingUrl = formData.recordingUrl;
      if (documentPaths.length > 0) updateData.documentUrls = documentPaths;

      const response = await fetch(`${baseUrl2}/organization/api/v1/lectures/${lecture.lectureId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('org_access_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(errText || 'Failed to update lecture');
      }

      const updatedLecture = await response.json();

      toast({
        title: "Success",
        description: "Lecture updated successfully",
      });

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Error updating lecture:', error);
      toast({
        title: "Error",
        description: "Failed to update lecture",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof LectureUpdateData, value: string | boolean) => {
    setFieldErrors(prev => ({ ...prev, [field]: '' }));

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Update Lecture</CardTitle>
            <CardDescription>Update lecture details and information</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Lecture Title *</Label>
            <Input
              id="title"
              placeholder="Enter lecture title"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              required
              className={`${fieldErrors.title ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            />

            {fieldErrors.title && <p className="text-xs text-red-500 mt-1">{fieldErrors.title}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Enter lecture description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              rows={3}
              required
              className={`${fieldErrors.description ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            />

            {fieldErrors.description && <p className="text-xs text-red-500 mt-1">{fieldErrors.description}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              placeholder="Enter detailed lecture content"
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mode">Lecture Mode *</Label>
              <Select value={formData.mode} onValueChange={(value: any) => handleInputChange('mode', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4" />
                      Online
                    </div>
                  </SelectItem>
                  <SelectItem value="physical">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Physical
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue">Venue *</Label>
              <Input
                id="venue"
                placeholder={formData.mode === 'online' ? 'Online Platform' : 'Physical Location'}
                value={formData.venue}
                onChange={(e) => handleInputChange('venue', e.target.value)}
                required
              className={`${fieldErrors.venue ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />

              {fieldErrors.venue && <p className="text-xs text-red-500 mt-1">{fieldErrors.venue}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="timeStart">Start Time *</Label>
              <Input
                id="timeStart"
                type="datetime-local"
                value={formData.timeStart}
                onChange={(e) => handleInputChange('timeStart', e.target.value)}
                required
              className={`${fieldErrors.timeStart ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />

              {fieldErrors.timeStart && <p className="text-xs text-red-500 mt-1">{fieldErrors.timeStart}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeEnd">End Time *</Label>
              <Input
                id="timeEnd"
                type="datetime-local"
                value={formData.timeEnd}
                onChange={(e) => handleInputChange('timeEnd', e.target.value)}
                required
              className={`${fieldErrors.timeEnd ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />

              {fieldErrors.timeEnd && <p className="text-xs text-red-500 mt-1">{fieldErrors.timeEnd}</p>}
            </div>
          </div>

          {formData.mode === 'online' && (
            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-medium">Online Meeting Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="liveLink">Live Link</Label>
                  <Input
                    id="liveLink"
                    placeholder="https://zoom.us/j/..."
                    value={formData.liveLink}
                    onChange={(e) => handleInputChange('liveLink', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="liveMode">Live Mode</Label>
                  <Input
                    id="liveMode"
                    placeholder="zoom, teams, etc."
                    value={formData.liveMode}
                    onChange={(e) => handleInputChange('liveMode', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recordingUrl">Recording URL</Label>
                <Input
                  id="recordingUrl"
                  placeholder="https://example.com/recordings/..."
                  value={formData.recordingUrl}
                  onChange={(e) => handleInputChange('recordingUrl', e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="documents">Documents (optional)</Label>
            <Input
              id="documents"
              type="file"
              multiple
              onChange={(e) => {
                const files = Array.from((e.target as HTMLInputElement).files || []);
                setDocuments(files);
              }}
              disabled={isLoading}
            />
            {documents.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {documents.length} file(s) selected: {documents.map((f) => f.name).join(', ')}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isPublic"
              checked={formData.isPublic}
              onCheckedChange={(checked) => handleInputChange('isPublic', checked)}
            />
            <Label htmlFor="isPublic">Public Lecture</Label>
          </div>

          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? "Updating..." : "Update Lecture"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default UpdateOrganizationLectureForm;