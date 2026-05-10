import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { Globe, Server, Palette, Eye, CheckCircle, Loader2, BarChart3, Sparkles, Save, Image, Upload, X } from "lucide-react";
import { uploadFile } from "@/lib/upload";

const STORAGE_BASE = 'https://storage.suraksha.lk';
const resolveUrl = (path: string | null | undefined): string => {
  if (!path) return '';
  if (path.startsWith('blob:') || path.startsWith('data:') || path.startsWith('http')) return path;
  return `${STORAGE_BASE}/${path.startsWith('/') ? path.slice(1) : path}`;
};

const TIERS = [
  { value: "FREE", label: "Free", description: "Default — lms.suraksha.lk login only" },
  { value: "STARTER", label: "Starter (LKR 2,500/mo)", description: "Subdomain + basic branding" },
  { value: "PROFESSIONAL", label: "Professional (LKR 5,000/mo)", description: "Video backgrounds + no Powered By" },
  { value: "ENTERPRISE", label: "Enterprise (LKR 15,000/mo)", description: "Custom domain + full branding" },
  { value: "ISOLATED", label: "Isolated (LKR 30,000+/mo)", description: "Full white-label" },
];

interface TenantManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  institute: {
    id: string;
    name: string;
    code: string;
    tier?: string;
    subdomain?: string | null;
    customDomain?: string | null;
    customDomainVerified?: boolean;
    customLoginEnabled?: boolean;
    isVisibleInApp?: boolean;
    isVisibleInWebSelector?: boolean;
  } | null;
}

export function TenantManagementDialog({ open, onOpenChange, onSuccess, institute }: TenantManagementDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [subdomainInput, setSubdomainInput] = useState("");
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [customDomainInput, setCustomDomainInput] = useState("");
  const [selectedTier, setSelectedTier] = useState(institute?.tier || "FREE");
  const [visibleInApp, setVisibleInApp] = useState(institute?.isVisibleInApp ?? true);
  const [visibleInWeb, setVisibleInWeb] = useState(institute?.isVisibleInWebSelector ?? true);

  // Login branding state — URL fields are string | null (null = cleared/removed)
  const [brandingForm, setBrandingForm] = useState<{
    loginLogoUrl: string | null;
    loginBackgroundType: string;
    loginBackgroundUrl: string | null;
    loginVideoPosterUrl: string | null;
    loginIllustrationUrl: string | null;
    loginWelcomeTitle: string;
    loginWelcomeSubtitle: string;
    loginFooterText: string;
    faviconUrl: string | null;
    customAppName: string;
    poweredByVisible: boolean;
  }>({
    loginLogoUrl: null,
    loginBackgroundType: 'COLOR',
    loginBackgroundUrl: null,
    loginVideoPosterUrl: null,
    loginIllustrationUrl: null,
    loginWelcomeTitle: '',
    loginWelcomeSubtitle: '',
    loginFooterText: '',
    faviconUrl: null,
    customAppName: '',
    poweredByVisible: true,
  });

  // Stats state
  const [stats, setStats] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsYear, setStatsYear] = useState(new Date().getFullYear());
  const [statsMonth, setStatsMonth] = useState(new Date().getMonth() + 1);

  // Branding file previews
  const [brandingPreviews, setBrandingPreviews] = useState<Record<string, string>>({});
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const handleBrandingFileUpload = async (file: File, fieldName: string) => {
    setUploadingField(fieldName);
    try {
      const result = await uploadFile(file, "institute-branding");
      // Always store the relative path — resolveUrl() handles display
      setBrandingForm(prev => ({ ...prev, [fieldName]: result.relativePath }));
      // Create local blob preview so user sees the image immediately
      const reader = new FileReader();
      reader.onload = () => setBrandingPreviews(prev => ({ ...prev, [fieldName]: reader.result as string }));
      reader.readAsDataURL(file);
      toast({ title: "Uploaded", description: `${fieldName.replace(/([A-Z])/g, ' $1').trim()} uploaded successfully` });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message || "Failed to upload file", variant: "destructive" });
    } finally {
      setUploadingField(null);
    }
  };

  const clearBrandingField = (fieldName: string) => {
    setBrandingForm(prev => ({ ...prev, [fieldName]: null }));
    setBrandingPreviews(prev => { const n = { ...prev }; delete n[fieldName]; return n; });
  };

  // Reset state when institute changes (e.g. different row clicked while dialog open)
  useEffect(() => {
    if (institute) {
      setSubdomainInput(institute.subdomain || "");
      setCustomDomainInput(institute.customDomain || "");
      setSelectedTier(institute.tier || "FREE");
      setVisibleInApp(institute.isVisibleInApp ?? true);
      setVisibleInWeb(institute.isVisibleInWebSelector ?? true);
      setSubdomainAvailable(null);
    }
  }, [institute?.id]);

  // Load existing branding when dialog opens — prevents wiping existing data on save
  useEffect(() => {
    if (!open || !institute?.id) return;

    const loadBranding = async () => {
      try {
        const data = await api.getLoginBranding(institute.id);
        setBrandingForm({
          loginLogoUrl: data.loginLogoUrl || null,
          loginBackgroundType: data.loginBackgroundType || 'COLOR',
          loginBackgroundUrl: data.loginBackgroundUrl || null,
          loginVideoPosterUrl: data.loginVideoPosterUrl || null,
          loginIllustrationUrl: data.loginIllustrationUrl || null,
          loginWelcomeTitle: data.loginWelcomeTitle || '',
          loginWelcomeSubtitle: data.loginWelcomeSubtitle || '',
          loginFooterText: data.loginFooterText || '',
          faviconUrl: data.faviconUrl || null,
          customAppName: data.customAppName || '',
          poweredByVisible: data.poweredByVisible ?? true,
        });
        // Pre-fill image previews — must resolve to full URLs so <img> can load them
        const previews: Record<string, string> = {};
        if (data.loginLogoUrl) previews.loginLogoUrl = resolveUrl(data.loginLogoUrl);
        if (data.loginIllustrationUrl) previews.loginIllustrationUrl = resolveUrl(data.loginIllustrationUrl);
        if (data.loginBackgroundUrl) previews.loginBackgroundUrl = resolveUrl(data.loginBackgroundUrl);
        if (data.faviconUrl) previews.faviconUrl = resolveUrl(data.faviconUrl);
        if (data.loginVideoPosterUrl) previews.loginVideoPosterUrl = resolveUrl(data.loginVideoPosterUrl);
        setBrandingPreviews(previews);
      } catch {
        // Non-fatal — form stays empty, user can still set values from scratch
      }
    };

    loadBranding();
  }, [open, institute?.id]);

  // Reset form when institute changes
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && institute) {
      setSubdomainInput(institute.subdomain || "");
      setCustomDomainInput(institute.customDomain || "");
      setSelectedTier(institute.tier || "FREE");
      setVisibleInApp(institute.isVisibleInApp ?? true);
      setVisibleInWeb(institute.isVisibleInWebSelector ?? true);
      setSubdomainAvailable(null);
    }
    onOpenChange(isOpen);
  };

  const checkSubdomain = async () => {
    if (!subdomainInput.trim()) return;
    try {
      const res = await api.checkSubdomainAvailability(subdomainInput.trim().toLowerCase());
      setSubdomainAvailable(res.available);
    } catch {
      toast({ title: "Error", description: "Failed to check subdomain", variant: "destructive" });
    }
  };

  const handleSetSubdomain = async () => {
    if (!institute || !subdomainInput.trim()) return;
    setLoading(true);
    try {
      const res = await api.setInstituteSubdomain(institute.id, subdomainInput.trim().toLowerCase());
      toast({ title: "Success", description: `Subdomain set: ${res.url}` });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to set subdomain", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSetCustomDomain = async () => {
    if (!institute || !customDomainInput.trim()) return;
    setLoading(true);
    try {
      const res = await api.setInstituteCustomDomain(institute.id, customDomainInput.trim().toLowerCase());
      toast({ title: "Success", description: res.message });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to set custom domain", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDomain = async () => {
    if (!institute) return;
    setLoading(true);
    try {
      const res = await api.verifyInstituteCustomDomain(institute.id);
      toast({ title: res.verified ? "Verified" : "Pending", description: res.message });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Verification failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleForceVerifyDomain = async () => {
    if (!institute) return;
    setLoading(true);
    try {
      const res = await api.forceVerifyInstituteCustomDomain(institute.id);
      toast({ title: "Force Verified", description: res.message });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Force verification failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTier = async () => {
    if (!institute) return;
    setLoading(true);
    try {
      await api.updateInstituteTier(institute.id, selectedTier);
      toast({ title: "Success", description: `Tier updated to ${selectedTier}` });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update tier", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateVisibility = async () => {
    if (!institute) return;
    setLoading(true);
    try {
      await api.updateInstituteVisibility(institute.id, {
        isVisibleInApp: visibleInApp,
        isVisibleInWebSelector: visibleInWeb,
      });
      toast({ title: "Success", description: "Visibility updated" });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update visibility", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBranding = async () => {
    if (!institute) return;
    setLoading(true);
    try {
      await api.updateInstituteLoginBranding(institute.id, brandingForm);
      toast({ title: "Success", description: "Login branding updated" });
      onSuccess();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update branding", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!institute) return;
    setStatsLoading(true);
    try {
      const data = await api.getInstituteLoginStats(institute.id, statsYear, statsMonth);
      setStats(data);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to load stats", variant: "destructive" });
    } finally {
      setStatsLoading(false);
    }
  };

  if (!institute) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Tenant Management — {institute.name}
          </DialogTitle>
          <DialogDescription>
            Manage subdomain, custom domain, tier, branding, visibility, and stats for <strong>{institute.code}</strong>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="subdomain" className="mt-4">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
            <TabsTrigger value="subdomain" className="text-xs">Subdomain</TabsTrigger>
            <TabsTrigger value="domain" className="text-xs">Domain</TabsTrigger>
            <TabsTrigger value="tier" className="text-xs">Tier</TabsTrigger>
            <TabsTrigger value="branding" className="text-xs">Branding</TabsTrigger>
            <TabsTrigger value="visibility" className="text-xs">Visibility</TabsTrigger>
            <TabsTrigger value="stats" className="text-xs">Stats</TabsTrigger>
          </TabsList>

          {/* ═══ SUBDOMAIN TAB ═══ */}
          <TabsContent value="subdomain" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Subdomain</Label>
              <div className="flex gap-2">
                <Input
                  value={subdomainInput}
                  onChange={(e) => { setSubdomainInput(e.target.value); setSubdomainAvailable(null); }}
                  placeholder="academy"
                  className="flex-1"
                />
                <span className="flex items-center text-sm text-muted-foreground">.suraksha.lk</span>
                <Button variant="outline" size="sm" onClick={checkSubdomain}>
                  Check
                </Button>
              </div>
              {subdomainAvailable !== null && (
                <p className={subdomainAvailable ? "text-green-600 text-sm" : "text-red-600 text-sm"}>
                  {subdomainAvailable ? "✓ Available" : "✗ Taken or reserved"}
                </p>
              )}
              {institute.subdomain && (
                <p className="text-sm text-muted-foreground">
                  Current: <Badge variant="outline">{institute.subdomain}.suraksha.lk</Badge>
                </p>
              )}
            </div>
            <Button onClick={handleSetSubdomain} disabled={loading || !subdomainInput.trim()}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Set Subdomain
            </Button>
          </TabsContent>

          {/* ═══ CUSTOM DOMAIN TAB ═══ */}
          <TabsContent value="domain" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Custom Domain</Label>
              <Input
                value={customDomainInput}
                onChange={(e) => setCustomDomainInput(e.target.value)}
                placeholder="lms.myinstitute.com"
              />
              <p className="text-xs text-muted-foreground">
                Requires ENTERPRISE or ISOLATED tier. Set a CNAME or A record pointing to this server.
              </p>
              {institute.customDomain && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{institute.customDomain}</Badge>
                  {institute.customDomainVerified ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200">✓ Verified & Active</Badge>
                  ) : (
                    <Badge variant="secondary">⚠ Unverified — login page won't load</Badge>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleSetCustomDomain} disabled={loading || !customDomainInput.trim()}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Set Domain
              </Button>
              {institute.customDomain && (
                <>
                  <Button variant="outline" onClick={handleVerifyDomain} disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    {institute.customDomainVerified ? "Re-Verify" : "Verify"}
                  </Button>
                  <Button variant="secondary" onClick={handleForceVerifyDomain} disabled={loading} title="Force-mark as verified without DNS check (SUPERADMIN only)">
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Server className="w-4 h-4 mr-2" />}
                    Force Verify
                  </Button>
                </>
              )}
            </div>
            {institute.customDomain && !institute.customDomainVerified && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                Domain is unverified — visiting <strong>{institute.customDomain}</strong> will show "Institute not found". Click <strong>Verify</strong> once DNS is configured, or <strong>Force Verify</strong> to bypass the check.
              </p>
            )}
          </TabsContent>

          {/* ═══ TIER TAB ═══ */}
          <TabsContent value="tier" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Package Tier</Label>
              <Select value={selectedTier} onValueChange={setSelectedTier}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIERS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <div>
                        <span className="font-medium">{t.label}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{t.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {institute.tier && (
                <p className="text-sm text-muted-foreground">
                  Current tier: <Badge>{institute.tier}</Badge>
                </p>
              )}
            </div>
            <Button onClick={handleUpdateTier} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Tier
            </Button>
          </TabsContent>

          {/* ═══ VISIBILITY TAB ═══ */}
          <TabsContent value="visibility" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Visible in Mobile App</Label>
                  <p className="text-xs text-muted-foreground">Show in app institute selector</p>
                </div>
                <Switch checked={visibleInApp} onCheckedChange={setVisibleInApp} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Visible in Web Selector</Label>
                  <p className="text-xs text-muted-foreground">Show in lms.suraksha.lk institute selector</p>
                </div>
                <Switch checked={visibleInWeb} onCheckedChange={setVisibleInWeb} />
              </div>
            </div>
            <Button onClick={handleUpdateVisibility} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Visibility
            </Button>
          </TabsContent>

          {/* ═══ LOGIN BRANDING TAB ═══ */}
          <TabsContent value="branding" className="space-y-4 mt-4">
            {/* Custom Login Status Banner */}
            <div className={`text-sm p-3 rounded-md flex items-center gap-2 ${institute.customLoginEnabled ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
              <span className="font-medium">Custom Login: {institute.customLoginEnabled ? '✓ Active' : '✗ Inactive'}</span>
              <span className="text-xs">
                {institute.customLoginEnabled
                  ? `via ${institute.subdomain ? `${institute.subdomain}.suraksha.lk` : institute.customDomain || 'domain'}`
                  : '— Set a subdomain or custom domain to enable'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Welcome Title</Label>
                <Input
                  value={brandingForm.loginWelcomeTitle}
                  onChange={(e) => setBrandingForm(prev => ({ ...prev, loginWelcomeTitle: e.target.value }))}
                  placeholder="Welcome to Academy"
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label>Custom App Name</Label>
                <Input
                  value={brandingForm.customAppName}
                  onChange={(e) => setBrandingForm(prev => ({ ...prev, customAppName: e.target.value }))}
                  placeholder="Academy LMS"
                  maxLength={100}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Welcome Subtitle</Label>
              <Input
                value={brandingForm.loginWelcomeSubtitle}
                onChange={(e) => setBrandingForm(prev => ({ ...prev, loginWelcomeSubtitle: e.target.value }))}
                placeholder="Sign in to access your courses"
                maxLength={500}
              />
            </div>
            <div className="space-y-2">
              <Label>Footer Text</Label>
              <Input
                value={brandingForm.loginFooterText}
                onChange={(e) => setBrandingForm(prev => ({ ...prev, loginFooterText: e.target.value }))}
                placeholder="© 2026 Academy"
                maxLength={200}
              />
            </div>

            <Separator />

            {/* Login Logo Upload */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Login Logo</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-3">
                  {(brandingPreviews.loginLogoUrl || brandingForm.loginLogoUrl) ? (
                    <div className="relative">
                      <img src={brandingPreviews.loginLogoUrl || resolveUrl(brandingForm.loginLogoUrl)} alt="Login logo" className="w-full h-20 object-contain rounded" />
                      <Button type="button" variant="destructive" size="icon" className="absolute top-0 right-0 h-6 w-6" onClick={() => clearBrandingField('loginLogoUrl')}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center cursor-pointer py-2">
                      {uploadingField === 'loginLogoUrl' ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
                      <span className="text-xs text-muted-foreground mt-1">Upload login logo</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBrandingFileUpload(f, 'loginLogoUrl'); e.target.value = ''; }} />
                    </label>
                  )}
                </div>
                <Input
                  value={brandingForm.loginLogoUrl || ''}
                  onChange={(e) => setBrandingForm(prev => ({ ...prev, loginLogoUrl: e.target.value || null }))}
                  placeholder="Or paste URL..."
                  className="text-xs"
                />
              </div>

              {/* Favicon Upload */}
              <div className="space-y-2">
                <Label>Favicon</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-3">
                  {(brandingPreviews.faviconUrl || brandingForm.faviconUrl) ? (
                    <div className="relative">
                      <img src={brandingPreviews.faviconUrl || resolveUrl(brandingForm.faviconUrl)} alt="Favicon" className="w-full h-20 object-contain rounded" />
                      <Button type="button" variant="destructive" size="icon" className="absolute top-0 right-0 h-6 w-6" onClick={() => clearBrandingField('faviconUrl')}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center cursor-pointer py-2">
                      {uploadingField === 'faviconUrl' ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
                      <span className="text-xs text-muted-foreground mt-1">Upload favicon</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBrandingFileUpload(f, 'faviconUrl'); e.target.value = ''; }} />
                    </label>
                  )}
                </div>
                <Input
                  value={brandingForm.faviconUrl || ''}
                  onChange={(e) => setBrandingForm(prev => ({ ...prev, faviconUrl: e.target.value || null }))}
                  placeholder="Or paste URL..."
                  className="text-xs"
                />
              </div>
            </div>

            {/* Background Type & Upload */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Background Type</Label>
                <Select
                  value={brandingForm.loginBackgroundType}
                  onValueChange={(v) => setBrandingForm(prev => ({ ...prev, loginBackgroundType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COLOR">Solid Color</SelectItem>
                    <SelectItem value="GRADIENT">Gradient</SelectItem>
                    <SelectItem value="IMAGE">Image</SelectItem>
                    <SelectItem value="VIDEO">Video</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(brandingForm.loginBackgroundType === 'IMAGE' || brandingForm.loginBackgroundType === 'VIDEO') && (
                <div className="space-y-2">
                  <Label>{brandingForm.loginBackgroundType === 'VIDEO' ? 'Background Video' : 'Background Image'}</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-3">
                    {(brandingPreviews.loginBackgroundUrl || brandingForm.loginBackgroundUrl) ? (
                      <div className="relative">
                        {brandingForm.loginBackgroundType === 'VIDEO' ? (
                          <p className="text-xs text-center py-2 text-muted-foreground truncate">{brandingForm.loginBackgroundUrl}</p>
                        ) : (
                          <img src={brandingPreviews.loginBackgroundUrl || resolveUrl(brandingForm.loginBackgroundUrl)} alt="Background" className="w-full h-20 object-cover rounded" />
                        )}
                        <Button type="button" variant="destructive" size="icon" className="absolute top-0 right-0 h-6 w-6" onClick={() => clearBrandingField('loginBackgroundUrl')}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center cursor-pointer py-2">
                        {uploadingField === 'loginBackgroundUrl' ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
                        <span className="text-xs text-muted-foreground mt-1">Upload {brandingForm.loginBackgroundType === 'VIDEO' ? 'video' : 'image'}</span>
                        <input type="file" accept={brandingForm.loginBackgroundType === 'VIDEO' ? 'video/*' : 'image/*'} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBrandingFileUpload(f, 'loginBackgroundUrl'); e.target.value = ''; }} />
                      </label>
                    )}
                  </div>
                  <Input
                    value={brandingForm.loginBackgroundUrl || ''}
                    onChange={(e) => setBrandingForm(prev => ({ ...prev, loginBackgroundUrl: e.target.value || null }))}
                    placeholder="Or paste URL..."
                    className="text-xs"
                  />
                </div>
              )}
            </div>

            {brandingForm.loginBackgroundType === 'VIDEO' && (
              <div className="space-y-2">
                <Label>Video Poster Image</Label>
                <div className="border-2 border-dashed border-border rounded-lg p-3">
                  {(brandingPreviews.loginVideoPosterUrl || brandingForm.loginVideoPosterUrl) ? (
                    <div className="relative">
                      <img src={brandingPreviews.loginVideoPosterUrl || resolveUrl(brandingForm.loginVideoPosterUrl)} alt="Video poster" className="w-full h-20 object-cover rounded" />
                      <Button type="button" variant="destructive" size="icon" className="absolute top-0 right-0 h-6 w-6" onClick={() => clearBrandingField('loginVideoPosterUrl')}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center cursor-pointer py-2">
                      {uploadingField === 'loginVideoPosterUrl' ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
                      <span className="text-xs text-muted-foreground mt-1">Upload poster image</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBrandingFileUpload(f, 'loginVideoPosterUrl'); e.target.value = ''; }} />
                    </label>
                  )}
                </div>
                <Input
                  value={brandingForm.loginVideoPosterUrl || ''}
                  onChange={(e) => setBrandingForm(prev => ({ ...prev, loginVideoPosterUrl: e.target.value || null }))}
                  placeholder="Or paste URL..."
                  className="text-xs"
                />
              </div>
            )}

            {/* Illustration Upload */}
            <div className="space-y-2">
              <Label>Login Illustration</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-3">
                {(brandingPreviews.loginIllustrationUrl || brandingForm.loginIllustrationUrl) ? (
                  <div className="relative">
                    <img src={brandingPreviews.loginIllustrationUrl || resolveUrl(brandingForm.loginIllustrationUrl)} alt="Illustration" className="w-full h-20 object-contain rounded" />
                    <Button type="button" variant="destructive" size="icon" className="absolute top-0 right-0 h-6 w-6" onClick={() => clearBrandingField('loginIllustrationUrl')}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center cursor-pointer py-2">
                    {uploadingField === 'loginIllustrationUrl' ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
                    <span className="text-xs text-muted-foreground mt-1">Upload illustration</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBrandingFileUpload(f, 'loginIllustrationUrl'); e.target.value = ''; }} />
                  </label>
                )}
              </div>
              <Input
                value={brandingForm.loginIllustrationUrl || ''}
                onChange={(e) => setBrandingForm(prev => ({ ...prev, loginIllustrationUrl: e.target.value || null }))}
                placeholder="Or paste URL..."
                className="text-xs"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Show "Powered by SurakshaLMS"</Label>
                <p className="text-xs text-muted-foreground">Display the badge on login page</p>
              </div>
              <Switch
                checked={brandingForm.poweredByVisible}
                onCheckedChange={(v) => setBrandingForm(prev => ({ ...prev, poweredByVisible: v }))}
              />
            </div>

            <Button onClick={handleSaveBranding} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Save Branding
            </Button>
          </TabsContent>

          {/* ═══ STATS TAB ═══ */}
          <TabsContent value="stats" className="space-y-4 mt-4">
            <div className="flex items-end gap-3">
              <div className="space-y-2">
                <Label>Year</Label>
                <Input
                  type="number"
                  value={statsYear}
                  onChange={(e) => setStatsYear(parseInt(e.target.value) || new Date().getFullYear())}
                  min={2020}
                  max={2030}
                  className="w-24"
                />
              </div>
              <div className="space-y-2">
                <Label>Month</Label>
                <Select value={statsMonth.toString()} onValueChange={(v) => setStatsMonth(parseInt(v))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={loadStats} disabled={statsLoading} variant="outline">
                {statsLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BarChart3 className="w-4 h-4 mr-2" />}
                Load Stats
              </Button>
            </div>

            {stats ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border bg-card">
                  <p className="text-xs text-muted-foreground">Total Logins</p>
                  <p className="text-2xl font-bold">{stats.totalLogins ?? 0}</p>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <p className="text-xs text-muted-foreground">Subdomain Logins</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.subdomainLogins ?? 0}</p>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <p className="text-xs text-muted-foreground">Custom Domain Logins</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.customDomainLogins ?? 0}</p>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <p className="text-xs text-muted-foreground">Unique Subdomain Users</p>
                  <p className="text-2xl font-bold">{stats.uniqueSubdomainUsers ?? 0}</p>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <p className="text-xs text-muted-foreground">Unique Domain Users</p>
                  <p className="text-2xl font-bold">{stats.uniqueCustomDomainUsers ?? 0}</p>
                </div>
                <div className="p-3 rounded-lg border bg-card">
                  <p className="text-xs text-muted-foreground">Total Active Users</p>
                  <p className="text-2xl font-bold text-green-600">{stats.totalActiveUsers ?? 0}</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Click "Load Stats" to view login statistics</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
