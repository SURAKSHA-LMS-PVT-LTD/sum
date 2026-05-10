import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent } from '../ui/card';
import { toast } from '../ui/use-toast';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { examApi } from '@/api/exam.api';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/api/apiError';

interface UpdateExamFormProps {
  exam: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const UpdateExamForm: React.FC<UpdateExamFormProps> = ({ exam, onClose, onSuccess }) => {
  const instituteRole = useInstituteRole();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  // Check if user has permission to update exams - InstituteAdmin and Teachers
  const canUpdate = instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher';
  
  useEffect(() => {
    if (!canUpdate) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to update exams. This feature is only available for Institute Admins and Teachers.",
        variant: "destructive",
      });
      onClose();
    }
  }, [canUpdate]);

  if (!canUpdate) {
    return null;
  }
  
  const toDateString = (value: any): string => {
    if (!value) return '';
    try {
      const d = value instanceof Date ? value : new Date(value);
      if (isNaN(d.getTime())) return '';
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  };

  const toTimeString = (value: any): string => {
    if (!value) return '';
    try {
      const d = value instanceof Date ? value : new Date(value);
      if (isNaN(d.getTime())) return '';
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    } catch {
      return '';
    }
  };
  
  const [formData, setFormData] = useState({
    title: exam.title || '',
    description: exam.description || '',
    examType: exam.examType || 'online',
    duration: exam.durationMinutes || exam.duration || 60,
    maxMarks: exam.totalMarks || exam.maxMarks || 100,
    passingMarks: exam.passingMarks || 40,
    examDate: toDateString(exam.scheduleDate || exam.examDate),
    startTime: toTimeString(exam.startTime) || '09:00:00',
    endTime: toTimeString(exam.endTime) || '10:00:00',
    venue: exam.venue || '',
    examLink: exam.examLink || '',
    instructions: exam.instructions || '',
    status: exam.status || 'draft',
    createdBy: exam.createdBy || '',
    toWhom: exam.toWhom || 'everyone',
    isActive: exam.isActive !== undefined ? exam.isActive : true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canUpdate) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to update exams.",
        variant: "destructive",
      });
      return;
    }

        const errors: Record<string, string> = {};
    if (!formData.title) errors.title = 'Title is required';
    if (!formData.duration) errors.duration = 'Duration is required';
    if (!formData.maxMarks) errors.maxMarks = 'Max Marks is required';
    if (!formData.passingMarks) errors.passingMarks = 'Passing Marks is required';
    if (!formData.startTime) errors.startTime = 'Start Time is required';
    if (!formData.endTime) errors.endTime = 'End Time is required';
    if (!formData.description) errors.description = 'Description is required';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        instituteId: exam.instituteId,
        classId: exam.classId,
        subjectId: exam.subjectId,
        title: formData.title,
        description: formData.description,
        examType: formData.examType,
        duration: parseInt(formData.duration.toString()),
        maxMarks: parseInt(formData.maxMarks.toString()),
        passingMarks: parseInt(formData.passingMarks.toString()),
        examDate: formData.examDate,
        startTime: formData.startTime,
        endTime: formData.endTime,
        venue: formData.venue || null,
        examLink: formData.examLink || null,
        instructions: formData.instructions || null,
        status: formData.status,
        toWhom: formData.toWhom,
        isActive: formData.isActive
      };

      await examApi.updateExam(exam.id, payload);
      console.log('Exam updated successfully');

      toast({
        title: "Success",
        description: "Exam updated successfully!",
      });

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating exam:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error, 'Failed to update exam. Please try again.'),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFieldErrors(prev => ({ ...prev, [field]: '' }));

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Enter exam title"
                required
              className={`${fieldErrors.title ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />

              {fieldErrors.title && <p className="text-xs text-red-500 mt-1">{fieldErrors.title}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="examType">Exam Type *</Label>
              <Select value={formData.examType} onValueChange={(value) => handleInputChange('examType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select exam type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="physical">Physical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes) *</Label>
              <Input
                id="duration"
                type="number"
                value={formData.duration}
                onChange={(e) => handleInputChange('duration', parseInt(e.target.value))}
                placeholder="Enter duration in minutes"
                min="1"
                required
              className={`${fieldErrors.duration ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />

              {fieldErrors.duration && <p className="text-xs text-red-500 mt-1">{fieldErrors.duration}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxMarks">Total Marks *</Label>
              <Input
                id="maxMarks"
                type="number"
                value={formData.maxMarks}
                onChange={(e) => handleInputChange('maxMarks', parseInt(e.target.value))}
                placeholder="Enter total marks"
                min="1"
                required
              className={`${fieldErrors.maxMarks ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />

              {fieldErrors.maxMarks && <p className="text-xs text-red-500 mt-1">{fieldErrors.maxMarks}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="passingMarks">Passing Marks *</Label>
              <Input
                id="passingMarks"
                type="number"
                value={formData.passingMarks}
                onChange={(e) => handleInputChange('passingMarks', parseInt(e.target.value))}
                placeholder="Enter passing marks"
                min="1"
                required
              className={`${fieldErrors.passingMarks ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />

              {fieldErrors.passingMarks && <p className="text-xs text-red-500 mt-1">{fieldErrors.passingMarks}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="examDate">Exam Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.examDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.examDate ? format(new Date(formData.examDate), "PPP") : <span>Exam Date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.examDate ? new Date(formData.examDate) : undefined}
                    onSelect={(date) => handleInputChange('examDate', date ? format(date, 'yyyy-MM-dd') : '')}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="time"
                value={formData.startTime}
                onChange={(e) => handleInputChange('startTime', e.target.value)}
                required
              className={`${fieldErrors.startTime ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />

              {fieldErrors.startTime && <p className="text-xs text-red-500 mt-1">{fieldErrors.startTime}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="endTime">End Time *</Label>
              <Input
                id="endTime"
                type="time"
                value={formData.endTime}
                onChange={(e) => handleInputChange('endTime', e.target.value)}
                required
              className={`${fieldErrors.endTime ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />

              {fieldErrors.endTime && <p className="text-xs text-red-500 mt-1">{fieldErrors.endTime}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue">Venue</Label>
              <Input
                id="venue"
                value={formData.venue}
                onChange={(e) => handleInputChange('venue', e.target.value)}
                placeholder="Enter exam venue"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="examLink">Exam Link</Label>
              <Input
                id="examLink"
                type="url"
                value={formData.examLink}
                onChange={(e) => handleInputChange('examLink', e.target.value)}
                placeholder="Enter exam link (for online exams)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="toWhom">To Whom *</Label>
              <Select value={formData.toWhom} onValueChange={(value) => handleInputChange('toWhom', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="everyone">Everyone</SelectItem>
                  <SelectItem value="specific">Specific Students</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter exam description"
              rows={3}
              required
              className={`${fieldErrors.description ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            />

            {fieldErrors.description && <p className="text-xs text-red-500 mt-1">{fieldErrors.description}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              value={formData.instructions}
              onChange={(e) => handleInputChange('instructions', e.target.value)}
              placeholder="Enter exam instructions"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Exam'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};