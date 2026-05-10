// src/components/notifications/NotificationItem.tsx
import React from 'react';
import { Bell, AlertCircle, AlertTriangle, Info, Megaphone, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Notification } from '@/services/notificationApiService';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (id: string) => void;
  onClick?: (notification: Notification) => void;
  compact?: boolean;
}

const scopeConfig = {
  GLOBAL: { label: 'System', className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  INSTITUTE: { label: 'Institute', className: 'bg-primary/10 text-primary border-primary/20' },
  CLASS: { label: 'Class', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  SUBJECT: { label: 'Subject', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
};

const priorityConfig = {
  URGENT: { icon: AlertCircle, className: 'text-destructive', bg: 'bg-destructive/10' },
  HIGH: { icon: AlertTriangle, className: 'text-amber-500', bg: 'bg-amber-500/10' },
  NORMAL: { icon: Bell, className: 'text-primary', bg: 'bg-primary/10' },
  LOW: { icon: Info, className: 'text-muted-foreground', bg: 'bg-muted' },
};

function formatTimeAgo(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onClick,
  compact = false,
}) => {
  const handleClick = () => {
    if (!notification.isRead && onMarkAsRead) {
      onMarkAsRead(notification.id);
    }
    onClick?.(notification);
  };

  const pConfig = priorityConfig[notification.priority] || priorityConfig.NORMAL;
  const sConfig = scopeConfig[notification.scope] || scopeConfig.INSTITUTE;
  const IconComponent = notification.icon ? Megaphone : pConfig.icon;
  const timeStr = formatTimeAgo(notification.sentAt || notification.createdAt || '');

  return (
    <div
      onClick={handleClick}
      className={cn(
        'group relative flex gap-3 p-3.5 sm:p-4 cursor-pointer transition-all duration-200',
        'hover:bg-accent/50 active:scale-[0.995]',
        !notification.isRead && 'bg-primary/[0.03]',
      )}
    >
      {/* Unread indicator line */}
      {!notification.isRead && (
        <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-primary" />
      )}

      {/* Icon */}
      <div className={cn(
        'flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center transition-colors',
        pConfig.bg,
      )}>
        <IconComponent className={cn('h-5 w-5', pConfig.className)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className={cn(
            'text-sm leading-tight line-clamp-2',
            !notification.isRead ? 'font-semibold text-foreground' : 'font-medium text-foreground/80',
          )}>
            {notification.title}
          </h4>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap mt-0.5 flex-shrink-0">
            {timeStr}
          </span>
        </div>

        <p className={cn(
          'text-[13px] mt-1 line-clamp-2 leading-relaxed',
          !notification.isRead ? 'text-muted-foreground' : 'text-muted-foreground/70',
        )}>
          {notification.body}
        </p>

        {/* Tags row */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className={cn(
            'inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border',
            sConfig.className,
          )}>
            {sConfig.label}
          </span>

          {notification.priority !== 'NORMAL' && (
            <span className={cn(
              'inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full',
              notification.priority === 'URGENT' && 'bg-destructive/10 text-destructive',
              notification.priority === 'HIGH' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
              notification.priority === 'LOW' && 'bg-muted text-muted-foreground',
            )}>
              {notification.priority}
            </span>
          )}

          {notification.targetClassName && (
            <span className="text-[11px] text-muted-foreground">
              {notification.targetClassName}
            </span>
          )}
          {notification.targetSubjectName && (
            <span className="text-[11px] text-muted-foreground">
              · {notification.targetSubjectName}
            </span>
          )}
        </div>

        {notification.senderName && (
          <p className="text-[11px] text-muted-foreground/60 mt-1">
            by {notification.senderName}
          </p>
        )}

        {/* Image */}
        {notification.imageUrl && !compact && (
          <div className="mt-2.5 rounded-xl overflow-hidden border border-border/50">
            <img
              src={notification.imageUrl}
              alt=""
              className="w-full h-28 sm:h-36 object-cover"
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        {/* Action URL hint */}
        {notification.actionUrl && !compact && (
          <div className="flex items-center gap-1 mt-2 text-[11px] text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            <ExternalLink className="h-3 w-3" />
            Open link
          </div>
        )}
      </div>
    </div>
  );
};
