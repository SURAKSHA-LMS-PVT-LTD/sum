import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, ChevronRight, Loader2, CheckCircle2, Building2, MapPin, Globe, Mail,
  ImageIcon, Upload, X, Palette, Plus,
} from 'lucide-react';
import surakshaLogo from '@/assets/suraksha-logo.png';
import loginIllustration from '@/assets/login-illustration.png';
import { useToast } from '@/hooks/use-toast';
import {
  registerInstitute,
  uploadInstituteFile,
  assignUserAsAdmin,
  validateInstituteImage,
  isValidInstituteCode,
  canCreateInstitute,
  type CreateInstituteRequest,
} from '@/api/instituteRegistration.api';
import { DISTRICTS, DISTRICT_TO_PROVINCE } from '@/api/registration.api';
import { useAuth } from '@/contexts/AuthContext';

// ============= TYPES =============

type FlowStep = 'basic' | 'contact' | 'location' | 'images' | 'additional' | 'review';

const STEPS: { key: FlowStep; label: string }[] = [
  { key: 'basic', label: 'Basic' },
  { key: 'contact', label: 'Contact' },
  { key: 'location', label: 'Location' },
  { key: 'images', label: 'Images' },
  { key: 'additional', label: 'Info' },
  { key: 'review', label: 'Review' },
];

interface InstituteRegistrationProps {
  onBack: () => void;
  onComplete: (data: any) => void;
}

// ============= STEP INDICATOR =============

const StepIndicator: React.FC<{ steps: string[]; current: number }> = ({ steps, current }) => (
  <div className="flex items-center justify-between w-full max-w-md mx-auto">
    {steps.map((label, i) => (
      <React.Fragment key={label}>
        <div className="flex flex-col items-center gap-1">
          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-bold transition-colors ${
            i < current ? 'bg-primary text-primary-foreground' :
            i === current ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
            'bg-muted text-muted-foreground'
          }`}>
            {i < current ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
          </div>
          <span className={`text-[9px] sm:text-[10px] font-medium ${i <= current ? 'text-primary' : 'text-muted-foreground'}`}>
            {label}
          </span>
        </div>
        {i < steps.length - 1 && (
          <div className={`flex-1 h-0.5 mx-0.5 sm:mx-1 mb-5 ${i < current ? 'bg-primary' : 'bg-muted'}`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

// ============= IMAGE UPLOAD ITEM =============

const ImageUploadItem: React.FC<{
  label: string;
  preview: string;
  uploading: boolean;
  accept?: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
}> = ({ label, preview, uploading, accept = 'image/*', onUpload, onRemove }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {preview ? (
        <div className="relative w-full h-24 rounded-lg border border-border overflow-hidden bg-muted">
          <img src={preview} alt={label} className="w-full h-full object-contain" />
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-1 w-full h-24 rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors bg-muted/30">
          <input type="file" accept={accept} className="hidden" onChange={handleFileChange} disabled={uploading} />
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <>
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">Click to upload</span>
            </>
          )}
        </label>
      )}
    </div>
  );
};

// ============= GALLERY UPLOAD =============

const GalleryUpload: React.FC<{
  previews: string[];
  uploading: boolean;
  onUpload: (files: File[]) => void;
  onRemove: (index: number) => void;
}> = ({ previews, uploading, onUpload, onRemove }) => {
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 10 - previews.length);
    if (files.length > 0) onUpload(files);
    e.target.value = '';
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Gallery Images ({previews.length}/10)</Label>
      <div className="grid grid-cols-4 gap-2">
        {previews.map((p, i) => (
          <div key={i} className="relative h-16 rounded-lg border border-border overflow-hidden bg-muted">
            <img src={p} alt={`Gallery ${i + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
        {previews.length < 10 && (
          <label className="flex flex-col items-center justify-center h-16 rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer bg-muted/30">
            <input type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden" onChange={handleFiles} multiple disabled={uploading} />
            {uploading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Plus className="h-4 w-4 text-muted-foreground" />}
          </label>
        )}
      </div>
    </div>
  );
};

// ============= COMPONENT =============

const InstituteRegistration: React.FC<InstituteRegistrationProps> = ({ onBack, onComplete }) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [step, setStep] = useState<FlowStep>('basic');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [shortName, setShortName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [systemContactPhone, setSystemContactPhone] = useState('');
  const [systemContactEmail, setSystemContactEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1976D2');
  const [secondaryColor, setSecondaryColor] = useState('#FFC107');

  // Image data
  const [logoUrl, setLogoUrl] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const [loadingGifUrl, setLoadingGifUrl] = useState('');
  const [loadingGifPreview, setLoadingGifPreview] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [uploadingField, setUploadingField] = useState<string>('');

  const currentStepIdx = STEPS.findIndex(s => s.key === step);

  // Eligibility check
  const userType = user?.userType || '';
  const isEligible = canCreateInstitute(userType);

  if (!isEligible) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <Building2 className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Not Eligible</h2>
            <p className="text-sm text-muted-foreground">
              Your account type does not support creating institutes. Please contact support to upgrade your account.
            </p>
            <Button variant="outline" onClick={onBack} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============= IMAGE UPLOAD =============

  const handleImageUpload = async (file: File, field: 'logo' | 'loadingGif' | 'image') => {
    const validationError = validateInstituteImage(file);
    if (validationError) {
      toast({ title: 'Invalid file', description: validationError, variant: 'destructive' });
      return;
    }

    setUploadingField(field);
    try {
      const relativePath = await uploadInstituteFile(file);
      const preview = URL.createObjectURL(file);

      if (field === 'logo') { setLogoUrl(relativePath); setLogoPreview(preview); }
      else if (field === 'loadingGif') { setLoadingGifUrl(relativePath); setLoadingGifPreview(preview); }
      else { setImageUrl(relativePath); setImagePreview(preview); }

      toast({ title: 'Image uploaded successfully' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingField('');
    }
  };

  const handleGalleryUpload = async (files: File[]) => {
    setUploadingField('gallery');
    try {
      for (const file of files) {
        const validationError = validateInstituteImage(file);
        if (validationError) {
          toast({ title: `Skipped ${file.name}`, description: validationError, variant: 'destructive' });
          continue;
        }
        const relativePath = await uploadInstituteFile(file);
        const preview = URL.createObjectURL(file);
        setGalleryUrls(prev => [...prev, relativePath]);
        setGalleryPreviews(prev => [...prev, preview]);
      }
      toast({ title: 'Gallery images uploaded' });
    } catch (err: any) {
      toast({ title: 'Gallery upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingField('');
    }
  };

  const removeImage = (field: 'logo' | 'loadingGif' | 'image') => {
    if (field === 'logo') { setLogoUrl(''); setLogoPreview(''); }
    else if (field === 'loadingGif') { setLoadingGifUrl(''); setLoadingGifPreview(''); }
    else { setImageUrl(''); setImagePreview(''); }
  };

  const removeGalleryImage = (index: number) => {
    setGalleryUrls(prev => prev.filter((_, i) => i !== index));
    setGalleryPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // ============= VALIDATION =============

  const validateBasic = (): boolean => {
    if (!name.trim()) { toast({ title: 'Institute name is required', variant: 'destructive' }); return false; }
    if (!code.trim()) { toast({ title: 'Institute code is required', variant: 'destructive' }); return false; }
    if (!isValidInstituteCode(code)) {
      toast({ title: 'Invalid code format', description: 'Use uppercase letters, numbers, hyphens, underscores only', variant: 'destructive' });
      return false;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: 'Valid email is required', variant: 'destructive' }); return false;
    }
    return true;
  };

  const validateContact = (): boolean => {
    const cleanPhone = systemContactPhone.replace(/\s/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      toast({ title: 'Valid contact phone number is required', variant: 'destructive' }); return false;
    }
    if (!systemContactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(systemContactEmail)) {
      toast({ title: 'Valid system contact email required', variant: 'destructive' }); return false;
    }
    return true;
  };

  // ============= NAVIGATION =============

  const handleNext = () => {
    switch (step) {
      case 'basic': if (validateBasic()) setStep('contact'); break;
      case 'contact': if (validateContact()) setStep('location'); break;
      case 'location': setStep('images'); break;
      case 'images': setStep('additional'); break;
      case 'additional': setStep('review'); break;
    }
  };

  const handleBack = () => {
    switch (step) {
      case 'basic': onBack(); break;
      case 'contact': setStep('basic'); break;
      case 'location': setStep('contact'); break;
      case 'images': setStep('location'); break;
      case 'additional': setStep('images'); break;
      case 'review': setStep('additional'); break;
    }
  };

  // ============= SUBMIT =============

  const handleSubmit = async () => {
    setIsLoading(true);
    setError('');

    const payload: CreateInstituteRequest = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      email: email.trim(),
      ...(systemContactPhone && { systemContactPhoneNumber: systemContactPhone.replace(/\s/g, '') }),
      ...(systemContactEmail && { systemContactEmail: systemContactEmail.trim() }),
      ...(shortName && { shortName: shortName.trim() }),
      ...(phone && { phone: phone.trim() }),
      ...(address && { address: address.trim() }),
      ...(city && { city: city.trim() }),
      ...(district && { district }),
      ...(district && DISTRICT_TO_PROVINCE[district] && { province: DISTRICT_TO_PROVINCE[district] }),
      ...(pinCode && { pinCode: pinCode.trim() }),
      ...(description && { description: description.trim() }),
      ...(websiteUrl && { websiteUrl: websiteUrl.trim() }),
      ...(logoUrl && { logoUrl }),
      ...(loadingGifUrl && { loadingGifUrl }),
      ...(imageUrl && { imageUrl }),
      ...(galleryUrls.length > 0 && { imageUrls: galleryUrls }),
      ...(primaryColor && { primaryColorCode: primaryColor }),
      ...(secondaryColor && { secondaryColorCode: secondaryColor }),
      country: 'SRI_LANKA',
    };

    try {
      const result = await registerInstitute(payload);

      // Auto-assign creator as admin
      if (user) {
        try {
          if (user.phone) {
            await assignUserAsAdmin(result.id, 'phone', user.phone);
          } else if (user.email) {
            await assignUserAsAdmin(result.id, 'email', user.email);
          } else if (user.id) {
            await assignUserAsAdmin(result.id, 'id', user.id);
          }
        } catch (adminErr: any) {
          console.warn('Auto-admin assignment:', adminErr.message);
        }
      }

      toast({
        title: 'Institute created successfully!',
        description: `Code: ${result.code}. You have been assigned as admin.`,
      });
      onComplete(result);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      toast({ title: 'Registration failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // ============= RENDER STEPS =============

  const renderContent = () => {
    if (step === 'basic') {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-border/50">
            <Building2 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Institute Information</h3>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Institute Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Cambridge International School" className="h-9" maxLength={255} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Institute Code *</Label>
            <Input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
              placeholder="CIS001"
              className="h-9 font-mono uppercase"
              maxLength={50}
            />
            <p className="text-[10px] text-muted-foreground">Uppercase letters, numbers, hyphens, underscores only (e.g. CIS-001)</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Short Name</Label>
            <Input value={shortName} onChange={e => setShortName(e.target.value)} placeholder="CIS" className="h-9" maxLength={50} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Institute Email *</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@school.edu" className="h-9" maxLength={255} />
          </div>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="h-11" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button className="flex-1 h-11" onClick={handleNext}>
              Continue <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    if (step === 'contact') {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-border/50">
            <Mail className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Contact Details</h3>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">System Contact Phone *</Label>
            <Input type="tel" value={systemContactPhone} onChange={e => setSystemContactPhone(e.target.value)} placeholder="+94712345678" className="h-9" maxLength={20} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">System Contact Email *</Label>
            <Input type="email" value={systemContactEmail} onChange={e => setSystemContactEmail(e.target.value)} placeholder="system@school.edu" className="h-9" maxLength={255} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Institute Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+94112345678" className="h-9" maxLength={20} />
          </div>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="h-11" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button className="flex-1 h-11" onClick={handleNext}>
              Continue <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    if (step === 'location') {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-border/50">
            <MapPin className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Location Details</h3>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Address</Label>
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Education Street" className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">District</Label>
              <Select value={district} onValueChange={v => setDistrict(v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select district" /></SelectTrigger>
                <SelectContent>
                  {DISTRICTS.map(d => (
                    <SelectItem key={d} value={d}>{d.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">City</Label>
              <Input value={city} onChange={e => setCity(e.target.value)} placeholder="Colombo" className="h-9" maxLength={100} />
            </div>
          </div>
          {district && (
            <div className="text-xs text-muted-foreground bg-primary/10 p-2 rounded-lg">
              Province: {(DISTRICT_TO_PROVINCE[district] || '').replace(/_/g, ' ')}
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Postal Code</Label>
            <Input value={pinCode} onChange={e => setPinCode(e.target.value)} placeholder="00100" className="h-9" maxLength={20} />
          </div>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="h-11" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button className="flex-1 h-11" onClick={handleNext}>
              Continue <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    if (step === 'images') {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-border/50">
            <ImageIcon className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Institute Images</h3>
          </div>
          <p className="text-xs text-muted-foreground">Upload branding images (max 10 MB each). Supports JPG, PNG, WebP, SVG.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ImageUploadItem
              label="Logo"
              preview={logoPreview}
              uploading={uploadingField === 'logo'}
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onUpload={(file) => handleImageUpload(file, 'logo')}
              onRemove={() => removeImage('logo')}
            />
            <ImageUploadItem
              label="Loading GIF"
              preview={loadingGifPreview}
              uploading={uploadingField === 'loadingGif'}
              accept="image/gif,image/png,image/webp"
              onUpload={(file) => handleImageUpload(file, 'loadingGif')}
              onRemove={() => removeImage('loadingGif')}
            />
          </div>

          <ImageUploadItem
            label="Cover Image"
            preview={imagePreview}
            uploading={uploadingField === 'image'}
            accept="image/png,image/jpeg,image/webp"
            onUpload={(file) => handleImageUpload(file, 'image')}
            onRemove={() => removeImage('image')}
          />

          <GalleryUpload
            previews={galleryPreviews}
            uploading={uploadingField === 'gallery'}
            onUpload={handleGalleryUpload}
            onRemove={removeGalleryImage}
          />

          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="h-11" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button className="flex-1 h-11" onClick={handleNext}>
              Continue <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    if (step === 'additional') {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-border/50">
            <Globe className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Additional Information</h3>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of your institute..." className="min-h-[80px]" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Website URL</Label>
            <Input value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://school.edu" className="h-9" maxLength={255} />
          </div>

          {/* Theme Colors */}
          <div className="flex items-center gap-2 pb-1 border-b border-border/50 mt-4">
            <Palette className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Theme Colors</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Primary Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="w-10 h-9 rounded-md border border-border cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="h-9 font-mono text-xs flex-1"
                  maxLength={7}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Secondary Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={e => setSecondaryColor(e.target.value)}
                  className="w-10 h-9 rounded-md border border-border cursor-pointer"
                />
                <Input
                  value={secondaryColor}
                  onChange={e => setSecondaryColor(e.target.value)}
                  className="h-9 font-mono text-xs flex-1"
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="h-11" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button className="flex-1 h-11" onClick={handleNext}>
              Review <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      );
    }

    if (step === 'review') {
      return (
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground text-base">Review — Institute Creation</h3>
          <div className="space-y-2 text-sm">
            {[
              ['Institute Name', name],
              ['Code', code],
              ['Short Name', shortName],
              ['Email', email],
              ['System Contact Phone', systemContactPhone],
              ['System Contact Email', systemContactEmail],
              ['Phone', phone],
              ['Address', address],
              ['City', city],
              ['District', district?.replace(/_/g, ' ')],
              ['Province', district ? (DISTRICT_TO_PROVINCE[district] || '').replace(/_/g, ' ') : ''],
              ['Postal Code', pinCode],
              ['Website', websiteUrl],
              ['Description', description],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label} className="flex justify-between py-1.5 border-b border-border/50">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-foreground text-right max-w-[60%] truncate">{value}</span>
              </div>
            ))}
          </div>

          {/* Color preview */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Theme:</span>
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-lg border border-border" style={{ backgroundColor: primaryColor }} title={`Primary: ${primaryColor}`} />
              <div className="w-8 h-8 rounded-lg border border-border" style={{ backgroundColor: secondaryColor }} title={`Secondary: ${secondaryColor}`} />
            </div>
          </div>

          {/* Image previews */}
          {(logoPreview || loadingGifPreview || imagePreview || galleryPreviews.length > 0) && (
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Uploaded Images</span>
              <div className="flex gap-3 flex-wrap">
                {logoPreview && (
                  <div className="space-y-1">
                    <img src={logoPreview} alt="Logo" className="w-16 h-16 rounded-lg border border-border object-contain bg-muted" />
                    <span className="text-[10px] text-muted-foreground block text-center">Logo</span>
                  </div>
                )}
                {loadingGifPreview && (
                  <div className="space-y-1">
                    <img src={loadingGifPreview} alt="Loading" className="w-16 h-16 rounded-lg border border-border object-contain bg-muted" />
                    <span className="text-[10px] text-muted-foreground block text-center">Loading</span>
                  </div>
                )}
                {imagePreview && (
                  <div className="space-y-1">
                    <img src={imagePreview} alt="Cover" className="w-16 h-16 rounded-lg border border-border object-contain bg-muted" />
                    <span className="text-[10px] text-muted-foreground block text-center">Cover</span>
                  </div>
                )}
                {galleryPreviews.map((p, i) => (
                  <div key={i} className="space-y-1">
                    <img src={p} alt={`Gallery ${i + 1}`} className="w-16 h-16 rounded-lg border border-border object-cover bg-muted" />
                    <span className="text-[10px] text-muted-foreground block text-center">Gallery</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground bg-primary/10 p-3 rounded-lg">
            By creating this institute, you will be automatically assigned as the Institute Admin.
          </div>

          {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</div>}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 h-10" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button className="flex-1 h-10" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</> : 'Create Institute'}
            </Button>
          </div>
        </div>
      );
    }

    return null;
  };

  // ============= LAYOUT =============

  return (
    <div className="min-h-[100dvh] bg-muted/30 overflow-y-auto pt-safe-top pb-4 px-4 sm:flex sm:items-center sm:justify-center sm:p-8">
      <div className="w-full max-w-5xl bg-background rounded-2xl shadow-xl border border-border/50 flex flex-col md:flex-row my-4 sm:my-0">
        {/* Left Sidebar - Steps */}
        <div className="w-full md:w-64 bg-muted/30 p-6 sm:p-8 border-r border-border/50 flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shadow-sm">
              <img src={surakshaLogo} alt="SurakshaLMS" className="w-7 h-7 object-contain" loading="lazy" />
            </div>
            <h2 className="font-bold text-lg tracking-tight">SurakshaLMS</h2>
          </div>
          
          <div className="flex-1 hidden md:block">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Registration Steps</h3>
            <div className="space-y-1">
              {STEPS.map((s, i) => (
                <div key={s.key} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${i === currentStepIdx ? 'bg-primary/10 text-primary font-medium' : i < currentStepIdx ? 'text-foreground' : 'text-muted-foreground'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${i === currentStepIdx ? 'bg-primary text-primary-foreground' : i < currentStepIdx ? 'bg-primary/20 text-primary' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
                    {i < currentStepIdx ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span className="text-sm">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-auto pt-6 border-t border-border/50 hidden md:block">
            <Button variant="ghost" onClick={onBack} className="w-full justify-start text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Right Content - Form */}
        <div className="flex-1 p-6 sm:p-10 flex flex-col bg-background overflow-y-auto">
          <div className="max-w-2xl w-full mx-auto flex-1 flex flex-col">
            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-2">Create New Institute</h1>
              <p className="text-sm text-muted-foreground">Set up your institute profile to get started with SurakshaLMS</p>
            </div>
            
            {/* Mobile Step Indicator */}
            <div className="md:hidden mb-8">
              <StepIndicator steps={STEPS.map(s => s.label)} current={currentStepIdx} />
            </div>
            
            <div className="flex-1 bg-card rounded-xl border border-border/50 p-5 sm:p-8 shadow-sm">
              {renderContent()}
            </div>

            {/* Mobile Back Button */}
            <div className="md:hidden mt-6 mb-4 text-center">
              <Button variant="ghost" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InstituteRegistration;
