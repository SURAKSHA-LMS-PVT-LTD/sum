import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import { Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { DataTable, Column, PaginationMeta } from "@/components/shared/DataTable";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import { VerifySMSPaymentDialog } from "@/components/forms/VerifySMSPaymentDialog";

interface SMSPayment {
  id: string;
  instituteId: string;
  submittedBy: string;
  requestedCredits: number;
  paymentAmount: string;
  paymentMethod: string;
  paymentReference: string;
  paymentSlipUrl: string | null;
  paymentSlipFilename: string | null;
  status: string;
  submissionNotes: string;
  submittedAt: string | null;
  createdAt: string | null;
}

export default function SMSPaymentPage() {
  const { toast } = useToast();
  const [smsPayments, setSmsPayments] = useState<SMSPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<SMSPayment | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);

  useEffect(() => {
    fetchSMSPayments();
  }, [page, limit]);

  const fetchSMSPayments = async () => {
    try {
      setIsLoading(true);
      const response = await api.getSMSPayments(page, limit);
      setSmsPayments(response.verifications || []);
      setPagination({
        page: response.page || page,
        limit: response.limit || limit,
        total: response.total || 0,
        totalPages: response.totalPages || Math.ceil((response.total || 0) / (response.limit || limit)),
      });
    } catch (error) {
      console.error("Failed to fetch SMS payments:", error);
      toast({
        title: "Error",
        description: "Failed to load SMS payments",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = (payment: SMSPayment) => {
    setSelectedPayment(payment);
    setViewDialogOpen(true);
  };

  const handleVerify = (payment: SMSPayment) => {
    setSelectedPayment(payment);
    setVerifyDialogOpen(true);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  };

  const columns: Column[] = [
    { key: "id", label: "ID" },
    { key: "instituteId", label: "Institute ID" },
    { key: "submittedBy", label: "Submitted By" },
    { key: "requestedCredits", label: "Credits" },
    { key: "paymentAmount", label: "Amount", type: "currency" },
    { key: "paymentMethod", label: "Method", type: "badge" },
    { key: "status", label: "Status", type: "badge" },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="SMS Payment"
        description="Manage SMS credits and payment history"
        icon={Receipt}
      />
      
      <DataTable
        columns={columns}
        data={smsPayments}
        isLoading={isLoading}
        onView={handleView}
        onVerify={handleVerify}
        showViewSlip={true}
        slipUrlKey="paymentSlipUrl"
        pagination={pagination || undefined}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
      />

      <ViewDetailsDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        data={selectedPayment}
        title={`SMS Payment #${selectedPayment?.id || ""}`}
      />

      <VerifySMSPaymentDialog
        open={verifyDialogOpen}
        onOpenChange={setVerifyDialogOpen}
        payment={selectedPayment}
        onSuccess={fetchSMSPayments}
      />
    </DashboardLayout>
  );
}
