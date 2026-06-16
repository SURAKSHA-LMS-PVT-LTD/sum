import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import {
  Zap, RefreshCw, Search, CheckCircle2, XCircle, Clock, AlertCircle,
  ChevronLeft, ChevronRight, Eye, ShieldCheck, HandCoins, Ban,
  TrendingUp, DollarSign, Activity, CreditCard,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

type OrderStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'CHARGEDBACK';

interface GatewayOrder {
  id: string;
  instituteId: string;
  submittedBy: string;
  provider: string;
  serviceType: string;
  amount: string;
  currency: string;
  requestedCredits: number;
  status: OrderStatus;
  creditsGranted: boolean;
  gatewayPaymentId?: string;
  gatewayMethod?: string;
  webhookPayload?: Record<string, any>;
  tenantPaymentId?: string;
  createdAt: string;
  updatedAt: string;
}

interface Stats {
  totalRevenue: number;
  totalOrders: number;
  successOrders: number;
  pendingOrders: number;
  failedOrders: number;
  byStatus: Record<string, { count: number; totalAmount: number; totalCredits: number }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; icon: React.ElementType }> = {
  PENDING:     { label: 'Pending',     color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300', icon: Clock },
  SUCCESS:     { label: 'Success',     color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',     icon: CheckCircle2 },
  FAILED:      { label: 'Failed',      color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',             icon: XCircle },
  CANCELLED:   { label: 'Cancelled',   color: 'bg-gray-100 text-gray-600 dark:bg-gray-900/40 dark:text-gray-400',         icon: Ban },
  CHARGEDBACK: { label: 'Chargedback', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300', icon: AlertCircle },
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const fmtAmount = (v: string | number) =>
  Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ─── Detail Dialog ─────────────────────────────────────────────────────────────

function OrderDetailDialog({
  order, open, onClose, onManualGrant, onCancel,
}: {
  order: GatewayOrder | null;
  open: boolean;
  onClose: () => void;
  onManualGrant: (orderId: string) => Promise<void>;
  onCancel: (orderId: string, reason: string) => Promise<void>;
}) {
  const [grantLoading, setGrantLoading] = useState(false);
  const [cancelMode, setCancelMode] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  if (!order) return null;

  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.FAILED;
  const StatusIcon = cfg.icon;
  const canGrant  = order.status === 'PENDING' && !order.creditsGranted;
  const canCancel = order.status === 'PENDING' && !order.creditsGranted;

  const doGrant = async () => {
    setGrantLoading(true);
    await onManualGrant(order.id);
    setGrantLoading(false);
    onClose();
  };

  const doCancel = async () => {
    if (!cancelReason.trim()) return;
    setGrantLoading(true);
    await onCancel(order.id, cancelReason);
    setGrantLoading(false);
    setCancelMode(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setCancelMode(false); setCancelReason(''); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Gateway Order
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">{order.id}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {/* Status row */}
          <div className="flex items-center gap-2">
            <Badge className={`gap-1 ${cfg.color}`}>
              <StatusIcon className="h-3 w-3" />
              {cfg.label}
            </Badge>
            {order.creditsGranted && (
              <Badge className="gap-1 bg-green-100 text-green-700">
                <ShieldCheck className="h-3 w-3" /> Credits Granted
              </Badge>
            )}
          </div>

          {/* Key fields */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 bg-muted/30 rounded-lg p-3">
            {[
              ['Institute ID', order.instituteId],
              ['Provider',     order.provider],
              ['Credits',      order.requestedCredits],
              ['Amount',       `LKR ${fmtAmount(order.amount)}`],
              ['Currency',     order.currency],
              ['Method',       order.gatewayMethod ?? '—'],
              ['Gateway Ref',  order.gatewayPaymentId ?? '—'],
              ['Tenant Pmt',   order.tenantPaymentId ?? '—'],
              ['Created',      fmtDate(order.createdAt)],
              ['Updated',      fmtDate(order.updatedAt)],
            ].map(([k, v]) => (
              <div key={k as string}>
                <p className="text-[10px] text-muted-foreground">{k}</p>
                <p className="text-xs font-medium break-all">{v}</p>
              </div>
            ))}
          </div>

          {/* Webhook payload */}
          {order.webhookPayload && Object.keys(order.webhookPayload).length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Webhook Payload</p>
              <pre className="text-[10px] bg-muted/40 rounded p-2 overflow-auto max-h-36 font-mono">
                {JSON.stringify(order.webhookPayload, null, 2)}
              </pre>
            </div>
          )}

          {/* Cancel form */}
          {cancelMode && (
            <div className="space-y-2 border rounded-lg p-3 border-red-200">
              <Label className="text-xs text-red-700">Cancel Reason (required)</Label>
              <Textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="State why this order is being cancelled…"
                rows={2}
                className="text-sm"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          {canCancel && !cancelMode && (
            <Button variant="outline" size="sm" className="text-red-600 border-red-300" onClick={() => setCancelMode(true)}>
              <Ban className="h-3.5 w-3.5 mr-1" /> Cancel Order
            </Button>
          )}
          {cancelMode && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setCancelMode(false)}>Back</Button>
              <Button variant="destructive" size="sm" disabled={!cancelReason.trim() || grantLoading} onClick={doCancel}>
                {grantLoading ? 'Cancelling…' : 'Confirm Cancel'}
              </Button>
            </>
          )}
          {canGrant && !cancelMode && (
            <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700" disabled={grantLoading} onClick={doGrant}>
              <HandCoins className="h-3.5 w-3.5" />
              {grantLoading ? 'Granting…' : 'Manual Grant Credits'}
            </Button>
          )}
          {!cancelMode && (
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stats Cards ──────────────────────────────────────────────────────────────

function StatsRow({ stats }: { stats: Stats | null }) {
  if (!stats) return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
    </div>
  );

  const cards = [
    { label: 'Total Revenue',   value: `LKR ${fmtAmount(stats.totalRevenue)}`, icon: DollarSign, color: 'text-green-600' },
    { label: 'Total Orders',    value: String(stats.totalOrders),              icon: Activity,    color: 'text-blue-600' },
    { label: 'Successful',      value: String(stats.successOrders),            icon: CheckCircle2, color: 'text-green-600' },
    { label: 'Pending / Failed',value: `${stats.pendingOrders} / ${stats.failedOrders}`, icon: Clock, color: 'text-yellow-600' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(c => (
        <Card key={c.label}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
              <p className="text-[11px] text-muted-foreground">{c.label}</p>
            </div>
            <p className="text-lg font-bold">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Orders Table ─────────────────────────────────────────────────────────────

function OrdersTable({
  orders, loading, page, pageCount,
  onPage, onView,
}: {
  orders: GatewayOrder[];
  loading: boolean;
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
  onView: (o: GatewayOrder) => void;
}) {
  if (loading) return (
    <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
  );

  if (orders.length === 0) return (
    <div className="text-center py-12 text-muted-foreground">
      <Zap className="h-10 w-10 mx-auto mb-2 opacity-30" />
      <p className="font-medium">No gateway orders found</p>
    </div>
  );

  return (
    <>
      <div className="space-y-2">
        {orders.map(order => {
          const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.FAILED;
          const Icon = cfg.icon;
          return (
            <Card key={order.id} className="hover:shadow-sm transition-shadow cursor-pointer" onClick={() => onView(order)}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-1.5 rounded-lg ${
                      order.status === 'SUCCESS'   ? 'bg-green-50 dark:bg-green-900/30'
                      : order.status === 'FAILED'  ? 'bg-red-50 dark:bg-red-900/30'
                      : order.status === 'PENDING' ? 'bg-yellow-50 dark:bg-yellow-900/30'
                      : 'bg-gray-50 dark:bg-gray-900/30'
                    }`}>
                      <Icon className={`h-4 w-4 ${
                        order.status === 'SUCCESS'   ? 'text-green-600'
                        : order.status === 'FAILED'  ? 'text-red-600'
                        : order.status === 'PENDING' ? 'text-yellow-600'
                        : 'text-gray-500'
                      }`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{order.requestedCredits} credits</span>
                        <Badge className={`text-[10px] h-4 ${cfg.color}`}>{cfg.label}</Badge>
                        <span className="text-[10px] text-muted-foreground">{order.provider}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {order.currency} {fmtAmount(order.amount)}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                          Institute: {order.instituteId.slice(0, 8)}…
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{fmtDate(order.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {order.creditsGranted && (
                      <ShieldCheck className="h-4 w-4 text-green-500" title="Credits granted" />
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); onView(order); }}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {pageCount}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function GatewayPaymentsPage() {
  const { toast } = useToast();

  const [stats, setStats]               = useState<Stats | null>(null);
  const [orders, setOrders]             = useState<GatewayOrder[]>([]);
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(1);
  const [loading, setLoading]           = useState(false);
  const [refreshing, setRefreshing]     = useState(false);
  const [activeTab, setActiveTab]       = useState('all');

  // Filters
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');

  // Detail dialog
  const [selected, setSelected]         = useState<GatewayOrder | null>(null);
  const [detailOpen, setDetailOpen]     = useState(false);

  const pageCount = Math.ceil(total / 20) || 1;

  const resolvedStatus = activeTab === 'pending'  ? 'PENDING'
                       : activeTab === 'success'  ? 'SUCCESS'
                       : activeTab === 'failed'   ? 'FAILED'
                       : statusFilter || undefined;

  const loadStats = useCallback(async () => {
    try {
      const s = await api.adminGetGatewayStats();
      setStats(s);
    } catch { /* silent */ }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminGetGatewayOrders({
        status:      resolvedStatus,
        provider:    providerFilter || undefined,
        instituteId: search.length >= 8 ? search : undefined,
        page,
        limit: 20,
      });
      setOrders(res.data ?? []);
      setTotal(res.total ?? 0);
    } catch (e: any) {
      toast({ title: 'Failed to load orders', description: e?.message, variant: 'destructive' });
    }
    setLoading(false);
  }, [resolvedStatus, providerFilter, search, page, toast]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { setPage(1); }, [activeTab, statusFilter, providerFilter, search]);
  useEffect(() => { loadOrders(); }, [loadOrders]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadOrders()]);
    setRefreshing(false);
  };

  const handleManualGrant = async (orderId: string) => {
    try {
      await api.adminManualGrantGatewayOrder(orderId);
      toast({ title: 'Credits granted manually' });
      await Promise.all([loadStats(), loadOrders()]);
    } catch (e: any) {
      toast({ title: 'Failed', description: e?.message, variant: 'destructive' });
    }
  };

  const handleCancel = async (orderId: string, reason: string) => {
    try {
      await api.adminCancelGatewayOrder(orderId, reason);
      toast({ title: 'Order cancelled' });
      await Promise.all([loadStats(), loadOrders()]);
    } catch (e: any) {
      toast({ title: 'Failed', description: e?.message, variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> Gateway Payments
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Real-time payment orders via PayHere and other providers
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Stats */}
        <StatsRow stats={stats} />

        {/* PayHere Config Info */}
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <span className="font-semibold text-blue-800 dark:text-blue-300">PayHere Integration</span>
              </div>
              <span className="text-muted-foreground">Merchant ID: <span className="font-mono font-semibold text-foreground">1236300</span></span>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="text-[10px] bg-green-100 text-green-700">lk.suraksha.lms — Active</Badge>
                <Badge className="text-[10px] bg-green-100 text-green-700">suraksha.lk — Active</Badge>
              </div>
              <span className="text-muted-foreground">Webhook: <span className="font-mono text-foreground">/payment-gateway/webhook/PAYHERE</span></span>
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Institute ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={providerFilter || 'ALL'} onValueChange={v => setProviderFilter(v === 'ALL' ? '' : v)}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="All providers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All providers</SelectItem>
              <SelectItem value="PAYHERE">PayHere</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full max-w-md h-auto p-1">
            <TabsTrigger value="all"     className="text-xs py-2">All</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs py-2">
              Pending{stats?.pendingOrders ? ` (${stats.pendingOrders})` : ''}
            </TabsTrigger>
            <TabsTrigger value="success" className="text-xs py-2">Success</TabsTrigger>
            <TabsTrigger value="failed"  className="text-xs py-2">Failed</TabsTrigger>
          </TabsList>

          {['all', 'pending', 'success', 'failed'].map(tab => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <OrdersTable
                orders={orders}
                loading={loading}
                page={page}
                pageCount={pageCount}
                onPage={setPage}
                onView={o => { setSelected(o); setDetailOpen(true); }}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <OrderDetailDialog
        order={selected}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setSelected(null); }}
        onManualGrant={handleManualGrant}
        onCancel={handleCancel}
      />
    </DashboardLayout>
  );
}
