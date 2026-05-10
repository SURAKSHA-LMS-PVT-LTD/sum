import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageComponents";
import { Receipt, ChevronLeft, ChevronRight, RefreshCw, CheckCircle, Clock, AlertCircle, Globe, Server } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { InstituteSelector } from "@/components/shared/InstituteSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const TIER_LABELS: Record<string, string> = {
  FREE: "Free",
  STARTER: "Starter",
  PROFESSIONAL: "Professional",
  ENTERPRISE: "Enterprise",
  ISOLATED: "Isolated",
};

const TIER_COLORS: Record<string, string> = {
  FREE: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
  STARTER: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
  PROFESSIONAL: "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300",
  ENTERPRISE: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
  ISOLATED: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300",
};

const formatFeatureLabel = (key: string) =>
  key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

interface PlanInfo {
  tier: string;
  subdomain?: string | null;
  customDomain?: string | null;
  customDomainVerified?: boolean;
  features: Record<string, boolean>;
  billing: {
    baseMonthlyFee: number;
    perUserMonthlyFee: number;
    perSubdomainLoginFee: number;
    smsMaskingMonthlyFee: number;
    maxFreeSubdomainLogins: number;
  } | null;
}

interface BillingConfig {
  id: string;
  instituteId: string;
  tier: string;
  baseMonthlyFee: number;
  perUserMonthlyFee: number;
  perSubdomainLoginFee: number;
  smsMaskingMonthlyFee: number;
  maxFreeSubdomainLogins: number;
  billingCycleStartDay: number;
  currency: string;
  isActive: boolean;
}

interface BillingSummary {
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
}

interface LoginStats {
  totalLogins: number;
  subdomainLogins: number;
  customDomainLogins: number;
  uniqueSubdomainUsers: number;
  uniqueCustomDomainUsers: number;
}

export default function InstituteBillingManagementPage() {
  const { toast } = useToast();
  const [instituteId, setInstituteId] = useState("");
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [billingConfig, setBillingConfig] = useState<BillingConfig | null>(null);
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);
  const [loginStats, setLoginStats] = useState<LoginStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState("");
  const [savingTier, setSavingTier] = useState(false);
  const [editForm, setEditForm] = useState({
    baseMonthlyFee: "",
    perUserMonthlyFee: "",
    perSubdomainLoginFee: "",
    smsMaskingMonthlyFee: "",
    maxFreeSubdomainLogins: "",
  });
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const fetchBillingData = useCallback(async () => {
    if (!instituteId) return;
    setLoading(true);
    try {
      const [plan, config] = await Promise.all([
        api.getInstitutePlanInfo(instituteId).catch(() => null),
        api.getInstituteBillingConfig(instituteId).catch(() => null),
      ]);
      setPlanInfo(plan);
      setBillingConfig(config);
    } finally {
      setLoading(false);
    }
  }, [instituteId]);

  const fetchSummary = useCallback(async () => {
    if (!instituteId) return;
    setSummaryLoading(true);
    try {
      const [summary, stats] = await Promise.all([
        api.getInstituteBillingSummary(instituteId, selectedYear, selectedMonth).catch(() => null),
        api.getInstituteLoginStats(instituteId, selectedYear, selectedMonth).catch(() => null),
      ]);
      setBillingSummary(summary);
      setLoginStats(stats);
    } finally {
      setSummaryLoading(false);
    }
  }, [instituteId, selectedYear, selectedMonth]);

  useEffect(() => {
    if (instituteId) {
      fetchBillingData();
    } else {
      setPlanInfo(null);
      setBillingConfig(null);
    }
  }, [instituteId, fetchBillingData]);

  useEffect(() => {
    if (instituteId) fetchSummary();
  }, [instituteId, selectedYear, selectedMonth, fetchSummary]);

  const handleEditOpen = () => {
    if (billingConfig) {
      setEditForm({
        baseMonthlyFee: String(billingConfig.baseMonthlyFee ?? 0),
        perUserMonthlyFee: String(billingConfig.perUserMonthlyFee ?? 0),
        perSubdomainLoginFee: String(billingConfig.perSubdomainLoginFee ?? 0),
        smsMaskingMonthlyFee: String(billingConfig.smsMaskingMonthlyFee ?? 0),
        maxFreeSubdomainLogins: String(billingConfig.maxFreeSubdomainLogins ?? 0),
      });
    }
    setEditDialogOpen(true);
  };

  const handleOpenTierDialog = () => {
    setSelectedTier(planInfo?.tier || "FREE");
    setTierDialogOpen(true);
  };

  const handleSaveTier = async () => {
    if (!selectedTier) return;
    setSavingTier(true);
    try {
      await api.updateInstituteTier(instituteId, selectedTier);
      toast({ title: `Tier updated to ${TIER_LABELS[selectedTier] || selectedTier}` });
      setTierDialogOpen(false);
      fetchBillingData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update tier";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSavingTier(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await api.updateInstituteBillingConfig(instituteId, {
        baseMonthlyFee: parseFloat(editForm.baseMonthlyFee) || 0,
        perUserMonthlyFee: parseFloat(editForm.perUserMonthlyFee) || 0,
        perSubdomainLoginFee: parseFloat(editForm.perSubdomainLoginFee) || 0,
        smsMaskingMonthlyFee: parseFloat(editForm.smsMaskingMonthlyFee) || 0,
        maxFreeSubdomainLogins: parseInt(editForm.maxFreeSubdomainLogins) || 0,
      });
      toast({ title: "Billing config updated" });
      setEditDialogOpen(false);
      fetchBillingData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear((y) => y - 1); }
    else setSelectedMonth((m) => m - 1);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear((y) => y + 1); }
    else setSelectedMonth((m) => m + 1);
  };

  const monthLabel = new Date(selectedYear, selectedMonth - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const tier = planInfo?.tier || "FREE";
  const currency = billingConfig?.currency || "LKR";
  const formatAmount = (amount: number | null | undefined) => {
    if (amount == null) return `${currency} 0.00`;
    return `${currency} ${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Institute Billing Management"
        description="View and manage billing configuration and summaries for institutes"
        icon={Receipt}
        actions={
          instituteId ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchBillingData}>
                <RefreshCw className="h-4 w-4 mr-1" /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleOpenTierDialog}>
                Change Tier
              </Button>
              <Button size="sm" onClick={handleEditOpen}>
                Edit Billing Config
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="mb-6">
        <InstituteSelector value={instituteId} onChange={setInstituteId} />
      </div>

      {!instituteId && (
        <div className="text-center py-16 text-muted-foreground">
          <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Select an institute to view billing information</p>
        </div>
      )}

      {instituteId && loading && (
        <div className="text-center py-16 text-muted-foreground">Loading...</div>
      )}

      {instituteId && !loading && (
        <div className="space-y-6">
          {/* Plan & Tier */}
          <div className="flex items-center gap-3 mb-4">
            <Badge className={TIER_COLORS[tier] || TIER_COLORS.FREE}>
              {TIER_LABELS[tier] || tier} Plan
            </Badge>
            {billingConfig?.isActive === false && (
              <Badge variant="destructive">Billing Inactive</Badge>
            )}
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2 py-0" onClick={handleOpenTierDialog}>
              Change Tier
            </Button>
          </div>

          {/* Domain & Subdomain Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className={planInfo?.subdomain ? "border-blue-200 dark:border-blue-800" : ""}>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${planInfo?.subdomain ? "bg-blue-50 dark:bg-blue-900/30" : "bg-muted"}`}>
                    <Globe className={`h-5 w-5 ${planInfo?.subdomain ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Subdomain</p>
                    {planInfo?.subdomain ? (
                      <p className="text-xs font-mono text-blue-600 dark:text-blue-400">{planInfo.subdomain}.suraksha.lk</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not configured</p>
                    )}
                  </div>
                  {planInfo?.features?.subdomain && (
                    <Badge className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-0 text-[10px]">Enabled</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className={planInfo?.customDomain ? "border-purple-200 dark:border-purple-800" : ""}>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${planInfo?.customDomain ? "bg-purple-50 dark:bg-purple-900/30" : "bg-muted"}`}>
                    <Server className={`h-5 w-5 ${planInfo?.customDomain ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Custom Domain</p>
                    {planInfo?.customDomain ? (
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-mono text-purple-600 dark:text-purple-400">{planInfo.customDomain}</p>
                        {planInfo.customDomainVerified ? (
                          <Badge className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-0 text-[10px]">
                            <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Verified
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-0 text-[10px]">
                            <AlertCircle className="h-2.5 w-2.5 mr-0.5" /> Pending DNS
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not configured</p>
                    )}
                  </div>
                  {planInfo?.features?.customDomain && (
                    <Badge className="bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-0 text-[10px]">Enabled</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Billing Config Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Base Monthly Fee</p>
                <p className="text-xl font-bold">{formatAmount(billingConfig?.baseMonthlyFee)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Per User Fee</p>
                <p className="text-xl font-bold">{formatAmount(billingConfig?.perUserMonthlyFee)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Per Login Fee</p>
                <p className="text-xl font-bold">{formatAmount(billingConfig?.perSubdomainLoginFee)}</p>
                <p className="text-xs text-muted-foreground mt-1">{billingConfig?.maxFreeSubdomainLogins ?? 0} free logins</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">SMS Masking Fee</p>
                <p className="text-xl font-bold">{formatAmount(billingConfig?.smsMaskingMonthlyFee)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Features */}
          {planInfo?.features && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Plan Features</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {Object.entries(planInfo.features).map(([key, enabled]) => (
                    <div key={key} className={`flex items-center gap-2 p-2 rounded text-sm ${enabled ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400"}`}>
                      {enabled ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                      <span className="capitalize">{formatFeatureLabel(key)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Monthly Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Monthly Billing Summary</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium min-w-[140px] text-center">{monthLabel}</span>
                  <Button variant="outline" size="icon" onClick={handleNextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {summaryLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : billingSummary ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge className={
                      billingSummary.status === "PAID" ? "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300" :
                      billingSummary.status === "OVERDUE" ? "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300" :
                      "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300"
                    }>
                      {billingSummary.status === "PAID" && <CheckCircle className="h-3 w-3 mr-1" />}
                      {billingSummary.status === "PENDING" && <Clock className="h-3 w-3 mr-1" />}
                      {billingSummary.status === "OVERDUE" && <AlertCircle className="h-3 w-3 mr-1" />}
                      {billingSummary.status}
                    </Badge>
                    {billingSummary.paidAt && (
                      <span className="text-xs text-muted-foreground">
                        Paid: {new Date(billingSummary.paidAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded bg-muted/50">
                      <p className="text-xs text-muted-foreground">Total Logins</p>
                      <p className="text-lg font-semibold">{billingSummary.totalLogins}</p>
                    </div>
                    <div className="p-3 rounded bg-muted/50">
                      <p className="text-xs text-muted-foreground">Active Users</p>
                      <p className="text-lg font-semibold">{billingSummary.totalActiveUsers}</p>
                    </div>
                    <div className="p-3 rounded bg-muted/50">
                      <p className="text-xs text-muted-foreground">Total Fee</p>
                      <p className="text-lg font-semibold">{formatAmount(billingSummary.totalFee)}</p>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Base Fee</span><span>{formatAmount(billingSummary.baseFee)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">User Fee</span><span>{formatAmount(billingSummary.userFee)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Login Fee</span><span>{formatAmount(billingSummary.loginFee)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">SMS Masking Fee</span><span>{formatAmount(billingSummary.smsMaskingFee)}</span></div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No billing summary for {monthLabel}</div>
              )}
            </CardContent>
          </Card>

          {/* Login Stats */}
          {loginStats && (
            <Card>
              <CardHeader><CardTitle className="text-lg">Login Statistics — {monthLabel}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <div className="p-3 rounded bg-muted/50">
                    <p className="text-xs text-muted-foreground">Total Logins</p>
                    <p className="text-lg font-semibold">{loginStats.totalLogins ?? 0}</p>
                  </div>
                  <div className="p-3 rounded bg-muted/50">
                    <p className="text-xs text-muted-foreground">Subdomain Logins</p>
                    <p className="text-lg font-semibold">{loginStats.subdomainLogins ?? 0}</p>
                  </div>
                  <div className="p-3 rounded bg-muted/50">
                    <p className="text-xs text-muted-foreground">Custom Domain</p>
                    <p className="text-lg font-semibold">{loginStats.customDomainLogins ?? 0}</p>
                  </div>
                  <div className="p-3 rounded bg-muted/50">
                    <p className="text-xs text-muted-foreground">Unique Subdomain Users</p>
                    <p className="text-lg font-semibold">{loginStats.uniqueSubdomainUsers ?? 0}</p>
                  </div>
                  <div className="p-3 rounded bg-muted/50">
                    <p className="text-xs text-muted-foreground">Unique Domain Users</p>
                    <p className="text-lg font-semibold">{loginStats.uniqueCustomDomainUsers ?? 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Change Tier Dialog */}
      <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Institute Tier</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Select New Tier</Label>
            <Select value={selectedTier} onValueChange={setSelectedTier}>
              <SelectTrigger>
                <SelectValue placeholder="Select tier" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTier && (
              <p className="text-xs text-muted-foreground">
                Current: <span className="font-medium">{TIER_LABELS[tier] || tier}</span>
                {" → "}
                <span className="font-medium">{TIER_LABELS[selectedTier] || selectedTier}</span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTierDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveTier} disabled={savingTier || selectedTier === tier}>
              {savingTier ? "Saving..." : "Update Tier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Billing Config Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Billing Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Base Monthly Fee</Label>
              <Input type="number" step="0.01" value={editForm.baseMonthlyFee} onChange={(e) => setEditForm({ ...editForm, baseMonthlyFee: e.target.value })} />
            </div>
            <div>
              <Label>Per User Monthly Fee</Label>
              <Input type="number" step="0.01" value={editForm.perUserMonthlyFee} onChange={(e) => setEditForm({ ...editForm, perUserMonthlyFee: e.target.value })} />
            </div>
            <div>
              <Label>Per Subdomain Login Fee</Label>
              <Input type="number" step="0.01" value={editForm.perSubdomainLoginFee} onChange={(e) => setEditForm({ ...editForm, perSubdomainLoginFee: e.target.value })} />
            </div>
            <div>
              <Label>SMS Masking Monthly Fee</Label>
              <Input type="number" step="0.01" value={editForm.smsMaskingMonthlyFee} onChange={(e) => setEditForm({ ...editForm, smsMaskingMonthlyFee: e.target.value })} />
            </div>
            <div>
              <Label>Max Free Subdomain Logins</Label>
              <Input type="number" value={editForm.maxFreeSubdomainLogins} onChange={(e) => setEditForm({ ...editForm, maxFreeSubdomainLogins: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveConfig} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
