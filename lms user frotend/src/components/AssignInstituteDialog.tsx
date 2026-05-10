
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import InstituteSelect from '@/components/ui/InstituteSelect';
import { organizationSpecificApi } from '@/api/organization.api';
import { useToast } from '@/hooks/use-toast';

interface AssignInstituteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

const AssignInstituteDialog = ({ open, onOpenChange, organizationId }: AssignInstituteDialogProps) => {
  const [instituteId, setInstituteId] = useState('');
  const [instituteName, setInstituteName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!instituteId.trim()) {
      toast({
        title: "Validation Error",
        description: "Please select an institute",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      await organizationSpecificApi.post(
        `/organizations/${organizationId}/assign-institute`,
        { instituteId: instituteId.trim() }
      );
      
      toast({
        title: "Success",
        description: `Organization successfully assigned to ${instituteName || 'institute'}`,
      });
      
      setInstituteId('');
      setInstituteName('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error assigning institute:', error);
      toast({
        title: "Error",
        description: "Failed to assign organization to institute",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign to Institute</DialogTitle>
          <DialogDescription>
            Select the institute to assign this organization to.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <InstituteSelect
              value={instituteId}
              onChange={(id, name) => { setInstituteId(id); setInstituteName(name); }}
              label="Institute"
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !instituteId}>
              {isLoading ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AssignInstituteDialog;
