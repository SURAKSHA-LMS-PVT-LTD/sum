import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { CheckCircle, XCircle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface SMSApproval {
  messageId: string;
  instituteId?: string;
  instituteName?: string;
  senderName?: string;
  messageTemplate?: string;
  totalRecipients?: number;
  estimatedCredits?: number;
  status?: string;
  [key: string]: any;
}

interface VerifySMSApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approval: SMSApproval | null;
  onSuccess: () => void;
}

export function VerifySMSApprovalDialog({
  open,
  onOpenChange,
  approval,
  onSuccess,
}: VerifySMSApprovalDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState<string>("");

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!approval) return;

    setIsLoading(true);
    try {
      if (action === "approve") {
        await api.approveSMSCampaign(approval.messageId, {
          adminNotes: adminNotes || "Approved – message meets all guidelines",
        });
      } else {
        await api.rejectSMSCampaign(approval.messageId, {
          rejectionReason,
          adminNotes: adminNotes || "Please revise the message content before resubmission",
        });
      }

      toast({
        title: "Success",
        description: action === "approve" 
          ? "SMS campaign approved successfully" 
          : "SMS campaign rejected",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to process SMS approval:", error);
      toast({
        title: "Error",
        description: "Failed to process SMS approval",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setAction("approve");
    setAdminNotes("");
    setRejectionReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Verify SMS Campaign #{approval?.messageId}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Institute:</span>
              <p className="font-medium">{approval?.instituteName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Sender:</span>
              <p className="font-medium">{approval?.senderName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Recipients:</span>
              <p className="font-medium">{approval?.totalRecipients}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Est. Credits:</span>
              <p className="font-medium">{approval?.estimatedCredits}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Message:</Label>
            <p className="text-sm p-2 bg-muted rounded-md">{approval?.messageTemplate}</p>
          </div>

          <div className="space-y-2">
            <Label>Action</Label>
            <RadioGroup value={action} onValueChange={(val) => setAction(val as "approve" | "reject")} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="approve" id="approve" />
                <Label htmlFor="approve" className="text-green-600 font-medium cursor-pointer">Approve</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="reject" id="reject" />
                <Label htmlFor="reject" className="text-red-600 font-medium cursor-pointer">Reject</Label>
              </div>
            </RadioGroup>
          </div>

          {action === "approve" ? (
            <div className="space-y-2">
              <Label htmlFor="adminNotes">Admin Notes</Label>
              <Textarea
                id="adminNotes"
                placeholder="e.g., Approved – exam notification meets all guidelines"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="rejectionReason">Rejection Reason *</Label>
                <Input
                  id="rejectionReason"
                  placeholder="e.g., Inappropriate content detected"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminNotes">Admin Notes</Label>
                <Textarea
                  id="adminNotes"
                  placeholder="e.g., Please revise the message content before resubmission"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || (action === "reject" && !rejectionReason)}
            className={action === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
          >
            {action === "approve" ? (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                Approve
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
