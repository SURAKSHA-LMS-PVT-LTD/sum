import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useFeatures } from '@/contexts/FeaturesContext';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock } from 'lucide-react';
import { FEATURE_KEYS } from '@/config/feature-keys';

interface FeatureSetting {
  key: string;
  label: string;
  description: string;
  scope: 'INSTITUTE' | 'CLASS' | 'SUBJECT';
  pricing: 'FREE' | 'PAID';
  group: string;
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
      const group = feature.group || 'Other';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(feature);
      return acc;
    }, {} as Record<string, FeatureSetting[]>);
  }, [catalog]);

  const renderFeatureGroup = (groupName: string, featureList: FeatureSetting[]) => {
    return (
      <div key={groupName}>
        <h3 className="text-lg font-semibold mb-2">{groupName}</h3>
        <div className="border rounded-lg">
          {featureList.map(feature => {
            const isEnabled = changes[feature.key] ?? features[feature.key]?.enabled ?? false;
            const isPaid = feature.pricing === 'PAID';

            // Dependency checks
            let isDisabled = false;
            let disabledReason = '';

            if (feature.key === FEATURE_KEYS.QR_ATTENDANCE || feature.key === FEATURE_KEYS.RFID_ATTENDANCE) {
              if (!features[FEATURE_KEYS.SELECT_ATTENDANCE_MARK_TYPE]?.enabled) {
                isDisabled = true;
                disabledReason = `Requires '${FEATURE_KEYS.SELECT_ATTENDANCE_MARK_TYPE}' to be enabled.`;
              }
            }

            if (feature.key === FEATURE_KEYS.LECTURE_LIVE_ATTENDANCE || feature.key === FEATURE_KEYS.LECTURE_RECORDING_ATTENDANCE) {
              if (!features[FEATURE_KEYS.LECTURES]?.enabled) {
                isDisabled = true;
                disabledReason = `Requires '${FEATURE_KEYS.LECTURES}' to be enabled.`;
              }
            }
            
            if (feature.key === FEATURE_KEYS.CUSTOM_DOMAIN || feature.key === FEATURE_KEYS.SUBDOMAIN || feature.key === FEATURE_KEYS.VIDEO_BACKGROUND) {
              if (!features[FEATURE_KEYS.LOGIN_BRANDING]?.enabled) {
                isDisabled = true;
                disabledReason = `Requires '${FEATURE_KEYS.LOGIN_BRANDING}' to be enabled.`;
              }
            }

            return (
              <div key={feature.key} className="flex items-center justify-between p-3 border-b last:border-b-0">
                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{feature.label}</p>
                    {isPaid && <Lock className="h-3 w-3 text-amber-500" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                  {isDisabled && <p className="text-xs text-red-500">{disabledReason}</p>}
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => handleToggle(feature.key, checked)}
                  disabled={isDisabled}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

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
        {Object.entries(groupedFeatures).map(([groupName, featureList]) => renderFeatureGroup(groupName, featureList))}
        <Button onClick={handleSave} disabled={saving || Object.keys(changes).length === 0}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
};
