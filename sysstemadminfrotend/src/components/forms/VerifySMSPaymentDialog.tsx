import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { SMSVerificationAction } from "@/lib/enums";
import { CheckCircle, XCircle } from "lucide-react";

interface SMSPayment {
  id: string;
  instituteId: string;
  requestedCredits: number;
  paymentAmount: string;
  [key: string]: any;
}

interface VerifySMSPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: SMSPayment | null;
  onSuccess: () => void;
}

export function VerifySMSPaymentDialog({
  open,
  onOpenChange,
  payment,
  onSuccess,
}: VerifySMSPaymentDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [action, setAction] = useState<SMSVerificationAction | "">("");
  const [creditsToGrant, setCreditsToGrant] = useState<number>(0);
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState<string>("");

  const resetForm = () => {
    setAction("");
    setAdminNotes("");
    setRejectionReason("");
    setCreditsToGrant(payment?.requestedCredits ?? 0);
  };

  useEffect(() => {
    if (!open) return;
    resetForm();
  }, [open, payment?.id]);

  const handleSubmit = async () => {
    if (!payment) return;

    if (!action) {
      toast({
        title: "Action required",
        description: "Please select Verify or Reject.",
        variant: "destructive",
      });
      return;
    }

    if (action === SMSVerificationAction.REJECT && !rejectionReason.trim()) {
      toast({
        title: "Rejection reason required",
        description: "Please enter a rejection reason.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const payload =
        action === SMSVerificationAction.APPROVE
          ? {
              action: SMSVerificationAction.APPROVE,
              creditsToGrant,
              adminNotes: adminNotes.trim() || "Payment verified successfully",
            }
          : {
              action: SMSVerificationAction.REJECT,
              rejectionReason: rejectionReason.trim(),
              adminNotes: adminNotes.trim() || "Payment rejected",
            };

      await api.verifySMSPayment(payment.id, payload as any);

      toast({
        title: "Success",
        description:
          action === SMSVerificationAction.APPROVE
            ? `Payment verified and ${creditsToGrant} credits granted`
            : "Payment rejected",
      });

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Failed to verify SMS payment:", error);
      toast({
        title: "Error",
        description: "Failed to process payment verification",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Verify SMS Payment #{payment?.id}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Institute ID:</span>
              <p className="font-medium">{payment?.instituteId}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Amount:</span>
              <p className="font-medium">Rs. {payment?.paymentAmount}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Requested Credits:</span>
              <p className="font-medium">{payment?.requestedCredits}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Action *</Label>
            <RadioGroup
              value={action}
              onValueChange={(val) => setAction(val as SMSVerificationAction)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={SMSVerificationAction.APPROVE} id="verify" />
                <Label htmlFor="verify" className="cursor-pointer font-medium">
                  Verify
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={SMSVerificationAction.REJECT} id="reject" />
                <Label htmlFor="reject" className="cursor-pointer text-destructive font-medium">
                  Reject
                </Label>
              </div>
            </RadioGroup>
          </div>

          {action === SMSVerificationAction.APPROVE ? (
            <div className="space-y-2">
              <Label htmlFor="adminNotes">Admin Notes</Label>
              <Textarea
                id="adminNotes"
                placeholder="e.g., Payment proof is valid"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>
          ) : action === SMSVerificationAction.REJECT ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="rejectionReason">Rejection Reason *</Label>
                <Input
                  id="rejectionReason"
                  placeholder="e.g., Invalid payment proof provided"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminNotes">Admin Notes</Label>
                <Textarea
                  id="adminNotes"
                  placeholder="e.g., Uploaded receipt is unclear"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">Please select an action to continue.</div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!action || isLoading || (action === SMSVerificationAction.REJECT && !rejectionReason.trim())}
            variant={action === SMSVerificationAction.REJECT ? "destructive" : "default"}
          >
            {action === SMSVerificationAction.REJECT ? (
              <>
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                Verify
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}