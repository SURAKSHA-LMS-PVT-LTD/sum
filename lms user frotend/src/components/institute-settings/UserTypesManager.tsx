import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { userTypesApi, UserType } from '@/api/userTypes.api';
import {
  Plus, Trash2, Edit2, Save, Loader2, Shield, Users, Lock,
  Eye, FilePen, Pencil, BarChart2, Check, Upload,
  Building2, BookOpen, FileText,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface CatalogFeature {
  key: string;
  label: string;
  description: string;
  category: string;
  scope: string;
  isCore: boolean;
  isActive: boolean;
}

interface PermissionRow {
  featureKey: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canReport: boolean;
  canSubmit: boolean;
}

type PermissionMap = Record<string, PermissionRow>; // featureKey → row

// action → { label, icon, color }
const ACTIONS = [
  { key: 'canView',   label: 'View',   Icon: Eye,      color: 'text-blue-600'  },
  { key: 'canCreate', label: 'Create', Icon: FilePen,  color: 'text-green-600' },
  { key: 'canUpdate', label: 'Edit',   Icon: Pencil,   color: 'text-amber-600' },
  { key: 'canDelete', label: 'Delete', Icon: Trash2,   color: 'text-red-600'   },
  { key: 'canReport', label: 'Report',  Icon: BarChart2,   color: 'text-purple-600' },
  { key: 'canSubmit', label: 'Submit',  Icon: Upload,      color: 'text-orange-600' },
] as const;

type ActionKey = typeof ACTIONS[number]['key'];

const SCOPE_CONFIG = [
  { scope: 'INSTITUTE', label: 'Institute Level', Icon: Building2, description: 'Permissions that apply across the whole institute' },
  { scope: 'CLASS',     label: 'Class Level',     Icon: BookOpen,  description: 'Permissions within individual classes' },
  { scope: 'SUBJECT',   label: 'Subject Level',   Icon: FileText,  description: 'Permissions within individual subjects' },
] as const;

const CATEGORY_ORDER = ['ACADEMICS', 'ATTENDANCE', 'PAYMENTS', 'COMMUNICATION', 'TRANSPORT', 'SERVICES', 'BRANDING'];
const CATEGORY_LABELS: Record<string, string> = {
  ACADEMICS: 'Academics', ATTENDANCE: 'Attendance', PAYMENTS: 'Payments',
  COMMUNICATION: 'Communication', TRANSPORT: 'Transport', SERVICES: 'Admin Tools', BRANDING: 'Settings',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function initRow(featureKey: string): PermissionRow {
  return { featureKey, canView: false, canCreate: false, canUpdate: false, canDelete: false, canReport: false, canSubmit: false };
}

function emptyPermMap(features: CatalogFeature[]): PermissionMap {
  const m: PermissionMap = {};
  features.forEach(f => { m[f.key] = initRow(f.key); });
  return m;
}

function applyServerPermissions(base: PermissionMap, rows: PermissionRow[]): PermissionMap {
  const m = { ...base };
  rows.forEach(r => { m[r.featureKey] = { ...r }; });
  return m;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const UserTypesManager: React.FC = () => {
  const { selectedInstitute } = useAuth();
  const instituteId = selectedInstitute?.id;
  const { toast } = useToast();

  // ── State ──────────────────────────────────────────────────────────────────
  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [features, setFeatures] = useState<CatalogFeature[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  // permissions per userTypeId
  const [permissionsMap, setPermissionsMap] = useState<Record<string, PermissionMap>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(true);
  const [savingTypeId, setSavingTypeId] = useState<string | null>(null);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<UserType | null>(null);
  const [form, setForm] = useState({ name: '', namePlural: '', description: '', color: '#6366f1', isPublic: true });
  const [formSaving, setFormSaving] = useState(false);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!instituteId) return;
    setLoading(true);
    try {
      const [typesRes, catalogRes] = await Promise.all([
        userTypesApi.list(instituteId),
        enhancedCachedClient.get<CatalogFeature[] | { data: CatalogFeature[] }>('/features/catalog'),
      ]);

      const catalog: CatalogFeature[] = Array.isArray(catalogRes)
        ? catalogRes
        : (catalogRes as any)?.data ?? [];

      const activeFeatures = catalog.filter(f => f.isActive);
      setFeatures(activeFeatures);
      setUserTypes(typesRes);

      if (typesRes.length > 0 && !selectedTypeId) {
        setSelectedTypeId(typesRes[0].id);
      }
    } catch {
      toast({ title: 'Error', description: 'Could not load user types', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [instituteId, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load permissions for a type when selected
  useEffect(() => {
    if (!selectedTypeId || !instituteId || !features.length) return;
    if (permissionsMap[selectedTypeId]) return; // already loaded

    const load = async () => {
      try {
        const rows = await enhancedCachedClient.get<PermissionRow[]>(
          `/institutes/${instituteId}/user-types/${selectedTypeId}/permissions`,
        );
        const base = emptyPermMap(features);
        setPermissionsMap(prev => ({
          ...prev,
          [selectedTypeId]: applyServerPermissions(base, rows ?? []),
        }));
      } catch {
        // on error init empty
        setPermissionsMap(prev => ({
          ...prev,
          [selectedTypeId]: emptyPermMap(features),
        }));
      }
    };
    load();
  }, [selectedTypeId, instituteId, features, permissionsMap]);

  // ── Permission toggle ──────────────────────────────────────────────────────

  const handleToggle = (typeId: string, featureKey: string, action: ActionKey) => {
    setPermissionsMap(prev => {
      const typeMap = prev[typeId] ?? emptyPermMap(features);
      const row = typeMap[featureKey] ?? initRow(featureKey);
      return {
        ...prev,
        [typeId]: {
          ...typeMap,
          [featureKey]: { ...row, [action]: !row[action] },
        },
      };
    });
    setDirty(prev => ({ ...prev, [typeId]: true }));
  };

  const handleToggleAll = (typeId: string, featureKey: string, enable: boolean) => {
    setPermissionsMap(prev => {
      const typeMap = prev[typeId] ?? emptyPermMap(features);
      const row = typeMap[featureKey] ?? initRow(featureKey);
      return {
        ...prev,
        [typeId]: {
          ...typeMap,
          [featureKey]: {
            ...row,
            canView: enable,
            canCreate: enable,
            canUpdate: enable,
            canDelete: enable,
            canReport: enable,
            canSubmit: enable,
          },
        },
      };
    });
    setDirty(prev => ({ ...prev, [typeId]: true }));
  };

  // ── Save permissions ───────────────────────────────────────────────────────

  const handleSave = async (typeId: string) => {
    if (!instituteId) return;
    const map = permissionsMap[typeId];
    if (!map) return;

    setSavingTypeId(typeId);
    try {
      const permissions = Object.values(map);
      await enhancedCachedClient.patch(
        `/institutes/${instituteId}/user-types/${typeId}/permissions`,
        { permissions },
        { instituteId },
      );
      setDirty(prev => ({ ...prev, [typeId]: false }));
      toast({ title: 'Permissions saved' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save permissions', variant: 'destructive' });
    } finally {
      setSavingTypeId(null);
    }
  };

  // ── Create / Edit ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingType(null);
    setForm({ name: '', namePlural: '', description: '', color: '#6366f1', isPublic: true });
    setDialogOpen(true);
  };

  const openEdit = (ut: UserType) => {
    setEditingType(ut);
    setForm({ name: ut.name, namePlural: ut.namePlural ?? '', description: ut.description ?? '', color: ut.color ?? '#6366f1', isPublic: ut.isPublic });
    setDialogOpen(true);
  };

  const refreshUserTypes = useCallback(async (selectId?: string) => {
    if (!instituteId) return;
    const fresh = await userTypesApi.listFresh(instituteId);
    setUserTypes(fresh);
    if (selectId) setSelectedTypeId(selectId);
  }, [instituteId]);

  const handleFormSave = async () => {
    if (!instituteId || !form.name.trim()) return;
    setFormSaving(true);
    try {
      if (editingType) {
        await userTypesApi.update(editingType.id, {
          name: form.name,
          namePlural: form.namePlural || form.name + 's',
          description: form.description,
          color: form.color,
          isPublic: form.isPublic,
        });
        toast({ title: 'User type updated' });
        await refreshUserTypes();
      } else {
        const created = await userTypesApi.create(instituteId, {
          name: form.name,
          namePlural: form.namePlural || form.name + 's',
          description: form.description,
          color: form.color,
          isPublic: form.isPublic,
        });
        toast({ title: 'User type created' });
        await refreshUserTypes(created.id);
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message ?? 'Failed to save', variant: 'destructive' });
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (ut: UserType) => {
    if (!instituteId || ut.isSystemType) return;
    if (!confirm(`Delete "${ut.name}"? This cannot be undone.`)) return;
    try {
      await userTypesApi.delete(ut.id);
      toast({ title: 'User type deleted' });
      const nextId = userTypes.find(t => t.id !== ut.id)?.id ?? null;
      if (selectedTypeId === ut.id) setSelectedTypeId(nextId);
      await refreshUserTypes();
    } catch {
      toast({ title: 'Error', description: 'Could not delete user type', variant: 'destructive' });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedType = userTypes.find(t => t.id === selectedTypeId);
  const permMap = selectedTypeId ? (permissionsMap[selectedTypeId] ?? {}) : {};
  const isDirty = selectedTypeId ? !!dirty[selectedTypeId] : false;

  // Group features by scope → category
  const groupedByScope: Record<string, Record<string, CatalogFeature[]>> = {};
  for (const f of features) {
    const scope = f.scope || 'INSTITUTE';
    const cat = f.category || 'SERVICES';
    if (!groupedByScope[scope]) groupedByScope[scope] = {};
    if (!groupedByScope[scope][cat]) groupedByScope[scope][cat] = [];
    groupedByScope[scope][cat].push(f);
  }

  // Track which scope sections are expanded in the permission matrix
  // (stored outside render so it survives re-renders — use state defined above)

  return (
    <TooltipProvider>
      <div className="space-y-6">

        {/* ── Header ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  User Types & Permissions
                </CardTitle>
                <CardDescription className="mt-1">
                  Manage who can do what. Select a user type then toggle permissions per feature.
                </CardDescription>
              </div>
              <Button onClick={openCreate} size="sm">
                <Plus className="h-4 w-4 mr-1.5" /> New User Type
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">

          {/* ── Left: user type list ── */}
          <div className="space-y-2">
            {userTypes.length === 0 && (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground text-sm">
                  No user types yet.
                </CardContent>
              </Card>
            )}
            {userTypes.map(ut => (
              <div
                key={ut.id}
                onClick={() => setSelectedTypeId(ut.id)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                  selectedTypeId === ut.id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: ut.color ?? '#6366f1' }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{ut.name}</p>
                    {ut.isSystemType && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" /> System
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {dirty[ut.id] && (
                    <span className="w-2 h-2 rounded-full bg-amber-500" title="Unsaved changes" />
                  )}
                  <Button
                    variant="ghost" size="icon"
                    className="h-6 w-6"
                    onClick={e => { e.stopPropagation(); openEdit(ut); }}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  {!ut.isSystemType && (
                    <Button
                      variant="ghost" size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={e => { e.stopPropagation(); handleDelete(ut); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ── Right: permission matrix ── */}
          {selectedType ? (
            <Card className="overflow-hidden">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: selectedType.color ?? '#6366f1' }}
                    />
                    <CardTitle className="text-base">{selectedType.name} — Permissions</CardTitle>
                    {selectedType.isSystemType && (
                      <Badge variant="secondary" className="text-[10px]">System</Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSave(selectedType.id)}
                    disabled={!isDirty || savingTypeId === selectedType.id}
                  >
                    {savingTypeId === selectedType.id
                      ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      : <Save className="h-4 w-4 mr-1.5" />}
                    Save {isDirty ? '(unsaved)' : ''}
                  </Button>
                </div>

                {/* Action legend */}
                <div className="flex flex-wrap gap-3 mt-2">
                  {ACTIONS.map(a => (
                    <span key={a.key} className={`flex items-center gap-1 text-xs ${a.color}`}>
                      <a.Icon className="h-3 w-3" /> {a.label}
                    </span>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {/* Sticky column header */}
                <div className="grid grid-cols-[1fr_repeat(5,40px)] gap-0 px-4 py-2 bg-muted/40 border-b sticky top-0 z-10">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">Feature</div>
                  {ACTIONS.map(a => (
                    <Tooltip key={a.key}>
                      <TooltipTrigger asChild>
                        <div className={`flex justify-center items-center ${a.color}`}>
                          <a.Icon className="h-3.5 w-3.5" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{a.label}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>

                <div className="overflow-y-auto max-h-[60vh]">
                  {SCOPE_CONFIG.map(({ scope, label: scopeLabel, Icon: ScopeIcon }) => {
                    const scopeGroups = groupedByScope[scope];
                    if (!scopeGroups) return null;
                    const cats = CATEGORY_ORDER.filter(c => scopeGroups[c]?.length);
                    if (!cats.length) return null;
                    return (
                      <div key={scope}>
                        {/* Scope section header */}
                        <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border-b border-t">
                          <ScopeIcon className="h-3.5 w-3.5 text-primary" />
                          <p className="text-xs font-bold text-primary uppercase tracking-wide">{scopeLabel}</p>
                        </div>

                        {cats.map(cat => (
                          <div key={cat}>
                            {/* Category sub-header */}
                            <div className="px-4 py-1.5 bg-muted/20 border-b border-t">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {CATEGORY_LABELS[cat] ?? cat}
                              </p>
                            </div>

                            {/* Feature rows */}
                            {(scopeGroups[cat] ?? []).map((feat: CatalogFeature, idx: number) => {
                              const row = permMap[feat.key] ?? initRow(feat.key);
                              const allOn = ACTIONS.every(a => row[a.key]);
                              return (
                                <div
                                  key={feat.key}
                                  className={`grid grid-cols-[1fr_repeat(5,40px)] gap-0 px-4 py-2 items-center border-b last:border-b-0 ${
                                    idx % 2 === 0 ? '' : 'bg-muted/10'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0 pr-2">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          className={`w-4 h-4 flex-shrink-0 rounded flex items-center justify-center border transition-colors ${
                                            allOn
                                              ? 'bg-primary border-primary text-primary-foreground'
                                              : 'border-border hover:border-primary'
                                          }`}
                                          onClick={() => handleToggleAll(selectedType.id, feat.key, !allOn)}
                                        >
                                          {allOn && <Check className="h-2.5 w-2.5" />}
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>{allOn ? 'Remove all' : 'Grant all'}</TooltipContent>
                                    </Tooltip>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium truncate">{feat.label}</p>
                                      <p className="text-[10px] text-muted-foreground truncate">{feat.key}</p>
                                    </div>
                                  </div>

                                  {ACTIONS.map(action => (
                                    <div key={action.key} className="flex justify-center">
                                      <Switch
                                        checked={row[action.key]}
                                        onCheckedChange={() => handleToggle(selectedType.id, feat.key, action.key)}
                                        className="scale-75"
                                      />
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground text-sm">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                Select a user type to manage its permissions
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Create / Edit dialog ── */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{editingType ? 'Edit User Type' : 'New User Type'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Lab Assistant"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Plural name</Label>
                <Input
                  value={form.namePlural}
                  onChange={e => setForm(f => ({ ...f, namePlural: e.target.value }))}
                  placeholder="e.g. Lab Assistants"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    className="h-9 w-12 rounded border cursor-pointer"
                  />
                  <Input
                    value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Visible in enrolment forms</Label>
                  <p className="text-xs text-muted-foreground">Show this type in public sign-up</p>
                </div>
                <Switch
                  checked={form.isPublic}
                  onCheckedChange={v => setForm(f => ({ ...f, isPublic: v }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleFormSave} disabled={formSaving || !form.name.trim()}>
                {formSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                {editingType ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};
