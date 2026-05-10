import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, safeOpenUrl } from "@/lib/api";
import { toast } from "sonner";
import { CardPaymentStatus } from "@/lib/enums";
import { useEffect } from "react";
import { ExternalLink } from "lucide-react";

const formSchema = z.object({
  paymentStatus: z.enum(["VERIFIED", "REJECTED"]),
  rejectionReason: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Payment {
  id: number;
  orderId: number;
  paymentAmount: number;
  paymentType: string;
  paymentStatus: string;
  submissionUrl: string;
}

interface VerifyCardPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  payment: Payment;
}

export function VerifyCardPaymentDialog({ open, onOpenChange, onSuccess, payment }: VerifyCardPaymentDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      paymentStatus: "VERIFIED",
      rejectionReason: "",
      notes: "",
    },
  });

  useEffect(() => {
    form.reset({
      paymentStatus: "VERIFIED",
      rejectionReason: "",
      notes: "",
    });
  }, [payment, form]);

  const watchStatus = form.watch("paymentStatus");
  const needsRejectionReason = watchStatus === "REJECTED";

  const onSubmit = async (data: FormData) => {
    if (needsRejectionReason && !data.rejectionReason) {
      toast.error("Rejection reason is required");
      return;
    }

    try {
      await api.verifyCardPayment(payment.id, {
        paymentStatus: data.paymentStatus,
        rejectionReason: data.rejectionReason || undefined,
        notes: data.notes || undefined,
      });
      toast.success(`Payment ${data.paymentStatus.toLowerCase()} successfully`);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to verify payment");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Verify Payment</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
              <p><strong>Payment ID:</strong> {payment.id}</p>
              <p><strong>Order ID:</strong> {payment.orderId}</p>
              <p><strong>Amount:</strong> Rs. {payment.paymentAmount?.toFixed(2)}</p>
              <p><strong>Type:</strong> {payment.paymentType?.replace(/_/g, " ")}</p>
              <p><strong>Current Status:</strong> {payment.paymentStatus}</p>
            </div>

            {payment.submissionUrl && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Payment Slip</p>
                <div className="flex items-center gap-2">
                  <img 
                    src={payment.submissionUrl} 
                    alt="Payment Slip" 
                    className="w-24 h-24 object-cover rounded border cursor-pointer"
                    onClick={() => safeOpenUrl(payment.submissionUrl)}
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => safeOpenUrl(payment.submissionUrl)}
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    View Full
                  </Button>
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="paymentStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Decision</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select decision" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="VERIFIED">Verify Payment</SelectItem>
                      <SelectItem value="REJECTED">Reject Payment</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {needsRejectionReason && (
              <FormField
                control={form.control}
                name="rejectionReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rejection Reason *</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Reason for rejection..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={form.formState.isSubmitting}
                className={watchStatus === "REJECTED" ? "bg-red-600 hover:bg-red-700" : ""}
              >
                {form.formState.isSubmitting 
                  ? "Processing..." 
                  : watchStatus === "REJECTED" 
                    ? "Reject Payment" 
                    : "Verify Payment"
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
