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
