import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Calendar, Clock, MapPin, Video } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { lectureApi } from '@/api/lecture.api';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import LectureMaterialsSection, { LectureMaterial } from '@/components/common/LectureMaterialsSection';
import LectureThumbnailUpload from '@/components/common/LectureThumbnailUpload';
import LectureTrackingSettings, { TrackingSettingsData } from '@/components/common/LectureTrackingSettings';
import LectureWelcomeMessageSettings, { WelcomeMessageSettingsData } from '@/components/common/LectureWelcomeMessageSettings';
import DurationInput from '@/components/common/DurationInput';

interface CreateLectureFormProps {
  onClose?: () => void;
  onSuccess?: () => void | Promise<void>;
  courseId?: string;
}

const CreateLectureForm = ({ onClose, onSuccess, courseId }: CreateLectureFormProps) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    venue: '',
    mode: 'online',
    timeStart: '',
    timeEnd: '',
    isPublic: true,
    liveLink: '',
    recordingUrl: '',
    maxParticipants: 30,
    meetingId: '',
    meetingPassword: ''
  });
  const [recDurationSeconds, setRecDurationSeconds] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [materials, setMaterials] = useState<LectureMaterial[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [trackingData, setTrackingData] = useState<TrackingSettingsData>({
    liveAttendanceEnabled: false,
    liveAccessLevel: 'ENROLLED_ONLY',
    recAttendanceEnabled: false,
    recPlatform: 'SYSTEM',
    recAccessLevel: 'ENROLLED_ONLY',
  });
  const [welcomeData, setWelcomeData] = useState<WelcomeMessageSettingsData>({
    welcomeMessageEnabled: false,
    welcomeMessageText: '',
    welcomeMessageVoiceEnabled: false,
  });
  const { toast } = useToast();
  const { user, selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const instituteRole = useInstituteRole();

  const canCreate = instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher';

  const detectPlatform = (url: string): 'SYSTEM' | 'YOUTUBE' | 'GOOGLE_DRIVE' => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YOUTUBE';
    if (url.includes('drive.google.com')) return 'GOOGLE_DRIVE';
    return 'SYSTEM';
  };

  const handleInputChange = (field: string, value: string | boolean | number) => {
    setFieldErrors(prev => ({ ...prev, [field]: '' }));
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'recordingUrl' && typeof value === 'string') {
      const detected = detectPlatform(value);
      setTrackingData(prev => ({ ...prev, recPlatform: detected }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedInstitute?.id || !selectedClass?.id || !selectedSubject?.id || !user?.id) {
      toast({
        title: "Error",
        description: "Please select an institute, class, and subject before creating a lecture",
        variant: "destructive",
      });
      return;
    }

    if (!canCreate) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to create lectures. Only Institute Admins and Teachers can create lectures.",
        variant: "destructive"
      });
      return;
    }

    const errors: Record<string, string> = {};
    if (!formData.title || !String(formData.title).trim()) errors.title = 'Title is required';
    if (!formData.venue || !String(formData.venue).trim()) errors.venue = 'Venue is required';
    if (!formData.timeStart) errors.timeStart = 'Time Start is required';
    if (!formData.timeEnd) errors.timeEnd = 'Time End is required';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      const lectureData = {
        instituteId: selectedInstitute.id,
        classId: selectedClass.id,
        subjectId: selectedSubject.id,
        instructorId: user.id,
        title: formData.title,
        description: formData.description,
        lectureType: formData.mode as 'online' | 'physical',
        venue: formData.venue,
        startTime: formData.timeStart,
        endTime: formData.timeEnd,
        status: 'scheduled' as const,
        meetingLink: formData.liveLink || undefined,
        meetingId: formData.meetingId || undefined,
        recordingUrl: formData.recordingUrl || undefined,
        maxParticipants: formData.maxParticipants,
        meetingPassword: formData.meetingPassword || undefined,
        isRecorded: !!formData.recordingUrl,
        isActive: formData.isPublic,
        materials: materials.length > 0 ? materials : undefined,
        thumbnailUrl: thumbnailUrl || undefined,
        liveAttendanceEnabled: trackingData.liveAttendanceEnabled,
        liveAccessLevel: trackingData.liveAccessLevel,
        livePaymentId: trackingData.livePaymentId,
        recAttendanceEnabled: trackingData.recAttendanceEnabled,
        recPlatform: trackingData.recPlatform,
        recAccessLevel: trackingData.recAccessLevel,
        recPaymentId: trackingData.recPaymentId,
        recTrackingDays: trackingData.recTrackingDays ?? null,
        recDurationSeconds: recDurationSeconds ?? undefined,
        welcomeMessageEnabled: welcomeData.welcomeMessageEnabled,
        welcomeMessageText: welcomeData.welcomeMessageText,
        welcomeMessageVoiceEnabled: welcomeData.welcomeMessageVoiceEnabled,
      };

      console.log('Creating lecture with data:', lectureData);

      await lectureApi.createLecture(lectureData, false);

      toast({
        title: "Success",
        description: `Lecture created successfully`,
      });

      // Call onSuccess first to close dialog and refresh
      if (onSuccess) {
        await onSuccess();
      }

      // Reset form after success callback
      setFormData({
        title: '',
        description: '',
        venue: '',
        mode: 'online',
        timeStart: '',
        timeEnd: '',
        isPublic: true,
        liveLink: '',
        recordingUrl: '',
        maxParticipants: 30,
        meetingId: '',
        meetingPassword: ''
      });
      setMaterials([]);
      setThumbnailUrl('');
      setRecDurationSeconds(undefined);
      setTrackingData({ liveAttendanceEnabled: false, liveAccessLevel: 'ENROLLED_ONLY', recAttendanceEnabled: false, recPlatform: 'SYSTEM', recAccessLevel: 'ENROLLED_ONLY', recTrackingDays: null });
      setWelcomeData({ welcomeMessageEnabled: false, welcomeMessageText: '', welcomeMessageVoiceEnabled: false });
    } catch (error: any) {
      console.error('Error creating lecture:', error);
      toast({
        title: "Error",
        description: "Failed to create lecture. Please try again.",
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
            Create New Lecture
          </CardTitle>
          <CardDescription>
            Create a new lecture for the Course Lectures section
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title">Lecture Title</Label>
                <Input
                  id="title"
                  placeholder="Enter lecture title..."
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  required
                  className={`${fieldErrors.title ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />

                {fieldErrors.title && <p className="text-xs text-red-500 mt-1">{fieldErrors.title}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="mode">Mode</Label>
                <Select value={formData.mode} onValueChange={(value) => handleInputChange('mode', value)}>
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
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter lecture description..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue">Venue</Label>
              <Input
                id="venue"
                placeholder={formData.mode === 'online' ? "Online platform (e.g., Zoom, Teams)" : "Physical location"}
                value={formData.venue}
                onChange={(e) => handleInputChange('venue', e.target.value)}
                required
                className={`${fieldErrors.venue ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />

              {fieldErrors.venue && <p className="text-xs text-red-500 mt-1">{fieldErrors.venue}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="timeStart" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Start Time
                </Label>
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
                <Label htmlFor="timeEnd" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  End Time
                </Label>
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

            <div className="flex items-center space-x-2">
              <Switch
                id="isPublic"
                checked={formData.isPublic}
                onCheckedChange={(checked) => handleInputChange('isPublic', checked)}
              />
              <Label htmlFor="isPublic" className="text-sm font-medium">
                Make this lecture public
              </Label>
            </div>

            {formData.mode === 'online' && (
              <div className="space-y-2">
                <Label htmlFor="liveLink">Live Session Link (Optional)</Label>
                <Input
                  id="liveLink"
                  placeholder="https://zoom.us/j/... or meeting link"
                  value={formData.liveLink}
                  onChange={(e) => handleInputChange('liveLink', e.target.value)}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="maxParticipants">Max Participants</Label>
                <Input
                  id="maxParticipants"
                  type="number"
                  min="1"
                  placeholder="30"
                  value={formData.maxParticipants}
                  onChange={(e) => handleInputChange('maxParticipants', parseInt(e.target.value) || 30)}
                />
              </div>

              {formData.mode === 'online' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="meetingPassword">Meeting Password (Optional)</Label>
                    <Input
                      id="meetingPassword"
                      placeholder="Password for the meeting"
                      value={formData.meetingPassword}
                      onChange={(e) => handleInputChange('meetingPassword', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meetingId">Meeting ID (Optional)</Label>
                    <Input
                      id="meetingId"
                      placeholder="Enter meeting ID"
                      value={formData.meetingId}
                      onChange={(e) => handleInputChange('meetingId', e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="recordingUrl">Recording URL (Optional)</Label>
              <Input
                id="recordingUrl"
                placeholder="https://... (can be added later)"
                value={formData.recordingUrl}
                onChange={(e) => handleInputChange('recordingUrl', e.target.value)}
              />
            </div>

            <DurationInput
              label="Recording Duration (Optional)"
              value={recDurationSeconds}
              onChange={setRecDurationSeconds}
              disabled={isLoading}
            />

            <LectureThumbnailUpload
              thumbnailUrl={thumbnailUrl}
              onChange={setThumbnailUrl}
              disabled={isLoading}
            />

            <LectureTrackingSettings
              data={trackingData}
              onChange={setTrackingData}
              showPayments={true}
              instituteId={selectedInstitute?.id?.toString()}
              classId={selectedClass?.id?.toString()}
              scope="subject"
            />

            <LectureWelcomeMessageSettings
              data={welcomeData}
              onChange={setWelcomeData}
            />

            <LectureMaterialsSection
              materials={materials}
              onChange={setMaterials}
              instituteId={selectedInstitute?.id}
              subjectName={selectedSubject?.name}
              disabled={isLoading}
            />

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? 'Creating...' : 'Create Lecture'}
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

export default CreateLectureForm;