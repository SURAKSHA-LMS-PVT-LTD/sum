import React, { useState, useEffect, useCallback } from 'react';
import PageContainer from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Upload,
  Receipt,
  TrendingUp,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { creditsApi, type CreditBalance, type CreditTransaction, type TopUpSubmission, type SubmitTopUpDto } from '@/api/credits.api';
import { uploadWithSignedUrl } from '@/utils/signedUploadHelper';
import PaymentSlipPreviewDialog from '@/components/PaymentSlipPreviewDialog';
import { getBaseUrl } from '@/contexts/utils/auth.api';

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING:  { label: 'Pending',  color: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300', icon: Clock },
  VERIFIED: { label: 'Approved', color: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',   icon: CheckCircle },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',       icon: XCircle },
};

const TX_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  TOP_UP:            { label: 'Top Up',           color: 'text-green-600 dark:text-green-400' },
  ADMIN_ADJUSTMENT:  { label: 'Admin Adjustment', color: 'text-blue-600 dark:text-blue-400' },
  REFUND:            { label: 'Refund',           color: 'text-green-600 dark:text-green-400' },
  BONUS:             { label: 'Bonus',            color: 'text-purple-600 dark:text-purple-400' },
  MIGRATION:         { label: 'Migration',        color: 'text-gray-600 dark:text-gray-400' },
  SMS_SEND:          { label: 'SMS Sent',         color: 'text-orange-600 dark:text-orange-400' },
  EMAIL_SEND:        { label: 'Email Sent',       color: 'text-orange-600 dark:text-orange-400' },
  WHATSAPP_SEND:     { label: 'WhatsApp Sent',    color: 'text-orange-600 dark:text-orange-400' },
  PUSH_NOTIFICATION: { label: 'Push Notification',color: 'text-orange-600 dark:text-orange-400' },
  FEATURE_PURCHASE:  { label: 'Feature Purchase', color: 'text-red-600 dark:text-red-400' },
  STORAGE_PURCHASE:  { label: 'Storage Purchase', color: 'text-red-600 dark:text-red-400' },
};

const PAYMENT_METHODS = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'ONLINE_PAYMENT', label: 'Online Payment' },
  { value: 'CASH_DEPOSIT', label: 'Cash Deposit' },
];

// ═══════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════

export default function InstituteCreditsPage() {
  const { selectedInstitute } = useAuth();
  const { toast } = useToast();
  const instituteId = selectedInstitute?.id;

  // Balance
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);

  // Transactions
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [loadingTx, setLoadingTx] = useState(false);

  // Submissions
  const [submissions, setSubmissions] = useState<TopUpSubmission[]>([]);
  const [subTotal, setSubTotal] = useState(0);
  const [subPage, setSubPage] = useState(1);
  const [subFilter, setSubFilter] = useState<string>('');
  const [loadingSub, setLoadingSub] = useState(false);

  // Top-up dialog
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [topUpForm, setTopUpForm] = useState({
    requestedQuantity: '',
    paymentAmount: '',
    paymentMethod: 'BANK_TRANSFER' as SubmitTopUpDto['paymentMethod'],
    paymentReference: '',
    notes: '',
  });
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState('');

  // Slip preview
  const [previewSlipUrl, setPreviewSlipUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Refreshing
  const [refreshing, setRefreshing] = useState(false);

  // ─── Data loading ─────────────────────────────────────────
  const loadBalance = useCallback(async () => {
    if (!instituteId) return;
    try {
      const data = await creditsApi.getBalance(instituteId);
      setBalance(data);
    } catch {
      // silent — might not have balance yet
      setBalance({ instituteId, balance: 0, totalPurchased: 0, totalUsed: 0, dailyUsed: 0, monthlyUsed: 0, dailyLimit: null, monthlyLimit: null, isActive: true });
    }
  }, [instituteId]);

  const loadTransactions = useCallback(async () => {
    if (!instituteId) return;
    setLoadingTx(true);
    try {
      const data = await creditsApi.getTransactions(instituteId, { page: txPage, limit: 10 });
      setTransactions(data.data);
      setTxTotal(data.total);
    } catch { /* silent */ }
    setLoadingTx(false);
  }, [instituteId, txPage]);

  const loadSubmissions = useCallback(async () => {
    if (!instituteId) return;
    setLoadingSub(true);
    try {
      const data = await creditsApi.getSubmissions(instituteId, {
        status: subFilter || undefined,
        page: subPage,
        limit: 10,
      });
      setSubmissions(data.data);
      setSubTotal(data.total);
    } catch { /* silent */ }
    setLoadingSub(false);
  }, [instituteId, subPage, subFilter]);

  useEffect(() => {
    setLoadingBalance(true);
    loadBalance().finally(() => setLoadingBalance(false));
  }, [loadBalance]);

  useEffect(() => { loadTransactions(); }, [loadTransactions]);
  useEffect(() => { loadSubmissions(); }, [loadSubmissions]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadBalance(), loadTransactions(), loadSubmissions()]);
    setRefreshing(false);
  };

  // ─── Top-up submit ────────────────────────────────────────
  const handleTopUpSubmit = async () => {
    if (!instituteId) return;
    const qty = Number(topUpForm.requestedQuantity);
    const amount = Number(topUpForm.paymentAmount);
    if (!qty || qty <= 0) {
      toast({ title: 'Error', description: 'Requested amount must be > 0', variant: 'destructive' });
      return;
    }
    if (!amount || amount <= 0) {
      toast({ title: 'Error', description: 'Payment amount must be > 0', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      let paymentSlipUrl: string | undefined;

      // Upload slip if provided
      if (slipFile) {
        setUploadProgress('Uploading payment slip...');
        const relativePath = await uploadWithSignedUrl(slipFile, 'institute-payment-receipts', (msg) => {
          setUploadProgress(msg);
        });
        paymentSlipUrl = relativePath;
      }

      setUploadProgress('Submitting top-up request...');
      const today = new Date().toISOString().slice(0, 10);

      await creditsApi.submitTopUp(instituteId, {
        serviceType: 'CREDITS',
        serviceDescription: `${qty} units`,
        requestedQuantity: qty,
        paymentAmount: amount,
        paymentMethod: topUpForm.paymentMethod,
        paymentReference: topUpForm.paymentReference || undefined,
        paymentSlipUrl,
        paymentDate: today,
        notes: topUpForm.notes || undefined,
      });

      toast({ title: 'Success', description: 'Top-up request submitted. Awaiting admin verification.' });
      setTopUpOpen(false);
      resetTopUpForm();
      loadSubmissions();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to submit top-up', variant: 'destructive' });
    } finally {
      setSubmitting(false);
      setUploadProgress('');
    }
  };

  const resetTopUpForm = () => {
    setTopUpForm({
      requestedQuantity: '',
      paymentAmount: '',
      paymentMethod: 'BANK_TRANSFER',
      paymentReference: '',
      notes: '',
    });
    setSlipFile(null);
  };

  const handleViewSlip = (url: string | null) => {
    if (!url) return;
    const base = getBaseUrl();
    const full = url.startsWith('http') ? url : `${base}/upload/file/${url}`;
    setPreviewSlipUrl(full);
    setPreviewOpen(true);
  };

  // ─── Formatting helpers ───────────────────────────────────
  const fmt = (n: number | null | undefined) => {
    if (n == null) return '0.00';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fmtDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const txPageCount = Math.ceil(txTotal / 10) || 1;
  const subPageCount = Math.ceil(subTotal / 10) || 1;

  // ─── Guard ────────────────────────────────────────────────
  if (!instituteId) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Please select an institute to view wallet.</p>
        </div>
      </PageContainer>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════
  return (
    <PageContainer>
      <div className="space-y-6">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Wallet className="h-5 w-5" /> Institute Wallet
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage your wallet balance — used for SMS, email, and platform services
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" onClick={() => setTopUpOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Top Up
            </Button>
          </div>
        </div>

        {/* ── Balance Cards ──────────────────────────────────── */}
        {loadingBalance ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-blue-200 dark:border-blue-800">
              <CardContent className="pt-5 pb-4">
                <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{fmt(balance?.balance)}</p>
                <p className="text-[10px] text-muted-foreground mt-1">wallet balance</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowUpRight className="h-3.5 w-3.5 text-green-500" />
                  <p className="text-xs text-muted-foreground">Total Purchased</p>
                </div>
                <p className="text-xl font-bold">{fmt(balance?.totalPurchased)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownRight className="h-3.5 w-3.5 text-orange-500" />
                  <p className="text-xs text-muted-foreground">Total Used</p>
                </div>
                <p className="text-xl font-bold">{fmt(balance?.totalUsed)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
                  <p className="text-xs text-muted-foreground">Today's Usage</p>
                </div>
                <p className="text-xl font-bold">{fmt(balance?.dailyUsed)}</p>
                {balance?.dailyLimit && (
                  <p className="text-[10px] text-muted-foreground">/ {fmt(balance.dailyLimit)} limit</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Low balance warning ────────────────────────────── */}
        {balance && balance.balance < 50 && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Low Wallet Balance</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Your balance is running low. Top up now to avoid service interruptions.
              </p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100" onClick={() => setTopUpOpen(true)}>
              Top Up Now
            </Button>
          </div>
        )}

        {/* ── Tabs: Submissions & Transactions ───────────────── */}
        <Tabs defaultValue="submissions">
          <TabsList className="w-full grid grid-cols-2 h-auto p-1 gap-1">
            <TabsTrigger value="submissions" className="gap-1.5 w-full justify-center py-2.5">
              <Receipt className="h-3.5 w-3.5" /> Top-Up Requests
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1.5 w-full justify-center py-2.5">
              <TrendingUp className="h-3.5 w-3.5" /> Transaction History
            </TabsTrigger>
          </TabsList>

          {/* ── Submissions Tab ────────────────────────────── */}
          <TabsContent value="submissions" className="mt-4">
            {/* Status filter */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-muted-foreground">Status:</span>
              {['', 'PENDING', 'VERIFIED', 'REJECTED'].map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={subFilter === s ? 'default' : 'outline'}
                  className="h-7 text-xs"
                  onClick={() => { setSubFilter(s); setSubPage(1); }}
                >
                  {s || 'All'}
                </Button>
              ))}
            </div>

            {loadingSub ? (
              <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="font-medium">No top-up requests found</p>
                <p className="text-xs mt-1">Submit a top-up request to add funds to your wallet.</p>
                <Button size="sm" className="mt-3" onClick={() => setTopUpOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Submit Top-Up
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {submissions.map(sub => {
                    const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.PENDING;
                    const Icon = cfg.icon;
                    return (
                      <Card key={sub.id} className="hover:shadow-sm transition-shadow">
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`p-1.5 rounded-lg ${sub.status === 'VERIFIED' ? 'bg-green-50 dark:bg-green-900/30' : sub.status === 'REJECTED' ? 'bg-red-50 dark:bg-red-900/30' : 'bg-yellow-50 dark:bg-yellow-900/30'}`}>
                                <Icon className={`h-4 w-4 ${sub.status === 'VERIFIED' ? 'text-green-600' : sub.status === 'REJECTED' ? 'text-red-600' : 'text-yellow-600'}`} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {sub.requestedQuantity || 0} units
                                  </span>
                                  <Badge className={`text-[10px] h-4 ${cfg.color}`}>{cfg.label}</Badge>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground">
                                    LKR {fmt(sub.paymentAmount)} · {sub.paymentMethod?.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    · {fmtDate(sub.submittedAt || sub.createdAt)}
                                  </span>
                                </div>
                                {sub.status === 'VERIFIED' && sub.grantedQuantity && (
                                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                                    ✓ {sub.grantedQuantity} units granted
                                  </p>
                                )}
                                {sub.status === 'REJECTED' && sub.rejectionReason && (
                                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                                    Reason: {sub.rejectionReason}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {sub.paymentSlipUrl && (
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleViewSlip(sub.paymentSlipUrl)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Pagination */}
                {subPageCount > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSubPage(p => Math.max(1, p - 1))} disabled={subPage <= 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {subPage} / {subPageCount}
                    </span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSubPage(p => Math.min(subPageCount, p + 1))} disabled={subPage >= subPageCount}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ── Transactions Tab ───────────────────────────── */}
          <TabsContent value="transactions" className="mt-4">
            {loadingTx ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p className="font-medium">No transactions yet</p>
                <p className="text-xs mt-1">Transactions will appear here as your wallet is used or topped up.</p>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  {transactions.map(tx => {
                    const isPositive = tx.amount > 0;
                    const typeInfo = TX_TYPE_LABELS[tx.type] || { label: tx.type, color: 'text-gray-600' };
                    return (
                      <div key={tx.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-1.5 rounded-full ${isPositive ? 'bg-green-50 dark:bg-green-900/30' : 'bg-orange-50 dark:bg-orange-900/30'}`}>
                            {isPositive
                              ? <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
                              : <ArrowDownRight className="h-3.5 w-3.5 text-orange-600" />
                            }
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${typeInfo.color}`}>{typeInfo.label}</p>
                            {tx.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[250px]">{tx.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-orange-600'}`}>
                            {isPositive ? '+' : ''}{fmt(tx.amount)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{fmtDate(tx.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {txPageCount > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTxPage(p => Math.max(1, p - 1))} disabled={txPage <= 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {txPage} / {txPageCount}
                    </span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setTxPage(p => Math.min(txPageCount, p + 1))} disabled={txPage >= txPageCount}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ═══ Top-Up Dialog ══════════════════════════════════════ */}
      <Dialog open={topUpOpen} onOpenChange={(open) => { if (!submitting) { setTopUpOpen(open); if (!open) resetTopUpForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" /> Top Up Institute Wallet
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Amount to top up */}
            <div>
              <Label>Requested Amount</Label>
              <Input
                type="number"
                min="1"
                className="mt-1"
                placeholder="e.g. 500"
                value={topUpForm.requestedQuantity}
                onChange={e => setTopUpForm(f => ({ ...f, requestedQuantity: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Wallet funds are universal — can be used for SMS, email, WhatsApp, and all platform services.
              </p>
            </div>

            {/* Payment amount */}
            <div>
              <Label>Payment Amount (LKR)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="mt-1"
                placeholder="e.g. 2500.00"
                value={topUpForm.paymentAmount}
                onChange={e => setTopUpForm(f => ({ ...f, paymentAmount: e.target.value }))}
              />
            </div>

            {/* Payment method */}
            <div>
              <Label>Payment Method</Label>
              <Select value={topUpForm.paymentMethod} onValueChange={(v) => setTopUpForm(f => ({ ...f, paymentMethod: v as any }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Payment reference */}
            <div>
              <Label>Payment Reference <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                className="mt-1"
                placeholder="Bank ref / transaction ID"
                value={topUpForm.paymentReference}
                onChange={e => setTopUpForm(f => ({ ...f, paymentReference: e.target.value }))}
              />
            </div>

            {/* Payment slip upload */}
            <div>
              <Label>Payment Slip <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <div className="mt-1">
                {slipFile ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm truncate flex-1">{slipFile.name}</span>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setSlipFile(null)}>Remove</Button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed cursor-pointer hover:bg-muted/50 transition-colors">
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Click to upload slip (JPG, PNG, PDF)</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,application/pdf"
                      onChange={e => { const f = e.target.files?.[0]; if (f) setSlipFile(f); }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea
                className="mt-1"
                rows={2}
                placeholder="Any additional notes..."
                value={topUpForm.notes}
                onChange={e => setTopUpForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {uploadProgress && (
              <p className="text-xs text-blue-600 animate-pulse">{uploadProgress}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setTopUpOpen(false); resetTopUpForm(); }} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleTopUpSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Slip Preview Dialog ═══════════════════════════════ */}
      {previewSlipUrl && (
        <PaymentSlipPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          url={previewSlipUrl}
        />
      )}
    </PageContainer>
  );
}
