import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { instituteClassesApi, InstituteClassCreateData } from '@/api/instituteClasses.api';
import { uploadWithSignedUrl } from '@/utils/signedUploadHelper';
import { Loader2, Upload } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { getBaseUrl, getApiHeadersAsync } from '@/contexts/utils/auth.api';
import ClassImageUpload from '@/components/ClassImageUpload';
import { getErrorMessage } from '@/api/apiError';

const updateClassSchema = z.object({
  instituteId: z.string().min(1, 'Institute ID is required'),
  name: z.string().min(1, 'Class name is required'),
  code: z.string().min(1, 'Class code is required'),
  academicYear: z.string().min(1, 'Academic year is required'),
  level: z.number().min(1, 'Level must be at least 1'),
  grade: z.number().min(1, 'Grade must be at least 1'),
  specialty: z.string().min(1, 'Specialty is required'),
  classType: z.string().min(1, 'Class type is required'),
  capacity: z.number().min(1, 'Capacity must be at least 1'),
  classTeacherId: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  isActive: z.boolean(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  enrollmentCode: z.string().optional(),
  enrollmentEnabled: z.boolean(),
  requireTeacherVerification: z.boolean(),
});

type UpdateClassFormData = z.infer<typeof updateClassSchema>;

interface UpdateClassFormProps {
  classData: any;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

const UpdateClassForm: React.FC<UpdateClassFormProps> = ({ classData, onSubmit, onCancel }) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  const form = useForm<UpdateClassFormData>({
    resolver: zodResolver(updateClassSchema) as any,
    defaultValues: {
      instituteId: classData.instituteId || '',
      name: classData.name || '',
      code: classData.code || '',
      academicYear: classData.academicYear || '',
      level: classData.level || 1,
      grade: classData.grade || 1,
      specialty: classData.specialty || '',
      classType: classData.classType || '',
      capacity: classData.capacity || 1,
      classTeacherId: classData.classTeacherId || '',
      description: classData.description || '',
      imageUrl: classData.imageUrl || '',
      isActive: classData.isActive ?? true,
      startDate: classData.startDate || '',
      endDate: classData.endDate || '',
      enrollmentCode: classData.enrollmentCode || '',
      enrollmentEnabled: classData.enrollmentEnabled ?? true,
      requireTeacherVerification: classData.requireTeacherVerification ?? true,
    },
  });

  const handleSubmit = async (data: UpdateClassFormData) => {
    console.log('Update Class button clicked - starting submission');
    setIsSubmitting(true);
    try {
      console.log('Preparing form data for class:', classData.id);
      // First, update class details (JSON)
      const baseUrl = getBaseUrl();
      const jsonPayload = {
        instituteId: data.instituteId,
        name: data.name,
        code: data.code,
        academicYear: data.academicYear,
        level: data.level,
        grade: data.grade,
        specialty: data.specialty,
        classType: data.classType,
        capacity: data.capacity,
        classTeacherId: data.classTeacherId || undefined,
        description: data.description || undefined,
        isActive: data.isActive,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
        enrollmentCode: data.enrollmentCode || undefined,
        enrollmentEnabled: data.enrollmentEnabled,
        requireTeacherVerification: data.requireTeacherVerification,
      };

      console.log('Sending PATCH request to update class details via instituteClassesApi.update...');
      const updatePayload: InstituteClassCreateData = {
        instituteId: data.instituteId,
        name: data.name,
        code: data.code,
        academicYear: data.academicYear,
        level: data.level,
        grade: data.grade,
        specialty: data.specialty,
        classType: data.classType,
        capacity: data.capacity,
        classTeacherId: data.classTeacherId || undefined,
        description: data.description || undefined,
        isActive: data.isActive,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
        enrollmentCode: data.enrollmentCode || undefined,
        enrollmentEnabled: data.enrollmentEnabled,
        requireTeacherVerification: data.requireTeacherVerification,
        imageUrl: data.imageUrl || undefined
      };

      const detailsRes = await instituteClassesApi.update(classData.id, updatePayload);
      console.log('Update API response received');

      let updatedClass = detailsRes?.class || detailsRes as any;

      // Optional: upload image if selected using signed URL
      if (selectedImage) {
        console.log('Uploading image:', selectedImage.name);
        
        // Step 1: Upload to S3 using signed URL
        const relativePath = await uploadWithSignedUrl(
          selectedImage,
          'institute-images'
        );
        
        // Step 2: Update class with relativePath
        const headers = await getApiHeadersAsync();
        const imageRes = await fetch(`${baseUrl}/institute-classes/${classData.id}/image-url`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ imageUrl: relativePath })
        });

        console.log('Image URL update status:', imageRes.status);
        if (!imageRes.ok) {
          const imgErr = await imageRes.json().catch(() => ({}));
          console.error('Server error (image):', imgErr);
          throw new Error(imgErr.message || `Image upload failed (${imageRes.status})`);
        }

        const imageResult = await imageRes.json();
        updatedClass = imageResult?.class || imageResult || updatedClass;
      }

      console.log('Class updated successfully:', updatedClass);
      toast({
        title: 'Success',
        description: 'Class updated successfully',
      });
      onSubmit(updatedClass);
    } catch (error: any) {
      console.error('Error updating class:', error);
      const errorMessage = getErrorMessage(error, 'Failed to update class');
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      console.log('Update submission completed');
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Class Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter class name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Class Code</FormLabel>
                <FormControl>
                  <Input placeholder="Enter class code" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="academicYear"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Academic Year</FormLabel>
                <FormControl>
                  <Input placeholder="2025-2026" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="grade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Grade</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="Enter grade" 
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="level"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Level</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="Enter level" 
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="specialty"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Specialty</FormLabel>
                <FormControl>
                  <Input placeholder="Enter specialty" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="classType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Class Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="REGULAR">Regular</SelectItem>
                    <SelectItem value="ADVANCED">Advanced</SelectItem>
                    <SelectItem value="REMEDIAL">Remedial</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Capacity</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    placeholder="Enter capacity" 
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="classTeacherId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Class Teacher ID (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Enter teacher ID" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <FormLabel>Class Image</FormLabel>
            <ClassImageUpload
              currentImageUrl={form.watch('imageUrl')}
              onImageUpdate={(newImageUrl) => {
                form.setValue('imageUrl', newImageUrl);
              }}
            />
          </div>

          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(new Date(field.value), "PPP") : <span>Start Date</span>}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(new Date(field.value), "PPP") : <span>End Date</span>}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? new Date(field.value) : undefined}
                      onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="enrollmentCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Enrollment Code (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Enter enrollment code" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Enter class description" 
                  className="min-h-[100px]"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Active Status</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    Enable or disable this class
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="enrollmentEnabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Enrollment Enabled</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    Allow student enrollment
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="requireTeacherVerification"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Teacher Verification</FormLabel>
                  <div className="text-sm text-muted-foreground">
                    Require teacher approval
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel} 
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Class'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default UpdateClassForm;