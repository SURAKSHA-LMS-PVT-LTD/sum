import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Monitor, Smartphone, Tablet, Globe, LogOut, RefreshCw, ShieldAlert, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";

interface Session {
  id: string;
  platform: "web" | "android" | "ios";
  deviceId?: string;
  deviceName?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  expiresAt: string;
  isCurrent?: boolean;
  expiresInHuman?: string;
}

interface SessionsResponse {
  success: boolean;
  sessions: Session[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  summary?: {
    totalActive: number;
    webSessions: number;
    mobileSessions: number;
  };
}

const platformIcons: Record<string, typeof Monitor> = {
  web: Monitor,
  android: Smartphone,
  ios: Smartphone,
};

const platformLabels: Record<string, string> = {
  web: "Web Browser",
  android: "Android",
  ios: "iOS",
};

function parseBrowserInfo(userAgent?: string) {
  if (!userAgent) return "Unknown Device";
  if (userAgent.includes("Chrome")) return "Chrome";
  if (userAgent.includes("Firefox")) return "Firefox";
  if (userAgent.includes("Safari")) return "Safari";
  if (userAgent.includes("Edge")) return "Edge";
  return "Browser";
}

export function ActiveSessionsPanel() {
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<SessionsResponse>({
    queryKey: ["active-sessions", page, platformFilter],
    queryFn: () =>
      api.getActiveSessions({
        page,
        limit: 10,
        platform: platformFilter === "all" ? undefined : (platformFilter as any),
        sortBy: "createdAt",
        sortOrder: "DESC",
      }),
  });

  const revokeMutation = useMutation({
    mutationFn: (sessionId: string) => api.revokeSession(sessionId),
    onSuccess: () => {
      toast({ title: "Session revoked", description: "The session has been logged out." });
      queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to revoke session.", variant: "destructive" });
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => api.revokeAllSessions(),
    onSuccess: () => {
      toast({ title: "All sessions revoked", description: "You have been logged out of all devices." });
      queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to revoke sessions.", variant: "destructive" });
    },
  });

  const sessions = data?.sessions || [];
  const pagination = data?.pagination;
  const summary = data?.summary;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Globe className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.totalActive}</p>
                  <p className="text-sm text-muted-foreground">Total Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Monitor className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.webSessions}</p>
                  <p className="text-sm text-muted-foreground">Web Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Smartphone className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{summary.mobileSessions}</p>
                  <p className="text-sm text-muted-foreground">Mobile Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Devices currently logged into your account</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={platformFilter} onValueChange={setPlatformFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Platforms</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                  <SelectItem value="android">Android</SelectItem>
                  <SelectItem value="ios">iOS</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    Revoke All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revoke all sessions?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will log you out from all devices including this one. You'll need to sign in again.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => revokeAllMutation.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Revoke All Sessions
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Monitor className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No active sessions found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => {
                const PlatformIcon = platformIcons[session.platform] || Monitor;
                return (
                  <div
                    key={session.id}
                    className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="p-3 rounded-xl bg-primary/10 shrink-0">
                      <PlatformIcon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {session.deviceName || parseBrowserInfo(session.userAgent)}
                        </p>
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {platformLabels[session.platform] || session.platform}
                        </Badge>
                        {session.isCurrent && (
                          <Badge className="text-xs shrink-0">Current</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {session.ipAddress && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {session.ipAddress}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Logged in {format(new Date(session.createdAt), "MMM d, yyyy h:mm a")}
                        </span>
                      </div>
                      {session.expiresInHuman && (
                        <p className="text-xs text-muted-foreground">
                          Expires: {session.expiresInHuman}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => revokeMutation.mutate(session.id)}
                      disabled={revokeMutation.isPending}
                    >
                      <LogOut className="w-4 h-4 mr-1" />
                      Revoke
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ({pagination.total} sessions)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasPrev}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
