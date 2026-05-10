import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import { Wallet, RefreshCw, Search, CheckCircle, XCircle, Clock, Eye, ArrowUpRight, ArrowDownRight, Plus, Minus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { InstituteSelector } from "@/components/shared/InstituteSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, Column, PaginationMeta } from "@/components/shared/DataTable";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface CreditBalance {
  instituteId: string;
  balance: number;
  totalPurchased: number;
  totalUsed: number;
  dailyUsed: number;
  monthlyUsed: number;
  isActive: boolean;
}

interface CreditTransaction {
  id: string;
  instituteId: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string | null;
  createdAt: string;
}

interface ServicePayment {
  id: string;
  instituteId: string;
  serviceType: string;
  serviceDescription: string | null;
  paymentAmount: number;
  paymentMethod: string;
  paymentReference: string | null;
  paymentSlipUrl: string | null;
  requestedQuantity: number | null;
  grantedQuantity: number | null;
  status: string;
  submittedBy: string;
  submittedAt: string;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
}

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

export default function InstituteCreditsManagementPage() {
  const { toast } = useToast();

  // Institute selection
  const [instituteId, setInstituteId] = useState("");

  // Balance
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Transactions
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txPagination, setTxPagination] = useState<PaginationMeta | null>(null);
  const [loadingTx, setLoadingTx] = useState(false);

  // Top-up submissions (service payments)
  const [submissions, setSubmissions] = useState<ServicePayment[]>([]);
  const [subPage, setSubPage] = useState(1);
  const [subPagination, setSubPagination] = useState<PaginationMeta | null>(null);
  const [subStatusFilter, setSubStatusFilter] = useState("");
  const [loadingSub, setLoadingSub] = useState(false);

  // Dialogs
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustDescription, setAdjustDescription] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<ServicePayment | null>(null);
  const [verifyAction, setVerifyAction] = useState<"VERIFIED" | "REJECTED" | "">("");
  const [verifyQuantity, setVerifyQuantity] = useState("");
  const [verifyRejectionReason, setVerifyRejectionReason] = useState("");
  const [verifyNotes, setVerifyNotes] = useState("");
  const [verifying, setVerifying] = useState(false);

  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewData, setViewData] = useState<any>(null);

  // ─── Data loading ─────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    if (!instituteId) return;
    setLoadingBalance(true);
    try {
      const data = await api.getInstituteCreditsBalance(instituteId);
      setBalance(data);
    } catch (err: any) {
      toast({ title: "Warning", description: err?.message || "Failed to load wallet balance", variant: "destructive" });
      setBalance(null);
    }
    setLoadingBalance(false);
  }, [instituteId]);

  const fetchTransactions = useCallback(async () => {
    if (!instituteId) return;
    setLoadingTx(true);
    try {
      const data = await api.getInstituteCreditsTransactions(instituteId, { page: txPage, limit: 10 });
      setTransactions(data.data || []);
      setTxPagination({
        page: data.page || txPage,
        limit: data.limit || 10,
        total: data.total || 0,
        totalPages: Math.ceil((data.total || 0) / (data.limit || 10)),
      });
    } catch (err: any) {
      toast({ title: "Warning", description: err?.message || "Failed to load transactions", variant: "destructive" });
      setTransactions([]);
    }
    setLoadingTx(false);
  }, [instituteId, txPage]);

  const fetchSubmissions = useCallback(async () => {
    setLoadingSub(true);
    try {
      const data = await api.getAllServicePayments({
        instituteId: instituteId || undefined,
        status: subStatusFilter || undefined,
        page: subPage,
        limit: 10,
      });
      setSubmissions(data.data || []);
      setSubPagination({
        page: data.page || subPage,
        limit: data.limit || 10,
        total: data.total || 0,
        totalPages: Math.ceil((data.total || 0) / (data.limit || 10)),
      });
    } catch (err: any) {
      toast({ title: "Warning", description: err?.message || "Failed to load submissions", variant: "destructive" });
      setSubmissions([]);
    }
    setLoadingSub(false);
  }, [instituteId, subStatusFilter, subPage]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);
  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);
  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const handleRefresh = () => {
    fetchBalance();
    fetchTransactions();
    fetchSubmissions();
  };

  // ─── Adjust Wallet Balance ────────────────────────────────────
  const handleAdjust = async () => {
    if (!instituteId) return;
    const amount = Number(adjustAmount);
    if (!amount) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return;
    }
    setAdjusting(true);
    try {
      await api.adjustInstituteCredits(instituteId, {
        amount,
        description: adjustDescription || undefined,
      });
      toast({ title: "Success", description: `Balance ${amount > 0 ? 'added' : 'deducted'} successfully` });
      setAdjustDialogOpen(false);
      setAdjustAmount("");
      setAdjustDescription("");
      fetchBalance();
      fetchTransactions();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to adjust balance", variant: "destructive" });
    }
    setAdjusting(false);
  };

  // ─── Verify Payment ──────────────────────────────────────
  const handleVerifyPayment = async () => {
    if (!selectedPayment || !verifyAction) return;
    if (verifyAction === "REJECTED" && !verifyRejectionReason.trim()) {
      toast({ title: "Error", description: "Rejection reason is required", variant: "destructive" });
      return;
    }
    setVerifying(true);
    try {
      await api.verifyServicePayment(selectedPayment.id, {
        status: verifyAction,
        grantedQuantity: verifyAction === "VERIFIED" ? Number(verifyQuantity) || undefined : undefined,
        rejectionReason: verifyAction === "REJECTED" ? verifyRejectionReason : undefined,
        notes: verifyNotes || undefined,
      });
      toast({ title: "Success", description: `Payment ${verifyAction === "VERIFIED" ? "approved" : "rejected"}` });
      setVerifyDialogOpen(false);
      resetVerifyForm();
      fetchSubmissions();
      fetchBalance();
      fetchTransactions();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Verification failed", variant: "destructive" });
    }
    setVerifying(false);
  };

  const openVerifyDialog = (payment: ServicePayment) => {
    setSelectedPayment(payment);
    setVerifyQuantity(String(payment.requestedQuantity || ""));
    setVerifyAction("");
    setVerifyRejectionReason("");
    setVerifyNotes("");
    setVerifyDialogOpen(true);
  };

  const resetVerifyForm = () => {
    setSelectedPayment(null);
    setVerifyAction("");
    setVerifyQuantity("");
    setVerifyRejectionReason("");
    setVerifyNotes("");
  };

  // ─── Table columns ───────────────────────────────────────
  const submissionColumns: Column[] = [
    { key: "id", label: "ID" },
    { key: "instituteId", label: "Institute" },
    {
      key: "serviceType",
      label: "Type",
      render: (v: string) => <Badge variant="outline" className="text-[10px]">{v?.replace(/_/g, " ")}</Badge>,
    },
    { key: "requestedQuantity", label: "Amount" },
    { key: "paymentAmount", label: "Amount", type: "currency" },
    { key: "paymentMethod", label: "Method", render: (v: string) => v?.replace(/_/g, " ") },
    {
      key: "status",
      label: "Status",
      render: (v: string) => {
        const colors: Record<string, string> = {
          PENDING: "bg-yellow-100 text-yellow-700",
          VERIFIED: "bg-green-100 text-green-700",
          REJECTED: "bg-red-100 text-red-700",
        };
        return <Badge className={colors[v] || ""}>{v}</Badge>;
      },
    },
  ];

  const txColumns: Column[] = [
    { key: "id", label: "ID" },
    {
      key: "type", label: "Type",
      render: (v: string) => <Badge variant="outline" className="text-[10px]">{v?.replace(/_/g, " ")}</Badge>,
    },
    {
      key: "amount", label: "Amount",
      render: (v: number) => (
        <span className={`font-semibold ${v > 0 ? "text-green-600" : "text-orange-600"}`}>
          {v > 0 ? "+" : ""}{Number(v).toFixed(2)}
        </span>
      ),
    },
    { key: "balanceBefore", label: "Before", render: (v: number) => Number(v).toFixed(2) },
    { key: "balanceAfter", label: "After", render: (v: number) => Number(v).toFixed(2) },
    { key: "description", label: "Description" },
    { key: "createdAt", label: "Date", type: "date" },
  ];

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════
  return (
    <DashboardLayout>
      <PageHeader
        title="Institute Wallet"
        description="Manage wallet balances, verify top-up requests, and adjust balances"
        icon={Wallet}
        actions={
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        }
      />

      {/* Institute selector */}
      <div className="mb-6">
        <InstituteSelector value={instituteId} onChange={(id) => { setInstituteId(id); setTxPage(1); setSubPage(1); }} />
      </div>

      {/* Balance Card */}
      {instituteId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4 mb-6">
          <Card className="border-blue-200 dark:border-blue-800">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground mb-1">Balance</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {balance ? Number(balance.balance).toFixed(2) : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground mb-1">Total Purchased</p>
              <p className="text-xl font-bold">{balance ? Number(balance.totalPurchased).toFixed(2) : "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground mb-1">Total Used</p>
              <p className="text-xl font-bold">{balance ? Number(balance.totalUsed).toFixed(2) : "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs text-muted-foreground mb-1">Daily Used</p>
              <p className="text-xl font-bold">{balance ? Number(balance.dailyUsed).toFixed(2) : "—"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4 flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">Actions</p>
              <Button size="sm" className="w-full" onClick={() => setAdjustDialogOpen(true)}>
                Adjust Balance
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="submissions">
        <TabsList>
          <TabsTrigger value="submissions">Top-Up Requests</TabsTrigger>
          {instituteId && <TabsTrigger value="transactions">Transactions</TabsTrigger>}
        </TabsList>

        {/* ── Submissions Tab ──────────────────────────────── */}
        <TabsContent value="submissions" className="mt-4">
          <div className="flex items-center gap-3 mb-4">
            <Select value={subStatusFilter} onValueChange={(v) => { setSubStatusFilter(v === "ALL" ? "" : v); setSubPage(1); }}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="VERIFIED">Verified</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={submissionColumns}
            data={submissions}
            isLoading={loadingSub}
            onView={(row) => { setViewData(row); setViewDialogOpen(true); }}
            onVerify={(row) => row.status === "PENDING" && openVerifyDialog(row)}
            showViewSlip={true}
            slipUrlKey="paymentSlipUrl"
            pagination={subPagination || undefined}
            onPageChange={setSubPage}
            onLimitChange={(l) => { setSubPage(1); }}
          />
        </TabsContent>

        {/* ── Transactions Tab ─────────────────────────────── */}
        {instituteId && (
          <TabsContent value="transactions" className="mt-4">
            <DataTable
              columns={txColumns}
              data={transactions}
              isLoading={loadingTx}
              onView={(row) => { setViewData(row); setViewDialogOpen(true); }}
              pagination={txPagination || undefined}
              onPageChange={setTxPage}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* ═══ Adjust Wallet Balance Dialog ════════════════════════════════ */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust Wallet Balance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount</Label>
              <p className="text-xs text-muted-foreground mb-1">Positive = add, Negative = deduct</p>
              <Input
                type="number"
                placeholder="e.g. 500 or -100"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={2}
                placeholder="Reason for adjustment..."
                value={adjustDescription}
                onChange={(e) => setAdjustDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)} disabled={adjusting}>Cancel</Button>
            <Button onClick={handleAdjust} disabled={adjusting}>
              {adjusting ? "Adjusting..." : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Verify Payment Dialog ════════════════════════════ */}
      <Dialog open={verifyDialogOpen} onOpenChange={(open) => { if (!verifying) { setVerifyDialogOpen(open); if (!open) resetVerifyForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Top-Up Request #{selectedPayment?.id}</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Institute</p>
                  <p className="font-medium">{selectedPayment.instituteId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium">{selectedPayment.serviceType?.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Requested Amount</p>
                  <p className="font-medium">{selectedPayment.requestedQuantity}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment Amount</p>
                  <p className="font-medium">LKR {Number(selectedPayment.paymentAmount).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Method</p>
                  <p className="font-medium">{selectedPayment.paymentMethod?.replace(/_/g, " ")}</p>
                </div>
                {selectedPayment.paymentReference && (
                  <div>
                    <p className="text-muted-foreground">Reference</p>
                    <p className="font-medium">{selectedPayment.paymentReference}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  variant={verifyAction === "VERIFIED" ? "default" : "outline"}
                  className={verifyAction === "VERIFIED" ? "bg-green-600 hover:bg-green-700 text-white flex-1" : "flex-1"}
                  onClick={() => setVerifyAction("VERIFIED")}
                >
                  <CheckCircle className="h-4 w-4 mr-1" /> Approve
                </Button>
                <Button
                  variant={verifyAction === "REJECTED" ? "destructive" : "outline"}
                  className="flex-1"
                  onClick={() => setVerifyAction("REJECTED")}
                >
                  <XCircle className="h-4 w-4 mr-1" /> Reject
                </Button>
              </div>

              {verifyAction === "VERIFIED" && (
                <div>
                  <Label>Amount to Grant</Label>
                  <Input
                    type="number"
                    min="1"
                    value={verifyQuantity}
                    onChange={(e) => setVerifyQuantity(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Defaults to requested: {selectedPayment.requestedQuantity}
                  </p>
                </div>
              )}

              {verifyAction === "REJECTED" && (
                <div>
                  <Label>Rejection Reason *</Label>
                  <Textarea
                    rows={2}
                    value={verifyRejectionReason}
                    onChange={(e) => setVerifyRejectionReason(e.target.value)}
                    placeholder="Reason for rejection..."
                  />
                </div>
              )}

              <div>
                <Label>Admin Notes (optional)</Label>
                <Textarea
                  rows={2}
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder="Notes..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVerifyDialogOpen(false); resetVerifyForm(); }} disabled={verifying}>Cancel</Button>
            <Button
              onClick={handleVerifyPayment}
              disabled={verifying || !verifyAction}
              className={verifyAction === "REJECTED" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {verifying ? "Processing..." : verifyAction === "VERIFIED" ? "Approve & Fund Wallet" : verifyAction === "REJECTED" ? "Reject" : "Select Action"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ View Details Dialog ══════════════════════════════ */}
      <ViewDetailsDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        data={viewData}
        title="Details"
      />
    </DashboardLayout>
  );
}
