import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader, StatsCard } from "@/components/shared/PageComponents";
import { Receipt, X, CheckCircle, XCircle, Clock, Search, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { DataTable, Column, PaginationMeta } from "@/components/shared/DataTable";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import { InstituteSelector } from "@/components/shared/InstituteSelector";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type StatusFilter = "PENDING" | "VERIFIED" | "REJECTED" | "ALL";

interface InstitutePayment {
  id: string;
  title: string;
  amount: number;
  dueDate: string | null;
  status: string;
  description: string | null;
  createdAt: string;
}

interface PaymentSubmission {
  id: string;
  studentId: string;
  studentName?: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentSlipUrl: string | null;
  status: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
}

export default function InstitutePaymentSubmissionsPage() {
  const { toast } = useToast();

  // Institute & Payment Selection
  const [selectedInstituteId, setSelectedInstituteId] = useState("");
  const [institutePayments, setInstitutePayments] = useState<InstitutePayment[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Submissions
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");

  // Verify dialog
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<PaymentSubmission | null>(null);
  const [verifyAction, setVerifyAction] = useState<"VERIFIED" | "REJECTED">("VERIFIED");
  const [verifyNotes, setVerifyNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [verifying, setVerifying] = useState(false);

  // View dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewSubmission, setViewSubmission] = useState<PaymentSubmission | null>(null);

  // Image preview
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Admin verify student
  const [adminVerifyDialogOpen, setAdminVerifyDialogOpen] = useState(false);
  const [adminVerifyStudentId, setAdminVerifyStudentId] = useState("");
  const [adminVerifying, setAdminVerifying] = useState(false);

  // Stats
  const [stats, setStats] = useState({ total: 0, pending: 0, verified: 0, rejected: 0 });

  // Fetch institute payments when institute selected
  useEffect(() => {
    if (selectedInstituteId) {
      fetchInstitutePayments();
    } else {
      setInstitutePayments([]);
      setSelectedPaymentId("");
    }
  }, [selectedInstituteId]);

  // Fetch submissions when payment selected or filters change
  useEffect(() => {
    if (selectedInstituteId && selectedPaymentId) {
      fetchSubmissions();
    } else {
      setSubmissions([]);
    }
  }, [selectedInstituteId, selectedPaymentId, page, limit, statusFilter]);

  const fetchInstitutePayments = async () => {
    try {
      setPaymentsLoading(true);
      const response = await api.getInstitutePayments(selectedInstituteId, { page: 1, limit: 100 });
      setInstitutePayments(response.payments || response.data || []);
    } catch (error) {
      console.error("Failed to fetch institute payments:", error);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    try {
      setIsLoading(true);
      const response = await api.getInstitutePaymentSubmissions(
        selectedInstituteId,
        selectedPaymentId,
        {
          page,
          limit,
          status: statusFilter === "ALL" ? undefined : statusFilter,
          sortBy: "createdAt",
          sortOrder: "DESC",
        }
      );
      const items = response.submissions || response.data || [];
      setSubmissions(items);

      const total = response.total ?? response.meta?.total ?? items.length;
      setPagination({
        page: response.page || page,
        limit: response.limit || limit,
        total,
        totalPages: Math.ceil(total / (response.limit || limit)),
      });

      // Calculate stats from response or from loaded data
      const pending = items.filter((s: PaymentSubmission) => s.status === "PENDING").length;
      const verified = items.filter((s: PaymentSubmission) => s.status === "VERIFIED").length;
      const rejected = items.filter((s: PaymentSubmission) => s.status === "REJECTED").length;
      setStats({ total, pending, verified, rejected });
    } catch (error) {
      console.error("Failed to fetch submissions:", error);
      toast({
        title: "Error",
        description: "Failed to load payment submissions",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmission = async () => {
    if (!selectedSubmission) return;
    try {
      setVerifying(true);
      await api.verifyInstitutePaymentSubmission(selectedSubmission.id, {
        status: verifyAction,
        rejectionReason: verifyAction === "REJECTED" ? rejectionReason : undefined,
        notes: verifyNotes || undefined,
      });
      toast({
        title: "Success",
        description: `Payment submission ${verifyAction.toLowerCase()} successfully`,
      });
      setVerifyDialogOpen(false);
      setVerifyNotes("");
      setRejectionReason("");
      fetchSubmissions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to verify submission",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleAdminVerifyStudent = async () => {
    if (!adminVerifyStudentId || !selectedPaymentId || !selectedInstituteId) return;
    try {
      setAdminVerifying(true);
      await api.adminVerifyStudentPayment(selectedInstituteId, selectedPaymentId, adminVerifyStudentId);
      toast({
        title: "Success",
        description: `Student ${adminVerifyStudentId} verified for this payment`,
      });
      setAdminVerifyDialogOpen(false);
      setAdminVerifyStudentId("");
      fetchSubmissions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to verify student",
        variant: "destructive",
      });
    } finally {
      setAdminVerifying(false);
    }
  };

  const columns: Column[] = [
    { key: "id", label: "ID" },
    { key: "studentId", label: "Student ID" },
    {
      key: "paymentAmount",
      label: "Amount",
      render: (value: number) => `Rs. ${Number(value).toLocaleString()}`,
    },
    { key: "paymentMethod", label: "Method", type: "badge" },
    { key: "status", label: "Status", type: "badge" },
    { key: "createdAt", label: "Submitted", type: "date" },
    {
      key: "verifiedAt",
      label: "Verified At",
      render: (value: string | null) => value ? new Date(value).toLocaleDateString() : "-",
    },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Payment Submissions"
        description="Review and verify institute payment submissions from students"
        icon={Receipt}
        actions={
          selectedPaymentId ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setAdminVerifyDialogOpen(true)}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Admin Verify Student
              </Button>
              <Button variant="outline" size="sm" onClick={fetchSubmissions} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Institute & Payment Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Select Institute</Label>
          <InstituteSelector
            value={selectedInstituteId}
            onChange={(id) => {
              setSelectedInstituteId(id);
              setSelectedPaymentId("");
              setPage(1);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Select Payment</Label>
          <Select
            value={selectedPaymentId}
            onValueChange={(id) => { setSelectedPaymentId(id); setPage(1); }}
            disabled={!selectedInstituteId || paymentsLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={paymentsLoading ? "Loading..." : "Select a payment"} />
            </SelectTrigger>
            <SelectContent>
              {institutePayments.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title} - Rs. {Number(p.amount).toLocaleString()} ({p.status})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedPaymentId && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatsCard title="Total" value={stats.total} icon={Receipt} />
            <StatsCard title="Pending" value={stats.pending} icon={Clock} />
            <StatsCard title="Verified" value={stats.verified} icon={CheckCircle} />
            <StatsCard title="Rejected" value={stats.rejected} icon={XCircle} />
          </div>

          {/* Status Tabs */}
          <Tabs
            value={statusFilter}
            onValueChange={(v) => { setStatusFilter(v as StatusFilter); setPage(1); }}
            className="mb-6"
          >
            <TabsList className="grid w-full max-w-lg grid-cols-4">
              <TabsTrigger value="ALL">All</TabsTrigger>
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

          {/* Submissions Table */}
          <DataTable
            columns={columns}
            data={submissions}
            isLoading={isLoading}
            onView={(row) => { setViewSubmission(row); setViewDialogOpen(true); }}
            showViewSlip={true}
            slipUrlKey="paymentSlipUrl"
            onImageClick={(url) => setImagePreview(url)}
            pagination={pagination ?? undefined}
            onPageChange={setPage}
            onLimitChange={(l) => { setLimit(l); setPage(1); }}
            customActions={[
              {
                label: "Approve",
                icon: <CheckCircle className="w-4 h-4" />,
                onClick: (row) => {
                  setSelectedSubmission(row);
                  setVerifyAction("VERIFIED");
                  setVerifyDialogOpen(true);
                },
                show: (row) => row.status === "PENDING",
              },
              {
                label: "Reject",
                icon: <XCircle className="w-4 h-4" />,
                onClick: (row) => {
                  setSelectedSubmission(row);
                  setVerifyAction("REJECTED");
                  setVerifyDialogOpen(true);
                },
                show: (row) => row.status === "PENDING",
                variant: "destructive",
              },
            ]}
          />
        </>
      )}

      {!selectedPaymentId && selectedInstituteId && (
        <Card className="shadow-soft">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Receipt className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select a payment to view submissions</p>
          </CardContent>
        </Card>
      )}

      {!selectedInstituteId && (
        <Card className="shadow-soft">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select an institute to get started</p>
          </CardContent>
        </Card>
      )}

      {/* View Details Dialog */}
      <ViewDetailsDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        data={viewSubmission}
        title={`Submission #${viewSubmission?.id || ""}`}
      />

      {/* Verify/Reject Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {verifyAction === "VERIFIED" ? "Approve" : "Reject"} Submission #{selectedSubmission?.id}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm">Student ID</span>
              <span className="font-medium">{selectedSubmission?.studentId}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm">Amount</span>
              <span className="font-medium">Rs. {Number(selectedSubmission?.paymentAmount || 0).toLocaleString()}</span>
            </div>
            {verifyAction === "REJECTED" && (
              <div className="space-y-2">
                <Label>Rejection Reason *</Label>
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleVerifySubmission}
              disabled={verifying || (verifyAction === "REJECTED" && !rejectionReason)}
              variant={verifyAction === "REJECTED" ? "destructive" : "default"}
            >
              {verifying ? "Processing..." : verifyAction === "VERIFIED" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Verify Student Dialog */}
      <Dialog open={adminVerifyDialogOpen} onOpenChange={setAdminVerifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Verify Student Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Manually verify a student's payment without a receipt submission (e.g., cash payment received in person).
            </p>
            <div className="space-y-2">
              <Label>Student ID *</Label>
              <Input
                value={adminVerifyStudentId}
                onChange={(e) => setAdminVerifyStudentId(e.target.value)}
                placeholder="Enter student user ID"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminVerifyDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAdminVerifyStudent}
              disabled={adminVerifying || !adminVerifyStudentId}
            >
              {adminVerifying ? "Verifying..." : "Verify Student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
