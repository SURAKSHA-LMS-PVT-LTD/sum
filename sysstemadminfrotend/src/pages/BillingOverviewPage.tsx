import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import {
  Receipt,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertCircle,
  Globe,
  Server,
  Building2,
  TrendingUp,
  Users,
  CreditCard,
  Search,
  ArrowUpRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TIER_LABELS: Record<string, string> = {
  FREE: "Free",
  STARTER: "Starter",
  PROFESSIONAL: "Professional",
  ENTERPRISE: "Enterprise",
  ISOLATED: "Isolated",
};

const TIER_COLORS: Record<string, string> = {
  FREE: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700",
  STARTER: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  PROFESSIONAL: "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  ENTERPRISE: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  ISOLATED: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
};

const STATUS_COLORS: Record<string, string> = {
  PAID: "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300",
  PENDING: "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300",
  OVERDUE: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300",
};

interface InstituteOverview {
  id: string;
  name: string;
  shortName?: string;
  tier: string;
  subdomain: string | null;
  customDomain: string | null;
  customDomainVerified: boolean;
  billing: {
    baseMonthlyFee: number;
    perUserMonthlyFee: number;
    perSubdomainLoginFee: number;
    smsMaskingMonthlyFee: number;
    currency: string;
  } | null;
  monthlySummary: {
    totalLogins: number;
    subdomainLogins: number;
    customDomainLogins: number;
    totalActiveUsers: number;
    baseFee: number;
    userFee: number;
    loginFee: number;
    smsMaskingFee: number;
    totalFee: number;
    status: string;
    paidAt: string | null;
  } | null;
}

interface BillingOverviewData {
  billingMonth: string;
  summary: {
    totalInstitutes: number;
    tierCounts: Record<string, number>;
    withSubdomain: number;
    withCustomDomain: number;
    totalRevenue: number;
    totalPaid: number;
    totalPending: number;
  };
  institutes: InstituteOverview[];
}

type TierFilter = "ALL" | "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE" | "ISOLATED";

export default function BillingOverviewPage() {
  const { toast } = useToast();
  const [data, setData] = useState<BillingOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState<TierFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getBillingOverview(selectedYear, selectedMonth);
      setData(result);
    } catch (err) {
      console.error("Failed to fetch billing overview:", err);
      toast({ title: "Error", description: "Failed to load billing overview", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  const monthLabel = new Date(selectedYear, selectedMonth - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const formatAmount = (amount: number | null | undefined, currency = "LKR") => {
    if (amount == null) return `${currency} 0.00`;
    return `${currency} ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  };

  // Filtered institutes
  const filteredInstitutes = useMemo(() => {
    if (!data?.institutes) return [];
    return data.institutes.filter(inst => {
      if (tierFilter !== "ALL" && inst.tier !== tierFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return inst.name.toLowerCase().includes(q)
          || (inst.subdomain || "").toLowerCase().includes(q)
          || (inst.customDomain || "").toLowerCase().includes(q)
          || inst.id.includes(q);
      }
      return true;
    });
  }, [data?.institutes, tierFilter, searchQuery]);

  // Stats derived from filtered data
  const paidInstitutes = filteredInstitutes.filter(i => i.monthlySummary?.status === "PAID");
  const pendingInstitutes = filteredInstitutes.filter(i => i.monthlySummary && i.monthlySummary.status !== "PAID");

  return (
    <DashboardLayout>
      <PageHeader
        title="Billing Overview"
        description="Global billing dashboard — all institutes, subscriptions, domains & revenue"
        icon={Receipt}
        actions={
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        }
      />

      {loading && !data && (
        <div className="text-center py-16 text-muted-foreground">Loading billing overview...</div>
      )}

      {data && (
        <div className="space-y-6">
          {/* ── Month Picker ──────────────────────────────────────── */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold min-w-[150px] text-center">{monthLabel}</span>
              <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* ── Summary Cards ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Total Institutes</p>
                </div>
                <p className="text-2xl font-bold">{data.summary.totalInstitutes}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatAmount(data.summary.totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <p className="text-xs text-muted-foreground">Paid</p>
                </div>
                <p className="text-2xl font-bold">{formatAmount(data.summary.totalPaid)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{formatAmount(data.summary.totalPending)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="h-4 w-4 text-blue-600" />
                  <p className="text-xs text-muted-foreground">With Subdomain</p>
                </div>
                <p className="text-2xl font-bold">{data.summary.withSubdomain}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-1">
                  <Server className="h-4 w-4 text-purple-600" />
                  <p className="text-xs text-muted-foreground">Custom Domains</p>
                </div>
                <p className="text-2xl font-bold">{data.summary.withCustomDomain}</p>
              </CardContent>
            </Card>
          </div>

          {/* ── Tier Distribution ─────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subscription Tiers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {Object.entries(data.summary.tierCounts).map(([tier, count]) => (
                  <button
                    key={tier}
                    onClick={() => setTierFilter(tierFilter === tier ? "ALL" : tier as TierFilter)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${
                      tierFilter === tier
                        ? "ring-2 ring-primary ring-offset-1"
                        : "hover:border-primary/50"
                    } ${TIER_COLORS[tier] || TIER_COLORS.FREE}`}
                  >
                    <span className="font-semibold text-lg">{count}</span>
                    <span className="text-sm">{TIER_LABELS[tier] || tier}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Filter Bar ────────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search institutes, subdomains, domains..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Tabs value={tierFilter} onValueChange={(v) => setTierFilter(v as TierFilter)}>
              <TabsList>
                <TabsTrigger value="ALL">All</TabsTrigger>
                <TabsTrigger value="FREE">Free</TabsTrigger>
                <TabsTrigger value="STARTER">Starter</TabsTrigger>
                <TabsTrigger value="PROFESSIONAL">Pro</TabsTrigger>
                <TabsTrigger value="ENTERPRISE">Enterprise</TabsTrigger>
                <TabsTrigger value="ISOLATED">Isolated</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* ── Institute Billing Table ───────────────────────────── */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Institute Billing — {monthLabel}
                  <span className="text-muted-foreground font-normal ml-2">({filteredInstitutes.length} institutes)</span>
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left font-medium p-3">Institute</th>
                      <th className="text-left font-medium p-3">Tier</th>
                      <th className="text-left font-medium p-3">Domain</th>
                      <th className="text-right font-medium p-3">Logins</th>
                      <th className="text-right font-medium p-3">Users</th>
                      <th className="text-right font-medium p-3">Base</th>
                      <th className="text-right font-medium p-3">Login Fee</th>
                      <th className="text-right font-medium p-3">SMS</th>
                      <th className="text-right font-medium p-3">Total</th>
                      <th className="text-center font-medium p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInstitutes.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="text-center py-8 text-muted-foreground">
                          No institutes match the current filters
                        </td>
                      </tr>
                    ) : (
                      filteredInstitutes.map((inst) => (
                        <tr key={inst.id} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="p-3">
                            <div>
                              <p className="font-medium truncate max-w-[200px]">{inst.name}</p>
                              <p className="text-xs text-muted-foreground">{inst.id}</p>
                            </div>
                          </td>
                          <td className="p-3">
                            <Badge className={TIER_COLORS[inst.tier] || TIER_COLORS.FREE}>
                              {TIER_LABELS[inst.tier] || inst.tier}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="space-y-0.5">
                              {inst.subdomain ? (
                                <div className="flex items-center gap-1">
                                  <Globe className="h-3 w-3 text-blue-500" />
                                  <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{inst.subdomain}.suraksha.lk</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">No subdomain</span>
                              )}
                              {inst.customDomain && (
                                <div className="flex items-center gap-1">
                                  <Server className="h-3 w-3 text-purple-500" />
                                  <span className="text-xs font-mono text-purple-600 dark:text-purple-400">{inst.customDomain}</span>
                                  {inst.customDomainVerified ? (
                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                  ) : (
                                    <AlertCircle className="h-3 w-3 text-yellow-500" />
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            {inst.monthlySummary ? (
                              <div>
                                <p className="font-medium">{inst.monthlySummary.totalLogins}</p>
                                {inst.monthlySummary.subdomainLogins > 0 && (
                                  <p className="text-xs text-muted-foreground">{inst.monthlySummary.subdomainLogins} sub</p>
                                )}
                              </div>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            {inst.monthlySummary?.totalActiveUsers ?? <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="p-3 text-right tabular-nums text-xs">
                            {inst.monthlySummary ? formatAmount(inst.monthlySummary.baseFee, inst.billing?.currency) : "—"}
                          </td>
                          <td className="p-3 text-right tabular-nums text-xs">
                            {inst.monthlySummary ? formatAmount(inst.monthlySummary.loginFee, inst.billing?.currency) : "—"}
                          </td>
                          <td className="p-3 text-right tabular-nums text-xs">
                            {inst.monthlySummary ? formatAmount(inst.monthlySummary.smsMaskingFee, inst.billing?.currency) : "—"}
                          </td>
                          <td className="p-3 text-right tabular-nums font-semibold">
                            {inst.monthlySummary ? formatAmount(inst.monthlySummary.totalFee, inst.billing?.currency) : "—"}
                          </td>
                          <td className="p-3 text-center">
                            {inst.monthlySummary ? (
                              <Badge className={STATUS_COLORS[inst.monthlySummary.status] || STATUS_COLORS.PENDING}>
                                {inst.monthlySummary.status === "PAID" && <CheckCircle className="h-3 w-3 mr-1" />}
                                {inst.monthlySummary.status === "PENDING" && <Clock className="h-3 w-3 mr-1" />}
                                {inst.monthlySummary.status}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">No data</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {/* Table Footer — Totals */}
                  {filteredInstitutes.length > 0 && (
                    <tfoot>
                      <tr className="bg-muted/30 font-semibold border-t-2">
                        <td className="p-3" colSpan={3}>
                          Totals ({filteredInstitutes.length} institutes)
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {filteredInstitutes.reduce((s, i) => s + (i.monthlySummary?.totalLogins || 0), 0)}
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {filteredInstitutes.reduce((s, i) => s + (i.monthlySummary?.totalActiveUsers || 0), 0)}
                        </td>
                        <td className="p-3 text-right tabular-nums text-xs">
                          {formatAmount(filteredInstitutes.reduce((s, i) => s + (i.monthlySummary?.baseFee || 0), 0))}
                        </td>
                        <td className="p-3 text-right tabular-nums text-xs">
                          {formatAmount(filteredInstitutes.reduce((s, i) => s + (i.monthlySummary?.loginFee || 0), 0))}
                        </td>
                        <td className="p-3 text-right tabular-nums text-xs">
                          {formatAmount(filteredInstitutes.reduce((s, i) => s + (i.monthlySummary?.smsMaskingFee || 0), 0))}
                        </td>
                        <td className="p-3 text-right tabular-nums">
                          {formatAmount(filteredInstitutes.reduce((s, i) => s + (i.monthlySummary?.totalFee || 0), 0))}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex gap-1 justify-center">
                            <Badge className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-[10px]">{paidInstitutes.length} paid</Badge>
                            <Badge className="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 text-[10px]">{pendingInstitutes.length} pending</Badge>
                          </div>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ── Domain Management Overview ─────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Subdomain Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-600" />
                  Subdomain Directory
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.institutes.filter(i => i.subdomain).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No subdomains configured yet</p>
                  ) : (
                    data.institutes.filter(i => i.subdomain).map(inst => (
                      <div key={inst.id} className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
                        <div>
                          <p className="text-sm font-medium">{inst.name}</p>
                          <p className="text-xs font-mono text-blue-600 dark:text-blue-400">{inst.subdomain}.suraksha.lk</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={TIER_COLORS[inst.tier] || ""} variant="outline">
                            {TIER_LABELS[inst.tier] || inst.tier}
                          </Badge>
                          {inst.monthlySummary && (
                            <span className="text-xs text-muted-foreground">{inst.monthlySummary.subdomainLogins} logins</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Custom Domain Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Server className="h-4 w-4 text-purple-600" />
                  Custom Domains
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.institutes.filter(i => i.customDomain).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No custom domains configured yet</p>
                  ) : (
                    data.institutes.filter(i => i.customDomain).map(inst => (
                      <div key={inst.id} className="flex items-center justify-between p-2.5 rounded-lg bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900">
                        <div>
                          <p className="text-sm font-medium">{inst.name}</p>
                          <p className="text-xs font-mono text-purple-600 dark:text-purple-400">{inst.customDomain}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {inst.customDomainVerified ? (
                            <Badge className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-0">
                              <CheckCircle className="h-3 w-3 mr-1" /> Verified
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-0">
                              <AlertCircle className="h-3 w-3 mr-1" /> Pending DNS
                            </Badge>
                          )}
                          {inst.monthlySummary && (
                            <span className="text-xs text-muted-foreground">{inst.monthlySummary.customDomainLogins} logins</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Revenue Breakdown by Tier ──────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Revenue Breakdown by Tier — {monthLabel}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left font-medium p-2.5">Tier</th>
                      <th className="text-right font-medium p-2.5">Institutes</th>
                      <th className="text-right font-medium p-2.5">Subdomains</th>
                      <th className="text-right font-medium p-2.5">Total Logins</th>
                      <th className="text-right font-medium p-2.5">Active Users</th>
                      <th className="text-right font-medium p-2.5">Base Fees</th>
                      <th className="text-right font-medium p-2.5">Login Fees</th>
                      <th className="text-right font-medium p-2.5">SMS Fees</th>
                      <th className="text-right font-medium p-2.5 font-bold">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE", "ISOLATED"]
                      .filter(tier => data.institutes.some(i => i.tier === tier))
                      .map(tier => {
                        const tierInsts = data.institutes.filter(i => i.tier === tier);
                        const withSub = tierInsts.filter(i => i.subdomain).length;
                        const logins = tierInsts.reduce((s, i) => s + (i.monthlySummary?.totalLogins || 0), 0);
                        const users = tierInsts.reduce((s, i) => s + (i.monthlySummary?.totalActiveUsers || 0), 0);
                        const base = tierInsts.reduce((s, i) => s + (i.monthlySummary?.baseFee || 0), 0);
                        const login = tierInsts.reduce((s, i) => s + (i.monthlySummary?.loginFee || 0), 0);
                        const sms = tierInsts.reduce((s, i) => s + (i.monthlySummary?.smsMaskingFee || 0), 0);
                        const total = tierInsts.reduce((s, i) => s + (i.monthlySummary?.totalFee || 0), 0);
                        return (
                          <tr key={tier} className="border-b hover:bg-muted/20">
                            <td className="p-2.5">
                              <Badge className={TIER_COLORS[tier]}>{TIER_LABELS[tier]}</Badge>
                            </td>
                            <td className="p-2.5 text-right tabular-nums">{tierInsts.length}</td>
                            <td className="p-2.5 text-right tabular-nums">{withSub}</td>
                            <td className="p-2.5 text-right tabular-nums">{logins}</td>
                            <td className="p-2.5 text-right tabular-nums">{users}</td>
                            <td className="p-2.5 text-right tabular-nums">{formatAmount(base)}</td>
                            <td className="p-2.5 text-right tabular-nums">{formatAmount(login)}</td>
                            <td className="p-2.5 text-right tabular-nums">{formatAmount(sms)}</td>
                            <td className="p-2.5 text-right tabular-nums font-semibold">{formatAmount(total)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
