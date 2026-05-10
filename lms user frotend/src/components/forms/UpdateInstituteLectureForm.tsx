import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Calendar, Clock, MapPin, Video, Users } from 'lucide-react';
import { lectureApi, Lecture } from '@/api/lecture.api';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/api/apiError';
import LectureMaterialsSection, { LectureMaterial } from '@/components/common/LectureMaterialsSection';
import LectureThumbnailUpload from '@/components/common/LectureThumbnailUpload';

const Req = () => <span className="text-red-500 ml-0.5">*</span>;
const Opt = () => <span className="text-xs font-normal text-muted-foreground ml-1">(optional)</span>;

interface UpdateInstituteLectureFormProps {
  lecture: Lecture;
  onClose?: () => void;
  onSuccess?: () => void | Promise<void>;
}

const VALID_LECTURE_TYPES_INST = ['online', 'physical', 'hybrid'] as const;
type InstLectureTypeOpt = typeof VALID_LECTURE_TYPES_INST[number];

const normalizeInstLectureType = (raw: any): InstLectureTypeOpt => {
  if (!raw) return 'online';
  const lt = String(raw).trim().toLowerCase();
  if ((VALID_LECTURE_TYPES_INST as readonly string[]).includes(lt)) return lt as InstLectureTypeOpt;
  if (lt === 'live' || lt === 'virtual' || lt === 'remote') return 'online';
  if (lt === 'in-person' || lt === 'inperson' || lt === 'classroom' || lt === 'offline') return 'physical';
  if (lt === 'mixed' || lt === 'blended') return 'hybrid';
  return 'online';
};

const buildInitialFormDataInst = (lecture: any) => ({
  title: lecture?.title || '',
  description: lecture?.description || '',
  venue: lecture?.venue || '',
  lectureType: normalizeInstLectureType(lecture?.lectureType),
  subject: lecture?.subject || '',
  startTime: lecture?.startTime ? lecture.startTime.slice(0, 16) : '',
  endTime: lecture?.endTime ? lecture.endTime.slice(0, 16) : '',
  status: lecture?.status || 'scheduled',
  meetingLink: lecture?.meetingLink || '',
  meetingId: lecture?.meetingId || '',
  meetingPassword: lecture?.meetingPassword || '',
  recordingUrl: lecture?.recordingUrl || '',
  maxParticipants: lecture?.maxParticipants || 100,
  isActive: lecture?.isActive ?? true,
});

const UpdateInstituteLectureForm = ({ lecture, onClose, onSuccess }: UpdateInstituteLectureFormProps) => {
  const [formData, setFormData] = useState(() => buildInitialFormDataInst(lecture));
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [materials, setMaterials] = useState<LectureMaterial[]>(
    Array.isArray((lecture as any).materials) ? (lecture as any).materials : []
  );
  const [thumbnailUrl, setThumbnailUrl] = useState(lecture.thumbnailUrl || '');
  const { toast } = useToast();
  const { selectedInstitute } = useAuth();

  // Initialize form with lecture data
  useEffect(() => {
    if (lecture) setFormData(buildInitialFormDataInst(lecture));
  }, [lecture]);

  const handleInputChange = (field: string, value: string | boolean | number) => {
    setFieldErrors(prev => ({ ...prev, [field]: '' }));

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedInstitute?.id) {
      toast({
        title: "Error",
        description: "Please select an institute before updating the lecture",
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
      const lectureData: any = {
        instituteId: selectedInstitute.id,
        instructorId: lecture.instructorId,
        title: formData.title,
        description: formData.description || null,
        lectureType: formData.lectureType as 'online' | 'physical' | 'hybrid',
        subject: formData.subject,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        status: formData.status as 'scheduled' | 'completed' | 'cancelled' | 'in_progress',
        maxParticipants: formData.maxParticipants,
        isActive: formData.isActive
      };
      
      // Only include optional fields if they have values
      if (formData.venue) lectureData.venue = formData.venue;
      if (formData.meetingLink) lectureData.meetingLink = formData.meetingLink;
      if (formData.meetingId) lectureData.meetingId = formData.meetingId;
      if (formData.meetingPassword) lectureData.meetingPassword = formData.meetingPassword;
      if (formData.recordingUrl) lectureData.recordingUrl = formData.recordingUrl;
      lectureData.materials = materials.length > 0 ? materials : [];
      lectureData.thumbnailUrl = thumbnailUrl || null;
      
      console.log('Updating institute lecture with data:', lectureData);
      
      const updatedLecture = await lectureApi.updateInstituteLecture(lecture.id, lectureData);
      
      toast({
        title: "Success",
        description: `Institute lecture "${updatedLecture.title}" updated successfully`,
      });

      if (onSuccess) {
        await onSuccess();
      }
      
      // Auto-close dialog after successful update
      if (onClose) {
        onClose();
      }
    } catch (error: any) {
      console.error('Error updating institute lecture:', error);
      toast({
        title: "Failed to update lecture",
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
            Update Institute Lecture
          </CardTitle>
          <CardDescription>
            Update lecture details for {selectedInstitute?.name}
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
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
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
                {isLoading ? 'Updating...' : 'Update Institute Lecture'}
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

export default UpdateInstituteLectureForm;