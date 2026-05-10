import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Video, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { lectureApi } from '@/api/lecture.api';

const UpdateLecture = () => {
  const { instituteId, classId, subjectId, lectureId } = useParams<{ 
    instituteId: string;
    classId: string;
    subjectId: string;
    lectureId: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userRole = useInstituteRole();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetchingLecture, setFetchingLecture] = useState(true);
  const [lecture, setLecture] = useState<any>(null);

  // Check if user has permission to update lectures - Teachers only
  const canUpdate = userRole === 'Teacher';

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    lectureType: 'online',
    venue: '',
    startTime: '',
    endTime: '',
    status: 'scheduled',
    meetingLink: '',
    meetingId: '',
    meetingPassword: '',
    recordingUrl: '',
    isRecorded: false,
    maxParticipants: 50,
    isActive: true
  });

  useEffect(() => {
    if (!canUpdate) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to update lectures. This feature is only available for Teachers.",
        variant: "destructive"
      });
      navigate('/lectures');
      return;
    }

    if (!lectureId) {
      toast({
        title: "Error",
        description: "Lecture ID is required.",
        variant: "destructive"
      });
      navigate('/lectures');
      return;
    }

    fetchLecture();
  }, [lectureId, canUpdate, navigate]);

  const fetchLecture = async () => {
    try {
      setFetchingLecture(true);
      const lectureData = await lectureApi.getLectureById(lectureId!);
      setLecture(lectureData);
      
      // Populate form data
      setFormData({
        title: lectureData.title || '',
        description: lectureData.description || '',
        lectureType: lectureData.lectureType || 'online',
        venue: lectureData.venue || '',
        startTime: lectureData.startTime ? new Date(lectureData.startTime).toISOString().slice(0, 16) : '',
        endTime: lectureData.endTime ? new Date(lectureData.endTime).toISOString().slice(0, 16) : '',
        status: lectureData.status || 'scheduled',
        meetingLink: lectureData.meetingLink || '',
        meetingId: lectureData.meetingId || '',
        meetingPassword: lectureData.meetingPassword || '',
        recordingUrl: lectureData.recordingUrl || '',
        isRecorded: lectureData.isRecorded ?? false,
        maxParticipants: lectureData.maxParticipants || 50,
        isActive: lectureData.isActive ?? true
      });
    } catch (error: any) {
      console.error('Error fetching lecture:', error);
      toast({
        title: "Error",
        description: "Failed to fetch lecture details.",
        variant: "destructive"
      });
      navigate('/lectures');
    } finally {
      setFetchingLecture(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        venue: formData.venue || null,
        startTime: formData.startTime ? new Date(formData.startTime).toISOString() : null,
        endTime: formData.endTime ? new Date(formData.endTime).toISOString() : null,
        status: formData.status as 'scheduled' | 'ongoing' | 'completed' | 'cancelled' | 'postponed',
        meetingLink: formData.meetingLink || null,
        meetingId: formData.meetingId || null,
        meetingPassword: formData.meetingPassword || null,
        recordingUrl: formData.recordingUrl || null,
        isRecorded: formData.isRecorded,
        maxParticipants: formData.maxParticipants,
        isActive: formData.isActive
      };

      await lectureApi.updateLecture(lectureId!, payload, {
        instituteId: lecture?.instituteId,
        classId: lecture?.classId,
        subjectId: lecture?.subjectId
      });
      
      toast({
        title: "Success",
        description: "Lecture updated successfully"
      });
      
      navigate('/lectures');
    } catch (error: any) {
      console.error('Error updating lecture:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update lecture",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (fetchingLecture) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Loading Lecture...
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/lectures')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Lectures
        </Button>
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Update Lecture
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Update lecture details and information
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lecture Information</CardTitle>
          <CardDescription>Update the lecture details below</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter lecture title"
                  required
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
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

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter lecture description"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startTime">Start Time *</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => handleInputChange('startTime', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="endTime">End Time *</Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={formData.endTime}
                  onChange={(e) => handleInputChange('endTime', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="venue">Venue</Label>
                <Input
                  id="venue"
                  value={formData.venue}
                  onChange={(e) => handleInputChange('venue', e.target.value)}
                  placeholder={formData.lectureType === 'online' ? 'Online Platform' : 'Physical Location'}
                />
              </div>
              <div>
                <Label htmlFor="maxParticipants">Max Participants</Label>
                <Input
                  id="maxParticipants"
                  type="number"
                  value={formData.maxParticipants}
                  onChange={(e) => handleInputChange('maxParticipants', parseInt(e.target.value))}
                  min="1"
                />
              </div>
            </div>

            {formData.lectureType === 'online' && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-medium">Online Meeting Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="meetingLink">Meeting Link</Label>
                    <Input
                      id="meetingLink"
                      value={formData.meetingLink}
                      onChange={(e) => handleInputChange('meetingLink', e.target.value)}
                      placeholder="https://zoom.us/j/..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="meetingId">Meeting ID</Label>
                    <Input
                      id="meetingId"
                      value={formData.meetingId}
                      onChange={(e) => handleInputChange('meetingId', e.target.value)}
                      placeholder="Meeting ID"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="meetingPassword">Meeting Password</Label>
                    <Input
                      id="meetingPassword"
                      value={formData.meetingPassword}
                      onChange={(e) => handleInputChange('meetingPassword', e.target.value)}
                      placeholder="Optional meeting password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="recordingUrl">Recording URL</Label>
                    <Input
                      id="recordingUrl"
                      value={formData.recordingUrl}
                      onChange={(e) => handleInputChange('recordingUrl', e.target.value)}
                      placeholder="Recording URL (if available)"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isRecorded"
                    checked={formData.isRecorded}
                    onChange={(e) => handleInputChange('isRecorded', e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="isRecorded">Session is recorded</Label>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate('/lectures')} 
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Updating...' : 'Update Lecture'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UpdateLecture;