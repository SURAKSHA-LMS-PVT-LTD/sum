import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface CreateSenderMaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  instituteId: string;
  instituteName: string;
}

export function CreateSenderMaskForm({
  open,
  onOpenChange,
  onSuccess,
  instituteId,
  instituteName,
}: CreateSenderMaskFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [maskId, setMaskId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isActive, setIsActive] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!maskId || !displayName || !phoneNumber) {
      toast({
        title: "Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      await api.createSenderMask({
        instituteId,
        maskId,
        displayName,
        phoneNumber,
        isActive,
      });

      toast({
        title: "Success",
        description: "Sender mask created successfully",
      });
      
      // Reset form
      setMaskId("");
      setDisplayName("");
      setPhoneNumber("");
      setIsActive(true);
      
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Failed to create sender mask:", error);
      toast({
        title: "Error",
        description: "Failed to create sender mask",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Sender Mask for {instituteName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="maskId">Mask ID *</Label>
            <Input
              id="maskId"
              value={maskId}
              onChange={(e) => setMaskId(e.target.value)}
              placeholder="e.g., MASK_12345"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name *</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g., ABC Institute"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number *</Label>
            <Input
              id="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g., +94771234567"
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">Active</Label>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Mask"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
