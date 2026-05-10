import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

interface Mask {
  maskId: string;
  isActive: boolean;
  displayName: string;
  phoneNumber: string;
}

interface ViewSenderMasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instituteId: string;
  instituteName: string;
}

export function ViewSenderMasksDialog({
  open,
  onOpenChange,
  instituteId,
  instituteName,
}: ViewSenderMasksDialogProps) {
  const { toast } = useToast();
  const [masks, setMasks] = useState<Mask[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && instituteId) {
      fetchMasks();
    }
  }, [open, instituteId]);

  const fetchMasks = async () => {
    try {
      setIsLoading(true);
      const response = await api.getSenderMasks(instituteId);
      setMasks(response.masks || []);
    } catch (error) {
      console.error("Failed to fetch sender masks:", error);
      toast({
        title: "Error",
        description: "Failed to load sender masks",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sender Masks for {instituteName}</DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : masks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No sender masks found for this institute.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mask ID</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {masks.map((mask) => (
                  <TableRow key={mask.maskId}>
                    <TableCell className="font-mono">{mask.maskId}</TableCell>
                    <TableCell>{mask.displayName}</TableCell>
                    <TableCell>{mask.phoneNumber}</TableCell>
                    <TableCell>
                      <Badge variant={mask.isActive ? "default" : "secondary"}>
                        {mask.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
