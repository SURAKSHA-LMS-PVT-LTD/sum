import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { api, safeOpenUrl } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageComponents";
import { DataTable, Column, CustomAction } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { RefreshCw, Receipt, CheckCircle, XCircle, Eye } from "lucide-react";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import { VerifyCardPaymentDialog } from "@/components/forms/VerifyCardPaymentDialog";
import { CardPaymentStatus, CardPaymentType } from "@/lib/enums";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CardPayment {
  id: number;
  orderId: number;
  submissionUrl: string;
  paymentType: string;
  paymentAmount: number;
  paymentReference: string | null;
  paymentStatus: string;
  verifiedBy: number | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  order?: { id: number; userId: number; orderStatus: string; cardType: string; };
}

const paymentStatusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  VERIFIED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function CardPaymentsPage() {
  const [payments, setPayments] = useState<CardPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<CardPayment | null>(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 0 });
  const [filters, setFilters] = useState({ paymentStatus: "", paymentType: "" });

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (filters.paymentStatus && filters.paymentStatus !== "all") params.paymentStatus = filters.paymentStatus;
      if (filters.paymentType && filters.paymentType !== "all") params.paymentType = filters.paymentType;

      const response = await api.getAdminCardPayments(params);
      setPayments(response.data || []);
      if (response.meta) {
        setPagination((prev) => ({ ...prev, total: response.meta.total, totalPages: response.meta.totalPages }));
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to fetch payments");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters.paymentStatus, filters.paymentType]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const columns: Column[] = [
    { key: "id", label: "Payment ID" },
    { key: "orderId", label: "Order ID" },
    { key: "order", label: "User ID", render: (order: CardPayment["order"]) => order?.userId || "-" },
    { key: "paymentType", label: "Type", type: "badge" },
    { key: "paymentAmount", label: "Amount", type: "currency" },
    { key: "paymentStatus", label: "Status", render: (value: string) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${paymentStatusColors[value] || ""}`}>{value}</span>
    )},
    { key: "createdAt", label: "Created", type: "date" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader title="Card Payments" description="Manage and verify card order payments" icon={Receipt}
        actions={<Button variant="outline" size="sm" onClick={fetchPayments}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>}
      />

      <div className="flex flex-wrap gap-4 p-4 bg-card rounded-lg border">
        <Select value={filters.paymentStatus || "all"} onValueChange={(value) => setFilters((prev) => ({ ...prev, paymentStatus: value }))}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Payment Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Status</SelectItem>{Object.values(CardPaymentStatus).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filters.paymentType || "all"} onValueChange={(value) => setFilters((prev) => ({ ...prev, paymentType: value }))}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Payment Type" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Types</SelectItem>{Object.values(CardPaymentType).map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <DataTable 
        columns={columns} 
        data={payments} 
        isLoading={loading}
        onView={(row) => { setSelectedPayment(row); setShowViewDialog(true); }}
        onVerify={(row) => { setSelectedPayment(row); setShowVerifyDialog(true); }}
        showViewSlip 
        slipUrlKey="submissionUrl"
        pagination={pagination} 
        onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))} 
        onLimitChange={(limit) => setPagination((prev) => ({ ...prev, limit, page: 1 }))}
        customActions={[
          {
            label: "Approve Payment",
            icon: <CheckCircle className="h-4 w-4" />,
            onClick: (row) => { setSelectedPayment(row); setShowVerifyDialog(true); },
            show: (row) => row.paymentStatus === "PENDING",
          },
          {
            label: "View Slip",
            icon: <Eye className="h-4 w-4" />,
            onClick: (row) => safeOpenUrl(row.submissionUrl),
            show: (row) => !!row.submissionUrl,
          },
        ]}
      />

      {selectedPayment && (
        <>
          <ViewDetailsDialog open={showViewDialog} onOpenChange={setShowViewDialog} title="Payment Details" data={selectedPayment} />
          <VerifyCardPaymentDialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog} onSuccess={fetchPayments} payment={selectedPayment} />
        </>
      )}
      </div>
    </DashboardLayout>
  );
}
