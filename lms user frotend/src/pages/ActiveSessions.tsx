import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { getActiveSessions, revokeSession, revokeAllSessions } from '@/contexts/utils/auth.api';
import { useAuth } from '@/contexts/AuthContext';
import { Monitor, Smartphone, Tablet, LogOut, ShieldAlert, RefreshCw } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';

interface Session {
  id: string;
  platform: 'web' | 'android' | 'ios';
  deviceName: string | null;
  userAgent: string | null;
  firstLogin: string;
  tokenExpiry: string;
  isCurrent?: boolean;
}

const parseBrowser = (ua: string | null): string => {
  if (!ua) return 'Unknown Browser';
  if (ua.includes('PostmanRuntime')) return 'Postman';
  if (ua.includes('Edg/')) return 'Microsoft Edge';
  if (ua.includes('Chrome') && ua.includes('Safari')) {
    if (ua.includes('Mobile')) return 'Chrome Mobile';
    return 'Google Chrome';
  }
  if (ua.includes('Firefox')) return 'Mozilla Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) {
    if (ua.includes('Mobile')) return 'Safari Mobile';
    return 'Safari';
  }
  return 'Web Browser';
};

const parseOS = (ua: string | null): string => {
  if (!ua) return '';
  if (ua.includes('PostmanRuntime')) return 'API Client';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  return '';
};

const getPlatformIcon = (platform: string) => {
  switch (platform) {
    case 'web': return <Monitor className="h-5 w-5" />;
    case 'android': return <Smartphone className="h-5 w-5" />;
    case 'ios': return <Smartphone className="h-5 w-5" />;
    default: return <Tablet className="h-5 w-5" />;
  }
};

const getPlatformLabel = (platform: string) => {
  switch (platform) {
    case 'web': return 'Web Browser';
    case 'android': return 'Android';
    case 'ios': return 'iPhone / iPad';
    default: return platform;
  }
};

const ActiveSessionsPage = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const { toast } = useToast();
  const { logout } = useAuth();

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await getActiveSessions({ sortBy: 'createdAt', sortOrder: 'DESC' });
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load active sessions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleRevoke = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      await revokeSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast({ title: 'Session revoked', description: 'The device has been logged out.' });
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
      toast({ title: 'All sessions revoked', description: 'Logging you out...' });
      // Current session is also revoked, so log out
      setTimeout(() => logout(), 1500);
    } catch {
      toast({ title: 'Error', description: 'Failed to revoke all sessions', variant: 'destructive' });
      setRevokingAll(false);
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-2xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Active Sessions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage devices where you're currently logged in. You can log out individual devices or all at once.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Devices ({sessions.length})
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={loadSessions} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            <CardDescription>
              These are the devices currently logged into your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No active sessions found.
              </p>
            ) : (
              sessions.map((session, index) => (
                <React.Fragment key={session.id}>
                  {index > 0 && <Separator />}
                  <div className="flex items-center gap-4 py-3">
                    <div className="shrink-0 text-muted-foreground">
                      {getPlatformIcon(session.platform)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {session.deviceName || parseBrowser(session.userAgent)}
                        </span>
                        {session.isCurrent && (
                          <Badge variant="secondary" className="text-xs">This device</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5 mt-0.5">
                        {parseOS(session.userAgent) && (
                          <p>{parseOS(session.userAgent)}</p>
                        )}
                        <p>Logged in: {new Date(session.firstLogin).toLocaleDateString()} {new Date(session.firstLogin).toLocaleTimeString()}</p>
                        <p>Expires: {new Date(session.tokenExpiry).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {!session.isCurrent && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevoke(session.id)}
                        disabled={revoking === session.id}
                        className="shrink-0"
                      >
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
                  <h3 className="text-sm font-semibold text-foreground">Log out everywhere</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    This will revoke all sessions including this one. You'll need to log in again on every device.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="mt-3"
                    onClick={handleRevokeAll}
                    disabled={revokingAll}
                  >
                    {revokingAll ? 'Revoking all...' : 'Log out of all devices'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default ActiveSessionsPage;
