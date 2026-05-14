import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Keep for category field
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { toast } from 'sonner';
import SubjectImageUpload from '@/components/SubjectImageUpload';
import { getErrorMessage } from '@/api/apiError';
import { subjectsApi, SUBJECT_TYPE_OPTIONS, BASKET_CATEGORY_OPTIONS, requiresBasketCategory } from '@/api/subjects.api';

const subjectSchema = z.object({
  name: z.string().min(2, 'Subject name must be at least 2 characters').max(255),
  code: z.string().min(1, 'Subject code is required').max(50),
  description: z.string().optional(),
  category: z.string().optional(),
  creditHours: z.number().min(1).max(1000).optional(),
  basketCategory: z.string().optional(),
  subjectType: z.string().default('MAIN'),
  isActive: z.boolean().default(true),
  image: z.any().optional()
}).refine((data) => {
  // If subject type contains 'BASKET', basketCategory is required
  if (data.subjectType && data.subjectType.includes('BASKET') && data.subjectType !== 'MAIN' && data.subjectType !== 'COMMON') {
    return !!data.basketCategory;
  }
  return true;
}, {
  message: 'Basket category is required for basket subject types',
  path: ['basketCategory']
});

type SubjectFormData = z.infer<typeof subjectSchema>;

interface CreateSubjectFormProps {
  onSubmit: (data: SubjectFormData) => void;
  onCancel: () => void;
  initialData?: any;
}

const CreateSubjectForm = ({ onSubmit, onCancel, initialData }: CreateSubjectFormProps) => {
  const isEditing = !!initialData;
  const [isLoading, setIsLoading] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>(initialData?.imgUrl || '');
  const { currentInstituteId, user } = useAuth();
  
  // Check if user has permission (only SuperAdmin and InstituteAdmin)
  const userRole = useInstituteRole();
  const hasPermission = user?.role === 'SystemAdmin' || userRole === 'InstituteAdmin';
  
  const form = useForm<any>({
    resolver: zodResolver(subjectSchema) as any,
    defaultValues: {
      name: initialData?.name || '',
      code: initialData?.code || '',
      description: initialData?.description || '',
      category: initialData?.category || '',
      creditHours: initialData?.creditHours || 3,
      basketCategory: initialData?.basketCategory || '',
      subjectType: initialData?.subjectType || 'MAIN',
      isActive: initialData?.isActive ?? true
    }
  });

  const watchSubjectType = form.watch('subjectType');
  const showBasketCategory = requiresBasketCategory(watchSubjectType);

  const handleImageUpload = (imageUrl: string) => {
    setImagePreviewUrl(imageUrl);
  };

  const handleImageRemove = () => {
    setImagePreviewUrl('');
  };

  const handleSubmit = async (data: SubjectFormData) => {
    if (!currentInstituteId) {
      toast.error('Please select an institute first');
      return;
    }

    if (!hasPermission) {
      toast.error('You do not have permission to create subjects');
      return;
    }

    setIsLoading(true);
    
    try {
      if (!isEditing) {
        // Create subject using new API
        await subjectsApi.create({
          code: data.code,
          name: data.name,
          description: data.description,
          category: data.category,
          creditHours: data.creditHours,
          isActive: data.isActive,
          subjectType: data.subjectType,
          basketCategory: showBasketCategory ? data.basketCategory : undefined,
          instituteId: currentInstituteId,
          imgUrl: imagePreviewUrl || undefined
        });
        
        toast.success('Subject created successfully!');
        onSubmit(data);
      } else {
        // Update subject
        await subjectsApi.update(initialData.id, {
          code: data.code,
          name: data.name,
          description: data.description,
          category: data.category,
          creditHours: data.creditHours,
          isActive: data.isActive,
          subjectType: data.subjectType,
          basketCategory: showBasketCategory ? data.basketCategory : undefined,
          imgUrl: imagePreviewUrl || undefined
        }, currentInstituteId);
        
        toast.success('Subject updated successfully!');
        onSubmit(data);
      }
    } catch (error: any) {
      console.error('Error saving subject:', error);
      toast.error(getErrorMessage(error, 'Failed to save subject'));
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasPermission) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
          <CardDescription>Only SuperAdmin and InstituteAdmin can manage subjects.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Subject' : 'Add New Subject'}</CardTitle>
        <CardDescription>
          {isEditing ? 'Update subject information' : 'Create a new subject for this institute'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="MATH101" {...field} maxLength={50} />
                    </FormControl>
                    <FormDescription>Unique identifier (max 50 chars)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Mathematics" {...field} maxLength={255} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Science">Science</SelectItem>
                        <SelectItem value="Mathematics">Mathematics</SelectItem>
                        <SelectItem value="Languages">Languages</SelectItem>
                        <SelectItem value="Arts">Arts</SelectItem>
                        <SelectItem value="Commerce">Commerce</SelectItem>
                        <SelectItem value="Technology">Technology</SelectItem>
                        <SelectItem value="Humanities">Humanities</SelectItem>
                        <SelectItem value="Religion">Religion</SelectItem>
                        <SelectItem value="Physical Education">Physical Education</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="creditHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Credit Hours</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="3" 
                        min={1}
                        max={1000}
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
                name="subjectType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject Type *</FormLabel>
                    <FormControl>
                      <>
                        <Input 
                          placeholder="Type or select subject type" 
                          list="subject-type-options"
                          {...field} 
                        />
                        <datalist id="subject-type-options">
                          {SUBJECT_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </datalist>
                      </>
                    </FormControl>
                    <FormDescription>
                      {SUBJECT_TYPE_OPTIONS.find(o => o.value === field.value)?.description || 'Enter custom type or select from suggestions'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {showBasketCategory && (
                <FormField
                  control={form.control}
                  name="basketCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Basket Category *</FormLabel>
                      <FormControl>
                        <>
                          <Input 
                            placeholder="Type or select basket category" 
                            list="basket-category-options"
                            {...field} 
                          />
                          <datalist id="basket-category-options">
                            {BASKET_CATEGORY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </datalist>
                        </>
                      </FormControl>
                      <FormDescription>
                        Required for basket subject types. Type custom or select from suggestions.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter subject description..." 
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="space-y-2">
              <FormLabel>Subject Image (Optional)</FormLabel>
              <SubjectImageUpload
                value={imagePreviewUrl}
                onChange={handleImageUpload}
                onRemove={handleImageRemove}
              />
              <FormDescription>
                Recommended: 4:3 aspect ratio, max 5MB (JPG, PNG, WebP)
              </FormDescription>
            </div>
            
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <FormDescription>
                      Enable this subject for students and classes
                    </FormDescription>
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
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : (isEditing ? 'Update Subject' : 'Create Subject')}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default CreateSubjectForm;
