import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { instituteClassesApi } from '@/api/instituteClasses.api';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import ImageCropUpload from '@/components/common/ImageCropUpload';
import { getErrorMessage } from '@/api/apiError';

interface CreateClassFormProps {
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const CreateClassForm = ({ onSubmit, onCancel }: CreateClassFormProps) => {
  const { user, selectedInstitute } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [uploadProgress, setUploadProgress] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    academicYear: '',
    level: 10,
    grade: 10,
    specialty: '',
    classType: 'REGULAR',
    capacity: 30,
    classTeacherId: '',
    description: '',
    isActive: true,
    startDate: '',
    endDate: '',
    enrollmentCode: '',
    enrollmentEnabled: true,
    requireTeacherVerification: true,
    imageUrl: ''
  });

  // Teachers list functionality removed - manual ID entry only

  const handleInputChange = (field: string, value: any) => {
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
        title: "Missing Selection",
        description: "Please select an institute first.",
        variant: "destructive"
      });
      return;
    }

        const errors: Record<string, string> = {};
    if (!formData.name) errors.name = 'Name is required';
    if (!formData.code) errors.code = 'Code is required';
    if (!formData.academicYear) errors.academicYear = 'Academic Year is required';
    if (!formData.specialty) errors.specialty = 'Specialty is required';
    if (!formData.level) errors.level = 'Level is required';
    if (!formData.grade) errors.grade = 'Grade is required';
    if (!formData.capacity) errors.capacity = 'Capacity is required';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    
    try {
      const imageUrl = formData.imageUrl;

      // Step 2: Create class with imageUrl (relativePath)
      const classData = {
        instituteId: selectedInstitute.id,
        name: formData.name,
        code: formData.code,
        academicYear: formData.academicYear,
        level: formData.level,
        grade: formData.grade,
        specialty: formData.specialty,
        classType: formData.classType,
        capacity: formData.capacity,
        classTeacherId: formData.classTeacherId || null,
        description: formData.description,
        isActive: formData.isActive,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : new Date().toISOString(),
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : new Date(new Date().getFullYear() + 1, 5, 30).toISOString(),
        enrollmentCode: formData.enrollmentCode,
        enrollmentEnabled: formData.enrollmentEnabled,
        requireTeacherVerification: formData.requireTeacherVerification,
        imageUrl: imageUrl
      };

      const response = await instituteClassesApi.create(classData);
      
      toast({
        title: "Class Created",
        description: response?.message || `Class "${formData.name}" has been created successfully.`
      });
      onSubmit(response);
    } catch (error: any) {
      console.error('Create class error:', error);
      const errorMessage = getErrorMessage(error, 'Failed to create class.');

      toast({
        title: "Creation Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-1">
      {/* Compact: All in one section for mobile, two columns for larger screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Basic Info - Compact */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label htmlFor="name" className="text-xs">Class Name</Label>
                <Input
                  id="name"
                  placeholder="Grade 10 Science - A"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`h-8 text-sm${fieldErrors.name ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  required
                />

                {fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
              </div>
              <div>
                <Label htmlFor="code" className="text-xs">Class Code</Label>
                <Input
                  id="code"
                  placeholder="G10SA"
                  value={formData.code}
                  onChange={(e) => handleInputChange('code', e.target.value)}
                  className={`h-8 text-sm${fieldErrors.code ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  required
                />

                {fieldErrors.code && <p className="text-xs text-red-500 mt-1">{fieldErrors.code}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label htmlFor="academicYear" className="text-xs">Academic Year</Label>
                <Input
                  id="academicYear"
                  placeholder="2025/2026"
                  value={formData.academicYear}
                  onChange={(e) => handleInputChange('academicYear', e.target.value)}
                  className={`h-8 text-sm${fieldErrors.academicYear ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  required
                />

                {fieldErrors.academicYear && <p className="text-xs text-red-500 mt-1">{fieldErrors.academicYear}</p>}
              </div>
              <div>
                <Label htmlFor="specialty" className="text-xs">Specialty</Label>
                <Input
                  id="specialty"
                  placeholder="Science Stream"
                  value={formData.specialty}
                  onChange={(e) => handleInputChange('specialty', e.target.value)}
                  className={`h-8 text-sm${fieldErrors.specialty ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  required
                />

                {fieldErrors.specialty && <p className="text-xs text-red-500 mt-1">{fieldErrors.specialty}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details - Compact */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="level" className="text-xs">Level</Label>
                <Input
                  id="level"
                  type="number"
                  min="1"
                  max="13"
                  value={formData.level}
                  onChange={(e) => handleInputChange('level', parseInt(e.target.value))}
                  className={`h-8 text-sm${fieldErrors.level ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  required
                />

                {fieldErrors.level && <p className="text-xs text-red-500 mt-1">{fieldErrors.level}</p>}
              </div>
              <div>
                <Label htmlFor="grade" className="text-xs">Grade</Label>
                <Input
                  id="grade"
                  type="number"
                  min="1"
                  max="13"
                  value={formData.grade}
                  onChange={(e) => handleInputChange('grade', parseInt(e.target.value))}
                  className={`h-8 text-sm${fieldErrors.grade ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  required
                />

                {fieldErrors.grade && <p className="text-xs text-red-500 mt-1">{fieldErrors.grade}</p>}
              </div>
            </div>
            <div>
              <Label htmlFor="capacity" className="text-xs">Capacity</Label>
              <Input
                id="capacity"
                type="number"
                min="1"
                max="100"
                value={formData.capacity}
                onChange={(e) => handleInputChange('capacity', parseInt(e.target.value))}
                className={`h-8 text-sm${fieldErrors.capacity ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                required
              />

              {fieldErrors.capacity && <p className="text-xs text-red-500 mt-1">{fieldErrors.capacity}</p>}
            </div>
            <div>
              <Label htmlFor="classType" className="text-xs">Type</Label>
              <Select value={formData.classType} onValueChange={(value) => handleInputChange('classType', value)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="REGULAR">Regular</SelectItem>
                  <SelectItem value="ADVANCED">Advanced</SelectItem>
                  <SelectItem value="REMEDIAL">Remedial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="classTeacherId" className="text-xs">Class Teacher ID</Label>
              <Input
                id="classTeacherId"
                placeholder="Enter teacher ID or select below"
                value={formData.classTeacherId}
                onChange={(e) => handleInputChange('classTeacherId', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule & Enrollment - Combined */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="startDate" className="text-xs">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className="h-8 text-sm"
                  required
                />
              </div>
              <div>
                <Label htmlFor="endDate" className="text-xs">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  className="h-8 text-sm"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Enrollment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <Label htmlFor="enrollmentCode" className="text-xs">Code</Label>
              <Input
                id="enrollmentCode"
                placeholder="2025"
                value={formData.enrollmentCode}
                onChange={(e) => handleInputChange('enrollmentCode', e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1">
                <Switch
                  id="enrollmentEnabled"
                  checked={formData.enrollmentEnabled}
                  onCheckedChange={(checked) => handleInputChange('enrollmentEnabled', checked)}
                />
                <Label htmlFor="enrollmentEnabled">Enable</Label>
              </div>
              <div className="flex items-center space-x-1">
                <Switch
                  id="requireTeacherVerification"
                  checked={formData.requireTeacherVerification}
                  onCheckedChange={(checked) => handleInputChange('requireTeacherVerification', checked)}
                />
                <Label htmlFor="requireTeacherVerification">Verify</Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Info - Compact */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Additional Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <div>
              <Label htmlFor="description" className="text-xs">Description</Label>
              <Textarea
                id="description"
                placeholder="Class description..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="h-16 text-sm resize-none"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <ImageCropUpload
                currentImageUrl={formData.imageUrl}
                onImageUpdate={(url) => handleInputChange('imageUrl', url)}
                folder="institute-images"
                aspectRatio={4/3}
                label="Class Image"
              />
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                />
                <Label htmlFor="isActive" className="text-xs">Active Class</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compact button layout */}
      <div className="flex justify-end gap-2 pt-1">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          className="h-8 px-3 text-sm"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading}
          className="h-8 px-3 text-sm"
        >
          {isLoading ? 'Creating...' : 'Create Class'}
        </Button>
      </div>
    </form>
  );
};

export default CreateClassForm;