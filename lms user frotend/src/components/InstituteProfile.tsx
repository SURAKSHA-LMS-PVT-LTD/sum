import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop, convertToPixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { profileImageApi, type InstituteImageHistoryResponse } from '@/api/profileImage.api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { CACHE_TTL } from '@/config/cacheTTL';
import {
  Camera, Upload, Loader2, Clock, Trash2, History, ChevronRight,
  CheckCircle, XCircle, Monitor, Building2,
  RefreshCw, LogOut, ShieldAlert, Key,
} from 'lucide-react';
import { getActiveSessions, revokeSession, revokeAllSessions } from '@/contexts/utils/auth.api';
import ConnectedApps from '@/components/ConnectedApps';
import InstituteActivation from '@/components/InstituteActivation';

const PROFILE_ASPECT_RATIO = 7 / 9;

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 80 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
}

interface InstituteProfileData {
  id: string;
  name: string;
  shortName?: string;
  code: string;
  phone?: string;
  email?: string;
  city?: string;
  type?: string;
  websiteUrl?: string;
  primaryColorCode?: string;
}

interface InstituteUserProfile {
  userId: string;
  instituteId: string;
  nameWithInitials?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  userType: string;
  status: string;
  userIdByInstitute: string;
  instituteUserImageUrl: string | null;
  instituteCardId: string | null;
  imageVerificationStatus: string;
  isActive: boolean;
  createdAt: string;
}

const InfoRow = ({ label, value }: { label: string; value?: string | null }) => {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground sm:w-40 shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground break-all mt-0.5 sm:mt-0">{value}</span>
    </div>
  );
};

const InstituteProfile = () => {
  const { currentInstituteId, user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [instituteProfile, setInstituteProfile] = useState<InstituteProfileData | null>(null);
  const [userProfile, setUserProfile] = useState<InstituteUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('itab') || 'details';
  const setActiveTab = (tab: string) => setSearchParams({ itab: tab }, { replace: true });

  // ── Image upload state ───────────────────────────────────────
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [cropImgSrc, setCropImgSrc] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageCrop, setImageCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [uploading, setUploading] = useState(false);
  const [deletingPending, setDeletingPending] = useState(false);
  const [instituteImageHistory, setInstituteImageHistory] = useState<InstituteImageHistoryResponse | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  // ── Sessions state ───────────────────────────────────────────
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  // ── Institute activation ─────────────────────────────────────
  const [showActivation, setShowActivation] = useState(false);

  // ── Photo policy ─────────────────────────────────────────────
  const [allowUserPhotoUpload, setAllowUserPhotoUploadState] = useState(true);

  // ── Mobile section state ─────────────────────────────────────
  const [mobileSection, setMobileSection] = useState<string | null>(null);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const data = await getActiveSessions({ sortBy: 'createdAt', sortOrder: 'DESC' });
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load sessions', variant: 'destructive' });
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleRevoke = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      await revokeSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast({ title: 'Session revoked', description: 'Device has been logged out.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to revoke session', variant: 'destructive' });
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAll = async () => {
    setRevokingAll(true);
    try {
      await revokeAllSessions();
      toast({ title: 'All sessions revoked', description: 'Logging out...' });
    } catch {
      toast({ title: 'Error', description: 'Failed to revoke all sessions', variant: 'destructive' });
      setRevokingAll(false);
    }
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast({ title: 'Invalid file', description: 'Only JPEG, PNG, or WebP allowed.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum file size is 5 MB.', variant: 'destructive' });
      return;
    }
    setSelectedImage(file);
    setImageCrop(undefined);
    setCompletedCrop(undefined);
    const reader = new FileReader();
    reader.onload = () => setCropImgSrc(reader.result as string);
    reader.readAsDataURL(file);
    setShowImageUpload(true);
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const crop = centerAspectCrop(width, height, PROFILE_ASPECT_RATIO);
    setImageCrop(crop);
    setCompletedCrop(convertToPixelCrop(crop, width, height));
  };

  const handleImageUpload = async () => {
    if (!completedCrop || !imgRef.current || !selectedImage || !currentInstituteId || !userProfile) return;
    setUploading(true);
    try {
      const canvas = document.createElement('canvas');
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
      canvas.width = completedCrop.width;
      canvas.height = completedCrop.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(
        imgRef.current,
        completedCrop.x * scaleX, completedCrop.y * scaleY,
        completedCrop.width * scaleX, completedCrop.height * scaleY,
        0, 0, completedCrop.width, completedCrop.height,
      );
      const blob = await new Promise<Blob>(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.92));
      const croppedFile = new File([blob], selectedImage.name, { type: 'image/jpeg' });
      await profileImageApi.uploadInstituteProfileImage(userProfile.userId, currentInstituteId, croppedFile);
      toast({ title: 'Image submitted', description: 'Your institute photo is pending review.' });
      setShowImageUpload(false);
      setSelectedImage(null);
      setCropImgSrc('');
      setInstituteImageHistory(null);
      loadData();
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePendingImage = async () => {
    if (!currentInstituteId || !userProfile) return;
    setDeletingPending(true);
    try {
      await profileImageApi.deleteInstituteImage(userProfile.userId, currentInstituteId);
      toast({ title: 'Image removed', description: 'Pending image deleted.' });
      setInstituteImageHistory(null);
      loadData();
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    } finally {
      setDeletingPending(false);
    }
  };

  const loadInstituteImageHistory = useCallback(async () => {
    if (!currentInstituteId || !userProfile) return;
    try {
      const response = await profileImageApi.getInstituteImageHistory(userProfile.userId, currentInstituteId);
      setInstituteImageHistory(response);
    } catch (err) {
      console.error('Failed to load institute image history:', err);
    }
  }, [currentInstituteId, userProfile]);

  const loadData = useCallback(async (forceRefresh = false) => {
    if (!currentInstituteId) return;
    setLoading(true);
    try {
      const [instProfile, userProf, settingsRes] = await Promise.allSettled([
        enhancedCachedClient.get<InstituteProfileData>(
          `/institutes/${currentInstituteId}/profile`,
          {},
          { ttl: CACHE_TTL.INSTITUTE_PROFILE, instituteId: currentInstituteId, forceRefresh },
        ),
        enhancedCachedClient.get<InstituteUserProfile>(
          `/institute-users/institute/${currentInstituteId}/me`,
          {},
          { ttl: CACHE_TTL.INSTITUTE_PROFILE, userId: currentInstituteId, forceRefresh },
        ),
        enhancedCachedClient.get<{ allowUserPhotoUpload?: boolean }>(
          `/institutes/${currentInstituteId}/settings`,
          {},
          { ttl: CACHE_TTL.SETTINGS, instituteId: currentInstituteId },
        ),
      ]);
      if (instProfile.status === 'fulfilled') setInstituteProfile(instProfile.value);
      if (userProf.status === 'fulfilled') setUserProfile(userProf.value);
      if (settingsRes.status === 'fulfilled') setAllowUserPhotoUploadState(settingsRes.value.allowUserPhotoUpload ?? true);
      if (forceRefresh) setInstituteImageHistory(null);
    } catch (error: any) {
      if (!error?.message?.includes('Rate limited')) {
        toast({ title: 'Error', description: 'Failed to load profile data.', variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  }, [currentInstituteId, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (userProfile && currentInstituteId) loadInstituteImageHistory();
  }, [userProfile?.userId, currentInstituteId]);

  useEffect(() => {
    if (activeTab === 'devices' && sessions.length === 0 && !sessionsLoading) loadSessions();
  }, [activeTab]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-3 py-6 space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="flex gap-2">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-9 flex-1 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const inst = instituteProfile;
  const up = userProfile;

  const approvedImageUrl = instituteImageHistory?.currentInstituteImageUrl ?? up?.instituteUserImageUrl ?? '';
  const historyEntries = instituteImageHistory?.data ?? [];
  const latestRecord = historyEntries[0];
  const hasPending = latestRecord?.status === 'PENDING';
  const hasRejected = latestRecord?.status === 'REJECTED';
  const isAdmin = user?.userType === 'INSTITUTE_ADMIN' || user?.userType === 'SYSTEM_ADMIN';
  const canChangePhoto = allowUserPhotoUpload || isAdmin;

  const getUserInitials = () =>
    `${up?.firstName?.[0] || ''}${up?.lastName?.[0] || ''}`.toUpperCase() || 'U';

  // ── Profile header ───────────────────────────────────────────
  const profileHeader = (
    <Card className="overflow-hidden">
      <div className="hidden lg:block">
        <div className="relative h-32 bg-gradient-to-r from-primary/30 via-primary/20 to-primary/10 dark:from-primary/20 dark:via-primary/15 dark:to-primary/5" />
        <div className="relative px-6 pb-5">
          <div className="flex items-end gap-5 -mt-14">
            <Avatar className="h-28 w-28 ring-4 ring-background shadow-xl shrink-0">
              <AvatarImage src={approvedImageUrl} className="object-cover" />
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 pb-1">
              <h1 className="text-2xl font-bold text-foreground truncate">
                {up?.nameWithInitials || `${up?.firstName} ${up?.lastName}` || 'Institute Profile'}
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5 truncate">{inst?.name}</p>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted-foreground font-mono">
                {up?.userIdByInstitute && <span>Institute ID: {up.userIdByInstitute}</span>}
                {user?.id && <span>System ID: {user.id}</span>}
              </div>
              {hasPending && (
                <Badge className="mt-2 bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 text-xs gap-1">
                  <Clock className="h-3 w-3" />Photo Under Review
                </Badge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => loadData(true)} className="shrink-0">
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh
            </Button>
          </div>
        </div>
      </div>
      <div className="lg:hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 ring-2 ring-primary/20 shrink-0">
              <AvatarImage src={approvedImageUrl} className="object-cover" />
              <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate">
                {up?.nameWithInitials || `${up?.firstName} ${up?.lastName}`}
              </h1>
              <p className="text-xs text-muted-foreground truncate">{inst?.name}</p>
              <div className="flex flex-col gap-0.5 mt-1 text-[10px] text-muted-foreground font-mono">
                {up?.userIdByInstitute && <span>Institute ID: {up.userIdByInstitute}</span>}
                {user?.id && <span>System ID: {user.id}</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );

  // ── Tabs list ────────────────────────────────────────────────
  const tabs = [
    { id: 'details', label: 'Details' },
    { id: 'image', label: 'Image' },
    { id: 'security', label: 'Security' },
    { id: 'devices', label: 'Devices' },
    { id: 'apps', label: 'Apps' },
  ];

  // ── Details content ──────────────────────────────────────────
  const detailsContent = (
    <Card>
      <CardContent className="pt-4 space-y-0">
        <InfoRow label="Name with Initials" value={up?.nameWithInitials} />
        <InfoRow label="Full Name" value={`${up?.firstName || ''} ${up?.lastName || ''}`.trim()} />
        <InfoRow label="Email" value={up?.email} />
        <InfoRow label="Phone" value={up?.phoneNumber} />
        <InfoRow label="Institute User ID" value={up?.userIdByInstitute} />
        <InfoRow label="System User ID" value={user?.id} />
        <InfoRow label="Institute Card ID" value={up?.instituteCardId} />
        <InfoRow label="Institute" value={inst?.name} />
        {up?.createdAt && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 border-b border-border/30 last:border-0">
            <span className="text-xs text-muted-foreground sm:w-40 shrink-0">Member Since</span>
            <span className="text-sm font-medium mt-0.5 sm:mt-0">
              {new Date(up.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ── Image content ────────────────────────────────────────────
  const imageContent = (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />Institute Photo
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => loadData(true)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          This is your photo for <strong>{inst?.name}</strong>. It is separate from your main profile photo and is specific to this institute.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-5">
          <div className="shrink-0 flex flex-col items-center gap-1.5">
            <Avatar className="h-24 w-24 ring-2 ring-primary/20">
              <AvatarImage src={approvedImageUrl} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">{getUserInitials()}</AvatarFallback>
            </Avatar>
            {hasPending && (
              <Badge className="bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 text-xs gap-1">
                <Clock className="h-3 w-3" />Under Review
              </Badge>
            )}
            {!hasPending && !hasRejected && up?.imageVerificationStatus === 'VERIFIED' && (
              <Badge className="bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/30 dark:text-green-400 text-xs gap-1">
                <CheckCircle className="h-3 w-3" />Verified
              </Badge>
            )}
            {hasRejected && (
              <Badge className="bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/30 dark:text-red-400 text-xs gap-1">
                <XCircle className="h-3 w-3" />Rejected
              </Badge>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {canChangePhoto ? (
              <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                <Camera className="h-3.5 w-3.5 mr-1.5" />
                {hasRejected ? 'Re-upload Photo' : 'Change Photo'}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground italic">Photo changes are managed by the institute admin.</p>
            )}
            {canChangePhoto && hasPending && (
              <Button size="sm" variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                onClick={handleDeletePendingImage} disabled={deletingPending}>
                {deletingPending
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Removing…</>
                  : <><Trash2 className="h-3.5 w-3.5 mr-1.5" />Cancel Submission</>}
              </Button>
            )}
          </div>
        </div>

        {hasPending && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/50">
            {latestRecord?.imageUrl ? (
              <Avatar className="h-12 w-12 shrink-0 rounded-lg">
                <AvatarImage src={latestRecord.imageUrl} className="object-cover" />
                <AvatarFallback className="rounded-lg bg-muted text-xs">?</AvatarFallback>
              </Avatar>
            ) : <Clock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />}
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">New photo under review</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Your current photo stays visible until approved.</p>
            </div>
          </div>
        )}

        {hasRejected && (
          <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800/50">
            <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">Photo rejected</p>
              <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
                {latestRecord?.rejectionReason ? `Reason: ${latestRecord.rejectionReason}` : 'Please upload a new passport-style photo.'}
              </p>
            </div>
          </div>
        )}

        <Button size="sm" variant="outline" className="w-full"
          onClick={() => {
            const next = !showHistory;
            setShowHistory(next);
            if (next) {
              if (!instituteImageHistory) loadInstituteImageHistory();
              setTimeout(() => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
            }
          }}>
          <History className="h-3.5 w-3.5 mr-1.5" />
          {showHistory ? 'Hide History' : 'View History'}
          <ChevronRight className={`h-3.5 w-3.5 ml-1 transition-transform ${showHistory ? 'rotate-90' : ''}`} />
        </Button>

        {showHistory && (
          <div ref={historyRef} className="space-y-2 scroll-mt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Submission History</p>
            {!instituteImageHistory ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading…
              </div>
            ) : historyEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No history yet.</p>
            ) : (
              <div className="space-y-2">
                {historyEntries.map(entry => (
                  <div key={entry.imageId} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/40 border border-border/40 text-xs">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={entry.imageUrl} className="object-cover" />
                      <AvatarFallback className="text-[10px]">IMG</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {entry.status === 'VERIFIED' && <Badge className="bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/30 dark:text-green-400 text-[10px] h-4 gap-0.5"><CheckCircle className="h-2.5 w-2.5" />Verified</Badge>}
                        {entry.status === 'PENDING' && <Badge className="bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] h-4 gap-0.5"><Clock className="h-2.5 w-2.5" />Pending</Badge>}
                        {entry.status === 'REJECTED' && <Badge className="bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/30 dark:text-red-400 text-[10px] h-4 gap-0.5"><XCircle className="h-2.5 w-2.5" />Rejected</Badge>}
                        <span className="text-muted-foreground">{new Date(entry.submittedAt).toLocaleDateString()}</span>
                      </div>
                      {entry.rejectionReason && <p className="text-red-600 dark:text-red-400">Reason: {entry.rejectionReason}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ── Security content ─────────────────────────────────────────
  const securityContent = (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />Institute Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Set a separate password to log into <strong>{inst?.name}</strong> directly through their
            {inst?.code ? ` subdomain or` : ''} custom domain. This is completely independent from your
            main SurakshLMS account password.
          </p>
          <div className="p-3 rounded-lg bg-muted/50 border border-border/40 space-y-1 text-xs text-muted-foreground">
            <p className="font-medium text-foreground text-sm">How to use this password:</p>
            <p>When logging in through the institute's dedicated portal, use:</p>
            <p className="font-mono bg-background border border-border/60 rounded px-2 py-1 text-foreground">
              ID: {up?.userIdByInstitute || '—'}
            </p>
            <p>...with the institute password you set below.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowActivation(true)}>
            <Key className="h-4 w-4 mr-2" />
            Activate / Manage Institute Password
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showActivation} onOpenChange={setShowActivation} routeName="activate-institute-popup">
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Institute Profile Activation</DialogTitle>
          </DialogHeader>
          {currentInstituteId && (
            <InstituteActivation
              instituteId={currentInstituteId}
              instituteName={inst?.name}
              onComplete={() => setShowActivation(false)}
              onCancel={() => setShowActivation(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );

  // ── Devices content ──────────────────────────────────────────
  const devicesContent = (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Devices ({sessions.length})</CardTitle>
            <Button variant="ghost" size="sm" onClick={loadSessions} disabled={sessionsLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${sessionsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Devices currently logged into your account.</p>
        </CardHeader>
        <CardContent className="space-y-1">
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No active sessions found.</p>
          ) : (
            sessions.map((session, index) => (
              <React.Fragment key={session.id}>
                {index > 0 && <Separator />}
                <div className="flex items-center gap-4 py-3">
                  <div className="shrink-0 text-muted-foreground p-2 rounded-lg bg-muted/50">
                    <Monitor className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{session.deviceName || 'Device'}</span>
                      {session.isCurrent && <Badge variant="secondary" className="text-xs">This device</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                      {session.ipAddress && <p>IP: {session.ipAddress}</p>}
                      <p>Logged in: {session.createdAt ? new Date(session.createdAt).toLocaleString() : 'Unknown'}</p>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <Button variant="outline" size="sm" onClick={() => handleRevoke(session.id)} disabled={revoking === session.id} className="shrink-0">
                      <LogOut className="h-3.5 w-3.5 mr-1" />
                      {revoking === session.id ? 'Revoking...' : 'Log out'}
                    </Button>
                  )}
                </div>
              </React.Fragment>
            ))
          )}
        </CardContent>
      </Card>
      {sessions.length > 1 && (
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold">Log out everywhere</h3>
                <p className="text-xs text-muted-foreground mt-1">Revokes all sessions including this device.</p>
                <Button variant="destructive" size="sm" className="mt-3" onClick={handleRevokeAll} disabled={revokingAll}>
                  {revokingAll ? 'Revoking all...' : 'Log out of all devices'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderTabContent = (tab: string) => {
    switch (tab) {
      case 'details': return detailsContent;
      case 'image': return imageContent;
      case 'security': return securityContent;
      case 'devices': return devicesContent;
      case 'apps': return <ConnectedApps />;
      default: return detailsContent;
    }
  };

  // ── Mobile layout ────────────────────────────────────────────
  const menuItems = [
    { id: 'details', label: 'My Details', description: 'Your personal info at this institute' },
    { id: 'image', label: 'Institute Photo', description: 'Upload & verification status' },
    { id: 'security', label: 'Institute Password', description: 'Manage institute login password' },
    { id: 'devices', label: 'Devices', description: 'Active sessions' },
    { id: 'apps', label: 'Connected Apps', description: 'Third-party connections' },
  ];

  if (isMobile) {
    if (mobileSection) {
      const item = menuItems.find(m => m.id === mobileSection);
      return (
        <div className="px-3 py-4 pb-20 space-y-4">
          <button
            onClick={() => setMobileSection(null)}
            className="flex items-center gap-2 text-sm font-medium text-primary active:opacity-70 transition-opacity"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            Back to Institute Profile
          </button>
          <h2 className="text-lg font-bold">{item?.label}</h2>
          {renderTabContent(mobileSection)}
        </div>
      );
    }

    return (
      <div className="px-3 py-4 pb-20 space-y-4">
        {profileHeader}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {menuItems.map((item, index) => (
              <button
                key={item.id}
                onClick={() => {
                  setMobileSection(item.id);
                  if (item.id === 'devices' && sessions.length === 0) loadSessions();
                }}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 text-left active:bg-muted/60 transition-colors ${index < menuItems.length - 1 ? 'border-b border-border/40' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Desktop layout ───────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-6">
      {profileHeader}

      {/* Tab bar */}
      <div className="flex gap-0 border border-border/50 rounded-lg overflow-hidden bg-muted/30">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === 'devices' && sessions.length === 0) loadSessions();
            }}
            className={`flex-1 py-2.5 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {renderTabContent(activeTab)}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={handleImageFileSelect}
      />

      {/* Crop dialog */}
      <Dialog open={showImageUpload} onOpenChange={open => { if (!open) setShowImageUpload(false); }} routeName="upload-institute-logo-popup">
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crop Institute Photo (35mm × 45mm)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {cropImgSrc && (
              <div className="flex justify-center overflow-hidden rounded-xl">
                <ReactCrop
                  crop={imageCrop}
                  onChange={(_, pct) => setImageCrop(pct)}
                  onComplete={c => setCompletedCrop(c)}
                  aspect={PROFILE_ASPECT_RATIO}
                  minWidth={30}
                  minHeight={30}
                  keepSelection
                >
                  <img
                    ref={imgRef}
                    src={cropImgSrc}
                    alt="Crop"
                    onLoad={handleImageLoad}
                    style={{ maxHeight: 360, maxWidth: '100%', display: 'block' }}
                  />
                </ReactCrop>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowImageUpload(false)} disabled={uploading}>Cancel</Button>
              <Button className="flex-1" onClick={handleImageUpload} disabled={!completedCrop || uploading}>
                {uploading
                  ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Uploading…</>
                  : <><Upload className="h-4 w-4 mr-1.5" />Upload</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstituteProfile;
