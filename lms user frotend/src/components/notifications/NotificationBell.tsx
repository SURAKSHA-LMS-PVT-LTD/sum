// src/components/notifications/NotificationBell.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Bell, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { notificationApiService, Notification } from '@/services/notificationApiService';
import { NotificationItem } from './NotificationItem';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { cn } from '@/lib/utils';

interface NotificationBellProps {
  instituteId?: string;
  className?: string;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  instituteId,
  className,
}) => {
  const navigate = useNavigate();
  const { globalUnreadCount, decrementUnread } = useNotificationStore();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRecentNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const result = await notificationApiService.getMyNotifications({
        page: 1,
        limit: 5,
      });
      setNotifications(result.data || []);
    } catch (error: any) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadRecentNotifications();
    }
  }, [open, loadRecentNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationApiService.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
      decrementUnread();
    } catch (error: any) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    setOpen(false);
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const handleViewAll = () => {
    setOpen(false);
    navigate('/all-notifications');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('relative rounded-xl', className)}
          aria-label={`Notifications ${globalUnreadCount > 0 ? `(${globalUnreadCount} unread)` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {globalUnreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-[18px] min-w-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1 animate-in zoom-in-50 duration-200">
              {globalUnreadCount > 99 ? '99+' : globalUnreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] sm:w-[380px] p-0 rounded-2xl shadow-xl border-border/50" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">Notifications</h4>
            {globalUnreadCount > 0 && (
              <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {globalUnreadCount} new
              </span>
            )}
          </div>
        </div>

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-10 w-10 rounded-xl bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-3/4 bg-muted rounded" />
                    <div className="h-3 w-full bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Bell className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onClick={handleNotificationClick}
                  compact
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/50 p-2">
          <Button
            variant="ghost"
            className="w-full h-9 text-sm font-medium text-primary hover:text-primary hover:bg-primary/5 rounded-xl gap-1.5"
            onClick={handleViewAll}
          >
            View all notifications
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
