import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { accountDeletionApi, DeletionStatus } from '@/api/account-deletion.api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Clock, Trash2, ShieldAlert, RefreshCw, Undo2, CalendarClock } from 'lucide-react';
import { format } from 'date-fns';
import { getErrorMessage } from '@/api/apiError';

const DeleteAccountTab = () => {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<DeletionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await accountDeletionApi.getStatus();
      setStatus(data);
    } catch (error: any) {
      console.error('Failed to fetch deletion status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRequestDeletion = async () => {
    setDeleting(true);
    try {
      const res = await accountDeletionApi.requestDeletion(reason);
      toast({ title: 'Account Deactivated', description: res.message });
      setShowConfirm(false);
      // Log the user out
      setTimeout(() => logout(), 2000);
    } catch (error: any) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to process request'), variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelDeletion = async () => {
    setCancelling(true);
    try {
      const res = await accountDeletionApi.cancelDeletion();
      toast({ title: 'Deletion Cancelled', description: res.message });
      fetchStatus();
    } catch (error: any) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to cancel'), variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Pending deletion state
  if (status?.hasPendingDeletion) {
    const scheduledDate = status.scheduledDeletionDate
      ? format(new Date(status.scheduledDeletionDate), 'MMMM dd, yyyy')
      : 'Unknown';
    const requestedDate = status.requestedAt
      ? format(new Date(status.requestedAt), 'MMMM dd, yyyy')
      : null;

    return (
      <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
            Account Scheduled for Deletion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Permanent deletion on:</span>
              <span className="font-semibold text-foreground">{scheduledDate}</span>
            </div>
            {requestedDate && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Requested on:</span>
                <span className="font-medium text-foreground">{requestedDate}</span>
              </div>
            )}
            {status.reason && (
              <div className="flex items-start gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="text-muted-foreground">Reason:</span>
                <span className="text-foreground">{status.reason}</span>
              </div>
            )}
          </div>

          <div className="bg-background/80 rounded-lg p-4 border border-border/50">
            <p className="text-sm text-muted-foreground">
              Your account is currently deactivated and will be permanently deleted on <strong>{scheduledDate}</strong>. 
              All your data including profile, records, and associated information will be removed.
            </p>
          </div>

          <div className="pt-2">
            <p className="text-sm font-medium text-foreground mb-2">Changed your mind?</p>
            <Button
              onClick={handleCancelDeletion}
              disabled={cancelling}
              variant="outline"
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <Undo2 className="h-4 w-4 mr-2" />
              {cancelling ? 'Cancelling...' : 'Cancel Deletion'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No pending deletion - show delete option
  return (
    <div className="space-y-4">
      <Card className="border-destructive/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 text-destructive" />
            </div>
            Delete Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-destructive/5 rounded-lg p-4 border border-destructive/10 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Permanently delete your account and all associated data. This action:</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1 text-xs">
                  <li>Immediately deactivates your account</li>
                  <li>Prevents login during the 30-day grace period</li>
                  <li>Permanently deletes all data after 30 days</li>
                  <li><strong>Cannot be undone</strong> after the grace period</li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            variant="destructive"
            onClick={() => setShowConfirm(true)}
            className="w-full sm:w-auto"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete My Account
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Are you sure?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Your account will be <strong>deactivated immediately</strong>. After 30 days, 
                all your data will be <strong>permanently deleted</strong> and cannot be recovered.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="deletion-reason" className="text-sm">
              Reason <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="deletion-reason"
              placeholder="Tell us why you're leaving..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{reason.length}/500</p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRequestDeletion}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Processing...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DeleteAccountTab;
