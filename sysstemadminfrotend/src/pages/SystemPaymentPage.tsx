import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import { CreditCard, X, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { DataTable, Column, PaginationMeta } from "@/components/shared/DataTable";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import { VerifySystemPaymentDialog } from "@/components/forms/VerifySystemPaymentDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type StatusFilter = "PENDING" | "VERIFIED" | "REJECTED";

interface Payment {
  id: string;
  userId: string;
  paymentAmount: string;
  paymentMethod: string;
  paymentReference: string | null;
  paymentSlipUrl: string;
  paymentSlipFilename: string;
  status: string;
  paymentDate: string;
  paymentMonth: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  notes: string;
  targetPlan?: string;
  createdAt: string;
  updatedAt: string;
}

export default function SystemPaymentPage() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
  const [monthFilter, setMonthFilter] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageClick = (imageUrl: string) => {
    setImagePreview(imageUrl);
  };

  useEffect(() => {
    fetchPayments();
  }, [page, limit, statusFilter, monthFilter]);

  const fetchPayments = async () => {
    try {
      setIsLoading(true);
      const response = await api.getPaymentsFiltered({
        page,
        limit,
        status: statusFilter,
        month: monthFilter || undefined,
      });
      setPayments(response.payments || []);
      setPagination({
        page: response.page || page,
        limit: response.limit || limit,
        total: response.total || 0,
        totalPages: Math.ceil((response.total || 0) / (response.limit || limit)),
      });
    } catch (error) {
      console.error("Failed to fetch payments:", error);
      toast({
        title: "Error",
        description: "Failed to load payments",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = (payment: Payment) => {
    setSelectedPayment(payment);
    setViewDialogOpen(true);
  };

  const handleVerify = (payment: Payment) => {
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

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as StatusFilter);
    setPage(1);
  };

  const columns: Column[] = [
    { key: "id", label: "ID" },
    { key: "userId", label: "User ID" },
    { key: "paymentAmount", label: "Amount", type: "currency" },
    { key: "paymentMethod", label: "Method", type: "badge" },
    { key: "paymentDate", label: "Payment Date", type: "date" },
    { key: "paymentMonth", label: "Month" },
    { key: "status", label: "Status", type: "badge" },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="System Payment"
        description="Manage system-wide payment verifications"
        icon={CreditCard}
        actions={
          <Button variant="outline" size="sm" onClick={fetchPayments} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Tabs
          value={statusFilter}
          onValueChange={handleStatusChange}
          className="flex-1"
        >
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="PENDING" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-white">
              Pending
            </TabsTrigger>
            <TabsTrigger value="VERIFIED" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">
              Verified
            </TabsTrigger>
            <TabsTrigger value="REJECTED" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
              Rejected
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          type="month"
          value={monthFilter}
          onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }}
          className="w-48"
          placeholder="Filter by month"
        />
      </div>
      
      <DataTable
        columns={columns}
        data={payments}
        isLoading={isLoading}
        onView={handleView}
        onVerify={statusFilter === "PENDING" ? handleVerify : undefined}
        showViewSlip={true}
        slipUrlKey="paymentSlipUrl"
        pagination={pagination ?? undefined}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
        onImageClick={handleImageClick}
      />

      <ViewDetailsDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        data={selectedPayment}
        title={`Payment #${selectedPayment?.id || ""}`}
      />

      <VerifySystemPaymentDialog
        open={verifyDialogOpen}
        onOpenChange={setVerifyDialogOpen}
        payment={selectedPayment}
        onSuccess={fetchPayments}
      />

      {/* Image Preview Modal */}
      {imagePreview && (
        <div 
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setImagePreview(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setImagePreview(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={imagePreview}
            alt="Payment Slip Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </DashboardLayout>
  );
}
