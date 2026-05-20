import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatures } from '@/contexts/FeaturesContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useToast } from '@/hooks/use-toast';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { secureCache } from '@/utils/secureCache';
import { CACHE_TTL } from '@/config/cacheTTL';
import { SafeImage } from '@/components/ui/SafeImage';
import ImageCropUpload from '@/components/common/ImageCropUpload';
import { ImageFieldUploader } from '@/components/institute-settings/ImageFieldUploader';
import { BrandingImageUploader } from '@/components/institute-settings/BrandingImageUploader';
import { ReportBannerUploader } from '@/components/institute-settings/ReportBannerUploader';
import { GalleryManager } from '@/components/institute-settings/GalleryManager';
import { FeatureSettings } from '@/components/institute-settings/FeatureSettings';
import { UserTypesManager } from '@/components/institute-settings/UserTypesManager';
import { Separator } from '@/components/ui/separator';
import { useIsMobile } from '@/hooks/use-mobile';
import { tenantApi, type LoginBrandingData, type TenantSettingsResponse, type SmsSettingsResponse, type PlanInfoResponse } from '@/api/tenant.api';
import { useTenant } from '@/contexts/TenantContext';
import {
  Building2, Mail, Phone, MapPin, Globe, Facebook, Youtube,
  Palette, Save, Loader2, Eye, Image, Settings, RefreshCw,
  CheckCircle, AlertCircle, ChevronRight, Server, Link2, Sparkles,
  MessageSquare, Shield, Crown, Zap, Lock, ArrowLeft, Layers,
  ShieldCheck, Search, Users, Printer, Camera, Key,
} from 'lucide-react';
import { instituteSettingsApi, type PrinterSettings } from '@/api/instituteSettings.api';
import InstituteDriveSettings from '@/components/institute-settings/InstituteDriveSettings';
import { UserExtraColumnsManager } from '@/components/users/UserExtraColumnsManager';
import { useInstituteUserColumns } from '@/hooks/useInstituteUserColumns';
import { ApiKeysManager } from '@/components/institute-settings/ApiKeysManager';

interface InstituteSettings {
  id: string;
  name: string;
  shortName?: string;
  code: string;
  email: string;
  phone?: string;
  systemContactEmail?: string;
  systemContactPhoneNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  district?: string;
  province?: string;
  pinCode?: string;
  type?: string;
  logoUrl?: string;
  loadingGifUrl?: string;
  primaryColorCode?: string;
  secondaryColorCode?: string;
  imageUrls?: string[];
  imageUrl?: string;
  reportHeaderUrl?: string | null;
  reportFooterUrl?: string | null;
  receiptHeaderUrl?: string | null;
  receiptFooterUrl?: string | null;
  vision?: string;
  mission?: string;
  description?: string;
  websiteUrl?: string;
  facebookPageUrl?: string;
  youtubeChannelUrl?: string;
  isActive: boolean;
  updatedAt: string;
  // Multi-tenant fields
  tier?: string;
  subdomain?: string | null;
  customDomain?: string | null;
  customDomainVerified?: boolean;
  customLoginEnabled?: boolean;
  isVisibleInApp?: boolean;
  isVisibleInWebSelector?: boolean;
  loginLogoUrl?: string | null;
  loginBackgroundType?: string;
  loginBackgroundUrl?: string | null;
  loginVideoPosterUrl?: string | null;
  loginIllustrationUrl?: string | null;
  loginWelcomeTitle?: string | null;
  loginWelcomeSubtitle?: string | null;
  loginFooterText?: string | null;
  faviconUrl?: string | null;
  customAppName?: string | null;
  poweredByVisible?: boolean;
  // Session limit fields
  isSessionLimitEnabled?: boolean;
  defaultSessionsPerUserCount?: number | null;
  isStrictSessionLimit?: boolean;
  // Printer settings
  printerSettings?: PrinterSettings | null;
}

const VALID_TABS = ['basic', 'branding', 'printer', 'tenant', 'location', 'about', 'online', 'sms', 'integrations', 'user-columns', 'session-limits', 'features', 'user-types', 'api-keys'];

const SECTION_ITEMS: Array<{
  id: string;
  label: string;
  description: string;
  icon: any;
  color: string;
}> = [
  { id: 'basic', label: 'Basic Information', description: 'Name, email, contact details', icon: Building2, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { id: 'branding', label: 'Branding', description: 'Logo, colors, cover image', icon: Palette, color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
  { id: 'printer', label: 'Printer Settings', description: 'Receipt size, header/footer, language', icon: Printer, color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300' },
  { id: 'tenant', label: 'Domain & Login Page', description: 'Subdomain, login branding, visibility', icon: Globe, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
  { id: 'sms', label: 'SMS & Messaging', description: 'Sender name, masks, notifications', icon: MessageSquare, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  { id: 'location', label: 'Location & Address', description: 'Address, city, district', icon: MapPin, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  { id: 'about', label: 'About', description: 'Vision, mission, and description', icon: Eye, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { id: 'online', label: 'Online Presence', description: 'Website & social media links', icon: Link2, color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  { id: 'integrations', label: 'Integrations', description: 'Google Drive & third-party apps', icon: Layers, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  { id: 'user-columns', label: 'User Columns', description: 'Custom extra data fields for users', icon: Settings, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  { id: 'session-limits', label: 'Session Limits', description: 'Device limits per user, session controls', icon: ShieldCheck, color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' },
  { id: 'features', label: 'Feature Management', description: 'Enable or disable institute features', icon: Zap, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  { id: 'user-types', label: 'User Types & Permissions', description: 'Manage roles, permissions per feature', icon: Shield, color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  { id: 'api-keys', label: 'API Keys', description: 'External system access for attendance marking', icon: Key, color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300' },
];


const InstituteSettingsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentInstituteId, selectedInstitute, selectedClass, selectedSubject } = useAuth();
  const { isFeatureEnabled } = useFeatures();
  const { toast } = useToast();
  const instituteRole = useInstituteRole();
  const isInstituteAdmin = instituteRole === 'InstituteAdmin';
  const { refetch: refetchBranding } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [settings, setSettings] = useState<InstituteSettings | null>(null);
  const [formData, setFormData] = useState<Partial<InstituteSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const isMobile = useIsMobile();

  // Extra user columns schema
  const { columns: extraColumns, save: saveExtraColumns } = useInstituteUserColumns(currentInstituteId);

  // User photo upload policy
  const [allowUserPhotoUpload, setAllowUserPhotoUpload] = useState(true);
  const [photoUploadSaving, setPhotoUploadSaving] = useState(false);

  // Session limits state
  const [sessionLimitEnabled, setSessionLimitEnabled] = useState(false);
  const [strictSessionLimit, setStrictSessionLimit] = useState(false);
  const [defaultSessionCount, setDefaultSessionCount] = useState<number>(3);
  const [sessionLimitMode, setSessionLimitMode] = useState<'NEW_USERS_ONLY' | 'ALL_USERS' | 'USERS_WITH_PREVIOUS_LIMIT' | 'CUSTOM'>('NEW_USERS_ONLY');
  const [sessionLimitSaving, setSessionLimitSaving] = useState(false);
  const [showCountChanged, setShowCountChanged] = useState(false);
  const [customUsersDialogOpen, setCustomUsersDialogOpen] = useState(false);
  const [instituteUsersList, setInstituteUsersList] = useState<Array<{ id: string; name: string; userIdByInstitute?: string | null }>>([]);
  const [customUserSearch, setCustomUserSearch] = useState('');
  const [selectedCustomUsers, setSelectedCustomUsers] = useState<string[]>([]);
  const [customUsersLoading, setCustomUsersLoading] = useState(false);
  const [customUsersSaving, setCustomUsersSaving] = useState(false);


  // Read initial tab from URL query param
  const tabParam = searchParams.get('tab');
  const validTabParam = tabParam && VALID_TABS.includes(tabParam) ? tabParam : null;
  const initialTab = validTabParam || 'basic';
  const [mobileSection, setMobileSection] = useState<string | null>(() => {
    if (isMobile && tabParam && VALID_TABS.includes(tabParam)) return tabParam;
    return null;
  });
  const [desktopSection, setDesktopSection] = useState<string | null>(() => {
    if (!isMobile && validTabParam) return validTabParam;
    return null;
  });
  const [activeTab, setActiveTab] = useState(initialTab);

  const backToProfilePath = (() => {
    if (location.pathname.endsWith('/institute-settings')) {
      return location.pathname.replace(/\/institute-settings$/, '/institute-profile');
    }

    const instituteId = (selectedInstitute?.id ?? currentInstituteId)?.toString();
    if (!instituteId) return '/institute-profile';

    let basePath = `/institute/${instituteId}`;
    if (selectedClass?.id) {
      basePath += `/class/${selectedClass.id}`;
      if (selectedSubject?.id) {
        basePath += `/subject/${selectedSubject.id}`;
      }
    }

    return `${basePath}/institute-profile`;
  })();

  // Sync section state when URL tab param changes externally (e.g. sidebar navigation)
  useEffect(() => {
    const param = searchParams.get('tab');
    if (!param || !VALID_TABS.includes(param)) return;
    setActiveTab(param);
    if (isMobile) {
      setMobileSection(param);
    } else {
      setDesktopSection(param);
    }
  }, [searchParams, isMobile]);

  // Sync tab to URL when it changes
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleMobileSection = useCallback((section: string | null) => {
    setMobileSection(section);
    if (section) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('tab', section);
        return next;
      }, { replace: true });
    }
  }, [setSearchParams]);

  const handleDesktopSection = useCallback((section: string | null) => {
    setDesktopSection(section);
    if (section) {
      setActiveTab(section);
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('tab', section);
        return next;
      }, { replace: true });
      return;
    }
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('tab');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Tenant-specific state
  const [tenantSaving, setTenantSaving] = useState(false);
  const [subdomainInput, setSubdomainInput] = useState('');
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [subdomainChecking, setSubdomainChecking] = useState(false);
  const [brandingForm, setBrandingForm] = useState<LoginBrandingData>({});
  const [visibleInApp, setVisibleInApp] = useState(true);
  const [visibleInWeb, setVisibleInWeb] = useState(true);

  // SMS & Plan state
  const [smsSettings, setSmsSettings] = useState<SmsSettingsResponse | null>(null);
  const [planInfo, setPlanInfo] = useState<PlanInfoResponse | null>(null);
  const [smsSaving, setSmsSaving] = useState(false);
  const [selectedSmsMask, setSelectedSmsMask] = useState<string>('__default__');

  // Printer settings state
  const [printerForm, setPrinterForm] = useState<PrinterSettings>({ defaultSize: '3inch', language: 'en' });
  const [printerSaving, setPrinterSaving] = useState(false);

  // Computed tier helpers (must be after planInfo/settings state declarations)
  const effectiveTier = planInfo?.tier || settings?.tier || 'FREE';
  const isFree = effectiveTier === 'FREE';
  const isStarter = effectiveTier === 'STARTER';
  const hasSubdomain = planInfo?.features?.subdomain ?? !isFree;
  const hasLoginBranding = planInfo?.features?.loginBranding ?? !isFree;
  const hasCustomDomain = planInfo?.features?.customDomain ?? (effectiveTier === 'ENTERPRISE' || effectiveTier === 'ISOLATED');
  const hasVideoBackground = planInfo?.features?.videoBackground ?? (effectiveTier === 'PROFESSIONAL' || effectiveTier === 'ENTERPRISE' || effectiveTier === 'ISOLATED');
  const hasSmsMasking = planInfo?.features?.smsMasking ?? !isFree;

  const loadSettings = useCallback(async () => {
    if (!currentInstituteId) return;
    setLoading(true);
    try {
      const [response, smsRes, planRes, brandingRes] = await Promise.all([
        enhancedCachedClient.get<InstituteSettings>(
          `/institutes/${currentInstituteId}/settings`,
          {},
          { ttl: CACHE_TTL.INSTITUTE_PROFILE, forceRefresh: true, instituteId: currentInstituteId }
        ),
        tenantApi.getSmsSettings(currentInstituteId).catch(() => null),
        tenantApi.getPlanInfo(currentInstituteId, true).catch(() => null),
        tenantApi.getLoginBranding(currentInstituteId).catch(() => null),
      ]);
      setSettings(response);
      setFormData(response);
      setHasChanges(false);
      setPrinterForm({
        defaultSize: (response as any).printerSettings?.defaultSize ?? '3inch',
        language: (response as any).printerSettings?.language ?? 'en',
        receiptHeader: (response as any).printerSettings?.receiptHeader ?? '',
        receiptFooter: (response as any).printerSettings?.receiptFooter ?? '',
      });
      setAllowUserPhotoUpload(response.allowUserPhotoUpload ?? true);
      setSessionLimitEnabled(response.isSessionLimitEnabled ?? false);
      setStrictSessionLimit(response.isStrictSessionLimit ?? false);
      setDefaultSessionCount(response.defaultSessionsPerUserCount ?? 3);
      setShowCountChanged(false);
      if (smsRes) {
        setSmsSettings(smsRes);
        setSelectedSmsMask(smsRes.smsSenderName || '__default__');
      }
      if (planRes) {
        setPlanInfo(planRes);
        // Seed subdomain input from planInfo (the authoritative source for subdomain)
        if (planRes.subdomain !== undefined) {
          setSubdomainInput(planRes.subdomain || '');
        }
      }
      // Populate branding form from dedicated endpoint (has latest values)
      if (brandingRes) {
        setBrandingForm({
          loginLogoUrl: brandingRes.loginLogoUrl,
          loginBackgroundType: (brandingRes.loginBackgroundType as LoginBrandingData['loginBackgroundType']) || 'COLOR',
          loginBackgroundUrl: brandingRes.loginBackgroundUrl,
          loginVideoPosterUrl: brandingRes.loginVideoPosterUrl,
          loginIllustrationUrl: brandingRes.loginIllustrationUrl,
          loginWelcomeTitle: brandingRes.loginWelcomeTitle,
          loginWelcomeSubtitle: brandingRes.loginWelcomeSubtitle,
          loginFooterText: brandingRes.loginFooterText,
          faviconUrl: brandingRes.faviconUrl,
          customAppName: brandingRes.customAppName,
          poweredByVisible: brandingRes.poweredByVisible ?? true,
        });
      }
    } catch (error: any) {
      console.error('Failed to load institute settings:', error);
      toast({ title: 'Error', description: 'Failed to load institute settings.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentInstituteId, toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleChange = (field: keyof InstituteSettings, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!currentInstituteId || !settings) return;
    setSaving(true);
    try {
      const changes: Record<string, any> = {};
      for (const [key, value] of Object.entries(formData)) {
        if (value !== undefined && value !== (settings as any)[key]) {
          changes[key] = value;
        }
      }

      if (Object.keys(changes).length === 0) {
        toast({ title: 'No changes', description: 'No fields were modified.' });
        setSaving(false);
        return;
      }

      const updated = await enhancedCachedClient.patch<InstituteSettings>(
        `/institutes/${currentInstituteId}/settings`,
        changes,
        { instituteId: currentInstituteId }
      );

      setSettings(updated);
      setFormData(updated);
      setHasChanges(false);
      toast({ title: 'Success', description: 'Institute settings updated successfully.' });
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      const msg = error?.message?.includes('409') ? 'Email is already taken by another institute.' : error?.message || 'Failed to save settings.';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpdate = (newUrl: string) => {
    setFormData(prev => ({ ...prev, logoUrl: newUrl }));
    setHasChanges(true);
  };

  const handleSettingsRefresh = (updated: InstituteSettings) => {
    setSettings(updated);
    setFormData(updated);
  };

  // Sync tenant visibility state when settings load (subdomain seeded from planInfo in loadSettings)
  useEffect(() => {
    if (settings) {
      // Only seed subdomain from settings if planInfo hasn't already seeded it
      if (!planInfo?.subdomain && settings.subdomain !== undefined) {
        setSubdomainInput(settings.subdomain || '');
      }
      setVisibleInApp(settings.isVisibleInApp ?? true);
      setVisibleInWeb(settings.isVisibleInWebSelector ?? true);
    }
  }, [settings, planInfo?.subdomain]);

  const handleCheckSubdomain = async () => {
    const value = subdomainInput.trim().toLowerCase();
    if (!value) return;
    setSubdomainChecking(true);
    try {
      const res = await tenantApi.checkSubdomainAvailability(value);
      setSubdomainAvailable(res.available);
    } catch {
      toast({ title: 'Error', description: 'Failed to check subdomain', variant: 'destructive' });
    } finally {
      setSubdomainChecking(false);
    }
  };

  const handleSetSubdomain = async () => {
    if (!currentInstituteId || !subdomainInput.trim()) return;
    setTenantSaving(true);
    try {
      const res = await tenantApi.setSubdomain(currentInstituteId, subdomainInput.trim().toLowerCase());
      toast({ title: 'Success', description: `Subdomain set! Your login URL: ${res.url}` });
      loadSettings();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to set subdomain', variant: 'destructive' });
    } finally {
      setTenantSaving(false);
    }
  };

  const handleRemoveSubdomain = async () => {
    if (!currentInstituteId) return;
    setTenantSaving(true);
    try {
      await tenantApi.removeSubdomain(currentInstituteId);
      toast({ title: 'Success', description: 'Subdomain removed' });
      loadSettings();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to remove subdomain', variant: 'destructive' });
    } finally {
      setTenantSaving(false);
    }
  };

  const handleSaveBranding = async () => {
    if (!currentInstituteId) return;
    setTenantSaving(true);
    try {
      // Exclude poweredByVisible — backend throws 403 if a non-SUPERADMIN sends it
      const { poweredByVisible: _omit, ...brandingPayload } = brandingForm;
      await tenantApi.updateLoginBranding(currentInstituteId, brandingPayload);
      refetchBranding(); // Force TenantContext to re-fetch so the live login page shows new branding
      toast({ title: 'Success', description: 'Login branding updated' });
      loadSettings();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to update branding', variant: 'destructive' });
    } finally {
      setTenantSaving(false);
    }
  };

  const handleSaveVisibility = async () => {
    if (!currentInstituteId) return;
    setTenantSaving(true);
    try {
      await tenantApi.updateVisibility(currentInstituteId, { isVisibleInApp: visibleInApp, isVisibleInWebSelector: visibleInWeb });
      toast({ title: 'Success', description: 'Visibility settings updated' });
      loadSettings();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to update visibility', variant: 'destructive' });
    } finally {
      setTenantSaving(false);
    }
  };

  const handleSaveSmsSettings = async () => {
    if (!currentInstituteId) return;
    setSmsSaving(true);
    try {
      const result = await tenantApi.updateSmsSettings(currentInstituteId, {
        smsSenderName: selectedSmsMask === '__default__' ? null : (selectedSmsMask || null),
      });
      setSmsSettings(result);
      toast({ title: 'Success', description: 'SMS settings updated' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to update SMS settings', variant: 'destructive' });
    } finally {
      setSmsSaving(false);
    }
  };

  const handleSavePrinterSettings = async () => {
    if (!currentInstituteId) return;
    setPrinterSaving(true);
    try {
      await instituteSettingsApi.updatePrinterSettings(currentInstituteId, printerForm);
      await instituteSettingsApi.getPrintSettings(currentInstituteId, true);
      toast({ title: 'Success', description: 'Printer settings saved.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to save printer settings', variant: 'destructive' });
    } finally {
      setPrinterSaving(false);
    }
  };

  const handleSavePhotoPolicy = async () => {
    if (!currentInstituteId) return;
    setPhotoUploadSaving(true);
    try {
      await enhancedCachedClient.patch(
        `/institutes/${currentInstituteId}/settings`,
        { allowUserPhotoUpload },
        { instituteId: currentInstituteId },
      );
      await secureCache.clearCache(`/institutes/${currentInstituteId}/settings`, {}, { instituteId: currentInstituteId });
      toast({ title: 'Success', description: 'Photo policy saved.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to save photo policy', variant: 'destructive' });
    } finally {
      setPhotoUploadSaving(false);
    }
  };

  const handleSaveSessionLimits = async () => {
    if (!currentInstituteId) return;
    setSessionLimitSaving(true);
    try {
      const payload: Record<string, any> = {
        isSessionLimitEnabled: sessionLimitEnabled,
        isStrictSessionLimit: strictSessionLimit,
      };
      if (sessionLimitEnabled && showCountChanged) {
        payload.defaultSessionsPerUserCount = defaultSessionCount;
        if (sessionLimitMode !== 'CUSTOM') {
          payload.sessionLimitUpdateMode = sessionLimitMode;
        }
      }
      await enhancedCachedClient.patch(
        `/institutes/${currentInstituteId}/settings`,
        payload,
        { instituteId: currentInstituteId },
      );
      // Clear cache explicitly to ensure fresh data is loaded
      await secureCache.clearCache(`/institutes/${currentInstituteId}/settings`, {}, { instituteId: currentInstituteId });
      toast({ title: 'Success', description: 'Session limit settings saved.' });
      setShowCountChanged(false);
      loadSettings();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to save session limits', variant: 'destructive' });
    } finally {
      setSessionLimitSaving(false);
    }
  };

  const loadInstituteUsers = useCallback(async () => {
    if (!currentInstituteId) return;
    setCustomUsersLoading(true);
    try {
      const res = await enhancedCachedClient.get<{ data: Array<{ id: string; name: string; userIdByInstitute?: string | null }> }>(
        `/institutes/${currentInstituteId}/users`,
        { limit: 200 },
        { ttl: 30, instituteId: currentInstituteId },
      );
      setInstituteUsersList(res?.data || []);
    } catch {
      setInstituteUsersList([]);
    } finally {
      setCustomUsersLoading(false);
    }
  }, [currentInstituteId]);

  const handleApplyCustomUsers = async () => {
    if (!currentInstituteId || selectedCustomUsers.length === 0) return;
    setCustomUsersSaving(true);
    try {
      await enhancedCachedClient.post(
        `/v2/auth/institute/admin/${currentInstituteId}/users/bulk-device-limit`,
        { userIds: selectedCustomUsers, maxDevices: defaultSessionCount },
      );
      toast({ title: 'Success', description: `Device limit applied to ${selectedCustomUsers.length} user(s).` });
      setCustomUsersDialogOpen(false);
      setSelectedCustomUsers([]);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to apply limit', variant: 'destructive' });
    } finally {
      setCustomUsersSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Unable to load institute settings.</p>
      </div>
    );
  }

  const filteredSectionItems = SECTION_ITEMS.filter(item => {
    if (item.id === 'tenant') {
        return isFeatureEnabled('login-branding');
    }
    return true;
  });

  const isFullWidthTab = activeTab === 'features' || activeTab === 'user-types';
  return (
    <div className={`p-4 sm:p-6 space-y-6 ${isFullWidthTab ? 'max-w-none' : 'max-w-5xl mx-auto'}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 w-fit text-muted-foreground hover:text-foreground" onClick={() => navigate(backToProfilePath)}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Institute Profile
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            Institute Settings
          </h1>
          <p className="text-muted-foreground mt-1">Manage your institute's information, branding, and online presence</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadSettings} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={settings.isActive ? 'default' : 'secondary'} className="text-xs">
          {settings.isActive ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
          {settings.isActive ? 'Active' : 'Inactive'}
        </Badge>
        {settings.type && <Badge variant="outline" className="text-xs">{settings.type}</Badge>}
        {settings.code && <Badge variant="outline" className="text-xs">Code: {settings.code}</Badge>}
        {hasChanges && <Badge className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">Unsaved Changes</Badge>}
      </div>

      {/* Settings Tabs */}
      {isMobile && !mobileSection ? (
        <div className="divide-y divide-border/40 border border-border/50 rounded-xl overflow-hidden bg-card/50 mt-4">
          {filteredSectionItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleMobileSection(item.id)}
                className="w-full flex items-center gap-4 px-4 py-4 text-left active:bg-muted/60 transition-colors"
                type="button"
              >
                <div className={`p-2.5 rounded-xl ${item.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            );
          })}
        </div>
      ) : !isMobile && !desktopSection ? (
        <div className="space-y-2 mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">Select Section</p>
          <div className="divide-y divide-border/40 border border-border/50 rounded-xl overflow-hidden bg-card/50">
            {filteredSectionItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleDesktopSection(item.id)}
                  className="w-full flex items-center gap-4 px-4 py-4 text-left transition-all bg-card/50 hover:bg-muted/50"
                >
                  <div className={`p-2.5 rounded-xl ${item.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={isMobile ? "space-y-4 mt-4" : "mt-4"}>
          {isMobile && mobileSection && (
            <div className="flex items-center mb-4">
              <button
                onClick={() => handleMobileSection(null)}
                className="flex items-center gap-2 text-sm font-medium text-primary active:opacity-70 transition-opacity"
                type="button"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
                Back to Menu
              </button>
            </div>
          )}
          {isMobile && mobileSection && (
            <h2 className="text-lg font-bold text-foreground mb-4">
              {mobileSection === 'basic' && 'Basic Information'}
              {mobileSection === 'branding' && 'Branding'}
              {mobileSection === 'printer' && 'Printer Settings'}
              {mobileSection === 'tenant' && 'Domain & Login Page'}
              {mobileSection === 'sms' && 'SMS & Messaging'}
              {mobileSection === 'location' && 'Location & Address'}
              {mobileSection === 'about' && 'About'}
              {mobileSection === 'online' && 'Online Presence'}
              {mobileSection === 'integrations' && 'Integrations'}
              {mobileSection === 'user-columns' && 'User Columns'}
              {mobileSection === 'session-limits' && 'Session Limits'}
              {mobileSection === 'features' && 'Feature Management'}
              {mobileSection === 'user-types' && 'User Types & Permissions'}
            </h2>
          )}
          {!isMobile && desktopSection && (
            <div className="flex items-center mb-4">
              <button
                onClick={() => handleDesktopSection(null)}
                className="flex items-center gap-2 text-sm font-medium text-primary transition-opacity hover:opacity-80"
                type="button"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
                Back to Sections
              </button>
            </div>
          )}
          <Tabs value={isMobile ? mobileSection : activeTab} onValueChange={handleTabChange} className="w-full">
            {!isMobile && (
              <></>
            )}

            {/* Basic Info */}
        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
              <CardDescription>Core institute details and contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Institute Name</Label>
                  <Input value={formData.name || ''} onChange={e => handleChange('name', e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label>Short Name</Label>
                  <Input value={formData.shortName || ''} onChange={e => handleChange('shortName', e.target.value)} maxLength={50} />
                </div>
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input value={formData.code || ''} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">Code cannot be changed</p>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={formData.email || ''} onChange={e => handleChange('email', e.target.value)} maxLength={60} />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={formData.phone || ''} onChange={e => handleChange('phone', e.target.value)} maxLength={15} />
                </div>
                <div className="space-y-2">
                  <Label>System Contact Email</Label>
                  <Input value={formData.systemContactEmail || ''} onChange={e => handleChange('systemContactEmail', e.target.value)} placeholder="Internal admin email" />
                </div>
                <div className="space-y-2">
                  <Label>System Contact Phone</Label>
                  <Input value={formData.systemContactPhoneNumber || ''} onChange={e => handleChange('systemContactPhoneNumber', e.target.value)} placeholder="Internal admin phone" />
                </div>
                <div className="space-y-2">
                  <Label>Institute Type</Label>
                  <Input value={formData.type || ''} onChange={e => handleChange('type', e.target.value)} placeholder="e.g. SCHOOL" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Branding & Appearance</CardTitle>
              <CardDescription>Logo, colors, and visual identity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Image Uploaders */}
              {currentInstituteId && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ImageFieldUploader
                      instituteId={currentInstituteId}
                      field="logo"
                      settingsField="logoUrl"
                      currentDisplayUrl={settings?.logoUrl || null}
                      label="Institute Logo"
                      accept="image/*"
                      onUpdate={handleSettingsRefresh as any}
                    />
                    <ImageFieldUploader
                      instituteId={currentInstituteId}
                      field="loading-gif"
                      settingsField="loadingGifUrl"
                      currentDisplayUrl={settings?.loadingGifUrl || null}
                      label="Loading Animation (GIF)"
                      accept="image/gif,image/*"
                      onUpdate={handleSettingsRefresh as any}
                    />
                  </div>
                  <ImageFieldUploader
                    instituteId={currentInstituteId}
                    field="cover-image"
                    settingsField="imageUrl"
                    currentDisplayUrl={settings?.imageUrl || null}
                    label="Cover Image"
                    accept="image/*"
                    onUpdate={handleSettingsRefresh as any}
                  />

                  <Separator />

                  <GalleryManager
                    instituteId={currentInstituteId}
                    imageUrls={settings?.imageUrls || []}
                    onUpdate={handleSettingsRefresh as any}
                  />

                  <Separator />

                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold">PDF Report Branding</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        These images appear on every generated student report PDF. Select a file and crop it to the correct banner ratio.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <ReportBannerUploader
                        instituteId={currentInstituteId}
                        settingsField="reportHeaderUrl"
                        currentDisplayUrl={settings.reportHeaderUrl || null}
                        label="Report Header Banner"
                        aspectRatio={8}
                        recommendedSize="1400 × 175 px"
                        onUpdate={(updated) => {
                          import('@/utils/instituteReportBranding').then(m => m.clearInstituteReportBrandingCache(currentInstituteId));
                          handleSettingsRefresh(updated as any);
                        }}
                      />
                      <ReportBannerUploader
                        instituteId={currentInstituteId}
                        settingsField="reportFooterUrl"
                        currentDisplayUrl={settings.reportFooterUrl || null}
                        label="Report Footer Banner"
                        aspectRatio={14}
                        recommendedSize="1400 × 100 px"
                        onUpdate={(updated) => {
                          import('@/utils/instituteReportBranding').then(m => m.clearInstituteReportBrandingCache(currentInstituteId));
                          handleSettingsRefresh(updated as any);
                        }}
                      />
                    </div>
                  </div>

                  <Separator />
                </>
              )}

              {/* Colors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.primaryColorCode || '#1976D2'}
                      onChange={e => handleChange('primaryColorCode', e.target.value)}
                      className="h-12 w-12 rounded-lg border border-border cursor-pointer"
                    />
                    <Input value={formData.primaryColorCode || ''} onChange={e => handleChange('primaryColorCode', e.target.value)} placeholder="#1976D2" maxLength={7} className="flex-1" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.secondaryColorCode || '#FFC107'}
                      onChange={e => handleChange('secondaryColorCode', e.target.value)}
                      className="h-12 w-12 rounded-lg border border-border cursor-pointer"
                    />
                    <Input value={formData.secondaryColorCode || ''} onChange={e => handleChange('secondaryColorCode', e.target.value)} placeholder="#FFC107" maxLength={7} className="flex-1" />
                  </div>
                </div>
              </div>

              {/* Color Preview */}
              {(formData.primaryColorCode || formData.secondaryColorCode) && (
                <div className="p-4 rounded-xl border border-border bg-muted/30">
                  <Label className="text-sm text-muted-foreground mb-3 block">Color Preview</Label>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-16 rounded-lg shadow-sm flex items-center justify-center text-white font-semibold text-sm" style={{ backgroundColor: formData.primaryColorCode || '#1976D2' }}>
                      Primary
                    </div>
                    <div className="flex-1 h-16 rounded-lg shadow-sm flex items-center justify-center font-semibold text-sm" style={{ backgroundColor: formData.secondaryColorCode || '#FFC107' }}>
                      Secondary
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ PRINTER SETTINGS TAB ═══ */}
        <TabsContent value="printer">
          <div className="space-y-6">
            {/* Paper Size */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Printer className="h-5 w-5" />
                  Receipt Printer Settings
                </CardTitle>
                <CardDescription>Configure the default paper size, language, and receipt header/footer for physical payment receipts.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Paper Size */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Default Paper Size</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(['2inch', '3inch', '4inch', 'a4'] as const).map(size => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setPrinterForm(prev => ({ ...prev, defaultSize: size }))}
                        className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 p-4 text-sm font-medium transition-colors ${
                          printerForm.defaultSize === size
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        <Printer className="h-5 w-5" />
                        <span>{size === 'a4' ? 'A4' : size}</span>
                        <span className="text-xs opacity-70">
                          {size === '2inch' ? '58 mm' : size === '3inch' ? '80 mm' : size === '4inch' ? '104 mm' : '210 mm'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Language */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Print Language</Label>
                  <p className="text-xs text-muted-foreground">Field labels switch language. Student names, IDs, and class names always print as-is.</p>
                  <div className="flex gap-3">
                    {([{ value: 'en', label: 'English' }, { value: 'si', label: 'සිංහල (Sinhala)' }] as const).map(lang => (
                      <button
                        key={lang.value}
                        type="button"
                        onClick={() => setPrinterForm(prev => ({ ...prev, language: lang.value }))}
                        className={`flex-1 rounded-xl border-2 py-3 px-4 text-sm font-medium transition-colors ${
                          printerForm.language === lang.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/40'
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Custom Header / Footer Text */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Custom Receipt Header Text</Label>
                    <p className="text-xs text-muted-foreground">Printed at the top of every receipt, below the header image (if set).</p>
                    <Textarea
                      value={printerForm.receiptHeader ?? ''}
                      onChange={e => setPrinterForm(prev => ({ ...prev, receiptHeader: e.target.value }))}
                      placeholder="e.g. Thank you for your payment!"
                      rows={2}
                      maxLength={200}
                    />
                    <p className="text-xs text-muted-foreground text-right">{(printerForm.receiptHeader ?? '').length}/200</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Custom Receipt Footer Text</Label>
                    <p className="text-xs text-muted-foreground">Printed at the bottom of every receipt, above the footer image (if set).</p>
                    <Textarea
                      value={printerForm.receiptFooter ?? ''}
                      onChange={e => setPrinterForm(prev => ({ ...prev, receiptFooter: e.target.value }))}
                      placeholder="e.g. Queries? Call +94 77 123 4567"
                      rows={2}
                      maxLength={200}
                    />
                    <p className="text-xs text-muted-foreground text-right">{(printerForm.receiptFooter ?? '').length}/200</p>
                  </div>
                </div>

                {isInstituteAdmin && (
                  <Button onClick={handleSavePrinterSettings} disabled={printerSaving}>
                    {printerSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Printer Settings
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Receipt Header / Footer Image Upload — separate from PDF report banners */}
            {currentInstituteId && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Receipt Header &amp; Footer Images</CardTitle>
                  <CardDescription>
                    Upload banner images that appear at the top and bottom of every printed receipt.
                    These are <strong>separate</strong> from the PDF report header/footer — sized for thermal paper widths, not A4.
                    Images are scaled horizontally to match the selected paper width; vertical height is unrestricted.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ReportBannerUploader
                      instituteId={currentInstituteId}
                      settingsField="receiptHeaderUrl"
                      currentDisplayUrl={settings?.receiptHeaderUrl || null}
                      label="Receipt Header Banner"
                      aspectRatio={
                        printerForm.defaultSize === '2inch' ? 3 :
                        printerForm.defaultSize === '3inch' ? 4 :
                        printerForm.defaultSize === '4inch' ? 5 : 8
                      }
                      recommendedSize={
                        printerForm.defaultSize === '2inch' ? '576 × 192 px' :
                        printerForm.defaultSize === '3inch' ? '800 × 200 px' :
                        printerForm.defaultSize === '4inch' ? '1040 × 208 px' : '1400 × 175 px'
                      }
                      onUpdate={(updated) => {
                        instituteSettingsApi.getPrintSettings(currentInstituteId, true);
                        handleSettingsRefresh(updated as any);
                      }}
                    />
                    <ReportBannerUploader
                      instituteId={currentInstituteId}
                      settingsField="receiptFooterUrl"
                      currentDisplayUrl={settings?.receiptFooterUrl || null}
                      label="Receipt Footer Banner"
                      aspectRatio={
                        printerForm.defaultSize === '2inch' ? 5 :
                        printerForm.defaultSize === '3inch' ? 7 :
                        printerForm.defaultSize === '4inch' ? 9 : 14
                      }
                      recommendedSize={
                        printerForm.defaultSize === '2inch' ? '576 × 115 px' :
                        printerForm.defaultSize === '3inch' ? '800 × 114 px' :
                        printerForm.defaultSize === '4inch' ? '1040 × 116 px' : '1400 × 100 px'
                      }
                      onUpdate={(updated) => {
                        instituteSettingsApi.getPrintSettings(currentInstituteId, true);
                        handleSettingsRefresh(updated as any);
                      }}
                    />
                  </div>
                  {(settings?.receiptHeaderUrl || settings?.receiptFooterUrl) && (
                    <div className="mt-4 p-3 rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                      <p className="text-sm text-green-700 dark:text-green-400">
                        {settings.receiptHeaderUrl && settings.receiptFooterUrl
                          ? 'Receipt header and footer images are set and will appear on printed receipts.'
                          : settings.receiptHeaderUrl
                          ? 'Receipt header image is set. No footer image uploaded yet.'
                          : 'Receipt footer image is set. No header image uploaded yet.'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ═══ TENANT & DOMAIN TAB ═══ */}
        {isFeatureEnabled('login-branding') && (
        <TabsContent value="tenant">
          <div className="space-y-6">
            {/* Tier & Plan Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Current Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <Badge className={`text-sm px-3 py-1 ${
                    effectiveTier === 'ENTERPRISE' ? 'bg-orange-100 text-orange-700' :
                    effectiveTier === 'PROFESSIONAL' ? 'bg-purple-100 text-purple-700' :
                    effectiveTier === 'STARTER' ? 'bg-blue-100 text-blue-700' :
                    effectiveTier === 'ISOLATED' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {effectiveTier}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {effectiveTier === 'ENTERPRISE' ? 'Custom domain + full branding' :
                     effectiveTier === 'PROFESSIONAL' ? 'Video backgrounds + advanced branding' :
                     effectiveTier === 'STARTER' ? 'Subdomain + basic login branding' :
                     effectiveTier === 'ISOLATED' ? 'Full white-label' :
                     'Default login via lms.suraksha.lk'}
                  </span>
                </div>
                {planInfo?.features && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
                    {[
                      { key: 'subdomain', label: 'Custom Subdomain' },
                      { key: 'customDomain', label: 'Custom Domain' },
                      { key: 'loginBranding', label: 'Login Branding' },
                      { key: 'videoBackground', label: 'Video Background' },
                      { key: 'smsMasking', label: 'Custom SMS Sender' },
                      { key: 'whiteLabel', label: 'White Label' },
                    ].map(f => (
                      <div key={f.key} className={`flex items-center gap-2 text-sm ${(planInfo.features as any)[f.key] ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {(planInfo.features as any)[f.key] ? <CheckCircle className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                        {f.label}
                      </div>
                    ))}
                  </div>
                )}
                {isFree && (
                  <div className="mt-4 p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Your institute uses the default login at <strong>lms.suraksha.lk</strong>. Upgrade to <strong>Starter</strong> or higher to get a custom subdomain, login branding, and more.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Contact your system administrator to upgrade your plan.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Visibility — always visible, always locked (admin-only) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Visibility
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </CardTitle>
                <CardDescription>Control where your institute appears</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Visibility settings can only be changed by a system administrator. Contact your admin if you need to update these.
                  </p>
                </div>
                <div className="flex items-center justify-between opacity-60">
                  <div>
                    <Label>Visible in Mobile App</Label>
                    <p className="text-xs text-muted-foreground">Show in the app's institute selector</p>
                  </div>
                  <Switch checked={visibleInApp} disabled />
                </div>
                <div className="flex items-center justify-between opacity-60">
                  <div>
                    <Label>Visible in Web Selector</Label>
                    <p className="text-xs text-muted-foreground">Show in the web institute search/selector</p>
                  </div>
                  <Switch checked={visibleInWeb} disabled />
                </div>
              </CardContent>
            </Card>

            {isFree ? null : (
              <>
                {/* Subdomain Management — STARTER+ */}
                {hasSubdomain && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Link2 className="h-5 w-5" />
                        Custom Subdomain
                      </CardTitle>
                      <CardDescription>
                        Set a custom login URL for your institute (e.g., academy.suraksha.lk)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {(planInfo?.subdomain || settings?.subdomain) ? (
                        <div className="p-4 rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-sm">Active Subdomain</span>
                          </div>
                          <p className="text-sm font-mono text-green-700 dark:text-green-400">
                            https://{planInfo?.subdomain || settings?.subdomain}.suraksha.lk
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Students and staff can use this URL to access your branded login page.
                          </p>
                        </div>
                      ) : null}
                      <div className="space-y-2">
                        <Label>Subdomain</Label>
                        <div className="flex gap-2">
                          <Input
                            value={subdomainInput}
                            onChange={(e) => { setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSubdomainAvailable(null); }}
                            placeholder="your-institute"
                            className="flex-1"
                            maxLength={63}
                          />
                          <span className="flex items-center text-sm text-muted-foreground whitespace-nowrap">.suraksha.lk</span>
                          <Button variant="outline" size="sm" onClick={handleCheckSubdomain} disabled={!subdomainInput.trim() || subdomainChecking}>
                            {subdomainChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check'}
                          </Button>
                        </div>
                        {subdomainAvailable !== null && (
                          <p className={`text-sm flex items-center gap-1.5 ${subdomainAvailable ? 'text-green-600' : 'text-red-600'}`}>
                            {subdomainAvailable ? <><CheckCircle className="h-3.5 w-3.5" /> Available</> : <><AlertCircle className="h-3.5 w-3.5" /> Taken or reserved</>}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Only lowercase letters, numbers, and hyphens. Must start/end with a letter or number.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={handleSetSubdomain} disabled={tenantSaving || !subdomainInput.trim()}>
                          {tenantSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          {(planInfo?.subdomain || settings?.subdomain) ? 'Update Subdomain' : 'Set Subdomain'}
                        </Button>
                        {(planInfo?.subdomain || settings?.subdomain) && (
                          <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={handleRemoveSubdomain} disabled={tenantSaving}>
                            Remove
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Custom Domain — ENTERPRISE+ */}
                {hasCustomDomain && settings.customDomain && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Server className="h-5 w-5" />
                        Custom Domain
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">{settings.customDomain}</Badge>
                        {settings.customDomainVerified ? (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" /> Verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending Verification</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Custom domains are managed by system administrators. Contact support to configure or verify your domain.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Login Page Branding — STARTER+ */}
                {hasLoginBranding && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Palette className="h-5 w-5" />
                        Login Page Branding
                        {!isInstituteAdmin && <Lock className="h-4 w-4 text-muted-foreground" />}
                      </CardTitle>
                      <CardDescription>
                        Customize the appearance of your institute's login page
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!isInstituteAdmin && (
                        <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
                          <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                            <Lock className="h-4 w-4 shrink-0" />
                            Login branding can only be changed by an institute administrator. Please contact your admin.
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Welcome Title</Label>
                          <Input
                            value={brandingForm.loginWelcomeTitle || ''}
                            onChange={e => setBrandingForm(prev => ({ ...prev, loginWelcomeTitle: e.target.value }))}
                            placeholder="Welcome to Academy"
                            maxLength={200}
                            disabled={!isInstituteAdmin}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Custom App Name</Label>
                          <Input
                            value={brandingForm.customAppName || ''}
                            onChange={e => setBrandingForm(prev => ({ ...prev, customAppName: e.target.value }))}
                            placeholder="Academy LMS"
                            maxLength={100}
                            disabled={!isInstituteAdmin}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Welcome Subtitle</Label>
                        <Input
                          value={brandingForm.loginWelcomeSubtitle || ''}
                          onChange={e => setBrandingForm(prev => ({ ...prev, loginWelcomeSubtitle: e.target.value }))}
                          placeholder="Sign in to access your courses"
                          maxLength={500}
                          disabled={!isInstituteAdmin}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Footer Text</Label>
                        <Input
                          value={brandingForm.loginFooterText || ''}
                          onChange={e => setBrandingForm(prev => ({ ...prev, loginFooterText: e.target.value }))}
                          placeholder="© 2026 Academy. All rights reserved."
                          maxLength={200}
                          disabled={!isInstituteAdmin}
                        />
                      </div>

                      <Separator />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <BrandingImageUploader
                          currentUrl={brandingForm.loginLogoUrl}
                          label="Login Logo"
                          description="Logo displayed on the login page"
                          accept="image/*"
                          disabled={false}
                          onUploaded={(url) => setBrandingForm(prev => ({ ...prev, loginLogoUrl: url }))}
                          onRemoved={() => setBrandingForm(prev => ({ ...prev, loginLogoUrl: null }))}
                        />
                        <BrandingImageUploader
                          currentUrl={brandingForm.faviconUrl}
                          label="Favicon"
                          description="Browser tab icon"
                          accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,image/gif,image/*,.ico"
                          disabled={false}
                          onUploaded={(url) => setBrandingForm(prev => ({ ...prev, faviconUrl: url }))}
                          onRemoved={() => setBrandingForm(prev => ({ ...prev, faviconUrl: null }))}
                        />
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label>Background Type</Label>
                        <Select
                          value={brandingForm.loginBackgroundType || 'COLOR'}
                          onValueChange={(v) => setBrandingForm(prev => ({ ...prev, loginBackgroundType: v as LoginBrandingData['loginBackgroundType'] }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="COLOR">Solid Color</SelectItem>
                            <SelectItem value="GRADIENT">Gradient</SelectItem>
                            <SelectItem value="IMAGE">Image</SelectItem>
                            {hasVideoBackground && <SelectItem value="VIDEO">Video</SelectItem>}
                          </SelectContent>
                        </Select>
                        {!hasVideoBackground && (
                          <p className="text-xs text-muted-foreground">Video backgrounds require Professional tier or higher.</p>
                        )}
                      </div>

                      {(brandingForm.loginBackgroundType === 'IMAGE' || brandingForm.loginBackgroundType === 'VIDEO') && (
                        <BrandingImageUploader
                          currentUrl={brandingForm.loginBackgroundUrl}
                          label={`Background ${brandingForm.loginBackgroundType === 'VIDEO' ? 'Video' : 'Image'}`}
                          description={brandingForm.loginBackgroundType === 'VIDEO' ? 'Upload a background video' : 'Upload a background image'}
                          accept={brandingForm.loginBackgroundType === 'VIDEO' ? 'video/*' : 'image/*'}
                          disabled={false}
                          onUploaded={(url) => setBrandingForm(prev => ({ ...prev, loginBackgroundUrl: url }))}
                          onRemoved={() => setBrandingForm(prev => ({ ...prev, loginBackgroundUrl: null }))}
                        />
                      )}

                      {brandingForm.loginBackgroundType === 'VIDEO' && (
                        <BrandingImageUploader
                          currentUrl={brandingForm.loginVideoPosterUrl}
                          label="Video Poster Image"
                          description="Shown while the background video loads"
                          accept="image/*"
                          disabled={false}
                          onUploaded={(url) => setBrandingForm(prev => ({ ...prev, loginVideoPosterUrl: url }))}
                          onRemoved={() => setBrandingForm(prev => ({ ...prev, loginVideoPosterUrl: null }))}
                        />
                      )}

                      <BrandingImageUploader
                        currentUrl={brandingForm.loginIllustrationUrl}
                        label="Login Illustration"
                        description="Decorative illustration shown on the login page"
                        accept="image/*"
                        disabled={false}
                        onUploaded={(url) => setBrandingForm(prev => ({ ...prev, loginIllustrationUrl: url }))}
                        onRemoved={() => setBrandingForm(prev => ({ ...prev, loginIllustrationUrl: null }))}
                      />

                      <Separator />

                      <div className="flex items-center justify-between">
                        <div>
                          <Label className={!hasLoginBranding ? 'opacity-60' : ''}>Show "Powered by SurakshaLMS"</Label>
                          <p className="text-xs text-muted-foreground">
                            Display the SurakshaLMS badge on your login page.{' '}
                            <span className="font-medium text-amber-600 dark:text-amber-400">Only a system administrator can turn this off.</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                          <Switch
                            checked={brandingForm.poweredByVisible ?? true}
                            disabled
                          />
                        </div>
                      </div>

                      {isInstituteAdmin ? (
                        <Button onClick={handleSaveBranding} disabled={tenantSaving}>
                          {tenantSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                          Save Login Branding
                        </Button>
                      ) : (
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          Only institute administrators can save branding changes. Contact your admin.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Visibility already shown above (locked for all tiers) */}
              </>
            )}
          </div>
        </TabsContent>
        )}

        {/* Location */}
        <TabsContent value="location">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Location & Address</CardTitle>
              <CardDescription>Physical location details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Address</Label>
                <Textarea value={formData.address || ''} onChange={e => handleChange('address', e.target.value)} rows={2} placeholder="Street address..." />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input value={formData.city || ''} onChange={e => handleChange('city', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>District</Label>
                  <Input value={formData.district || ''} onChange={e => handleChange('district', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Province</Label>
                  <Input value={formData.province || ''} onChange={e => handleChange('province', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>State</Label>
                  <Input value={formData.state || ''} onChange={e => handleChange('state', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Input value={formData.country || ''} onChange={e => handleChange('country', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Pin Code</Label>
                  <Input value={formData.pinCode || ''} onChange={e => handleChange('pinCode', e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* About */}
        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">About the Institute</CardTitle>
              <CardDescription>Vision, mission, and description</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Vision</Label>
                <Textarea value={formData.vision || ''} onChange={e => handleChange('vision', e.target.value)} rows={3} placeholder="Institute vision statement..." />
              </div>
              <div className="space-y-2">
                <Label>Mission</Label>
                <Textarea value={formData.mission || ''} onChange={e => handleChange('mission', e.target.value)} rows={3} placeholder="Institute mission statement..." />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={formData.description || ''} onChange={e => handleChange('description', e.target.value)} rows={4} placeholder="Brief description of the institute..." />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Online Presence */}
        <TabsContent value="online">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Online Presence</CardTitle>
              <CardDescription>Website and social media links</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  Website URL
                </Label>
                <Input value={formData.websiteUrl || ''} onChange={e => handleChange('websiteUrl', e.target.value)} placeholder="https://your-institute.edu" maxLength={255} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Facebook className="h-4 w-4 text-muted-foreground" />
                  Facebook Page
                </Label>
                <Input value={formData.facebookPageUrl || ''} onChange={e => handleChange('facebookPageUrl', e.target.value)} placeholder="https://facebook.com/your-institute" maxLength={255} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Youtube className="h-4 w-4 text-muted-foreground" />
                  YouTube Channel
                </Label>
                <Input value={formData.youtubeChannelUrl || ''} onChange={e => handleChange('youtubeChannelUrl', e.target.value)} placeholder="https://youtube.com/c/your-institute" maxLength={255} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ SMS & MESSAGING TAB ═══ */}
        <TabsContent value="sms">
          <div className="space-y-6">
            {/* Current Plan for SMS */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-500" />
                  Plan & SMS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-3">
                  <Badge className={`text-sm px-3 py-1 ${
                    effectiveTier === 'ENTERPRISE' ? 'bg-orange-100 text-orange-700' :
                    effectiveTier === 'PROFESSIONAL' ? 'bg-purple-100 text-purple-700' :
                    effectiveTier === 'STARTER' ? 'bg-blue-100 text-blue-700' :
                    effectiveTier === 'ISOLATED' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {effectiveTier}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {hasSmsMasking ? 'Custom SMS Sender Available' : 'Default SMS Sender Only'}
                  </span>
                </div>
                {isFree && (
                  <div className="mt-2 p-3 rounded-lg border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      SMS messages are sent using the default <strong>SurakshaLMS</strong> sender. Upgrade to Starter or higher for custom SMS sender names.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SMS Sender Configuration — STARTER+ only */}
            {hasSmsMasking ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    SMS Sender Name
                  </CardTitle>
                  <CardDescription>
                    Choose which sender name appears when your institute sends SMS messages
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Current SMS Sender</span>
                    </div>
                    <p className="text-lg font-mono font-semibold text-primary">
                      {smsSettings?.effectiveSmsSender || 'SurakshaLMS'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This is the name recipients see when receiving SMS from your institute
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Select SMS Sender</Label>
                    <Select
                      value={selectedSmsMask}
                      onValueChange={setSelectedSmsMask}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose sender name..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            SurakshaLMS (Default)
                          </div>
                        </SelectItem>
                        {smsSettings?.activeMasks?.map(mask => (
                          <SelectItem key={mask.maskId} value={mask.maskId}>
                            <div className="flex items-center gap-2">
                              <Zap className="h-4 w-4 text-yellow-500" />
                              {mask.maskId}
                              {mask.displayName && <span className="text-muted-foreground">({mask.displayName})</span>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {smsSettings?.activeMasks?.length
                        ? `You have ${smsSettings.activeMasks.length} approved custom sender mask(s). Select one or use the default "SurakshaLMS".`
                        : 'No custom sender masks available. Contact your administrator to request a custom sender mask.'}
                    </p>
                  </div>

                  <Button onClick={handleSaveSmsSettings} disabled={smsSaving}>
                    {smsSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save SMS Settings
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center">
                  <Lock className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">Custom SMS sender requires Starter plan or higher</p>
                  <p className="text-xs text-muted-foreground mt-1">Contact your system administrator to upgrade.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Integrations */}
        <TabsContent value="integrations">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Integrations</h2>
              <p className="text-sm text-muted-foreground">Connect third-party services to enhance your institute's capabilities.</p>
            </div>
            {currentInstituteId && settings && (
              <InstituteDriveSettings
                instituteId={currentInstituteId}
                instituteName={settings.name}
                isAdmin={isInstituteAdmin}
              />
            )}
          </div>
        </TabsContent>

        {/* User Columns */}
        <TabsContent value="user-columns">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Custom User Columns</h2>
              <p className="text-sm text-muted-foreground">Define extra data fields that show up in user tables and forms across the entire institute.</p>
            </div>
            <UserExtraColumnsManager
              columns={extraColumns}
              onSave={saveExtraColumns}
            />
          </div>
        </TabsContent>

        {/* Session Limits */}
        <TabsContent value="session-limits">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-teal-600" />
                  Session Limits
                </CardTitle>
                <CardDescription>
                  Control how many devices each user can be simultaneously logged in from.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Enable toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Enable Session Limits</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      When enabled, users will be limited to a set number of concurrent devices.
                    </p>
                  </div>
                  <Switch
                    checked={sessionLimitEnabled}
                    onCheckedChange={setSessionLimitEnabled}
                    disabled={!isInstituteAdmin}
                  />
                </div>

                {sessionLimitEnabled && (
                  <>
                    <Separator />

                    {/* Default max devices */}
                    <div className="space-y-2">
                      <Label>Default max devices per user</Label>
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        value={defaultSessionCount}
                        onChange={e => {
                          const v = parseInt(e.target.value, 10);
                          if (!isNaN(v) && v >= 1) {
                            setDefaultSessionCount(v);
                            setShowCountChanged(true);
                          }
                        }}
                        className="w-32"
                        disabled={!isInstituteAdmin}
                      />
                      <p className="text-xs text-muted-foreground">
                        New users who don't have a custom limit will use this default.
                      </p>
                    </div>

                    <Separator />

                    {/* Strict enforcement toggle */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <Label className="text-base">Strict Device Enforcement</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {strictSessionLimit
                              ? 'Strict — login from a new device is blocked when the limit is reached. The user must ask the admin to remove an existing session first.'
                              : 'Relaxed — when the limit is reached, the oldest session is automatically signed out so the new device can log in.'}
                          </p>
                        </div>
                        <Switch
                          checked={strictSessionLimit}
                          onCheckedChange={setStrictSessionLimit}
                          disabled={!isInstituteAdmin}
                        />
                      </div>
                      {strictSessionLimit ? (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 px-3 py-2.5">
                          <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-amber-800 dark:text-amber-300">
                            <span className="font-semibold">Strict mode:</span> If a user is logged in on iPhone 12 Pro Max (limit = 1), trying to log in on Samsung S21 will be rejected. The admin must go to Device Management and remove the iPhone session before the Samsung can log in.
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/10 px-3 py-2.5">
                          <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-blue-800 dark:text-blue-300">
                            <span className="font-semibold">Relaxed mode:</span> If a user is logged in on iPhone 12 Pro Max (limit = 1) and logs in on Samsung S21, the iPhone session is automatically signed out. All sessions appear in device history.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Apply mode — only shown when count changed */}
                    {showCountChanged && (
                      <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/30">
                        <Label className="text-sm font-semibold">Apply new default to existing users?</Label>
                        <div className="space-y-2">
                          {[
                            { value: 'NEW_USERS_ONLY', label: 'New users only', description: 'Existing users keep their current limits.' },
                            { value: 'ALL_USERS', label: 'Apply to all users', description: 'Override every user in the institute.' },
                            { value: 'USERS_WITH_PREVIOUS_LIMIT', label: 'Apply to users who already have a limit set', description: 'Update only users with a custom limit.' },
                            { value: 'CUSTOM', label: 'Custom — choose specific users', description: 'Pick which users to update.' },
                          ].map(opt => (
                            <label key={opt.value} className="flex items-start gap-3 cursor-pointer group">
                              <input
                                type="radio"
                                name="sessionLimitMode"
                                value={opt.value}
                                checked={sessionLimitMode === opt.value}
                                onChange={() => setSessionLimitMode(opt.value as typeof sessionLimitMode)}
                                className="mt-0.5"
                                disabled={!isInstituteAdmin}
                              />
                              <div>
                                <p className="text-sm font-medium">{opt.label}</p>
                                <p className="text-xs text-muted-foreground">{opt.description}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                        {sessionLimitMode === 'CUSTOM' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => {
                              setCustomUsersDialogOpen(true);
                              loadInstituteUsers();
                            }}
                            disabled={!isInstituteAdmin}
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Choose Users...
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}

                {isInstituteAdmin && (
                  <Button onClick={handleSaveSessionLimits} disabled={sessionLimitSaving}>
                    {sessionLimitSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Session Limits
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* User Photo Policy */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Camera className="h-5 w-5 text-teal-600" />
                  User Photo Policy
                </CardTitle>
                <CardDescription>
                  Control whether users can update their own profile photo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">Allow Users to Upload Profile Photo</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      When disabled, only institute admins can update a user's profile photo.
                    </p>
                  </div>
                  <Switch
                    checked={allowUserPhotoUpload}
                    onCheckedChange={setAllowUserPhotoUpload}
                    disabled={!isInstituteAdmin}
                  />
                </div>

                {isInstituteAdmin && (
                  <Button onClick={handleSavePhotoPolicy} disabled={photoUploadSaving}>
                    {photoUploadSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Photo Policy
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Custom users dialog */}
          <Dialog open={customUsersDialogOpen} onOpenChange={setCustomUsersDialogOpen}>
            <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Choose Users to Update</DialogTitle>
              </DialogHeader>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or user ID..."
                  value={customUserSearch}
                  onChange={e => setCustomUserSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                {customUsersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : instituteUsersList.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
                ) : (
                  instituteUsersList
                    .filter(u => {
                      if (!customUserSearch) return true;
                      const q = customUserSearch.toLowerCase();
                      return (u.name || '').toLowerCase().includes(q) || (u.userIdByInstitute || '').toLowerCase().includes(q);
                    })
                    .map(u => (
                      <label key={u.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                        <Checkbox
                          checked={selectedCustomUsers.includes(u.id)}
                          onCheckedChange={checked => {
                            setSelectedCustomUsers(prev =>
                              checked ? [...prev, u.id] : prev.filter(id => id !== u.id)
                            );
                          }}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{u.name}</p>
                          {u.userIdByInstitute && (
                            <p className="text-xs text-muted-foreground">{u.userIdByInstitute}</p>
                          )}
                        </div>
                      </label>
                    ))
                )}
              </div>
              <DialogFooter className="mt-4 gap-2 flex-col sm:flex-row">
                <span className="text-xs text-muted-foreground self-center mr-auto">
                  {selectedCustomUsers.length} user{selectedCustomUsers.length !== 1 ? 's' : ''} selected
                </span>
                <Button variant="outline" onClick={() => setCustomUsersDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleApplyCustomUsers}
                  disabled={customUsersSaving || selectedCustomUsers.length === 0}
                >
                  {customUsersSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Apply limit to {selectedCustomUsers.length} user{selectedCustomUsers.length !== 1 ? 's' : ''}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="api-keys">
          {currentInstituteId ? (
            <ApiKeysManager
              instituteId={currentInstituteId}
              isAdmin={isInstituteAdmin}
            />
          ) : null}
        </TabsContent>

        {/* Features */}
        <TabsContent value="features">
          <FeatureSettings />
        </TabsContent>

        {/* User Types & Permissions */}
        <TabsContent value="user-types">
          {isInstituteAdmin ? (
            <UserTypesManager />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <Shield className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">Admin access required</p>
              <p className="text-sm mt-1">Only institute administrators can manage user types and permissions.</p>
            </div>
          )}
        </TabsContent>

          </Tabs>
        </div>
      )}

      {/* Floating Save Bar */}
      {hasChanges && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-card border border-border shadow-2xl rounded-2xl px-6 py-3 flex items-center gap-4">
            <span className="text-sm text-muted-foreground">You have unsaved changes</span>
            <Button size="sm" variant="outline" onClick={loadSettings} disabled={saving}>
              Discard
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstituteSettingsPage;
