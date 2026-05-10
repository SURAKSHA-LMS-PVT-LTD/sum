import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useInstituteRole } from '@/hooks/useInstituteRole';
import { useNavigate } from 'react-router-dom';
import { buildSidebarUrl } from '@/utils/pageNavigation';
import { getImageUrl } from '@/utils/imageUrlHelper';
import {
  housesApi,
  InstituteHouse,
  CreateInstituteHousePayload,
  UpdateInstituteHousePayload,
} from '@/api/houses.api';
import DeleteConfirmDialog from '@/components/forms/DeleteConfirmDialog';
import SubjectImageUpload from '@/components/SubjectImageUpload';
import {
  Plus, RefreshCw, Edit, Trash2, Users, Flag, AlertCircle, Loader2, CheckCircle2,
} from 'lucide-react';

// ─── Colour chip helper ────────────────────────────────────────────────────

const HouseColorChip = ({ house }: { house: InstituteHouse }) => (
  <span
    style={{
      background: house.color ?? '#9E9E9E',
      color: '#fff',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
    }}
  >
    {house.name}
  </span>
);

// ─── Main Component ────────────────────────────────────────────────────────

const InstituteHouses = () => {
  const { currentInstituteId, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const userRole = useInstituteRole();
  const isAdmin = userRole === 'InstituteAdmin';

  // ── Data ────────────────────────────────────────────────────────────────
  const [houses, setHouses] = useState<InstituteHouse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // localStorage key scoped to user + institute so it never leaks across accounts
  const storageKey = currentInstituteId && user?.id
    ? `enrolled_house_${currentInstituteId}_${user.id}`
    : null;

  // Initialise from localStorage so enrolled state survives a page refresh
  const [enrolledHouseIds, setEnrolledHouseIds] = useState<Set<string>>(() => {
    if (!currentInstituteId || !user?.id) return new Set();
    const cached = localStorage.getItem(`enrolled_house_${currentInstituteId}_${user.id}`);
    return cached ? new Set([cached]) : new Set();
  });
  // Track per-house enroll loading state
  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  // ── Create dialog ────────────────────────────────────────────────────────
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateInstituteHousePayload>({
    name: '',
    color: '#3B82F6',
    description: '',
  });
  const createImageUploadRef = useRef<(() => Promise<string | null>) | null>(null);
  const [createImagePreview, setCreateImagePreview] = useState('');

  // ── Edit dialog ───────────────────────────────────────────────────────────
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editHouse, setEditHouse] = useState<InstituteHouse | null>(null);
  const [editForm, setEditForm] = useState<UpdateInstituteHousePayload>({});
  const editImageUploadRef = useRef<(() => Promise<string | null>) | null>(null);
  const [editImagePreview, setEditImagePreview] = useState('');

  // ── Delete dialog ─────────────────────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [houseToDelete, setHouseToDelete] = useState<InstituteHouse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Derive enrollment state from list API response ─────────────────────
  // Uses house.isEnrolled (set by backend for both self-enroll and admin-assign).
  // enrolledHouseId is the same on every item — null means not in any house.
  const syncEnrollmentFromList = (houseList: InstituteHouse[]) => {
    if (isAdmin || houseList.length === 0 || !storageKey) return;
    // Find the house the user is enrolled in via the isEnrolled flag
    const enrolledHouse = houseList.find(h => h.isEnrolled === true);
    // Also read enrolledHouseId from any item (same on all) as a fallback
    const enrolledHouseId = enrolledHouse?.id ?? houseList[0].enrolledHouseId ?? null;
    if (enrolledHouseId) {
      localStorage.setItem(storageKey, enrolledHouseId);
      setEnrolledHouseIds(new Set([enrolledHouseId]));
    } else {
      localStorage.removeItem(storageKey);
      setEnrolledHouseIds(new Set());
    }
  };

  // ── Load houses ────────────────────────────────────────────────────────
  const fetchHouses = async (force = false) => {
    if (!currentInstituteId) return;
    setIsLoading(true);
    try {
      const data = await housesApi.list(currentInstituteId, force);
      setHouses(data);
      syncEnrollmentFromList(data);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'Failed to load houses' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHouses();
  }, [currentInstituteId]);

  // ── Filtered list ─────────────────────────────────────────────────────
  const filtered = houses.filter(h =>
    h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (h.description ?? '').toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // ── Create ────────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setCreateForm({ name: '', color: '#3B82F6', description: '' });
    setCreateImagePreview('');
    setIsCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!currentInstituteId) return;
    if (!createForm.name.trim()) {
      toast({ variant: 'destructive', title: 'Validation', description: 'House name is required.' });
      return;
    }
    setIsCreating(true);
    try {
      let imageUrl: string | undefined;
      if (createImageUploadRef.current) {
        const uploaded = await createImageUploadRef.current();
        if (uploaded) imageUrl = uploaded;
      }
      const payload: CreateInstituteHousePayload = {
        ...createForm,
        ...(imageUrl ? { imageUrl } : {}),
      };
      await housesApi.create(currentInstituteId, payload);
      toast({ title: 'House created', description: `"${createForm.name}" was created successfully.` });
      setIsCreateOpen(false);
      fetchHouses(true);
    } catch (err: any) {
      const msg = String(err?.message ?? '');
      if (msg.includes('409') || msg.toLowerCase().includes('already exists')) {
        toast({ variant: 'destructive', title: 'Duplicate name', description: 'A house with this name already exists.' });
      } else {
        toast({ variant: 'destructive', title: 'Error', description: msg || 'Failed to create house.' });
      }
    } finally {
      setIsCreating(false);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────
  const handleOpenEdit = (house: InstituteHouse) => {
    setEditHouse(house);
    setEditForm({
      name: house.name,
      color: house.color ?? '#9E9E9E',
      description: house.description ?? '',
      isActive: house.isActive,
    });
    setEditImagePreview(house.imageUrl ? getImageUrl(house.imageUrl) : '');
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!currentInstituteId || !editHouse) return;
    if (editForm.name !== undefined && !editForm.name.trim()) {
      toast({ variant: 'destructive', title: 'Validation', description: 'House name cannot be empty.' });
      return;
    }
    setIsUpdating(true);
    try {
      let imageUrl: string | undefined;
      if (editImageUploadRef.current) {
        const uploaded = await editImageUploadRef.current();
        if (uploaded) imageUrl = uploaded;
      }
      await housesApi.update(currentInstituteId, editHouse.id, editForm);
      if (imageUrl) {
        await housesApi.updateImage(currentInstituteId, editHouse.id, { imageUrl });
      }
      toast({ title: 'House updated', description: `"${editHouse.name}" was updated successfully.` });
      setIsEditOpen(false);
      fetchHouses(true);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'Failed to update house.' });
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────
  const handleDeleteClick = (house: InstituteHouse) => {
    setHouseToDelete(house);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!currentInstituteId || !houseToDelete) return;
    setIsDeleting(true);
    try {
      await housesApi.delete(currentInstituteId, houseToDelete.id);
      toast({ title: 'House deleted', description: `"${houseToDelete.name}" was removed.` });
      setShowDeleteConfirm(false);
      setHouseToDelete(null);
      fetchHouses(true);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'Failed to delete house.' });
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Navigate to detail ────────────────────────────────────────────────
  const handleViewHouse = (house: InstituteHouse) => {
    navigate(buildSidebarUrl(`houses/${house.id}`, { instituteId: currentInstituteId }));
  };

  // ── Self-enroll ───────────────────────────────────────────────────────
  const handleEnroll = async (house: InstituteHouse) => {
    if (!currentInstituteId) return;
    setEnrollingId(house.id);
    try {
      const res = await housesApi.selfEnroll(currentInstituteId, house.id);
      toast({ title: 'Enrolled!', description: res.message || `You have been enrolled in "${house.name}".` });
      setEnrolledHouseIds(prev => new Set(prev).add(house.id));
      // Persist so the enrolled state survives a page refresh
      if (storageKey) localStorage.setItem(storageKey, house.id);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Enroll failed', description: err?.message ?? 'Could not enroll in this house.' });
    } finally {
      setEnrollingId(null);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Flag className="h-5 w-5 text-primary" />
            Houses
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {houses.length} {houses.length === 1 ? 'house' : 'houses'} in this institute
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchHouses(true)} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="ml-1.5 hidden sm:inline">Refresh</span>
          </Button>
          {isAdmin && (
            <Button size="sm" onClick={handleOpenCreate}>
              <Plus className="h-4 w-4 mr-1.5" />
              Create House
            </Button>
          )}
        </div>
      </div>

      {/* ── Search ───────────────────────────────────────────────────── */}
      <div className="max-w-sm">
        <Input
          placeholder="Search houses…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="h-9"
        />
      </div>

      {/* ── Loading ───────────────────────────────────────────────────── */}
      {isLoading && houses.length === 0 && (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading houses…
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {!isLoading && houses.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
            <Flag className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground">No houses yet</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Houses are sub-groups within the institute (e.g. Red House, Blue House).
          </p>
          {isAdmin && (
            <Button size="sm" onClick={handleOpenCreate} className="mt-1">
              <Plus className="h-4 w-4 mr-1.5" />
              Create First House
            </Button>
          )}
        </div>
      )}

      {/* ── Houses Grid ───────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-4">
          {filtered.map(house => (
            <HouseCard
              key={house.id}
              house={house}
              isAdmin={isAdmin}
              isEnrolled={house.isEnrolled === true || enrolledHouseIds.has(house.id)}
              isEnrolling={enrollingId === house.id}
              anyEnrolling={enrollingId !== null || enrolledHouseIds.size > 0 || houses.some(h => h.isEnrolled === true)}
              onView={handleViewHouse}
              onEdit={handleOpenEdit}
              onDelete={handleDeleteClick}
              onEnroll={handleEnroll}
            />
          ))}
        </div>
      )}

      {/* ── No search results ────────────────────────────────────────── */}
      {!isLoading && houses.length > 0 && filtered.length === 0 && (
        <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
          <AlertCircle className="h-4 w-4" />
          No houses match "{searchTerm}"
        </div>
      )}

      {/* ── Create House Dialog ───────────────────────────────────────── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md" allowOutsideClose={false}>
          <DialogHeader>
            <DialogTitle>Create House</DialogTitle>
            <DialogDescription>Add a new house to this institute.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="create-name"
                placeholder="e.g. Red House"
                value={createForm.name}
                onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-color">Colour</Label>
              <div className="flex items-center gap-2">
                <input
                  id="create-color"
                  type="color"
                  value={createForm.color ?? '#9E9E9E'}
                  onChange={e => setCreateForm(p => ({ ...p, color: e.target.value }))}
                  className="h-9 w-12 cursor-pointer rounded border border-input bg-background p-0.5"
                />
                <Input
                  value={createForm.color ?? ''}
                  onChange={e => setCreateForm(p => ({ ...p, color: e.target.value }))}
                  placeholder="#3B82F6"
                  className="flex-1 h-9 font-mono text-sm"
                  maxLength={30}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-description">Description</Label>
              <Textarea
                id="create-description"
                placeholder="Optional description…"
                value={createForm.description ?? ''}
                onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label>House Image (optional)</Label>
              <SubjectImageUpload
                value={createImagePreview}
                onChange={url => setCreateImagePreview(url)}
                uploadImmediately={false}
                uploadRef={createImageUploadRef}
                onRemove={() => setCreateImagePreview('')}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleCreate} disabled={isCreating}>
                {isCreating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</> : 'Create House'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit House Dialog ─────────────────────────────────────────── */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md" allowOutsideClose={false}>
          <DialogHeader>
            <DialogTitle>Edit House</DialogTitle>
            <DialogDescription>Update house details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editForm.name ?? ''}
                onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-color">Colour</Label>
              <div className="flex items-center gap-2">
                <input
                  id="edit-color"
                  type="color"
                  value={editForm.color ?? '#9E9E9E'}
                  onChange={e => setEditForm(p => ({ ...p, color: e.target.value }))}
                  className="h-9 w-12 cursor-pointer rounded border border-input bg-background p-0.5"
                />
                <Input
                  value={editForm.color ?? ''}
                  onChange={e => setEditForm(p => ({ ...p, color: e.target.value }))}
                  placeholder="#3B82F6"
                  className="flex-1 h-9 font-mono text-sm"
                  maxLength={30}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description ?? ''}
                onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label>House Image</Label>
              <SubjectImageUpload
                value={editImagePreview}
                onChange={url => setEditImagePreview(url)}
                uploadImmediately={false}
                uploadRef={editImageUploadRef}
                onRemove={() => setEditImagePreview('')}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setIsEditOpen(false)} disabled={isUpdating}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleUpdate} disabled={isUpdating}>
                {isUpdating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ────────────────────────────────────────────── */}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        itemName={houseToDelete?.name ?? ''}
        itemType="house"
        bullets={[
          'All members will be removed from this house',
          'House will be soft-deleted (isActive = false)',
          'This action cannot be undone',
        ]}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
};

// ─── House Card ────────────────────────────────────────────────────────────

interface HouseCardProps {
  house: InstituteHouse;
  isAdmin: boolean;
  isEnrolled: boolean;
  isEnrolling: boolean;
  anyEnrolling: boolean;
  onView: (house: InstituteHouse) => void;
  onEdit: (house: InstituteHouse) => void;
  onDelete: (house: InstituteHouse) => void;
  onEnroll: (house: InstituteHouse) => void;
}

const HouseCard = ({
  house, isAdmin, isEnrolled, isEnrolling, anyEnrolling,
  onView, onEdit, onDelete, onEnroll,
}: HouseCardProps) => {
  const color = house.color ?? '#9E9E9E';

  // Build a subtle tinted gradient from the house colour for the header panel
  const headerStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, ${color}cc 0%, ${color} 100%)`,
  };

  return (
    <div className="relative flex flex-col rounded-xl bg-card text-card-foreground shadow-md hover:shadow-xl transition-shadow duration-200 pt-6">

      {/* ── Floating header panel (elevated above card body) ── */}
      <div className="relative mx-4 -mt-5 h-36 overflow-hidden rounded-xl shadow-lg" style={house.imageUrl ? undefined : headerStyle}>
        {house.imageUrl ? (
          <img
            src={getImageUrl(house.imageUrl)}
            alt={house.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <>
            {/* colour gradient background already set via headerStyle */}
            {/* Large initial letter watermark */}
            <span className="absolute inset-0 flex items-center justify-center text-white/20 text-8xl font-black select-none pointer-events-none">
              {house.name.charAt(0).toUpperCase()}
            </span>
          </>
        )}
        {/* Inactive badge */}
        {!house.isActive && (
          <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/40 text-white/80 backdrop-blur-sm">
            Inactive
          </span>
        )}
      </div>

      {/* ── Card body ───────────────────────────────────────── */}
      <div className="p-5 pt-4 flex-1 flex flex-col">
        <h5 className="text-base font-semibold leading-snug tracking-tight text-foreground mb-1 truncate">
          {house.name}
        </h5>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 flex-1 min-h-[2.5rem]">
          {house.description || <span className="italic opacity-50">No description</span>}
        </p>

        {/* Member count chip */}
        <div className="mt-3 flex items-center gap-1.5">
          <Badge variant="secondary" className="text-xs gap-1 font-normal">
            <Users className="h-3 w-3" />
            {house.memberCount ?? 0} members
          </Badge>
          {/* Colour dot */}
          <span
            className="inline-block h-3 w-3 rounded-full border border-black/10 flex-shrink-0"
            style={{ background: color }}
            title={color}
          />
        </div>
      </div>

      {/* ── Card footer ─────────────────────────────────────── */}
      <div className="px-5 pb-5 pt-0">
        {isAdmin ? (
          /* Admin: Edit + Delete + Select House */
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onEdit(house)}
                className="select-none rounded-lg py-2 px-3 text-center text-xs font-bold uppercase tracking-wide text-white shadow-md transition-all hover:shadow-lg hover:opacity-90 active:opacity-80 flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90"
              >
                <Edit className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={() => onDelete(house)}
                className="select-none rounded-lg py-2 px-3 text-center text-xs font-bold uppercase tracking-wide text-white shadow-md transition-all hover:shadow-lg hover:opacity-90 active:opacity-80 flex items-center justify-center gap-1.5"
                style={{
                  background: 'linear-gradient(135deg, #ef4444cc, #ef4444)',
                  boxShadow: '0 4px 10px 0 #ef444455',
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>
            <button
              onClick={() => onView(house)}
              className="w-full select-none rounded-lg py-2.5 px-6 text-center text-xs font-bold uppercase tracking-wide text-white shadow-md transition-all hover:shadow-lg hover:opacity-90 active:opacity-80 flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90"
            >
              Select House
            </button>
          </div>
        ) : isEnrolled ? (
          /* Already enrolled */
          <button
            disabled
            className="w-full select-none rounded-lg py-2.5 px-6 text-center text-xs font-bold uppercase tracking-wide text-white shadow-md bg-green-500 flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
          >
            <CheckCircle2 className="h-4 w-4" />
            Enrolled
          </button>
        ) : (
          /* Not enrolled: Enroll button */
          <button
            onClick={() => onEnroll(house)}
            disabled={isEnrolling || anyEnrolling}
            className="w-full select-none rounded-lg py-2.5 px-6 text-center text-xs font-bold uppercase tracking-wide text-white shadow-md transition-all hover:shadow-lg active:opacity-80 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 bg-primary hover:bg-primary/90"
          >
            {isEnrolling ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />Enrolling…</>
            ) : (
              'Enroll'
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default InstituteHouses;
