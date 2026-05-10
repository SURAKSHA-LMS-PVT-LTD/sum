import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/api/apiError';

interface CreateExamFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateExamForm = ({ onClose, onSuccess }: CreateExamFormProps) => {
  const { user, currentInstituteId, currentClassId, currentSubjectId } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const instituteRole = useInstituteRole();

  // Check if user has permission to create exams - InstituteAdmin and Teachers
  const canCreate = instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher';

  // Handle access denial in useEffect to avoid side effects during render
  React.useEffect(() => {
    if (!canCreate) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to create exams. This feature is only available for Institute Admins and Teachers.",
        variant: "destructive"
      });
      onClose();
    }
  }, [canCreate]);

  if (!canCreate) {
    return null;
  }

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    examType: 'online',
    duration: 120,
    maxMarks: 100,
    passingMarks: 40,
    examDate: '',
    startTime: '',
    endTime: '',
    venue: '',
    examLink: '',
    instructions: '',
    status: 'scheduled',
    toWhom: 'everyone',
    isActive: true
  });

  const handleInputChange = (field: string, value: any) => {
    setFieldErrors(prev => ({ ...prev, [field]: '' }));

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentInstituteId || !currentClassId || !currentSubjectId) {
      toast({
        title: "Missing Selection",
        description: "Please select institute, class, and subject first.",
        variant: "destructive"
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Authentication Error",
        description: "User not authenticated.",
        variant: "destructive"
      });
      return;
    }

        const errors: Record<string, string> = {};
    if (!formData.title) errors.title = 'Title is required';
    if (!formData.description) errors.description = 'Description is required';
    if (!formData.duration) errors.duration = 'Duration is required';
    if (!formData.maxMarks) errors.maxMarks = 'Max Marks is required';
    if (!formData.passingMarks) errors.passingMarks = 'Passing Marks is required';
    if (!formData.examDate) errors.examDate = 'Exam Date is required';
    if (!formData.startTime) errors.startTime = 'Start Time is required';
    if (!formData.endTime) errors.endTime = 'End Time is required';
    if (!formData.venue) errors.venue = 'Venue is required';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    
    try {
      const examData = {
        instituteId: currentInstituteId,
        classId: currentClassId,
        subjectId: currentSubjectId,
        title: formData.title,
        description: formData.description,
        examType: formData.examType,
        duration: formData.duration,
        maxMarks: formData.maxMarks,
        passingMarks: formData.passingMarks,
        examDate: formData.examDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        venue: formData.venue,
        examLink: formData.examLink,
        instructions: formData.instructions,
        status: formData.status,
        createdBy: user.id,
        toWhom: formData.toWhom,
        isActive: formData.isActive
      };

      console.log('Creating exam with data:', examData);
      
      const response = await apiClient.post('/institute-class-subject-exams', examData);
      
      console.log('Exam created successfully:', response.data);
      
      toast({
        title: "Exam Created",
        description: `Exam "${formData.title}" has been created successfully.`
      });
      
      onSuccess();
    } catch (error: any) {
      console.error('Error creating exam:', error);
      toast({
        title: "Creation Failed",
        description: getErrorMessage(error, 'Failed to create exam.'),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Basic Information */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg sm:text-xl">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title" className="text-sm font-medium">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter exam title"
                  className={`mt-1${fieldErrors.title ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  required
                />

                {fieldErrors.title && <p className="text-xs text-red-500 mt-1">{fieldErrors.title}</p>}
              </div>

              <div>
                <Label htmlFor="description" className="text-sm font-medium">Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter exam description"
                  rows={3}
                  className={`mt-1 resize-none${fieldErrors.description ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  required
                />

                {fieldErrors.description && <p className="text-xs text-red-500 mt-1">{fieldErrors.description}</p>}
              </div>

              <div>
                <Label htmlFor="examType" className="text-sm font-medium">Exam Type *</Label>
                <Select value={formData.examType} onValueChange={(value) => handleInputChange('examType', value)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select exam type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="physical">Physical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="duration" className="text-sm font-medium">Duration (minutes) *</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    value={formData.duration}
                    onChange={(e) => handleInputChange('duration', parseInt(e.target.value))}
                    className={`mt-1${fieldErrors.duration ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                    required
                  />

                  {fieldErrors.duration && <p className="text-xs text-red-500 mt-1">{fieldErrors.duration}</p>}
                </div>
                <div>
                  <Label htmlFor="maxMarks" className="text-sm font-medium">Max Marks *</Label>
                  <Input
                    id="maxMarks"
                    type="number"
                    min="1"
                    value={formData.maxMarks}
                    onChange={(e) => handleInputChange('maxMarks', parseInt(e.target.value))}
                    className={`mt-1${fieldErrors.maxMarks ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                    required
                  />

                  {fieldErrors.maxMarks && <p className="text-xs text-red-500 mt-1">{fieldErrors.maxMarks}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="passingMarks" className="text-sm font-medium">Passing Marks *</Label>
                <Input
                  id="passingMarks"
                  type="number"
                  min="1"
                  value={formData.passingMarks}
                  onChange={(e) => handleInputChange('passingMarks', parseInt(e.target.value))}
                  className={`mt-1${fieldErrors.passingMarks ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  required
                />

                {fieldErrors.passingMarks && <p className="text-xs text-red-500 mt-1">{fieldErrors.passingMarks}</p>}
              </div>
            </CardContent>
          </Card>

          {/* Schedule & Venue */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg sm:text-xl">Schedule & Venue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="examDate" className="text-sm font-medium">Exam Date *</Label>
                <Input
                  id="examDate"
                  type="date"
                  value={formData.examDate}
                  onChange={(e) => handleInputChange('examDate', e.target.value)}
                  className={`mt-1${fieldErrors.examDate ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  required
                />

                {fieldErrors.examDate && <p className="text-xs text-red-500 mt-1">{fieldErrors.examDate}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime" className="text-sm font-medium">Start Time *</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => handleInputChange('startTime', e.target.value)}
                    className={`mt-1${fieldErrors.startTime ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                    required
                  />

                  {fieldErrors.startTime && <p className="text-xs text-red-500 mt-1">{fieldErrors.startTime}</p>}
                </div>
                <div>
                  <Label htmlFor="endTime" className="text-sm font-medium">End Time *</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => handleInputChange('endTime', e.target.value)}
                    className={`mt-1${fieldErrors.endTime ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                    required
                  />

                  {fieldErrors.endTime && <p className="text-xs text-red-500 mt-1">{fieldErrors.endTime}</p>}
                </div>
              </div>

              <div>
                <Label htmlFor="venue" className="text-sm font-medium">Venue *</Label>
                <Input
                  id="venue"
                  value={formData.venue}
                  onChange={(e) => handleInputChange('venue', e.target.value)}
                  placeholder="Enter exam venue"
                  className={`mt-1${fieldErrors.venue ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  required
                />

                {fieldErrors.venue && <p className="text-xs text-red-500 mt-1">{fieldErrors.venue}</p>}
              </div>

              <div>
                <Label htmlFor="examLink" className="text-sm font-medium">Exam Link</Label>
                <Input
                  id="examLink"
                  type="url"
                  value={formData.examLink}
                  onChange={(e) => handleInputChange('examLink', e.target.value)}
                  placeholder="https://exam.example.com/physics-test"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="instructions" className="text-sm font-medium">Instructions</Label>
                <Textarea
                  id="instructions"
                  value={formData.instructions}
                  onChange={(e) => handleInputChange('instructions', e.target.value)}
                  placeholder="Please bring calculator and pen"
                  rows={3}
                  className="mt-1 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="status" className="text-sm font-medium">Status *</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="toWhom" className="text-sm font-medium">Target Audience *</Label>
                  <Select value={formData.toWhom} onValueChange={(value) => handleInputChange('toWhom', value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select target audience" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="everyone">Everyone</SelectItem>
                      <SelectItem value="specific">Specific Students</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? 'Creating...' : 'Create Exam'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateExamForm;