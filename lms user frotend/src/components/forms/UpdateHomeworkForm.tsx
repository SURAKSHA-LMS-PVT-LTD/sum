import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, Paperclip } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { homeworkApi } from '@/api/homework.api';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { HomeworkReferencesSection } from '@/components/homework/index';
import { getErrorMessage } from '@/api/apiError';

interface UpdateHomeworkFormProps {
  homework: any;
  onClose: () => void;
  onSuccess: () => void;
}

const UpdateHomeworkForm = ({ homework, onClose, onSuccess }: UpdateHomeworkFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  const toDateString = (value: any): string => {
    if (!value) return '';
    try {
      const d = value instanceof Date ? value : new Date(value);
      if (isNaN(d.getTime())) return '';
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    } catch {
      return '';
    }
  };
  
  const [formData, setFormData] = useState({
    title: homework.title || '',
    description: homework.description || '',
    startDate: toDateString(homework.startDate),
    endDate: toDateString(homework.endDate),
    referenceLink: homework.referenceLink || '',
    isActive: homework.isActive ?? true
  });


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
        const errors: Record<string, string> = {};
    if (!formData.title) errors.title = 'Title is required';
    if (!formData.description) errors.description = 'Description is required';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const payload = {
        instituteId: homework.instituteId,
        classId: homework.classId,
        subjectId: homework.subjectId,
        title: formData.title,
        description: formData.description,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        referenceLink: formData.referenceLink || null,
        isActive: formData.isActive
      };

      await homeworkApi.updateHomework(homework.id, payload);

      toast({
        title: "Success",
        description: "Homework updated successfully"
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating homework:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error, 'Failed to update homework'),
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFieldErrors(prev => ({ ...prev, [field]: '' }));

    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => handleInputChange('title', e.target.value)}
          placeholder="Enter homework title"
          required
              className={`${fieldErrors.title ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
        />

        {fieldErrors.title && <p className="text-xs text-red-500 mt-1">{fieldErrors.title}</p>}
      </div>

      <div>
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          placeholder="Enter homework description"
          required
              className={`${fieldErrors.description ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
        />

        {fieldErrors.description && <p className="text-xs text-red-500 mt-1">{fieldErrors.description}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate">Start Date</Label>
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
            <Label htmlFor="endDate">End Date</Label>
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

      <div>
        <Label htmlFor="referenceLink">Reference Link</Label>
        <Input
          id="referenceLink"
          value={formData.referenceLink}
          onChange={(e) => handleInputChange('referenceLink', e.target.value)}
          placeholder="Enter reference link (optional)"
        />
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

      {/* Reference Materials Section */}
      {homework.id && (
        <div className="pt-4 border-t">
          <HomeworkReferencesSection 
            homeworkId={homework.id}
            initialReferences={homework.references}
            editable={true}
          />
        </div>
      )}

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Updating...' : 'Update Homework'}
        </Button>
      </div>
    </form>
  );
};

export default UpdateHomeworkForm;
