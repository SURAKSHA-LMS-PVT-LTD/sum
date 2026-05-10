import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { homeworkApi } from '@/api/homework.api';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { HomeworkReferencesSection } from '@/components/homework/index';
import { getErrorMessage } from '@/api/apiError';

interface CreateHomeworkFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateHomeworkForm = ({ onClose, onSuccess }: CreateHomeworkFormProps) => {
  const { user, currentInstituteId, currentClassId, currentSubjectId } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [createdHomeworkId, setCreatedHomeworkId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    isActive: true
  });
  const instituteRole = useInstituteRole();

  // Check if user has permission to create homework - InstituteAdmin and Teachers
  const canCreate = instituteRole === 'InstituteAdmin' || instituteRole === 'Teacher';

  // Handle access denial in useEffect to avoid side effects during render
  React.useEffect(() => {
    if (!canCreate) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to create homework. This feature is only available for Institute Admins and Teachers.",
        variant: "destructive"
      });
      onClose();
    }
  }, [canCreate]);

  if (!canCreate) {
    return null;
  }

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
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsLoading(true);
    
    try {
      const homeworkData = {
        instituteId: currentInstituteId,
        classId: currentClassId,
        subjectId: currentSubjectId,
        teacherId: user.id,
        title: formData.title,
        description: formData.description,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        isActive: formData.isActive
      };

      const newHomework = await homeworkApi.createHomework(homeworkData);
      
      toast({
        title: "Homework Created",
        description: `"${formData.title}" created. You can now add reference materials.`
      });
      
      // Stay open so user can add references
      setCreatedHomeworkId(String(newHomework.id));
    } catch (error: any) {
      console.error('Error creating homework:', error);
      toast({
        title: "Creation Failed",
        description: getErrorMessage(error, 'Failed to create homework.'),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // â”€â”€ References step (after homework is created) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (createdHomeworkId) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="h-5 w-5" />
          <span className="font-medium">Homework created! Add reference materials below.</span>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">Reference Materials</CardTitle>
          </CardHeader>
          <CardContent>
            <HomeworkReferencesSection
              homeworkId={createdHomeworkId}
              editable={true}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => { onSuccess(); onClose(); }}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg sm:text-xl">Homework Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="title" className="text-sm font-medium">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter homework title"
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
                  placeholder="Enter homework description"
                  rows={4}
                  className={`mt-1 resize-none${fieldErrors.description ? ' border-red-500 focus-visible:ring-red-500' : ''}`}
                  required
                />

                {fieldErrors.description && <p className="text-xs text-red-500 mt-1">{fieldErrors.description}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate" className="text-sm font-medium">Start Date</Label>
                    <div className="mt-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formData.startDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.startDate ? format(new Date(formData.startDate), "PPP") : <span>Start Date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.startDate ? new Date(formData.startDate) : undefined}
                            onSelect={(date) => handleInputChange('startDate', date ? format(date, 'yyyy-MM-dd') : '')}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                <div>
                  <Label htmlFor="endDate" className="text-sm font-medium">End Date</Label>
                  <div className="mt-1">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !formData.endDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.endDate ? format(new Date(formData.endDate), "PPP") : <span>End Date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.endDate ? new Date(formData.endDate) : undefined}
                          onSelect={(date) => handleInputChange('endDate', date ? format(date, 'yyyy-MM-dd') : '')}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between space-x-2 pt-2">
                <Label htmlFor="isActive" className="text-sm font-medium">Status</Label>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    {formData.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 pt-4">
          <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? 'Creating...' : 'Create Homework'}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateHomeworkForm;
