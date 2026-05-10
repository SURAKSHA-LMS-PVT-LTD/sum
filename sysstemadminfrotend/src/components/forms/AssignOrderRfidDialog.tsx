import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useEffect } from "react";

const formSchema = z.object({
  rfidNumber: z.string().min(1, "RFID number is required").regex(/^[A-Z0-9]{12,20}$/, "Invalid RFID format (12-20 alphanumeric characters)"),
});

type FormData = z.infer<typeof formSchema>;

interface Order {
  id: number;
  rfidNumber: string | null;
  userId: number;
  cardType: string;
}

interface AssignOrderRfidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  order: Order;
}

export function AssignOrderRfidDialog({ open, onOpenChange, onSuccess, order }: AssignOrderRfidDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      rfidNumber: order.rfidNumber || "",
    },
  });

  useEffect(() => {
    form.reset({
      rfidNumber: order.rfidNumber || "",
    });
  }, [order, form]);

  const onSubmit = async (data: FormData) => {
    try {
      await api.assignOrderRfid(order.id, data.rfidNumber);
      toast.success("RFID assigned successfully");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to assign RFID");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign RFID</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
              <p><strong>Order ID:</strong> {order.id}</p>
              <p><strong>User ID:</strong> {order.userId}</p>
              <p><strong>Card Type:</strong> {order.cardType}</p>
              {order.rfidNumber && (
                <p><strong>Current RFID:</strong> {order.rfidNumber}</p>
              )}
            </div>

            <FormField
              control={form.control}
              name="rfidNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RFID Number</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="RFID001234567890" 
                      {...field} 
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    12-20 alphanumeric characters (A-Z, 0-9)
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> This will also update the user's RFID and activate the card if it was inactive.
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Assigning..." : "Assign RFID"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
