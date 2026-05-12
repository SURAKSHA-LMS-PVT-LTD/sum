# RBAC System Admin Frontend — Institute User Types & Permission Management
## New UI screens for managing custom user types and permission matrices per institute

---

## Table of Contents

- [Part 01 — What This Document Covers](#part-01)
- [Part 02 — New Pages Overview](#part-02)
- [Part 03 — API Layer (new hooks & client calls)](#part-03)
- [Part 04 — Page: User Types Manager](#part-04)
- [Part 05 — Page: Permission Matrix Editor](#part-05)
- [Part 06 — Page: Assign User Type to a User](#part-06)
- [Part 07 — Institute Settings Integration](#part-07)
- [Part 08 — Sidebar Integration](#part-08)
- [Part 09 — AppContent Route Registration](#part-09)
- [Part 10 — Types & Shared Interfaces](#part-10)
- [Part 11 — Complete File List](#part-11)

---

<a name="part-01"></a>
## Part 01 — What This Document Covers

The RBAC backend (see `RBAC_BACKEND_IMPLEMENTATION.md`) adds:
- `GET /institutes/:id/user-types` — list all user types
- `POST /institutes/:id/user-types` — create user type
- `PATCH /institutes/:id/user-types/:typeId` — update user type
- `DELETE /institutes/:id/user-types/:typeId` — soft-delete
- `GET /institutes/:id/user-types/:typeId/permissions` — get permission matrix
- `PUT /institutes/:id/user-types/:typeId/permissions` — save permission matrix
- `PATCH /institutes/:id/users/:userId/user-type` — assign user type to user
- `GET /institutes/:id/my-context` — get calling user's type + permissions

This document specifies **every new frontend file** needed for an Institute Admin to:
1. View and manage the institute's user types (create, edit, delete, reorder)
2. Edit the permission matrix for each user type (toggle per feature per action)
3. Assign a user type to any institute user
4. See the "User Types" section appear in Institute Settings

It also covers the **minor edits** to existing files:
- `InstituteSettingsPage.tsx` — add "User Types" tab
- `Sidebar.tsx` — add "User Types" nav item under institute admin groups
- `AppContent.tsx` — register the new route pages
- `useInstituteRole.ts` — **no changes needed** (it stays as backward-compat bridge)

---

<a name="part-02"></a>
## Part 02 — New Pages Overview

| Page | Route ID | Path | Who Sees It |
|------|----------|------|-------------|
| User Types List | `user-types` | `institute-settings?tab=user-types` | Institute Admin |
| Permission Matrix Editor | inline in settings | `institute-settings?tab=user-types&typeId=42` | Institute Admin |
| Assign User Type | modal/inline on Users page | n/a (modal on existing users list) | Institute Admin |

All three live inside the existing `InstituteSettingsPage` as tabs/sub-views, so no new top-level routes are needed. The permission matrix editor opens inline when a user type row is clicked.

---

<a name="part-03"></a>
## Part 03 — API Layer

### New file: `src/api/userTypes.api.ts`

```typescript
import { enhancedCachedClient } from './enhancedCachedClient';

export interface UserType {
  id: string;
  instituteId: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  icon?: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionMatrix {
  [featureKey: string]: {
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canReport: boolean;
  };
}

export interface CreateUserTypePayload {
  name: string;
  slug: string;
  description?: string;
  color?: string;
  icon?: string;
  sortOrder?: number;
}

export interface UpdateUserTypePayload {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
  sortOrder?: number;
}

const TTL = 120; // 2 min cache for user types list

export const userTypesApi = {
  list: (instituteId: string): Promise<UserType[]> =>
    enhancedCachedClient.get<UserType[]>(
      `/institutes/${instituteId}/user-types`,
      {},
      { ttl: TTL, forceRefresh: false },
    ),

  get: (instituteId: string, typeId: string): Promise<UserType> =>
    enhancedCachedClient.get<UserType>(
      `/institutes/${instituteId}/user-types/${typeId}`,
      {},
      { ttl: TTL, forceRefresh: false },
    ),

  create: (instituteId: string, payload: CreateUserTypePayload): Promise<UserType> =>
    enhancedCachedClient.post<UserType>(
      `/institutes/${instituteId}/user-types`,
      payload,
      { instituteId },
    ),

  update: (instituteId: string, typeId: string, payload: UpdateUserTypePayload): Promise<UserType> =>
    enhancedCachedClient.patch<UserType>(
      `/institutes/${instituteId}/user-types/${typeId}`,
      payload,
      { instituteId },
    ),

  remove: (instituteId: string, typeId: string): Promise<void> =>
    enhancedCachedClient.delete(
      `/institutes/${instituteId}/user-types/${typeId}`,
      { instituteId },
    ),

  getPermissions: (instituteId: string, typeId: string): Promise<{ userTypeId: string; permissions: PermissionMatrix }> =>
    enhancedCachedClient.get(
      `/institutes/${instituteId}/user-types/${typeId}/permissions`,
      {},
      { ttl: TTL, forceRefresh: false },
    ),

  savePermissions: (
    instituteId: string,
    typeId: string,
    permissions: PermissionMatrix,
  ): Promise<{ success: boolean }> =>
    enhancedCachedClient.put(
      `/institutes/${instituteId}/user-types/${typeId}/permissions`,
      { permissions },
      { instituteId },
    ),

  assignUserType: (
    instituteId: string,
    userId: string,
    userTypeId: string,
  ): Promise<{ success: boolean }> =>
    enhancedCachedClient.patch(
      `/institutes/${instituteId}/users/${userId}/user-type`,
      { userTypeId },
      { instituteId },
    ),
};
```

---

<a name="part-04"></a>
## Part 04 — Page: User Types Manager

### New file: `src/components/institute-settings/UserTypesManager.tsx`

This is the main list view. Shows all user types as cards. Clicking a card opens the permission matrix editor inline below it.

```tsx
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
```

---

<a name="part-05"></a>
## Part 05 — Page: Permission Matrix Editor

### New file: `src/components/institute-settings/PermissionMatrixEditor.tsx`

This renders inline below any user type card when expanded. Shows all features from `FeaturesContext` grouped by scope/category with 5 toggle columns (View / Create / Update / Delete / Report).

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useFeatures } from '@/contexts/FeaturesContext';
import { userTypesApi, PermissionMatrix } from '@/api/userTypes.api';
import { Loader2, Save } from 'lucide-react';

interface PermRow {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canReport: boolean;
}

const ACTIONS: Array<{ key: keyof PermRow; label: string }> = [
  { key: 'canView',   label: 'View'   },
  { key: 'canCreate', label: 'Create' },
  { key: 'canUpdate', label: 'Update' },
  { key: 'canDelete', label: 'Delete' },
  { key: 'canReport', label: 'Report' },
];

const CATEGORY_LABELS: Record<string, string> = {
  ACADEMICS:     'Academics',
  ATTENDANCE:    'Attendance',
  PAYMENTS:      'Payments & Billing',
  COMMUNICATION: 'Communication',
  BRANDING:      'Settings & Branding',
  TRANSPORT:     'Transport',
  SERVICES:      'Admin Tools & Services',
};

interface Props {
  instituteId: string;
  userTypeId: string;
  userTypeName: string;
}

export const PermissionMatrixEditor: React.FC<Props> = ({
  instituteId, userTypeId, userTypeName,
}) => {
  const { toast } = useToast();
  const { features } = useFeatures(); // already-loaded catalog keyed by feature key

  const [matrix, setMatrix] = useState<PermissionMatrix>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await userTypesApi.getPermissions(instituteId, userTypeId);
      setMatrix(res.permissions ?? {});
      setDirty(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to load permissions.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [instituteId, userTypeId, toast]);

  useEffect(() => { load(); }, [load]);

  const toggle = (featureKey: string, action: keyof PermRow, value: boolean) => {
    setMatrix(prev => ({
      ...prev,
      [featureKey]: {
        canView: false, canCreate: false, canUpdate: false, canDelete: false, canReport: false,
        ...(prev[featureKey] ?? {}),
        [action]: value,
      },
    }));
    setDirty(true);
  };

  // Toggle entire row (all 5 actions at once)
  const toggleRow = (featureKey: string, allOn: boolean) => {
    setMatrix(prev => ({
      ...prev,
      [featureKey]: {
        canView: allOn, canCreate: allOn, canUpdate: allOn, canDelete: allOn, canReport: allOn,
      },
    }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await userTypesApi.savePermissions(instituteId, userTypeId, matrix);
      toast({ title: 'Saved', description: `Permissions updated for ${userTypeName}.` });
      setDirty(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to save permissions.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Group features by category using FeaturesContext
  // FeaturesContext gives us { [key]: { enabled, scope, pricing } }
  // We need to group by scope → category — use the feature key conventions
  // Feature keys follow pattern: "category.subfeature" so we extract category from key
  const featureKeys = Object.keys(features);
  if (featureKeys.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No features available.</p>;
  }

  // Group by first segment of feature key as "category" proxy
  // e.g. "attendance.class" → "attendance", "academics.homework" → "academics"
  const grouped: Record<string, string[]> = {};
  for (const key of featureKeys) {
    const cat = key.split('.')[0].toUpperCase();
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(key);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Permissions for <strong>{userTypeName}</strong>. Toggle each action per feature.
        </p>
        <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
          Save {dirty ? '*' : ''}
        </Button>
      </div>

      {Object.entries(grouped).map(([category, keys]) => (
        <div key={category}>
          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
            {CATEGORY_LABELS[category] ?? category}
          </h4>

          {/* Column headers */}
          <div className="border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[1fr_repeat(5,48px)] gap-0 bg-muted/40 border-b px-3 py-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground">Feature</span>
              {ACTIONS.map(a => (
                <span key={a.key} className="text-[10px] font-semibold text-muted-foreground text-center">
                  {a.label}
                </span>
              ))}
            </div>

            <div className="divide-y">
              {keys.map(featureKey => {
                const row: PermRow = {
                  canView: false, canCreate: false, canUpdate: false, canDelete: false, canReport: false,
                  ...(matrix[featureKey] ?? {}),
                };
                const allOn = ACTIONS.every(a => row[a.key]);

                return (
                  <div
                    key={featureKey}
                    className="grid grid-cols-[1fr_repeat(5,48px)] gap-0 px-3 py-2 items-center hover:bg-muted/20 transition-colors"
                  >
                    <button
                      className="text-xs text-left font-medium truncate hover:text-primary transition-colors"
                      onClick={() => toggleRow(featureKey, !allOn)}
                      title={`Click to ${allOn ? 'disable' : 'enable'} all actions`}
                    >
                      {featureKey}
                    </button>
                    {ACTIONS.map(a => (
                      <div key={a.key} className="flex justify-center">
                        <Switch
                          checked={row[a.key]}
                          onCheckedChange={v => toggle(featureKey, a.key, v)}
                          className="scale-75"
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      {/* Sticky save bar when dirty */}
      {dirty && (
        <div className="sticky bottom-0 bg-background border-t pt-3 flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Permissions
          </Button>
        </div>
      )}
    </div>
  );
};
```

---

<a name="part-06"></a>
## Part 06 — Assign User Type to a User

### New file: `src/components/users/AssignUserTypeDialog.tsx`

This dialog is opened from the existing Users list page when an admin wants to change a user's type.

```tsx
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { userTypesApi, UserType } from '@/api/userTypes.api';
import { Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  currentUserTypeId?: string;
  onAssigned?: () => void;
}

export const AssignUserTypeDialog: React.FC<Props> = ({
  open, onClose, userId, userName, currentUserTypeId, onAssigned,
}) => {
  const { selectedInstitute } = useAuth();
  const instituteId = selectedInstitute?.id;
  const { toast } = useToast();

  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [selected, setSelected] = useState<string>(currentUserTypeId ?? '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !instituteId) return;
    setLoading(true);
    userTypesApi.list(instituteId)
      .then(list => { setUserTypes(list); setSelected(currentUserTypeId ?? ''); })
      .catch(() => toast({ title: 'Error', description: 'Failed to load user types.', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [open, instituteId, currentUserTypeId, toast]);

  const handleSave = async () => {
    if (!instituteId || !selected) return;
    setSaving(true);
    try {
      await userTypesApi.assignUserType(instituteId, userId, selected);
      toast({ title: 'Updated', description: `User type assigned to ${userName}.` });
      onAssigned?.();
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to assign user type.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign User Type</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-1.5 py-2">
            <p className="text-sm text-muted-foreground mb-3">
              Select a user type for <strong>{userName}</strong>:
            </p>
            {userTypes.map(ut => (
              <button
                key={ut.id}
                onClick={() => setSelected(ut.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all',
                  selected === ut.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/40',
                )}
              >
                <div
                  className="w-7 h-7 rounded-md flex-shrink-0 flex items-center justify-center text-white text-[11px] font-bold"
                  style={{ backgroundColor: ut.color ?? '#6B7280' }}
                >
                  {ut.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{ut.name}</p>
                  {ut.description && (
                    <p className="text-[11px] text-muted-foreground truncate">{ut.description}</p>
                  )}
                </div>
                {selected === ut.id && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
              </button>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !selected || selected === currentUserTypeId}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

---

<a name="part-07"></a>
## Part 07 — Institute Settings Integration

### Edit: `src/pages/InstituteSettingsPage.tsx`

**Three changes needed:**

#### Change 1 — Add `user-types` to `VALID_TABS`

Find:
```typescript
const VALID_TABS = ['basic', 'branding', 'tenant', 'location', 'about', 'online', 'sms', 'integrations', 'user-columns', 'session-limits', 'features'];
```

Replace with:
```typescript
const VALID_TABS = ['basic', 'branding', 'tenant', 'location', 'about', 'online', 'sms', 'integrations', 'user-columns', 'session-limits', 'features', 'user-types'];
```

#### Change 2 — Add entry to `SECTION_ITEMS` array

After the `features` entry, add:
```typescript
{ id: 'user-types', label: 'User Types & Permissions', description: 'Manage roles and access control', icon: Shield, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
```

Also add `Shield` to the existing lucide import line.

#### Change 3 — Add tab content render

Find the block that renders the `features` tab content (search for `tab === 'features'`) and add a new block right after it:

```tsx
{activeTab === 'user-types' && isInstituteAdmin && (
  <UserTypesManager />
)}
```

Also add this import at the top of the file:
```typescript
import { UserTypesManager } from '@/components/institute-settings/UserTypesManager';
```

---

<a name="part-08"></a>
## Part 08 — Sidebar Integration

### Edit: `src/components/layout/Sidebar.tsx`

The sidebar already has an `InstituteAdmin` nav group. Find the section where `institute-settings` appears in the admin group (around line 440+ where the admin account section is built) and add a `user-types` nav item pointing to `institute-settings?tab=user-types`.

**Approach:** The sidebar navigates by `itemId` via `buildSidebarUrl()`. The cleanest way is to add a dedicated `user-types` item that navigates to `institute-settings?tab=user-types`.

Find the `InstituteAdmin` nav group construction. It includes a block like:

```tsx
{ id: 'institute-settings', label: 'Institute Settings', icon: Settings, alwaysShow: true }
```

After the `institute-settings` item (still inside the admin group), add:

```tsx
...(selectedInstitute ? [{
  id: 'user-types',
  label: 'User Types',
  icon: Shield,
  permission: 'edit-institute-details',
}] : []),
```

Then in `handleItemClick`, add a case for `user-types`:

```typescript
if (itemId === 'user-types') {
  navigate(`/institute/${selectedInstitute?.id}/class/${selectedClass?.id ?? 0}/institute-settings?tab=user-types`);
  onClose();
  return;
}
```

Also add `Shield` to the lucide imports (it's already imported in the sidebar — verify before adding).

---

<a name="part-09"></a>
## Part 09 — AppContent Route Registration

### Edit: `src/components/AppContent.tsx`

No new top-level pages are needed — all RBAC admin UI lives inside `InstituteSettingsPage` which is already registered. The `user-types` tab renders there.

However, if the `AssignUserTypeDialog` needs to be wired into an existing Users page, add the import there. No change to `AppContent.tsx` needed for the dialog — it's imported directly in whatever user list component calls it.

---

<a name="part-10"></a>
## Part 10 — Types & Shared Interfaces

### New file: `src/types/rbac.types.ts`

Central types file consumed by hooks and components.

```typescript
export interface UserType {
  id: string;
  instituteId: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  icon?: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionRow {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canReport: boolean;
}

export interface PermissionMatrix {
  [featureKey: string]: PermissionRow;
}

export interface UserRbacContext {
  userTypeId: string | null;
  userTypeName: string | null;
  userTypeSlug: string | null;
  userTypeColor: string | null;
  userTypeIcon: string | null;
  permissions: PermissionMatrix;
  legacyUserType: string | null;   // old enum value — read only for backward compat
}
```

### New hook: `src/hooks/useMyRbacContext.ts`

Fetches and caches the calling user's RBAC context for a given institute. The frontend calls this once after login and stores the result.

```typescript
import { useState, useEffect, useCallback } from 'react';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { useAuth } from '@/contexts/AuthContext';
import { UserRbacContext, PermissionMatrix } from '@/types/rbac.types';

interface UseMyRbacContextResult {
  context: UserRbacContext | null;
  loading: boolean;
  refetch: () => Promise<void>;
  can: (featureKey: string, action: 'view' | 'create' | 'update' | 'delete' | 'report') => boolean;
}

const ACTION_MAP = {
  view:   'canView',
  create: 'canCreate',
  update: 'canUpdate',
  delete: 'canDelete',
  report: 'canReport',
} as const;

export const useMyRbacContext = (): UseMyRbacContextResult => {
  const { selectedInstitute } = useAuth();
  const instituteId = selectedInstitute?.id;

  const [context, setContext] = useState<UserRbacContext | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (force = false) => {
    if (!instituteId) { setContext(null); return; }
    setLoading(true);
    try {
      const res = await enhancedCachedClient.get<UserRbacContext>(
        `/institutes/${instituteId}/my-context`,
        {},
        { ttl: 300, forceRefresh: force },
      );
      setContext(res);
    } catch {
      setContext(null);
    } finally {
      setLoading(false);
    }
  }, [instituteId]);

  useEffect(() => { fetch(); }, [fetch]);

  const can = useCallback(
    (featureKey: string, action: keyof typeof ACTION_MAP): boolean => {
      if (!context || loading) return true; // permissive while loading
      const row = context.permissions[featureKey];
      if (!row) return false;               // no explicit permission = deny
      return !!row[ACTION_MAP[action]];
    },
    [context, loading],
  );

  return {
    context,
    loading,
    refetch: () => fetch(true),
    can,
  };
};
```

### New hook: `src/hooks/usePermission.ts`

Thin wrapper over `useMyRbacContext` — the primary hook for all per-component permission checks. Replaces `AccessControl.hasPermission()` and `useInstituteRole()` checks everywhere.

```typescript
import { useMyRbacContext } from './useMyRbacContext';

type Action = 'view' | 'create' | 'update' | 'delete' | 'report';

interface PermissionResult {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canReport: boolean;
  loading: boolean;
}

export const usePermission = (featureKey: string): PermissionResult => {
  const { context, loading, can } = useMyRbacContext();

  if (loading || !context) {
    // While loading — show everything (avoids flicker of "no access")
    return { canView: true, canCreate: true, canUpdate: true, canDelete: true, canReport: true, loading: true };
  }

  return {
    canView:   can(featureKey, 'view'),
    canCreate: can(featureKey, 'create'),
    canUpdate: can(featureKey, 'update'),
    canDelete: can(featureKey, 'delete'),
    canReport: can(featureKey, 'report'),
    loading: false,
  };
};
```

**Usage in any component:**

```tsx
// Before (old hardcoded check):
const role = useInstituteRole();
if (role === 'Teacher' || role === 'InstituteAdmin') {
  // show create button
}

// After (RBAC):
const { canCreate } = usePermission('academics.homework');
if (canCreate) {
  // show create button
}
```

---

<a name="part-11"></a>
## Part 11 — Complete File List

### New files to create

```
src/
  api/
    userTypes.api.ts                         ← All RBAC API calls
  types/
    rbac.types.ts                            ← Shared interfaces
  hooks/
    useMyRbacContext.ts                      ← Fetches /my-context, provides can()
    usePermission.ts                         ← Per-component permission hook
  components/
    institute-settings/
      UserTypesManager.tsx                   ← User types list + create/edit/delete
      PermissionMatrixEditor.tsx             ← Per-type feature × action toggle grid
    users/
      AssignUserTypeDialog.tsx               ← Dialog to change a user's type
```

### Existing files to edit

| File | What changes |
|------|-------------|
| `src/pages/InstituteSettingsPage.tsx` | Add `user-types` to `VALID_TABS`, add to `SECTION_ITEMS`, render `<UserTypesManager />` for that tab |
| `src/components/layout/Sidebar.tsx` | Add `user-types` nav item in the InstituteAdmin nav group |
| `src/components/AppContent.tsx` | No change needed (settings page already registered) |

### Files NOT changed

| File | Why untouched |
|------|--------------|
| `src/hooks/useInstituteRole.ts` | Kept as-is for backward compat; old checks still work during transition |
| `src/utils/permissions.ts` | Kept as-is; `AccessControl` still compiles and works |
| `src/contexts/FeaturesContext.tsx` | Not changed; `PermissionMatrixEditor` reads from it to list features |
| `src/contexts/AuthContext.tsx` | Not changed in this PR; `my-context` result stored locally in hook |

---

## Summary

This adds a full self-service RBAC admin UI inside **Institute Settings → User Types & Permissions**:

1. **List view** — all user types as cards with color dots, system/inactive badges
2. **Create dialog** — name, auto-slug, description, color picker
3. **Edit dialog** — same form, name/slug locked for system types
4. **Permission matrix** — expands inline below each card; 5 toggle columns × all features; save button turns active only when dirty
5. **Assign dialog** — drop-in dialog for any user list component; shows all types with color, selects current type by default
6. **`usePermission` hook** — replaces `AccessControl.hasPermission()` everywhere; safe during transition because it falls back to permissive while loading

The `useInstituteRole` hook and `AccessControl` class are **not deleted** — they continue working for the rest of the codebase during the gradual migration described in `RBAC_FRONTEND_IMPLEMENTATION.md`.
