import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import { UserX, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AccountDeletionPage() {
  const { toast } = useToast();
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const res = await api.getAccountDeletionStatus();
      setStatus(res);
    } catch {
      setStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Account Deletion"
        description="View account deletion status and requests"
        icon={UserX}
      />

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Account Deletion Status
          </CardTitle>
          <CardDescription>Check the current status of account deletion for the logged-in account</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : status ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-medium">Status:</span>
                <Badge variant={status.isPendingDeletion ? "destructive" : "secondary"}>
                  {status.isPendingDeletion ? "Pending Deletion" : "No Deletion Request"}
                </Badge>
              </div>
              {status.scheduledDeletionDate && (
                <div>
                  <span className="font-medium">Scheduled Deletion:</span>{" "}
                  {new Date(status.scheduledDeletionDate).toLocaleString()}
                </div>
              )}
              {status.requestedAt && (
                <div>
                  <span className="font-medium">Requested At:</span>{" "}
                  {new Date(status.requestedAt).toLocaleString()}
                </div>
              )}
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-64">
                {JSON.stringify(status, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">No account deletion request found</p>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
