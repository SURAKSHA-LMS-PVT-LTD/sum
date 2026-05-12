import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useFeatures } from '@/contexts/FeaturesContext';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock } from 'lucide-react';

interface FeatureSetting {
  key: string;
  label: string;
  description: string;
  scope: 'INSTITUTE' | 'CLASS' | 'SUBJECT';
  pricing: 'FREE' | 'PAID';
}

interface FeatureSettingsProps {
  // No props needed for now
}

export const FeatureSettings: React.FC<FeatureSettingsProps> = () => {
  const { currentInstituteId } = useAuth();
  const { features, refetchFeatures } = useFeatures();
  const { toast } = useToast();

  const [catalog, setCatalog] = useState<FeatureSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      try {
        // As per the backend plan, this endpoint provides the full catalog
        const response = await enhancedCachedClient.get<{ data: FeatureSetting[] }>('/features/catalog');
        setCatalog(response.data || []);
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
    if (!currentInstituteId || Object.keys(changes).length === 0) return;

    setSaving(true);
    try {
      await enhancedCachedClient.patch(
        `/institutes/${currentInstituteId}/features`,
        { features: changes },
        { instituteId: currentInstituteId }
      );
      toast({ title: 'Success', description: 'Feature settings updated.' });
      setChanges({});
      refetchFeatures(); // This will trigger a re-fetch in the FeaturesContext
    } catch (error) {
      console.error('Failed to save feature settings:', error);
      toast({ title: 'Error', description: 'Failed to save feature settings.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const groupedFeatures = useMemo(() => {
    return catalog.reduce((acc, feature) => {
      if (!acc[feature.scope]) {
        acc[feature.scope] = [];
      }
      acc[feature.scope].push(feature);
      return acc;
    }, {} as Record<string, FeatureSetting[]>);
  }, [catalog]);

  const renderFeatureList = (scope: 'INSTITUTE' | 'CLASS' | 'SUBJECT') => {
    const featureList = groupedFeatures[scope] || [];
    if (featureList.length === 0) {
      return <p className="text-sm text-muted-foreground">No features available for this scope.</p>;
    }

    return featureList.map(feature => {
      const isEnabled = changes[feature.key] ?? features[feature.key]?.enabled ?? false;
      const isPaid = feature.pricing === 'PAID';

      return (
        <div key={feature.key} className="flex items-center justify-between p-3 border-b last:border-b-0">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{feature.label}</p>
              {isPaid && <Lock className="h-3 w-3 text-amber-500" />}
            </div>
            <p className="text-xs text-muted-foreground">{feature.description}</p>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={(checked) => handleToggle(feature.key, checked)}
          />
        </div>
      );
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Management</CardTitle>
        <CardDescription>Enable or disable features for your institute.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-2">Institute Features</h3>
          <div className="border rounded-lg">
            {renderFeatureList('INSTITUTE')}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Class Features</h3>
          <div className="border rounded-lg">
            {renderFeatureList('CLASS')}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Subject Features</h3>
          <div className="border rounded-lg">
            {renderFeatureList('SUBJECT')}
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || Object.keys(changes).length === 0}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
};
