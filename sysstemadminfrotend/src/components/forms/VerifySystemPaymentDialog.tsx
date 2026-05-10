import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { PaymentStatus, SubscriptionPlan } from "@/lib/enums";
import { CheckCircle, XCircle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Payment {
  id: string;
  userId: string;
  paymentAmount: string;
  status: string;
  [key: string]: any;
}

interface VerifySystemPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment | null;
  onSuccess: () => void;
}

export function VerifySystemPaymentDialog({
  open,
  onOpenChange,
  payment,
  onSuccess,
}: VerifySystemPaymentDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [action, setAction] = useState<"VERIFIED" | "REJECTED">("VERIFIED");
  const [subscriptionPlan, setSubscriptionPlan] = useState<string>(SubscriptionPlan.PRO_WHATSAPP);
  const [paymentValidityDays, setPaymentValidityDays] = useState<number>(30);
  const [notes, setNotes] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState<string>("");

  useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!payment) return;

    setIsLoading(true);
    try {
      const payload =
        action === "VERIFIED"
          ? {
              status: PaymentStatus.VERIFIED,
              subscriptionPlan,
              paymentValidityDays,
              notes: notes || "Payment verified successfully",
            }
          : {
              status: PaymentStatus.REJECTED,
              rejectionReason,
              notes: notes || "Payment rejected",
            };

      await api.verifyPayment(payment.id, payload as any);

      toast({
        title: "Success",
        description: action === "VERIFIED" 
          ? "Payment verified successfully" 
          : "Payment rejected",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to verify payment:", error);
      toast({
        title: "Error",
        description: "Failed to process payment verification",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setAction("VERIFIED");
    setSubscriptionPlan(SubscriptionPlan.PRO_WHATSAPP);
    setPaymentValidityDays(30);
    setNotes("");
    setRejectionReason("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Verify Payment #{payment?.id}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">User ID:</span>
              <p className="font-medium">{payment?.userId}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Amount:</span>
              <p className="font-medium">Rs. {payment?.paymentAmount}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Action</Label>
            <RadioGroup value={action} onValueChange={(val) => setAction(val as "VERIFIED" | "REJECTED")} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="VERIFIED" id="verify" />
                <Label htmlFor="verify" className="text-green-600 font-medium cursor-pointer">Verify</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="REJECTED" id="reject" />
                <Label htmlFor="reject" className="text-red-600 font-medium cursor-pointer">Reject</Label>
              </div>
            </RadioGroup>
          </div>

          {action === "VERIFIED" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="subscriptionPlan">Subscription Plan</Label>
                <Select value={subscriptionPlan} onValueChange={setSubscriptionPlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(SubscriptionPlan).map((plan) => (
                      <SelectItem key={plan} value={plan}>
                        {plan}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="validityDays">Validity Days</Label>
                <Input
                  id="validityDays"
                  type="number"
                  min={1}
                  value={paymentValidityDays}
                  onChange={(e) => setPaymentValidityDays(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add verification notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="rejectionReason">Rejection Reason *</Label>
                <Input
                  id="rejectionReason"
                  placeholder="e.g., Invalid payment receipt"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="e.g., Receipt number does not match bank records"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
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
            disabled={isLoading || (action === "REJECTED" && !rejectionReason)}
            className={action === "VERIFIED" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
          >
            {action === "VERIFIED" ? (
              <>
                <CheckCircle className="h-4 w-4 mr-1" />
                Verify
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
