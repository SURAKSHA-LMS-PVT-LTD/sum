
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { OrganizationCreateData } from '@/api/organization.api';
import { getBaseUrl, getApiHeadersAsync } from '@/contexts/utils/auth.api';
import OrganizationImageUpload from '@/components/OrganizationImageUpload';
import { getErrorMessage } from '@/api/apiError';

const organizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  type: z.enum(['INSTITUTE', 'GLOBAL']),
  enrollmentKey: z.string().max(50, 'Enrollment key must be less than 50 characters').optional(),
  isPublic: z.boolean().default(true),
  needEnrollmentVerification: z.boolean().default(true),
  enabledEnrollments: z.boolean().default(true),
  instituteId: z.string().optional()
}).refine((data) => {
  if (data.type === 'INSTITUTE') {
    return data.enrollmentKey && data.enrollmentKey.trim().length > 0;
  }
  return true;
}, {
  message: 'Enrollment key is required for institute organizations',
  path: ['enrollmentKey']
});

type OrganizationFormData = z.infer<typeof organizationSchema>;

interface CreateOrganizationFormProps {
  onSuccess?: (organization: any) => void;
  onCancel?: () => void;
  instituteId?: string;
  instituteName?: string;
}

const CreateOrganizationForm = ({ onSuccess, onCancel, instituteId, instituteName }: CreateOrganizationFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const { toast } = useToast();

  const form = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema) as any,
    defaultValues: {
      name: '',
      type: 'INSTITUTE',
      enrollmentKey: '',
      isPublic: true,
      needEnrollmentVerification: true,
      enabledEnrollments: true,
      instituteId: instituteId || ''
    }
  });

  const watchType = form.watch('type');

  const handleSubmit = async (data: OrganizationFormData) => {
    setIsLoading(true);
    
    try {
      const headers = await getApiHeadersAsync();
      
      const requestBody = {
        name: data.name,
        type: data.type,
        isPublic: data.isPublic,
        needEnrollmentVerification: data.needEnrollmentVerification,
        enabledEnrollments: data.enabledEnrollments,
        enrollmentKey: data.enrollmentKey || undefined,
        instituteId: data.instituteId || instituteId || undefined,
        imageUrl: imageUrl || undefined
      };
      
      const response = await fetch(`${getBaseUrl()}/organizations`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create organization');
      }
      
      const organization = await response.json();
      
      toast({
        title: "Success",
        description: `Organization "${organization.name}" created successfully`,
      });
      
      if (onSuccess) {
        onSuccess(organization);
      }
    } catch (error: any) {
      console.error('Error creating organization:', error);
      
      let errorMessage = "Failed to create organization";
      
      if (error instanceof Error) {
        if (error.message.includes("Only Organization Managers, Super Admins, or Institute Admins")) {
          errorMessage = "You don't have permission to create organizations. Please contact your administrator.";
        } else if (error.message.includes("Forbidden")) {
          errorMessage = "Access denied. You need Institute Admin permissions to create organizations.";
        } else if (error.message.includes("already exists")) {
          errorMessage = "An organization with this name already exists.";
        } else if (error.message) {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Cannot Create Organization",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-2">
        <h2 className="text-base font-semibold text-foreground">Add New Organization</h2>
        <p className="text-xs text-muted-foreground">Enter organization information</p>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-2">
          {/* Row 1: Name & Type */}
          <div className="grid grid-cols-2 gap-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs">Organization Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter name" 
                      className="h-8 text-xs"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs">Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="INSTITUTE">Institute</SelectItem>
                      <SelectItem value="GLOBAL">Global</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
          </div>

          {/* Row 2: Enrollment Key & Institute */}
          <div className="grid grid-cols-2 gap-2">
            <FormField
              control={form.control}
              name="enrollmentKey"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="text-xs">
                    Enrollment Key {watchType === 'INSTITUTE' ? '*' : ''}
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={watchType === 'INSTITUTE' ? "Secret key" : "Optional"} 
                      className="h-8 text-xs"
                      {...field} 
                      disabled={watchType !== 'INSTITUTE'}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {instituteId ? (
              <FormItem className="space-y-1">
                <FormLabel className="text-xs">Linked Institute</FormLabel>
                <Input 
                  value={instituteName || instituteId} 
                  disabled 
                  className="h-8 text-xs bg-muted"
                />
              </FormItem>
            ) : (
              <FormField
                control={form.control}
                name="instituteId"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="text-xs">Institute ID</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Optional" 
                        className="h-8 text-xs"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            )}
          </div>

          {/* Image Upload - Compact */}
          <div className="space-y-1">
            <FormLabel className="text-xs">Image (Optional)</FormLabel>
            <OrganizationImageUpload
              currentImageUrl={imageUrl}
              onImageUpdate={(newImageUrl) => setImageUrl(newImageUrl)}
              organizationName={form.watch('name')}
            />
          </div>

          {/* Settings - Inline compact toggles */}
          <div className="grid grid-cols-3 gap-2">
            <FormField
              control={form.control}
              name="isPublic"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded border p-2">
                  <FormLabel className="text-xs font-medium">Public</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="scale-75"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="needEnrollmentVerification"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded border p-2">
                  <FormLabel className="text-xs font-medium">Verify</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="scale-75"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enabledEnrollments"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded border p-2">
                  <FormLabel className="text-xs font-medium">Enroll</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="scale-75"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          
          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" className="h-10 px-6" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" className="h-10 px-6" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Organization'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default CreateOrganizationForm;
