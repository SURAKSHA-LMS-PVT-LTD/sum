import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useApiRequest } from '@/hooks/useApiRequest';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { Eye } from 'lucide-react';
import { getErrorMessage } from '@/api/apiError';

const assignParentByPhoneSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
  parentRole: z.enum(['father', 'mother', 'guardian'], {
    required_error: 'Please select a parent role',
  }),
});

type AssignParentByPhoneFormData = z.infer<typeof assignParentByPhoneSchema>;

interface AssignParentByPhoneFormProps {
  studentId: string;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

interface UserPreviewData {
  id: string;
  imageUrl: string;
  fullName: string;
  userType: string;
}

const AssignParentByPhoneForm: React.FC<AssignParentByPhoneFormProps> = ({
  studentId,
  onSubmit,
  onCancel,
}) => {
  const { toast } = useToast();
  const { currentInstituteId } = useAuth();
  const [userPreview, setUserPreview] = React.useState<UserPreviewData | null>(null);
  const [showUserPreview, setShowUserPreview] = React.useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false);
  
  const form = useForm<AssignParentByPhoneFormData>({
    resolver: zodResolver(assignParentByPhoneSchema),
    defaultValues: {
      phoneNumber: '+94',
      parentRole: 'father',
    },
  });

  const handlePhoneNumberChange = (value: string) => {
    // Always ensure it starts with +94
    if (!value.startsWith('+94')) {
      value = '+94';
    }
    
    // Get the part after +94
    const numberPart = value.slice(3);
    
    // Prevent starting with 0 and only allow digits
    if (numberPart.length > 0) {
      // Remove any non-digit characters
      const cleanNumber = numberPart.replace(/\D/g, '');
      
      // Prevent starting with 0
      if (cleanNumber.startsWith('0')) {
        return; // Don't update if trying to start with 0
      }
      
      value = '+94' + cleanNumber;
    }
    
    form.setValue('phoneNumber', value);
  };

  const assignParentRequest = useApiRequest(
    async (data: AssignParentByPhoneFormData) => {
      const response = await apiClient.post(`/institute-users/student/${studentId}/assign-parent-by-phone`, {
        phoneNumber: data.phoneNumber,
        parentRole: data.parentRole,
      });
      return response.data;
    },
    { 
      preventDuplicates: true, 
      showLoading: false 
    }
  );

  const fetchUserByPhone = async (phoneNumber: string) => {
    if (!phoneNumber.trim() || phoneNumber === '+94') {
      toast({
        title: "Validation Error",
        description: "Please enter a valid phone number",
        variant: "destructive"
      });
      return;
    }

    setIsLoadingPreview(true);
    try {
      // Don't encode the phone number - backend expects literal + sign
      const response = await apiClient.get(`/users/basic/phone/${phoneNumber}`);
      setUserPreview(response);
      setShowUserPreview(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: getErrorMessage(error, 'User not found'),
        variant: "destructive"
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSubmit = async (data: AssignParentByPhoneFormData) => {
    try {
      console.log('Submitting parent assignment:', data);
      const response = await assignParentRequest.execute(data);
      console.log('API Response:', response);
      
      // Handle success case - response should be the API response data
      if (response && response.success) {
        toast({
          title: "Success",
          description: "Parent Assign Successfully",
        });
        onSubmit(response);
      } else {
        toast({
          title: "Success",
          description: "Parent Assign Successfully",
        });
        onSubmit(response);
      }
    } catch (error: any) {
      console.error('Error assigning parent:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error, 'Failed to assign parent.'),
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parent Phone Number</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      onChange={(e) => handlePhoneNumberChange(e.target.value)}
                      placeholder="+94772261284"
                      type="tel"
                      className="pr-10"
                      maxLength={12}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0"
                      onClick={() => fetchUserByPhone(field.value)}
                      disabled={isLoadingPreview || field.value === '+94'}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="parentRole"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parent Role</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="father">Father</SelectItem>
                    <SelectItem value="mother">Mother</SelectItem>
                    <SelectItem value="guardian">Guardian</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={assignParentRequest.loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={assignParentRequest.loading}
            >
              {assignParentRequest.loading ? 'Assigning...' : 'Assign Parent'}
            </Button>
          </div>
        </form>
      </Form>
      
      {/* User Preview Dialog */}
      <Dialog open={showUserPreview} onOpenChange={setShowUserPreview}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>User Preview</DialogTitle>
          </DialogHeader>
          {userPreview && (
            <div className="flex flex-col items-center space-y-4 py-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={userPreview.imageUrl} alt={userPreview.fullName} />
                <AvatarFallback>
                  {userPreview.fullName.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h3 className="font-semibold text-lg">{userPreview.fullName}</h3>
                <Badge variant="outline" className="mt-1">
                  {userPreview.userType}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">ID: {userPreview.id}</p>
              <Button 
                variant="outline" 
                onClick={() => setShowUserPreview(false)}
                className="w-full"
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AssignParentByPhoneForm;