import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Crown, AlertTriangle } from 'lucide-react';
import { organizationSpecificApi } from '@/api/organization.api';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/api/apiError';

interface Member {
  userId: string;
  name: string;
  email: string;
  role: string;
  isVerified: boolean;
  joinedAt: any;
}

interface TransferPresidencyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  members: Member[];
  currentPresidentId?: string;
  onSuccess: () => void;
}

const TransferPresidencyDialog = ({ 
  open, 
  onOpenChange, 
  organizationId, 
  members, 
  currentPresidentId, 
  onSuccess 
}: TransferPresidencyDialogProps) => {
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Filter out the current president from the list
  const eligibleMembers = members.filter(member => 
    member.userId !== currentPresidentId && 
    member.isVerified
  );

  const handleTransfer = async () => {
    if (!selectedUserId) {
      toast({
        title: "Error",
        description: "Please select a new president",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await organizationSpecificApi.transferPresidency(organizationId, {
        newPresidentUserId: selectedUserId
      });

      toast({
        title: "Success",
        description: "Presidency transferred successfully",
      });

      onSuccess();
      onOpenChange(false);
      setSelectedUserId('');
    } catch (error: any) {
      console.error('Error transferring presidency:', error);
      toast({
        title: "Error",
        description: getErrorMessage(error, 'Failed to transfer presidency'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedMember = eligibleMembers.find(m => m.userId === selectedUserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-600" />
            Transfer Presidency
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Warning Message */}
          <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              <p className="font-medium">Warning: This action cannot be undone</p>
              <p className="mt-1">You will lose your presidency role and all associated privileges. The selected member will become the new president.</p>
            </div>
          </div>

          {/* Member Selection */}
          <div className="space-y-2">
            <Label htmlFor="newPresident">Select New President</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a member to transfer presidency to" />
              </SelectTrigger>
              <SelectContent>
                {eligibleMembers.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    <div className="flex flex-col">
                      <span className="font-medium">{member.name}</span>
                      <span className="text-xs text-muted-foreground">{member.email} • {member.role}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Member Preview */}
          {selectedMember && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Selected Member:</p>
              <p className="text-sm text-muted-foreground">{selectedMember.name} ({selectedMember.email})</p>
              <p className="text-xs text-muted-foreground">Current Role: {selectedMember.role}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransfer}
              disabled={!selectedUserId || isLoading}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Transferring...
                </>
              ) : (
                <>
                  <Crown className="h-4 w-4 mr-2" />
                  Transfer Presidency
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransferPresidencyDialog;