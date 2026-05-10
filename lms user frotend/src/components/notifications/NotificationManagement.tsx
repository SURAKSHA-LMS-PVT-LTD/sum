// src/components/notifications/NotificationManagement.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bell, 
  RefreshCw, 
  Send, 
  XCircle, 
  Trash2, 
  Clock, 
  CheckCircle,
  AlertCircle,
  Filter,
  MoreHorizontal,
  Eye
} from 'lucide-react';
import { 
  adminNotificationService,
  NotificationResult,
  NotificationScope,
} from '@/services/adminNotificationService';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CreateNotificationButton } from './CreateNotificationButton';

interface NotificationManagementProps {
  instituteId?: string;
}

/**
 * Admin Notification Management Component
 * 
 * Access Control:
 * - SUPERADMIN: Can manage all notifications (GLOBAL, INSTITUTE, CLASS, SUBJECT)
 * - Institute Admin: Can manage INSTITUTE, CLASS, SUBJECT notifications for their institute
 * - Teacher: Can manage CLASS, SUBJECT notifications for their classes/subjects
 */
export const NotificationManagement: React.FC<NotificationManagementProps> = ({
  instituteId,
}) => {
  const { user, selectedInstitute } = useAuth();
  
  const isSuperAdmin = user?.userType === 'SUPERADMIN' || user?.userType === 'SA';
  
  // Check for both formats: INSTITUTEADMIN and INSTITUTE_ADMIN (API returns underscore format)
  const instituteUserType = selectedInstitute?.instituteUserType || selectedInstitute?.userRole;
  const isInstituteAdmin = instituteUserType === 'INSTITUTEADMIN' || instituteUserType === 'INSTITUTE_ADMIN';
  const isTeacher = instituteUserType === 'TEACHER';
  
  // Check if user can manage notifications
  const canManage = isSuperAdmin || isInstituteAdmin || isTeacher;

  const [notifications, setNotifications] = useState<NotificationResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [scopeFilter, setScopeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  // Dialog states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<NotificationResult | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Get available scope filters based on user role
  const getAvailableScopeFilters = () => {
    const filters = [{ value: 'ALL', label: 'All Scopes' }];
    
    if (isSuperAdmin) {
      filters.push({ value: 'GLOBAL', label: 'Global' });
    }
    if (isSuperAdmin || isInstituteAdmin) {
      filters.push({ value: 'INSTITUTE', label: 'Institute' });
    }
    if (isSuperAdmin || isInstituteAdmin || isTeacher) {
      filters.push({ value: 'CLASS', label: 'Class' });
      filters.push({ value: 'SUBJECT', label: 'Subject' });
    }
    
    return filters;
  };

  const loadNotifications = useCallback(async () => {
    if (!canManage) return;
    
    try {
      setLoading(true);
      const effectiveInstituteId = instituteId || selectedInstitute?.id;
      
      const result = await adminNotificationService.getAdminNotifications({
        page,
        limit: 10,
        scope: scopeFilter !== 'ALL' ? scopeFilter as NotificationScope : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        instituteId: !isSuperAdmin ? effectiveInstituteId : undefined,
      });
      
      setNotifications(result.data || []);
      setTotalPages(result.totalPages || 1);
      setTotal(result.total || 0);
    } catch (error: any) {
      console.error('Failed to load notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [canManage, page, scopeFilter, statusFilter, isSuperAdmin, instituteId, selectedInstitute?.id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleResend = async (notification: NotificationResult) => {
    try {
      setActionLoading(true);
      await adminNotificationService.resendNotification(notification.id);
      toast.success('Notification resent successfully');
      loadNotifications();
    } catch (error: any) {
      console.error('Failed to resend notification:', error);
      toast.error('Failed to resend notification');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelConfirm = async () => {
    if (!selectedNotification) return;
    
    try {
      setActionLoading(true);
      await adminNotificationService.cancelNotification(selectedNotification.id);
      toast.success('Scheduled notification cancelled');
      setCancelDialogOpen(false);
      setSelectedNotification(null);
      loadNotifications();
    } catch (error: any) {
      console.error('Failed to cancel notification:', error);
      toast.error('Failed to cancel notification');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedNotification) return;
    
    try {
      setActionLoading(true);
      await adminNotificationService.deleteNotification(selectedNotification.id);
      toast.success('Notification deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedNotification(null);
      loadNotifications();
    } catch (error: any) {
      console.error('Failed to delete notification:', error);
      toast.error('Failed to delete notification');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewDetails = async (notification: NotificationResult) => {
    try {
      const details = await adminNotificationService.getNotificationDetails(notification.id);
      setSelectedNotification(details);
      setDetailsDialogOpen(true);
    } catch (error: any) {
      console.error('Failed to load notification details:', error);
      toast.error('Failed to load notification details');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return <Badge className="bg-primary/90 text-primary-foreground"><CheckCircle className="h-3 w-3 mr-1" />Sent</Badge>;
      case 'PENDING':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'FAILED':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'CANCELLED':
        return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>;
      case 'DRAFT':
        return <Badge variant="outline">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getScopeBadge = (scope: string) => {
    switch (scope) {
      case 'GLOBAL':
        return <Badge variant="default">Global</Badge>;
      case 'INSTITUTE':
        return <Badge variant="secondary">Institute</Badge>;
      case 'CLASS':
        return <Badge variant="outline">Class</Badge>;
      case 'SUBJECT':
        return <Badge className="bg-accent text-accent-foreground">Subject</Badge>;
      default:
        return <Badge variant="outline">{scope}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'HIGH':
        return <Badge className="bg-secondary text-secondary-foreground border-destructive">High</Badge>;
      case 'LOW':
        return <Badge variant="outline">Low</Badge>;
      default:
        return null;
    }
  };

  if (!canManage) {
    return null;
  }

  if (loading && notifications.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="space-y-3 sm:space-y-4 p-3 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <CardTitle className="flex items-center gap-1 sm:gap-2 text-base sm:text-lg">
                <Bell className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                <span className="truncate">Notification Management</span>
              </CardTitle>
              <Badge variant="secondary" className="text-xs">{total} total</Badge>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadNotifications}
                disabled={loading}
                className="h-8 w-8 p-0 sm:h-9 sm:w-9"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <CreateNotificationButton 
                variant="default" 
                size="sm" 
                onSuccess={loadNotifications}
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <div className="flex items-center gap-1 sm:gap-2">
              <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
              <Select value={scopeFilter} onValueChange={(v) => { setScopeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[100px] sm:w-[140px] h-8 sm:h-10 text-xs sm:text-sm">
                  <SelectValue placeholder="Scope" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableScopeFilters().map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[100px] sm:w-[140px] h-8 sm:h-10 text-xs sm:text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No notifications found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first notification using the button above
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div 
                  key={notification.id} 
                  className="p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-medium truncate">{notification.title}</h4>
                        {getPriorityBadge(notification.priority)}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {notification.body}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {getStatusBadge(notification.status)}
                        {getScopeBadge(notification.scope)}
                        <span className="text-muted-foreground">
                          {notification.recipientCount} recipients
                        </span>
                        {notification.status === 'SENT' && (
                          <span className="text-primary font-medium">
                            {notification.successCount} delivered
                          </span>
                        )}
                        {notification.failureCount > 0 && (
                          <span className="text-destructive">
                            {notification.failureCount} failed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notification.sentAt 
                          ? `Sent ${format(new Date(notification.sentAt), 'MMM d, yyyy h:mm a')}`
                          : notification.scheduledAt
                            ? `Scheduled for ${format(new Date(notification.scheduledAt), 'MMM d, yyyy h:mm a')}`
                            : `Created ${format(new Date(notification.createdAt), 'MMM d, yyyy h:mm a')}`
                        }
                      </p>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-background">
                        <DropdownMenuItem onClick={() => handleViewDetails(notification)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        
                        {notification.status === 'FAILED' && (
                          <DropdownMenuItem onClick={() => handleResend(notification)}>
                            <Send className="h-4 w-4 mr-2" />
                            Resend
                          </DropdownMenuItem>
                        )}
                        
                        {notification.status === 'PENDING' && (
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedNotification(notification);
                              setCancelDialogOpen(true);
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancel
                          </DropdownMenuItem>
                        )}
                        
                        <DropdownMenuSeparator />
                        
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            setSelectedNotification(notification);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notification</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedNotification?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Scheduled Notification</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the scheduled notification "{selectedNotification?.title}"? 
              This notification will not be sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Keep Scheduled</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelConfirm}
              disabled={actionLoading}
            >
              {actionLoading ? 'Cancelling...' : 'Cancel Notification'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Notification Details</DialogTitle>
          </DialogHeader>
          {selectedNotification && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">{selectedNotification.title}</h4>
                <p className="text-sm text-muted-foreground">{selectedNotification.body}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div className="mt-1">{getStatusBadge(selectedNotification.status)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Scope:</span>
                  <div className="mt-1">{getScopeBadge(selectedNotification.scope)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Priority:</span>
                  <div className="mt-1">{getPriorityBadge(selectedNotification.priority) || <Badge variant="outline">Normal</Badge>}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Recipients:</span>
                  <p className="mt-1 font-medium">{selectedNotification.recipientCount}</p>
                </div>
              </div>
              
              {selectedNotification.status === 'SENT' && (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Delivered:</span>
                    <p className="mt-1 font-medium text-primary">{selectedNotification.successCount}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Failed:</span>
                    <p className="mt-1 font-medium text-destructive">{selectedNotification.failureCount}</p>
                  </div>
                </div>
              )}
              
              <div className="text-sm">
                <span className="text-muted-foreground">Created:</span>
                <p className="mt-1">{format(new Date(selectedNotification.createdAt), 'PPpp')}</p>
              </div>
              
              {selectedNotification.sentAt && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Sent:</span>
                  <p className="mt-1">{format(new Date(selectedNotification.sentAt), 'PPpp')}</p>
                </div>
              )}
              
              {selectedNotification.scheduledAt && selectedNotification.status === 'PENDING' && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Scheduled for:</span>
                  <p className="mt-1">{format(new Date(selectedNotification.scheduledAt), 'PPpp')}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
