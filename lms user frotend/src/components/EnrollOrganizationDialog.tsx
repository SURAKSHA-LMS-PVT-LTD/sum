import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { organizationApi } from '@/api/organization.api';
import { Loader2, UserPlus } from 'lucide-react';

interface EnrollOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  organizationType?: string;
  onEnrollmentSuccess?: () => void;
}

const EnrollOrganizationDialog = ({ 
  open, 
  onOpenChange, 
  organizationId, 
  organizationName,
  organizationType,
  onEnrollmentSuccess 
}: EnrollOrganizationDialogProps) => {
  const [enrollmentKey, setEnrollmentKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate enrollment key for INSTITUTE organizations
    if (organizationType === 'INSTITUTE' && !enrollmentKey.trim()) {
      toast({
        title: "Error",
        description: "Enrollment key is required for institute organizations",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const response = await organizationApi.enrollInOrganization({
        organizationId,
        enrollmentKey: enrollmentKey || undefined
      });
      
      toast({
        title: "Success",
        description: response.message || `Successfully enrolled in ${organizationName}`,
      });
      
      onEnrollmentSuccess?.();
      onOpenChange(false);
      setEnrollmentKey('');
    } catch (error: any) {
      console.error('Error enrolling in organization:', error);
      
      // Get the error message from the API response
      let errorMessage = "Failed to enroll in organization";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Log the full error for debugging
      console.log('Full error details:', {
        error,
        message: errorMessage,
        organizationType,
        enrollmentKey: enrollmentKey ? 'provided' : 'empty'
      });
      
      // Check if it's an enrollment key validation error
      const isInvalidKeyError = errorMessage.toLowerCase().includes('enrollment key') || 
                               errorMessage.toLowerCase().includes('invalid key') ||
                               errorMessage.toLowerCase().includes('invalid enrollment') ||
                               errorMessage.toLowerCase().includes('unauthorized') ||
                               errorMessage.toLowerCase().includes('incorrect key') ||
                               errorMessage.toLowerCase().includes('wrong key');
      
      // For INSTITUTE organizations, assume enrollment key errors if not already enrolled
      const isAlreadyEnrolled = errorMessage.toLowerCase().includes('already enrolled');
      const shouldShowKeyError = organizationType === 'INSTITUTE' && !isAlreadyEnrolled && enrollmentKey;
      
      toast({
        title: "Error",
        description: isInvalidKeyError || shouldShowKeyError 
          ? "Enrollment key is invalid. Please check your enrollment key and try again." 
          : errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setEnrollmentKey('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Enroll in Organization
          </DialogTitle>
          <DialogDescription>
            Enroll in "{organizationName}". 
            {organizationType === 'INSTITUTE' 
              ? "This institute organization requires a valid enrollment key."
              : "If this organization requires an enrollment key, please enter it below."
            }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="enrollmentKey">
              Enrollment Key {organizationType === 'INSTITUTE' ? '(Required)' : '(Optional)'}
            </Label>
            <Input
              id="enrollmentKey"
              type="text"
              placeholder={organizationType === 'INSTITUTE' 
                ? "Enter enrollment key..." 
                : "Enter enrollment key if required..."
              }
              value={enrollmentKey}
              onChange={(e) => setEnrollmentKey(e.target.value)}
              disabled={isSubmitting}
              required={organizationType === 'INSTITUTE'}
            />
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enrolling...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Enroll
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EnrollOrganizationDialog;