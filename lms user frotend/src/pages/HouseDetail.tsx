import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { buildSidebarUrl } from '@/utils/pageNavigation';
import { getImageUrl } from '@/utils/imageUrlHelper';
import {
  housesApi,
  InstituteHouse,
  HouseMember,
  HouseMembersPagedResponse,
  BulkAssignResult,
} from '@/api/houses.api';
import {
  ArrowLeft, Users, Flag, RefreshCw, UserPlus, Trash2, Loader2,
  AlertCircle, UserCheck, ShieldCheck, GraduationCap, Phone, Mail,
  CreditCard, Hash, Calendar, ChevronLeft, ChevronRight, Plus, X, Clipboard,
} from 'lucide-react';

// ─── Role badge map ───────────────────────────────────────────────────────────

const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  STUDENT: 'default',
  TEACHER: 'secondary',
  INSTITUTE_ADMIN: 'outline',
};

const ROLE_ICON: Record<string, React.ElementType> = {
  STUDENT: GraduationCap,
  TEACHER: UserCheck,
  INSTITUTE_ADMIN: ShieldCheck,
};

const ENROLL_LABEL: Record<string, string> = {
  manual: 'Manual',
  auto: 'Auto',
  self: 'Self',
};

// ─── Main Component ───────────────────────────────────────────────────────────

const HouseDetail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentInstituteId } = useAuth();
  const { toast } = useToast();
  const userRole = useInstituteRole();
  const isAdmin = userRole === 'InstituteAdmin';

  // Parse houseId from URL  e.g. /institute/42/houses/1
  const houseIdMatch = location.pathname.match(/\/houses\/([^/]+)/);
  const houseId = houseIdMatch?.[1] ?? '';

  // ── Data states ───────────────────────────────────────────────────────
  const [house, setHouse] = useState<InstituteHouse | null>(null);
  const [members, setMembers] = useState<HouseMember[]>([]);
  const [isLoadingHouse, setIsLoadingHouse] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  // ── Pagination ────────────────────────────────────────────────────────
  const [membersPage, setMembersPage] = useState(1);
  const [membersLimit, setMembersLimit] = useState(20);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersTotalPages, setMembersTotalPages] = useState(0);

  // ── Assign single member ──────────────────────────────────────────────
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // ── Bulk assign ───────────────────────────────────────────────────────
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkIds, setBulkIds] = useState<string[]>([]);
  const [bulkCurrentId, setBulkCurrentId] = useState('');
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkAssignResult[] | null>(null);

  // ── Remove member confirm ─────────────────────────────────────────────
  const [memberToRemove, setMemberToRemove] = useState<HouseMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  // ── Load house ────────────────────────────────────────────────────────
  const fetchHouse = async (forceRefresh = false) => {
    if (!currentInstituteId || !houseId) return;
    setIsLoadingHouse(true);
    try {
      const data = await housesApi.getById(currentInstituteId, houseId, forceRefresh);
      setHouse(data);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'Failed to load house.' });
    } finally {
      setIsLoadingHouse(false);
    }
  };

  // ── Load members ──────────────────────────────────────────────────────
  const fetchMembers = async (forceRefresh = false, page = membersPage, limit = membersLimit) => {
    if (!currentInstituteId || !houseId) return;
    setIsLoadingMembers(true);
    try {
      const res = await housesApi.getMembers(
        currentInstituteId,
        houseId,
        { isActive: true, page, limit },
        forceRefresh,
      );
      setMembers(Array.isArray(res) ? (res as HouseMember[]) : (res?.data ?? []));
      if (!Array.isArray(res)) {
        setMembersPage(res.page);
        setMembersTotal(res.total);
        setMembersLimit(res.limit);
        setMembersTotalPages(res.totalPages);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'Failed to load members.' });
    } finally {
      setIsLoadingMembers(false);
    }
  };

  // Auto-load on mount / when institute or house changes (use cache on first visit)
  useEffect(() => {
    if (!currentInstituteId || !houseId) return;
    fetchHouse(false);
    fetchMembers(false, 1, membersLimit);
  }, [currentInstituteId, houseId]);

  // ── Filtered members ──────────────────────────────────────────────────
  const filteredMembers = members.filter(m => {
    const q = memberSearch.toLowerCase();
    return (
      (m.firstName ?? '').toLowerCase().includes(q) ||
      (m.lastName ?? '').toLowerCase().includes(q) ||
      (m.nameWithInitials ?? '').toLowerCase().includes(q) ||
      (m.email ?? '').toLowerCase().includes(q)
    );
  });

  // ── Assign single ─────────────────────────────────────────────────────
  const handleAssign = async () => {
    if (!currentInstituteId || !houseId || !assignUserId.trim()) return;
    setIsAssigning(true);
    try {
      const res = await housesApi.assignMember(currentInstituteId, houseId, {
        userId: assignUserId.trim(),
      });
      toast({ title: 'Assigned', description: res.message });
      setIsAssignOpen(false);
      setAssignUserId('');
      fetchHouse(true);
      fetchMembers(true, 1, membersLimit);
    } catch (err: any) {
      const msg = String(err?.message ?? '');
      if (msg.includes('400') || msg.toLowerCase().includes('not an active member')) {
        toast({ variant: 'destructive', title: 'Not a member', description: 'User is not an active member of this institute.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: msg || 'Failed to assign user.' });
      }
    } finally {
      setIsAssigning(false);
    }
  };

  // ── Bulk assign ───────────────────────────────────────────────────────
  const addBulkIds = (raw: string) => {
    const newIds = raw.split(/[\n,;\s]+/).map(s => s.trim()).filter(s => s.length > 0);
    setBulkIds(prev => {
      const merged = [...prev];
      newIds.forEach(id => { if (!merged.includes(id)) merged.push(id); });
      return merged;
    });
  };

  const handleAddBulkId = () => {
    if (!bulkCurrentId.trim()) return;
    addBulkIds(bulkCurrentId);
    setBulkCurrentId('');
    bulkInputRef.current?.focus();
  };

  const handleBulkPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (/[\n,;]/.test(text)) {
      e.preventDefault();
      addBulkIds(text);
      setBulkCurrentId('');
    }
  };
  const handleBulkAssign = async () => {
    if (!currentInstituteId || !houseId) return;
    const ids = bulkIds;
    if (ids.length === 0) {
      toast({ variant: 'destructive', title: 'Validation', description: 'Please enter at least one user ID.' });
      return;
    }
    setIsBulkAssigning(true);
    setBulkResults(null);
    try {
      const res = await housesApi.bulkAssignMembers(currentInstituteId, houseId, { userIds: ids });
      setBulkResults(res.results);
      const assigned = res.results.filter(r => r.status === 'assigned').length;
      toast({ title: 'Bulk assignment complete', description: `${assigned} of ${ids.length} users assigned successfully.` });
      fetchHouse(true);
      fetchMembers(true, 1, membersLimit);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'Bulk assignment failed.' });
    } finally {
      setIsBulkAssigning(false);
    }
  };

  // ── Remove member ─────────────────────────────────────────────────────
  const confirmRemove = async () => {
    if (!currentInstituteId || !houseId || !memberToRemove) return;
    setIsRemoving(true);
    try {
      const res = await housesApi.removeMember(currentInstituteId, houseId, memberToRemove.userId);
      toast({ title: 'Removed', description: res.message });
      setMemberToRemove(null);
      fetchHouse(true);
      fetchMembers(true, 1, membersLimit);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'Failed to remove member.' });
    } finally {
      setIsRemoving(false);
    }
  };

  // ── Back navigation ───────────────────────────────────────────────────
  const handleBack = () => {
    navigate(buildSidebarUrl('houses', { instituteId: currentInstituteId }));
  };

  const color = house?.color ?? '#9E9E9E';

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Back + refresh ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5 -ml-1 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Houses
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { fetchHouse(true); fetchMembers(true, membersPage, membersLimit); }}
          disabled={isLoadingHouse || isLoadingMembers}
        >
          <RefreshCw className={`h-4 w-4 ${(isLoadingHouse || isLoadingMembers) ? 'animate-spin' : ''}`} />
          <span className="ml-1.5 hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* ── Loading skeleton ──────────────────────────────────────────── */}
      {isLoadingHouse && !house && (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading house…
        </div>
      )}

      {/* ── House Header Card ─────────────────────────────────────────── */}
      {house && (
        <Card className="overflow-hidden">
          <div className="h-3 w-full" style={{ background: color }} />
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              {/* Image */}
              {house.imageUrl ? (
                <img
                  src={getImageUrl(house.imageUrl)}
                  alt={house.name}
                  className="h-20 w-20 rounded-xl object-cover border border-border flex-shrink-0"
                />
              ) : (
                <div
                  className="h-20 w-20 rounded-xl flex items-center justify-center text-white text-3xl font-bold flex-shrink-0"
                  style={{ background: color }}
                >
                  {house.name.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-foreground">{house.name}</h1>
                  <span
                    style={{ background: color, color: '#fff', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}
                  >
                    {house.name}
                  </span>
                  {!house.isActive && (
                    <Badge variant="outline" className="text-muted-foreground text-xs">Inactive</Badge>
                  )}
                </div>
                {house.description && (
                  <p className="text-sm text-muted-foreground mt-1">{house.description}</p>
                )}
                <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{house.memberCount ?? members.length} members</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Members Section ───────────────────────────────────────────── */}
      {house && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <Flag className="h-4 w-4 text-primary" />
                Members
                <Badge variant="secondary" className="text-xs">{membersTotal > 0 ? membersTotal : (house?.memberCount ?? 0)}</Badge>
              </CardTitle>
              {isAdmin && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setBulkResults(null); setBulkIds([]); setBulkCurrentId(''); setIsBulkOpen(true); }}>
                    <Users className="h-4 w-4 mr-1.5" />
                    Bulk Assign
                  </Button>
                  <Button size="sm" onClick={() => { setAssignUserId(''); setIsAssignOpen(true); }}>
                    <UserPlus className="h-4 w-4 mr-1.5" />
                    Assign Member
                  </Button>
                </div>
              )}
            </div>
            <div className="mt-2">
              <Input
                placeholder="Search members…"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                className="h-8 max-w-xs"
              />
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {isLoadingMembers && members.length === 0 && (
              <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading members…
              </div>
            )}

            {!isLoadingMembers && members.length === 0 && (
              <div className="flex flex-col items-center py-10 text-center gap-2 text-muted-foreground">
                <Users className="h-8 w-8" />
                <p className="text-sm">No members assigned yet.</p>
                {isAdmin && (
                  <p className="text-xs">Use "Assign Member" to add users to this house.</p>
                )}
              </div>
            )}

            {filteredMembers.length > 0 && (
              <div className="flex flex-col gap-2">
                {filteredMembers.map(m => {
                  const RoleIcon = ROLE_ICON[m.instituteUserType ?? ''] ?? Users;
                  const fullName = m.nameWithInitials || [m.firstName, m.lastName].filter(Boolean).join(' ') || m.userId;
                  return (
                    <Card key={m.id} className="hover:shadow-md transition-shadow">
                      <div className="p-4 flex items-center gap-4 flex-wrap md:flex-nowrap">
                        <Avatar className="h-12 w-12 shrink-0 border-2 border-border">
                          <AvatarImage src={m.profileImageUrl ? getImageUrl(m.profileImageUrl) : undefined} />
                          <AvatarFallback
                            className="text-white font-bold text-base"
                            style={{ background: color }}
                          >
                            {fullName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{fullName}</p>
                          {m.email && (
                            <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                          )}
                          {m.userIdByInstitute && (
                            <p className="text-xs text-muted-foreground font-mono">Institute ID: {m.userIdByInstitute}</p>
                          )}
                          <p className="text-xs text-muted-foreground font-mono">ID: {m.userId}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground flex-1 min-w-[220px]">
                          {m.phoneNumber && (
                            <span className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              {m.phoneNumber}
                            </span>
                          )}
                          {m.nic && (
                            <span className="flex items-center gap-1.5">
                              <CreditCard className="h-3.5 w-3.5 shrink-0" />
                              <span className="font-mono">{m.nic}</span>
                            </span>
                          )}
                          {(m.enrolledAt || m.createdAt) && (
                            <span className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 shrink-0" />
                              {new Date(m.enrolledAt || m.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          {m.instituteUserType && (
                            <span className="flex items-center gap-1.5">
                              <RoleIcon className="h-3.5 w-3.5 shrink-0" />
                              <Badge variant={ROLE_VARIANT[m.instituteUserType] ?? 'outline'} className="text-xs gap-1 h-5">
                                {m.instituteUserType}
                              </Badge>
                            </span>
                          )}
                          <Badge variant="outline" className="text-xs h-5 capitalize">
                            {ENROLL_LABEL[m.enrollmentMethod] ?? m.enrollmentMethod}
                          </Badge>
                        </div>

                        {isAdmin && (
                          <div className="flex items-center gap-2 ml-auto">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="rounded-full h-9 w-9 p-0"
                              title="Remove from house"
                              onClick={() => setMemberToRemove(m)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {!isLoadingMembers && members.length > 0 && filteredMembers.length === 0 && (
              <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center text-sm">
                <AlertCircle className="h-4 w-4" />
                No members match "{memberSearch}"
              </div>
            )}

            {/* ── Pagination + limit controls (bottom) ───────────────── */}
            {membersTotal > 0 && (
              <div className="pt-3 border-t mt-2">
                <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-2">
                  <p className="text-xs text-muted-foreground text-center md:text-left">
                    {membersTotal} members total
                  </p>

                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => fetchMembers(false, membersPage - 1, membersLimit)}
                      disabled={membersPage <= 1 || isLoadingMembers}
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                      Prev
                    </Button>
                    <span className="text-xs text-muted-foreground font-medium min-w-[56px] text-center">
                      {isLoadingMembers
                        ? <Loader2 className="h-3 w-3 animate-spin inline" />
                        : `${membersPage} / ${Math.max(membersTotalPages, 1)}`
                      }
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => fetchMembers(false, membersPage + 1, membersLimit)}
                      disabled={membersPage >= membersTotalPages || isLoadingMembers}
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>

                  <div className="flex justify-center md:justify-end">
                    <select
                      value={membersLimit}
                      onChange={e => {
                        const l = Number(e.target.value);
                        setMembersLimit(l);
                        fetchMembers(false, 1, l);
                      }}
                      className="h-7 rounded-md border border-input bg-background text-xs px-2 text-foreground"
                    >
                      <option value={10}>10 / page</option>
                      <option value={20}>20 / page</option>
                      <option value={50}>50 / page</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Assign Single Member Dialog ───────────────────────────────── */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="max-w-sm" allowOutsideClose={false}>
          <DialogHeader>
            <DialogTitle>Assign Member</DialogTitle>
            <DialogDescription>Enter the user ID of an active institute member to assign to this house.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="assign-userid">User ID</Label>
              <Input
                id="assign-userid"
                placeholder="Enter user ID…"
                value={assignUserId}
                onChange={e => setAssignUserId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAssign()}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setIsAssignOpen(false)} disabled={isAssigning}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleAssign} disabled={isAssigning || !assignUserId.trim()}>
                {isAssigning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Assigning…</> : 'Assign'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Assign Dialog ────────────────────────────────────────── */}
      <Dialog open={isBulkOpen} onOpenChange={val => { if (!isBulkAssigning) { setIsBulkOpen(val); if (!val) { setBulkResults(null); setBulkIds([]); setBulkCurrentId(''); } } }}>
        <DialogContent className="max-w-lg w-[calc(100%-1rem)] mx-auto rounded-2xl sm:rounded-xl p-0 gap-0 overflow-hidden" allowOutsideClose={false}>
          {/* Header */}
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-base">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-primary" />
              </div>
              Bulk Assign Members
            </DialogTitle>
            {house && (
              <DialogDescription className="text-xs mt-1">
                Assigning to <strong className="text-foreground">{house.name}</strong>
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add User ID</Label>
              <div className="flex gap-2">
                <Input
                  ref={bulkInputRef}
                  placeholder="Type ID and press Enter, or paste multiple…"
                  value={bulkCurrentId}
                  onChange={e => setBulkCurrentId(e.target.value)}
                  onPaste={handleBulkPaste}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddBulkId(); } }}
                  className="flex-1 text-sm"
                  autoFocus
                  disabled={isBulkAssigning}
                />
                <Button
                  type="button"
                  onClick={handleAddBulkId}
                  disabled={!bulkCurrentId.trim() || isBulkAssigning}
                  size="sm"
                  className="shrink-0 px-3"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clipboard className="h-3 w-3" />
                Tip: paste a list of IDs separated by commas, spaces, or new lines — they'll all be added at once.
              </p>
            </div>

            {/* ID List */}
            {bulkIds.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />Users to assign
                    <span className="ml-1 inline-flex items-center justify-center h-5 px-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">{bulkIds.length}</span>
                  </Label>
                  <button
                    type="button"
                    onClick={() => setBulkIds([])}
                    className="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                    disabled={isBulkAssigning}
                  >
                    <Trash2 className="h-3 w-3" />Clear all
                  </button>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border overflow-hidden">
                  {bulkIds.map((id, i) => (
                    <div key={id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/60 transition-colors">
                      <span className="text-[11px] text-muted-foreground w-5 shrink-0 text-right">{i + 1}.</span>
                      <span className="flex-1 text-sm font-mono font-medium text-foreground truncate">{id}</span>
                      <button
                        type="button"
                        onClick={() => setBulkIds(prev => prev.filter(x => x !== id))}
                        disabled={isBulkAssigning}
                        className="shrink-0 h-5 w-5 flex items-center justify-center rounded-full hover:bg-destructive/15 hover:text-destructive text-muted-foreground transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-2 rounded-lg border border-dashed border-border bg-muted/20">
                <Users className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">No user IDs added yet</p>
                <p className="text-[11px] text-muted-foreground/60">Type above or paste a list to get started</p>
              </div>
            )}

            {/* Results summary */}
            {bulkResults && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                {bulkResults.map(r => (
                  <div key={r.userId} className="flex items-center gap-2 text-xs">
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${r.status === 'assigned' ? 'bg-green-500' : 'bg-destructive'}`} />
                    <span className="font-mono text-muted-foreground">{r.userId}</span>
                    <span className={r.status === 'assigned' ? 'text-green-600 dark:text-green-400' : 'text-destructive truncate'}>
                      {r.status === 'assigned' ? 'Assigned' : r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setIsBulkOpen(false); setBulkResults(null); setBulkIds([]); setBulkCurrentId(''); }}
              className="text-muted-foreground"
              disabled={isBulkAssigning}
            >
              {bulkResults ? 'Close' : 'Cancel'}
            </Button>
            {!bulkResults && (
              <Button
                onClick={handleBulkAssign}
                disabled={bulkIds.length === 0 || isBulkAssigning}
                className="gap-2"
              >
                {isBulkAssigning ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Assigning…</>
                ) : (
                  <><UserPlus className="h-4 w-4" />Assign {bulkIds.length > 0 ? `${bulkIds.length} Member${bulkIds.length > 1 ? 's' : ''}` : 'Members'}</>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Remove Member Confirm ─────────────────────────────────────── */}
      <AlertDialog open={!!memberToRemove} onOpenChange={open => { if (!open && !isRemoving) setMemberToRemove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove{' '}
              <strong>
                {memberToRemove?.nameWithInitials ||
                  [memberToRemove?.firstName, memberToRemove?.lastName].filter(Boolean).join(' ') ||
                  memberToRemove?.userId}
              </strong>{' '}
              from this house? You can re-assign them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemove}
              disabled={isRemoving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Removing…</> : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default HouseDetail;
