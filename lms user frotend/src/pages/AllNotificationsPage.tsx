// src/pages/AllNotificationsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useForceRefresh } from '@/hooks/useForceRefresh';
import { Bell, CheckCheck, RefreshCw, Sparkles, Inbox } from 'lucide-react';
import { notificationApiService, Notification } from '@/services/notificationApiService';
import { DateGroupedNotifications } from '@/components/notifications/DateGroupedNotifications';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { useNotificationStore } from '@/stores/useNotificationStore';

const AllNotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { triggerForceRefresh } = useForceRefresh();
  const { globalUnreadCount, decrementUnread, resetUnread, refreshUnreadCount } = useNotificationStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [scopeFilter, setScopeFilter] = useState<string>('ALL');

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const result = await notificationApiService.getMyNotifications({
        page,
        limit: 15,
        isRead: filter === 'unread' ? false : undefined,
        scope: scopeFilter !== 'ALL' ? scopeFilter as any : undefined,
      });
      setNotifications(result.data || []);
      setTotalPages(result.totalPages || 1);
    } catch (error: any) {
      console.error('Failed to load notifications:', error);
      toast({ title: 'Error', description: 'Failed to load notifications', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [page, filter, scopeFilter]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    setPage(1);
  }, [filter, scopeFilter]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationApiService.markAsRead(notificationId);
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
      decrementUnread();
    } catch (error: any) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApiService.markAllMyNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      resetUnread();
      toast({ title: 'Done', description: 'All notifications marked as read' });
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to mark all as read', variant: 'destructive' });
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.actionUrl) navigate(notification.actionUrl);
  };

  const handleRefresh = () => {
    triggerForceRefresh();
    loadNotifications();
    refreshUnreadCount();
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Inbox className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Notifications</h1>
              {globalUnreadCount > 0 && (
                <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-destructive/10 text-destructive">
                  {globalUnreadCount} unread
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">All notifications across institutes & system</p>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
        {/* Filters & Actions */}
        <div className="p-3 sm:p-4 border-b border-border/40 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Read filter */}
              <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
                <TabsList className="h-8 rounded-lg bg-muted/50 p-0.5">
                  <TabsTrigger value="all" className="text-xs h-7 rounded-md px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">All</TabsTrigger>
                  <TabsTrigger value="unread" className="text-xs h-7 rounded-md px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">Unread</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Scope filter */}
              <Tabs value={scopeFilter} onValueChange={setScopeFilter}>
                <TabsList className="h-8 rounded-lg bg-muted/50 p-0.5">
                  <TabsTrigger value="ALL" className="text-xs h-7 rounded-md px-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">All</TabsTrigger>
                  <TabsTrigger value="GLOBAL" className="text-xs h-7 rounded-md px-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">System</TabsTrigger>
                  <TabsTrigger value="INSTITUTE" className="text-xs h-7 rounded-md px-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">Institute</TabsTrigger>
                  <TabsTrigger value="CLASS" className="text-xs h-7 rounded-md px-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">Class</TabsTrigger>
                  <TabsTrigger value="SUBJECT" className="text-xs h-7 rounded-md px-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">Subject</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={loading} className="h-9 w-9 rounded-xl">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              {globalUnreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={handleMarkAllAsRead} className="h-9 rounded-xl text-xs gap-1.5">
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Mark all read</span>
                  <span className="sm:hidden">Read all</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading && notifications.length === 0 ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-10 w-10 rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-muted rounded-lg" />
                  <div className="h-3 w-full bg-muted rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
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
    </div>
  );
};

export default AllNotificationsPage;
