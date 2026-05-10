import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader, ActionButton, StatsCard } from "@/components/shared/PageComponents";
import { InstituteSelector } from "@/components/shared/InstituteSelector";
import { Wallet, DollarSign, Clock, CheckCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { DataTable, Column, PaginationMeta } from "@/components/shared/DataTable";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function InstitutePaymentsPage() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [instituteId, setInstituteId] = useState("");

  const [formData, setFormData] = useState({
    instituteId: "",
    title: "",
    amount: "",
    dueDate: "",
    description: "",
  });

  useEffect(() => {
    if (instituteId) {
      fetchPayments();
      fetchStats();
    }
  }, [page, limit, instituteId]);

  const fetchPayments = async () => {
    if (!instituteId) return;
    try {
      setIsLoading(true);
      const response = await api.getInstitutePayments(instituteId, { page, limit });
      setPayments(response.data || []);
      if (response.meta) {
        setPagination({
          page: response.meta.page,
          limit: response.meta.limit,
          total: response.meta.total,
          totalPages: response.meta.totalPages,
          hasNextPage: response.meta.hasNextPage,
          hasPreviousPage: response.meta.hasPreviousPage,
        });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load payments", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!instituteId) return;
    try {
      const res = await api.getInstitutePaymentStats(instituteId);
      setStats(res);
    } catch {}
  };

  const handleView = async (payment: any) => {
    try {
      const detail = await api.getInstitutePaymentById(instituteId, payment.id || payment.paymentId);
      setSelectedPayment(detail);
    } catch {
      setSelectedPayment(payment);
    }
    setViewDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formData.instituteId || !formData.title || !formData.amount) {
      toast({ title: "Validation", description: "Institute ID, title, and amount are required", variant: "destructive" });
      return;
    }
    try {
      await api.createInstitutePayment(formData.instituteId, {
        title: formData.title,
        amount: parseFloat(formData.amount),
        dueDate: formData.dueDate || undefined,
        description: formData.description || undefined,
      });
      toast({ title: "Success", description: "Payment request created" });
      setCreateDialogOpen(false);
      setFormData({ instituteId: "", title: "", amount: "", dueDate: "", description: "" });
      if (instituteId) fetchPayments();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create payment", variant: "destructive" });
    }
  };

  const columns: Column[] = [
    { key: "id", label: "ID" },
    { key: "title", label: "Title" },
    { key: "amount", label: "Amount", render: (val: any) => val != null ? `Rs. ${val}` : "-" },
    { key: "dueDate", label: "Due Date", render: (val: any) => val ? new Date(val).toLocaleDateString() : "-" },
    {
      key: "status",
      label: "Status",
      type: "badge",
      render: (val: string) => {
        const colors: Record<string, string> = {
          ACTIVE: "bg-green-100 text-green-800",
          PENDING: "bg-yellow-100 text-yellow-800",
          COMPLETED: "bg-blue-100 text-blue-800",
          CANCELLED: "bg-red-100 text-red-800",
        };
        return <Badge className={colors[val] || "bg-muted"}>{val || "UNKNOWN"}</Badge>;
      },
    },
    { key: "createdAt", label: "Created", render: (val: string) => val ? new Date(val).toLocaleDateString() : "-" },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Institute Payments"
        description="Manage payment requests for institutes"
        icon={Wallet}
        actions={<ActionButton label="Create Payment" onClick={() => setCreateDialogOpen(true)} />}
      />

      {/* Institute selector */}
      <div className="flex flex-wrap gap-3 mb-6 items-end">
        <InstituteSelector
          value={instituteId}
          onChange={(val) => setInstituteId(val)}
          required
          placeholder="Select an institute to load payments"
        />
        <Button onClick={fetchPayments} variant="outline">
          Load
        </Button>
        <Button variant="outline" onClick={() => { fetchPayments(); fetchStats(); }} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatsCard title="Total Payments" value={stats.totalPayments ?? 0} icon={DollarSign} />
          <StatsCard title="Pending" value={stats.pending ?? 0} icon={Clock} />
          <StatsCard title="Completed" value={stats.completed ?? 0} icon={CheckCircle} />
        </div>
      )}

      <DataTable
        columns={columns}
        data={payments}
        isLoading={isLoading}
        onView={handleView}
        pagination={pagination || undefined}
        onPageChange={setPage}
        onLimitChange={setLimit}
      />

      {selectedPayment && (
        <ViewDetailsDialog
          open={viewDialogOpen}
          onOpenChange={setViewDialogOpen}
          title="Payment Details"
          data={selectedPayment}
        />
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Payment Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Institute *</Label>
              <InstituteSelector
                value={formData.instituteId}
                onChange={(val) => setFormData(prev => ({ ...prev, instituteId: val }))}
                required
              />
            </div>
            <div>
              <Label>Title *</Label>
              <Input value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} />
            </div>
            <div>
              <Label>Amount (Rs.) *</Label>
              <Input type="number" value={formData.amount} onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))} />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input type="date" value={formData.dueDate} onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))} />
            </div>
            <Button onClick={handleCreate} className="w-full gradient-primary">Create Payment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
