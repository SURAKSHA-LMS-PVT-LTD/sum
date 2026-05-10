import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { OrderStatus } from "@/lib/enums";
import { useEffect } from "react";

const formSchema = z.object({
  orderStatus: z.nativeEnum(OrderStatus),
  trackingNumber: z.string().optional(),
  rejectedReason: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface Order {
  id: number;
  orderStatus: string;
  trackingNumber: string | null;
}

interface UpdateOrderStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  order: Order;
}

export function UpdateOrderStatusDialog({ open, onOpenChange, onSuccess, order }: UpdateOrderStatusDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      orderStatus: order.orderStatus as OrderStatus,
      trackingNumber: order.trackingNumber || "",
      rejectedReason: "",
      notes: "",
    },
  });

  useEffect(() => {
    form.reset({
      orderStatus: order.orderStatus as OrderStatus,
      trackingNumber: order.trackingNumber || "",
      rejectedReason: "",
      notes: "",
    });
  }, [order, form]);

  const watchStatus = form.watch("orderStatus");
  const needsTracking = ["DELIVERING", "ON_THE_WAY"].includes(watchStatus);
  const needsRejectionReason = watchStatus === "REJECTED";

  const onSubmit = async (data: FormData) => {
    if (needsTracking && !data.trackingNumber) {
      toast.error("Tracking number is required for delivery status");
      return;
    }
    if (needsRejectionReason && !data.rejectedReason) {
      toast.error("Rejection reason is required");
      return;
    }

    try {
      const payload: any = {
        orderStatus: data.orderStatus,
      };
      if (data.trackingNumber) payload.trackingNumber = data.trackingNumber;
      if (data.rejectedReason) payload.rejectedReason = data.rejectedReason;
      if (data.notes) payload.notes = data.notes;

      await api.updateOrderStatus(order.id, payload);
      toast.success("Order status updated successfully");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to update order status");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Order Status</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p><strong>Order ID:</strong> {order.id}</p>
              <p><strong>Current Status:</strong> {order.orderStatus?.replace(/_/g, " ")}</p>
            </div>

            <FormField
              control={form.control}
              name="orderStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(OrderStatus).map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {needsTracking && (
              <FormField
                control={form.control}
                name="trackingNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tracking Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="TRACK123456" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {needsRejectionReason && (
              <FormField
                control={form.control}
                name="rejectedReason"
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
                    <Textarea placeholder="Optional notes..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Updating..." : "Update Status"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
