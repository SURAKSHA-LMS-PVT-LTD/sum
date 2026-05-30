import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { enhancedCachedClient } from '@/api/enhancedCachedClient';
import { Loader2 } from 'lucide-react';
import { getErrorMessage } from '@/api/apiError';

export interface InstituteUpdateData {
  name?: string;
  shortName?: string;
  code?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  district?: string;
  province?: string;
  country?: string;
  pinCode?: string;
  vision?: string;
  mission?: string;
  description?: string;
  websiteUrl?: string;
  facebookPageUrl?: string;
  youtubeChannelUrl?: string;
  primaryColorCode?: string;
  secondaryColorCode?: string;
}

interface UpdateInstituteFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instituteId: string;
  currentData: InstituteUpdateData;
  onSuccess: () => void;
}

const UpdateInstituteForm = ({ open, onOpenChange, instituteId, currentData, onSuccess }: UpdateInstituteFormProps) => {
  const [formData, setFormData] = useState<InstituteUpdateData>(currentData);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleChange = (field: keyof InstituteUpdateData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      // Only send changed fields
      const changes: Record<string, string> = {};
      for (const [key, value] of Object.entries(formData)) {
        if (value !== undefined && value !== (currentData as any)[key]) {
          changes[key] = value;
        }
      }

      if (Object.keys(changes).length === 0) {
        toast({ title: 'No changes', description: 'No fields were modified.' });
        setSaving(false);
        return;
      }

      await enhancedCachedClient.patch(`/institutes/${instituteId}`, changes, { instituteId });

      toast({ title: 'Success', description: 'Institute updated successfully.' });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to update institute:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to update institute.'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} routeName="update-institute-form-popup">
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Institute</DialogTitle>
          <DialogDescription>Edit your institute information. Only changed fields will be saved.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="location">Location</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="online">Online</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Institute Name</Label>
                <Input id="name" value={formData.name || ''} onChange={e => handleChange('name', e.target.value)} maxLength={255} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shortName">Short Name</Label>
                <Input id="shortName" value={formData.shortName || ''} onChange={e => handleChange('shortName', e.target.value)} maxLength={50} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input id="code" value={formData.code || ''} onChange={e => handleChange('code', e.target.value.toUpperCase())} maxLength={50} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email || ''} onChange={e => handleChange('email', e.target.value)} maxLength={255} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={formData.phone || ''} onChange={e => handleChange('phone', e.target.value)} maxLength={20} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.primaryColorCode || '#1976D2'}
                    onChange={e => handleChange('primaryColorCode', e.target.value)}
                    className="h-10 w-10 rounded border cursor-pointer"
                  />
                  <Input value={formData.primaryColorCode || ''} onChange={e => handleChange('primaryColorCode', e.target.value)} placeholder="#1976D2" maxLength={7} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Secondary Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.secondaryColorCode || '#FFC107'}
                    onChange={e => handleChange('secondaryColorCode', e.target.value)}
                    className="h-10 w-10 rounded border cursor-pointer"
                  />
                  <Input value={formData.secondaryColorCode || ''} onChange={e => handleChange('secondaryColorCode', e.target.value)} placeholder="#FFC107" maxLength={7} />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="location" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea id="address" value={formData.address || ''} onChange={e => handleChange('address', e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={formData.city || ''} onChange={e => handleChange('city', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="district">District</Label>
                <Input id="district" value={formData.district || ''} onChange={e => handleChange('district', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="province">Province</Label>
                <Input id="province" value={formData.province || ''} onChange={e => handleChange('province', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" value={formData.state || ''} onChange={e => handleChange('state', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" value={formData.country || ''} onChange={e => handleChange('country', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pinCode">Pin Code</Label>
                <Input id="pinCode" value={formData.pinCode || ''} onChange={e => handleChange('pinCode', e.target.value)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="about" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="vision">Vision</Label>
              <Textarea id="vision" value={formData.vision || ''} onChange={e => handleChange('vision', e.target.value)} rows={3} placeholder="Institute vision statement..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mission">Mission</Label>
              <Textarea id="mission" value={formData.mission || ''} onChange={e => handleChange('mission', e.target.value)} rows={3} placeholder="Institute mission statement..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={formData.description || ''} onChange={e => handleChange('description', e.target.value)} rows={4} placeholder="Brief description of the institute..." />
            </div>
          </TabsContent>

          <TabsContent value="online" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input id="websiteUrl" value={formData.websiteUrl || ''} onChange={e => handleChange('websiteUrl', e.target.value)} placeholder="https://your-institute.edu" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facebookPageUrl">Facebook Page</Label>
              <Input id="facebookPageUrl" value={formData.facebookPageUrl || ''} onChange={e => handleChange('facebookPageUrl', e.target.value)} placeholder="https://facebook.com/your-institute" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="youtubeChannelUrl">YouTube Channel</Label>
              <Input id="youtubeChannelUrl" value={formData.youtubeChannelUrl || ''} onChange={e => handleChange('youtubeChannelUrl', e.target.value)} placeholder="https://youtube.com/c/your-institute" />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateInstituteForm;
