import React, { useState, useEffect } from 'react';
import PageContainer from '@/components/layout/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Receipt,
  CreditCard,
  Users,
  LogIn,
  TrendingUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  Zap,
  Lock,
  Star,
  RefreshCw,
  Globe,
  Server,
  Palette,
  Wallet,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { tenantApi, type PlanInfoResponse, type BillingConfigResponse, type BillingSummaryResponse } from '@/api/tenant.api';
import { creditsApi, type CreditBalance } from '@/api/credits.api';
import { useAppNavigation } from '@/hooks/useAppNavigation';

const TIER_LABELS: Record<string, string> = {
  FREE: 'Free',
  STARTER: 'Starter',
  PROFESSIONAL: 'Professional',
  ENTERPRISE: 'Enterprise',
  ISOLATED: 'Isolated',
};

const TIER_COLORS: Record<string, { badge: string; card: string; text: string }> = {
  FREE:         { badge: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700',       card: 'from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-gray-200 dark:border-gray-700',        text: 'text-gray-700 dark:text-gray-300' },
  STARTER:      { badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800',       card: 'from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800',        text: 'text-blue-700 dark:text-blue-300' },
  PROFESSIONAL: { badge: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800', card: 'from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800',  text: 'text-purple-700 dark:text-purple-300' },
  ENTERPRISE:   { badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',    card: 'from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800',     text: 'text-amber-700 dark:text-amber-300' },
  ISOLATED:     { badge: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800',          card: 'from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800',           text: 'text-red-700 dark:text-red-300' },
};

const TIER_ICONS: Record<string, React.ElementType> = {
  FREE: Star,
  STARTER: Zap,
  PROFESSIONAL: Zap,
  ENTERPRISE: Star,
  ISOLATED: Star,
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: 'Pending', color: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300', icon: Clock },
  PAID:    { label: 'Paid',    color: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',   icon: CheckCircle },
  OVERDUE: { label: 'Overdue', color: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',       icon: AlertCircle },
};

/** Capitalize first letter of each word in a camelCase key */
const formatFeatureLabel = (key: string) =>
  key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

const UPGRADE_FEATURES = [
  { tier: 'STARTER',      label: 'Custom Subdomain Login',     desc: 'students.yourinstitute.lk' },
  { tier: 'STARTER',      label: 'Login Page Branding',        desc: 'Custom logo & colors' },
  { tier: 'STARTER',      label: 'SMS Masking',                desc: 'Send SMS as your institute name' },
  { tier: 'PROFESSIONAL', label: 'Video Login Background',     desc: 'Fully branded login experience' },
  { tier: 'PROFESSIONAL', label: 'Hide Powered By',            desc: 'Remove SurakshaLMS branding' },
  { tier: 'ENTERPRISE',   label: 'Custom Domain',              desc: 'lms.yourinstitute.com' },
  { tier: 'ENTERPRISE',   label: 'White Label',                desc: 'Full white-label platform' },
];

export default function InstituteBillingPage() {
  const { selectedInstitute } = useAuth();
  const navigate = useNavigate();

  const [planInfo, setPlanInfo] = useState<PlanInfoResponse | null>(null);
  const [billingConfig, setBillingConfig] = useState<BillingConfigResponse | null>(null);
  const [billingSummary, setBillingSummary] = useState<BillingSummaryResponse | null>(null);
  const [loginStats, setLoginStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creditBalance, setCreditBalance] = useState<CreditBalance | null>(null);
  const { navigateToPage } = useAppNavigation();
  const [summaryLoading, setSummaryLoading] = useState(false);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);

  const instituteId = selectedInstitute?.id;

  const loadCreditBalance = React.useCallback(() => {
    if (!instituteId) return;
    creditsApi.getBalance(instituteId).then(setCreditBalance).catch(() => null);
  }, [instituteId]);

  const loadPlanData = React.useCallback((force = false) => {
    if (!instituteId) return;
    setLoading(true);
    Promise.all([
      tenantApi.getPlanInfo(instituteId, force).catch(() => null),
      tenantApi.getBillingConfig(instituteId, force).catch(() => null),
    ]).then(([plan, config]) => {
      setPlanInfo(plan);
      setBillingConfig(config);
    }).finally(() => setLoading(false));
  }, [instituteId]);

  const handleRefresh = React.useCallback(async () => {
    if (!instituteId) return;
    setRefreshing(true);
    try {
      const [plan, config] = await Promise.all([
        tenantApi.getPlanInfo(instituteId, true).catch(() => null),
        tenantApi.getBillingConfig(instituteId, true).catch(() => null),
      ]);
      setPlanInfo(plan);
      setBillingConfig(config);
    } finally {
      setRefreshing(false);
    }
  }, [instituteId]);

  useEffect(() => { loadPlanData(); loadCreditBalance(); }, [loadPlanData, loadCreditBalance]);

  useEffect(() => {
    if (!instituteId) return;
    setSummaryLoading(true);
    Promise.all([
      tenantApi.getBillingSummary(instituteId, selectedYear, selectedMonth).catch(() => null),
      tenantApi.getLoginStats(instituteId, selectedYear, selectedMonth).catch(() => null),
    ]).then(([summary, stats]) => {
      setBillingSummary(summary);
      setLoginStats(stats as Record<string, number> | null);
    }).finally(() => setSummaryLoading(false));
  }, [instituteId, selectedYear, selectedMonth]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  const monthLabel = new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const tier = planInfo?.tier || 'FREE';
  const isFree = tier === 'FREE';
  const colors = TIER_COLORS[tier] || TIER_COLORS.FREE;
  const TierIcon = TIER_ICONS[tier] || Star;
  const currency = billingConfig?.currency || 'LKR';

  const formatAmount = (amount: number | undefined | null) => {
    if (amount == null) return `${currency} 0.00`;
    return `${currency} ${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  if (!instituteId) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Please select an institute to view billing.</p>
        </div>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="h-full">
      <div className="space-y-6">

        {/* ── Plan Banner ─────────────────────────────────────── */}
        <div className={`rounded-2xl border bg-gradient-to-r ${colors.card} p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-white/70 dark:bg-white/10 shadow-sm`}>
              <TierIcon className={`h-7 w-7 ${colors.text}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-lg font-bold">{TIER_LABELS[tier] || tier} Plan</span>
                <Badge className={colors.badge}>{isFree ? 'Free' : 'Active'}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {isFree
                  ? 'You are on the free plan. Upgrade to unlock custom domains, branding, SMS masking & more.'
                  : `You have access to all ${TIER_LABELS[tier]} features.`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-60 hover:opacity-100" onClick={handleRefresh} disabled={refreshing} title="Refresh plan info">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            {!isFree && (
              <Button variant="outline" size="sm" onClick={() => navigate('/system-payment')}>
                <CreditCard className="h-4 w-4 mr-1" />
                Make Payment
              </Button>
            )}
            {isFree && (
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => navigate('/system-payment')}>
                <ArrowUpRight className="h-4 w-4 mr-1" />
                Upgrade Plan
              </Button>
            )}
          </div>
        </div>

        {/* ── Free Tier Upgrade Prompt ─────────────────────────── */}
        {isFree && (
          <Card className="border-blue-100 dark:border-blue-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-500" />
                Unlock Premium Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {UPGRADE_FEATURES.map((f) => (
                  <div key={f.label} className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
                    <Lock className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium leading-tight">{f.label}</p>
                      <p className="text-xs text-muted-foreground">{f.desc} · {f.tier.charAt(0) + f.tier.slice(1).toLowerCase()}+</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/institute-settings')}>
                View Plan Comparison
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ── Wallet Balance + Quick Actions ───────────────────── */}
        <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/50">
                  <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Wallet Balance</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {creditBalance ? Number(creditBalance.balance).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Used for SMS, email, and platform services
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => navigateToPage('institute-credits')}>
                  <Wallet className="h-4 w-4 mr-1" /> View Wallet
                </Button>
                <Button size="sm" onClick={() => navigateToPage('institute-credits')}>
                  <ArrowUpRight className="h-4 w-4 mr-1" /> Top Up
                </Button>
              </div>
            </div>
            {creditBalance && creditBalance.balance < 50 && (
              <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Low credit balance — top up to avoid service interruptions.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Features Grid (for paid tiers) ──────────────────── */}
        {!isFree && planInfo?.features && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Plan Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(planInfo.features).map(([key, enabled]) => (
                  <div key={key} className={`flex items-center gap-2 p-2 rounded-lg ${enabled ? 'bg-green-50 dark:bg-green-900/30' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                    {enabled
                      ? <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                      : <AlertCircle className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />}
                    <span className={`text-sm ${enabled ? 'text-green-700 dark:text-green-300' : 'text-gray-500 dark:text-gray-400'}`}>
                      {formatFeatureLabel(key)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Setup Action Cards (paid tiers) ─────────────────── */}
        {!isFree && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Subdomain card */}
            {planInfo?.features?.subdomain && (
              <Card className={planInfo.subdomain ? 'border-green-200 dark:border-green-800' : 'border-amber-200 dark:border-amber-800'}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${planInfo.subdomain ? 'bg-green-50 dark:bg-green-900/30' : 'bg-amber-50 dark:bg-amber-900/30'}`}>
                        <Globe className={`h-5 w-5 ${planInfo.subdomain ? 'text-green-600 dark:text-green-400' : 'text-amber-500 dark:text-amber-400'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Custom Subdomain</p>
                        {planInfo.subdomain ? (
                          <p className="text-xs text-green-700 dark:text-green-400 font-mono mt-0.5">{planInfo.subdomain}.suraksha.lk</p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">Not set up yet</p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={planInfo.subdomain ? 'outline' : 'default'}
                      className={planInfo.subdomain ? '' : 'bg-amber-500 hover:bg-amber-600 text-white'}
                      onClick={() => navigate('/institute-settings?tab=tenant')}
                    >
                      {planInfo.subdomain ? 'Manage' : 'Set Up'}
                      <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                  {!planInfo.subdomain && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 pl-11">
                      Your plan includes a custom subdomain. Set it up in Settings → Domain & Login Page.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Custom domain card (ENTERPRISE+) */}
            {planInfo?.features?.customDomain && (
              <Card className={planInfo.customDomain ? 'border-green-200 dark:border-green-800' : 'border-amber-200 dark:border-amber-800'}>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${planInfo.customDomain ? 'bg-green-50 dark:bg-green-900/30' : 'bg-amber-50 dark:bg-amber-900/30'}`}>
                        <Server className={`h-5 w-5 ${planInfo.customDomain ? 'text-green-600 dark:text-green-400' : 'text-amber-500 dark:text-amber-400'}`} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Custom Domain</p>
                        {planInfo.customDomain ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-xs font-mono text-green-700 dark:text-green-400">{planInfo.customDomain}</p>
                            {planInfo.customDomainVerified
                              ? <Badge className="text-[10px] h-4 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-0">Verified</Badge>
                              : <Badge className="text-[10px] h-4 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-0">Pending DNS</Badge>
                            }
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">Not configured</p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={planInfo.customDomain ? 'outline' : 'default'}
                      className={planInfo.customDomain ? '' : 'bg-amber-500 hover:bg-amber-600 text-white'}
                      onClick={() => navigate('/institute-settings?tab=tenant')}
                    >
                      {planInfo.customDomain ? 'Manage' : 'Set Up'}
                      <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                  {!planInfo.customDomain && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 pl-11">
                      Configure a custom domain (e.g., lms.yourschool.com) in Settings → Domain & Login Page.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Login branding card */}
            {planInfo?.features?.loginBranding && (
              <Card>
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/30">
                        <Palette className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Login Page Branding</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Custom logo, colors & background</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate('/institute-settings?tab=tenant')}>
                      Configure
                      <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── Fee Breakdown (paid tiers only) ─────────────────── */}
        {!isFree && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30"><Receipt className="h-5 w-5 text-blue-600 dark:text-blue-400" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Base Monthly Fee</p>
                    <p className="text-xl font-bold">{formatAmount(billingConfig?.baseMonthlyFee)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/30"><Users className="h-5 w-5 text-green-600 dark:text-green-400" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Per User Fee</p>
                    <p className="text-xl font-bold">{formatAmount(billingConfig?.perUserMonthlyFee)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/30"><LogIn className="h-5 w-5 text-purple-600 dark:text-purple-400" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Per Login Fee</p>
                    <p className="text-xl font-bold">{formatAmount(billingConfig?.perSubdomainLoginFee)}</p>
                    <p className="text-xs text-muted-foreground">{billingConfig?.maxFreeSubdomainLogins || 0} free logins</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30"><TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">SMS Masking Fee</p>
                    <p className="text-xl font-bold">{formatAmount(billingConfig?.smsMaskingMonthlyFee)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Monthly Billing Summary (paid tiers only) ───────── */}
        {!isFree && (
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Monthly Billing Summary
                </CardTitle>
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
                <div className="space-y-3">
                  <Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-full" />
                </div>
              ) : billingSummary ? (
                billingSummary.isEmpty ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">No activity recorded yet</p>
                    <p className="text-xs mt-1">Billing data will appear once logins occur in {monthLabel}</p>
                  </div>
                ) : (
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const cfg = STATUS_CONFIG[billingSummary.status] || STATUS_CONFIG.PENDING;
                      const Icon = cfg.icon;
                      return (
                        <Badge className={cfg.color}>
                          <Icon className="h-3 w-3 mr-1" />{cfg.label}
                        </Badge>
                      );
                    })()}
                    {billingSummary.paidAt && (
                      <span className="text-xs text-muted-foreground">
                        Paid on {new Date(billingSummary.paidAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Total Logins</p>
                      <p className="text-lg font-semibold">{billingSummary.totalLogins}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Subdomain Logins</p>
                      <p className="text-lg font-semibold">{billingSummary.subdomainLogins}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Active Users</p>
                      <p className="text-lg font-semibold">{billingSummary.totalActiveUsers}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-3">Fee Breakdown</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Base Fee</span><span>{formatAmount(billingSummary.baseFee)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">User Fee</span><span>{formatAmount(billingSummary.userFee)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Login Fee</span><span>{formatAmount(billingSummary.loginFee)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">SMS Masking Fee</span><span>{formatAmount(billingSummary.smsMaskingFee)}</span></div>
                      <div className="border-t pt-2 flex justify-between font-medium">
                        <span>Total</span>
                        <span className="text-lg">{formatAmount(billingSummary.totalFee)}</span>
                      </div>
                    </div>
                  </div>
                  {billingSummary.status !== 'PAID' && (
                    <Button onClick={() => navigate('/system-payment')} className="w-full sm:w-auto">
                      <ArrowUpRight className="h-4 w-4 mr-1" />
                      Submit Payment for {monthLabel}
                    </Button>
                  )}
                </div>
                )
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>No billing summary available for {monthLabel}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Login Stats (paid tiers only) ────────────────────── */}
        {!isFree && loginStats && (
          <Card>
            <CardHeader><CardTitle className="text-base">Login Statistics — {monthLabel}</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {(['totalLogins','subdomainLogins','customDomainLogins','uniqueSubdomainUsers','uniqueCustomDomainUsers'] as const).map((key) => (
                  <div key={key} className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">{formatFeatureLabel(key)}</p>
                    <p className="text-lg font-semibold">{loginStats[key] ?? 0}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </PageContainer>
  );
}
