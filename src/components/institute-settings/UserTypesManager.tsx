import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { userTypesApi, UserType, CreateUserTypePayload } from '@/api/userTypes.api';
import { PermissionMatrixEditor } from './PermissionMatrixEditor';
import {
  Plus, Pencil, Trash2, Shield, ChevronDown, ChevronUp,
  Loader2, GripVertical, Lock, RefreshCw,
} from 'lucide-react';

// Preset colors for color picker
const PRESET_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
  '#F97316', '#6366F1',
];

// Preset icons (lucide names)
const PRESET_ICONS = [
  'Shield', 'GraduationCap', 'BookOpen', 'CheckSquare',
  'Users', 'Star', 'Zap', 'Settings', 'Award', 'Briefcase',
];

export const UserTypesManager: React.FC = () => {
  const { selectedInstitute } = useAuth();
  const instituteId = selectedInstitute?.id;
  const { toast } = useToast();

  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTypeId, setExpandedTypeId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<UserType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserType | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateUserTypePayload>({
    name: '', slug: '', description: '', color: '#3B82F6', icon: 'Shield',
  });

  const load = useCallback(async (force = false) => {
    if (!instituteId) return;
    setLoading(true);
    try {
      const list = await userTypesApi.list(instituteId);
      setUserTypes(list);
    } catch {
      toast({ title: 'Error', description: 'Failed to load user types.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [instituteId, toast]);

  useEffect(() => { load(); }, [load]);

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    setForm(p => ({ ...p, name, slug }));
  };

  const handleCreate = async () => {
    if (!instituteId || !form.name.trim()) return;
    setSaving(true);
    try {
      await userTypesApi.create(instituteId, form);
      toast({ title: 'Created', description: `"${form.name}" user type created.` });
      setCreateOpen(false);
      setForm({ name: '', slug: '', description: '', color: '#3B82F6', icon: 'Shield' });
      await load(true);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Failed to create.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!instituteId || !editTarget) return;
    setSaving(true);
    try {
      await userTypesApi.update(instituteId, editTarget.id, {
        name: form.name,
        description: form.description,
        color: form.color,
        icon: form.icon,
      });
      toast({ title: 'Updated', description: `"${form.name}" updated.` });
      setEditTarget(null);
      await load(true);
    } catch {
      toast({ title: 'Error', description: 'Failed to update.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!instituteId || !deleteTarget) return;
    setSaving(true);
    try {
      await userTypesApi.remove(instituteId, deleteTarget.id);
      toast({ title: 'Deleted', description: `"${deleteTarget.name}" removed.` });
      setDeleteTarget(null);
      await load(true);
    } catch {
      toast({ title: 'Error', description: 'Failed to delete.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (ut: UserType) => {
    setForm({ name: ut.name, slug: ut.slug, description: ut.description ?? '', color: ut.color ?? '#3B82F6', icon: ut.icon ?? 'Shield' });
    setEditTarget(ut);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">User Types</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define roles for your institute. Each type has its own permission matrix.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => load(true)}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New User Type
          </Button>
        </div>
      </div>

      {/* User type cards */}
      {userTypes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No user types yet. Create one to start defining permissions.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {userTypes.map(ut => (
            <div key={ut.id} className="border rounded-xl overflow-hidden">
              {/* Card header row */}
              <div className="flex items-center gap-3 p-3 bg-card">
                {/* Color dot */}
                <div
                  className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: ut.color ?? '#6B7280' }}
                >
                  {ut.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{ut.name}</span>
                    {ut.isSystem && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                        <Lock className="h-2.5 w-2.5" /> System
                      </Badge>
                    )}
                    {!ut.isActive && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  {ut.description && (
                    <p className="text-xs text-muted-foreground truncate">{ut.description}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(ut)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {!ut.isSystem && (
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(ut)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => setExpandedTypeId(prev => prev === ut.id ? null : ut.id)}
                  >
                    {expandedTypeId === ut.id
                      ? <ChevronUp className="h-3.5 w-3.5" />
                      : <ChevronDown className="h-3.5 w-3.5" />
                    }
                  </Button>
                </div>
              </div>

              {/* Expanded: permission matrix editor */}
              {expandedTypeId === ut.id && instituteId && (
                <div className="border-t bg-muted/20 p-4">
                  <PermissionMatrixEditor
                    instituteId={instituteId}
                    userTypeId={ut.id}
                    userTypeName={ut.name}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Create Dialog ─────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create User Type</DialogTitle>
          </DialogHeader>
          <UserTypeForm form={form} setForm={setForm} onNameChange={handleNameChange} isSystem={false} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User Type</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <UserTypeForm
              form={form}
              setForm={setForm}
              onNameChange={handleNameChange}
              isSystem={editTarget.isSystem}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ─────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete User Type</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
            Users assigned this type will lose their permissions.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Shared form component used by Create + Edit dialogs ──────────
const UserTypeForm: React.FC<{
  form: CreateUserTypePayload;
  setForm: React.Dispatch<React.SetStateAction<CreateUserTypePayload>>;
  onNameChange: (name: string) => void;
  isSystem: boolean;
}> = ({ form, setForm, onNameChange, isSystem }) => (
  <div className="space-y-4 py-2">
    <div className="space-y-1.5">
      <Label>Name</Label>
      <Input
        value={form.name}
        onChange={e => onNameChange(e.target.value)}
        placeholder="e.g. Head Teacher, Lab Monitor"
        disabled={isSystem}
      />
    </div>
    <div className="space-y-1.5">
      <Label>Slug <span className="text-xs text-muted-foreground">(auto-generated)</span></Label>
      <Input value={form.slug} disabled className="font-mono text-xs" />
    </div>
    <div className="space-y-1.5">
      <Label>Description</Label>
      <Textarea
        value={form.description}
        onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
        placeholder="What can this user type do?"
        rows={2}
      />
    </div>
    <div className="space-y-1.5">
      <Label>Color</Label>
      <div className="flex gap-2 flex-wrap">
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            className={`w-7 h-7 rounded-lg border-2 transition-all ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
            style={{ backgroundColor: c }}
            onClick={() => setForm(p => ({ ...p, color: c }))}
            type="button"
          />
        ))}
      </div>
    </div>
  </div>
);
