import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { instituteSettingsApi, InstituteSettingsResponse, UpdateInstituteSettingsDto } from '@/api/instituteSettings.api';
import { ImageFieldUploader } from './ImageFieldUploader';
import { GalleryManager } from './GalleryManager';
import {
  Building2, Mail, Phone, MapPin, Globe, Facebook, Youtube,
  Eye, Target, Palette, Save, Loader2, RefreshCw
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DISTRICTS, PROVINCES, formatEnumLabel } from '@/lib/constants';
import { getErrorMessage } from '@/api/apiError';

const InstituteSettingsTab = () => {
  const { selectedInstitute, currentInstituteId } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<InstituteSettingsResponse | null>(null);
  const [form, setForm] = useState<UpdateInstituteSettingsDto>({});
  const [hasChanges, setHasChanges] = useState(false);

  const instituteId = currentInstituteId || selectedInstitute?.id;

  const fetchSettings = useCallback(async () => {
    if (!instituteId) return;
    setLoading(true);
    try {
      const data = await instituteSettingsApi.getSettings(instituteId);
      setSettings(data);
      setForm({
        name: data.name,
        shortName: data.shortName || '',
        email: data.email,
        phone: data.phone || '',
        systemContactEmail: data.systemContactEmail || '',
        systemContactPhoneNumber: data.systemContactPhoneNumber || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        country: data.country || '',
        district: data.district || '',
        province: data.province || '',
        pinCode: data.pinCode || '',
        type: data.type || '',
        primaryColorCode: data.primaryColorCode || '',
        secondaryColorCode: data.secondaryColorCode || '',
        vision: data.vision || '',
        mission: data.mission || '',
        websiteUrl: data.websiteUrl || '',
        facebookPageUrl: data.facebookPageUrl || '',
        youtubeChannelUrl: data.youtubeChannelUrl || '',
      });
      setHasChanges(false);
    } catch (error: any) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to load settings'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [instituteId, toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateField = (field: keyof UpdateInstituteSettingsDto, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!instituteId || !hasChanges) return;
    setSaving(true);
    try {
      const updated = await instituteSettingsApi.updateSettings(instituteId, form);
      setSettings(updated);
      setHasChanges(false);
      toast({ title: 'Settings saved', description: 'Institute settings updated successfully.' });
    } catch (error: any) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to save settings'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSettingsRefresh = (updated: InstituteSettingsResponse) => {
    setSettings(updated);
  };

  if (!instituteId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No institute selected</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[200px] w-full rounded-lg" />
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Save Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">{settings?.name}</h2>
          {settings?.code && (
            <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{settings.code}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchSettings} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Basic Information</CardTitle>
          <CardDescription>Core institute details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Institute Name</Label>
              <Input value={form.name || ''} onChange={e => updateField('name', e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>Short Name</Label>
              <Input value={form.shortName || ''} onChange={e => updateField('shortName', e.target.value)} maxLength={20} placeholder="e.g. CIS" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Email</Label>
              <Input type="email" value={form.email || ''} onChange={e => updateField('email', e.target.value)} maxLength={60} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Phone</Label>
              <Input value={form.phone || ''} onChange={e => updateField('phone', e.target.value)} maxLength={15} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> Institute Type</Label>
              <Input value={form.type || ''} onChange={e => updateField('type', e.target.value)} placeholder="e.g. SCHOOL" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5" /> System Contact</CardTitle>
          <CardDescription>Internal admin contact information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>System Contact Email</Label>
              <Input type="email" value={form.systemContactEmail || ''} onChange={e => updateField('systemContactEmail', e.target.value)} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>System Contact Phone</Label>
              <Input value={form.systemContactPhoneNumber || ''} onChange={e => updateField('systemContactPhoneNumber', e.target.value)} maxLength={20} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Address</Label>
            <Input value={form.address || ''} onChange={e => updateField('address', e.target.value)} maxLength={200} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city || ''} onChange={e => updateField('city', e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Input value={form.state || ''} onChange={e => updateField('state', e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label>Pin Code</Label>
              <Input value={form.pinCode || ''} onChange={e => updateField('pinCode', e.target.value)} maxLength={10} />
            </div>
            <div className="space-y-2">
              <Label>District</Label>
              <Select value={form.district || ''} onValueChange={val => updateField('district', val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent>
                  {DISTRICTS.map(d => (
                    <SelectItem key={d} value={d}>{formatEnumLabel(d)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Province</Label>
              <Select value={form.province || ''} onValueChange={val => updateField('province', val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select province" />
                </SelectTrigger>
                <SelectContent>
                  {PROVINCES.map(p => (
                    <SelectItem key={p} value={p}>{formatEnumLabel(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={form.country || ''} onChange={e => updateField('country', e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Branding</CardTitle>
          <CardDescription>Colors and visual identity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primaryColorCode || '#1976D2'}
                  onChange={e => updateField('primaryColorCode', e.target.value)}
                  className="h-10 w-12 rounded border border-input cursor-pointer"
                />
                <Input
                  value={form.primaryColorCode || ''}
                  onChange={e => updateField('primaryColorCode', e.target.value)}
                  placeholder="#1976D2"
                  maxLength={7}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Secondary Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.secondaryColorCode || '#FFC107'}
                  onChange={e => updateField('secondaryColorCode', e.target.value)}
                  className="h-10 w-12 rounded border border-input cursor-pointer"
                />
                <Input
                  value={form.secondaryColorCode || ''}
                  onChange={e => updateField('secondaryColorCode', e.target.value)}
                  placeholder="#FFC107"
                  maxLength={7}
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Image Uploaders */}
          {instituteId && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ImageFieldUploader
                  instituteId={instituteId}
                  field="logo"
                  settingsField="logoUrl"
                  currentDisplayUrl={settings?.logoUrl || null}
                  label="Institute Logo"
                  accept="image/*"
                  onUpdate={handleSettingsRefresh}
                />
                <ImageFieldUploader
                  instituteId={instituteId}
                  field="loading-gif"
                  settingsField="loadingGifUrl"
                  currentDisplayUrl={settings?.loadingGifUrl || null}
                  label="Loading Animation (GIF)"
                  accept="image/gif,image/*"
                  onUpdate={handleSettingsRefresh}
                />
              </div>
              <ImageFieldUploader
                instituteId={instituteId}
                field="cover-image"
                settingsField="imageUrl"
                currentDisplayUrl={settings?.imageUrl || null}
                label="Cover Image"
                accept="image/*"
                onUpdate={handleSettingsRefresh}
              />

              <Separator />

              <GalleryManager
                instituteId={instituteId}
                imageUrls={settings?.imageUrls || []}
                onUpdate={handleSettingsRefresh}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vision & Mission */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> Vision & Mission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> Vision</Label>
            <Textarea value={form.vision || ''} onChange={e => updateField('vision', e.target.value)} rows={3} placeholder="Institute vision statement..." />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Target className="h-3.5 w-3.5" /> Mission</Label>
            <Textarea value={form.mission || ''} onChange={e => updateField('mission', e.target.value)} rows={3} placeholder="Institute mission statement..." />
          </div>
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Social & Web Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Website</Label>
            <Input type="url" value={form.websiteUrl || ''} onChange={e => updateField('websiteUrl', e.target.value)} placeholder="https://example.com" maxLength={255} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Facebook className="h-3.5 w-3.5" /> Facebook Page</Label>
            <Input type="url" value={form.facebookPageUrl || ''} onChange={e => updateField('facebookPageUrl', e.target.value)} placeholder="https://facebook.com/..." maxLength={255} />
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Youtube className="h-3.5 w-3.5" /> YouTube Channel</Label>
            <Input type="url" value={form.youtubeChannelUrl || ''} onChange={e => updateField('youtubeChannelUrl', e.target.value)} placeholder="https://youtube.com/c/..." maxLength={255} />
          </div>
        </CardContent>
      </Card>

      {/* Bottom Save */}
      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="shadow-lg">
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
};

export default InstituteSettingsTab;
