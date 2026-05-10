import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Video } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { lectureApi } from '@/api/lecture.api';
import LectureMaterialsSection, { LectureMaterial } from '@/components/common/LectureMaterialsSection';
import LectureThumbnailUpload from '@/components/common/LectureThumbnailUpload';
import LectureTrackingSettings, { TrackingSettingsData } from '@/components/common/LectureTrackingSettings';
import LectureWelcomeMessageSettings, { WelcomeMessageSettingsData } from '@/components/common/LectureWelcomeMessageSettings';

interface CreateClassLectureFormProps {
  onClose?: () => void;
  onSuccess?: () => void | Promise<void>;
}

const CreateClassLectureForm = ({ onClose, onSuccess }: CreateClassLectureFormProps) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    venue: '',
    subject: '',
    mode: 'physical' as 'online' | 'physical' | 'hybrid',
    timeStart: '',
    timeEnd: '',
    liveLink: '',
    recordingUrl: '',
    maxParticipants: 50,
    meetingId: '',
    meetingPassword: '',
    status: 'scheduled' as 'scheduled' | 'ongoing' | 'completed' | 'cancelled',
    isActive: true,
  });
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
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [materials, setMaterials] = useState<LectureMaterial[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const { toast } = useToast();
  const { user, selectedInstitute, selectedClass } = useAuth();
  const instituteRole = useInstituteRole();

  const canCreate = instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher';

  const handleInputChange = (field: string, value: string | boolean | number) => {
    setFieldErrors(prev => ({ ...prev, [field]: '' }));
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedInstitute?.id || !selectedClass?.id || !user?.id) {
      toast({
        title: "Error",
        description: "Please select an institute and class before creating a lecture",
        variant: "destructive",
      });
      return;
    }

    if (!canCreate) {
      toast({
        title: "Access Denied",
        description: "Only Institute Admins and Teachers can create lectures.",
        variant: "destructive"
      });
      return;
    }

    const errors: Record<string, string> = {};
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (!formData.timeStart) errors.timeStart = 'Start time is required';
    if (!formData.timeEnd) errors.timeEnd = 'End time is required';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      await lectureApi.createLecture({
        instituteId: selectedInstitute.id,
        classId: selectedClass.id,
        instructorId: user.id,
        title: formData.title,
        description: formData.description || '',
        lectureType: formData.mode,
        venue: formData.venue || undefined,
        subject: formData.subject || undefined,
        startTime: formData.timeStart,
        endTime: formData.timeEnd,
        status: formData.status,
        meetingLink: formData.liveLink || undefined,
        meetingId: formData.meetingId || undefined,
        meetingPassword: formData.meetingPassword || undefined,
        recordingUrl: formData.recordingUrl || undefined,
        isRecorded: !!formData.recordingUrl,
        maxParticipants: formData.maxParticipants,
        isActive: formData.isActive,
        materials: materials.length > 0 ? materials : undefined,
        thumbnailUrl: thumbnailUrl || undefined,
        liveAttendanceEnabled: trackingData.liveAttendanceEnabled,
        liveAccessLevel: trackingData.liveAccessLevel,
        livePaymentId: trackingData.livePaymentId,
        recAttendanceEnabled: trackingData.recAttendanceEnabled,
        recPlatform: trackingData.recPlatform,
        recAccessLevel: trackingData.recAccessLevel,
        recPaymentId: trackingData.recPaymentId,
        welcomeMessageEnabled: welcomeData.welcomeMessageEnabled,
        welcomeMessageText: welcomeData.welcomeMessageText,
        welcomeMessageVoiceEnabled: welcomeData.welcomeMessageVoiceEnabled,
      } as any);

      toast({ title: "Success", description: "Class lecture created successfully" });

      if (onSuccess) await onSuccess();

      setFormData({
        title: '', description: '', venue: '', subject: '',
        mode: 'physical', timeStart: '', timeEnd: '', liveLink: '',
        recordingUrl: '', maxParticipants: 50, meetingId: '',
        meetingPassword: '', status: 'scheduled', isActive: true,
      });
      setMaterials([]);
      setThumbnailUrl('');
      setWelcomeData({ welcomeMessageEnabled: false, welcomeMessageText: '', welcomeMessageVoiceEnabled: false });
    } catch (error: any) {
      console.error('Error creating class lecture:', error);
      toast({
        title: "Error",
        description: "Failed to create class lecture. Please try again.",
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
            Create Class Lecture
          </CardTitle>
          <CardDescription>
            Create a lecture visible to all members of {selectedClass?.name || 'this class'} (not filtered by subject)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title">Lecture Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter lecture title..."
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className={fieldErrors.title ? 'border-red-500' : ''}
                />
                {fieldErrors.title && <p className="text-xs text-red-500 mt-1">{fieldErrors.title}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject (optional)</Label>
                <Input
                  id="subject"
                  placeholder="e.g. Mathematics, General Assembly..."
                  value={formData.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mode">Lecture Type *</Label>
                <Select value={formData.mode} onValueChange={(v) => handleInputChange('mode', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physical">Physical</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="venue">Venue</Label>
                <Input
                  id="venue"
                  placeholder="Room number or location..."
                  value={formData.venue}
                  onChange={(e) => handleInputChange('venue', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeStart">Start Time *</Label>
                <Input
                  id="timeStart"
                  type="datetime-local"
                  value={formData.timeStart}
                  onChange={(e) => handleInputChange('timeStart', e.target.value)}
                  className={fieldErrors.timeStart ? 'border-red-500' : ''}
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
                  className={fieldErrors.timeEnd ? 'border-red-500' : ''}
                />
                {fieldErrors.timeEnd && <p className="text-xs text-red-500 mt-1">{fieldErrors.timeEnd}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(v) => handleInputChange('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxParticipants">Max Participants</Label>
                <Input
                  id="maxParticipants"
                  type="number"
                  min={1}
                  max={10000}
                  value={formData.maxParticipants}
                  onChange={(e) => handleInputChange('maxParticipants', parseInt(e.target.value) || 50)}
                />
              </div>
            </div>

            {(formData.mode === 'online' || formData.mode === 'hybrid') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="liveLink">Meeting Link</Label>
                  <Input
                    id="liveLink"
                    placeholder="https://meet.google.com/..."
                    value={formData.liveLink}
                    onChange={(e) => handleInputChange('liveLink', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meetingId">Meeting ID</Label>
                  <Input
                    id="meetingId"
                    placeholder="Meeting ID..."
                    value={formData.meetingId}
                    onChange={(e) => handleInputChange('meetingId', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meetingPassword">Meeting Password</Label>
                  <Input
                    id="meetingPassword"
                    type="password"
                    placeholder="Meeting password..."
                    value={formData.meetingPassword}
                    onChange={(e) => handleInputChange('meetingPassword', e.target.value)}
                  />
                </div>
              </div>
            )}

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
              <Label htmlFor="recordingUrl">Recording URL</Label>
              <Input
                id="recordingUrl"
                placeholder="https://..."
                value={formData.recordingUrl}
                onChange={(e) => handleInputChange('recordingUrl', e.target.value)}
              />
            </div>

            <LectureThumbnailUpload
              thumbnailUrl={thumbnailUrl}
              onChange={setThumbnailUrl}
            />

            <LectureTrackingSettings
              data={trackingData}
              onChange={setTrackingData}
              showPayments={true}
              instituteId={selectedInstitute?.id?.toString()}
              classId={selectedClass?.id?.toString()}
              paymentType="class"
            />

            <LectureWelcomeMessageSettings
              data={welcomeData}
              onChange={setWelcomeData}
            />

            <LectureMaterialsSection
              materials={materials}
              onChange={setMaterials}
              instituteId={selectedInstitute?.id?.toString()}
              className={selectedClass?.name}
              subjectName={formData.subject || undefined}
            />

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(v) => handleInputChange('isActive', v)}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>

            <div className="flex gap-3 pt-4">
              {onClose && (
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isLoading || !canCreate}>
                {isLoading ? 'Creating...' : 'Create Class Lecture'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateClassLectureForm;
