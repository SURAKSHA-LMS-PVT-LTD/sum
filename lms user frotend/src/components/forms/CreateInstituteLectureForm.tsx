import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Calendar, Clock, MapPin, Video, Users } from 'lucide-react';
import { lectureApi } from '@/api/lecture.api';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/api/apiError';
import LectureMaterialsSection, { LectureMaterial } from '@/components/common/LectureMaterialsSection';
import LectureThumbnailUpload from '@/components/common/LectureThumbnailUpload';

const Req = () => <span className="text-red-500 ml-0.5">*</span>;
const Opt = () => <span className="text-xs font-normal text-muted-foreground ml-1">(optional)</span>;

interface CreateInstituteLectureFormProps {
  onClose?: () => void;
  onSuccess?: () => void | Promise<void>;
}

const CreateInstituteLectureForm = ({ onClose, onSuccess }: CreateInstituteLectureFormProps) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    venue: '',
    lectureType: 'online',
    subject: '',
    startTime: '',
    endTime: '',
    status: 'scheduled',
    meetingLink: '',
    meetingId: '',
    meetingPassword: '',
    recordingUrl: '',
    maxParticipants: 100,
    isActive: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [materials, setMaterials] = useState<LectureMaterial[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const { toast } = useToast();
  const { user, selectedInstitute } = useAuth();

  const handleInputChange = (field: string, value: string | boolean | number) => {
    setFieldErrors(prev => ({ ...prev, [field]: '' }));

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedInstitute?.id || !user?.id) {
      toast({
        title: "Error",
        description: "Please select an institute before creating a lecture",
        variant: "destructive",
      });
      return;
    }

        const errors: Record<string, string> = {};
    if (!formData.title) errors.title = 'Title is required';
    if (!formData.subject) errors.subject = 'Subject is required';
    if (!formData.startTime) errors.startTime = 'Start time is required';
    if (!formData.endTime) errors.endTime = 'End time is required';
    if (formData.startTime && formData.endTime && new Date(formData.endTime) <= new Date(formData.startTime)) {
      errors.endTime = 'End time must be after start time';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const lectureData = {
        instituteId: selectedInstitute.id,
        instructorId: user.id,
        title: formData.title,
        description: formData.description,
        lectureType: formData.lectureType as 'online' | 'physical',
        venue: formData.venue || null,
        subject: formData.subject,
        startTime: formData.startTime ? new Date(formData.startTime).toISOString() : null,
        endTime: formData.endTime ? new Date(formData.endTime).toISOString() : null,
        status: formData.status as 'scheduled' | 'completed' | 'cancelled' | 'ongoing' | 'postponed',
        meetingLink: formData.meetingLink || null,
        meetingId: formData.meetingId || null,
        meetingPassword: formData.meetingPassword || null,
        recordingUrl: formData.recordingUrl || null,
        isRecorded: !!formData.recordingUrl,
        maxParticipants: formData.maxParticipants,
        isActive: formData.isActive,
        materials: materials.length > 0 ? materials : undefined,
        thumbnailUrl: thumbnailUrl || undefined,
      };
      
      console.log('Creating institute lecture with data:', lectureData);
      
      const newLecture = await lectureApi.createInstituteLecture(lectureData);
      
      toast({
        title: "Success",
        description: `Institute lecture "${newLecture.title}" created successfully`,
      });

      // Reset form
      setFormData({
        title: '',
        description: '',
        venue: '',
        lectureType: 'online',
        subject: '',
        startTime: '',
        endTime: '',
        status: 'scheduled',
        meetingLink: '',
        meetingId: '',
        meetingPassword: '',
        recordingUrl: '',
        maxParticipants: 100,
        isActive: true
      });
      setMaterials([]);
      setThumbnailUrl('');

      if (onSuccess) {
        await onSuccess();
      }
    } catch (error: any) {
      console.error('Error creating institute lecture:', error);
      toast({
        title: "Failed to create lecture",
        description: getErrorMessage(error, 'Please try again.'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {onClose && (
        <Button variant="outline" onClick={onClose} className="w-fit">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Create Institute Lecture
          </CardTitle>
          <CardDescription>
            Create a new lecture for {selectedInstitute?.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title">Lecture Title<Req /></Label>
                <Input
                  id="title"
                  placeholder="Enter lecture title..."
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
              className={`${fieldErrors.title ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                {fieldErrors.title && <p className="text-xs text-red-500 mt-1">{fieldErrors.title}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject<Req /></Label>
                <Input
                  id="subject"
                  placeholder="Enter subject..."
                  value={formData.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
              className={`${fieldErrors.subject ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                {fieldErrors.subject && <p className="text-xs text-red-500 mt-1">{fieldErrors.subject}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description<Opt /></Label>
              <Textarea
                id="description"
                placeholder="Enter lecture description..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
              className={`${fieldErrors.description ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />
              {fieldErrors.description && <p className="text-xs text-red-500 mt-1">{fieldErrors.description}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="lectureType">Lecture Type<Req /></Label>
                <Select value={formData.lectureType} onValueChange={(value) => handleInputChange('lectureType', value)}>
                  <SelectTrigger>
                    <SelectValue />
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
                    <SelectItem value="hybrid">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Hybrid
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status<Req /></Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="postponed">Postponed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="startTime" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Start Time<Req />
                </Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => handleInputChange('startTime', e.target.value)}
                  className={`${fieldErrors.startTime ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                {fieldErrors.startTime && <p className="text-xs text-red-500 mt-1">{fieldErrors.startTime}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="endTime" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  End Time<Req />
                </Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => handleInputChange('endTime', e.target.value)}
                  className={`${fieldErrors.endTime ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                {fieldErrors.endTime && <p className="text-xs text-red-500 mt-1">{fieldErrors.endTime}</p>}
              </div>
            </div>

            {formData.lectureType === 'online' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="meetingLink">Meeting Link<Opt /></Label>
                  <Input
                    id="meetingLink"
                    placeholder="https://zoom.us/j/... or meeting link"
                    value={formData.meetingLink}
                    onChange={(e) => handleInputChange('meetingLink', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="meetingId">Meeting ID<Opt /></Label>
                    <Input
                      id="meetingId"
                      placeholder="123-456-789"
                      value={formData.meetingId}
                      onChange={(e) => handleInputChange('meetingId', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="meetingPassword">Meeting Password<Opt /></Label>
                    <Input
                      id="meetingPassword"
                      placeholder="Password for the meeting"
                      value={formData.meetingPassword}
                      onChange={(e) => handleInputChange('meetingPassword', e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {(formData.lectureType === 'physical' || formData.lectureType === 'hybrid') && (
              <div className="space-y-2">
                <Label htmlFor="venue">Venue<Opt /></Label>
                <Input
                  id="venue"
                  placeholder="Physical location address"
                  value={formData.venue}
                  onChange={(e) => handleInputChange('venue', e.target.value)}
                />
              </div>
            )}

            {formData.lectureType === 'hybrid' && (
              <div className="space-y-2">
                <Label htmlFor="meetingLink">Online Meeting Link<Opt /></Label>
                <Input
                  id="meetingLink"
                  placeholder="https://zoom.us/j/... or meeting link"
                  value={formData.meetingLink}
                  onChange={(e) => handleInputChange('meetingLink', e.target.value)}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="maxParticipants">Max Participants<Opt /></Label>
                <Input
                  id="maxParticipants"
                  type="number"
                  min="1"
                  placeholder="100"
                  value={formData.maxParticipants}
                  onChange={(e) => handleInputChange('maxParticipants', parseInt(e.target.value) || 100)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recordingUrl">Recording URL<Opt /></Label>
                <Input
                  id="recordingUrl"
                  placeholder="https://... (can be added later)"
                  value={formData.recordingUrl}
                  onChange={(e) => handleInputChange('recordingUrl', e.target.value)}
                />
              </div>
            </div>

            <LectureThumbnailUpload
              thumbnailUrl={thumbnailUrl}
              onChange={setThumbnailUrl}
              disabled={isLoading}
            />

            <LectureMaterialsSection
              materials={materials}
              onChange={setMaterials}
              instituteId={selectedInstitute?.id}
              disabled={isLoading}
            />

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => handleInputChange('isActive', checked)}
              />
              <Label htmlFor="isActive" className="text-sm font-medium">
                Active lecture
              </Label>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? 'Creating...' : 'Create Institute Lecture'}
              </Button>
              {onClose && (
                <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateInstituteLectureForm;