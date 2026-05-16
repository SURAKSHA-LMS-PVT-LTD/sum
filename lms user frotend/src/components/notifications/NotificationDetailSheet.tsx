import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Bell, AlertCircle, AlertTriangle, Info, Megaphone,
  ExternalLink, Building2, BookOpen, School, Globe, Calendar, User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '@/services/notificationApiService';

interface NotificationDetailSheetProps {
  notification: Notification | null;
  open: boolean;
  onClose: () => void;
}

const scopeConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  GLOBAL: { label: 'System', icon: Globe, className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  INSTITUTE: { label: 'Institute', icon: Building2, className: 'bg-primary/10 text-primary border-primary/20' },
  CLASS: { label: 'Class', icon: School, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  SUBJECT: { label: 'Subject', icon: BookOpen, className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
};

const priorityConfig: Record<string, { icon: React.ElementType; label: string; className: string; bg: string }> = {
  URGENT: { icon: AlertCircle, label: 'Urgent', className: 'text-destructive', bg: 'bg-destructive/10' },
  HIGH: { icon: AlertTriangle, label: 'High', className: 'text-amber-500', bg: 'bg-amber-500/10' },
  NORMAL: { icon: Bell, label: 'Normal', className: 'text-primary', bg: 'bg-primary/10' },
  LOW: { icon: Info, label: 'Low', className: 'text-muted-foreground', bg: 'bg-muted' },
};

function formatDateTime(dateString?: string | null): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export const NotificationDetailSheet: React.FC<NotificationDetailSheetProps> = ({
  notification,
  open,
  onClose,
}) => {
  const navigate = useNavigate();

  if (!notification) return null;

  const pConfig = priorityConfig[notification.priority] || priorityConfig.NORMAL;
  const sConfig = scopeConfig[notification.scope] || scopeConfig.INSTITUTE;
  const PriorityIcon = notification.icon ? Megaphone : pConfig.icon;
  const ScopeIcon = sConfig.icon;

  const handleOpenLink = () => {
    if (!notification.actionUrl) return;
    onClose();
    // Internal path: navigate via React Router; external: open in new tab
    if (notification.actionUrl.startsWith('http')) {
      window.open(notification.actionUrl, '_blank', 'noopener,noreferrer');
    } else {
      navigate(notification.actionUrl);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto p-0">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
        </div>

        <SheetHeader className="px-5 pt-2 pb-3">
          <SheetTitle className="sr-only">Notification Detail</SheetTitle>
          {/* Icon + priority badge */}
          <div className="flex items-start gap-3">
            <div className={cn('h-12 w-12 rounded-xl flex items-center justify-center shrink-0', pConfig.bg)}>
              <PriorityIcon className={cn('h-6 w-6', pConfig.className)} />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold leading-snug text-foreground">
                {notification.title}
              </h2>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className={cn(
                  'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border',
                  sConfig.className,
                )}>
                  <ScopeIcon className="h-3 w-3" />
                  {sConfig.label}
                </span>
                {notification.priority !== 'NORMAL' && (
                  <span className={cn(
                    'inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full',
                    notification.priority === 'URGENT' && 'bg-destructive/10 text-destructive',
                    notification.priority === 'HIGH' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                    notification.priority === 'LOW' && 'bg-muted text-muted-foreground',
                  )}>
                    {pConfig.label}
                  </span>
                )}
                {!notification.isRead && (
                  <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    New
                  </span>
                )}
              </div>
            </div>
          </div>
        </SheetHeader>

        <Separator />

        <div className="px-5 py-4 space-y-4">
          {/* Body */}
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {notification.body}
          </p>

          {/* Image */}
          {notification.imageUrl && (
            <div className="rounded-xl overflow-hidden border border-border/50">
              <img
                src={notification.imageUrl}
                alt=""
                className="w-full max-h-52 object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* Meta info */}
          <div className="rounded-xl bg-muted/40 divide-y divide-border/40">
            {(notification.targetClassName || notification.targetSubjectName) && (
              <div className="flex items-center gap-2 px-3 py-2.5">
                <School className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">
                  {[notification.targetClassName, notification.targetSubjectName].filter(Boolean).join(' · ')}
                </span>
              </div>
            )}
            {notification.senderName && (
              <div className="flex items-center gap-2 px-3 py-2.5">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">
                  Sent by {notification.senderName}
                  {notification.senderRole ? ` · ${notification.senderRole}` : ''}
                </span>
              </div>
            )}
            {(notification.sentAt || notification.createdAt) && (
              <div className="flex items-center gap-2 px-3 py-2.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(notification.sentAt || notification.createdAt)}
                </span>
              </div>
            )}
          </div>

          {/* Action URL button */}
          {notification.actionUrl && (
            <Button onClick={handleOpenLink} className="w-full gap-2">
              <ExternalLink className="h-4 w-4" />
              View Details
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
