import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { imageManagementApi, PendingUser } from '@/api/imageManagement.api';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Eye,
} from 'lucide-react';

export function SystemAdminImageQueue() {
  const { toast } = useToast();
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'PENDING' | 'VERIFIED' | 'REJECTED'>('PENDING');
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 20;

  // Reject dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectUserId, setRejectUserId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Preview dialog
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchUsers = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const data = await imageManagementApi.getUnverifiedUsers({
        status: statusFilter,
        page: p,
        limit: LIMIT,
      });
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchUsers(page);
  }, [page, fetchUsers]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const handleApprove = async (userId: string, imageId: string | null) => {
    setActionLoading(userId);
    try {
      const result = await imageManagementApi.approveImage(userId, imageId);
      toast({
        title: 'Image Approved',
        description: result.cardGenerated
          ? `Approved & card generated: ${result.cardId}`
          : 'Image approved successfully',
      });
      fetchUsers(page);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectUserId || !rejectionReason.trim()) return;
    const user = users.find(u => u.userId === rejectUserId);
    setActionLoading(rejectUserId);
    try {
      const result = await imageManagementApi.rejectImage(
        rejectUserId,
        rejectionReason,
        user?.imageId
      );
      toast({
        title: 'Image Rejected',
        description: result.emailSent ? 'User notified via email with re-upload link' : 'Image rejected',
      });
      setRejectDialogOpen(false);
      setRejectionReason('');
      setRejectUserId(null);
      fetchUsers(page);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      PENDING: 'bg-warning/10 text-warning border-warning/20',
      VERIFIED: 'bg-success/10 text-success border-success/20',
      REJECTED: 'bg-destructive/10 text-destructive border-destructive/20',
    };
    return (
      <Badge variant="outline" className={variants[status] || ''}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Status:</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="VERIFIED">Verified</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Badge variant="secondary" className="text-sm">
          {total} total
        </Badge>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No {statusFilter.toLowerCase()} images found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {users.map((user) => (
            <Card key={user.userId} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div
                    className="relative cursor-pointer group"
                    onClick={() => setPreviewImage(user.imageUrl)}
                  >
                    <Avatar className="h-20 w-20 rounded-lg">
                      <AvatarImage src={user.imageUrl} className="object-cover" />
                      <AvatarFallback className="rounded-lg text-lg">
                        {user.nameWithInitials?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 bg-foreground/50 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Eye className="h-5 w-5 text-background" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold truncate">{user.nameWithInitials}</p>
                      {statusBadge(user.imageVerificationStatus)}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    <p className="text-sm text-muted-foreground">{user.phoneNumber}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{user.userType}</Badge>
                      {user.isLegacy && (
                        <Badge variant="secondary" className="text-xs">Legacy</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(user.imageUploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {statusFilter === 'PENDING' && (
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleApprove(user.userId, user.imageId)}
                      disabled={actionLoading === user.userId}
                    >
                      {actionLoading === user.userId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() => {
                        setRejectUserId(user.userId);
                        setRejectDialogOpen(true);
                      }}
                      disabled={actionLoading === user.userId}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Image</DialogTitle>
            <DialogDescription>
              Provide a reason for rejection. The user will be notified via email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rejection Reason</Label>
              <Textarea
                placeholder="e.g., Image is blurry and does not clearly show the face"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || actionLoading !== null}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reject & Notify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <img
              src={previewImage}
              alt="Profile preview"
              className="w-full rounded-lg object-contain max-h-[70vh]"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
