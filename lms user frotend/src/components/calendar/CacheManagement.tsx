import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import calendarApi from '@/api/calendar.api';
import type { CacheStats } from '@/types/calendar.types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { getErrorMessage } from '@/api/apiError';

const CacheManagement: React.FC = () => {
  const { currentInstituteId } = useAuth();
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalidating, setInvalidating] = useState(false);

  useEffect(() => {
    if (currentInstituteId) loadStats();
  }, [currentInstituteId]);

  const loadStats = async () => {
    if (!currentInstituteId) return;
    setLoading(true);
    try {
      const res = await calendarApi.getCacheStats(currentInstituteId);
      setStats(res?.data || null);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const handleInvalidate = async () => {
    if (!currentInstituteId) return;
    setInvalidating(true);
    try {
      await calendarApi.invalidateCache(currentInstituteId);
      toast.success('Cache invalidated successfully');
      loadStats();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to invalidate cache'));
    } finally {
      setInvalidating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          🔧 Cache Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              {stats.isCached ? (
                <Badge className="bg-green-500 text-white">Cached</Badge>
              ) : (
                <Badge variant="outline">Not Cached</Badge>
              )}
            </div>
            {stats.cachedAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cached At</span>
                <span className="text-sm">{new Date(stats.cachedAt).toLocaleString()}</span>
              </div>
            )}
            {stats.ttlRemaining !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">TTL Remaining</span>
                <span className="text-sm">{Math.floor(stats.ttlRemaining / 60)}m {stats.ttlRemaining % 60}s</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Cache Key</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">{stats.todayCacheKey}</code>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Cache stats unavailable.</p>
        )}

        <div className="pt-3 border-t">
          <Button variant="outline" size="sm" onClick={handleInvalidate} disabled={invalidating}>
            <RefreshCw className={`h-4 w-4 mr-1 ${invalidating ? 'animate-spin' : ''}`} />
            {invalidating ? 'Invalidating...' : 'Invalidate Cache'}
          </Button>
        </div>

        <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-700 dark:text-yellow-300">
            Only use this if today's data appears stale. The cache auto-refreshes when you edit days/events.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CacheManagement;
