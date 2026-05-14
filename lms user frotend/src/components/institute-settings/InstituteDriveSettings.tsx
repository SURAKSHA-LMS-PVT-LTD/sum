import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/api/apiError';
import {
  instituteDriveApi,
  InstituteDriveStatus,
} from '@/api/instituteDriveAccess.api';
import { clearInstituteTokenCache } from '@/lib/instituteTokenCache';
import InstituteDriveManageDrawer from './InstituteDriveManageDrawer';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Link2,
  Unlink,
  RefreshCw,
  Mail,
  Calendar,
  Settings2,
  AlertTriangle,
  HardDrive,
} from 'lucide-react';

const GoogleDriveIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.4 9.35z" fill="#ea4335"/>
    <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
    <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
    <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.8h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
  </svg>
);

interface InstituteDriveSettingsProps {
  instituteId: string;
  instituteName: string;
  /** Whether the current user has admin rights (can connect/disconnect) */
  isAdmin: boolean;
}

interface DriveStorage {
  limit: number | null;
  usage: number;
  usageInDrive: number;
  usageInDriveTrash: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const InstituteDriveSettings: React.FC<InstituteDriveSettingsProps> = ({
  instituteId,
  instituteName,
  isAdmin,
}) => {
  const { toast } = useToast();
  const [status, setStatus] = useState<InstituteDriveStatus | null>(null);
  const [storage, setStorage] = useState<DriveStorage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const s = await instituteDriveApi.getStatus(instituteId);
      setStatus(s);
      if (s.isConnected) {
        setLoadingStorage(true);
        instituteDriveApi
          .getStorage(instituteId)
          .then(q => setStorage(q))
          .catch(() => setStorage(null))
          .finally(() => setLoadingStorage(false));
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: getErrorMessage(err, 'Failed to load institute Drive status'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [instituteId, toast]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      const returnUrl = `${window.location.pathname}?tab=integrations`;
      const { authUrl } = await instituteDriveApi.getConnectUrl(instituteId, returnUrl);
      window.location.href = authUrl;
    } catch (err: any) {
      toast({
        title: 'Connection Failed',
        description: getErrorMessage(err, 'Failed to start Google Drive connection'),
        variant: 'destructive',
      });
      setConnecting(false);
    }
  }, [instituteId, toast]);

  const handleDisconnect = useCallback(async () => {
    if (!window.confirm('Disconnect institute Google Drive? Teachers will no longer be able to upload to the shared drive.')) {
      return;
    }
    setDisconnecting(true);
    try {
      await instituteDriveApi.disconnect(instituteId);
      clearInstituteTokenCache(instituteId);
      setStorage(null);
      toast({
        title: 'Disconnected',
        description: 'Institute Google Drive has been disconnected.',
      });
      loadStatus();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: getErrorMessage(err, 'Failed to disconnect'),
        variant: 'destructive',
      });
    } finally {
      setDisconnecting(false);
    }
  }, [instituteId, loadStatus, toast]);

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const usagePercent =
    storage?.limit && storage.limit > 0
      ? Math.min(100, (storage.usage / storage.limit) * 100)
      : null;

  const storageWarning = usagePercent !== null && usagePercent >= 90;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                <GoogleDriveIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Institute Google Drive</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Shared Drive for {instituteName} — files persist even when teachers leave.
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadStatus}
              disabled={loading}
              className="h-8 w-8 shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Checking connection status…</span>
            </div>
          ) : status?.isConnected ? (
            /* ── Connected State ── */
            <div className="space-y-4">
              {/* Profile row */}
              <div className="flex items-center gap-3 rounded-xl border bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/10 p-3">
                <Avatar className="h-12 w-12 ring-2 ring-white dark:ring-zinc-800 shadow-sm">
                  {status.googleProfilePicture && (
                    <AvatarImage
                      src={status.googleProfilePicture}
                      alt={status.googleDisplayName || 'Drive account'}
                    />
                  )}
                  <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-semibold">
                    {status.googleDisplayName?.charAt(0)?.toUpperCase() ||
                      status.googleEmail?.charAt(0)?.toUpperCase() ||
                      'G'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold truncate">
                      {status.googleDisplayName || status.googleEmail}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-[10px] h-4 px-1.5 bg-green-50 text-green-700 border-green-200 shrink-0"
                    >
                      <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                      Connected
                    </Badge>
                    {status.needsReauthorization && (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-4 px-1.5 bg-amber-50 text-amber-700 border-amber-200 shrink-0"
                      >
                        <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                        Reauth needed
                      </Badge>
                    )}
                  </div>
                  {status.googleDisplayName && status.googleEmail && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Mail className="h-3 w-3" />
                      {status.googleEmail}
                    </p>
                  )}
                  {status.connectedAt && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Connected {formatDate(status.connectedAt)}
                    </p>
                  )}
                </div>
              </div>

              {/* Storage bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Storage</span>
                  {loadingStorage && (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                </div>
                {storage ? (
                  <>
                    {storageWarning && (
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        Storage is {usagePercent!.toFixed(0)}% full
                      </div>
                    )}
                    {usagePercent !== null ? (
                      <>
                        <Progress
                          value={usagePercent}
                          className={`h-2 ${storageWarning ? '[&>div]:bg-amber-500' : '[&>div]:bg-blue-500'}`}
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{formatBytes(storage.usageInDrive)} in Drive</span>
                          <span>{formatBytes(storage.usage)} / {formatBytes(storage.limit!)} used</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        {formatBytes(storage.usageInDrive)} used · Unlimited (Workspace)
                      </p>
                    )}
                  </>
                ) : !loadingStorage ? (
                  <p className="text-[11px] text-muted-foreground">Storage info unavailable.</p>
                ) : null}
              </div>

              {/* Reauth warning */}
              {status.needsReauthorization && isAdmin && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    The Drive connection needs to be reauthorized. Click "Reconnect" to re-link the
                    Google account.
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setManageOpen(true)}
                  className="text-xs gap-1.5"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Manage Drive
                </Button>

                {isAdmin && status.needsReauthorization && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleConnect}
                    disabled={connecting}
                    className="text-xs gap-1.5"
                  >
                    {connecting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Link2 className="h-3 w-3" />
                    )}
                    Reconnect
                  </Button>
                )}

                {isAdmin && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="text-xs gap-1.5"
                  >
                    {disconnecting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Unlink className="h-3 w-3" />
                    )}
                    Disconnect
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* ── Disconnected State ── */
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Not connected</span>
              </div>

              <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center space-y-2">
                <HardDrive className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-medium">No institute Drive connected</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Connect a Google account to create a shared Drive for {instituteName}. Teachers will
                  be able to upload lecture documents, homework references, and course material to a
                  persistent, institute-owned storage.
                </p>
                {isAdmin ? (
                  <Button
                    size="sm"
                    onClick={handleConnect}
                    disabled={connecting}
                    className="mt-2 text-xs gap-1.5"
                  >
                    {connecting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Link2 className="h-3 w-3" />
                    )}
                    Connect Google Drive
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground mt-2">
                    Contact your institute administrator to connect a Google Drive.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {status?.isConnected && (
        <InstituteDriveManageDrawer
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          instituteId={instituteId}
          instituteName={instituteName}
          isAdmin={isAdmin}
        />
      )}
    </>
  );
};

export default InstituteDriveSettings;
