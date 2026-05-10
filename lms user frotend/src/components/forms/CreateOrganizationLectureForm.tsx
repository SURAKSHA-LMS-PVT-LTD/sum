
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Video, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { organizationApi } from '@/api/organization.api';
import { getBaseUrl2 } from '@/contexts/utils/auth.api';

interface CreateOrganizationLectureFormProps {
  courseId: string;
  organizationId?: string;
  onSuccess: (lecture: any) => void;
  onCancel: () => void;
}

interface LectureCreateData {
  causeId: string;
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

const CreateOrganizationLectureForm = ({ courseId, organizationId, onSuccess, onCancel }: CreateOrganizationLectureFormProps) => {
  const [formData, setFormData] = useState<LectureCreateData>({
    causeId: courseId,
    title: '',
    description: '',
    content: '',
    venue: '',
    mode: 'online',
    timeStart: '',
    timeEnd: '',
    liveLink: '',
    liveMode: '',
    recordingUrl: '',
    isPublic: true
  });
  const [courses, setCourses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [documents, setDocuments] = useState<File[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const userRole = useInstituteRole();

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        // Fetch all courses with a high limit to show all available courses
        const params = { 
          limit: 1000, 
          page: 1,
          userId: user?.id,
          role: userRole || 'User'
        };
        
        if (organizationId) {
          const response = await organizationApi.getOrganizationCourses(organizationId, params);
          setCourses(response.data);
        } else {
          const response = await organizationApi.getCourses(params);
          setCourses(response.data);
        }
      } catch (error: any) {
        console.error('Error fetching courses:', error);
        toast({
          title: "Error",
          description: "Failed to load courses",
          variant: "destructive",
        });
      } finally {
        setLoadingCourses(false);
      }
    };

    fetchCourses();
  }, [organizationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.description.trim() || !formData.causeId) {
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

      // Build multipart form data
      const fd = new FormData();
      fd.append('causeId', formData.causeId);
      fd.append('title', formData.title);
      fd.append('description', formData.description);
      if (formData.content) fd.append('content', formData.content);
      fd.append('venue', formData.venue);
      fd.append('mode', formData.mode);
      if (formData.timeStart) fd.append('timeStart', new Date(formData.timeStart).toISOString());
      if (formData.timeEnd) fd.append('timeEnd', new Date(formData.timeEnd).toISOString());
      if (formData.liveLink) fd.append('liveLink', formData.liveLink);
      if (formData.liveMode) fd.append('liveMode', formData.liveMode);
      if (formData.recordingUrl) fd.append('recordingUrl', formData.recordingUrl);
      fd.append('isPublic', String(formData.isPublic));

      // Append multiple documents
      documents.forEach((file) => {
        fd.append('documents', file, file.name);
      });

      const response = await fetch(`${baseUrl2}/organization/api/v1/lectures/with-documents/${formData.causeId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('org_access_token')}`
        },
        body: fd,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(errText || 'Failed to create lecture');
      }

      const lecture = await response.json();

      toast({
        title: "Success",
        description: "Lecture created successfully",
      });

      onSuccess?.(lecture);
    } catch (error: any) {
      console.error('Error creating lecture:', error);
      toast({
        title: "Error",
        description: "Failed to create lecture",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof LectureCreateData, value: string | boolean) => {
    setFieldErrors(prev => ({ ...prev, [field]: '' }));

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center space-x-4 mb-8">
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="p-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Create Lecture</h1>
            <p className="text-gray-600 dark:text-gray-400">Set up a new lecture session</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Video className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>Lecture Details</CardTitle>
                <CardDescription>
                  Fill in the information below to create your lecture
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="causeId">Course *</Label>
                <Select value={formData.causeId} onValueChange={(value) => handleInputChange('causeId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingCourses ? (
                      <SelectItem value="loading" disabled>Loading courses...</SelectItem>
                    ) : (
                      courses.map((course) => (
                        <SelectItem key={course.causeId} value={course.causeId}>
                          {course.title}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

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
                <Label htmlFor="documents">Documents (Multiple files allowed)</Label>
                <Input
                  id="documents"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const input = e.target as HTMLInputElement;
                    const newFiles = Array.from(input.files || []);
                    setDocuments((prev) => {
                      const merged: File[] = [...prev];
                      newFiles.forEach((f) => {
                        const exists = merged.some(
                          (mf) => mf.name === f.name && mf.size === f.size && mf.lastModified === f.lastModified
                        );
                        if (!exists) merged.push(f);
                      });
                      return merged;
                    });
                    // Reset input so selecting the same file again re-triggers change
                    input.value = '';
                  }}
                  disabled={isLoading}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  You can select multiple documents at once. Supported formats: PDF, Word, PowerPoint, Excel, Images
                </p>
                {documents.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium">{documents.length} file(s) selected:</p>
                    <ul className="space-y-1">
                      {documents.map((file, index) => (
                        <li key={index} className="flex items-center justify-between text-sm bg-muted p-2 rounded">
                          <span className="truncate flex-1">{file.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </li>
                      ))}
                    </ul>
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
                {onCancel && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={isLoading || loadingCourses}
                >
                  {isLoading ? "Creating..." : "Create Lecture"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateOrganizationLectureForm;
