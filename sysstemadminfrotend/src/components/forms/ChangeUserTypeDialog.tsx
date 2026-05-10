import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Loader2, ShieldCheck } from "lucide-react";

const USER_TYPES = [
  {
    value: "USER",
    label: "USER",
    description: "Full access — can be student, parent, and any institute role",
  },
  {
    value: "USER_WITHOUT_PARENT",
    label: "USER_WITHOUT_PARENT",
    description: "Can be a student but NOT a parent",
  },
  {
    value: "USER_WITHOUT_STUDENT",
    label: "USER_WITHOUT_STUDENT",
    description: "Can be a parent but NOT a student",
  },
  {
    value: "ORGANIZATION_MANAGER",
    label: "ORGANIZATION_MANAGER",
    description: "Organisation-level management access",
  },
  {
    value: "SUPER_ADMIN",
    label: "SUPER_ADMIN",
    description: "System-wide super admin access",
  },
] as const;

interface ChangeUserTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userId: string;
  userName: string;
  currentUserType: string;
}

export function ChangeUserTypeDialog({
  open,
  onOpenChange,
  onSuccess,
  userId,
  userName,
  currentUserType,
}: ChangeUserTypeDialogProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState(currentUserType);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected(currentUserType);
    }
  }, [open, currentUserType]);

  const selectedMeta = USER_TYPES.find((t) => t.value === selected);
  const isUnchanged = selected === currentUserType;

  const handleSubmit = async () => {
    if (isUnchanged) return;
    try {
      setIsSubmitting(true);
      await api.updateUserType(userId, selected);
      toast({
        title: "User type updated",
        description: `${userName} is now ${selected}`,
      });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Failed to update user type:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user type",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Change User Role / Type
          </DialogTitle>
          <DialogDescription>
            Update the role for <strong>{userName}</strong> (ID: {userId})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Current type:
            <Badge variant="outline">{currentUserType}</Badge>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">New User Type</label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger>
                <SelectValue placeholder="Select user type" />
              </SelectTrigger>
              <SelectContent>
                {USER_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedMeta && (
              <p className="text-xs text-muted-foreground">{selectedMeta.description}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || isUnchanged}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Role
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
