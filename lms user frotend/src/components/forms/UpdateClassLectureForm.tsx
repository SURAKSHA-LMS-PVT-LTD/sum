import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Video } from 'lucide-react';
import { lectureApi, Lecture } from '@/api/lecture.api';
import { useAuth } from '@/contexts/AuthContext';
import { getErrorMessage } from '@/api/apiError';
import LectureMaterialsSection, { LectureMaterial } from '@/components/common/LectureMaterialsSection';
import LectureThumbnailUpload from '@/components/common/LectureThumbnailUpload';
import LectureTrackingSettings, { TrackingSettingsData } from '@/components/common/LectureTrackingSettings';
import LectureWelcomeMessageSettings, { WelcomeMessageSettingsData } from '@/components/common/LectureWelcomeMessageSettings';
import LectureUrlPanel from '@/components/common/LectureUrlPanel';

const Req = () => <span className="text-red-500 ml-0.5">*</span>;
const Opt = () => <span className="text-xs font-normal text-muted-foreground ml-1">(optional)</span>;

interface UpdateClassLectureFormProps {
  lecture: Lecture;
  onClose?: () => void;
  onSuccess?: () => void | Promise<void>;
}

const VALID_LECTURE_TYPES = ['online', 'physical', 'hybrid'] as const;
type LectureTypeOpt = typeof VALID_LECTURE_TYPES[number];

const normalizeLectureType = (raw: any): LectureTypeOpt => {
  if (!raw) return 'physical';
  const lt = String(raw).trim().toLowerCase();
  if ((VALID_LECTURE_TYPES as readonly string[]).includes(lt)) return lt as LectureTypeOpt;
  if (lt === 'live' || lt === 'virtual' || lt === 'remote') return 'online';
  if (lt === 'in-person' || lt === 'inperson' || lt === 'classroom' || lt === 'offline') return 'physical';
  if (lt === 'mixed' || lt === 'blended') return 'hybrid';
  return 'physical';
};

const buildInitialFormData = (lecture: Lecture) => ({
  title: lecture?.title || '',
  description: lecture?.description || '',
  venue: lecture?.venue || '',
  lectureType: normalizeLectureType(lecture?.lectureType),
  subject: lecture?.subject || '',
  startTime: lecture?.startTime ? lecture.startTime.slice(0, 16) : '',
  endTime: lecture?.endTime ? lecture.endTime.slice(0, 16) : '',
  status: ((lecture?.status as any) || 'scheduled') as 'scheduled' | 'ongoing' | 'completed' | 'cancelled',
  meetingLink: lecture?.meetingLink || '',
  meetingId: lecture?.meetingId || '',
  meetingPassword: lecture?.meetingPassword || '',
  recordingUrl: lecture?.recordingUrl || '',
  maxParticipants: lecture?.maxParticipants || 50,
  isActive: lecture?.isActive ?? true,
});

const UpdateClassLectureForm = ({ lecture, onClose, onSuccess }: UpdateClassLectureFormProps) => {
  const [formData, setFormData] = useState(() => buildInitialFormData(lecture));
  const [trackingData, setTrackingData] = useState<TrackingSettingsData>({
    liveAttendanceEnabled: lecture.liveAttendanceEnabled ?? false,
    liveAccessLevel: lecture.liveAccessLevel ?? 'ENROLLED_ONLY',
    livePaymentId: lecture.livePaymentId,
    recAttendanceEnabled: lecture.recAttendanceEnabled ?? false,
    recPlatform: lecture.recPlatform ?? 'SYSTEM',
    recAccessLevel: lecture.recAccessLevel ?? 'ENROLLED_ONLY',
    recPaymentId: lecture.recPaymentId,
  });
  const [welcomeData, setWelcomeData] = useState<WelcomeMessageSettingsData>({
    welcomeMessageEnabled: lecture.welcomeMessageEnabled ?? false,
    welcomeMessageText: lecture.welcomeMessageText || '',
    welcomeMessageVoiceEnabled: lecture.welcomeMessageVoiceEnabled ?? false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [materials, setMaterials] = useState<LectureMaterial[]>(
    Array.isArray(lecture.materials) ? (lecture.materials as LectureMaterial[]) : []
  );
  const [thumbnailUrl, setThumbnailUrl] = useState(lecture.thumbnailUrl || '');
  const { toast } = useToast();
  const { selectedInstitute, selectedClass } = useAuth();

  useEffect(() => {
    if (lecture) {
      setFormData(buildInitialFormData(lecture));
      setThumbnailUrl(lecture.thumbnailUrl || '');
      setMaterials(Array.isArray(lecture.materials) ? (lecture.materials as LectureMaterial[]) : []);
      setTrackingData({
        liveAttendanceEnabled: lecture.liveAttendanceEnabled ?? false,
        liveAccessLevel: lecture.liveAccessLevel ?? 'ENROLLED_ONLY',
        livePaymentId: lecture.livePaymentId,
        recAttendanceEnabled: lecture.recAttendanceEnabled ?? false,
        recPlatform: lecture.recPlatform ?? 'SYSTEM',
        recAccessLevel: lecture.recAccessLevel ?? 'ENROLLED_ONLY',
        recPaymentId: lecture.recPaymentId,
      });
      setWelcomeData({
        welcomeMessageEnabled: lecture.welcomeMessageEnabled ?? false,
        welcomeMessageText: lecture.welcomeMessageText || '',
        welcomeMessageVoiceEnabled: lecture.welcomeMessageVoiceEnabled ?? false,
      });
    }
  }, [lecture]);

  const handleInputChange = (field: string, value: string | boolean | number) => {
    setFieldErrors(prev => ({ ...prev, [field]: '' }));
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const context = {
    instituteId: selectedInstitute?.id?.toString(),
    classId: selectedClass?.id?.toString(),
  };

  // ── Full update ──────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: Record<string, string> = {};
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (!formData.startTime) errors.startTime = 'Start time is required';
    if (!formData.endTime) errors.endTime = 'End time is required';
    if (formData.startTime && formData.endTime && new Date(formData.endTime) <= new Date(formData.startTime)) {
      errors.endTime = 'End time must be after start time';
    }
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }

    setIsLoading(true);
    try {
      const payload: any = {
        title: formData.title,
        description: formData.description || null,
        lectureType: formData.lectureType,
        venue: formData.venue || null,
        subject: formData.subject || null,
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
        status: formData.status,
        meetingLink: formData.meetingLink || null,
        meetingId: formData.meetingId || null,
        meetingPassword: formData.meetingPassword || null,
        recordingUrl: formData.recordingUrl || null,
        isRecorded: !!formData.recordingUrl,
        maxParticipants: formData.maxParticipants,
        isActive: formData.isActive,
        materials: materials.length > 0 ? materials : [],
        thumbnailUrl: thumbnailUrl || null,
        liveAttendanceEnabled: trackingData.liveAttendanceEnabled,
        liveAccessLevel: trackingData.liveAccessLevel,
        livePaymentId: trackingData.livePaymentId,
        recAttendanceEnabled: trackingData.recAttendanceEnabled,
        recPlatform: trackingData.recPlatform,
        recAccessLevel: trackingData.recAccessLevel,
        recPaymentId: trackingData.recPaymentId,
        welcomeMessageEnabled: welcomeData.welcomeMessageEnabled,
        welcomeMessageText: welcomeData.welcomeMessageText || null,
        welcomeMessageVoiceEnabled: welcomeData.welcomeMessageVoiceEnabled,
      };

      await lectureApi.updateLecture(lecture.id, payload, context);

      toast({ title: 'Lecture updated', description: `"${formData.title}" has been updated successfully.` });
      if (onSuccess) await onSuccess();
      if (onClose) onClose();
    } catch (error) {
      toast({ title: 'Update failed', description: getErrorMessage(error, 'Please try again.'), variant: 'destructive' });
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

      {/* ── Full update form ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Update Class Lecture
          </CardTitle>
          <CardDescription>
            Editing: <span className="font-medium text-foreground">{lecture.title}</span>
            {selectedClass ? ` · ${selectedClass.name}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <LectureUrlPanel
              liveAttendanceEnabled={lecture.liveAttendanceEnabled}
              liveUrlId={lecture.liveUrlId}
              recAttendanceEnabled={lecture.recAttendanceEnabled}
              recUrlId={lecture.recUrlId}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Lecture Title<Req /></Label>
                <Input id="title" placeholder="Enter lecture title…"
                  value={formData.title} onChange={(e) => handleInputChange('title', e.target.value)}
                  className={fieldErrors.title ? 'border-red-500' : ''} />
                {fieldErrors.title && <p className="text-xs text-red-500">{fieldErrors.title}</p>}
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="subject">Subject<Opt /></Label>
                <Input id="subject" placeholder="e.g. Mathematics, General Assembly…"
                  value={formData.subject} onChange={(e) => handleInputChange('subject', e.target.value)} />
              </div>

              {/* Lecture Type */}
              <div className="space-y-2">
                <Label>Lecture Type<Req /></Label>
                <Select value={formData.lectureType} onValueChange={(v) => handleInputChange('lectureType', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physical">Physical</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Venue */}
              <div className="space-y-2">
                <Label htmlFor="venue">Venue<Opt /></Label>
                <Input id="venue" placeholder="Room number or location…"
                  value={formData.venue} onChange={(e) => handleInputChange('venue', e.target.value)} />
              </div>

              {/* Start Time */}
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time<Req /></Label>
                <Input id="startTime" type="datetime-local" value={formData.startTime}
                  onChange={(e) => handleInputChange('startTime', e.target.value)}
                  className={fieldErrors.startTime ? 'border-red-500' : ''} />
                {fieldErrors.startTime && <p className="text-xs text-red-500">{fieldErrors.startTime}</p>}
              </div>

              {/* End Time */}
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time<Req /></Label>
                <Input id="endTime" type="datetime-local" value={formData.endTime}
                  onChange={(e) => handleInputChange('endTime', e.target.value)}
                  className={fieldErrors.endTime ? 'border-red-500' : ''} />
                {fieldErrors.endTime && <p className="text-xs text-red-500">{fieldErrors.endTime}</p>}
              </div>

              {/* Max Participants */}
              <div className="space-y-2">
                <Label htmlFor="maxParticipants">Max Participants<Opt /></Label>
                <Input id="maxParticipants" type="number" min={1}
                  value={formData.maxParticipants}
                  onChange={(e) => handleInputChange('maxParticipants', parseInt(e.target.value) || 50)} />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => handleInputChange('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="ongoing">Ongoing (Live)</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description<Opt /></Label>
              <Textarea id="description" placeholder="Lecture description…" rows={3}
                value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} />
            </div>

            {/* Online fields */}
            {(formData.lectureType === 'online' || formData.lectureType === 'hybrid') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-lg border border-blue-200/60 bg-blue-50/30 dark:bg-blue-950/10">
                <div className="space-y-2">
                  <Label htmlFor="meetingLink">Meeting Link<Opt /></Label>
                  <Input id="meetingLink" placeholder="https://meet.google.com/…"
                    value={formData.meetingLink} onChange={(e) => handleInputChange('meetingLink', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meetingId">Meeting ID<Opt /></Label>
                  <Input id="meetingId" placeholder="Meeting ID…"
                    value={formData.meetingId} onChange={(e) => handleInputChange('meetingId', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meetingPassword">Meeting Password<Opt /></Label>
                  <Input id="meetingPassword" placeholder="Password…"
                    value={formData.meetingPassword} onChange={(e) => handleInputChange('meetingPassword', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recordingUrl">Recording URL<Opt /></Label>
                  <Input id="recordingUrl" placeholder="https://…"
                    value={formData.recordingUrl} onChange={(e) => handleInputChange('recordingUrl', e.target.value)} />
                </div>
              </div>
            )}

            {/* Thumbnail */}
            <LectureThumbnailUpload
              thumbnailUrl={thumbnailUrl}
              onChange={setThumbnailUrl}
              disabled={isLoading}
            />

            <LectureTrackingSettings
              data={trackingData}
              onChange={setTrackingData}
              showPayments={true}
              instituteId={context.instituteId}
              classId={context.classId}
              paymentType="class"
              scope="class"
            />

            <LectureWelcomeMessageSettings
              data={welcomeData}
              onChange={setWelcomeData}
            />

            {/* Materials */}
            <LectureMaterialsSection
              materials={materials}
              onChange={setMaterials}
              disabled={isLoading}
              instituteId={selectedInstitute?.id?.toString()}
              className={selectedClass?.name}
              subjectName={formData.subject || undefined}
            />

            {/* isActive */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="isActive" className="text-sm font-medium">Active</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Inactive lectures are hidden from students.</p>
              </div>
              <Switch id="isActive" checked={formData.isActive}
                onCheckedChange={(v) => handleInputChange('isActive', v)} />
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2">
              {onClose && (
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UpdateClassLectureForm;
