import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader, ActionButton, StatsCard } from "@/components/shared/PageComponents";
import { DataTable, Column, PaginationMeta, CustomAction } from "@/components/shared/DataTable";
import { ViewDetailsDialog } from "@/components/shared/ViewDetailsDialog";
import {
  Megaphone, Trash2, Edit, BarChart3, Eye, RefreshCw, Send,
  Activity, Zap, Users, Search, CheckCircle, AlertCircle, Server, Database,
} from "lucide-react";
import { useState, useEffect } from "react";
import { CreateAdvertisementForm } from "@/components/forms/CreateAdvertisementForm";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface Advertisement {
  id: string;
  title: string;
  accessKey: string;
  mediaUrl: string;
  [key: string]: any;
}

const USER_TYPES = ["USER", "STUDENT", "PARENT", "TEACHER", "INSTITUTE_ADMIN", "SUPER_ADMIN"];
const SUB_PLANS = ["FREE", "WHATSAPP", "PREMIUM", "ENTERPRISE"];
const DELIVERY_MODES = ["sms", "email", "whatsapp", "telegram", "push-web", "push-mobile"];

const adColumns: Column[] = [
  { key: "id", label: "ID", type: "text" },
  { key: "title", label: "Title", type: "text" },
  { key: "mediaType", label: "Type", type: "badge" },
  { key: "priority", label: "Priority", type: "text" },
  { key: "isActive", label: "Active", render: (v: boolean) => (
    <Badge className={v ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
      {v ? "Active" : "Inactive"}
    </Badge>
  )},
  { key: "startDate", label: "Start", type: "date" },
  { key: "endDate", label: "End", type: "date" },
];

export default function AdvertisementPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("list");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Advertisement | null>(null);
  const [advertisements, setAdvertisements] = useState<Advertisement[]>([]);
  const [activeAds, setActiveAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLoading, setActiveLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1, limit: 10, total: 0, totalPages: 1,
    hasNextPage: false, hasPreviousPage: false,
  });

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editAccessKey, setEditAccessKey] = useState("");
  const [editing, setEditing] = useState(false);

  // Manual Send state
  const [manualAdId, setManualAdId] = useState("");
  const [manualUserTypes, setManualUserTypes] = useState<string[]>([]);
  const [manualSubPlans, setManualSubPlans] = useState<string[]>([]);
  const [manualModes, setManualModes] = useState<string[]>([]);
  const [manualInstituteIds, setManualInstituteIds] = useState("");
  const [checkResult, setCheckResult] = useState<any>(null);
  const [sendResult, setSendResult] = useState<any>(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);

  // User Ad Preview state
  const [previewUserId, setPreviewUserId] = useState("");
  const [previewAdId, setPreviewAdId] = useState("");
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Stats state
  const [stats, setStats] = useState<any>(null);
  const [cacheStatus, setCacheStatus] = useState<any>(null);
  const [currentCache, setCurrentCache] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsStartDate, setStatsStartDate] = useState("");
  const [statsEndDate, setStatsEndDate] = useState("");
  const [deliveryUserId, setDeliveryUserId] = useState("");
  const [deliveryInstituteId, setDeliveryInstituteId] = useState("");
  const [deliveryStartDate, setDeliveryStartDate] = useState("");
  const [deliveryEndDate, setDeliveryEndDate] = useState("");
  const [deliveryLookupLoading, setDeliveryLookupLoading] = useState(false);
  const [deliveryLookup, setDeliveryLookup] = useState<any>(null);

  const fetchAdvertisements = async (page = 1, limit = 10) => {
    try {
      setLoading(true);
      const response = await api.getAdvertisements(page, limit);
      setAdvertisements(response.advertisements || []);
      setPagination({
        page: response.currentPage || 1,
        limit: response.limit || 10,
        total: response.total || 0,
        totalPages: response.totalPages || 1,
        hasNextPage: response.currentPage < response.totalPages,
        hasPreviousPage: response.currentPage > 1,
      });
    } catch {
      toast({ title: "Error", description: "Failed to fetch advertisements", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveAds = async () => {
    try {
      setActiveLoading(true);
      const response = await api.getActiveAdvertisements();
      setActiveAds(response.advertisements || response.data || response || []);
    } catch {
      // ignore
    } finally {
      setActiveLoading(false);
    }
  };

  const fetchAllStats = async () => {
    try {
      setStatsLoading(true);
      const [statsRes, cacheRes, currentCacheRes, analyticsRes] = await Promise.allSettled([
        api.getAdvertisementStats(statsStartDate || undefined, statsEndDate || undefined),
        api.getAdvertisementCacheStatus(),
        api.getAdvertisementCurrentCache(),
        api.getManualSendAnalytics(statsStartDate || undefined, statsEndDate || undefined),
      ]);

      if (statsRes.status === "fulfilled") setStats(statsRes.value?.data?.delivery || statsRes.value?.data || statsRes.value);
      if (cacheRes.status === "fulfilled") setCacheStatus(cacheRes.value?.data || cacheRes.value);
      if (currentCacheRes.status === "fulfilled") setCurrentCache(currentCacheRes.value?.data || currentCacheRes.value);
      if (analyticsRes.status === "fulfilled") setAnalytics(analyticsRes.value?.data || analyticsRes.value);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleDeliveryLookup = async () => {
    if (!deliveryUserId.trim()) {
      toast({ title: "Validation", description: "User ID is required", variant: "destructive" });
      return;
    }

    try {
      setDeliveryLookupLoading(true);
      const response = await api.getAdvertisementDeliveryByUser({
        userId: deliveryUserId.trim(),
        instituteId: deliveryInstituteId.trim() || undefined,
        startDate: deliveryStartDate || undefined,
        endDate: deliveryEndDate || undefined,
        limit: 300,
      });
      setDeliveryLookup(response?.data || response);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to load delivery history", variant: "destructive" });
    } finally {
      setDeliveryLookupLoading(false);
    }
  };

  useEffect(() => { fetchAdvertisements(); }, []);

  useEffect(() => {
    if (activeTab === "active") fetchActiveAds();
    if (activeTab === "stats") fetchAllStats();
  }, [activeTab]);

  const handleView = (ad: Advertisement) => { setSelectedAd(ad); setViewDialogOpen(true); };

  const handleEdit = (ad: Advertisement) => {
    setSelectedAd(ad);
    setEditTitle(ad.title || "");
    setEditAccessKey(ad.accessKey || "");
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedAd) return;
    try {
      setEditing(true);
      await api.updateAdvertisement(selectedAd.id, { title: editTitle, accessKey: editAccessKey });
      toast({ title: "Success", description: "Advertisement updated" });
      setEditDialogOpen(false);
      fetchAdvertisements(pagination.page, pagination.limit);
    } catch {
      toast({ title: "Error", description: "Failed to update advertisement", variant: "destructive" });
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async (ad: Advertisement) => {
    if (!confirm(`Delete advertisement "${ad.title}"?`)) return;
    try {
      await api.deleteAdvertisement(ad.id);
      toast({ title: "Success", description: "Advertisement deleted" });
      fetchAdvertisements(pagination.page, pagination.limit);
    } catch {
      toast({ title: "Error", description: "Failed to delete advertisement", variant: "destructive" });
    }
  };

  const handleCheckSending = async () => {
    if (!manualAdId) {
      toast({ title: "Validation", description: "Select an advertisement first", variant: "destructive" });
      return;
    }
    try {
      setManualLoading(true);
      setCheckResult(null);
      const instituteIds = manualInstituteIds.split(",").map(s => s.trim()).filter(Boolean);
      const subscriptionPlans = manualSubPlans.length ? manualSubPlans : undefined;
      // Derive targetType from form selections
      const targetType = instituteIds.length > 0 ? 'institute_users'
        : subscriptionPlans ? 'subscription_plan_users'
        : 'all_users';
      const res = await api.checkAdvertisementSending({
        advertisementId: manualAdId,
        targetType,
        instituteIds: instituteIds.length > 0 ? instituteIds : undefined,
        subscriptionPlans,
      });
      setCheckResult(res);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Check sending failed", variant: "destructive" });
    } finally {
      setManualLoading(false);
    }
  };

  const handleSendManually = async () => {
    if (!manualAdId) {
      toast({ title: "Validation", description: "Select an advertisement first", variant: "destructive" });
      return;
    }
    if (!confirm("Send this advertisement now to matching users?")) return;
    try {
      setSendLoading(true);
      setSendResult(null);
      const instituteIds = manualInstituteIds.split(",").map(s => s.trim()).filter(Boolean);
      const subscriptionPlans = manualSubPlans.length ? manualSubPlans : undefined;
      const targetType = instituteIds.length > 0 ? 'institute_users'
        : subscriptionPlans ? 'subscription_plan_users'
        : 'all_users';
      const res = await api.sendAdvertisementManually({
        advertisementId: manualAdId,
        targetType,
        instituteIds: instituteIds.length > 0 ? instituteIds : undefined,
        subscriptionPlans,
      });
      setSendResult(res);
      toast({ title: "Success", description: "Advertisement sent manually" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Send failed", variant: "destructive" });
    } finally {
      setSendLoading(false);
    }
  };

  const handlePreviewUserAds = async () => {
    if (!previewUserId.trim() || !previewAdId) {
      toast({ title: "Validation", description: "Enter a user ID and select an advertisement", variant: "destructive" });
      return;
    }
    try {
      setPreviewLoading(true);
      setPreviewResult(null);
      const res = await api.checkAdvertisementSending({
        advertisementId: previewAdId,
        targetType: 'specific_users',
        specificUserIds: [previewUserId.trim()],
      });
      setPreviewResult(res);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Preview failed", variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const toggleItem = (arr: string[], item: string, setArr: (v: string[]) => void) => {
    setArr(arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]);
  };

  const customActions: CustomAction[] = [
    { label: "Edit", icon: <Edit className="w-4 h-4" />, onClick: handleEdit },
    { label: "Delete", icon: <Trash2 className="w-4 h-4" />, onClick: handleDelete, variant: "destructive" },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Advertisements"
        description="Manage advertisements, campaigns, manual sending, and analytics"
        icon={Megaphone}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fetchAdvertisements(pagination.page, pagination.limit)} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <ActionButton label="Create Advertisement" onClick={() => setCreateDialogOpen(true)} />
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="list" className="flex items-center gap-2">
            <Megaphone className="h-4 w-4" /> All Ads
          </TabsTrigger>
          <TabsTrigger value="active" className="flex items-center gap-2">
            <Eye className="h-4 w-4" /> Active Ads
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <Send className="h-4 w-4" /> Manual Send
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Statistics
          </TabsTrigger>
        </TabsList>

        {/* All Ads */}
        <TabsContent value="list">
          <DataTable
            columns={adColumns}
            data={advertisements}
            isLoading={loading}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            pagination={pagination}
            onPageChange={(p) => fetchAdvertisements(p, pagination.limit)}
            onLimitChange={(l) => fetchAdvertisements(1, l)}
            customActions={customActions}
          />
        </TabsContent>

        {/* Active Ads */}
        <TabsContent value="active">
          <div className="flex justify-end mb-3">
            <Button variant="outline" onClick={fetchActiveAds} disabled={activeLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${activeLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          <DataTable
            columns={adColumns}
            data={activeAds}
            isLoading={activeLoading}
            onView={handleView}
          />
        </TabsContent>

        {/* Manual Send */}
        <TabsContent value="manual" className="space-y-6">

          {/* User Ad Preview */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                User Ad Preview
              </CardTitle>
              <CardDescription>
                Enter a student's user ID to check if a specific advertisement will reach them
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Student / User ID</Label>
                  <Input
                    placeholder="Enter user ID..."
                    value={previewUserId}
                    onChange={(e) => setPreviewUserId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Select Advertisement</Label>
                  <Select value={previewAdId} onValueChange={setPreviewAdId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an advertisement" />
                    </SelectTrigger>
                    <SelectContent>
                      {advertisements.map((ad) => (
                        <SelectItem key={ad.id} value={ad.id}>
                          {ad.title} ({ad.id.slice(0, 8)}...)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handlePreviewUserAds} disabled={previewLoading} className="gradient-primary">
                {previewLoading ? (
                  <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Checking...</>
                ) : (
                  <><Search className="w-4 h-4 mr-2" />Check Delivery</>
                )}
              </Button>

              {previewResult && (
                <div className="mt-4 p-4 rounded-lg border bg-muted/30 space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Preview Result
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Users</p>
                      <p className="font-bold text-lg">{previewResult.totalUsers ?? previewResult.total ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Students</p>
                      <p className="font-bold text-lg">{previewResult.students ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Parents</p>
                      <p className="font-bold text-lg">{previewResult.parents ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Est. Time</p>
                      <p className="font-bold text-sm">{previewResult.estimatedExecutionTime ?? "N/A"}</p>
                    </div>
                  </div>
                  {previewResult.byInstitute && (
                    <div>
                      <p className="text-sm font-medium mb-1">By Institute</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(previewResult.byInstitute).map(([inst, count]) => (
                          <Badge key={inst} variant="outline">{inst}: {String(count)}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {(previewResult.totalUsers ?? previewResult.total) === 0 && (
                    <p className="text-amber-600 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      This advertisement would NOT reach this user based on current targeting rules.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Manual Send Campaign */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Manual Campaign Send
              </CardTitle>
              <CardDescription>
                Send an advertisement manually to targeted users. Use "Check" first to preview before sending.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Select Ad */}
              <div className="space-y-2">
                <Label>Advertisement *</Label>
                <Select value={manualAdId} onValueChange={(v) => { setManualAdId(v); setCheckResult(null); setSendResult(null); }}>
                  <SelectTrigger className="max-w-lg">
                    <SelectValue placeholder="Select an advertisement to send" />
                  </SelectTrigger>
                  <SelectContent>
                    {advertisements.map((ad) => (
                      <SelectItem key={ad.id} value={ad.id}>
                        [{ad.isActive ? "Active" : "Inactive"}] {ad.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target Institute IDs */}
              <div className="space-y-2">
                <Label>Target Institute IDs (comma-separated, leave blank for all)</Label>
                <Input
                  placeholder="inst-id-1, inst-id-2, ..."
                  value={manualInstituteIds}
                  onChange={(e) => setManualInstituteIds(e.target.value)}
                  className="max-w-lg"
                />
              </div>

              {/* User Types */}
              <div className="space-y-2">
                <Label>Target User Types (leave blank for all)</Label>
                <div className="flex flex-wrap gap-3">
                  {USER_TYPES.map((ut) => (
                    <div key={ut} className="flex items-center gap-1.5">
                      <Checkbox
                        id={`ut-${ut}`}
                        checked={manualUserTypes.includes(ut)}
                        onCheckedChange={() => toggleItem(manualUserTypes, ut, setManualUserTypes)}
                      />
                      <label htmlFor={`ut-${ut}`} className="text-sm cursor-pointer">{ut}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subscription Plans */}
              <div className="space-y-2">
                <Label>Target Subscription Plans (leave blank for all)</Label>
                <div className="flex flex-wrap gap-3">
                  {SUB_PLANS.map((sp) => (
                    <div key={sp} className="flex items-center gap-1.5">
                      <Checkbox
                        id={`sp-${sp}`}
                        checked={manualSubPlans.includes(sp)}
                        onCheckedChange={() => toggleItem(manualSubPlans, sp, setManualSubPlans)}
                      />
                      <label htmlFor={`sp-${sp}`} className="text-sm cursor-pointer">{sp}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Modes */}
              <div className="space-y-2">
                <Label>Delivery Modes (leave blank for ad defaults)</Label>
                <div className="flex flex-wrap gap-3">
                  {DELIVERY_MODES.map((dm) => (
                    <div key={dm} className="flex items-center gap-1.5">
                      <Checkbox
                        id={`dm-${dm}`}
                        checked={manualModes.includes(dm)}
                        onCheckedChange={() => toggleItem(manualModes, dm, setManualModes)}
                      />
                      <label htmlFor={`dm-${dm}`} className="text-sm cursor-pointer">{dm}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 flex-wrap">
                <Button variant="outline" onClick={handleCheckSending} disabled={manualLoading}>
                  {manualLoading ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Checking...</>
                  ) : (
                    <><Activity className="w-4 h-4 mr-2" />Check (Dry Run)</>
                  )}
                </Button>
                <Button onClick={handleSendManually} disabled={sendLoading} className="gradient-primary shadow-glow">
                  {sendLoading ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" />Send Now</>
                  )}
                </Button>
              </div>

              {/* Check Result */}
              {checkResult && (
                <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/20 space-y-3">
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Dry Run Preview
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Total Users</p>
                      <p className="font-bold text-lg">{checkResult.totalUsers ?? checkResult.total ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Students</p>
                      <p className="font-bold text-lg">{checkResult.students ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Parents</p>
                      <p className="font-bold text-lg">{checkResult.parents ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Est. Time</p>
                      <p className="font-bold text-sm">{checkResult.estimatedExecutionTime ?? "N/A"}</p>
                    </div>
                  </div>
                  {checkResult.byInstitute && (
                    <div>
                      <p className="text-sm font-medium mb-1">By Institute</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(checkResult.byInstitute).map(([inst, count]) => (
                          <Badge key={inst} variant="outline">{inst}: {String(count)}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Send Result */}
              {sendResult && (
                <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950/20 space-y-3">
                  <h4 className="font-semibold text-green-800 dark:text-green-200 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Send Result
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    {sendResult.campaignId && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Campaign ID</p>
                        <p className="font-mono text-xs">{sendResult.campaignId}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Total Sent</p>
                      <p className="font-bold text-lg text-green-700">{sendResult.totalSent ?? sendResult.sent ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Failed</p>
                      <p className="font-bold text-lg text-red-600">{sendResult.totalFailed ?? sendResult.failed ?? 0}</p>
                    </div>
                  </div>
                  {sendResult.packageBreakdown && (
                    <div>
                      <p className="text-sm font-medium mb-1">Package Breakdown</p>
                      <pre className="text-xs bg-muted p-2 rounded">{JSON.stringify(sendResult.packageBreakdown, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Statistics */}
        <TabsContent value="stats" className="space-y-6">
          {/* Date Range Filter */}
          <Card className="shadow-soft">
            <CardContent className="pt-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <Label>Start Date</Label>
                  <Input type="date" value={statsStartDate} onChange={(e) => setStatsStartDate(e.target.value)} className="w-44" />
                </div>
                <div className="space-y-1">
                  <Label>End Date</Label>
                  <Input type="date" value={statsEndDate} onChange={(e) => setStatsEndDate(e.target.value)} className="w-44" />
                </div>
                <Button onClick={fetchAllStats} disabled={statsLoading} className="gradient-primary">
                  {statsLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  {statsLoading ? " Loading..." : "Load Stats"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5" />
                User Delivery Audit
              </CardTitle>
              <CardDescription>
                Enter a user ID to see which advertisements were delivered via attendance notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <Input placeholder="User ID" value={deliveryUserId} onChange={(e) => setDeliveryUserId(e.target.value)} />
                <Input placeholder="Institute ID (optional)" value={deliveryInstituteId} onChange={(e) => setDeliveryInstituteId(e.target.value)} />
                <Input type="date" value={deliveryStartDate} onChange={(e) => setDeliveryStartDate(e.target.value)} />
                <Input type="date" value={deliveryEndDate} onChange={(e) => setDeliveryEndDate(e.target.value)} />
                <Button onClick={handleDeliveryLookup} disabled={deliveryLookupLoading}>
                  {deliveryLookupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                  {deliveryLookupLoading ? "Searching..." : "Find Deliveries"}
                </Button>
              </div>

              {deliveryLookup && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatsCard title="Deliveries" value={deliveryLookup.totalDeliveries ?? 0} icon={Send} />
                    <StatsCard title="Unique Ads" value={deliveryLookup.uniqueAdvertisements ?? 0} icon={Megaphone} />
                  </div>

                  <div className="rounded-md border overflow-auto max-h-72">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2">Date</th>
                          <th className="text-left p-2">Advertisement</th>
                          <th className="text-left p-2">Ad ID</th>
                          <th className="text-left p-2">Institute</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(deliveryLookup.deliveries || []).map((row: any, i: number) => (
                          <tr key={`${row.advertisementId}-${row.attendanceTimestamp}-${i}`} className="border-t">
                            <td className="p-2">{row.attendanceDate || "-"}</td>
                            <td className="p-2">{row.advertisementTitle || "(title unavailable)"}</td>
                            <td className="p-2 font-mono text-xs">{row.advertisementId}</td>
                            <td className="p-2">{row.instituteId || "-"}</td>
                          </tr>
                        ))}
                        {(!deliveryLookup.deliveries || deliveryLookup.deliveries.length === 0) && (
                          <tr>
                            <td className="p-3 text-muted-foreground" colSpan={4}>No deliveries found for this user/time window.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delivery Stats */}
          {stats && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" /> Delivery Statistics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatsCard title="Total Sent" value={stats.totalSent ?? stats.sent ?? 0} icon={Send} />
                <StatsCard title="Total Delivered" value={stats.totalDelivered ?? stats.delivered ?? 0} icon={CheckCircle} />
                <StatsCard title="Total Clicks" value={stats.totalClicks ?? stats.clicks ?? 0} icon={Activity} />
                <StatsCard title="Total Impressions" value={stats.totalImpressions ?? stats.impressions ?? 0} icon={Eye} />
              </div>
              {stats.byMode && (
                <Card className="mt-4 shadow-soft">
                  <CardHeader><CardTitle className="text-sm">By Delivery Mode</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(stats.byMode).map(([mode, count]) => (
                        <Badge key={mode} variant="outline" className="px-3 py-1">
                          {mode}: {String(count)}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Cache Status */}
          {cacheStatus && (
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5" />
                  Cache Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <Badge className={cacheStatus.healthy ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {cacheStatus.healthy ? "Healthy" : "Unhealthy"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cached Ads</p>
                    <p className="font-bold">{cacheStatus.cachedCount ?? cacheStatus.count ?? "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Updated</p>
                    <p className="font-medium text-xs">
                      {cacheStatus.lastUpdated ? new Date(cacheStatus.lastUpdated).toLocaleString() : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">TTL (seconds)</p>
                    <p className="font-bold">{cacheStatus.ttl ?? "N/A"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentCache && (
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Current Cached Advertisements
                </CardTitle>
                <CardDescription>
                  Source: {currentCache.source || "unknown"} | Total: {currentCache.total ?? 0}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(currentCache.advertisements || []).slice(0, 20).map((ad: any) => (
                    <div key={ad.id} className="flex items-center justify-between border rounded px-3 py-2">
                      <div>
                        <p className="font-medium text-sm">{ad.title}</p>
                        <p className="text-xs text-muted-foreground font-mono">{ad.id}</p>
                      </div>
                      <Badge variant="outline">
                        {ad.currentSendings ?? 0}/{ad.maxSendings ?? 0}
                      </Badge>
                    </div>
                  ))}
                  {(currentCache.advertisements || []).length === 0 && (
                    <p className="text-sm text-muted-foreground">No cached advertisements available.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Manual Send Analytics */}
          {analytics && (
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Manual Campaign Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <StatsCard title="Total Campaigns" value={analytics.totalCampaigns ?? 0} icon={Megaphone} />
                  <StatsCard title="Total Users Sent" value={analytics.totalUsersSent ?? 0} icon={Users} />
                  <StatsCard title="Avg per Campaign" value={analytics.avgPerCampaign ?? 0} icon={Activity} />
                </div>
                {analytics.topPerformingAds && analytics.topPerformingAds.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Top Performing Ads</p>
                    <div className="space-y-2">
                      {analytics.topPerformingAds.slice(0, 5).map((ad: any, i: number) => (
                        <div key={i} className="flex justify-between items-center py-1 border-b last:border-0">
                          <span className="text-sm">{ad.title || ad.id}</span>
                          <Badge variant="outline">{ad.sends ?? ad.count ?? 0} sends</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!stats && !cacheStatus && !analytics && !statsLoading && (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Click "Load Stats" to fetch statistics</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateAdvertisementForm
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => fetchAdvertisements()}
      />

      <ViewDetailsDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        data={selectedAd}
        title={selectedAd?.title || "Advertisement Details"}
        imageKey="mediaUrl"
      />

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Advertisement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Access Key</Label>
              <Input value={editAccessKey} onChange={(e) => setEditAccessKey(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={editing}>{editing ? "Updating..." : "Update"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}