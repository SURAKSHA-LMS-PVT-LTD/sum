import { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";

interface Props { instituteId: string; }

export function CacheManagementPanel({ instituteId }: Props) {
  const { toast } = useToast();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [invalidating, setInvalidating] = useState(false);

  async function loadStats() {
    setLoading(true);
    try {
      const res = await api.getCalendarCacheStats(instituteId);
      setStats(res.data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }

  async function invalidate() {
    setInvalidating(true);
    try {
      await api.invalidateCalendarCache(instituteId);
      toast({ title: "Success", description: "Cache invalidated" });
      loadStats();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setInvalidating(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cache Management</CardTitle>
        <CardDescription>View and manage the calendar cache for this institute</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Button variant="outline" onClick={loadStats} disabled={loading}>{loading ? "Loading..." : "Load Cache Stats"}</Button>

        {stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Cache Enabled</p>
                <Badge className={stats.cacheEnabled ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>
                  {stats.cacheEnabled ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge className={stats.isCached ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}>
                  {stats.isCached ? "Cached" : "Not Cached"}
                </Badge>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground">TTL Remaining</p>
                <p className="text-lg font-bold text-foreground">{stats.ttlRemaining ? `${Math.round(stats.ttlRemaining / 60)} min` : "—"}</p>
              </div>
            </div>

            {stats.cachedAt && (
              <p className="text-sm text-muted-foreground">Cached at: {new Date(stats.cachedAt).toLocaleString()}</p>
            )}
            {stats.todayCacheKey && (
              <p className="text-sm text-muted-foreground">Cache key: <code className="bg-muted px-1 rounded">{stats.todayCacheKey}</code></p>
            )}
          </div>
        )}

        <div className="flex items-center gap-4">
          <Button variant="destructive" onClick={invalidate} disabled={invalidating}>
            <RefreshCw className="w-4 h-4 mr-1" /> {invalidating ? "Invalidating..." : "Invalidate Cache"}
          </Button>
          <p className="text-sm text-muted-foreground">Only use this if today's data appears stale.</p>
        </div>
      </CardContent>
    </Card>
  );
}
