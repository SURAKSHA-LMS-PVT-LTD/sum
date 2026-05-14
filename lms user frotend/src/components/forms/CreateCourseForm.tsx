
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { organizationApi } from '@/api/organization.api';
import { useToast } from '@/hooks/use-toast';
import { uploadWithSignedUrl } from '@/utils/signedUploadHelper';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getBaseUrl2 } from '@/contexts/utils/auth.api';

const createCourseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  description: z.string().min(1, 'Description is required').max(500, 'Description must be less than 500 characters'),
  organizationId: z.string().min(1, 'Organization is required'),
  introVideoUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  isPublic: z.boolean(),
  image: z.any().optional(),
});

type CreateCourseFormData = z.infer<typeof createCourseSchema>;

interface CreateCourseFormProps {
  onSuccess: (course: any) => void;
  onCancel: () => void;
}

const CreateCourseForm = ({ onSuccess, onCancel }: CreateCourseFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const userRole = useInstituteRole();

  const form = useForm<CreateCourseFormData>({
    resolver: zodResolver(createCourseSchema) as any,
    defaultValues: {
      title: '',
      description: '',
      organizationId: '',
      introVideoUrl: '',
      isPublic: true,
    },
  });

  // Fetch organizations on component mount
  React.useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await organizationApi.getOrganizations({
          userId: user?.id,
          role: userRole || 'User'
        });
        setOrganizations(response.data);
      } catch (error: any) {
        console.error('Error fetching organizations:', error);
        toast({
          title: "Error",
          description: "Failed to load organizations",
          variant: "destructive",
        });
      } finally {
        setLoadingOrganizations(false);
      }
    };

    fetchOrganizations();
  }, []);

  const onSubmit = async (data: CreateCourseFormData) => {
    try {
      setIsSubmitting(true);

      // Use the organization API endpoint for OrganizationManager with new endpoint
      const baseUrl2 = getBaseUrl2();
      if (!baseUrl2) {
        throw new Error('Organization base URL not configured');
      }

      let imageRelativePath: string | undefined;
      
      // Step 1: Upload image if selected using signed URL
      if (selectedImage) {
        imageRelativePath = await uploadWithSignedUrl(
          selectedImage,
          'institute-images'
        );
      }

      // Step 2: Create course with image relativePath
      const courseData: any = {
        organizationId: data.organizationId,
        title: data.title,
        description: data.description,
        isPublic: data.isPublic
      };
      
      if (data.introVideoUrl) {
        courseData.introVideoUrl = data.introVideoUrl;
      }
      
      if (imageRelativePath) {
        courseData.imageUrl = imageRelativePath;
      }

      const response = await fetch(`${baseUrl2}/organization/api/v1/causes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('org_access_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(courseData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: `HTTP Error: ${response.status}`,
        }));
        throw new Error(errorData.message || `HTTP Error: ${response.status}`);
      }

      const newCourse = await response.json();
      
      toast({
        title: "Success",
        description: "Course created successfully",
      });
      
      onSuccess(newCourse);
    } catch (error: any) {
      console.error('Error creating course:', error);
      toast({
        title: "Error",
        description: "Failed to create course. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create New Course</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Add a new course to an organization
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Course Information
          </CardTitle>
          <CardDescription>
            Enter the details for the new course
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter course title"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter course description"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="organizationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select organization" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {loadingOrganizations ? (
                          <SelectItem value="loading" disabled>Loading organizations...</SelectItem>
                        ) : (
                          organizations.map((org) => (
                            <SelectItem key={org.organizationId} value={org.organizationId}>
                              {org.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="introVideoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Intro Video URL (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://youtube.com/watch?v=example"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isPublic"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Public Course</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Make this course visible to all users
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

              <div className="space-y-2">
                <Label htmlFor="image">Course Image (Optional)</Label>
                <Input
                  id="image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setSelectedImage(file || null);
                  }}
                />
                {selectedImage && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedImage.name}
                  </p>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting || loadingOrganizations}
                  className="flex-1"
                >
                  {isSubmitting ? 'Creating...' : 'Create Course'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateCourseForm;
