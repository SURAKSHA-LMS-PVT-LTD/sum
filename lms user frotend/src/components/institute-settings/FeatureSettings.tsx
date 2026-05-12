import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useFeatures } from '@/contexts/FeaturesContext';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock } from 'lucide-react';

interface CatalogFeature {
  key: string;
  label: string;
  description: string;
  scope: 'INSTITUTE' | 'CLASS' | 'SUBJECT';
  category: 'ATTENDANCE' | 'ACADEMICS' | 'PAYMENTS' | 'COMMUNICATION' | 'BRANDING' | 'TRANSPORT' | 'SERVICES';
  pricing: 'FREE' | 'PAID';
  billingCycle: string;
  isCore: boolean;
  dependencies: string[];
  isActive: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  ACADEMICS:     'Academics',
  ATTENDANCE:    'Attendance',
  PAYMENTS:      'Payments & Billing',
  COMMUNICATION: 'Communication',
  BRANDING:      'Settings & Branding',
  TRANSPORT:     'Transport',
  SERVICES:      'Admin Tools & Services',
};

const SCOPE_ORDER = ['INSTITUTE', 'CLASS', 'SUBJECT'];

export const FeatureSettings: React.FC = () => {
  const { selectedInstitute } = useAuth();
  const instituteId = selectedInstitute?.id;
  const { features, refetchFeatures } = useFeatures();
  const { toast } = useToast();

  const [catalog, setCatalog] = useState<CatalogFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      try {
        const response = await enhancedCachedClient.get<CatalogFeature[] | { data: CatalogFeature[] }>(
          '/features/catalog',
        );
        const list = Array.isArray(response) ? response : (response as any).data ?? [];
        setCatalog(list.filter((f: CatalogFeature) => f.isActive));
      } catch (error) {
        console.error('Failed to fetch feature catalog:', error);
        toast({ title: 'Error', description: 'Could not load feature catalog.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, [toast]);

  const handleToggle = (key: string, enabled: boolean) => {
    setChanges(prev => ({ ...prev, [key]: enabled }));
  };

  const handleSave = async () => {
    if (!instituteId || Object.keys(changes).length === 0) return;
    setSaving(true);
    const saved = { ...changes };
    try {
      await enhancedCachedClient.patch(
        `/institutes/${instituteId}/features`,
        { features: saved },
        { instituteId },
      );
      toast({ title: 'Success', description: 'Feature settings updated.' });
      await refetchFeatures(); // wait for fresh data before clearing optimistic state
      setChanges({});
    } catch (error) {
      console.error('Failed to save feature settings:', error);
      toast({ title: 'Error', description: 'Failed to save feature settings.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Group by scope → category
  const grouped = useMemo(() => {
    const result: Record<string, Record<string, CatalogFeature[]>> = {};
    for (const scope of SCOPE_ORDER) {
      const byScope = catalog.filter(f => f.scope === scope);
      if (byScope.length === 0) continue;
      result[scope] = {};
      for (const f of byScope) {
        const cat = f.category || 'SERVICES';
        if (!result[scope][cat]) result[scope][cat] = [];
        result[scope][cat].push(f);
      }
    }
    return result;
  }, [catalog]);

  const isEnabled = (key: string) =>
    changes[key] ?? (features[key]?.enabled ?? true);

  const isDependencyMet = (f: CatalogFeature) =>
    (f.dependencies ?? []).every(dep => isEnabled(dep));

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (catalog.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No features available.
        </CardContent>
      </Card>
    );
  }

  const SCOPE_LABELS: Record<string, string> = {
    INSTITUTE: 'Institute Level',
    CLASS: 'Class Level',
    SUBJECT: 'Subject Level',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Management</CardTitle>
        <CardDescription>Enable or disable features for your institute.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {Object.entries(grouped).map(([scope, categories]) => (
          <div key={scope}>
            <h2 className="text-base font-bold text-foreground mb-4 pb-1 border-b">
              {SCOPE_LABELS[scope] ?? scope}
            </h2>
            <div className="space-y-6">
              {Object.entries(categories).map(([category, featureList]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {CATEGORY_LABELS[category] ?? category}
                  </h3>
                  <div className="border rounded-lg divide-y">
                    {featureList.map(feature => {
                      const enabled = isEnabled(feature.key);
                      const depMet = isDependencyMet(feature);
                      const isPaid = feature.pricing === 'PAID';
                      const isCore = feature.isCore;

                      return (
                        <div key={feature.key} className="flex items-center justify-between p-3">
                          <div className="min-w-0 pr-4 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-sm">{feature.label}</p>
                              {isPaid && (
                                <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] px-1.5 py-0 gap-1">
                                  <Lock className="h-2.5 w-2.5" /> PAID
                                </Badge>
                              )}
                              {isCore && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">CORE</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{feature.description}</p>
                            {!depMet && (
                              <p className="text-xs text-amber-600 mt-0.5">
                                Requires: {feature.dependencies.join(', ')}
                              </p>
                            )}
                          </div>
                          <Switch
                            checked={enabled}
                            onCheckedChange={checked => handleToggle(feature.key, checked)}
                            disabled={isCore || !depMet}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <Button
          onClick={handleSave}
          disabled={saving || Object.keys(changes).length === 0}
          className="w-full sm:w-auto"
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Changes {Object.keys(changes).length > 0 && `(${Object.keys(changes).length})`}
        </Button>
      </CardContent>
    </Card>
  );
};
