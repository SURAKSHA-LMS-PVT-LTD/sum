import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  userRfid: z.string().min(1, "RFID is required"),
});

type FormData = z.infer<typeof formSchema>;

interface AssignRfidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userId: string;
  userName: string;
  currentRfid?: string | null;
}

export function AssignRfidDialog({
  open,
  onOpenChange,
  onSuccess,
  userId,
  userName,
  currentRfid,
}: AssignRfidDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userRfid: "",
    },
  });

  // Reset form when dialog opens with current RFID value
  useEffect(() => {
    if (open) {
      form.reset({ userRfid: currentRfid || "" });
    }
  }, [open, currentRfid, form]);

  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);

      await api.registerRfid(userId, data.userRfid);

      toast({
        title: "Success",
        description: "RFID registered successfully",
      });

      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Failed to register RFID:", error);
      toast({
        title: "Error",
        description: "Failed to register RFID",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign RFID to {userName}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="text-sm text-muted-foreground">
              User ID: <span className="font-medium text-foreground">{userId}</span>
            </div>

            <FormField
              control={form.control}
              name="userRfid"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RFID *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter RFID code" {...field} />
                  </FormControl>
                  {currentRfid && (
                    <p className="text-xs text-muted-foreground">
                      Current RFID: {currentRfid}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Assign RFID
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
