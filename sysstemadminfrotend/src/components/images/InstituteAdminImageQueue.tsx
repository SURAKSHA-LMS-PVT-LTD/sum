import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { imageManagementApi, InstituteUserImage } from '@/api/imageManagement.api';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Search,
  Eye,
  CreditCard,
} from 'lucide-react';

export function InstituteAdminImageQueue() {
  const { toast } = useToast();
  const [instituteId, setInstituteId] = useState('');
  const [users, setUsers] = useState<InstituteUserImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  // Reject dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectUserId, setRejectUserId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Card ID dialog
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [cardUserId, setCardUserId] = useState<string | null>(null);
  const [cardIdValue, setCardIdValue] = useState('');

  // Preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchPending = useCallback(async (p: number) => {
    if (!instituteId.trim()) return;
    setLoading(true);
    try {
      const data = await imageManagementApi.getInstitutePendingImages(instituteId, {
        page: p,
        limit: 10,
        search: search || undefined,
      });
      setUsers(data.data || []);
      setTotal(data.meta?.total || 0);
      setTotalPages(data.meta?.totalPages || 1);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [instituteId, search]);

  const fetchCount = useCallback(async () => {
    if (!instituteId.trim()) return;
    try {
      const { count } = await imageManagementApi.getInstitutePendingCount(instituteId);
      setPendingCount(count);
    } catch {
      // ignore
    }
  }, [instituteId]);

  useEffect(() => {
    if (instituteId.trim()) {
      fetchPending(page);
      fetchCount();
    }
  }, [page, instituteId, fetchPending, fetchCount]);

  const handleLoad = () => {
    setPage(1);
    fetchPending(1);
    fetchCount();
  };

  const handleVerify = async (userId: string, status: 'VERIFIED' | 'REJECTED', reason?: string) => {
    if (!instituteId.trim()) return;
    setActionLoading(userId);
    try {
      await imageManagementApi.verifyInstituteImage(instituteId, userId, {
        status,
        rejectionReason: reason,
      });
      toast({
        title: status === 'VERIFIED' ? 'Image Approved' : 'Image Rejected',
        description: status === 'VERIFIED'
          ? 'Institute image verified successfully'
          : 'Image rejected and deleted from storage',
      });
      if (status === 'REJECTED') {
        setRejectDialogOpen(false);
        setRejectionReason('');
        setRejectUserId(null);
      }
      fetchPending(page);
      fetchCount();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignCardId = async () => {
    if (!instituteId.trim() || !cardUserId || !cardIdValue.trim()) return;
    setActionLoading(cardUserId);
    try {
      await imageManagementApi.assignInstituteCardId(instituteId, cardUserId, cardIdValue.trim());
      toast({ title: 'Card ID Assigned', description: `Card ID: ${cardIdValue.trim()}` });
      setCardDialogOpen(false);
      setCardIdValue('');
      setCardUserId(null);
      fetchPending(page);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Institute ID input */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label>Institute ID</Label>
              <Input
                placeholder="Enter institute ID"
                value={instituteId}
                onChange={(e) => setInstituteId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label>Search Users</Label>
              <Input
                placeholder="Search by name or email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
              />
            </div>
            <Button onClick={handleLoad} disabled={!instituteId.trim()}>
              <Search className="h-4 w-4 mr-2" />
              Load
            </Button>
          </div>
          {pendingCount > 0 && (
            <div className="mt-3">
              <Badge variant="destructive" className="text-sm">
                {pendingCount} pending verification
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : users.length === 0 && instituteId ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No pending images found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {users.map((user) => (
            <Card key={user.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div
                    className="relative cursor-pointer group"
                    onClick={() => setPreviewImage(user.instituteUserImageUrl || user.imageUrl)}
                  >
                    <Avatar className="h-20 w-20 rounded-lg">
                      <AvatarImage
                        src={user.instituteUserImageUrl || user.imageUrl || undefined}
                        className="object-cover"
                      />
                      <AvatarFallback className="rounded-lg text-lg">
                        {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 bg-foreground/50 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Eye className="h-5 w-5 text-background" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-semibold truncate">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                    {user.userIdByInstitute && (
                      <Badge variant="outline" className="text-xs">
                        ID: {user.userIdByInstitute}
                      </Badge>
                    )}
                    {user.instituteCardId && (
                      <Badge variant="secondary" className="text-xs">
                        <CreditCard className="h-3 w-3 mr-1" />
                        {user.instituteCardId}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleVerify(user.id, 'VERIFIED')}
                    disabled={actionLoading === user.id}
                  >
                    {actionLoading === user.id ? (
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
                      setRejectUserId(user.id);
                      setRejectDialogOpen(true);
                    }}
                    disabled={actionLoading === user.id}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setCardUserId(user.id);
                      setCardIdValue(user.instituteCardId || '');
                      setCardDialogOpen(true);
                    }}
                    title="Assign Card ID"
                  >
                    <CreditCard className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Institute Image</DialogTitle>
            <DialogDescription>
              The image will be deleted from storage. Provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Rejection Reason</Label>
            <Textarea
              placeholder="e.g., Photo does not show the face clearly"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectUserId && handleVerify(rejectUserId, 'REJECTED', rejectionReason)}
              disabled={!rejectionReason.trim() || actionLoading !== null}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Card ID Dialog */}
      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Institute Card ID</DialogTitle>
            <DialogDescription>Must be unique within the institute (max 100 chars).</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Card ID</Label>
            <Input
              placeholder="e.g., CARD-2026-042"
              value={cardIdValue}
              onChange={(e) => setCardIdValue(e.target.value)}
              maxLength={100}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignCardId} disabled={!cardIdValue.trim() || actionLoading !== null}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Image Preview</DialogTitle></DialogHeader>
          {previewImage && (
            <img src={previewImage} alt="Preview" className="w-full rounded-lg object-contain max-h-[70vh]" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
