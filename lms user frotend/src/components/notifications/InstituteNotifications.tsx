// src/components/notifications/InstituteNotifications.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useForceRefresh } from '@/hooks/useForceRefresh';
import { Bell, CheckCheck, RefreshCw, Building2, Sparkles } from 'lucide-react';
import { notificationApiService, Notification } from '@/services/notificationApiService';
import { DateGroupedNotifications } from './DateGroupedNotifications';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { useNotificationStore } from '@/stores/useNotificationStore';

interface InstituteNotificationsProps {
  instituteId: string;
  instituteName?: string;
}

type FilterScope = 'ALL' | 'INSTITUTE' | 'CLASS' | 'SUBJECT';

export const InstituteNotifications: React.FC<InstituteNotificationsProps> = ({
  instituteId,
  instituteName,
}) => {
  const navigate = useNavigate();
  const { triggerForceRefresh } = useForceRefresh();
  const { decrementUnread, resetUnread, refreshUnreadCount } = useNotificationStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<FilterScope>('ALL');

  const loadNotifications = useCallback(async () => {
    if (!instituteId) return;
    try {
      setLoading(true);
      const result = await notificationApiService.getInstituteNotifications(instituteId, {
        page,
        limit: 10,
        scope: filter !== 'ALL' ? filter : undefined,
      });
      setNotifications(result.data || []);
      setTotalPages(result.totalPages || 1);
    } catch (error: any) {
      console.error('Failed to load notifications:', error);
      toast({ title: 'Error', description: 'Failed to load notifications', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [instituteId, page, filter]);

  const loadUnreadCount = useCallback(async () => {
    if (!instituteId) return;
    try {
      const result = await notificationApiService.getInstituteUnreadCount(instituteId);
      setUnreadCount(result.unreadCount || 0);
    } catch (error: any) {
      console.error('Failed to load unread count:', error);
    }
  }, [instituteId]);

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, [page, filter]);

  const handleRefresh = () => {
    triggerForceRefresh();
    loadNotifications();
    loadUnreadCount();
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationApiService.markAsRead(notificationId);
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      decrementUnread();
    } catch (error: any) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!instituteId) return;
    try {
      await notificationApiService.markAllAsRead(instituteId);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      resetUnread();
      await refreshUnreadCount();
      toast({ title: 'Done', description: 'All notifications marked as read' });
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to mark all as read', variant: 'destructive' });
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.actionUrl) navigate(notification.actionUrl);
  };

  const handleFilterChange = (value: string) => {
    setFilter(value as FilterScope);
    setPage(1);
  };

  if (loading && notifications.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Institute Notifications</h3>
              <p className="text-xs text-muted-foreground">Loading...</p>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-10 w-10 rounded-xl bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-muted rounded-lg" />
                <div className="h-3 w-full bg-muted rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 space-y-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                    {unreadCount}
                  </span>
                )}
              </div>
              {instituteName && (
                <p className="text-xs text-muted-foreground mt-0.5">{instituteName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={loading} className="h-9 w-9 rounded-xl">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllAsRead} className="h-9 rounded-xl text-xs gap-1.5">
                <CheckCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Mark all read</span>
                <span className="sm:hidden">Read all</span>
              </Button>
            )}
          </div>
        </div>

        {/* Scope filters */}
        <Tabs value={filter} onValueChange={handleFilterChange} className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-9 rounded-xl bg-muted/50 p-0.5">
            <TabsTrigger value="ALL" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">All</TabsTrigger>
            <TabsTrigger value="INSTITUTE" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <span className="hidden sm:inline">Institute</span>
              <span className="sm:hidden">Inst.</span>
            </TabsTrigger>
            <TabsTrigger value="CLASS" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">Class</TabsTrigger>
            <TabsTrigger value="SUBJECT" className="text-xs rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <span className="hidden sm:inline">Subject</span>
              <span className="sm:hidden">Subj.</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Sparkles className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {filter === 'ALL' ? 'No notifications' : `No ${filter.toLowerCase()} notifications`}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">You're all caught up!</p>
        </div>
      ) : (
        <DateGroupedNotifications
          notifications={notifications}
          onMarkAsRead={handleMarkAsRead}
          onClick={handleNotificationClick}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
          <Button variant="ghost" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded-xl text-xs">
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="ghost" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="rounded-xl text-xs">
            Next
          </Button>
        </div>
      )}
    </div>
  );
};
