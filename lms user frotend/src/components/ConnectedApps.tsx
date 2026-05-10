import React, { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useDriveCallback } from '@/hooks/useDriveCallback';
import {
  checkDriveConnection,
  getDriveConnectUrl,
  disconnectDrive,
  DriveConnectionStatus,
} from '@/services/driveService';
import { clearDriveTokenCache } from '@/lib/driveTokenCache';
import {
  Cloud,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Link2,
  Unlink,
  AlertTriangle,
  HardDrive,
} from 'lucide-react';

const ConnectedApps: React.FC = () => {
  const { toast } = useToast();
  const [driveStatus, setDriveStatus] = useState<DriveConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadDriveStatus = useCallback(async () => {
    setLoading(true);
    try {
      const status = await checkDriveConnection();
      setDriveStatus(status);
    } catch (err) {
      console.error('Failed to check drive connection:', err);
      setDriveStatus({ isConnected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDriveStatus();
  }, [loadDriveStatus]);

  // Handle OAuth callback — web query params OR mobile deep link
  useDriveCallback(
    (email) => {
      setConnecting(false);
      toast({
        title: 'Google Drive Connected',
        description: `Successfully connected: ${email}`,
      });
      loadDriveStatus();
    },
    (error) => {
      setConnecting(false);
      toast({
        title: 'Connection Failed',
        description: error,
        variant: 'destructive',
      });
    },
  );

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const isMobile = Capacitor.isNativePlatform();
      const returnUrl = isMobile
        ? undefined
        : window.location.pathname.includes('/profile')
          ? window.location.pathname + '?tab=apps'
          : window.location.pathname;
      const { authUrl } = await getDriveConnectUrl(returnUrl, isMobile ? 'mobile' : 'web');

      if (isMobile) {
        // Open system browser so Google redirects to the deep link lk.suraksha.lms://drive-callback
        window.open(authUrl, '_system');
        // Reset spinner — user has left to system browser; result arrives via appUrlOpen
        setTimeout(() => setConnecting(false), 800);
      } else {
        window.location.href = authUrl;
      }
    } catch (err: any) {
      setConnecting(false);
      toast({
        title: 'Connection Failed',
        description: err.message || 'Failed to initiate Google Drive connection',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectDrive();
      clearDriveTokenCache();
      setDriveStatus({ isConnected: false });
      toast({
        title: 'Disconnected',
        description: 'Google Drive has been disconnected from your account.',
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to disconnect Google Drive',
        variant: 'destructive',
      });
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            Connected Apps
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage third-party services connected to your account.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google Drive */}
          <div className="rounded-lg border p-4">
            <div className="flex items-start gap-4">
              {/* Google Drive Icon */}
              <div className="shrink-0 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                <svg className="h-8 w-8" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.4 9.35z" fill="#ea4335"/>
                  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                  <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                  <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.8h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm">Google Drive</h3>
                  {driveStatus?.isConnected ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      <XCircle className="h-3 w-3 mr-1" />
                      Not Connected
                    </Badge>
                  )}
                </div>

                {driveStatus?.isConnected ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      {driveStatus.googleProfilePicture ? (
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={driveStatus.googleProfilePicture} />
                          <AvatarFallback className="text-[10px]">
                            {driveStatus.googleDisplayName?.[0] || 'G'}
                          </AvatarFallback>
                        </Avatar>
                      ) : null}
                      <div>
                        {driveStatus.googleDisplayName && (
                          <p className="text-sm font-medium">{driveStatus.googleDisplayName}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{driveStatus.googleEmail}</p>
                      </div>
                    </div>

                    {driveStatus.needsReauthorization && (
                      <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <p className="text-xs">Re-authorization needed. Please reconnect.</p>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {driveStatus.connectedAt && (
                        <span>Connected: {new Date(driveStatus.connectedAt).toLocaleDateString()}</span>
                      )}
                      {driveStatus.lastUsedAt && (
                        <>
                          <span>·</span>
                          <span>Last used: {new Date(driveStatus.lastUsedAt).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>

                    <Separator />

                    <div className="flex items-center gap-2">
                      {driveStatus.needsReauthorization ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleConnect}
                          disabled={connecting}
                          className="text-xs"
                        >
                          {connecting ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Link2 className="h-3 w-3 mr-1" />
                          )}
                          Reconnect
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleDisconnect}
                        disabled={disconnecting}
                        className="text-xs text-destructive hover:text-destructive"
                      >
                        {disconnecting ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Unlink className="h-3 w-3 mr-1" />
                        )}
                        Disconnect
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Connect your Google Drive to upload homework submissions and documents directly to your storage.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleConnect}
                      disabled={connecting}
                      className="text-xs"
                    >
                      {connecting ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Cloud className="h-3 w-3 mr-1" />
                      )}
                      Connect Google Drive
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Placeholder for future apps */}
          <p className="text-xs text-muted-foreground text-center pt-2">
            More integrations coming soon.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConnectedApps;
